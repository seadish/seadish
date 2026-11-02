import type { Action, Meta, Phase, Player, Pos, Team } from './types';
import {
  FREEZE_MS, NAME_MAX, POINT_INTERVAL_MS, RESULT_MS, SEEK_MS, SURVIVE_BONUS, TAG_RANGE,
} from './constants';

export function validName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && [...name].length <= NAME_MAX ? name : null;
}

export function pickSeeker(order: string[], round: number, online: Set<string>): string | null {
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const uid = order[(round - 1 + i) % n];
    if (online.has(uid)) return uid;
  }
  return null;
}

export function assignTeams(order: string[], seekerUid: string): Record<string, Team> {
  const teams: Record<string, Team> = {};
  for (const uid of order) teams[uid] = uid === seekerUid ? 'seek' : 'hide';
  return teams;
}

export type ActionResult =
  | { kind: 'catch'; seekerUid: string; targetUid: string }
  | { kind: 'freeze'; uid: string; until: number }
  | { kind: 'ignore'; reason: 'phase' | 'paused' | 'not-seeker' | 'frozen' | 'far' | 'invalid' };

export interface ActionContext {
  meta: Meta;
  now: number;
  players: Record<string, Player>;
  pos: Record<string, Pos>;
  decorPos: (id: string) => { x: number; y: number } | undefined;
}

export function resolveAction(a: Action, ctx: ActionContext): ActionResult {
  const { meta, now, players, pos } = ctx;
  if (meta.phase !== 'seek') return { kind: 'ignore', reason: 'phase' };
  if (meta.paused) return { kind: 'ignore', reason: 'paused' };
  const me = players[a.uid];
  if (!me || me.state.team !== 'seek') return { kind: 'ignore', reason: 'not-seeker' };
  if (me.state.frozenUntil > now) return { kind: 'ignore', reason: 'frozen' };
  const myPos = pos[a.uid];
  if (!myPos) return { kind: 'ignore', reason: 'invalid' };

  let target: { x: number; y: number } | undefined;
  if (a.targetType === 'decor') {
    target = ctx.decorPos(a.targetId);
  } else {
    const t = players[a.targetId];
    if (t && t.state.team === 'hide' && !t.state.caught) target = pos[a.targetId];
  }
  if (!target) return { kind: 'ignore', reason: 'invalid' };
  if (Math.hypot(target.x - myPos.x, target.y - myPos.y) > TAG_RANGE) return { kind: 'ignore', reason: 'far' };

  return a.targetType === 'decor'
    ? { kind: 'freeze', uid: a.uid, until: now + FREEZE_MS }
    : { kind: 'catch', seekerUid: a.uid, targetUid: a.targetId };
}

export function seekElapsed(meta: Meta, now: number): number {
  const remaining = meta.paused ? meta.remainingMs : meta.phaseEndsAt - now;
  return Math.min(SEEK_MS, Math.max(0, SEEK_MS - remaining));
}

export function catchPoints(elapsedMs: number): number {
  return Math.floor(elapsedMs / POINT_INTERVAL_MS);
}

export function settleSurvivors(players: Record<string, Player>, elapsedMs: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [uid, p] of Object.entries(players)) {
    if (p.state.team === 'hide' && !p.state.caught) out[uid] = catchPoints(elapsedMs) + SURVIVE_BONUS;
  }
  return out;
}

export function allCaught(players: Record<string, Player>): boolean {
  const hiders = Object.values(players).filter((p) => p.state.team === 'hide' || p.state.caught);
  return hiders.length > 0 && hiders.every((p) => p.state.caught);
}

export function winner(players: Record<string, Player>): 'seek' | 'hide' {
  return Object.values(players).some((p) => p.state.team === 'hide' && !p.state.caught) ? 'hide' : 'seek';
}

export function nextPhase(meta: Meta, now: number, everyoneCaught: boolean): { phase: Phase; phaseEndsAt: number } | null {
  if (meta.paused) return null;
  if (meta.phase === 'prep' && now >= meta.phaseEndsAt) return { phase: 'seek', phaseEndsAt: now + SEEK_MS };
  if (meta.phase === 'seek' && (everyoneCaught || now >= meta.phaseEndsAt)) return { phase: 'result', phaseEndsAt: now + RESULT_MS };
  if (meta.phase === 'result' && now >= meta.phaseEndsAt) return { phase: 'lobby', phaseEndsAt: 0 };
  return null;
}
