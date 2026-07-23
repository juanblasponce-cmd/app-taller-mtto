import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend vive en client/ y se compila a client/dist.
// En desarrollo, /api se redirige (proxy) al backend Express.
// Se usa 127.0.0.1 (y no "localhost") porque en Windows "localhost" puede
// resolverse primero a ::1 y fallar la conexión con ECONNREFUSED.
const API = `http://127.0.0.1:${process.env.API_PORT || 3001}`;

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
