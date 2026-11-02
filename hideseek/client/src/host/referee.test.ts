import { describe, it, expect } from 'vitest';
import { Referee, type RoomPort } from './referee';
import type { Meta, Player, PlayerState, Pos, RoomSnapshot } from '../game/types';
import { DECOR } from '../game/map';

/** 가짜 방: 심판이 쓴 내용을 저장하고, 실제 Firebase처럼 새 스냅샷을 다시 넘겨준다. */
function harness(uids: string[], opts: { offline?: string[]; meta?: Partial<Meta> } = {}) {
  let now = 1_000_000;
  const players: Record<string, Player> = {};
  uids.forEach((uid, i) => {
    players[uid] = {
      profile: { name: uid, prop: 'desk', joinedAt: i, slot: String(i) },
      state: { team: 'wait', caught: false, frozenUntil: 0, score: 0, caughtAt: 0 },
      online: !opts.offline?.includes(uid),
    };
  });
  const db: RoomSnapshot = {
    meta: {
      hostUid: 'host', phase: 'lobby', round: 0, phaseEndsAt: 0, paused: false, pausedAt: 0,
      seekerOrder: [...uids], seekerUid: null, ...opts.meta,
    },
    players, pos: {}, hostOnline: true,
  };
  const calls = { deleted: [] as string[], armed: [] as boolean[], kicked: [] as string[] };
  const push = () => ref.onSnapshot(structuredClone(db));
  const port: RoomPort = {
    updateMeta: (p) => { db.meta = { ...db.meta, ...p }; queueMicrotask(push); },
    updateStates: (p) => {
      for (const [uid, st] of Object.entries(p)) db.players[uid].state = { ...db.players[uid].state, ...st } as PlayerState;
      queueMicrotask(push);
    },
    deleteAction: (id) => calls.deleted.push(id),
    armHostDisconnect: (on) => calls.armed.push(on),
    kick: (uid) => { calls.kicked.push(uid); delete db.players[uid]; queueMicrotask(push); },
  };
  const ref = new Referee(port, () => now);
  ref.onSnapshot(structuredClone(db));
  return {
    ref, db, calls,
    advance: (ms: number) => { now += ms; },
    now: () => now,
    flush: () => new Promise<void>((r) => setTimeout(r, 0)),
    setPos: (uid: string, p: Partial<Pos>) => { db.pos[uid] = { x: 0, y: 0, moving: false, ...p }; ref.onSnapshot(structuredClone(db)); },
    setOnline: (uid: string, online: boolean) => { db.players[uid].online = online; ref.onSnapshot(structuredClone(db)); },
    addPlayer: (uid: string) => {
      db.players[uid] = {
        profile: { name: uid, prop: null, joinedAt: 99, slot: '6' },
        state: { team: 'wait', caught: false, frozenUntil: 0, score: 0, caughtAt: 0 }, online: true,
      };
      ref.onSnapshot(structuredClone(db));
    },
  };
}
const teamOf = (h: ReturnType<typeof harness>) =>
  Object.fromEntries(Object.entries(h.db.players).map(([u, p]) => [u, p.state.team]));
const decor = DECOR[0];

async function toSeek(h: ReturnType<typeof harness>) {
  expect(h.ref.startRound()).toBe('ok');
  await h.flush();
  h.advance(30_000);
  h.ref.tick();
  await h.flush();
  expect(h.db.meta.phase).toBe('seek');
}

describe('startRound', () => {
  it('needs at least 2 online students', () => {
    const h = harness(['a', 'b'], { offline: ['b'] });
    expect(h.ref.startRound()).toBe('need-players');
    expect(h.db.meta.phase).toBe('lobby');
  });
  it('starts prep with one seeker and the rest hiding', async () => {
    const h = harness(['a', 'b', 'c']);
    expect(h.ref.startRound()).toBe('ok');
    await h.flush();
    expect(h.db.meta).toMatchObject({ phase: 'prep', round: 1, seekerUid: 'a', phaseEndsAt: h.now() + 30_000 });
    expect(teamOf(h)).toEqual({ a: 'seek', b: 'hide', c: 'hide' });
  });
  it('is ignored outside the lobby', async () => {
    const h = harness(['a', 'b']);
    h.ref.startRound();
    await h.flush();
    expect(h.ref.startRound()).toBe('busy');
    expect(h.db.meta.round).toBe(1);
  });
});

describe('tick', () => {
  it('prep expiry → seek', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    expect(h.db.meta.phaseEndsAt).toBe(h.now() + 240_000);
  });
  it('everyone caught → result early, no survivor points', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.setPos('a', { x: 0 }); h.setPos('b', { x: 50 });
    h.ref.onAction('x1', { uid: 'a', targetType: 'player', targetId: 'b', at: h.now() });
    await h.flush();
    h.ref.tick();
    await h.flush();
    expect(h.db.meta.phase).toBe('result');
    expect(h.db.players.b.state.score).toBe(0);
  });
  it('seek expiry → result with +13 for survivors', async () => {
    const h = harness(['a', 'b', 'c']);
    await toSeek(h);
    h.advance(240_000);
    h.ref.tick();
    await h.flush();
    expect(h.db.meta.phase).toBe('result');
    expect(h.db.players.b.state.score).toBe(13);
    expect(h.db.players.a.state.score).toBe(0);
  });
  it('result expiry → lobby', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.ref.forceEnd(); await h.flush();
    h.advance(15_000); h.ref.tick(); await h.flush();
    expect(h.db.meta.phase).toBe('lobby');
  });
  it('arms the host-disconnect pause while a round runs and disarms it in the lobby', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    expect(h.calls.armed.at(-1)).toBe(true);
    h.ref.forceEnd(); await h.flush();
    h.advance(15_000); h.ref.tick(); await h.flush();
    h.ref.tick();
    expect(h.calls.armed.at(-1)).toBe(false);
  });
});

describe('actions', () => {
  it('catch: target joins seekers with interval points, catcher +3', async () => {
    const h = harness(['a', 'b', 'c']);
    await toSeek(h);
    h.advance(65_000);
    h.setPos('a', { x: 0 }); h.setPos('b', { x: 100 });
    h.ref.onAction('x1', { uid: 'a', targetType: 'player', targetId: 'b', at: h.now() });
    await h.flush();
    expect(h.db.players.b.state).toMatchObject({ team: 'seek', caught: true, score: 2, caughtAt: h.now() });
    expect(h.db.players.a.state.score).toBe(3);
    expect(h.calls.deleted).toEqual(['x1']);
  });
  it('duplicate catch on the same target counts once', async () => {
    const h = harness(['a', 'b', 'c', 'd']);
    await toSeek(h);
    // c는 먼저 잡혀서 술래 편이 된 상태로 만든다
    h.setPos('a', { x: 0 }); h.setPos('c', { x: 10 }); h.setPos('b', { x: 50 }); h.setPos('d', { x: 900 });
    h.ref.onAction('x0', { uid: 'a', targetType: 'player', targetId: 'c', at: h.now() });
    await h.flush();
    expect(h.db.players.c.state.team).toBe('seek');
    h.ref.onAction('x1', { uid: 'a', targetType: 'player', targetId: 'b', at: h.now() });
    h.ref.onAction('x2', { uid: 'c', targetType: 'player', targetId: 'b', at: h.now() });
    await h.flush();
    expect(h.db.players.a.state.score).toBe(6);
    expect(h.db.players.c.state.score).toBe(0);
    expect(h.db.players.c.state.frozenUntil).toBe(0);
    expect(h.calls.deleted).toEqual(['x0', 'x1', 'x2']);
  });
  it('decor click freezes the seeker for 2s and later clicks are ignored', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.setPos('a', { x: decor.x, y: decor.y }); h.setPos('b', { x: decor.x + 20, y: decor.y });
    h.ref.onAction('x1', { uid: 'a', targetType: 'decor', targetId: decor.id, at: h.now() });
    await h.flush();
    expect(h.db.players.a.state.frozenUntil).toBe(h.now() + 2_000);
    h.advance(1_000);
    h.ref.onAction('x2', { uid: 'a', targetType: 'player', targetId: 'b', at: h.now() });
    await h.flush();
    expect(h.db.players.b.state.caught).toBe(false);
  });
});

describe('pause / resume / forceEnd', () => {
  it('pause keeps remaining time; resume shifts the end', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.advance(60_000);
    h.ref.pause(); await h.flush();
    expect(h.db.meta).toMatchObject({ paused: true, pausedAt: h.now() });
    h.advance(100_000);
    h.ref.tick(); await h.flush();
    expect(h.db.meta.phase).toBe('seek');
    h.ref.resume(); await h.flush();
    expect(h.db.meta).toMatchObject({ paused: false, phaseEndsAt: h.now() + 180_000 });
  });
  it('a room that was auto-paused by host disconnect stays paused until resume', async () => {
    const h = harness(['a', 'b'], { meta: { phase: 'seek', round: 1, paused: true, pausedAt: 900_000, phaseEndsAt: 950_000 } });
    h.advance(500_000);
    h.ref.tick(); await h.flush();
    expect(h.db.meta).toMatchObject({ phase: 'seek', paused: true });
    h.ref.resume(); await h.flush();
    expect(h.db.meta).toMatchObject({ paused: false, phaseEndsAt: h.now() + 50_000 });
  });
  it('stale pause from a flaky teacher connection never gives more than the phase length', async () => {
    // 교사가 준비 3초 남기고 끊긴 사이 로컬에서 찾기 단계로 넘어간 기록이 뒤늦게 덮어쓴 경우
    const h = harness(['a', 'b'], { meta: { phase: 'seek', round: 1, paused: true, pausedAt: 1_000_000 - 3_000, phaseEndsAt: 1_000_000 + 240_000 } });
    h.ref.resume(); await h.flush();
    expect(h.db.meta.phaseEndsAt).toBe(h.now() + 240_000);
  });
  it('forceEnd during seek settles survivors at the current elapsed time', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.advance(90_000);
    h.ref.forceEnd(); await h.flush();
    expect(h.db.meta.phase).toBe('result');
    expect(h.db.players.b.state.score).toBe(8); // 3 + 5
  });
});

describe('players coming and going', () => {
  it('late joiner waits and is appended to the seeker order', async () => {
    const h = harness(['a', 'b']);
    await toSeek(h);
    h.addPlayer('z');
    await h.flush();
    expect(h.db.players.z.state.team).toBe('wait');
    expect(h.db.meta.seekerOrder).toEqual(['a', 'b', 'z']);
    h.ref.forceEnd(); await h.flush();
    h.advance(15_000); h.ref.tick(); await h.flush();
    h.ref.startRound(); await h.flush();
    expect(h.db.players.z.state.team).not.toBe('wait');
  });
  it('kick removes the student from the seeker order', async () => {
    const h = harness(['a', 'b', 'c']);
    h.ref.kick('b'); await h.flush();
    expect(h.calls.kicked).toEqual(['b']);
    expect(h.db.meta.seekerOrder).toEqual(['a', 'c']);
  });
  it('seeker rotates a → b → c across rounds', async () => {
    const h = harness(['a', 'b', 'c']);
    const seekers: (string | null)[] = [];
    for (let r = 0; r < 3; r++) {
      h.ref.startRound(); await h.flush();
      seekers.push(h.db.meta.seekerUid);
      h.ref.forceEnd(); await h.flush();
      h.advance(15_000); h.ref.tick(); await h.flush();
    }
    expect(seekers).toEqual(['a', 'b', 'c']);
  });
  it('a student offline at round start sits the round out', async () => {
    const h = harness(['a', 'b', 'c'], { offline: ['c'] });
    h.ref.startRound(); await h.flush();
    expect(teamOf(h)).toEqual({ a: 'seek', b: 'hide', c: 'wait' });
  });
  it('seeker after an offline skip continues from the last seeker, without repeats', async () => {
    const h = harness(['a', 'b', 'c', 'd']);
    const seekers: (string | null)[] = [];
    for (let r = 0; r < 4; r++) {
      h.setOnline('b', r !== 1);
      h.ref.startRound(); await h.flush();
      seekers.push(h.db.meta.seekerUid);
      h.ref.forceEnd(); await h.flush();
      h.advance(15_000); h.ref.tick(); await h.flush();
    }
    expect(seekers).toEqual(['a', 'c', 'd', 'a']);
  });
  it('showFinal only from the lobby', async () => {
    const h = harness(['a', 'b']);
    h.ref.startRound(); await h.flush();
    h.ref.showFinal(); await h.flush();
    expect(h.db.meta.phase).toBe('prep');
    h.ref.forceEnd(); await h.flush();
    h.advance(15_000); h.ref.tick(); await h.flush();
    h.ref.showFinal(); await h.flush();
    expect(h.db.meta.phase).toBe('final');
  });
});
