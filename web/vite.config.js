import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      // Proxy 3 different Piped instances so browser search works without CORS errors
      '/piped-1': {
        target: 'https://api.piped.private.coffee',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/piped-1/, ''),
        secure: true,
      },
      '/piped-2': {
        target: 'https://api.piped.projectsegfau.lt',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/piped-2/, ''),
        secure: true,
      },
      '/piped-3': {
        target: 'https://pipedapi.adminforge.de',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/piped-3/, ''),
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
