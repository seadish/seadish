// client/src/ui/EndScreens.ts
import Phaser from 'phaser';
import type { PlayerStats } from '../objects/Player';

function formatCoins(coins: number): string {
  return (Math.round(coins * 10) / 10).toFixed(1);
}

export function showGameOver(
  scene: Phaser.Scene,
  stats: PlayerStats,
  onRetry: () => void,
): void {
  scene.cameras.main.shake(500, 0.025);
  scene.cameras.main.fadeOut(700, 30, 0, 0);

  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.cameras.main.fadeIn(900);

    scene.add.rectangle(400, 300, 800, 600, 0x110000, 0.85).setDepth(100);

    scene.add.text(400, 155, '💀  GAME OVER', {
      fontSize: '52px', color: '#ff2222',
      stroke: '#000', strokeThickness: 7,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    scene.add.text(400, 245, '몬스터에게 쓰러졌다...', {
      fontSize: '24px', color: '#ff8888',
      stroke: '#000', strokeThickness: 4,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);

    scene.add.text(400, 308, `최고 레벨 : Lv.${stats.level}`, {
      fontSize: '20px', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);

    scene.add.text(400, 355, `획득 디스코인 : ${formatCoins(stats.coins)} DC`, {
      fontSize: '20px', color: '#FFD700',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);

    const retryBtn = scene.add.text(400, 440, '[ 다시 도전하기 ]', {
      fontSize: '22px', color: '#aaddff',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    scene.tweens.add({
      targets: retryBtn, alpha: 0.3,
      duration: 700, yoyo: true, repeat: -1,
    });

    retryBtn.on('pointerdown', onRetry);
  });
}

export function showGameClear(
  scene: Phaser.Scene,
  stats: PlayerStats,
  bgImg: Phaser.GameObjects.Image | null,
  onRestart: () => void,
): void {
  scene.cameras.main.shake(600, 0.022);

  scene.time.delayedCall(900, () => {
    scene.cameras.main.fadeOut(800, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      bgImg?.clearTint();
      scene.cameras.main.fadeIn(1200);

      scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.45).setDepth(100);

      scene.time.delayedCall(400, () => {
        scene.add.text(400, 130, '★ GAME CLEAR! ★', {
          fontSize: '52px', color: '#FFD700',
          stroke: '#000', strokeThickness: 6,
          fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(101);

        scene.add.text(400, 215, '수학 마왕을 물리쳤다!', {
          fontSize: '28px', color: '#ff88ff',
          stroke: '#000', strokeThickness: 4,
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(101);

        scene.add.text(400, 295, `최종 레벨 : Lv.${stats.level}`, {
          fontSize: '24px', color: '#ffffff',
          stroke: '#000', strokeThickness: 3,
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(101);

        scene.add.text(400, 345, `누적 디스코인 : ${formatCoins(stats.coins)} DC`, {
          fontSize: '24px', color: '#FFD700',
          stroke: '#000', strokeThickness: 3,
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(101);

        const restartBtn = scene.add.text(400, 440, '[ 클릭하면 처음부터 다시 시작 ]', {
          fontSize: '17px', color: '#aaddff',
          stroke: '#000', strokeThickness: 3,
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

        scene.tweens.add({
          targets: restartBtn, alpha: 0.3,
          duration: 700, yoyo: true, repeat: -1,
        });

        restartBtn.on('pointerdown', onRestart);
      });
    });
  });
}
