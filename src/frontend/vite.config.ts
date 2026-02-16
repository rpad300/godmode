<<<<<<< HEAD
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: __dirname, // Ensure root is set to the directory containing this config file
=======
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

>>>>>>> origin/claude/migrate-to-react-uJJbl
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
    },
<<<<<<< HEAD
    hmr: {
      overlay: false,
=======
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@pages': resolve(__dirname, 'src/pages'),
>>>>>>> origin/claude/migrate-to-react-uJJbl
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
