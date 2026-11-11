import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build inlines all JS/CSS into one dist/index.html so the game can be
// played by double-clicking the file (no server, no CDN).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] }
});
