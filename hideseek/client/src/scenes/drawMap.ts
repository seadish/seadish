// 학생 화면과 교사 화면이 같이 쓰는 맵·사물·사람 그리기
import Phaser from 'phaser';
import { AREAS, DECOR, MAP_H, MAP_W, WALLS, propKind } from '../game/map';

const AREA_COLORS: Record<string, number> = { 교실1: 0xfbe7c6, 교실2: 0xe8f0d6, 복도: 0xe7e1f0, 도서관: 0xd8ebf1 };
const PROP_COLORS: Record<string, number> = {
  desk: 0xc89b6d, chair: 0xd9b48c, locker: 0x8fa3b8, plant: 0xa7d3a0, trash: 0xb7b7b7, bookshelf: 0xa0785a,
  globe: 0x9cc7e6, umbrella: 0xe6a0b4, extinguisher: 0xe07a6a, mopbox: 0xb9a6d6, books: 0xe8cf8f, water: 0xa6dbe0,
};

export function drawFloor(scene: Phaser.Scene): void {
  // 매 프레임 다시 그리지 않도록 한 번만 텍스처로 구워 둔다.
  if (!scene.textures.exists('floor')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xd8cdb8).fillRect(0, 0, MAP_W, MAP_H);
    for (const a of AREAS) g.fillStyle(AREA_COLORS[a.label] ?? 0xffffff).fillRect(a.x, a.y, a.w, a.h);
    g.fillStyle(0x5b4a3a);
    for (const w of WALLS) g.fillRect(w.x, w.y, w.w, w.h);
    g.generateTexture('floor', MAP_W, MAP_H);
    g.destroy();
  }
  scene.add.image(0, 0, 'floor').setOrigin(0).setDepth(-10);
  for (const a of AREAS) {
    scene.add.text(a.x + a.w / 2, a.y + a.h / 2, a.label, { fontSize: '64px', fontStyle: 'bold', color: '#00000012' })
      .setOrigin(0.5).setDepth(-9);
  }
}

function propTexture(scene: Phaser.Scene, kindId: string): string {
  const k = propKind(kindId);
  const key = `prop-${k.id}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(PROP_COLORS[k.id] ?? 0xcccccc).fillRoundedRect(1, 1, k.w, k.h, 6);
  g.lineStyle(2, 0x000000, 0.2).strokeRoundedRect(1, 1, k.w, k.h, 6);
  const t = scene.make.text({ x: k.w / 2 + 1, y: k.h / 2 + 1, text: k.emoji, style: { fontSize: `${Math.round(Math.min(k.w, k.h) * 0.7)}px` } }, false)
    .setOrigin(0.5);
  const rt = scene.make.renderTexture({ width: k.w + 2, height: k.h + 2 }, false);
  rt.draw(g).draw(t);
  rt.saveTexture(key);
  g.destroy();
  t.destroy();
  return key;
}

/** 사물 하나. 숨은 학생도 똑같은 모양으로 그려서 원래 사물과 구별되지 않게 한다. */
export function makeProp(scene: Phaser.Scene, kindId: string): Phaser.GameObjects.Container {
  const k = propKind(kindId);
  return scene.add.container(0, 0, [scene.add.image(0, 0, propTexture(scene, kindId))]).setSize(k.w, k.h);
}

/** 술래 시야: 가운데만 뚫린 어두운 그림. 한 번 만들어 크게 늘려 쓴다. */
export function makeFog(scene: Phaser.Scene, visionRadius: number): Phaser.GameObjects.Image {
  const SIZE = 512;
  const HOLE = 32;
  if (!scene.textures.exists('fog')) {
    const tex = scene.textures.createCanvas('fog', SIZE, SIZE)!;
    const ctx = tex.getContext();
    ctx.fillStyle = 'rgba(21, 19, 28, 0.9)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, HOLE * 0.8, SIZE / 2, SIZE / 2, HOLE);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    tex.refresh();
  }
  return scene.add.image(0, 0, 'fog').setScale(visionRadius / HOLE).setDepth(20_000).setVisible(false);
}

export function makePerson(scene: Phaser.Scene, color: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(color).fillCircle(0, 0, 15);
  g.lineStyle(3, 0xffffff).strokeCircle(0, 0, 15);
  const t = scene.add.text(0, 0, '🙂', { fontSize: '18px' }).setOrigin(0.5);
  return scene.add.container(0, 0, [g, t]).setSize(30, 30);
}

export function makeLabel(scene: Phaser.Scene, text: string, color = '#2b2a33'): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, text, {
    fontSize: '14px', fontStyle: 'bold', color, backgroundColor: '#ffffffcc', padding: { x: 4, y: 1 },
  }).setOrigin(0.5, 1);
}

export function drawDecor(scene: Phaser.Scene): Map<string, Phaser.GameObjects.Container> {
  const out = new Map<string, Phaser.GameObjects.Container>();
  for (const d of DECOR) out.set(d.id, makeProp(scene, d.kind).setPosition(d.x, d.y).setDepth(d.y));
  return out;
}

export const SEEK_COLOR = 0xe2583e;
export const HIDE_COLOR = 0x2f8f6b;
