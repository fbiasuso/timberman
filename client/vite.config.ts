import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built assets resolve under the Capacitor WebView
  // origin (https://localhost). The Netlify web deploy is unaffected.
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Self-hosted team shields live under server/public (design D7) — dev
      // serves them through the API origin like production (single-origin).
      '/public': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
