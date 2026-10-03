import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../app/src/main/assets/www'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false
  }
});
