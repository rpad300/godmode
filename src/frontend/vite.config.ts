/**
 * Purpose:
 *   Vite build and dev-server configuration for the GodMode React frontend.
 *
 * Responsibilities:
 *   - Configure React plugin (JSX transform) and Tailwind CSS v4 Vite plugin
 *   - Set build output to src/public/ so the Express backend can serve it
 *   - Proxy /api requests to the backend server (localhost:3005) during dev
 *   - Define path aliases (@, @components, @hooks, @lib, @pages)
 *   - Copy static HTML pages (landing, terms, privacy) into the build output
 *
 * Key dependencies:
 *   - @vitejs/plugin-react: React Fast Refresh and JSX support
 *   - @tailwindcss/vite: Tailwind CSS v4 Vite integration
 *
 * Notes:
 *   - The dev server listens on port 8080 (host "::") and proxies API calls
 *     to port 3005 where the Express backend runs
 *   - Build output goes to ../../public (relative to src/frontend/src/),
 *     which resolves to src/public/ from the project root
 *   - Source maps are enabled for production builds to aid debugging
 *   - The copyStaticPages plugin runs at closeBundle, so static pages are
 *     only copied during full builds (not during dev)
 */
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync } from 'fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envConfig = dotenv.config({ path: resolve(__dirname, '../../.env') });
expand(envConfig);

/**
 * Custom Vite plugin that copies standalone HTML pages (landing, terms, privacy)
 * into the build output directory after bundling completes.
 */
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

  // Expose environment variables to the frontend with VITE_ prefix mapping
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
    'import.meta.env.VITE_SUPABASE_PROJECT_URL': JSON.stringify(process.env.SUPABASE_PROJECT_URL),
    'import.meta.env.VITE_SUPABASE_PROJECT_ANON_KEY': JSON.stringify(process.env.SUPABASE_PROJECT_ANON_KEY),
  },

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
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
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
