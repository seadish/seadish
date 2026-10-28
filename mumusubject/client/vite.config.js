import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  server: {
    port: 5274,
    host: true,
  },
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist',
  },
}));
