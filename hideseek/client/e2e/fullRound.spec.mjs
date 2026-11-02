// 교사 1 + 학생 7(+정원 초과 1)로 한 판을 끝까지 돌리고 다음 판 술래 교체까지 확인한다.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.E2E_URL ?? 'http://127.0.0.1:5276/?lowfps';
const DB = 'http://127.0.0.1:9000';
const OWNER = { Authorization: 'Bearer owner' };
const NAMES = ['가람', '나래', '다온', '라희', '마루', '바다', '사랑'];

const admin = {
  patch: (path, body) => fetch(`${DB}/${path}.json?ns=demo-hideseek`, { method: 'PATCH', headers: OWNER, body: JSON.stringify(body) }),
};
const errors = [];
let step = 0;
const ok = (msg) => console.log(`  ✓ ${++step}. ${msg}`);

async function until(fn, what, timeout = 10_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`시간 초과: ${what} (마지막 값: ${last})`);
}

const browser = await chromium.launch();
async function open(label) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (process.env.E2E_DEBUG && !m.text().includes('GL Driver')) console.log(label, m.type(), m.text().slice(0, 200)); });
  page.on('dialog', (d) => d.accept());
  await page.goto(URL);
  return page;
}
const snap = (page) => page.evaluate(() => window.__hs?.snapshot?.() ?? null);

try {
  // 1. 교사 입장 → 학생 7명 입장
  const host = await open('host');
  await host.getByTestId('teacher-code-input').fill('1234');
  await host.getByTestId('teacher-btn').click();
  const code = (await host.getByTestId('host-room-code').textContent()).trim();
  const kids = [];
  for (const name of NAMES) {
    const p = await open(name);
    await p.getByTestId('room-code-input').fill(code);
    await p.getByTestId('name-input').fill(name);
    const t0 = Date.now();
    await p.getByTestId('join-btn').click();
    await p.getByTestId('lobby-list').waitFor({ timeout: 30000 }).then(() => console.log(name, 'lobby after', Date.now() - t0)).catch(async (e) => {
      console.error('입장 실패 화면:', (await p.locator('#ui').innerHTML()).slice(0, 600), errors, await p.evaluate(() => JSON.stringify({ hs: !!window.__hs, dbg: window.__hs?.debug?.(), canv: document.querySelectorAll('canvas').length, vis: document.visibilityState })).catch(String));
      throw e;
    });
    kids.push(p);
  }
  await until(async () => Object.values((await snap(host)).players).filter((p) => p.online).length === 7, '7명 접속');
  await until(async () => (await host.getByTestId('student-list').locator('tr[data-uid]').count()) === 7, '교사 목록 7명');
  ok(`방 ${code}에 학생 7명 입장, 교사 목록 7명`);

  // 2. 8번째 학생은 거부
  const late = await open('late');
  await late.getByTestId('room-code-input').fill(code);
  await late.getByTestId('name-input').fill('늦둥이');
  await late.getByTestId('join-btn').click();
  await until(async () => (await late.getByTestId('entry-error').textContent()).includes('꽉 찼어요'), '정원 초과 문구');
  await late.context().close();
  ok('8번째 학생은 "방이 꽉 찼어요"');

  // 3. 판 시작 → 술래 1명, 숨는 편 6명
  await host.getByTestId('start-btn').click();
  const s1 = await until(async () => { const s = await snap(host); return s.meta.phase === 'prep' && s; }, '준비 단계');
  const uids = await Promise.all(kids.map((k) => k.evaluate(() => window.__hs.uid)));
  const teams = uids.map((u) => s1.players[u].state.team);
  assert.equal(teams.filter((t) => t === 'seek').length, 1);
  assert.equal(teams.filter((t) => t === 'hide').length, 6);
  const seekerIdx = teams.indexOf('seek');
  assert.equal(seekerIdx, 0, '첫 판 술래는 처음 들어온 학생');
  const seeker = kids[seekerIdx];
  await seeker.getByTestId('seeker-cover').waitFor();
  ok('판 시작: 술래 1명(가려진 화면), 숨는 편 6명');

  // 4. 숨는 학생들이 변신
  const kinds = ['plant', 'locker', 'trash', 'globe', 'books', 'water'];
  const hiders = kids.filter((_, i) => i !== seekerIdx);
  for (const [i, k] of hiders.entries()) await k.getByTestId(`prop-${kinds[i]}`).click();
  await until(async () => { const s = await snap(host); return hiders.every((_, i) => s.players[uids[i + 1]].profile.prop === kinds[i]); }, '변신 반영');
  ok('숨는 학생 6명이 각자 사물을 골라 변신');

  // 5. 준비 시간을 당겨서 찾기 단계로
  await admin.patch(`rooms/${code}/meta`, { phaseEndsAt: 1 });
  await until(async () => (await snap(host)).meta.phase === 'seek', '찾기 단계');
  ok('찾기 단계 시작');

  // 6. 술래가 숨은 학생 옆에서 클릭 → 잡힘
  const target = hiders[0];
  const targetUid = uids[1];
  await target.evaluate(() => window.__hs.forcePos(1000, 490));
  await seeker.evaluate(() => window.__hs.forcePos(940, 490));
  await until(async () => {
    const sp = await seeker.evaluate((u) => window.__hs.spriteOf(u), targetUid);
    return sp && Math.abs(sp.x - 1000) < 2 && Math.abs(sp.y - 490) < 2;
  }, '술래 화면에서 숨은 학생 그림이 제자리에 도착');
  let pt = await seeker.evaluate(() => window.__hs.screenOf(1000, 490));
  await seeker.mouse.click(pt.x, pt.y);
  await until(async () => (await snap(host)).players[targetUid].state.caught, '잡힘 처리');
  const s6 = await snap(host);
  assert.equal(s6.players[targetUid].state.team, 'seek');
  assert.equal(s6.players[uids[0]].state.score, 3);
  ok('술래가 숨은 학생을 클릭 → 잡혀서 술래 편, 술래 +3점');

  // 7. 진짜 사물을 클릭 → 2초 정지
  await seeker.evaluate(() => window.__hs.forcePos(1320, 515)); // 사물함(1320,456) 아래
  await seeker.waitForTimeout(800); // 카메라가 새 위치로 옮겨질 시간
  pt = await seeker.evaluate(() => window.__hs.screenOf(1320, 456));
  await seeker.mouse.click(pt.x, pt.y);
  await until(async () => (await snap(host)).players[uids[0]].state.frozenUntil > 0, '정지 처리');
  await seeker.getByTestId('frozen').waitFor();
  ok('진짜 사물 클릭 → 술래 2초 정지 표시');

  // 8. 숨은 학생 새로고침 → 같은 uid, 같은 편, 같은 사물
  const h2 = hiders[1];
  await h2.reload();
  await until(async () => (await h2.evaluate(() => window.__hs?.uid)) === uids[2], '같은 uid로 복귀');
  const s8 = await snap(host);
  assert.equal(s8.players[uids[2]].state.team, 'hide');
  assert.equal(s8.players[uids[2]].profile.prop, kinds[1]);
  ok('숨은 학생 새로고침 → 같은 사람·같은 편·같은 사물로 복귀');

  // 9. 교사 새로고침 → 자동 일시정지 → 같은 방 복귀 → 재개
  await host.reload();
  await host.getByTestId('host-room-code').waitFor();
  assert.equal((await host.getByTestId('host-room-code').textContent()).trim(), code);
  await until(async () => (await snap(host)).meta.paused === true, '교사 이탈 시 자동 일시정지');
  await host.getByTestId('pause-btn').click();
  await until(async () => (await snap(host)).meta.paused === false, '재개');
  ok('교사 새로고침 → 같은 방, 자동 일시정지 → 재개');

  // 10. 판 끝내기 → 결과 → 대기실 → 다음 판 술래는 두 번째 학생
  await host.getByTestId('end-btn').click();
  await until(async () => (await snap(host)).meta.phase === 'result', '결과 단계');
  await kids[3].getByTestId('result-card').waitFor();
  const s10 = await snap(host);
  assert.ok(s10.players[uids[3]].state.score >= 5, '살아남은 학생 +5 이상');
  await admin.patch(`rooms/${code}/meta`, { phaseEndsAt: 1 });
  await until(async () => (await snap(host)).meta.phase === 'lobby', '대기실');
  await host.getByTestId('start-btn').click();
  const s10b = await until(async () => { const s = await snap(host); return s.meta.phase === 'prep' && s; }, '두 번째 판');
  assert.equal(s10b.meta.seekerUid, uids[1]);
  ok('판 끝내기 → 결과표 → 대기실 → 다음 판 술래는 두 번째 학생');

  // 11. 최종 순위
  await host.getByTestId('end-btn').click();
  await until(async () => (await snap(host)).meta.phase === 'result', '결과 단계 2');
  await admin.patch(`rooms/${code}/meta`, { phaseEndsAt: 1 });
  await until(async () => (await snap(host)).meta.phase === 'lobby', '대기실 2');
  await host.getByTestId('final-btn').click();
  await kids[0].getByTestId('final-ranking').waitFor();
  ok('최종 순위가 학생 화면에 표시');

  assert.deepEqual(errors, [], '페이지 오류 없음');
  console.log('E2E 통과');
} catch (e) {
  console.error('E2E 실패:', e);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
