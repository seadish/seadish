import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { deleteApp } from 'firebase/app';
import { get, ref } from 'firebase/database';
import { createClient, type Client } from '../src/net/firebase';
import { createRoom, joinRoom, setProp, kick, subscribeRoom } from '../src/net/room';
import type { RoomSnapshot } from '../src/game/types';

const clients: Client[] = [];
let n = 0;
async function user(): Promise<{ c: Client; uid: string }> {
  const c = createClient(`u${n++}`);
  clients.push(c);
  return { c, uid: await c.ensureUid() };
}

beforeEach(async () => {
  await fetch('http://127.0.0.1:9000/.json?ns=demo-hideseek', { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
});
afterAll(async () => {
  await Promise.all(clients.map((c) => deleteApp(c.app)));
});

describe('room api', () => {
  it('createRoom makes a 4-digit lobby room owned by the host', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    expect(code).toMatch(/^[1-9]\d{3}$/);
    const meta = (await get(ref(t.c.db, `rooms/${code}/meta`))).val();
    expect(meta.phase).toBe('lobby');
    expect(meta.hostUid).toBe(t.uid);
  });

  it('first read right after a fresh sign-in is not denied', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    // 연결이 로그인보다 먼저 열리면 첫 읽기가 거부되는 경쟁 상태를 잡기 위해 여러 번 반복
    const results: string[] = [];
    for (let i = 0; i < 40; i++) {
      const s = await user();
      results.push(await joinRoom(s.c.db, code, s.uid, `즉시${i}`).catch((e) => String(e)));
    }
    expect(results.filter((r) => r !== 'ok' && r !== 'full')).toEqual([]);
  });

  it('joinRoom: unknown code → notfound', async () => {
    const s = await user();
    expect(await joinRoom(s.c.db, '1111', s.uid, '철수')).toBe('notfound');
  });

  it('joinRoom: bad name → badname', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    const s = await user();
    expect(await joinRoom(s.c.db, code, s.uid, '가나다라마바사아자')).toBe('badname');
  });

  it('joinRoom: 8th student → full', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    for (let i = 0; i < 7; i++) {
      const s = await user();
      expect(await joinRoom(s.c.db, code, s.uid, `학생${i}`)).toBe('ok');
    }
    const late = await user();
    expect(await joinRoom(late.c.db, code, late.uid, '늦은학생')).toBe('full');
  });

  it('rejoin keeps uid, slot and prop', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    const s = await user();
    expect(await joinRoom(s.c.db, code, s.uid, '철수')).toBe('ok');
    await setProp(s.c.db, code, s.uid, 'plant');
    expect(await joinRoom(s.c.db, code, s.uid, '다른이름')).toBe('ok');
    const players = (await get(ref(t.c.db, `rooms/${code}/players`))).val();
    expect(Object.keys(players)).toEqual([s.uid]);
    expect(players[s.uid].profile).toMatchObject({ name: '철수', prop: 'plant', slot: '0' });
  });

  it('kicked student cannot rejoin and frees the slot', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    const s = await user();
    await joinRoom(s.c.db, code, s.uid, '장난꾸러기');
    await kick(t.c.db, code, s.uid);
    expect(await joinRoom(s.c.db, code, s.uid, '장난꾸러기')).toBe('kicked');
    const slots = (await get(ref(t.c.db, `rooms/${code}/slots`))).val();
    expect(slots).toBeNull();
  });

  it('subscribeRoom delivers a normalized snapshot with presence', async () => {
    const t = await user();
    const code = await createRoom(t.c.db, t.uid);
    const s = await user();
    await joinRoom(s.c.db, code, s.uid, '영희');
    const snap = await new Promise<RoomSnapshot>((resolve) => {
      const off = subscribeRoom(t.c.db, code, (v) => {
        if (v && v.players[s.uid]?.online) { off(); resolve(v); }
      });
    });
    expect(snap.meta.seekerOrder).toEqual([]);
    expect(snap.players[s.uid].profile.name).toBe('영희');
    expect(snap.players[s.uid].state.team).toBe('wait');
    expect(snap.hostOnline).toBe(false);
  });
});
