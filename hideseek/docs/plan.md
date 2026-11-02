# 학교 변신 숨바꼭질 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생 7명 + 교사 1명이 크롬북으로 함께 하는 2D 탑다운 "사물 변신 숨바꼭질" 웹게임을 만든다.

**Architecture:** 정적 웹앱(Phaser 3)이 Firebase Realtime Database로 상태를 공유한다. 서버는 없고 교사 브라우저의 `Referee`가 타이머·잡기 판정·점수를 맡는다. 규칙은 순수 함수(`rules.ts`)로 분리해 단위 테스트하고, Firebase 접근은 `room.ts` 한 곳에 모은다.

**Tech Stack:** TypeScript, Vite 4, Phaser 3.55, Firebase JS SDK 12 (Realtime Database, Anonymous Auth), Vitest, firebase-tools 에뮬레이터, `@firebase/rules-unit-testing`, Playwright(사전 설치된 Chromium).

**Spec:** `hideseek/docs/design.md`

## Global Constraints

- 위치: 모든 코드는 `hideseek/` 아래. `mumusubject/`는 건드리지 않는다.
- 스택 버전은 `mumusubject/client/package.json`과 맞춘다: `phaser@^3.55.2`, `firebase@^12.12.1`, `vite@^4.0.0`, `typescript@^6.0.3`.
- Firebase 프로젝트는 `mumusubject`와 공유. 환경변수: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`, `VITE_TEACHER_CODE`. 에뮬레이터용 `VITE_USE_EMULATOR=1`.
- 게임 상수(spec 값 그대로): 준비 30초, 찾기 4분, 결과 15초, 확인 거리 120px, 헛짚음 정지 2초, 시야 반경 180px, 이동 140px/초, 학생 정원 7명, 이름 1~8자, 위치 업로드 약 초당 10회.
- 점수: 숨는 편 찾기 30초당 +1, 끝까지 생존 +5, 잡을 때마다 +3. 승패 보너스 없음.
- 맵: 약 1600×960px, 32px 타일, 교실 2 + 복도 + 도서관, 원래 사물 50~60개, 변신 가능 사물 10~12종.
- UI 문구는 한국어. 그래픽은 도형 + 이모지.
- 시간은 모두 Firebase 서버 시간 기준 ms(`.info/serverTimeOffset` 보정).
- 개발 서버 포트: 5275 (mumusubject는 5274).

## Review Focus

1. **선생님 탭 새로고침/닫힘 중 판 진행** — 다시 열면 같은 방에 교사로 복귀하고, 남은 시간이 1초 오차 안에서 이어져야 한다. → Task 4 `resume` 테스트, Task 7 E2E.
2. **같은 술래 편 2명이 같은 학생을 거의 동시에 클릭** — 한 번만 잡히고 +3점도 한 명만 받아야 한다. → Task 4 `duplicate catch` 테스트.
3. **찾기 단계 도중 숨는 학생이 접속 끊김 후 새로고침** — 같은 uid로 돌아와 같은 사물·위치로 이어서 숨어야 하고, 새 학생으로 취급되면 안 된다. → Task 3 `rejoin keeps uid` 테스트.
4. **판 진행 중 새 학생 입장 / 8번째 학생 입장** — 진행 중이면 `wait`로 들어가 다음 판부터 참여, 정원 초과면 거부. → Task 3 `full room`, Task 4 `late joiner waits` 테스트.
5. **일시정지 중 학생 입력** — 이동·클릭이 막혀야 하고, 일시정지 중 도착한 클릭 요청은 판정되지 않아야 한다. → Task 1 `resolveAction` paused 케이스, Task 6 입력 잠금.

---

## 공용 타입 (Task 1에서 `src/game/types.ts`로 정의, 이후 모든 Task가 사용)

```ts
export type Phase = 'lobby' | 'prep' | 'seek' | 'result' | 'final';
export type Team = 'seek' | 'hide' | 'wait';

export interface Meta {
  hostUid: string;
  phase: Phase;
  round: number;            // 0 = 아직 시작 안 함
  phaseEndsAt: number;      // 서버 시간 ms, lobby/final에서는 0
  paused: boolean;
  remainingMs: number;      // paused일 때만 의미
  seekerOrder: string[];    // 입장 순서 uid
  seekerUid: string | null; // 이번 판 첫 술래
  seekStartedAt: number;    // 찾기 단계 시작 서버 시각(일시정지 시간은 phaseEndsAt 이동으로 반영)
}
export interface Profile { name: string; prop: string | null; joinedAt: number; }
export interface PlayerState { team: Team; caught: boolean; frozenUntil: number; score: number; caughtAt: number; }
export interface Pos { x: number; y: number; moving: boolean; }
export interface Action { uid: string; targetType: 'decor' | 'player'; targetId: string; at: number; }
export interface Player { profile: Profile; state: PlayerState; online: boolean; }
export interface RoomSnapshot { meta: Meta; players: Record<string, Player>; pos: Record<string, Pos>; }
```

---

### Task 1: 프로젝트 뼈대 + 규칙 순수 함수

**Files:**
- Create: `hideseek/.gitignore`, `hideseek/client/package.json`, `hideseek/client/tsconfig.json`, `hideseek/client/vite.config.ts`, `hideseek/client/index.html`, `hideseek/client/.env.example`
- Create: `hideseek/client/src/game/types.ts`, `hideseek/client/src/game/constants.ts`, `hideseek/client/src/game/rules.ts`
- Test: `hideseek/client/src/game/rules.test.ts`

**Interfaces:**
- Produces (`constants.ts`): `PREP_MS=30000`, `SEEK_MS=240000`, `RESULT_MS=15000`, `TAG_RANGE=120`, `FREEZE_MS=2000`, `VISION_RADIUS=180`, `SPEED=140`, `MAX_STUDENTS=7`, `POINT_INTERVAL_MS=30000`, `SURVIVE_BONUS=5`, `CATCH_POINTS=3`, `NAME_MAX=8`.
- Produces (`rules.ts`):
  - `validName(raw: string): string | null` — trim 후 1~8자면 반환, 아니면 null.
  - `pickSeeker(order: string[], round: number, online: Set<string>): string | null` — 시작 인덱스 `(round - 1) % order.length`부터 앞으로 돌며 첫 online uid.
  - `assignTeams` — `order`의 모든 uid를 대상으로 술래는 `seek`, 나머지는 접속 여부와 관계없이 `hide`(끊긴 학생도 참여자로 두어 재접속하면 바로 이어서 숨는다). `online`은 술래 선택에만 쓰이므로 이 함수에서는 받지 않는다 → 시그니처 `assignTeams(order: string[], seekerUid: string): Record<string, Team>`.
  - `resolveAction(a: Action, ctx: { meta: Meta; now: number; players: Record<string, Player>; pos: Record<string, Pos>; decorPos: (id: string) => { x: number; y: number } | undefined }): ActionResult`
    - `type ActionResult = { kind: 'catch'; seekerUid: string; targetUid: string } | { kind: 'freeze'; uid: string; until: number } | { kind: 'ignore'; reason: 'phase' | 'paused' | 'not-seeker' | 'frozen' | 'far' | 'invalid' }`
  - `seekElapsed(meta: Meta, now: number): number` — 찾기 단계 경과 ms(일시정지면 `SEEK_MS - remainingMs`, 아니면 `SEEK_MS - (phaseEndsAt - now)`), 0~SEEK_MS로 자름.
  - `catchPoints(elapsedMs: number): number` — 잡힌 숨는 편이 받는 `floor(elapsed / 30000)`.
  - `settleSurvivors(players: Record<string, Player>, elapsedMs: number): Record<string, number>` — 안 잡힌 `hide` 팀 uid → `floor(elapsed/30000) + 5`.
  - `allCaught(players: Record<string, Player>): boolean` — `hide` 팀 중 안 잡힌 사람이 0명이면 true(숨는 편이 원래 0명이면 false).
  - `winner(players): 'seek' | 'hide'`.
  - `nextPhase(meta: Meta, now: number, everyoneCaught: boolean): { phase: Phase; phaseEndsAt: number } | null` — paused면 null. prep 만료→seek(+SEEK_MS), seek 만료 또는 everyoneCaught→result(+RESULT_MS), result 만료→lobby(0). 그 외 null.

- [ ] **Step 1: 뼈대 생성.** `package.json` scripts: `dev`(vite --port 5275), `build`(tsc --noEmit && vite build), `test`(vitest run), `test:rules`(firebase emulators:exec 로 Task 3 테스트), `e2e`(Task 7). devDeps: vitest, firebase-tools, `@firebase/rules-unit-testing`, playwright는 사전 설치본 사용(설치하지 않음). `.gitignore`에 `node_modules`, `dist`, `.env*`(단 `.env.example` 제외), `*-debug.log`.
- [ ] **Step 2: 실패하는 테스트 작성** (`rules.test.ts`). 픽스처 헬퍼 `mkPlayer(team, opts)`, `mkMeta(opts)`를 테스트 파일 안에 둔다. 필수 케이스:
  - `validName('  철수  ') === '철수'`, `validName('') === null`, `validName('가나다라마바사아자') === null`(9자)
  - `pickSeeker(['a','b','c'], 1, {a,b,c}) === 'a'`, round 2 → `'b'`, round 4 → `'a'`, round 2 + b offline → `'c'`, 모두 offline → `null`
  - `resolveAction`: 거리 119px 숨는 편 대상 → `catch`; 121px → `ignore/far`; 대상이 decor(거리 50) → `freeze` with `until = now + 2000`; 요청자 `frozenUntil > now` → `ignore/frozen`; 요청자가 `hide` → `ignore/not-seeker`; `phase='prep'` → `ignore/phase`; `paused=true` → `ignore/paused`; 대상이 이미 `caught` → `ignore/invalid`; 없는 decor id → `ignore/invalid`
  - `catchPoints(59_999) === 1`, `catchPoints(60_000) === 2`
  - `settleSurvivors`: elapsed 240000, 생존자 1명 → `{ uid: 13 }`(8+5), 잡힌 사람은 키 없음
  - `seekElapsed`: paused & remainingMs 100000 → 140000
  - `nextPhase`: prep 만료 → `{ phase:'seek', phaseEndsAt: now+240000 }`; seek 미만료+everyoneCaught → result; paused → null; lobby → null
- [ ] **Step 3: 실행해 실패 확인.** `cd hideseek/client && npm install && npx vitest run src/game/rules.test.ts` → FAIL(모듈 없음).
- [ ] **Step 4: `types.ts`, `constants.ts`, `rules.ts` 구현.** 거리 기준은 요청자 `pos`와 대상 위치(player면 `pos[targetId]`, decor면 `decorPos(id)`)의 유클리드 거리 `<= TAG_RANGE`.
- [ ] **Step 5: 통과 확인.** 같은 명령 → 모든 테스트 PASS. `npx tsc --noEmit` 오류 0.
- [ ] **Step 6: 커밋.** `git add hideseek && git commit -m "feat(hideseek): scaffold client and pure game rules"`

### Task 2: 맵 데이터

**Files:**
- Create: `hideseek/client/src/game/map.ts`
- Test: `hideseek/client/src/game/map.test.ts`

**Interfaces:**
- Produces:
  - `MAP_W = 1600`, `MAP_H = 960`, `TILE = 32`
  - `interface PropKind { id: string; label: string; emoji: string; w: number; h: number }`
  - `PROP_KINDS: PropKind[]` — 12종: desk 책상, chair 의자, locker 사물함, plant 화분, trash 쓰레기통, bookshelf 책장, globe 지구본, umbrella 우산꽂이, extinguisher 소화기, mopbox 청소도구함, books 책 더미, water 정수기
  - `interface Decor { id: string; kind: string; x: number; y: number }` (x,y는 중심)
  - `DECOR: Decor[]` — 50~60개, id `d0`…
  - `WALLS: { x: number; y: number; w: number; h: number }[]` — 방 경계 사각형(문 틈 포함)
  - `SEEKER_SPAWN: { x: number; y: number }` — 복도 한쪽 끝
  - `HIDER_SPAWNS: { x: number; y: number }[]` — 6곳
  - `decorPos(id: string): { x: number; y: number } | undefined`
  - `blocked(x: number, y: number, r: number): boolean` — 반지름 r 원이 벽이나 맵 밖과 겹치면 true (이동 충돌용, 사물과는 충돌 안 함)

- [ ] **Step 1: 실패하는 테스트 작성.** 케이스: `PROP_KINDS.length` 10~12, id 중복 없음; `DECOR.length` 50~60; 모든 decor kind가 `PROP_KINDS`에 있음; 모든 decor 중심이 맵 안이고 `blocked(x,y,8) === false`; `SEEKER_SPAWN`, `HIDER_SPAWNS` 모두 `blocked(...,12) === false`; `blocked(-1, 100, 12) === true`; 네 구역(교실1, 교실2, 복도, 도서관)마다 decor 8개 이상(구역 사각형은 map.ts에서 `AREAS`로 export).
- [ ] **Step 2: 실패 확인.** `npx vitest run src/game/map.test.ts` → FAIL.
- [ ] **Step 3: `map.ts` 구현.** 배치는 손으로 적은 상수 배열(랜덤 생성 아님 — 판마다 같은 맵이어야 학생들이 익숙해진다). 교실에는 책상·의자 위주, 도서관에는 책장·책 더미·지구본, 복도에는 사물함·소화기·정수기·우산꽂이.
- [ ] **Step 4: 통과 확인.** 같은 명령 → PASS.
- [ ] **Step 5: 커밋.** `git commit -m "feat(hideseek): school map data"`

### Task 3: Firebase 연결, 방 API, 보안 규칙

**Files:**
- Create: `hideseek/client/src/net/firebase.ts`, `hideseek/client/src/net/room.ts`
- Create: `hideseek/database.rules.json`, `hideseek/firebase.json`(database 에뮬레이터 9000, auth 9099, rules 경로), `hideseek/.firebaserc`(default 프로젝트 `demo-hideseek` — 에뮬레이터 전용)
- Test: `hideseek/client/test/rules.test.ts`(에뮬레이터 필요, Vitest 별도 config `vitest.rules.config.ts`), `hideseek/client/test/room.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `constants.ts`, `validName`
- Produces (`firebase.ts`): `getDb(): Database`, `ensureUid(): Promise<string>`(익명 로그인, 이미 있으면 그 uid), `serverNow(): number`(`Date.now() + serverTimeOffset`). `VITE_USE_EMULATOR=1`이면 `connectDatabaseEmulator('127.0.0.1', 9000)`, `connectAuthEmulator('http://127.0.0.1:9099')`.
- Produces (`room.ts`):
  - `createRoom(hostUid: string): Promise<string>` — 1000~9999 무작위 코드, 이미 있으면 다시 뽑음(최대 20회). 초기 meta: phase `lobby`, round 0. localStorage `hideseek.hostRoom`에 저장.
  - `findHostRoom(hostUid: string): Promise<string | null>` — localStorage 코드의 `meta.hostUid === hostUid`면 그 코드.
  - `joinRoom(code: string, uid: string, rawName: string): Promise<'ok' | 'notfound' | 'full' | 'kicked' | 'badname'>` — 이미 `players/{uid}`가 있으면 이름 갱신 없이 `'ok'`(재접속). 새 학생이면 정원 검사 후 profile 쓰기 + `seekerOrder`에 추가 요청은 하지 않는다(교사만 meta를 쓰므로 Referee가 새 profile을 보고 추가). presence onDisconnect 등록.
  - `subscribeRoom(code: string, cb: (s: RoomSnapshot) => void): () => void`
  - `setPos(code, uid, p: Pos): void`, `setProp(code, uid, prop: string): void`, `pushAction(code, a: Action): void`
  - 교사 전용: `updateMeta(code, p: Partial<Meta>)`, `updateStates(code, p: Record<string, Partial<PlayerState>>)`, `onActions(code, cb: (id: string, a: Action) => void): () => void`, `deleteAction(code, id)`, `kick(code, uid)`(kicked 기록 + players/pos/presence 삭제), `armHostDisconnect(code, remainingMs: number | null)` — `onDisconnect(meta).update({ paused: true, remainingMs })`를 다시 등록(remainingMs null이면 phase가 lobby라 paused만), `hostPresence` 경로에 online 표시.
  - 위치 쓰기 경로는 `rooms/{code}/pos/{uid}`, presence는 `rooms/{code}/presence/{uid}`, 교사 접속은 `rooms/{code}/presence/host`.
- 규칙(`database.rules.json`): design.md §4.5 그대로. 추가로 `profile/name`은 문자열 1~8자, `pos/x,y`는 숫자, `profile` 생성 시 학생 수 7명 미만(`root.child('rooms/'+$code+'/players').numChildren() < 7` 또는 이미 존재).

- [ ] **Step 1: 실패하는 규칙 테스트 작성** (`test/rules.test.ts`, `initializeTestEnvironment({ projectId: 'demo-hideseek', database: { rules } })`). 케이스: 교사는 `meta` 쓰기 가능 / 학생은 `meta` 쓰기 거부; 학생 본인 `profile` 쓰기 가능 / 남의 `profile` 거부; 학생이 자기 `players/{uid}/state` 쓰기 거부; `kicked/{uid}` 있으면 그 학생 `pos` 쓰기 거부; 이름 9자 거부; 학생 7명 있는 방에 8번째 profile 생성 거부, 기존 학생의 profile 갱신은 허용; 학생이 `actions` push 가능 / 삭제 거부.
- [ ] **Step 2: 실패하는 room 테스트 작성** (`test/room.test.ts`, 에뮬레이터 + 실제 `room.ts`). 케이스: `createRoom` 후 meta.phase === 'lobby'; `joinRoom` 잘못된 코드 → `'notfound'`; 7명 후 8번째 → `'full'`; **rejoin keeps uid**: 같은 uid로 다시 `joinRoom` → `'ok'`이고 players 수 그대로, 기존 profile.prop 유지; `kick` 후 `joinRoom` → `'kicked'`; `joinRoom('1234', uid, '가나다라마바사아자')` → `'badname'`.
- [ ] **Step 3: 실패 확인.** `npm run test:rules` (= `firebase emulators:exec --only database,auth --project demo-hideseek "vitest run -c vitest.rules.config.ts"`) → FAIL.
- [ ] **Step 4: `firebase.ts`, `room.ts`, `database.rules.json` 구현.**
- [ ] **Step 5: 통과 확인.** `npm run test:rules` → 모두 PASS. `npm test`(Task 1~2 단위 테스트)도 PASS 유지.
- [ ] **Step 6: 커밋.** `git commit -m "feat(hideseek): firebase room api and database rules"`

### Task 4: 심판(Referee)

**Files:**
- Create: `hideseek/client/src/host/referee.ts`
- Test: `hideseek/client/src/host/referee.test.ts`(가짜 포트 사용, 에뮬레이터 불필요)

**Interfaces:**
- Consumes: `rules.ts` 전체, `decorPos`(map.ts), `room.ts`의 교사 전용 함수 시그니처
- Produces:
  - `interface RoomPort { updateMeta(p: Partial<Meta>): void; updateStates(p: Record<string, Partial<PlayerState>>): void; deleteAction(id: string): void; armHostDisconnect(remainingMs: number | null): void; kick(uid: string): void; }` — `room.ts` 함수에 code를 묶은 어댑터 `roomPort(code)`도 이 파일에서 export.
  - `class Referee { constructor(port: RoomPort, now: () => number); onSnapshot(s: RoomSnapshot): void; onAction(id: string, a: Action): void; tick(): void; startRound(): 'ok' | 'need-players'; pause(): void; resume(): void; forceEnd(): void; showFinal(): void; kick(uid: string): void; }`
- 동작:
  - `onSnapshot`: 최신 상태 보관. `seekerOrder`에 없는 profile uid가 있으면 순서 끝에 추가(`updateMeta`). 새 학생에게 state가 없으면 `{ team: phase==='lobby' ? 'hide' : 'wait', caught:false, frozenUntil:0, score:0, caughtAt:0 }` 기록(**late joiner waits**).
  - `startRound`(phase가 lobby일 때만): online 학생 2명 미만이면 `'need-players'`. round+1, `pickSeeker`, `assignTeams`, 모든 학생 caught=false·frozenUntil=0·prop은 유지, 술래는 `SEEKER_SPAWN`으로 이동시키지 않는다(위치는 학생 클라이언트가 phase 변화를 보고 스폰으로 이동 — Task 6). phase `prep`, `phaseEndsAt = now + PREP_MS`.
  - `onAction`: `resolveAction` 결과 반영 후 `deleteAction(id)`. `catch` → 대상 `{ team:'seek', caught:true, caughtAt: now, score: +catchPoints(elapsed) }`, 요청자 score +3. 결과를 반영하기 전에 내부 스냅샷도 즉시 갱신해 **같은 대상의 두 번째 catch는 `ignore/invalid`** 가 되게 한다. `freeze` → 요청자 frozenUntil.
  - `tick`(교사 화면이 250ms마다 호출): `nextPhase` 결과 적용. seek→result 전환 시 `settleSurvivors` 점수 반영. 1초마다 `armHostDisconnect(현재 남은 ms)` 재등록.
  - `pause`: `remainingMs = phaseEndsAt - now`, paused true. `resume`: `phaseEndsAt = now + remainingMs`, paused false.
  - `forceEnd`(prep/seek에서): seek였다면 현재 elapsed로 생존자 정산, phase `result`.
  - `showFinal`: phase `final`. 다시 lobby로 돌아가는 버튼은 넣지 않는다(수업 끝).
  - **resume**: 교사 탭이 다시 열려 첫 스냅샷을 받았을 때 `meta.paused`가 onDisconnect로 true가 되어 있으면 그대로 일시정지 상태로 두고 교사가 "재개"를 누르게 한다.

- [ ] **Step 1: 실패하는 테스트 작성.** 가짜 포트는 호출을 배열에 기록하고 그 내용을 다시 `onSnapshot`으로 먹여 주는 헬퍼 `harness(players)`로 만든다. 케이스:
  - startRound: 학생 1명 → `'need-players'`; 학생 3명 → phase prep, 술래 1명 + hide 2명, phaseEndsAt = now+30000
  - tick: prep 만료 → seek; seek 중 전원 잡힘 → result, 생존 정산 없음; seek 만료 → result, 생존자 +13
  - catch: 숨는 편 1명 잡기 → 대상 team seek, 요청자 +3, 대상 +floor(elapsed/30000)
  - **duplicate catch**: 같은 대상에 대한 action 2개 연속 → 두 번째는 점수 변화 없음, 두 번째 요청자 freeze도 없음
  - freeze: decor 클릭 → 요청자 frozenUntil = now+2000, 그 사이 action → 무시
  - pause/resume: seek 중 60초 지나 pause → 100초 경과 → resume → phaseEndsAt = 재개 시각 + 180000
  - **late joiner waits**: seek 중 새 profile → state.team === 'wait', seekerOrder 끝에 추가; 다음 startRound에서 hide 또는 seek 배정
  - **resume**: paused=true인 스냅샷으로 시작 → tick해도 phase 그대로
  - forceEnd: seek 중 → result, 생존자 정산
  - 술래 순환: 3명, startRound→forceEnd→(result 만료)→startRound 반복 시 술래가 a, b, c 순
- [ ] **Step 2: 실패 확인.** `npx vitest run src/host/referee.test.ts` → FAIL.
- [ ] **Step 3: `referee.ts` 구현.**
- [ ] **Step 4: 통과 확인.** `npm test` → 전체 PASS.
- [ ] **Step 5: 커밋.** `git commit -m "feat(hideseek): host referee"`

### Task 5: 입장 화면과 대기실

**Files:**
- Create: `hideseek/client/src/main.ts`, `hideseek/client/src/scenes/EntryScene.ts`, `hideseek/client/src/scenes/LobbyScene.ts`, `hideseek/client/src/ui/dom.ts`(Phaser 위에 얹는 HTML 입력창·버튼 헬퍼)
- Test: Task 7 E2E에서 검증(이 Task는 수동 확인 + 빌드 통과)

**Interfaces:**
- Consumes: `ensureUid`, `createRoom`, `findHostRoom`, `joinRoom`, `subscribeRoom`, `Referee`, `roomPort`
- Produces: 씬 전환 데이터 `{ code: string; uid: string; role: 'host' | 'student' }`. 학생 씬 키 `'student'`, 교사 씬 키 `'host'`(Task 6).
- 화면:
  - Entry: "학생으로 입장"(방 코드 4자리 + 이름) / "선생님"(교사 코드 입력 → `VITE_TEACHER_CODE`와 비교 → `findHostRoom` 있으면 복귀, 없으면 `createRoom`). 오류 문구: notfound "방 코드를 다시 확인해 주세요", full "방이 꽉 찼어요 (7명)", kicked "선생님이 입장을 막았어요", badname "이름은 1~8글자로 써 주세요".
  - Lobby(학생): 방 코드, 접속한 친구 이름 목록, "선생님이 시작할 때까지 기다려요". phase가 prep이 되면 `'student'` 씬으로.
  - 교사는 Lobby를 거치지 않고 바로 `'host'` 씬(대기 상태 포함)으로 간다.
- 모든 DOM 요소는 `data-testid`를 단다: `role-student`, `role-teacher`, `room-code-input`, `name-input`, `join-btn`, `teacher-code-input`, `teacher-btn`, `entry-error`, `lobby-list`.

- [ ] **Step 1: 구현.** Phaser 게임 크기 1280×720, `Scale.FIT`, 배경색 단색.
- [ ] **Step 2: 확인.** `VITE_USE_EMULATOR=1 npx firebase emulators:start --only database,auth` 실행 상태에서 `npm run dev`, 브라우저 탭 2개(교사/학생)로 방 생성·입장·오류 문구 4종 수동 확인. `npm run build` 성공.
- [ ] **Step 3: 커밋.** `git commit -m "feat(hideseek): entry and lobby screens"`

### Task 6: 학생 게임 화면, 교사 관전 화면, 결과·시상

**Files:**
- Create: `hideseek/client/src/scenes/StudentScene.ts`, `hideseek/client/src/scenes/HostScene.ts`, `hideseek/client/src/scenes/drawMap.ts`(두 씬이 공유하는 맵·사물 그리기), `hideseek/client/src/ui/hud.ts`(타이머·단계 안내·결과 패널·점수판)
- Create: `hideseek/client/src/game/view.ts` — 화면 표시 판단 순수 함수
- Test: `hideseek/client/src/game/view.test.ts`

**Interfaces:**
- Consumes: Task 1~5 전부
- Produces (`view.ts`):
  - `canAct(meta: Meta, me: PlayerState, now: number): { move: boolean; click: boolean }` — paused면 둘 다 false; prep에서 seek 팀은 둘 다 false, hide 팀은 move만 true; seek에서 frozen이면 둘 다 false, hide 팀은 move만, seek 팀은 둘 다; wait 팀·result·lobby·final은 둘 다 false.
  - `seesWobble(viewer: 'host' | Team): boolean` — host·seek만 true.
  - `isVisible(viewerTeam: Team, viewer: Pos, target: { x: number; y: number }): boolean` — seek 팀이면 거리 ≤ 180, 아니면 true.
  - `remainingSec(meta: Meta, now: number): number` — 올림 초.
- 학생 화면:
  - 이동: 방향키/WASD, `SPEED` 140, `blocked()`로 벽 충돌. `setPos`는 100ms 간격 + 값이 바뀔 때만.
  - phase가 prep으로 바뀌는 순간: 술래 팀은 `SEEKER_SPAWN`으로, 숨는 팀은 `HIDER_SPAWNS[seekerOrder 인덱스 % 6]`으로 이동.
  - 준비 단계 숨는 편: 아래쪽에 사물 12종 버튼(`data-testid="prop-<id>"`) → `setProp`. 고르지 않으면 찾기 시작 시 `desk`로 자동 지정.
  - 숨는 편 그리기: 다른 숨는 학생은 사물 모양 + 작은 이름(같은 편이니 보여 줌); 술래 편 화면에서는 원래 사물과 구별 불가하게 같은 크기·모양, 이름 없음, `moving`이면 ±2px·8Hz 좌우 흔들림.
  - 술래 편: 시야 밖 어둡게(검은 사각형 + 원형 마스크), 준비 단계는 전체 가림 + "30까지 세는 중… N", 클릭한 대상(시야 안 decor 또는 숨은 학생)으로 `pushAction`, 대상이 120px 넘게 멀면 요청 없이 "더 가까이 가세요" 표시, 정지 중 "앗! 2초 멈춤" 표시.
  - 상단 HUD: 단계 이름, 남은 초, 내 편, 남은 숨는 사람 수, 내 점수. 일시정지 시 "선생님이 잠깐 멈췄어요", 교사 offline(`presence/host` false) 시 "선생님 기다리는 중".
  - 결과 단계: 모든 숨은 학생 위치에 이름 공개, 승리 편, 이번 판 점수 변화.
  - 최종(final): 순위 화면.
- 교사 화면:
  - 맵 전체를 1280×720 안에 축소해 표시, 모든 학생 사물 + 이름표 + 흔들림.
  - 오른쪽 패널: 방 코드(크게), 학생 목록(이름·편·점수·접속 표시·`kick-<uid>` 버튼), 누적 점수 내림차순.
  - 버튼(`data-testid`): `start-btn`(lobby: "판 시작"/"다음 판"), `pause-btn`(prep/seek에서 일시정지/재개 토글), `end-btn`(prep/seek), `final-btn`(lobby에서만, round ≥ 1). `start-btn`이 `'need-players'`면 "학생이 2명 이상 있어야 해요".
  - `subscribeRoom` → `referee.onSnapshot`, `onActions` → `referee.onAction`, 250ms `referee.tick()`.
  - 최종 화면: 1~3등 시상대 + 전체 순위.

- [ ] **Step 1: 실패하는 테스트 작성** (`view.test.ts`). `canAct` 케이스 표(위 규칙 각 행 1개씩, paused 포함), `seesWobble` 3케이스, `isVisible` 180/181px, `remainingSec` 1500ms → 2.
- [ ] **Step 2: 실패 확인.** `npx vitest run src/game/view.test.ts` → FAIL.
- [ ] **Step 3: `view.ts` 구현 후 통과 확인.**
- [ ] **Step 4: 씬 구현.** 입력 처리 전에 매 프레임 `canAct` 결과로 이동·클릭을 막는다(일시정지 잠금).
- [ ] **Step 5: 수동 확인.** 에뮬레이터 + 탭 3개(교사 1, 학생 2)로 한 판 끝까지: 준비 가림, 변신, 흔들림(술래 화면만), 헛짚음 정지, 잡기 후 편 변경, 결과 공개, 다음 판 술래 교체, 일시정지 잠금. `npm run build` 성공.
- [ ] **Step 6: 커밋.** `git commit -m "feat(hideseek): student and host game scenes"`

### Task 7: 8인 E2E 테스트

**Files:**
- Create: `hideseek/client/e2e/fullRound.spec.mjs`(Playwright 라이브러리 직접 사용, `require('playwright')` 사전 설치본), `hideseek/client/e2e/run.sh`
- Modify: `hideseek/client/src/main.ts` — `VITE_USE_EMULATOR=1`일 때만 `window.__hs = { snapshot, uid, forcePos(x,y) }` 테스트 훅 노출
- Modify: `hideseek/client/package.json` — `e2e` 스크립트

**Interfaces:**
- Consumes: Task 5 `data-testid`들, Task 6 `data-testid`들, `window.__hs`
- `run.sh`: 에뮬레이터 실행 → `vite build --mode emulator` + `vite preview --port 5275` → spec 실행 → 정리. `firebase emulators:exec`로 감싼다.

- [ ] **Step 1: 테스트 작성.** 시나리오(브라우저 컨텍스트 8개, 서로 다른 익명 uid):
  1. 교사 입장 → 방 코드 읽기 → 학생 7명 입장 → 교사 학생 목록 7명
  2. 8번째 학생 컨텍스트 입장 → `entry-error`에 "꽉 찼어요"
  3. 교사 `start-btn` → 학생 1명만 seek 팀, 6명 hide 팀
  4. 준비 단계 숨는 학생들 `prop-*` 클릭
  5. 시간 단축을 위해 `meta.phaseEndsAt`을 테스트에서 직접 당긴다(에뮬레이터 관리자 권한 `rules-unit-testing`의 `withSecurityRulesDisabled`) → seek 진입
  6. `forcePos`로 술래를 숨은 학생 옆(50px)으로 → 그 학생 클릭 → 그 학생 team seek, 술래 점수 3
  7. 술래를 원래 사물 옆으로 → 클릭 → 술래 `frozenUntil > now`
  8. 숨은 학생 1명 페이지 reload → 같은 uid, 같은 team, 같은 prop
  9. 교사 페이지 reload → 같은 방 복귀, 학생 화면에 일시정지 표시, `pause-btn`(재개) → 진행
  10. 교사 `end-btn` → result → 만료 후 lobby → `start-btn` → 술래가 두 번째 학생
  11. 학생이 `players/{otherUid}/state`에 직접 쓰기 시도 → 거부
- [ ] **Step 2: 실행.** `npm run e2e` → 시나리오 전체 PASS. 실패하면 원인을 고치고 다시 실행(테스트를 느슨하게 바꾸지 않는다).
- [ ] **Step 3: 커밋.** `git commit -m "test(hideseek): 8-player end-to-end round"`

### Task 8: 실행·배포 안내

**Files:**
- Create: `hideseek/README.md`

- [ ] **Step 1: README 작성.** 로컬 실행(`npm install`, 에뮬레이터 실행, `npm run dev`), 테스트 3종 명령, design.md §7 준비물(Realtime DB 생성·익명 로그인·규칙 게시·Vercel Root Directory `hideseek/client`·환경변수 목록), 수업 진행 순서(선생님용 5줄: 방 만들기 → 코드 칠판에 쓰기 → 학생 입장 확인 → 판 시작 → 마지막에 최종 순위), 크롬북 현장 확인 체크리스트(2~3대 접속, 움직임, Firebase 차단 여부).
- [ ] **Step 2: 최종 확인.** `npm test`, `npm run test:rules`, `npm run build`, `npm run e2e` 모두 성공.
- [ ] **Step 3: 커밋 후 푸시.** `git commit -m "docs(hideseek): readme"` → `git push -u origin claude/inspiring-thompson-gwumti`
