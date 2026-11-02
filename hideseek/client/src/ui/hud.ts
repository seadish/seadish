// 학생·교사 화면이 같이 쓰는 결과표, 최종 순위, 단계 이름
import { h } from './dom';
import type { Phase, RoomSnapshot, Team } from '../game/types';
import { propKind } from '../game/map';
import { winner } from '../game/rules';

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: '대기', prep: '숨는 시간', seek: '찾는 시간', result: '결과', final: '최종 순위',
};
export const TEAM_LABEL: Record<Team, string> = { seek: '술래 편', hide: '숨는 편', wait: '다음 판부터' };

export function teamTag(team: Team): HTMLElement {
  return h('span', { class: `tag ${team}` }, TEAM_LABEL[team]);
}

/** 이번 판 결과: 승리 편과 각자 무엇으로 숨었는지, 이번 판 점수 변화 */
export function resultCard(s: RoomSnapshot, roundStartScores: Record<string, number>): HTMLElement {
  const rows = Object.entries(s.players)
    .filter(([, p]) => p.state.team !== 'wait')
    .sort(([, a], [, b]) => b.state.score - a.state.score);
  const win = winner(s.players);
  return h('div', { class: 'card result panel', testid: 'result-card' },
    h('h2', {}, win === 'seek' ? '🔎 술래 편 승리!' : '🫥 숨는 편 승리!'),
    h('table', {},
      h('tr', {}, h('th', {}, '이름'), h('th', {}, '변신'), h('th', {}, '결과'), h('th', {}, '이번 판')),
      ...rows.map(([uid, p]) => {
        const wasHider = p.state.caught || p.state.team === 'hide';
        const delta = p.state.score - (roundStartScores[uid] ?? p.state.score);
        return h('tr', {},
          h('td', {}, p.profile.name),
          h('td', {}, wasHider ? `${propKind(p.profile.prop ?? 'desk').emoji} ${propKind(p.profile.prop ?? 'desk').label}` : '처음 술래'),
          h('td', {}, wasHider ? (p.state.caught ? '잡힘' : '살아남음 🎉') : '-'),
          h('td', {}, `+${delta}`),
        );
      }),
    ),
  );
}

export function ranking(s: RoomSnapshot): HTMLElement {
  const rows = Object.values(s.players).sort((a, b) => b.state.score - a.state.score);
  const medal = ['🥇', '🥈', '🥉'];
  return h('div', { class: 'card result panel', testid: 'final-ranking' },
    h('h2', {}, '🏆 최종 순위'),
    h('div', { class: 'podium' },
      ...rows.slice(0, 3).map((p, i) => h('div', { style: `padding-top: ${36 - i * 12}px` }, `${medal[i]} ${p.profile.name}`, h('br'), `${p.state.score}점`)),
    ),
    h('table', {}, ...rows.map((p, i) => h('tr', {}, h('td', {}, `${i + 1}등`), h('td', {}, p.profile.name), h('td', {}, `${p.state.score}점`)))),
  );
}
