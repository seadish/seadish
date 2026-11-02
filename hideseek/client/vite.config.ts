import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5275 },
  test: { include: ['src/**/*.test.ts'] },
} as any);
