// client/src/ui/Numpad.ts
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';

export type NumpadKey = string; // '0'-'9', '⌫', '✓'
export type NumpadHandler = (key: NumpadKey) => void;

export class Numpad {
  private container: Phaser.GameObjects.Container;
  private handler: NumpadHandler | null = null;

  constructor(scene: Phaser.Scene) {
    const BW = 50, BH = 42, GAP = 5;
    const COLS = 3;
    const startX = GAME_WIDTH - (BW * COLS + GAP * (COLS - 1)) - 14;
    const startY = 360;

    const keys: NumpadKey[] = [
      '7','8','9',
      '4','5','6',
      '1','2','3',
      '⌫','0','✓',
    ];

    this.container = scene.add.container(0, 0)
      .setDepth(95)
      .setAlpha(0)
      .setScrollFactor(0)
      .setVisible(false);

    const panelW = BW * COLS + GAP * (COLS - 1) + 24;
    const panelH = BH * 4 + GAP * 3 + 24;
    this.container.add(
      scene.add.rectangle(
        startX - 12 + panelW / 2,
        startY - 12 + panelH / 2,
        panelW, panelH, 0x0d0d1e, 0.88,
      ),
    );

    keys.forEach((k, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const bx  = startX + col * (BW + GAP) + BW / 2;
      const by  = startY + row * (BH + GAP) + BH / 2;

      const isEnter = k === '✓';
      const isDel   = k === '⌫';
      const color   = isEnter ? 0x1a5c1a : isDel ? 0x5c1a1a : 0x223355;
      const border  = isEnter ? 0x44ff44 : isDel ? 0xff4444 : 0x4466aa;

      const btn = scene.add.rectangle(bx, by, BW, BH, color, 0.95)
        .setStrokeStyle(2, border, 0.8)
        .setInteractive({ useHandCursor: true });
      const lbl = scene.add.text(bx, by, k, {
        fontSize: isEnter || isDel ? '16px' : '20px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        btn.setAlpha(0.5);
        this.handler?.(k);
      });
      btn.on('pointerup',  () => btn.setAlpha(1));
      btn.on('pointerout', () => btn.setAlpha(1));

      this.container.add([btn, lbl]);
    });
  }

  setHandler(handler: NumpadHandler | null): void {
    this.handler = handler;
  }

  show(scene: Phaser.Scene): void {
    this.container.setVisible(true);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
  }

  hide(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      onComplete: () => this.container.setVisible(false),
    });
  }
}
