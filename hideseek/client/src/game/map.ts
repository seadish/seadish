// 학교 한 층: 위쪽 교실1·교실2, 가운데 복도, 아래 도서관. 판마다 같은 맵이어야 하므로 손으로 적은 상수.
export const MAP_W = 1600;
export const MAP_H = 960;
export const TILE = 32;

export interface PropKind { id: string; label: string; emoji: string; w: number; h: number }
export interface Decor { id: string; kind: string; x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const PROP_KINDS: PropKind[] = [
  { id: 'desk', label: '책상', emoji: '🟫', w: 56, h: 40 },
  { id: 'chair', label: '의자', emoji: '🪑', w: 32, h: 32 },
  { id: 'locker', label: '사물함', emoji: '🗄️', w: 40, h: 56 },
  { id: 'plant', label: '화분', emoji: '🪴', w: 32, h: 40 },
  { id: 'trash', label: '쓰레기통', emoji: '🗑️', w: 28, h: 32 },
  { id: 'bookshelf', label: '책장', emoji: '📚', w: 72, h: 36 },
  { id: 'globe', label: '지구본', emoji: '🌍', w: 32, h: 36 },
  { id: 'umbrella', label: '우산꽂이', emoji: '☂️', w: 28, h: 40 },
  { id: 'extinguisher', label: '소화기', emoji: '🧯', w: 24, h: 40 },
  { id: 'mopbox', label: '청소도구함', emoji: '🧹', w: 40, h: 56 },
  { id: 'books', label: '책 더미', emoji: '📖', w: 36, h: 28 },
  { id: 'water', label: '정수기', emoji: '🚰', w: 32, h: 48 },
];

export function propKind(id: string): PropKind {
  return PROP_KINDS.find((k) => k.id === id) ?? PROP_KINDS[0];
}

const T = 16; // 벽 두께
export const WALLS: Rect[] = [
  { x: 0, y: 0, w: MAP_W, h: T },
  { x: 0, y: MAP_H - T, w: MAP_W, h: T },
  { x: 0, y: 0, w: T, h: MAP_H },
  { x: MAP_W - T, y: 0, w: T, h: MAP_H },
  // 교실 | 복도 (문: x 320~416, 1120~1216)
  { x: 0, y: 408, w: 320, h: T },
  { x: 416, y: 408, w: 704, h: T },
  { x: 1216, y: 408, w: 384, h: T },
  // 복도 | 도서관 (문: x 400~496, 1100~1196)
  { x: 0, y: 576, w: 400, h: T },
  { x: 496, y: 576, w: 604, h: T },
  { x: 1196, y: 576, w: 404, h: T },
  // 교실1 | 교실2
  { x: 792, y: 0, w: T, h: 408 },
];

export const AREAS: (Rect & { label: string })[] = [
  { label: '교실1', x: 16, y: 16, w: 776, h: 392 },
  { label: '교실2', x: 808, y: 16, w: 776, h: 392 },
  { label: '복도', x: 16, y: 424, w: 1568, h: 152 },
  { label: '도서관', x: 16, y: 592, w: 1568, h: 352 },
];

function classroom(ox: number): [string, number, number][] {
  const items: [string, number, number][] = [];
  for (const x of [160, 330, 500]) for (const y of [130, 260]) {
    items.push(['desk', ox + x, y], ['chair', ox + x, y + 50]);
  }
  items.push(['bookshelf', ox + 640, 60], ['trash', ox + 740, 370], ['plant', ox + 60, 370]);
  return items;
}

const RAW: [string, number, number][] = [
  ...classroom(0),
  ...classroom(800),
  // 복도
  ...[100, 240, 560, 700, 900, 1320, 1470].map((x): [string, number, number] => ['locker', x, 456]),
  ['extinguisher', 200, 548], ['water', 700, 540], ['umbrella', 1000, 548], ['plant', 1400, 540], ['trash', 1520, 548],
  // 도서관
  ...[100, 250, 700, 850, 1300, 1450].map((x): [string, number, number] => ['bookshelf', x, 630]),
  ['books', 300, 800], ['books', 900, 780], ['books', 1250, 820], ['globe', 600, 800],
  ['desk', 500, 860], ['desk', 1000, 860], ['chair', 500, 905], ['plant', 60, 900], ['mopbox', 1540, 890],
];

export const DECOR: Decor[] = RAW.map(([kind, x, y], i) => ({ id: `d${i}`, kind, x, y }));

export const SEEKER_SPAWN = { x: 60, y: 496 };
export const HIDER_SPAWNS = [
  { x: 800, y: 496 }, { x: 400, y: 350 }, { x: 1200, y: 350 },
  { x: 800, y: 700 }, { x: 300, y: 700 }, { x: 1300, y: 700 },
];

const DECOR_BY_ID = new Map(DECOR.map((d) => [d.id, d]));
export function decorPos(id: string): { x: number; y: number } | undefined {
  const d = DECOR_BY_ID.get(id);
  return d && { x: d.x, y: d.y };
}

/** 반지름 r인 원이 맵 밖이거나 벽과 겹치면 true. 사물과는 충돌하지 않는다. */
export function blocked(x: number, y: number, r: number): boolean {
  if (x - r < 0 || y - r < 0 || x + r > MAP_W || y + r > MAP_H) return true;
  return WALLS.some((w) => {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    return Math.hypot(x - cx, y - cy) < r;
  });
}
