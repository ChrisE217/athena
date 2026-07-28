import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  build: {
    outDir: join(root, '..', 'dist-ui'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5177,
  },
});
