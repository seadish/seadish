import { describe, it, expect, vi } from 'vitest';
import { startTicker } from './ticker';

describe('startTicker', () => {
  it('calls the callback repeatedly until stopped (setInterval fallback when Worker is missing)', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const stop = startTicker(fn, 250);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(4);
    stop();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
