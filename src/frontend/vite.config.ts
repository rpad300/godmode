import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Plugin to copy static HTML pages (landing, terms, privacy) to build output
function copyStaticPages() {
  const pages = ['landing.html', 'terms.html', 'privacy.html'];
  return {
    name: 'copy-static-pages',
    closeBundle() {
      const outDir = resolve(__dirname, '../public');
      for (const page of pages) {
        const src = resolve(__dirname, page);
        if (existsSync(src)) {
          copyFileSync(src, resolve(outDir, page));
        }
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src'),

  plugins: [react(), tailwindcss(), copyStaticPages()],

  build: {
    // Output directly to src/public for the server to serve
    outDir: '../../public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
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
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@pages': resolve(__dirname, 'src/pages'),
    },
  },
});
