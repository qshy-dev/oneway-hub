import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep lucide-react tree-shakeable, but vendor chunk for icons used across app
          vendor: ['react', 'react-dom', 'framer-motion'],
          supabase: ['@supabase/supabase-js'],
          games: ['lucide-react'],
        },
      },
    },
  },
});
