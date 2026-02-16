import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),

  build: {
    // Output directly to src/public for the server to serve
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),
      },
    },
    // Generate source maps for debugging
    sourcemap: true,
  },

  optimizeDeps: {
    exclude: [], // Removed lodash-es as we will install it
  },

  server: {
    port: 5173,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'lodash-es': 'lodash', // Force CJS lodash for compatibility
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@services': resolve(__dirname, 'src/services'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@utils': resolve(__dirname, 'src/lib'), // Keep for backward compat during migration
      '@types': resolve(__dirname, 'src/types'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@data': resolve(__dirname, 'src/data'),
      '@schemas': resolve(__dirname, 'schemas'),
    },
  },
});
