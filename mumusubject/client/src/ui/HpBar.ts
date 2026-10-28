// client/src/ui/HpBar.ts
import Phaser from 'phaser';

export interface HpBar {
  bg: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Rectangle;
  maxWidth: number;
  maxHp: number;
  isBoss?: boolean;
  label?: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text;
}

const NORMAL_W = 54;

export function makeHpBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  maxHp: number,
): HpBar {
  const bg = scene.add.rectangle(x, y, NORMAL_W, 8, 0x222222).setDepth(6);
  const bar = scene.add.rectangle(x - NORMAL_W / 2, y, NORMAL_W, 8, 0x44ff44)
    .setOrigin(0, 0.5)
    .setDepth(6);
  return { bg, bar, maxWidth: NORMAL_W, maxHp };
}

export function makeBossHpBar(
  scene: Phaser.Scene,
  maxHp: number,
  labelText: string = '👑 수학 마왕',
  labelColor: string = '#ff88ff',
): HpBar {
  const W = 220, cx = 400, cy = 55;
  const bg = scene.add.rectangle(cx, cy, W + 8, 20, 0x220022).setDepth(15);
  const bar = scene.add.rectangle(cx - W / 2, cy, W, 16, 0xee1166)
    .setOrigin(0, 0.5)
    .setDepth(16);
  const label = scene.add.text(cx, cy - 18, labelText, {
    fontSize: '14px',
    color: labelColor,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    stroke: '#000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(16);
  const hpText = scene.add.text(cx, cy, `${maxHp} / ${maxHp}`, {
    fontSize: '12px',
    color: '#ffffff',
    fontFamily: 'monospace',
  }).setOrigin(0.5).setDepth(17);

  return { bg, bar, maxWidth: W, maxHp, label, hpText, isBoss: true };
}

export function updateHpBar(hpBar: HpBar, hp: number): void {
  const ratio = Math.max(0, hp / hpBar.maxHp);
  hpBar.bar.width = hpBar.maxWidth * ratio;
  if (hpBar.isBoss) {
    hpBar.bar.setFillStyle(ratio > 0.5 ? 0xee1166 : ratio > 0.2 ? 0xff6600 : 0xff0000);
    if (hpBar.hpText) hpBar.hpText.setText(`${hp} / ${hpBar.maxHp}`);
  } else {
    hpBar.bar.setFillStyle(ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa44 : 0xff4444);
  }
}

export function destroyHpBar(hpBar: HpBar): void {
  hpBar.bg.destroy();
  hpBar.bar.destroy();
  hpBar.label?.destroy();
  hpBar.hpText?.destroy();
}
