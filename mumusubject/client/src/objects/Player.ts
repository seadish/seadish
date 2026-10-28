// client/src/objects/Player.ts
import Phaser from 'phaser';
import { playerTexKey, PLAYER_TIER_NAMES, type PlayerTexKey } from '../config/playerLevels';

export interface PlayerStats {
  level: number;
  exp: number;
  expToNext: number;
  coins: number;
  hp: number;
  maxHp: number;
}

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private currentTex: PlayerTexKey;

  constructor(scene: Phaser.Scene, x: number, y: number, level: number) {
    this.currentTex = playerTexKey(level);
    this.sprite = scene.add.sprite(x, y, this.currentTex).setDepth(5).setScale(0.8);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  set x(v: number) { this.sprite.x = v; }
  set y(v: number) { this.sprite.y = v; }

  applyLevel(scene: Phaser.Scene, level: number): string | null {
    const newTex = playerTexKey(level);
    if (newTex === this.currentTex) return null;
    this.currentTex = newTex;
    this.sprite.setTexture(newTex).setScale(0.8);
    scene.tweens.add({
      targets: this.sprite, scaleX: 0.75, scaleY: 0.75,
      duration: 200, yoyo: true, ease: 'Back.easeOut',
    });
    return PLAYER_TIER_NAMES[newTex];
  }

  flashHurt(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.sprite, alpha: 0.15,
      duration: 80, yoyo: true, repeat: 4,
    });
  }
}
