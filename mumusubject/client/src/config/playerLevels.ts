// client/src/config/playerLevels.ts
export type PlayerTexKey = 'hero' | 'hero-lv2' | 'hero-lv3' | 'hero-lv4';

export function playerTexKey(level: number): PlayerTexKey {
  if (level <= 2) return 'hero';
  if (level <= 4) return 'hero-lv2';
  if (level <= 6) return 'hero-lv3';
  return 'hero-lv4';
}

export const PLAYER_TIER_NAMES: Record<PlayerTexKey, string> = {
  'hero':     '견습 마법사',
  'hero-lv2': '숙련 마법사',
  'hero-lv3': '고급 마법사',
  'hero-lv4': '전설 마법사',
};
