import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@worker': path.resolve(__dirname, './src/worker'),
      '@common': path.resolve(__dirname, './src/common'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@data': path.resolve(__dirname, './src/data'),
    },
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      // Allow serving files from the data directory
      strict: false,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
