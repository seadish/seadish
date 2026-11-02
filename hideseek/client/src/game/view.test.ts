import { describe, it, expect } from 'vitest';
import { canAct, seesWobble, isVisible, remainingSec } from './view';
import type { Meta, Phase, PlayerState, Team } from './types';

const NOW = 100_000;
const meta = (phase: Phase, o: Partial<Meta> = {}): Meta => ({
  hostUid: 'h', phase, round: 1, phaseEndsAt: NOW + 10_000, paused: false, remainingMs: 0, seekerOrder: [], seekerUid: null, ...o,
});
const me = (team: Team, o: Partial<PlayerState> = {}): PlayerState => ({ team, caught: false, frozenUntil: 0, score: 0, caughtAt: 0, ...o });
const none = { move: false, click: false };

describe('canAct', () => {
  it('paused blocks everything', () => expect(canAct(meta('seek', { paused: true }), me('seek'), NOW)).toEqual(none));
  it('prep: seeker cannot act', () => expect(canAct(meta('prep'), me('seek'), NOW)).toEqual(none));
  it('prep: hider can move only', () => expect(canAct(meta('prep'), me('hide'), NOW)).toEqual({ move: true, click: false }));
  it('seek: seeker moves and clicks', () => expect(canAct(meta('seek'), me('seek'), NOW)).toEqual({ move: true, click: true }));
  it('seek: frozen seeker cannot act', () => expect(canAct(meta('seek'), me('seek', { frozenUntil: NOW + 1 }), NOW)).toEqual(none));
  it('seek: hider moves only', () => expect(canAct(meta('seek'), me('hide'), NOW)).toEqual({ move: true, click: false }));
  it('seek: waiting student cannot act', () => expect(canAct(meta('seek'), me('wait'), NOW)).toEqual(none));
  it('result/lobby/final: nobody acts', () => {
    for (const p of ['result', 'lobby', 'final'] as Phase[]) expect(canAct(meta(p), me('seek'), NOW)).toEqual(none);
  });
});

describe('seesWobble', () => {
  it('host and seekers see wobble, hiders do not', () => {
    expect(seesWobble('host')).toBe(true);
    expect(seesWobble('seek')).toBe(true);
    expect(seesWobble('hide')).toBe(false);
  });
});

describe('isVisible', () => {
  const at = { x: 0, y: 0, moving: false };
  it('seeker sees within 180px', () => expect(isVisible('seek', at, { x: 180, y: 0 })).toBe(true));
  it('seeker does not see at 181px', () => expect(isVisible('seek', at, { x: 181, y: 0 })).toBe(false));
  it('others see everything', () => expect(isVisible('hide', at, { x: 9999, y: 0 })).toBe(true));
});

describe('remainingSec', () => {
  it('rounds up', () => expect(remainingSec(meta('seek', { phaseEndsAt: NOW + 1_500 }), NOW)).toBe(2));
  it('uses remainingMs while paused', () => expect(remainingSec(meta('seek', { paused: true, remainingMs: 4_001 }), NOW)).toBe(5));
  it('never negative', () => expect(remainingSec(meta('seek', { phaseEndsAt: NOW - 50 }), NOW)).toBe(0));
});
