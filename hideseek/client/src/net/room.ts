// Realtime Database 접근은 이 파일에만 둔다.
import {
  ref, get, set, update, push, remove, onValue, onChildAdded, onDisconnect, serverTimestamp, type Database,
} from 'firebase/database';
import type { Action, Meta, Player, PlayerState, Pos, RoomSnapshot } from '../game/types';
import { MAX_STUDENTS } from '../game/constants';
import { validName } from '../game/rules';
import { decodeRoom, encodeRoom } from './remember';

export const HOST_ROOM_KEY = 'hideseek.hostRoom';
export const STUDENT_ROOM_KEY = 'hideseek.studentRoom';
const path = (code: string, sub = '') => `rooms/${code}${sub ? '/' + sub : ''}`;

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export async function createRoom(db: Database, hostUid: string): Promise<string> {
  const meta: Meta = {
    hostUid, phase: 'lobby', round: 0, phaseEndsAt: 0, paused: false, pausedAt: 0, seekerOrder: [], seekerUid: null,
  };
  for (let i = 0; i < 20; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if ((await get(ref(db, path(code, 'meta')))).exists()) continue;
    try {
      await set(ref(db, path(code, 'meta')), meta);
    } catch {
      continue; // 같은 순간 다른 교사가 같은 코드를 만든 경우
    }
    rememberRoom(HOST_ROOM_KEY, code);
    return code;
  }
  throw new Error('방 코드를 만들지 못했어요');
}

/** 이 브라우저가 들어갔던 방을 기억한다(2시간). code가 null이면 잊는다. */
export function rememberRoom(key: string, code: string | null): void {
  try { code ? storage()?.setItem(key, encodeRoom(code, Date.now())) : storage()?.removeItem(key); } catch { /* 무시 */ }
}

export function recallRoom(key: string): string | null {
  try { return decodeRoom(storage()?.getItem(key) ?? null, Date.now()); } catch { return null; }
}

/** 기억한 방을 모두 잊고 첫 화면으로 */
export function leaveToEntry(): void {
  rememberRoom(HOST_ROOM_KEY, null);
  rememberRoom(STUDENT_ROOM_KEY, null);
  location.reload();
}

export async function findHostRoom(db: Database, hostUid: string): Promise<string | null> {
  const code = recallRoom(HOST_ROOM_KEY);
  if (!code) return null;
  const meta = (await get(ref(db, path(code, 'meta')))).val();
  // 최종 순위까지 끝난 방은 다시 열지 않고 새 방을 만든다.
  return meta?.hostUid === hostUid && meta.phase !== 'final' ? code : null;
}

export type JoinResult = 'ok' | 'notfound' | 'full' | 'kicked' | 'badname';

export async function joinRoom(db: Database, code: string, uid: string, rawName: string): Promise<JoinResult> {
  const name = validName(rawName);
  if (!name) return 'badname';
  if (!/^\d{4}$/.test(code)) return 'notfound';
  const room = (await get(ref(db, path(code)))).val();
  if (!room?.meta) return 'notfound';
  if (room.kicked?.[uid]) return 'kicked';
  if (!room.players?.[uid]?.profile) {
    const slots = room.slots ?? {};
    let slot: string | null = null;
    for (let n = 0; n < MAX_STUDENTS && slot === null; n++) {
      if (slots[n] === uid) { slot = String(n); break; }
      if (slots[n]) continue;
      try {
        await set(ref(db, path(code, `slots/${n}`)), uid);
        slot = String(n);
      } catch { /* 동시에 다른 학생이 차지함 → 다음 자리 */ }
    }
    if (slot === null) return 'full';
    await set(ref(db, path(code, `players/${uid}/profile`)), { name, joinedAt: serverTimestamp(), slot });
  }
  watchPresence(db, path(code, `presence/${uid}`));
  return 'ok';
}

/** 접속 중이면 true, 끊기면 서버가 false로 바꾼다. 재접속하면 다시 true. */
function watchPresence(db: Database, p: string): () => void {
  const r = ref(db, p);
  return onValue(ref(db, '.info/connected'), (s) => {
    if (s.val() !== true) return;
    onDisconnect(r).set(false).then(() => set(r, true)).catch(() => { /* 내보내진 경우 등 */ });
  });
}

export function hostPresence(db: Database, code: string): () => void {
  return watchPresence(db, path(code, 'presence/host'));
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (v && typeof v === 'object') return Object.values(v).filter((x): x is string => typeof x === 'string');
  return [];
}

const DEFAULT_STATE: PlayerState = { team: 'wait', caught: false, frozenUntil: 0, score: 0, caughtAt: 0 };

export function toSnapshot(raw: any): RoomSnapshot | null {
  if (!raw?.meta) return null;
  const m = raw.meta;
  const meta: Meta = {
    hostUid: m.hostUid, phase: m.phase ?? 'lobby', round: m.round ?? 0, phaseEndsAt: m.phaseEndsAt ?? 0,
    paused: !!m.paused, pausedAt: m.pausedAt ?? 0, seekerOrder: list(m.seekerOrder), seekerUid: m.seekerUid ?? null,
  };
  const players: Record<string, Player> = {};
  for (const [uid, p] of Object.entries<any>(raw.players ?? {})) {
    if (!p?.profile) continue;
    players[uid] = {
      profile: { name: p.profile.name, prop: p.profile.prop ?? null, joinedAt: p.profile.joinedAt ?? 0, slot: p.profile.slot },
      state: { ...DEFAULT_STATE, ...(p.state ?? {}) },
      online: raw.presence?.[uid] === true,
    };
  }
  const pos: Record<string, Pos> = {};
  for (const [uid, v] of Object.entries<any>(raw.pos ?? {})) pos[uid] = { x: v.x, y: v.y, moving: !!v.moving };
  return { meta, players, pos, hostOnline: raw.presence?.host === true };
}

export function subscribeRoom(db: Database, code: string, cb: (s: RoomSnapshot | null) => void): () => void {
  return onValue(ref(db, path(code)), (s) => cb(toSnapshot(s.val())));
}

export function setPos(db: Database, code: string, uid: string, p: Pos): void {
  set(ref(db, path(code, `pos/${uid}`)), p).catch(() => {});
}

export function setProp(db: Database, code: string, uid: string, prop: string): Promise<void> {
  return set(ref(db, path(code, `players/${uid}/profile/prop`)), prop);
}

export function pushAction(db: Database, code: string, a: Action): void {
  push(ref(db, path(code, 'actions')), a).catch(() => {});
}

// ── 교사 전용 ──

export function updateMeta(db: Database, code: string, p: Partial<Meta>): Promise<void> {
  return update(ref(db, path(code, 'meta')), p);
}

export function updateStates(db: Database, code: string, p: Record<string, Partial<PlayerState>>): Promise<void> {
  const flat: Record<string, unknown> = {};
  for (const [uid, st] of Object.entries(p)) {
    for (const [k, v] of Object.entries(st)) flat[`players/${uid}/state/${k}`] = v;
  }
  return Object.keys(flat).length ? update(ref(db, path(code)), flat) : Promise.resolve();
}

export function onActions(db: Database, code: string, cb: (id: string, a: Action) => void): () => void {
  return onChildAdded(ref(db, path(code, 'actions')), (s) => { if (s.key) cb(s.key, s.val()); });
}

export function deleteAction(db: Database, code: string, id: string): void {
  remove(ref(db, path(code, `actions/${id}`))).catch(() => {});
}

export async function kick(db: Database, code: string, uid: string): Promise<void> {
  const slot = (await get(ref(db, path(code, `players/${uid}/profile/slot`)))).val();
  const changes: Record<string, unknown> = {
    [`kicked/${uid}`]: true, [`players/${uid}`]: null, [`pos/${uid}`]: null, [`presence/${uid}`]: null,
  };
  if (typeof slot === 'string') changes[`slots/${slot}`] = null;
  await update(ref(db, path(code)), changes);
}

/** 교사 탭이 끊기면 서버가 그 순간의 서버 시각으로 일시정지시키도록 예약한다. false면 예약 해제. */
export async function armHostDisconnect(db: Database, code: string, on: boolean): Promise<void> {
  const od = onDisconnect(ref(db, path(code, 'meta')));
  await od.cancel();
  if (on) await od.update({ paused: true, pausedAt: serverTimestamp() });
}
