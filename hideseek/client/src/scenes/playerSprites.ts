// 학생 한 명의 화면 표시(사물 모양 또는 사람 모양 + 이름표). 모양이 바뀔 때만 다시 만든다.
import Phaser from 'phaser';
import { HIDE_COLOR, SEEK_COLOR, makeLabel, makePerson, makeProp } from './drawMap';
import { propKind } from '../game/map';

export type Look = { mode: 'prop'; kind: string } | { mode: 'person'; team: 'seek' | 'hide' };

export class PlayerSprite {
  private body: Phaser.GameObjects.Container | null = null;
  private lookKey = '';
  readonly label: Phaser.GameObjects.Text;
  x = 0;
  y = 0;
  private placed = false;

  constructor(private scene: Phaser.Scene, name: string, private highlight = false) {
    this.label = makeLabel(scene, name, highlight ? '#3a6ff7' : '#2b2a33');
  }

  setLook(look: Look): void {
    const key = look.mode === 'prop' ? `p:${look.kind}` : `h:${look.team}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.body?.destroy();
    this.body = look.mode === 'prop'
      ? makeProp(this.scene, look.kind)
      : makePerson(this.scene, look.team === 'seek' ? SEEK_COLOR : HIDE_COLOR);
    if (this.highlight) {
      const ring = this.scene.add.graphics();
      const r = look.mode === 'prop' ? Math.max(propKind(look.kind).w, propKind(look.kind).h) / 2 + 6 : 20;
      ring.lineStyle(3, 0x3a6ff7, 0.9).strokeCircle(0, 0, r);
      this.body.add(ring);
    }
  }

  /** 목표 위치로 부드럽게 따라간다(다른 학생). snap이면 바로 이동(나 자신). */
  moveToward(x: number, y: number, snap: boolean): void {
    if (snap || !this.placed) { this.x = x; this.y = y; this.placed = true; return; }
    this.x += (x - this.x) * 0.35;
    this.y += (y - this.y) * 0.35;
  }

  draw(opts: { visible: boolean; showName: boolean; wobble: number }): void {
    if (!this.body) { this.label.setVisible(false); return; }
    this.body.setVisible(opts.visible).setPosition(this.x + opts.wobble, this.y).setDepth(this.y);
    const h = this.body.height;
    this.label.setVisible(opts.visible && opts.showName).setPosition(this.x, this.y - h / 2 - 4).setDepth(10_000);
  }

  get height(): number { return this.body?.height ?? 30; }
  get width(): number { return this.body?.width ?? 30; }

  destroy(): void { this.body?.destroy(); this.label.destroy(); }
}
