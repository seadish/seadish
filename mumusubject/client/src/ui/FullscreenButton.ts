// client/src/ui/FullscreenButton.ts
import Phaser from 'phaser';

const SIZE = 36;
const MARGIN = 8;

export function addFullscreenButton(scene: Phaser.Scene): void {
  const x = MARGIN + SIZE / 2;
  const y = MARGIN + SIZE / 2;

  const bg = scene.add.rectangle(x, y, SIZE, SIZE, 0x000000, 0.45)
    .setDepth(99)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  const icon = scene.add.text(x, y, '⛶', {
    fontSize: '20px',
    color: '#ffffff',
  }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

  bg.on('pointerdown', () => {
    if (scene.scale.isFullscreen) {
      scene.scale.stopFullscreen();
      icon.setText('⛶');
    } else {
      scene.scale.startFullscreen();
      icon.setText('✕');
    }
  });
  bg.on('pointerover', () => bg.setAlpha(0.75));
  bg.on('pointerout',  () => bg.setAlpha(0.45));
}
