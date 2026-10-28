// client/src/scenes/BootScene.ts
// BootScene - 게임 초기화 및 텍스처 생성
// 일부 텍스처는 외부 에셋이 없어 Phaser Graphics로 직접 생성합니다.

import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // 타이틀 메인
    this.load.image('game-main', '/assets/game-main-800x600.jpg');

    // 챕터 1
    this.load.image('room1-bg', '/assets/math-bg.jpg');
    this.load.image('room2-bg', '/assets/room2-bg.jpg');
    this.load.image('room3-bg', '/assets/room3-bg.jpg');
    this.load.image('room4-bg', '/assets/room4-bg.jpg');
    this.load.image('treasure-bg', '/assets/treasure-bg.png');

    // 챕터 2 — 천공의 도시
    this.load.image('room5-bg', '/assets/room5-bg.png');
    this.load.image('room6-bg', '/assets/room6-bg.png');
    this.load.image('room7-bg', '/assets/room7-bg.png');
    this.load.image('room8-bg', '/assets/room8-bg.png');
    this.load.image('treasure2-bg', '/assets/treasure2-bg.png');

    this.load.image('hero',     '/assets/characters/hero.png');
    this.load.image('hero-lv2', '/assets/characters/hero-lv2.png');
    this.load.image('hero-lv3', '/assets/characters/hero-lv3.png');
    this.load.image('hero-lv4', '/assets/characters/hero-lv4.png');

    this.load.image('monster-slime',    '/assets/characters/monster-slime.png');
    this.load.image('monster-goblin',   '/assets/characters/monster-goblin.png');
    this.load.image('monster-orc',      '/assets/characters/monster-orc.png');
    this.load.image('monster-witch',    '/assets/characters/monster-witch.png');
    this.load.image('monster-skeleton', '/assets/characters/monster-skeleton.png');
    this.load.image('monster-dragon',   '/assets/characters/monster-dragon.png');
    this.load.image('monster-boss',     '/assets/characters/monster-boss.png');

    // 챕터 2 보스: 타락한 대천사 + 정화된 천사
    this.load.image('monster-archangel',      '/assets/characters/monster-archangel.png');
    this.load.image('monster-archangel-good', '/assets/characters/monster-archangel-good.png');
  }

  create(): void {
    console.log('🎮 mumusubject 시작 중...');
    this._makeBossGoodMonster();
    this._createDustTexture();
    this.scene.start('MathScene');
  }

  // 80/96 → 128×128 업스케일 (실제 에셋 교체 시 스케일 동일하게 유지)
  private _finalize(tmpKey: string, finalKey: string, srcSize: number): void {
    const scale = 128 / srcSize;
    const img = this.add.image(0, 0, tmpKey).setOrigin(0, 0).setScale(scale);
    const rt  = this.add.renderTexture(0, 0, 128, 128);
    rt.draw(img, 0, 0);
    rt.saveTexture(finalKey);
    img.destroy();
    rt.destroy();
    this.textures.remove(tmpKey);
  }

  // 착한 보스 — 황금 매스 킹 (변신 후, 96×96)
  private _makeBossGoodMonster(): void {
    const g = this.add.graphics();

    g.fillStyle(0xffdd44, 0.25);
    g.fillCircle(32, 38, 34);

    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(32, 63, 56, 13);

    g.fillStyle(0xff8800, 0.5);
    g.fillTriangle(6, 46, 20, 30, 22, 52);
    g.fillTriangle(58, 46, 44, 30, 42, 52);
    g.fillStyle(0xffcc44, 0.35);
    g.fillTriangle(8, 46, 20, 32, 21, 50);
    g.fillTriangle(56, 46, 44, 32, 43, 50);

    g.fillStyle(0x885500);
    g.fillCircle(32, 44, 28);
    g.fillStyle(0xcc8800);
    g.fillCircle(34, 45, 26);
    g.fillStyle(0xffaa00);
    g.fillCircle(30, 42, 24);
    g.fillStyle(0xffdd66);
    g.fillEllipse(23, 34, 20, 13);
    g.fillStyle(0xffee99, 0.55);
    g.fillEllipse(20, 31, 10, 7);

    g.fillStyle(0xffffcc, 0.78);
    g.fillEllipse(32, 5, 34, 11);
    g.fillStyle(0xffaa00);
    g.fillEllipse(32, 5, 24, 6);

    g.fillStyle(0xcc6600);
    g.fillRect(15, 17, 34, 9);
    g.fillStyle(0xff8800);
    g.fillRect(16, 18, 32, 7);
    g.fillStyle(0xffcc44);
    g.fillRect(17, 18, 30, 4);

    g.fillStyle(0xcc6600);
    g.fillTriangle(16, 26, 18, 10, 22, 26);
    g.fillTriangle(22, 26, 25, 13, 28, 26);
    g.fillTriangle(28, 26, 32, 4,  36, 26);
    g.fillTriangle(36, 26, 39, 13, 42, 26);
    g.fillTriangle(42, 26, 46, 10, 48, 26);
    g.fillStyle(0xffaa33);
    g.fillTriangle(17, 26, 19, 12, 21, 26);
    g.fillTriangle(29, 26, 32, 6,  35, 26);
    g.fillTriangle(43, 26, 47, 12, 47, 26);

    g.fillStyle(0xff44aa);
    g.fillCircle(19, 21, 3);
    g.fillStyle(0x44ffcc);
    g.fillCircle(32, 21, 3.5);
    g.fillStyle(0xff44aa);
    g.fillCircle(45, 21, 3);
    g.fillStyle(0xffffff, 0.65);
    g.fillCircle(18, 20, 1.3);
    g.fillCircle(31, 20, 1.5);
    g.fillCircle(44, 20, 1.3);

    g.fillStyle(0xff9999, 0.5);
    g.fillCircle(15, 47, 8);
    g.fillCircle(49, 47, 8);

    g.fillStyle(0x664400);
    g.fillEllipse(23, 42, 13, 8);
    g.fillEllipse(41, 42, 13, 8);
    g.fillStyle(0xffaa00);
    g.fillEllipse(23, 39, 15, 8);
    g.fillEllipse(41, 39, 15, 8);

    g.fillStyle(0x664400);
    g.fillEllipse(32, 54, 22, 13);
    g.fillStyle(0xffaa00);
    g.fillEllipse(32, 49, 24, 13);
    g.fillStyle(0xffffff);
    g.fillRect(24, 52, 16, 5);
    g.fillStyle(0xffaa00);
    g.fillRect(25, 52, 2, 2);
    g.fillRect(29, 52, 2, 2);
    g.fillRect(33, 52, 2, 2);
    g.fillRect(37, 52, 2, 2);

    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(6, 13, 3.5);
    g.fillCircle(58, 13, 3.5);
    g.fillCircle(4, 55, 2.5);
    g.fillCircle(60, 55, 2.5);
    g.fillStyle(0xffee88, 0.7);
    g.fillCircle(6, 13, 2);
    g.fillCircle(58, 13, 2);

    g.generateTexture('_tmp_boss_good', 96, 96);
    g.destroy();
    this._finalize('_tmp_boss_good', 'monster-boss-good', 96);
  }

  private _createDustTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xaaaacc, 0.6);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dust', 8, 8);
    g.destroy();
  }
}
