// client/src/ui/ModeSelectScreen.ts
import Phaser from 'phaser';

export type PlayMode = 'single' | 'multi';

export function showModeSelect(
  scene: Phaser.Scene,
  onSelect: (mode: PlayMode) => void,
): Phaser.GameObjects.Container {
  const ui = scene.add.container(0, 0).setDepth(55);
  ui.add(scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.82));

  ui.add(scene.add.text(400, 100, '⚔ 모드 선택 ⚔', {
    fontSize: '32px', color: '#FFD700',
    stroke: '#000', strokeThickness: 5,
    fontFamily: 'monospace', fontStyle: 'bold',
  }).setOrigin(0.5));

  ui.add(scene.add.rectangle(400, 200, 580, 92, 0x0d0d22, 0.95).setStrokeStyle(3, 0xFFD700, 0.9));
  ui.add(scene.add.text(400, 178, '💰 디스코인은 챕터 보스를 잡아야 적립돼요!', {
    fontSize: '18px', color: '#FFD700', fontFamily: 'monospace', fontStyle: 'bold',
  }).setOrigin(0.5));
  ui.add(scene.add.text(400, 210, '중간에 그만두면 그 챕터에서 모은 코인은 사라져요.', {
    fontSize: '13px', color: '#ccccdd', fontFamily: 'monospace',
  }).setOrigin(0.5));
  ui.add(scene.add.text(400, 230, '챕터 1 보스 / 챕터 2 보스를 처치하면 누적!', {
    fontSize: '13px', color: '#aaddff', fontFamily: 'monospace',
  }).setOrigin(0.5));

  const singleBg = scene.add.rectangle(400, 330, 360, 78, 0x1a6b2a, 0.95)
    .setStrokeStyle(3, 0x44ff88, 0.9)
    .setInteractive({ useHandCursor: true });
  ui.add(singleBg);
  ui.add(scene.add.text(400, 318, '🎮 싱글 플레이', {
    fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
  }).setOrigin(0.5));
  ui.add(scene.add.text(400, 348, '혼자서 처음부터 끝까지', {
    fontSize: '13px', color: '#bbeebb', fontFamily: 'monospace',
  }).setOrigin(0.5));

  singleBg.on('pointerover', () => singleBg.setAlpha(1));
  singleBg.on('pointerout',  () => singleBg.setAlpha(0.95));
  singleBg.on('pointerdown', () => { ui.destroy(true); onSelect('single'); });

  return ui;
}
