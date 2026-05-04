import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      exclude: [...configDefaults.exclude],
    },
  };
});
