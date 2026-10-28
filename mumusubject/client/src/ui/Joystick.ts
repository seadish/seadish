// client/src/ui/Joystick.ts
import Phaser from 'phaser';

const BASE_R = 52;
const KNOB_R = 26;
const MAX_D  = 40;
const BX = 110;
const BY = 500;

export class Joystick {
  active: boolean = false;
  dx: number = 0;
  dy: number = 0;
  private knob: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    scene.add.circle(BX, BY, BASE_R, 0x000000, 0.30)
      .setDepth(90)
      .setScrollFactor(0);
    scene.add.circle(BX, BY, BASE_R, 0xffffff, 0.10)
      .setDepth(90)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xffffff, 0.35);

    this.knob = scene.add.circle(BX, BY, KNOB_R, 0xffffff, 0.55)
      .setDepth(91)
      .setScrollFactor(0);

    scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const dx = ptr.x - BX, dy = ptr.y - BY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE_R * 2) {
        this.active = true;
        this._update(ptr);
      }
    });
    scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.active) return;
      this._update(ptr);
    });
    scene.input.on('pointerup', () => {
      this.active = false;
      this.dx = 0;
      this.dy = 0;
      this.knob.setPosition(BX, BY);
    });
  }

  private _update(ptr: Phaser.Input.Pointer): void {
    const dx = ptr.x - BX;
    const dy = ptr.y - BY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const clamped = Math.min(len, MAX_D);
    const nx = dx / len, ny = dy / len;
    this.knob.setPosition(BX + nx * clamped, BY + ny * clamped);
    this.dx = nx * (clamped / MAX_D);
    this.dy = ny * (clamped / MAX_D);
  }
}
