// 화면에서 "무엇을 할 수 있고 무엇이 보이는지" 판단하는 순수 함수
import type { Meta, PlayerState, Pos, Team } from './types';
import { VISION_RADIUS } from './constants';

export function canAct(meta: Meta, me: PlayerState, now: number): { move: boolean; click: boolean } {
  const none = { move: false, click: false };
  if (meta.paused) return none;
  if (meta.phase === 'prep') return me.team === 'hide' ? { move: true, click: false } : none;
  if (meta.phase !== 'seek') return none;
  if (me.team === 'hide') return { move: true, click: false };
  if (me.team === 'seek' && me.frozenUntil <= now) return { move: true, click: true };
  return none;
}

export function seesWobble(viewer: 'host' | Team): boolean {
  return viewer === 'host' || viewer === 'seek';
}

export function isVisible(viewerTeam: Team, viewer: Pos, target: { x: number; y: number }): boolean {
  return viewerTeam !== 'seek' || Math.hypot(target.x - viewer.x, target.y - viewer.y) <= VISION_RADIUS;
}

export function remainingSec(meta: Meta, now: number): number {
  const ms = meta.paused ? meta.remainingMs : meta.phaseEndsAt - now;
  return Math.max(0, Math.ceil(ms / 1000));
}
