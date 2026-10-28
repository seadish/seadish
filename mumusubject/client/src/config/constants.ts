// client/src/config/constants.ts
export const PLAYER_SPEED = 3;
export const SELECT_RADIUS = 85;
export const ESCAPE_EXIT_BUFFER = 15;
export const EXP_PER_KILL = 20;
export const COIN_PER_HIT = 0.1;
export const SPEED_BONUS_THRESHOLD_SEC = 5;
export const SPEED_BONUS_AMOUNT = 0.2;
export const COMBO_BONUS_PER_THREE = 0.1;
export const EXP_LEVEL_GROWTH = 1.6;

export const MONSTER_HP_DEFAULT = 3;
export const BOSS_HP = 5;

export const MAX_ANSWER_LEN = 5;

export const PLAYER_BOUNDS = { minX: 50, maxX: 750, minY: 105, maxY: 555 } as const;
export const PATROL_BOUNDS = { minX: 100, maxX: 700, minY: 120, maxY: 500 } as const;

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
