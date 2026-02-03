import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  
  build: {
    // Output directly to src/public for the server to serve
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
    // Generate source maps for debugging
    sourcemap: true,
  },
  
  server: {
    port: 5173,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname),
      '@components': resolve(__dirname, 'components'),
      '@services': resolve(__dirname, 'services'),
      '@stores': resolve(__dirname, 'stores'),
      '@utils': resolve(__dirname, 'utils'),
      '@types': resolve(__dirname, 'types'),
      '@styles': resolve(__dirname, 'styles'),
    },
  },
});
