import Phaser from 'phaser';
import { hostPresence, leaveToEntry, onActions, subscribeRoom } from '../net/room';
import type { RoomSnapshot } from '../game/types';
import { MAP_H, MAP_W } from '../game/map';
import { remainingSec, seesWobble } from '../game/view';
import { Referee, roomPort } from '../host/referee';
import { startTicker } from '../host/ticker';
import { drawDecor, drawFloor } from './drawMap';
import { PlayerSprite } from './playerSprites';
import type { GameData } from './StudentScene';
import { h, mount } from '../ui/dom';
import { PHASE_LABEL, ranking, teamTag } from '../ui/hud';

const PANEL_W = 340;
const TICK_MS = 250;

export class HostScene extends Phaser.Scene {
  private d!: GameData;
  private s: RoomSnapshot | null = null;
  private referee!: Referee;
  private sprites = new Map<string, PlayerSprite>();
  private panel = h('div');
  private stage = h('div');
  private timeEl: HTMLElement | null = null;
  private panelKey = '';
  private message = '';

  constructor() { super('host'); }

  create(data: GameData): void {
    this.d = data;
    const { db } = data.c;
    drawFloor(this);
    drawDecor(this);
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    mount(this.stage, this.panel);

    this.referee = new Referee(roomPort(db, data.code), () => data.c.serverNow());
    const offRoom = subscribeRoom(db, data.code, (s) => {
      this.referee.onSnapshot(s);
      this.s = s;
      this.renderPanel();
    });
    const offActions = onActions(db, data.code, (id, a) => this.referee.onAction(id, a));
    const offPresence = hostPresence(db, data.code);
    // 탭이 뒤에 있어도 돌아가도록 Phaser 루프가 아니라 별도 타이머로 심판을 돌린다.
    const stopTicker = startTicker(() => this.referee.tick(), TICK_MS);
    this.events.once('shutdown', () => { offRoom(); offActions(); offPresence(); stopTicker(); });

    if (import.meta.env.VITE_USE_EMULATOR === '1') {
      (window as any).__hs = { uid: data.uid, code: data.code, snapshot: () => this.s };
    }
  }

  private fitCamera(): void {
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    const w = Math.max(200, width - PANEL_W);
    cam.setViewport(0, 0, w, height);
    cam.setZoom(Math.min(w / MAP_W, height / MAP_H) * 0.98);
    cam.centerOn(MAP_W / 2, MAP_H / 2);
  }

  update(time: number): void {
    const s = this.s;
    if (!s) return;
    if (this.timeEl) this.timeEl.textContent = `${remainingSec(s.meta, this.d.c.serverNow())}초`;
    for (const [uid, sp] of this.sprites) if (!s.players[uid]) { sp.destroy(); this.sprites.delete(uid); }
    for (const [uid, p] of Object.entries(s.players)) {
      let sp = this.sprites.get(uid);
      if (!sp) { sp = new PlayerSprite(this, p.profile.name, false, 1.8); this.sprites.set(uid, sp); } // 축소된 맵에서도 읽히게
      const pos = s.pos[uid];
      if (!pos || p.state.team === 'wait' || s.meta.phase === 'lobby') { sp.draw({ visible: false, showName: false, wobble: 0 }); continue; }
      const disguised = p.state.team === 'hide';
      sp.setLook(disguised ? { mode: 'prop', kind: p.profile.prop ?? 'desk' } : { mode: 'person', team: 'seek' });
      sp.moveToward(pos.x, pos.y, false);
      const wobble = disguised && pos.moving && seesWobble('host') ? Math.sin((time / 1000) * Math.PI * 2 * 8) * 2 : 0;
      sp.draw({ visible: true, showName: true, wobble });
    }
  }

  private run(fn: () => string | void): void {
    this.message = fn() ?? '';
    this.panelKey = '';
    this.renderPanel();
  }

  private renderPanel(): void {
    const s = this.s;
    if (!s) return;
    const { meta } = s;
    const players = Object.entries(s.players).sort(([, a], [, b]) => b.state.score - a.state.score);
    const key = [meta.phase, meta.paused, meta.round, this.message,
      players.map(([u, p]) => `${u}:${p.profile.name}:${p.online}:${p.state.team}:${p.state.caught}:${p.state.score}`).join('|')].join('/');
    if (key === this.panelKey) return;
    this.panelKey = key;

    const playing = meta.phase === 'prep' || meta.phase === 'seek';
    const ref = this.referee;
    this.timeEl = h('span', { testid: 'host-timer' }, '');
    const buttons = h('div', { class: 'btns' },
      meta.phase === 'lobby' && h('button', {
        testid: 'start-btn',
        onclick: () => this.run(() => (ref.startRound() === 'need-players' ? '학생이 2명 이상 있어야 해요' : '')),
      }, meta.round === 0 ? '▶ 판 시작' : '▶ 다음 판'),
      playing && h('button', { testid: 'pause-btn', onclick: () => this.run(() => (meta.paused ? ref.resume() : ref.pause())) },
        meta.paused ? '▶ 재개' : '⏸ 일시정지'),
      playing && h('button', { testid: 'end-btn', class: 'danger', onclick: () => this.run(() => ref.forceEnd()) }, '⏹ 판 끝내기'),
      meta.phase === 'lobby' && meta.round >= 1 && h('button', { testid: 'final-btn', class: 'ghost', onclick: () => this.run(() => ref.showFinal()) }, '🏆 최종 순위'),
      (meta.phase === 'lobby' || meta.phase === 'final') && h('button', {
        testid: 'new-room-btn', class: 'ghost',
        onclick: () => { if (window.confirm('이 방을 닫고 새 방을 만들까요? 점수는 처음부터 시작해요.')) leaveToEntry(); },
      }, '새 방 만들기'),
    );

    this.panel.replaceChildren(h('div', { class: 'side panel', testid: 'host-panel' },
      h('div', { style: 'text-align:center; color: var(--muted)' }, '방 코드'),
      h('div', { class: 'code', testid: 'host-room-code' }, this.d.code),
      h('div', { class: 'status', testid: 'host-status' },
        meta.round > 0 ? `${meta.round}판 · ` : '', PHASE_LABEL[meta.phase], meta.paused ? ' (멈춤)' : '', ' ',
        playing || meta.phase === 'result' ? this.timeEl : ''),
      buttons,
      h('div', { class: 'error', testid: 'host-message' }, this.message),
      h('table', { testid: 'student-list' },
        h('tr', {}, h('th', {}, '이름'), h('th', {}, '편'), h('th', {}, '점수'), h('th', {}, '')),
        ...players.map(([uid, p]) => h('tr', { 'data-uid': uid },
          h('td', {}, h('span', { class: `dot ${p.online ? '' : 'off'}` }), p.profile.name),
          h('td', {}, meta.round > 0 ? teamTag(p.state.team) : ''),
          h('td', {}, String(p.state.score)),
          h('td', {}, h('button', {
            testid: `kick-${uid}`,
            onclick: () => { if (window.confirm(`${p.profile.name} 학생을 내보낼까요?`)) this.run(() => ref.kick(uid)); },
          }, '내보내기')),
        ))),
      h('div', { style: 'color: var(--muted); font-size: 14px' }, `학생 ${players.length}/7명 · 이름표가 붙은 물건이 숨은 학생이에요`),
    ));
    this.stage.replaceChildren(meta.phase === 'final'
      ? h('div', { class: 'center', style: `right: ${PANEL_W}px` }, ranking(s))
      : '');
  }
}
