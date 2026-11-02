# 학교 변신 숨바꼭질

초등 6학년 우리 반(학생 7명 + 교사 1명)이 크롬북으로 함께 하는 온라인 숨바꼭질입니다.
숨는 친구는 교실 물건으로 변신하고, 술래는 좁은 시야로 돌아다니며 진짜 물건과 변신한 친구를 가려냅니다.

- 기획: [`docs/design.md`](docs/design.md) · 구현 계획: [`docs/plan.md`](docs/plan.md)
- 기술: Phaser 3 + Vite + TypeScript, Firebase Realtime Database + 익명 로그인(`mumusubject`와 같은 Firebase 프로젝트)
- 서버가 따로 없습니다. **선생님 브라우저가 심판**이라 수업 중에는 선생님 탭을 닫지 마세요(다른 탭으로 옮겨 가는 건 괜찮습니다).

## 수업 진행 (선생님용)

1. 사이트에서 **선생님** 칸에 교사 코드를 넣고 **방 만들기**를 누릅니다.
2. 화면 오른쪽의 **방 코드 4자리**를 칠판이나 TV에 보여 줍니다.
3. 학생들은 방 코드와 이름을 넣고 입장합니다. 오른쪽 목록에 7명이 다 들어왔는지 확인하세요. 이름이 이상하면 **내보내기**를 누르면 됩니다.
4. **▶ 판 시작**을 누릅니다. 술래는 판마다 들어온 순서대로 바뀝니다. 한 판은 숨기 30초, 찾기 4분, 결과 15초입니다.
5. 수업이 끝날 때 대기 화면에서 **🏆 최종 순위**를 누르면 모두에게 시상 화면이 나옵니다.

수업 중에 **⏸ 일시정지**로 모두를 멈출 수 있고, **⏹ 판 끝내기**로 그 판을 바로 끝낼 수 있습니다.
선생님 탭이 닫히거나 새로고침되면 게임이 자동으로 멈춥니다. 같은 브라우저로 다시 열면 같은 방으로 돌아오니, **▶ 재개**를 누르세요.
학생도 새로고침하면 같은 사람으로 이어서 합니다. 이렇게 같은 방으로 돌아오는 건 2시간 동안만이고, 다음 수업에는 새 방에서 시작합니다.
수업 중에 방을 새로 열고 싶으면 대기 화면의 **새 방 만들기**를 누르세요. 예전 방에 남은 학생은 **다른 방으로 가기**를 눌러 새 코드로 들어오면 됩니다.
판 시작 때 접속이 끊겨 있던 학생은 그 판을 쉬고 다음 판부터 참여합니다.
**내보내기**는 같은 기기·브라우저만 막습니다. 시크릿 창으로 다시 들어오면 막을 수 없으니 교실에서 말로 지도해 주세요.

### 규칙 요약 (학생 설명용 1분)

- 숨는 편: 숨는 시간 30초 동안 아래 버튼으로 물건을 골라 변신하고 숨을 곳으로 가세요. 움직이면 술래 화면에서 살짝 흔들려 보여요.
- 술래 편: 방향키(WASD)로 다니다가 수상한 물건을 마우스로 누르세요. 가까이 가야(120px) 눌러져요. 진짜 물건을 누르면 2초 동안 멈춰요.
- 잡힌 친구는 술래 편이 되어 같이 찾아요.
- 점수: 숨어서 30초 버틸 때마다 +1, 끝까지 살아남으면 +5, 한 명 잡을 때마다 +3.

## 처음 한 번만: Firebase · Vercel 준비

1. Firebase 콘솔에서 기존 `mumusubject` 프로젝트를 엽니다.
2. **Realtime Database**를 만듭니다(위치: `asia-southeast1` 권장). 기존 Firestore와는 따로 동작해서 영향이 없습니다.
3. **Authentication → 로그인 방법 → 익명**을 사용 설정합니다.
4. Realtime Database의 **규칙** 탭에 [`database.rules.json`](database.rules.json) 내용을 붙여 넣고 게시합니다.
5. Vercel에서 새 프로젝트를 만듭니다. Framework는 Vite, **Root Directory는 `hideseek/client`**입니다.
6. 환경변수를 넣습니다(값은 `mumusubject`와 같고, 두 개가 새로 추가됩니다).

| 이름 | 값 |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | `mumusubject`와 같음 |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database 화면 위쪽의 주소(`https://…firebasedatabase.app`) |
| `VITE_TEACHER_CODE` | 선생님만 아는 코드 |

### 크롬북 현장 확인 (수업 전에 한 번)

- [ ] 학교 와이파이에서 크롬북 2~3대와 선생님 컴퓨터로 접속해 방을 만들고 입장해 본다.
- [ ] 한 판을 해 보면서 움직임이 부드러운지, 학생 목록의 초록 점(접속)이 잘 켜지는지 본다.
- [ ] 입장이 안 되면 학교 방화벽이 `*.firebasedatabase.app`, `*.googleapis.com`을 막는지 정보 담당 선생님께 확인한다.

## 개발

Java(에뮬레이터용)와 Node 18 이상이 필요합니다.

```bash
cd hideseek/client
npm install
npm run dev:emu      # Firebase 에뮬레이터 + 개발 서버, http://localhost:5275 (교사 코드 1234)
```

실제 Firebase에 붙이려면 `client/.env.example`을 `.env.local`로 복사해서 값을 채우고 `npm run dev`를 실행합니다.

| 명령 | 내용 |
|---|---|
| `npm test` | 규칙·맵·심판·화면 판단 단위 테스트 (Vitest) |
| `npm run test:rules` | 에뮬레이터에서 보안 규칙 + 방 API 테스트 |
| `npm run e2e` | 에뮬레이터에서 교사 1 + 학생 8로 한 판 전체를 자동 진행 (Playwright) |
| `npm run build` | 타입 검사 + 배포용 빌드 |

`scripts/emulators.sh`는 Realtime DB 에뮬레이터를 Java로 직접 띄우고, Auth 에뮬레이터는 firebase CLI로 띄웁니다.
