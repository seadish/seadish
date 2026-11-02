import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;
const R = 'rooms/1234';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hideseek',
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync('../database.rules.json', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(`${R}/meta`).set({ hostUid: 'host', phase: 'lobby', round: 0, phaseEndsAt: 0, paused: false, pausedAt: 0 });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).database();
const profile = (name = '철수', slot = '0') => ({ name, joinedAt: 1, slot });
async function seedStudents(n: number) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (let i = 0; i < n; i++) {
      await ctx.database().ref(`${R}/slots/${i}`).set(`s${i}`);
      await ctx.database().ref(`${R}/players/s${i}/profile`).set(profile(`학생${i}`, String(i)));
    }
  });
}

describe('meta', () => {
  it('host can write meta', () => assertSucceeds(as('host').ref(`${R}/meta/phase`).set('prep')));
  it('student cannot write meta', () => assertFails(as('kid').ref(`${R}/meta/phase`).set('prep')));
  it('anyone signed in can create a new room as its host', () =>
    assertSucceeds(as('t2').ref('rooms/5555/meta').set({ hostUid: 't2', phase: 'lobby', round: 0, phaseEndsAt: 0, paused: false, pausedAt: 0 })));
  it('cannot take over an existing room', () =>
    assertFails(as('t2').ref(`${R}/meta`).set({ hostUid: 't2', phase: 'lobby', round: 0, phaseEndsAt: 0, paused: false, pausedAt: 0 })));
  it('signed-out user cannot read', () => assertFails(env.unauthenticatedContext().database().ref(R).get()));
});

describe('profile', () => {
  const claim = (uid: string, n = '0') => as(uid).ref(`${R}/slots/${n}`).set(uid);
  it('student claims a free slot then writes own profile', async () => {
    await assertSucceeds(claim('kid'));
    await assertSucceeds(as('kid').ref(`${R}/players/kid/profile`).set(profile()));
  });
  it('profile without own slot is rejected', () => assertFails(as('kid').ref(`${R}/players/kid/profile`).set(profile())));
  it('cannot claim a taken slot', async () => {
    await assertSucceeds(claim('kid'));
    await assertFails(claim('other'));
  });
  it('slot 7 does not exist', () => assertFails(claim('kid', '7')));
  it("student cannot write another's profile", () => assertFails(as('kid').ref(`${R}/players/other/profile`).set(profile())));
  it('rejects 9-char name', async () => { await claim('kid'); await assertFails(as('kid').ref(`${R}/players/kid/profile`).set(profile('가나다라마바사아자'))); });
  it('rejects empty name', async () => { await claim('kid'); await assertFails(as('kid').ref(`${R}/players/kid/profile`).set(profile(''))); });
  it('cannot join a room that does not exist', () => assertFails(as('kid').ref('rooms/9999/players/kid/profile').set(profile())));
  it('8th student is rejected', async () => {
    await seedStudents(7);
    for (let n = 0; n < 7; n++) await assertFails(claim('kid', String(n)));
    await assertFails(as('kid').ref(`${R}/players/kid/profile`).set(profile('철수', '6')));
  });
  it('existing student can still update profile in a full room', async () => {
    await seedStudents(7);
    await assertSucceeds(as('s3').ref(`${R}/players/s3/profile/prop`).set('desk'));
  });
});

describe('state', () => {
  it('student cannot write own state', () => assertFails(as('kid').ref(`${R}/players/kid/state/score`).set(99)));
  it('host writes state', () => assertSucceeds(as('host').ref(`${R}/players/kid/state/score`).set(3)));
});

describe('kicked', () => {
  beforeEach(() => env.withSecurityRulesDisabled((ctx) => ctx.database().ref(`${R}/kicked/kid`).set(true)));
  it('kicked student cannot write pos', () => assertFails(as('kid').ref(`${R}/pos/kid`).set({ x: 1, y: 1, moving: false })));
  it('kicked student cannot claim a slot', () => assertFails(as('kid').ref(`${R}/slots/0`).set('kid')));
  it('student cannot write kicked', () => assertFails(as('other').ref(`${R}/kicked/other`).remove()));
});

describe('pos / presence', () => {
  it('student writes own pos', () => assertSucceeds(as('kid').ref(`${R}/pos/kid`).set({ x: 1, y: 2, moving: true })));
  it('rejects non-number pos', () => assertFails(as('kid').ref(`${R}/pos/kid`).set({ x: 'a', y: 2, moving: true })));
  it("student cannot write another's pos", () => assertFails(as('kid').ref(`${R}/pos/other`).set({ x: 1, y: 2, moving: false })));
  it('student cannot write host presence', () => assertFails(as('kid').ref(`${R}/presence/host`).set(true)));
  it('host writes host presence', () => assertSucceeds(as('host').ref(`${R}/presence/host`).set(true)));
});

describe('actions', () => {
  beforeEach(() => seedStudents(1));
  it('registered student can push an action', () =>
    assertSucceeds(as('s0').ref(`${R}/actions`).push({ uid: 's0', targetType: 'decor', targetId: 'd1', at: 1 }).then(() => {})));
  it('cannot push an action as someone else', () =>
    assertFails(as('s0').ref(`${R}/actions`).push({ uid: 'zz', targetType: 'decor', targetId: 'd1', at: 1 }).then(() => {})));
  it('unregistered user cannot push', () =>
    assertFails(as('zz').ref(`${R}/actions`).push({ uid: 'zz', targetType: 'decor', targetId: 'd1', at: 1 }).then(() => {})));
  it('student cannot delete actions, host can', async () => {
    const key = (await as('s0').ref(`${R}/actions`).push({ uid: 's0', targetType: 'decor', targetId: 'd1', at: 1 })).key;
    await assertFails(as('s0').ref(`${R}/actions/${key}`).remove());
    await assertSucceeds(as('host').ref(`${R}/actions/${key}`).remove());
  });
});
