// vite.config.js
import { defineConfig } from "file:///Users/Tarek/masareef-app/node_modules/vite/dist/node/index.js";
import react from "file:///Users/Tarek/masareef-app/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///Users/Tarek/masareef-app/node_modules/vite-plugin-pwa/dist/index.js";
var base = process.env.VITE_BASE ?? "/masareef/";
var vite_config_default = defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "\u0645\u0635\u0627\u0631\u064A\u0641",
        short_name: "\u0645\u0635\u0627\u0631\u064A\u0641",
        description: "\u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u0644\u0628\u064A\u062A \u2014 \u064A\u062A\u0633\u062C\u0644 \u0641\u064A \u0627\u0644\u0634\u064A\u062A \u0639\u0644\u0649 \u0637\u0648\u0644",
        lang: "ar",
        dir: "rtl",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        theme_color: "#3E7CA6",
        background_color: "#FAF7F1",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        // The Apps Script origin is NEVER cached. Every call is a POST (which
        // Workbox would not cache anyway) but this makes the intent explicit and
        // survives any future GET: the sheet is the source of truth, and a
        // stale cached read would quietly lie to Dad about what he has spent.
        // The app's own localStorage snapshot is the only data cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === "script.google.com" || url.hostname === "script.googleusercontent.com",
            handler: "NetworkOnly"
          }
        ],
        navigateFallbackDenylist: [/^\/macros\//]
      },
      devOptions: { enabled: false }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcHJpdmF0ZS90bXAvbWFzYXJlZWYtc2hpcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3ByaXZhdGUvdG1wL21hc2FyZWVmLXNoaXAvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3ByaXZhdGUvdG1wL21hc2FyZWVmLXNoaXAvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcblxuLy8gR2l0SHViIFBhZ2VzIHByb2plY3Qgc2l0ZXMgc2VydmUgZnJvbSAvPHJlcG8+Lywgc28gdGhlIGJhc2UgbXVzdCBtYXRjaCBvciB0aGVcbi8vIHNlcnZpY2Ugd29ya2VyIHNjb3BlIGFuZCBhc3NldCBVUkxzIGJyZWFrIChXUzUpLiBPdmVycmlkZSB3aXRoIFZJVEVfQkFTRS5cbmNvbnN0IGJhc2UgPSBwcm9jZXNzLmVudi5WSVRFX0JBU0UgPz8gJy9tYXNhcmVlZi8nO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBiYXNlLFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgaW5jbHVkZUFzc2V0czogWydpY29ucy8qLnBuZyddLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ1x1MDY0NVx1MDYzNVx1MDYyN1x1MDYzMVx1MDY0QVx1MDY0MScsXG4gICAgICAgIHNob3J0X25hbWU6ICdcdTA2NDVcdTA2MzVcdTA2MjdcdTA2MzFcdTA2NEFcdTA2NDEnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1x1MDY0NVx1MDYzNVx1MDYyN1x1MDYzMVx1MDY0QVx1MDY0MSBcdTA2MjdcdTA2NDRcdTA2MjhcdTA2NEFcdTA2MkEgXHUyMDE0IFx1MDY0QVx1MDYyQVx1MDYzM1x1MDYyQ1x1MDY0NCBcdTA2NDFcdTA2NEEgXHUwNjI3XHUwNjQ0XHUwNjM0XHUwNjRBXHUwNjJBIFx1MDYzOVx1MDY0NFx1MDY0OSBcdTA2MzdcdTA2NDhcdTA2NDQnLFxuICAgICAgICBsYW5nOiAnYXInLFxuICAgICAgICBkaXI6ICdydGwnLFxuICAgICAgICBzdGFydF91cmw6IGJhc2UsXG4gICAgICAgIHNjb3BlOiBiYXNlLFxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXG4gICAgICAgIG9yaWVudGF0aW9uOiAncG9ydHJhaXQnLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyMzRTdDQTYnLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI0ZBRjdGMScsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAgeyBzcmM6ICdpY29ucy9pY29uLTE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnaWNvbnMvaWNvbi01MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJ2ljb25zL21hc2thYmxlLTUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ21hc2thYmxlJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLHdvZmYyLHBuZyxzdmd9J10sXG4gICAgICAgIC8vIFRoZSBBcHBzIFNjcmlwdCBvcmlnaW4gaXMgTkVWRVIgY2FjaGVkLiBFdmVyeSBjYWxsIGlzIGEgUE9TVCAod2hpY2hcbiAgICAgICAgLy8gV29ya2JveCB3b3VsZCBub3QgY2FjaGUgYW55d2F5KSBidXQgdGhpcyBtYWtlcyB0aGUgaW50ZW50IGV4cGxpY2l0IGFuZFxuICAgICAgICAvLyBzdXJ2aXZlcyBhbnkgZnV0dXJlIEdFVDogdGhlIHNoZWV0IGlzIHRoZSBzb3VyY2Ugb2YgdHJ1dGgsIGFuZCBhXG4gICAgICAgIC8vIHN0YWxlIGNhY2hlZCByZWFkIHdvdWxkIHF1aWV0bHkgbGllIHRvIERhZCBhYm91dCB3aGF0IGhlIGhhcyBzcGVudC5cbiAgICAgICAgLy8gVGhlIGFwcCdzIG93biBsb2NhbFN0b3JhZ2Ugc25hcHNob3QgaXMgdGhlIG9ubHkgZGF0YSBjYWNoZS5cbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAoeyB1cmwgfSkgPT5cbiAgICAgICAgICAgICAgdXJsLmhvc3RuYW1lID09PSAnc2NyaXB0Lmdvb2dsZS5jb20nIHx8IHVybC5ob3N0bmFtZSA9PT0gJ3NjcmlwdC5nb29nbGV1c2VyY29udGVudC5jb20nLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtPbmx5JyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL21hY3Jvc1xcLy9dLFxuICAgICAgfSxcbiAgICAgIGRldk9wdGlvbnM6IHsgZW5hYmxlZDogZmFsc2UgfSxcbiAgICB9KSxcbiAgXSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnUSxTQUFTLG9CQUFvQjtBQUM3UixPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBSXhCLElBQU0sT0FBTyxRQUFRLElBQUksYUFBYTtBQUV0QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGFBQWE7QUFBQSxNQUM3QixVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixNQUFNO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssc0JBQXNCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUNqRSxFQUFFLEtBQUssc0JBQXNCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUNqRSxFQUFFLEtBQUssMEJBQTBCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxXQUFXO0FBQUEsUUFDNUY7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsa0NBQWtDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBTWpELGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVksQ0FBQyxFQUFFLElBQUksTUFDakIsSUFBSSxhQUFhLHVCQUF1QixJQUFJLGFBQWE7QUFBQSxZQUMzRCxTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxRQUNBLDBCQUEwQixDQUFDLGFBQWE7QUFBQSxNQUMxQztBQUFBLE1BQ0EsWUFBWSxFQUFFLFNBQVMsTUFBTTtBQUFBLElBQy9CLENBQUM7QUFBQSxFQUNIO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
