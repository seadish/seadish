// client/src/ui/NameTag.ts
import Phaser from 'phaser';
import { MONSTER_NAMES, type MonsterTypeOrBoss } from '../quests/MathQuestions';

export function makeNameTag(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: MonsterTypeOrBoss,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, MONSTER_NAMES[type], {
    fontSize: '11px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3,
    fontFamily: 'monospace',
  }).setOrigin(0.5).setDepth(6);
}
