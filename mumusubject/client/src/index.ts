// client/src/index.ts
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MathScene from './scenes/MathScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';

function showBootError(msg: string): void {
  const root = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'inset:0', 'display:flex',
    'align-items:center', 'justify-content:center',
    'padding:20px', 'background:#111', 'color:#fff',
    'font-family:monospace,sans-serif', 'font-size:14px',
    'white-space:pre-wrap', 'text-align:center', 'z-index:9999',
  ].join(';');
  box.textContent = `⚠ 게임을 시작하지 못했어요\n\n${msg}\n\n브라우저 콘솔(F12)을 확인해주세요.`;
  root.appendChild(box);
}

window.addEventListener('error', (e) => showBootError(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showBootError(
  typeof e.reason === 'string' ? e.reason : (e.reason?.message ?? String(e.reason)),
));

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH, height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH, height: GAME_HEIGHT,
    parent: 'game', expandParent: true,
  },
  render: { pixelArt: true, antialias: false },
  scene: [BootScene, MathScene],
};

try {
  new Phaser.Game(config);
} catch (e) {
  showBootError(e instanceof Error ? e.message : String(e));
  throw e;
}
