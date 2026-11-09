import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'bidi-logo-light.png',
        'bidi-logo-dark.png',
        'bidi-logo-light-large.png',
        'bidi-logo-dark-large.png',
        'pwa-icon-192.png',
        'pwa-icon-512.png',
        'apple-touch-icon.png',
        'favicon.svg',
      ],
      manifest: {
        name: 'BiDi',
        short_name: 'BiDi',
        description: 'BiDi fuel tokens — drivers and attendants',
        theme_color: '#003A1D',
        background_color: '#0A0F0C',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/wallet': { target: 'http://localhost:3000', changeOrigin: true },
      '/user': { target: 'http://localhost:3000', changeOrigin: true },
      '/transactions': { target: 'http://localhost:3000', changeOrigin: true },
      '/attendants': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    globals: false,
  },
});
