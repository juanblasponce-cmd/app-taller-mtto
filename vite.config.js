import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend vive en client/ y se compila a client/dist.
// En desarrollo, /api se redirige (proxy) al backend Express en el puerto 3001.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
