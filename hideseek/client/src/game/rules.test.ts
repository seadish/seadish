import { describe, it, expect } from 'vitest';
import {
  validName, pickSeeker, assignTeams, resolveAction, seekElapsed, remainingMs,
  catchPoints, settleSurvivors, allCaught, winner, nextPhase,
} from './rules';
import type { Meta, Player, Pos, Team, Action } from './types';

function mkPlayer(team: Team, opts: Partial<Player['state']> = {}, online = true): Player {
  return {
    profile: { name: 'x', prop: 'desk', joinedAt: 0, slot: '0' },
    state: { team, caught: false, frozenUntil: 0, score: 0, caughtAt: 0, ...opts },
    online,
  };
}
function mkMeta(opts: Partial<Meta> = {}): Meta {
  return {
    hostUid: 'host', phase: 'seek', round: 1, phaseEndsAt: 1_000_000, paused: false,
    pausedAt: 0, seekerOrder: ['s', 'h'], seekerUid: 's', ...opts,
  };
}
const NOW = 500_000;
function ctx(over: { meta?: Partial<Meta>; players?: Record<string, Player>; pos?: Record<string, Pos> } = {}) {
  return {
    meta: mkMeta(over.meta),
    now: NOW,
    players: over.players ?? { s: mkPlayer('seek'), h: mkPlayer('hide') },
    pos: over.pos ?? { s: { x: 0, y: 0, moving: false }, h: { x: 119, y: 0, moving: false } },
    decorPos: (id: string) => (id === 'd0' ? { x: 50, y: 0 } : undefined),
  };
}
const tag = (targetId: string, targetType: Action['targetType'] = 'player', uid = 's'): Action =>
  ({ uid, targetType, targetId, at: NOW });

describe('validName', () => {
  it('trims and accepts 1~8 chars', () => expect(validName('  철수  ')).toBe('철수'));
  it('rejects empty', () => expect(validName('   ')).toBeNull());
  it('rejects 9 chars', () => expect(validName('가나다라마바사아자')).toBeNull());
  it('accepts 8 chars', () => expect(validName('가나다라마바사아')).toBe('가나다라마바사아'));
});

describe('pickSeeker (next online student after the previous seeker)', () => {
  const all = new Set(['a', 'b', 'c']);
  it('first round → first online', () => expect(pickSeeker(['a', 'b', 'c'], null, all)).toBe('a'));
  it('after a → b', () => expect(pickSeeker(['a', 'b', 'c'], 'a', all)).toBe('b'));
  it('after c wraps to a', () => expect(pickSeeker(['a', 'b', 'c'], 'c', all)).toBe('a'));
  it('skips offline', () => expect(pickSeeker(['a', 'b', 'c'], 'a', new Set(['a', 'c']))).toBe('c'));
  it('does not repeat a seeker when someone was offline', () => {
    const order = ['a', 'b', 'c', 'd'];
    const r2 = pickSeeker(order, 'a', new Set(['a', 'c', 'd']));
    expect(r2).toBe('c');
    expect(pickSeeker(order, r2, new Set(order))).toBe('d');
  });
  it('unknown previous (kicked) → first online', () => expect(pickSeeker(['a', 'b'], 'zz', new Set(['b']))).toBe('b'));
  it('null if nobody online', () => expect(pickSeeker(['a', 'b'], null, new Set())).toBeNull());
  it('null on empty order', () => expect(pickSeeker([], null, all)).toBeNull());
});

describe('assignTeams', () => {
  it('seeker seek, online rest hide, offline wait', () =>
    expect(assignTeams(['a', 'b', 'c'], 'b', new Set(['a', 'b']))).toEqual({ a: 'hide', b: 'seek', c: 'wait' }));
});

describe('resolveAction', () => {
  it('catches hider within 120px', () =>
    expect(resolveAction(tag('h'), ctx())).toEqual({ kind: 'catch', seekerUid: 's', targetUid: 'h' }));
  it('ignores hider at 121px', () =>
    expect(resolveAction(tag('h'), ctx({ pos: { s: { x: 0, y: 0, moving: false }, h: { x: 121, y: 0, moving: false } } })))
      .toEqual({ kind: 'ignore', reason: 'far' }));
  it('freezes on decor', () =>
    expect(resolveAction(tag('d0', 'decor'), ctx())).toEqual({ kind: 'freeze', uid: 's', until: NOW + 2000 }));
  it('ignores frozen requester', () =>
    expect(resolveAction(tag('h'), ctx({ players: { s: mkPlayer('seek', { frozenUntil: NOW + 1 }), h: mkPlayer('hide') } })))
      .toEqual({ kind: 'ignore', reason: 'frozen' }));
  it('ignores hider requester', () =>
    expect(resolveAction(tag('s', 'player', 'h'), ctx())).toEqual({ kind: 'ignore', reason: 'not-seeker' }));
  it('ignores outside seek phase', () =>
    expect(resolveAction(tag('h'), ctx({ meta: { phase: 'prep' } }))).toEqual({ kind: 'ignore', reason: 'phase' }));
  it('ignores while paused', () =>
    expect(resolveAction(tag('h'), ctx({ meta: { paused: true } }))).toEqual({ kind: 'ignore', reason: 'paused' }));
  it('ignores already caught target', () =>
    expect(resolveAction(tag('h'), ctx({ players: { s: mkPlayer('seek'), h: mkPlayer('seek', { caught: true }) } })))
      .toEqual({ kind: 'ignore', reason: 'invalid' }));
  it('ignores unknown decor', () =>
    expect(resolveAction(tag('d99', 'decor'), ctx())).toEqual({ kind: 'ignore', reason: 'invalid' }));
  it('ignores unknown requester', () =>
    expect(resolveAction(tag('h', 'player', 'zz'), ctx())).toEqual({ kind: 'ignore', reason: 'not-seeker' }));
});

describe('points', () => {
  it('catchPoints floors per 30s', () => {
    expect(catchPoints(59_999)).toBe(1);
    expect(catchPoints(60_000)).toBe(2);
  });
  it('settleSurvivors gives interval points + 5 to uncaught hiders only', () => {
    const players = { a: mkPlayer('hide'), b: mkPlayer('seek', { caught: true }), c: mkPlayer('seek') };
    expect(settleSurvivors(players, 240_000)).toEqual({ a: 13 });
  });
});

describe('seekElapsed / remainingMs', () => {
  it('paused: measured at the pause moment', () =>
    expect(seekElapsed(mkMeta({ paused: true, pausedAt: NOW - 50_000, phaseEndsAt: NOW + 50_000 }), NOW)).toBe(140_000));
  it('running uses phaseEndsAt', () =>
    expect(seekElapsed(mkMeta({ phaseEndsAt: NOW + 200_000 }), NOW)).toBe(40_000));
  it('clamps after end', () =>
    expect(seekElapsed(mkMeta({ phaseEndsAt: NOW - 5 }), NOW)).toBe(240_000));
  it('remainingMs while running', () => expect(remainingMs(mkMeta({ phaseEndsAt: NOW + 1234 }), NOW)).toBe(1234));
  it('remainingMs while paused ignores time since the pause', () =>
    expect(remainingMs(mkMeta({ paused: true, pausedAt: NOW - 99_000, phaseEndsAt: NOW - 99_000 + 7_000 }), NOW)).toBe(7_000));
  it('remainingMs never exceeds the phase length (stale pause from a flaky teacher connection)', () =>
    expect(remainingMs(mkMeta({ phase: 'seek', paused: true, pausedAt: NOW - 3_000, phaseEndsAt: NOW + 240_000 }), NOW)).toBe(240_000));
});

describe('allCaught / winner', () => {
  it('true when no uncaught hider', () =>
    expect(allCaught({ a: mkPlayer('seek'), b: mkPlayer('seek', { caught: true }) })).toBe(true));
  it('false when a hider remains', () =>
    expect(allCaught({ a: mkPlayer('seek'), b: mkPlayer('hide') })).toBe(false));
  it('false when there were never hiders', () =>
    expect(allCaught({ a: mkPlayer('seek') })).toBe(false));
  it('winner', () => {
    expect(winner({ a: mkPlayer('seek'), b: mkPlayer('hide') })).toBe('hide');
    expect(winner({ a: mkPlayer('seek'), b: mkPlayer('seek', { caught: true }) })).toBe('seek');
  });
});

describe('nextPhase', () => {
  it('prep expiry → seek', () =>
    expect(nextPhase(mkMeta({ phase: 'prep', phaseEndsAt: NOW }), NOW, false)).toEqual({ phase: 'seek', phaseEndsAt: NOW + 240_000 }));
  it('seek with everyone caught → result early', () =>
    expect(nextPhase(mkMeta({ phase: 'seek', phaseEndsAt: NOW + 9999 }), NOW, true)).toEqual({ phase: 'result', phaseEndsAt: NOW + 15_000 }));
  it('seek expiry → result', () =>
    expect(nextPhase(mkMeta({ phase: 'seek', phaseEndsAt: NOW }), NOW, false)).toEqual({ phase: 'result', phaseEndsAt: NOW + 15_000 }));
  it('result expiry → lobby', () =>
    expect(nextPhase(mkMeta({ phase: 'result', phaseEndsAt: NOW }), NOW, false)).toEqual({ phase: 'lobby', phaseEndsAt: 0 }));
  it('paused → null', () =>
    expect(nextPhase(mkMeta({ phase: 'prep', phaseEndsAt: NOW, paused: true }), NOW, false)).toBeNull());
  it('lobby → null', () =>
    expect(nextPhase(mkMeta({ phase: 'lobby', phaseEndsAt: 0 }), NOW, false)).toBeNull());
  it('seek not expired → null', () =>
    expect(nextPhase(mkMeta({ phase: 'seek', phaseEndsAt: NOW + 1 }), NOW, false)).toBeNull());
});
