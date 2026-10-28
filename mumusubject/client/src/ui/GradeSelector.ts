// client/src/ui/GradeSelector.ts
import Phaser from 'phaser';
import { GRADES, type Grade } from '../quests/MathQuestions';

export interface GradeOption {
  grade: Grade;
  label: string;
  desc: string;
  bg: number;
  y: number;
}

const OPTIONS: GradeOption[] = [
  { grade: GRADES.G12, label: '1~2학년', desc: '20 이하 기초 사칙연산', bg: 0x1a6b2a, y: 270 },
  { grade: GRADES.G34, label: '3~4학년', desc: '구구단 & 100 이하 연산', bg: 0x1a3d7a, y: 360 },
  { grade: GRADES.G56, label: '5~6학년', desc: '큰 수 & 혼합계산',        bg: 0x6b1a1a, y: 450 },
];

export function showGradeSelector(
  scene: Phaser.Scene,
  onSelect: (grade: Grade) => void,
  onLeaderboard?: () => void,
): Phaser.GameObjects.Container {
  const ui = scene.add.container(0, 0).setDepth(50);

  ui.add(scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.78));

  ui.add(scene.add.text(400, 140, '⚔ 수학 마법사의 탑', {
    fontSize: '34px',
    color: '#FFD700',
    stroke: '#000',
    strokeThickness: 5,
    fontFamily: 'monospace',
  }).setOrigin(0.5));

  ui.add(scene.add.text(400, 188, '학년을 선택하세요', {
    fontSize: '20px',
    color: '#cccccc',
    fontFamily: 'monospace',
  }).setOrigin(0.5));

  OPTIONS.forEach(({ grade, label, desc, bg, y }) => {
    const btn = scene.add.rectangle(400, y, 340, 62, bg, 0.92)
      .setInteractive({ useHandCursor: true });
    const lbl = scene.add.text(400, y - 10, label, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const dsc = scene.add.text(400, y + 16, desc, {
      fontSize: '13px',
      color: '#bbbbbb',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout',  () => btn.setAlpha(0.92));
    btn.on('pointerdown', () => onSelect(grade));

    ui.add([btn, lbl, dsc]);
  });

  if (onLeaderboard) {
    const lbBtn = scene.add.rectangle(400, 530, 240, 38, 0x442266, 0.92)
      .setStrokeStyle(2, 0xaa66ff, 0.8)
      .setInteractive({ useHandCursor: true });
    const lbText = scene.add.text(400, 530, '🏆 우리 학급 랭킹', {
      fontSize: '16px',
      color: '#ffddff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    lbBtn.on('pointerover', () => lbBtn.setFillStyle(0x663399, 0.95));
    lbBtn.on('pointerout',  () => lbBtn.setFillStyle(0x442266, 0.92));
    lbBtn.on('pointerdown', () => onLeaderboard());

    ui.add([lbBtn, lbText]);
  }

  return ui;
}
