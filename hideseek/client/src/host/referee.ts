// 교사 브라우저에서 도는 심판: 타이머, 잡기 판정, 점수. 규칙 계산은 rules.ts에 맡긴다.
import type { Database } from 'firebase/database';
import type { Action, Meta, PlayerState, RoomSnapshot } from '../game/types';
import { PREP_MS, RESULT_MS, CATCH_POINTS } from '../game/constants';
import {
  allCaught, assignTeams, catchPoints, nextPhase, pickSeeker, remainingMs, resolveAction, seekElapsed, settleSurvivors,
} from '../game/rules';
import { decorPos } from '../game/map';
import * as room from '../net/room';

export interface RoomPort {
  updateMeta(p: Partial<Meta>): void;
  updateStates(p: Record<string, Partial<PlayerState>>): void;
  deleteAction(id: string): void;
  /** true면 교사 연결이 끊길 때 서버가 일시정지시키도록 예약, false면 예약 해제 */
  armHostDisconnect(on: boolean): void;
  kick(uid: string): void;
}

export function roomPort(db: Database, code: string): RoomPort {
  const warn = (e: unknown) => console.warn('[referee]', e);
  return {
    updateMeta: (p) => { room.updateMeta(db, code, p).catch(warn); },
    updateStates: (p) => { room.updateStates(db, code, p).catch(warn); },
    deleteAction: (id) => room.deleteAction(db, code, id),
    armHostDisconnect: (on) => { room.armHostDisconnect(db, code, on).catch(warn); },
    kick: (uid) => { room.kick(db, code, uid).catch(warn); },
  };
}

// 재접속하면 서버의 끊김 예약이 사라지므로 진행 중에는 주기적으로 다시 건다.
const ARM_EVERY_MS = 5_000;

export class Referee {
  private s: RoomSnapshot | null = null;
  private lastArmAt = -Infinity;
  private armed = false;

  constructor(private port: RoomPort, private now: () => number) {}

  onSnapshot(s: RoomSnapshot | null): void {
    this.s = s;
    if (!s) return;
    const order = s.meta.seekerOrder;
    const missing = Object.entries(s.players)
      .filter(([uid]) => !order.includes(uid))
      .sort(([, a], [, b]) => a.profile.joinedAt - b.profile.joinedAt)
      .map(([uid]) => uid);
    if (missing.length) this.meta({ seekerOrder: [...order, ...missing] });
  }

  onAction(id: string, a: Action): void {
    const s = this.s;
    this.port.deleteAction(id);
    if (!s) return;
    const now = this.now();
    const r = resolveAction(a, { meta: s.meta, now, players: s.players, pos: s.pos, decorPos });
    if (r.kind === 'catch') {
      const target = s.players[r.targetUid].state;
      const seeker = s.players[r.seekerUid].state;
      this.states({
        [r.targetUid]: { team: 'seek', caught: true, caughtAt: now, score: target.score + catchPoints(seekElapsed(s.meta, now)) },
        [r.seekerUid]: { score: seeker.score + CATCH_POINTS },
      });
    } else if (r.kind === 'freeze') {
      this.states({ [r.uid]: { frozenUntil: r.until } });
    }
  }

  tick(): void {
    const s = this.s;
    if (!s) return;
    const now = this.now();
    const { meta } = s;
    const running = (meta.phase === 'prep' || meta.phase === 'seek') && !meta.paused;
    if (running && (!this.armed || now - this.lastArmAt >= ARM_EVERY_MS)) {
      this.lastArmAt = now;
      this.armed = true;
      this.port.armHostDisconnect(true);
    } else if (!running && this.armed) {
      this.armed = false;
      this.port.armHostDisconnect(false);
    }

    const np = nextPhase(meta, now, meta.phase === 'seek' && allCaught(s.players));
    if (!np) return;
    if (meta.phase === 'seek') this.settle(now);
    this.meta(np);
  }

  startRound(): 'ok' | 'need-players' | 'busy' {
    const s = this.s;
    if (!s || s.meta.phase !== 'lobby') return 'busy';
    const online = new Set(Object.entries(s.players).filter(([, p]) => p.online).map(([uid]) => uid));
    if (online.size < 2) return 'need-players';
    const order = s.meta.seekerOrder.filter((uid) => s.players[uid]);
    const round = s.meta.round + 1;
    const seekerUid = pickSeeker(order, s.meta.seekerUid, online);
    if (!seekerUid) return 'need-players';
    const teams = assignTeams(order, seekerUid, online);
    const states: Record<string, Partial<PlayerState>> = {};
    for (const [uid, team] of Object.entries(teams)) states[uid] = { team, caught: false, frozenUntil: 0, caughtAt: 0 };
    this.states(states);
    this.meta({ round, seekerUid, seekerOrder: order, phase: 'prep', phaseEndsAt: this.now() + PREP_MS, paused: false, pausedAt: 0 });
    return 'ok';
  }

  pause(): void {
    const m = this.s?.meta;
    if (!m || m.paused || (m.phase !== 'prep' && m.phase !== 'seek')) return;
    this.meta({ paused: true, pausedAt: this.now() });
  }

  resume(): void {
    const m = this.s?.meta;
    if (!m || !m.paused) return;
    const now = this.now();
    this.meta({ paused: false, phaseEndsAt: now + remainingMs(m, now) });
  }

  forceEnd(): void {
    const m = this.s?.meta;
    if (!m || (m.phase !== 'prep' && m.phase !== 'seek')) return;
    const now = this.now();
    if (m.phase === 'seek') this.settle(now);
    this.meta({ phase: 'result', phaseEndsAt: now + RESULT_MS, paused: false });
  }

  showFinal(): void {
    if (this.s?.meta.phase !== 'lobby') return;
    this.meta({ phase: 'final', phaseEndsAt: 0 });
  }

  kick(uid: string): void {
    if (!this.s) return;
    this.port.kick(uid);
    this.meta({ seekerOrder: this.s.meta.seekerOrder.filter((u) => u !== uid) });
  }

  /** 찾기 단계가 끝날 때 살아남은 숨는 편에게 점수를 준다. */
  private settle(now: number): void {
    const s = this.s!;
    const bonus = settleSurvivors(s.players, seekElapsed(s.meta, now));
    const states: Record<string, Partial<PlayerState>> = {};
    for (const [uid, pts] of Object.entries(bonus)) states[uid] = { score: s.players[uid].state.score + pts };
    if (Object.keys(states).length) this.states(states);
  }

  // 다음 스냅샷이 오기 전에 이어지는 판정이 최신 값을 보도록 로컬에도 바로 반영한다.
  private meta(p: Partial<Meta>): void {
    if (this.s) this.s = { ...this.s, meta: { ...this.s.meta, ...p } };
    this.port.updateMeta(p);
  }

  private states(p: Record<string, Partial<PlayerState>>): void {
    if (this.s) {
      const players = { ...this.s.players };
      for (const [uid, st] of Object.entries(p)) {
        if (players[uid]) players[uid] = { ...players[uid], state: { ...players[uid].state, ...st } };
      }
      this.s = { ...this.s, players };
    }
    this.port.updateStates(p);
  }
}
