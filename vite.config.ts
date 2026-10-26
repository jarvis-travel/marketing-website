import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';


/**
 * Refuse to BUILD a marketing site whose pricing CTAs point somewhere that is
 * not an https:// origin — rather than shipping it and finding out in the
 * browser.
 *
 * The first version of this guard was a `throw` at module scope in
 * appLink.ts. Measured: with VITE_APP_ORIGIN=localhost:5173 the build exits 0
 * and ships, because Vite bundles that module and the throw only runs when a
 * visitor's browser evaluates it — every page white-screens, and CI is green.
 * A build-time check is the same misconfiguration caught before anything is
 * deployed, and incapable of white-screening anyone. Same reasoning, same
 * shape, as web-app's requireApiBase (marketing-website#46 review F2).
 *
 * Reads loadEnv, not bare process.env, so a .env file satisfies it as well as
 * the deploy step's env: — a guard whose remedy text names a file it does not
 * read is the JAR-1115 defect.
 */
function requireAppOrigin(): Plugin {
  return {
    name: 'jarvistravel:require-app-origin',
    apply: 'build',
    config(_config, { mode }) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
      const raw = env.VITE_APP_ORIGIN || 'https://app.jarvistravel.com';
      if (raw.startsWith('https://')) return;
      throw new Error(
        `VITE_APP_ORIGIN must be an https:// origin (got "${raw}").\n\n` +
          'Every pricing CTA links to this origin; a scheme-less or http value ' +
          'ships a Start Planning button that goes nowhere. Set it on the deploy build ' +
          'step (see .github/workflows/deploy-droplet.yml) or in a .env file.',
      );
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [requireAppOrigin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    // No sourcemaps in the production bundle - don't ship source to visitors.
    sourcemap: false,
  },
});
