// client/src/utils/effects.ts
import Phaser from 'phaser';

export function floatText(
  scene: Phaser.Scene, x: number, y: number,
  text: string, color: string = '#ffffff', fontSize: number = 26,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontSize: `${fontSize}px`, color,
    stroke: '#000000', strokeThickness: 4,
    fontFamily: 'monospace',
  }).setOrigin(0.5).setDepth(30);
  scene.tweens.add({
    targets: t, y: y - 65, alpha: 0,
    duration: 1600, ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
  return t;
}

export function showExpBurst(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  for (let i = 0; i < 6; i++) {
    const ox = (Math.random() - 0.5) * 70;
    const oy = (Math.random() - 0.5) * 40;
    const t = scene.add.text(x + ox, y + oy, `+${amount} EXP`, {
      fontSize: '13px', color: '#FFD700',
      stroke: '#000', strokeThickness: 2, fontFamily: 'monospace',
    }).setDepth(28);
    scene.tweens.add({
      targets: t, y: t.y - 35, alpha: 0,
      duration: 900, delay: i * 90,
      onComplete: () => t.destroy(),
    });
  }
}

export function hitShake(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite): void {
  const ox = target.x;
  scene.tweens.add({
    targets: target, x: ox + 6,
    duration: 45, yoyo: true, repeat: 3,
    onComplete: () => { target.x = ox; },
  });
}

export function createDustEmitter(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(400, 300, 'dust', {
    x: { min: -380, max: 380 }, y: { min: -270, max: 270 },
    lifespan: 3500,
    speedX: { min: -8, max: 8 }, speedY: { min: -8, max: 8 },
    scale: { start: 0.15, end: 0 },
    alpha: { start: 0.35, end: 0 },
    frequency: 300,
  });
}
