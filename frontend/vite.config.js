import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // 1. Base path set to relative (./) for CSP hosting
  base: './',

  build: {
    // 2. Output to the src/csp folder
    outDir: path.resolve(__dirname, '../src/csp'),

    // 3. Allow wiping this directory before build (since it's outside root)
    emptyOutDir: true,

    // 4. Optimization: Ensure main.js has a predictable name if possible, 
    // or rely on index.html to load the hashed name automatically.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    // Keep proxy for local dev (npm run dev) if you still use it
    proxy: {
      '/mu5k3t/api': {
        target: '',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
