import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/shapes-game/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "AntiMatch",
        short_name: "AntiMatch",
        description: "Аркада на реакцию, где можно поглощать только фигуры, отличающиеся по всем свойствам.",
        lang: "ru",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#09111d",
        theme_color: "#09111d",
        icons: [
          {
            src: `${base}pwa-192x192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base}pwa-512x512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${base}pwa-maskable-192x192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: `${base}pwa-maskable-512x512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackAllowlist: [/^\/shapes-game(?:\/.*)?$/],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/admin/api": "http://127.0.0.1:8787",
    },
  },
});
