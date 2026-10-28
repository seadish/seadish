// client/src/objects/Monster.ts
import Phaser from 'phaser';
import {
  type MonsterTypeOrBoss,
  type Question,
  type MathQuestionGenerator,
} from '../quests/MathQuestions';
import { type HpBar, makeHpBar, makeBossHpBar, destroyHpBar } from '../ui/HpBar';
import { makeNameTag } from '../ui/NameTag';
import { MONSTER_HP_DEFAULT, BOSS_HP, PATROL_BOUNDS } from '../config/constants';
import type { BoundsConfig } from '../config/rooms';

export interface MonsterInit {
  scene: Phaser.Scene;
  x: number;
  y: number;
  type: MonsterTypeOrBoss;
  generator: MathQuestionGenerator;
  isBoss?: boolean;
  patrolBounds?: BoundsConfig;
}

export class Monster {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly type: MonsterTypeOrBoss;
  readonly isBoss: boolean;
  readonly maxHp: number;
  readonly nameTag: Phaser.GameObjects.Text;
  readonly hpBar: HpBar;
  readonly homeX: number;
  readonly homeY: number;
  readonly bobOffset: number;

  hp: number;
  alive: boolean = true;
  problem: Question;
  patrolX: number;
  patrolY: number;

  private generator: MathQuestionGenerator;
  private patrolBounds: BoundsConfig;

  constructor(init: MonsterInit) {
    const { scene, x, y, type, generator, isBoss = false, patrolBounds } = init;
    this.type = type;
    this.isBoss = isBoss;
    this.maxHp = isBoss ? BOSS_HP : MONSTER_HP_DEFAULT;
    this.hp = this.maxHp;
    this.homeX = x;
    this.homeY = y;
    this.patrolX = x;
    this.patrolY = y;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.generator = generator;
    this.patrolBounds = patrolBounds ?? PATROL_BOUNDS;

    const spriteScale = isBoss
      ? (type === 'archangel' ? 0.5 : 0.75)
      : 0.50;
    this.sprite = scene.add.sprite(x, y, `monster-${type}`)
      .setDepth(4)
      .setScale(spriteScale);

    this.problem = generator.generate(type);

    if (isBoss) {
      const isArchangel = type === 'archangel';
      this.hpBar = makeBossHpBar(
        scene,
        this.maxHp,
        isArchangel ? '👼 타락한 대천사' : '👑 수학 마왕',
        isArchangel ? '#aaccff' : '#ff88ff',
      );
    } else {
      this.hpBar = makeHpBar(scene, x, y - 60, this.maxHp);
    }
    this.nameTag = makeNameTag(scene, x, y + (isBoss ? 72 : 56), type);
  }

  pickNewPatrolTarget(): void {
    if (this.isBoss) return;
    this.patrolX = Phaser.Math.Clamp(
      this.homeX + (Math.random() - 0.5) * 80,
      this.patrolBounds.minX,
      this.patrolBounds.maxX,
    );
    this.patrolY = Phaser.Math.Clamp(
      this.homeY + (Math.random() - 0.5) * 50,
      this.patrolBounds.minY,
      this.patrolBounds.maxY,
    );
  }

  /** 매 프레임 위치 / HP바 / 이름표 동기화 */
  syncPosition(now: number, selected: boolean): void {
    const bob = Math.sin(now * 0.0026 + this.bobOffset) * 7;

    if (this.isBoss) {
      this.sprite.x = this.homeX;
      this.sprite.y = this.homeY + bob;
      this.nameTag.setPosition(this.sprite.x, this.sprite.y + 50);
      return;
    }

    if (!selected) {
      this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.patrolX, 0.016);
    }
    this.sprite.y = (selected ? this.homeY : this.patrolY) + bob;

    const sx = this.sprite.x, sy = this.sprite.y;
    this.hpBar.bg.setPosition(sx, sy - 52);
    this.hpBar.bar.setPosition(sx - this.hpBar.maxWidth / 2, sy - 52);
    this.nameTag.setPosition(sx, sy + 50);
  }

  generateNextProblem(): void {
    this.problem = this.generator.generate(this.type);
  }

  destroyMeta(): void {
    destroyHpBar(this.hpBar);
    this.nameTag.destroy();
  }
}
