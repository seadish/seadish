import { describe, it, expect } from 'vitest';
import { PROP_KINDS, DECOR, WALLS, AREAS, SEEKER_SPAWN, HIDER_SPAWNS, MAP_W, MAP_H, blocked, decorPos } from './map';

describe('map data', () => {
  it('has 10~12 unique prop kinds', () => {
    expect(PROP_KINDS.length).toBeGreaterThanOrEqual(10);
    expect(PROP_KINDS.length).toBeLessThanOrEqual(12);
    expect(new Set(PROP_KINDS.map((k) => k.id)).size).toBe(PROP_KINDS.length);
  });
  it('has 50~60 decor with unique ids and known kinds', () => {
    expect(DECOR.length).toBeGreaterThanOrEqual(50);
    expect(DECOR.length).toBeLessThanOrEqual(60);
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
    const kinds = new Set(PROP_KINDS.map((k) => k.id));
    for (const d of DECOR) expect(kinds.has(d.kind), d.id).toBe(true);
  });
  it('places all decor inside the map and off walls', () => {
    for (const d of DECOR) {
      expect(d.x > 0 && d.x < MAP_W && d.y > 0 && d.y < MAP_H, d.id).toBe(true);
      expect(blocked(d.x, d.y, 8), d.id).toBe(false);
    }
  });
  it('spawns are open', () => {
    expect(blocked(SEEKER_SPAWN.x, SEEKER_SPAWN.y, 12)).toBe(false);
    expect(HIDER_SPAWNS.length).toBe(6);
    for (const s of HIDER_SPAWNS) expect(blocked(s.x, s.y, 12)).toBe(false);
  });
  it('blocks outside the map and on walls', () => {
    expect(blocked(-1, 100, 12)).toBe(true);
    expect(blocked(MAP_W - 5, 100, 12)).toBe(true);
    const w = WALLS[0];
    expect(blocked(w.x + w.w / 2, w.y + w.h / 2, 1)).toBe(true);
  });
  it('has four areas with at least 8 decor each', () => {
    expect(AREAS.map((a) => a.label)).toEqual(['교실1', '교실2', '복도', '도서관']);
    for (const a of AREAS) {
      const n = DECOR.filter((d) => d.x >= a.x && d.x <= a.x + a.w && d.y >= a.y && d.y <= a.y + a.h).length;
      expect(n, a.label).toBeGreaterThanOrEqual(8);
    }
  });
  it('rooms are reachable: corridor ↔ each room through a door gap', () => {
    // 복도 중앙 높이에서 각 방 쪽으로 문 틈을 지나는 세로 경로가 막히지 않아야 함
    for (const x of [368, 1168]) for (let y = 380; y <= 520; y += 4) expect(blocked(x, y, 12), `${x},${y}`).toBe(false);
    for (const x of [448, 1148]) for (let y = 520; y <= 640; y += 4) expect(blocked(x, y, 12), `${x},${y}`).toBe(false);
  });
  it('decorPos finds by id', () => {
    expect(decorPos(DECOR[0].id)).toEqual({ x: DECOR[0].x, y: DECOR[0].y });
    expect(decorPos('nope')).toBeUndefined();
  });
});
