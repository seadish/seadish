import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    threads: false,
    env: { VITE_USE_EMULATOR: '1' },
  },
} as any);
