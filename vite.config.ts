import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * The MIT and OFL licences of the bundled three.js and font require their notices to travel with
 * copies, and bundling strips source comments. So the production HTML gets the project licence and
 * THIRD_PARTY_NOTICES.md as a comment right after the doctype.
 */
function embedNotices(): Plugin {
  return {
    name: 'fume-rally-embed-notices',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const text = [readFileSync('LICENSE', 'utf8'), readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')]
          .join('\n\n')
          .replace(/-->/g, '-- >'); // a comment must not be closed early
        return html.replace(/<!doctype html>/i, (m) => `${m}\n<!--\n${text}\n-->`);
      }
    }
  };
}

// The production build inlines all JS/CSS into one dist/index.html so the game can be
// played by double-clicking the file (no server, no CDN).
export default defineConfig({
  base: './',
  plugins: [embedNotices(), viteSingleFile()],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] }
});
