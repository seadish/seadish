import { describe, it, expect } from 'vitest';
import { encodeRoom, decodeRoom, RESUME_WINDOW_MS } from './remember';

describe('remembered room for auto-resume', () => {
  const now = 10_000_000;
  it('returns the code within the window', () => expect(decodeRoom(encodeRoom('1234', now), now + 60_000)).toBe('1234'));
  it('forgets a room from an earlier lesson', () => expect(decodeRoom(encodeRoom('1234', now), now + RESUME_WINDOW_MS + 1)).toBeNull());
  it('ignores missing or broken values', () => {
    expect(decodeRoom(null, now)).toBeNull();
    expect(decodeRoom('1234', now)).toBeNull();
    expect(decodeRoom('{"code":5}', now)).toBeNull();
  });
  it('window is 2 hours', () => expect(RESUME_WINDOW_MS).toBe(2 * 60 * 60 * 1000));
});
