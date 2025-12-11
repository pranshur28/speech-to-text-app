import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './', // Use relative paths for Electron file:// protocol
  build: {
    outDir: '../../build',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
