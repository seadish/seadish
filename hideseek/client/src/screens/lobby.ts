import { h } from '../ui/dom';
import type { RoomSnapshot } from '../game/types';

/** 학생 대기실: 방 코드와 접속한 친구 목록 */
export function lobbyView(code: string, s: RoomSnapshot, myUid: string): HTMLElement {
  const players = Object.entries(s.players).sort(([, a], [, b]) => a.profile.joinedAt - b.profile.joinedAt);
  return h('div', { class: 'center' },
    h('div', { class: 'card lobby panel' },
      h('div', {}, '방 코드'),
      h('div', { class: 'code' }, code),
      h('ul', { class: 'chips', testid: 'lobby-list' },
        ...players.map(([uid, p]) => h('li', { class: [uid === myUid && 'me', !p.online && 'off'].filter(Boolean).join(' ') }, p.profile.name))),
      h('div', {}, s.meta.round > 0 ? `${s.meta.round}판 끝! 선생님이 다음 판을 시작할 때까지 기다려요` : '선생님이 시작할 때까지 기다려요'),
      h('div', { style: 'color: var(--muted)' }, '방향키/WASD로 움직이고, 술래는 마우스로 물건을 눌러 확인해요'),
    ),
  );
}
