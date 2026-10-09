import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project sites serve from /<repo>/, so the base must match or the
// service worker scope and asset URLs break (WS5). Override with VITE_BASE.
const base = process.env.VITE_BASE ?? '/masareef/';

// The commit a build came from, shown at the foot of Settings — so «is my phone
// on the new version?» is read off the screen, not guessed (E-017, 2026-10-10).
import { execSync } from 'node:child_process';
let version = 'dev';
try { version = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim(); } catch { /* no git: 'dev' */ }

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      // v4 A6/R19: a new build WAITS and the app asks («نسخة جديدة جاهزة») —
      // autoUpdate could reload under a half-typed amount. See src/state/update.js.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon-180.png', 'icons/icon-*.png', 'icons/maskable-*.png'],
      manifest: {
        name: 'مصاريف',
        short_name: 'مصاريف',
        description: 'مصاريف البيت — يتسجل في الشيت على طول',
        lang: 'ar',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        theme_color: '#FAF7F1', // v4 A6: the paper, not harbor — the header is no longer a harbor slab
        background_color: '#FAF7F1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // The launch images (~4.5 MB) are fetched by iOS once, at install —
        // never precached into every phone on every update.
        globIgnores: ['**/icons/startup-*.png'],
        // The Apps Script origin is NEVER cached. Every call is a POST (which
        // Workbox would not cache anyway) but this makes the intent explicit and
        // survives any future GET: the sheet is the source of truth, and a
        // stale cached read would quietly lie to Dad about what he has spent.
        // The app's own localStorage snapshot is the only data cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com',
            handler: 'NetworkOnly',
          },
        ],
        navigateFallbackDenylist: [/^\/macros\//],
      },
      devOptions: { enabled: false },
    }),
  ],
});
