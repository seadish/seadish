// client/src/config/rooms.ts
import type { MonsterType } from '../quests/MathQuestions';

export type RoomKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'treasure' | 'treasure2';
export type ChapterId = 1 | 2;

export interface MonsterSpawn {
  x: number;
  y: number;
  type: MonsterType | 'boss' | 'archangel';
}

export interface ExitConfig {
  x: number;
  y: number;
  radius: number;
  label: string;
}

export interface PedestalConfig {
  x: number;
  y: number;
  radius: number;
}

export interface BoundsConfig {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RoomConfig {
  bg: string;
  bgTint?: number;
  playerStart: { x: number; y: number };
  exit: ExitConfig | null;
  secretExit?: ExitConfig;
  pedestal?: PedestalConfig;
  isTreasureRoom?: boolean;
  bossRoom?: boolean;
  isFinalBoss?: boolean;
  chapter?: ChapterId;
  monsters?: MonsterSpawn[];
  /** 일반 출구로 진입할 다음 방. 보스방은 보통 미설정. */
  nextRoom?: RoomKey;
  /** 비밀 출구로 진입할 보물방. */
  secretRoom?: RoomKey;
  /** 보스 처치 후 다음 챕터로 진입할 방 (챕터1 보스 → 챕터2 첫 방). */
  chapterTransitionRoom?: RoomKey;
  /** 플레이어 이동 가능 영역. 미설정 시 PLAYER_BOUNDS 기본값. */
  playerBounds?: BoundsConfig;
  /** 몬스터 패트롤 영역. 미설정 시 PATROL_BOUNDS 기본값. */
  patrolBounds?: BoundsConfig;
}

export const ROOM_CONFIG: Record<RoomKey, RoomConfig> = {
  1: {
    bg: 'room1-bg',
    chapter: 1,
    playerStart: { x: 400, y: 380 },
    exit: { x: 400, y: 78, radius: 55, label: '마법사의 집으로 ▲' },
    nextRoom: 2,
    monsters: [
      { x: 185, y: 210, type: 'slime' },
      { x: 615, y: 210, type: 'goblin' },
      { x: 185, y: 430, type: 'slime' },
      { x: 615, y: 430, type: 'goblin' },
    ],
  },
  2: {
    bg: 'room2-bg',
    chapter: 1,
    playerStart: { x: 400, y: 480 },
    exit: { x: 68, y: 310, radius: 55, label: '숲으로 나가기 ◀' },
    secretExit: { x: 400, y: 155, radius: 70, label: '✨ 비밀의 방 ✨' },
    nextRoom: 3,
    secretRoom: 'treasure',
    monsters: [
      { x: 220, y: 300, type: 'goblin' },
      { x: 580, y: 300, type: 'orc' },
      { x: 220, y: 450, type: 'witch' },
      { x: 580, y: 450, type: 'slime' },
    ],
  },
  treasure: {
    bg: 'treasure-bg',
    chapter: 1,
    playerStart: { x: 400, y: 400 },
    exit: { x: 72, y: 300, radius: 60, label: '숲으로 ◀' },
    isTreasureRoom: true,
    pedestal: { x: 400, y: 270, radius: 55 },
    nextRoom: 3,
  },
  3: {
    bg: 'room3-bg',
    chapter: 1,
    playerStart: { x: 400, y: 520 },
    exit: { x: 400, y: 85, radius: 60, label: '숲 깊은 곳으로 ▲' },
    nextRoom: 4,
    monsters: [
      { x: 200, y: 290, type: 'skeleton' },
      { x: 600, y: 290, type: 'dragon' },
      { x: 200, y: 440, type: 'skeleton' },
      { x: 600, y: 440, type: 'dragon' },
    ],
  },
  4: {
    bg: 'room4-bg',
    bgTint: 0x4411aa,
    chapter: 1,
    playerStart: { x: 400, y: 500 },
    exit: null,
    bossRoom: true,
    chapterTransitionRoom: 5,
    monsters: [
      { x: 400, y: 240, type: 'boss' },
    ],
  },

  // ─── 챕터 2: 천공의 도시 ───────────────────────────────────
  5: {
    bg: 'room5-bg',
    chapter: 2,
    playerStart: { x: 640, y: 320 },
    exit: { x: 140, y: 320, radius: 45, label: '구름 위로 ◀' },
    nextRoom: 6,
    playerBounds: { minX: 110, maxX: 670, minY: 290, maxY: 355 },
    patrolBounds: { minX: 150, maxX: 580, minY: 300, maxY: 345 },
    monsters: [
      { x: 220, y: 310, type: 'slime' },
      { x: 380, y: 310, type: 'orc' },
      { x: 510, y: 310, type: 'goblin' },
      { x: 300, y: 345, type: 'witch' },
    ],
  },
  6: {
    bg: 'room6-bg',
    chapter: 2,
    playerStart: { x: 400, y: 230 },
    exit: { x: 650, y: 230, radius: 50, label: '천공성으로 ▶' },
    secretExit: { x: 400, y: 130, radius: 55, label: '✨ 별의 보물방 ✨' },
    nextRoom: 7,
    secretRoom: 'treasure2',
    playerBounds: { minX: 130, maxX: 670, minY: 110, maxY: 460 },
    patrolBounds: { minX: 170, maxX: 630, minY: 150, maxY: 420 },
    monsters: [
      { x: 240, y: 200, type: 'witch' },
      { x: 560, y: 200, type: 'skeleton' },
      { x: 240, y: 380, type: 'orc' },
      { x: 560, y: 380, type: 'goblin' },
    ],
  },
  treasure2: {
    bg: 'treasure2-bg',
    chapter: 2,
    playerStart: { x: 400, y: 420 },
    exit: { x: 400, y: 110, radius: 55, label: '천공성으로 ▲' },
    isTreasureRoom: true,
    pedestal: { x: 400, y: 270, radius: 55 },
    nextRoom: 7,
  },
  7: {
    bg: 'room7-bg',
    chapter: 2,
    playerStart: { x: 400, y: 520 },
    exit: { x: 400, y: 85, radius: 60, label: '하늘 신전으로 ▲' },
    nextRoom: 8,
    monsters: [
      { x: 200, y: 290, type: 'skeleton' },
      { x: 600, y: 290, type: 'dragon' },
      { x: 200, y: 440, type: 'witch' },
      { x: 600, y: 440, type: 'dragon' },
    ],
  },
  8: {
    bg: 'room8-bg',
    bgTint: 0x553388,
    chapter: 2,
    playerStart: { x: 400, y: 500 },
    exit: null,
    bossRoom: true,
    isFinalBoss: true,
    monsters: [
      { x: 400, y: 240, type: 'archangel' },
    ],
  },
};

export const ROOM_ORDER: RoomKey[] = [1, 2, 'treasure', 3, 4, 5, 6, 'treasure2', 7, 8];
