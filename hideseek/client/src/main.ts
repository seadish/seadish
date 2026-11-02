import Phaser from 'phaser';
import { get, ref } from 'firebase/database';
import { client } from './net/firebase';
import { createRoom, findHostRoom, joinRoom } from './net/room';
import { showEntry, JOIN_ERRORS } from './screens/entry';
import { StudentScene, type GameData } from './scenes/StudentScene';
import { HostScene } from './scenes/HostScene';
import { h, mount } from './ui/dom';

const TEACHER_CODE = (import.meta.env.VITE_TEACHER_CODE ?? '').trim();
const STUDENT_ROOM_KEY = 'hideseek.studentRoom';
const c = client();

function remember(code: string | null): void {
  try { code ? localStorage.setItem(STUDENT_ROOM_KEY, code) : localStorage.removeItem(STUDENT_ROOM_KEY); } catch { /* 무시 */ }
}

function start(key: 'student' | 'host', data: GameData): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#d8cdb8',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [],
  });
  game.scene.add(key, key === 'student' ? StudentScene : HostScene, true, data);
}

/** 새로고침했을 때 같은 방에 바로 돌아간다(학생은 같은 uid, 교사는 같은 hostUid). */
async function tryResume(uid: string): Promise<boolean> {
  const hostCode = await findHostRoom(c.db, uid);
  if (hostCode) { start('host', { code: hostCode, uid, c }); return true; }
  let code: string | null = null;
  try { code = localStorage.getItem(STUDENT_ROOM_KEY); } catch { /* 없음 */ }
  if (!code) return false;
  const room = (await get(ref(c.db, `rooms/${code}`))).val();
  const name = room?.players?.[uid]?.profile?.name;
  if (!name || room.meta?.phase === 'final') { remember(null); return false; }
  if ((await joinRoom(c.db, code, uid, name)) !== 'ok') { remember(null); return false; }
  start('student', { code, uid, c });
  return true;
}

async function boot(): Promise<void> {
  mount(h('div', { class: 'center' }, '연결하는 중…'));
  const uid = await c.ensureUid();
  if (await tryResume(uid)) return;
  showEntry({
    async student(code, name) {
      const r = await joinRoom(c.db, code, uid, name);
      if (r !== 'ok') return JOIN_ERRORS[r];
      remember(code);
      start('student', { code, uid, c });
      return null;
    },
    async teacher(teacherCode) {
      if (!TEACHER_CODE || teacherCode.trim() !== TEACHER_CODE) return '교사 코드가 맞지 않아요';
      const code = (await findHostRoom(c.db, uid)) ?? (await createRoom(c.db, uid));
      start('host', { code, uid, c });
      return null;
    },
  });
}

boot().catch((e) => {
  console.error(e);
  mount(h('div', { class: 'center' }, h('div', { class: 'card panel' }, '연결에 실패했어요. 새로고침해 주세요.')));
});
