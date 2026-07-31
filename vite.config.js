import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project sites serve from /<repo>/, so the base must match or the
// service worker scope and asset URLs break (WS5). Override with VITE_BASE.
const base = process.env.VITE_BASE ?? '/masareef/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'fonts/*.woff2'],
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
        theme_color: '#0E3B2E',
        background_color: '#F6F1E6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
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
