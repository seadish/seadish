import Phaser from 'phaser';
import type { Client } from '../net/firebase';
import { pushAction, setPos, setProp, subscribeRoom } from '../net/room';
import type { PlayerState, RoomSnapshot, Team } from '../game/types';
import { SPEED, TAG_RANGE, VISION_RADIUS } from '../game/constants';
import { DECOR, HIDER_SPAWNS, MAP_H, MAP_W, PROP_KINDS, SEEKER_SPAWN, blocked, propKind } from '../game/map';
import { canAct, isVisible, remainingSec, seesWobble } from '../game/view';
import { drawDecor, drawFloor, makeFog } from './drawMap';
import { PlayerSprite, type Look } from './playerSprites';
import { h, mount } from '../ui/dom';
import { PHASE_LABEL, ranking, resultCard, teamTag } from '../ui/hud';
import { lobbyView } from '../screens/lobby';

export interface GameData { code: string; uid: string; c: Client }

const BODY_R = 12;
const SEND_EVERY_MS = 100;
const DEFAULT_STATE: PlayerState = { team: 'wait', caught: false, frozenUntil: 0, score: 0, caughtAt: 0 };

export class StudentScene extends Phaser.Scene {
  private d!: GameData;
  private s: RoomSnapshot | null = null;
  private me = { x: 0, y: 0 };
  private placed = false;
  private lastMoveAt = 0;
  private lastSentAt = 0;
  private lastSent = '';
  private sprites = new Map<string, PlayerSprite>();
  private decor!: Map<string, Phaser.GameObjects.Container>;
  private fog!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private overlay = h('div');
  private toastEl = h('div');
  private timeEl: HTMLElement | null = null;
  private coverCountEl: HTMLElement | null = null;
  private overlayKey = '';
  private prevPhase: string | null = null;
  private prevState: PlayerState | null = null;
  private roundStartScores: Record<string, number> = {};
  private toastTimer = 0;
  private kicked = false;

  constructor() { super('student'); }

  create(data: GameData): void {
    this.d = data;
    drawFloor(this);
    this.decor = drawDecor(this);
    this.fog = makeFog(this, VISION_RADIUS);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p.worldX, p.worldY));
    mount(this.overlay, this.toastEl);

    const off = subscribeRoom(data.c.db, data.code, (s) => this.onSnapshot(s));
    this.events.once('shutdown', off);

    if (import.meta.env.VITE_USE_EMULATOR === '1') {
      (window as any).__hs = {
        uid: data.uid, code: data.code,
        snapshot: () => this.s,
        debug: () => ({ key: this.overlayKey, kicked: this.kicked, n: this.overlay.childElementCount, mounted: this.overlay.isConnected, scenes: this.game.scene.getScenes(false).length }),
        forcePos: (x: number, y: number) => { this.me = { x, y }; this.placed = true; this.sendPos(true); },
        spriteOf: (uid: string) => { const sp = this.sprites.get(uid); return sp ? { x: sp.x, y: sp.y } : null; },
        screenOf: (x: number, y: number) => {
          const cam = this.cameras.main;
          return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
        },
      };
    }
  }

  private fitCamera(): void {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(width / 1000, height / 620), 0.6, 1.5));
  }

  private get myState(): PlayerState {
    return this.s?.players[this.d.uid]?.state ?? DEFAULT_STATE;
  }

  private onSnapshot(s: RoomSnapshot | null): void {
    if (!s || !s.players[this.d.uid]) {
      this.kicked = true;
      this.s = s;
      this.renderOverlay(true);
      return;
    }
    const { uid } = this.d;
    const phase = s.meta.phase;
    const st = s.players[uid].state;

    if (!this.placed && s.pos[uid]) { this.me = { x: s.pos[uid].x, y: s.pos[uid].y }; this.placed = true; }
    if (phase === 'prep' && this.prevPhase !== 'prep') {
      const idx = Math.max(0, s.meta.seekerOrder.indexOf(uid));
      const spawn = st.team === 'seek' ? SEEKER_SPAWN : HIDER_SPAWNS[idx % HIDER_SPAWNS.length];
      this.me = { ...spawn };
      this.placed = true;
      this.roundStartScores = Object.fromEntries(Object.entries(s.players).map(([u, p]) => [u, p.state.score]));
      this.sendPos(true);
    }
    if (!this.placed) {
      this.me = { ...HIDER_SPAWNS[Number(s.players[uid].profile.slot) % HIDER_SPAWNS.length] };
      this.placed = true;
    }
    if (phase === 'seek' && st.team === 'hide' && !s.players[uid].profile.prop) {
      setProp(this.d.c.db, this.d.code, uid, 'desk').catch(() => {});
    }
    const prev = this.prevState;
    if (prev && prev.team === 'hide' && st.caught && !prev.caught) this.toast('잡혔어요! 이제 술래 편이 되어 같이 찾아요');
    if (prev && st.frozenUntil > (prev.frozenUntil ?? 0)) this.toast('앗! 진짜 물건이었어요. 2초 멈춤');

    this.prevPhase = phase;
    this.prevState = st;
    this.s = s;
    this.renderOverlay();
  }

  update(time: number, delta: number): void {
    const s = this.s;
    if (!s || this.kicked) return;
    const now = this.d.c.serverNow();
    const st = this.myState;
    const act = canAct(s.meta, st, now);

    if (act.move) {
      const k = this.keys;
      let dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      let dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const step = (SPEED * Math.min(delta, 100)) / 1000;
        dx = (dx / len) * step;
        dy = (dy / len) * step;
        let moved = false;
        if (!blocked(this.me.x + dx, this.me.y, BODY_R)) { this.me.x += dx; moved = true; }
        if (!blocked(this.me.x, this.me.y + dy, BODY_R)) { this.me.y += dy; moved = true; }
        if (moved) this.lastMoveAt = time;
      }
    }
    if (time - this.lastSentAt >= SEND_EVERY_MS) { this.lastSentAt = time; this.sendPos(false, time); }

    this.drawWorld(s, st.team, time);
    this.cameras.main.centerOn(this.me.x, this.me.y);
    if (this.timeEl) this.timeEl.textContent = `${remainingSec(s.meta, now)}초`;
    if (this.coverCountEl) this.coverCountEl.textContent = String(remainingSec(s.meta, now));
    // 정지가 풀리는 등 시간에 따라 바뀌는 화면 상태
    if (this.overlayKeyFor(s, now) !== this.overlayKey) this.renderOverlay();
  }

  private sendPos(force: boolean, time = this.time.now): void {
    const moving = time - this.lastMoveAt < 200;
    const p = { x: Math.round(this.me.x), y: Math.round(this.me.y), moving };
    const key = `${p.x},${p.y},${p.moving}`;
    if (!force && key === this.lastSent) return;
    this.lastSent = key;
    setPos(this.d.c.db, this.d.code, this.d.uid, p);
  }

  private lookFor(team: Team, prop: string | null): Look {
    return team === 'hide' ? { mode: 'prop', kind: prop ?? 'desk' } : { mode: 'person', team: team === 'seek' ? 'seek' : 'hide' };
  }

  private drawWorld(s: RoomSnapshot, myTeam: Team, time: number): void {
    const viewer = { ...this.me, moving: false };
    const reveal = s.meta.phase === 'result' || s.meta.phase === 'final';
    const fogOn = myTeam === 'seek' && s.meta.phase === 'seek';
    const wobbleViewer = seesWobble(myTeam);

    for (const d of DECOR) this.decor.get(d.id)!.setVisible(!fogOn || isVisible('seek', viewer, d));

    for (const [uid, sp] of this.sprites) if (!s.players[uid]) { sp.destroy(); this.sprites.delete(uid); }
    for (const [uid, p] of Object.entries(s.players)) {
      const isMe = uid === this.d.uid;
      let sp = this.sprites.get(uid);
      if (!sp) { sp = new PlayerSprite(this, isMe ? `${p.profile.name} (나)` : p.profile.name, isMe); this.sprites.set(uid, sp); }
      const pos = isMe ? this.me : s.pos[uid];
      if (!pos || p.state.team === 'wait' || (s.meta.phase === 'lobby' && !isMe)) { sp.draw({ visible: false, showName: false, wobble: 0 }); continue; }
      sp.setLook(this.lookFor(p.state.team, p.profile.prop));
      sp.moveToward(pos.x, pos.y, isMe);
      const disguised = p.state.team === 'hide';
      const moving = !isMe && 'moving' in pos && (pos as { moving: boolean }).moving;
      const wobble = disguised && moving && wobbleViewer ? Math.sin((time / 1000) * Math.PI * 2 * 8) * 2 : 0;
      sp.draw({
        visible: isMe || !fogOn || isVisible('seek', viewer, sp),
        showName: isMe || reveal || !(myTeam === 'seek' && disguised),
        wobble,
      });
    }

    this.fog.setVisible(fogOn).setPosition(this.me.x, this.me.y);
  }

  private onClick(wx: number, wy: number): void {
    const s = this.s;
    if (!s) return;
    const now = this.d.c.serverNow();
    if (!canAct(s.meta, this.myState, now).click) return;
    const viewer = { ...this.me, moving: false };
    const hit = (x: number, y: number, w: number, hh: number) => Math.abs(wx - x) <= w / 2 && Math.abs(wy - y) <= hh / 2;

    let target: { type: 'player' | 'decor'; id: string; x: number; y: number } | null = null;
    for (const [uid, p] of Object.entries(s.players)) {
      const sp = this.sprites.get(uid);
      if (!sp || uid === this.d.uid || p.state.team !== 'hide' || p.state.caught) continue;
      if (isVisible('seek', viewer, sp) && hit(sp.x, sp.y, sp.width, sp.height)) { target = { type: 'player', id: uid, x: sp.x, y: sp.y }; break; }
    }
    if (!target) {
      for (const d of DECOR) {
        const k = propKind(d.kind);
        if (isVisible('seek', viewer, d) && hit(d.x, d.y, k.w, k.h)) { target = { type: 'decor', id: d.id, x: d.x, y: d.y }; break; }
      }
    }
    if (!target) return;
    if (Math.hypot(target.x - this.me.x, target.y - this.me.y) > TAG_RANGE) { this.toast('더 가까이 가세요'); return; }
    pushAction(this.d.c.db, this.d.code, { uid: this.d.uid, targetType: target.type, targetId: target.id, at: now });
  }

  private toast(msg: string): void {
    this.toastEl.replaceChildren(h('div', { class: 'toast', testid: 'toast' }, msg));
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.replaceChildren(), 2200);
  }

  /** 화면 위 HTML을 다시 그릴지 판단하는 키. 위치만 바뀔 때는 다시 그리지 않는다. */
  private overlayKeyFor(s: RoomSnapshot, now: number): string {
    const st = this.myState;
    const me = s.players[this.d.uid];
    const roster = Object.entries(s.players).map(([u, p]) => `${u}:${p.profile.name}:${p.online}:${p.state.team}:${p.state.caught}:${p.state.score}`).join('|');
    return [s.meta.phase, s.meta.paused, s.meta.round, s.hostOnline, st.team, st.frozenUntil > now, me?.profile.prop, roster].join('/');
  }

  private renderOverlay(force = false): void {
    const s = this.s;
    if (this.kicked) {
      this.overlay.replaceChildren(h('div', { class: 'cover panel', testid: 'kicked' }, '선생님이 내보냈어요'));
      return;
    }
    if (!s) return;
    const now = this.d.c.serverNow();
    const key = this.overlayKeyFor(s, now);
    if (!force && key === this.overlayKey) return;
    this.overlayKey = key;
    this.timeEl = null;
    this.coverCountEl = null;

    const st = this.myState;
    const me = s.players[this.d.uid];
    const { phase, paused } = s.meta;
    const parts: Node[] = [];

    if (phase === 'lobby') parts.push(lobbyView(this.d.code, s, this.d.uid));
    if (phase === 'final') parts.push(h('div', { class: 'center' }, ranking(s)));

    if (phase === 'prep' || phase === 'seek' || phase === 'result') {
      const left = Object.values(s.players).filter((p) => p.state.team === 'hide' && !p.state.caught).length;
      this.timeEl = h('span', { class: 'time', testid: 'timer' }, `${remainingSec(s.meta, now)}초`);
      parts.push(h('div', { class: 'hud panel', testid: 'hud' },
        h('span', {}, `${s.meta.round}판 · ${PHASE_LABEL[phase]}`), this.timeEl, teamTag(st.team),
        h('span', {}, `남은 숨은 사람 ${left}`), h('span', { testid: 'my-score' }, `내 점수 ${st.score}`),
      ));
    }
    if (phase === 'prep' && st.team === 'seek' && !paused) {
      this.coverCountEl = h('span', {}, String(remainingSec(s.meta, now)));
      parts.push(h('div', { class: 'cover', style: 'background: #1e1c28', testid: 'seeker-cover' },
        h('div', {}, '🙈 눈 감고 세는 중… ', this.coverCountEl, h('small', {}, '숨는 친구들이 물건으로 변신하고 있어요'))));
    }
    if (phase === 'prep' && st.team === 'hide') {
      parts.push(h('div', { class: 'props panel' },
        ...PROP_KINDS.map((k) => h('button', {
          testid: `prop-${k.id}`, class: me?.profile.prop === k.id ? 'on' : '',
          onclick: () => { setProp(this.d.c.db, this.d.code, this.d.uid, k.id).catch(() => {}); },
        }, `${k.emoji} ${k.label}`))));
    }
    if ((phase === 'prep' || phase === 'seek') && st.team === 'wait') {
      parts.push(h('div', { class: 'toast', style: 'top: 70px' }, '이번 판은 구경해요. 다음 판부터 같이 해요!'));
    }
    if (phase === 'seek' && st.team === 'seek' && st.frozenUntil > now) {
      parts.push(h('div', { class: 'toast', style: 'top: 110px; background: var(--seek)', testid: 'frozen' }, '⏸ 2초 멈춤'));
    }
    if (phase === 'result') parts.push(h('div', { class: 'center' }, resultCard(s, this.roundStartScores)));
    if (!s.hostOnline && phase !== 'final') {
      parts.push(h('div', { class: 'cover', testid: 'host-wait' }, h('div', {}, '선생님 기다리는 중…', h('small', {}, '선생님 화면이 다시 열리면 이어서 해요'))));
    } else if (paused) {
      parts.push(h('div', { class: 'cover', testid: 'paused-cover' }, '선생님이 잠깐 멈췄어요 ✋'));
    }
    this.overlay.replaceChildren(...parts);
  }
}
