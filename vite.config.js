import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

/* Сайт живе на GitHub Pages за адресою /check-auto/. */
const base = "/check-auto/";

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon-64.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Golf Check",
        short_name: "Golf Check",
        description: "Чек-лист огляду Volkswagen Golf V перед покупкою",
        lang: "uk",
        display: "standalone",
        orientation: "portrait",
        background_color: "#101112",
        theme_color: "#101112",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest,woff2}"],
        navigateFallback: base + "index.html",
        /* Фото з адмінки (сховище Supabase): імена унікальні й не змінюються, тож беремо з кешу —
           так вони відкриваються миттєво і без зв'язку на майданчику. */
        runtimeCaching: [{
          urlPattern: /\/storage\/v1\/object\/public\/photos\//,
          handler: "CacheFirst",
          options: {
            cacheName: "photos",
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
            cacheableResponse: { statuses: [200] }
          }
        }]
      }
    })
  ],
  build: { target: ["es2019", "safari13"] }
});
