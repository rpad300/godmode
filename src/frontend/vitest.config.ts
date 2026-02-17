/**
 * Purpose:
 *   Vitest configuration for the GodMode React frontend unit/component tests.
 *
 * Responsibilities:
 *   - Use jsdom as the test environment for DOM APIs and React rendering
 *   - Enable Vitest globals (describe, it, expect) without explicit imports
 *   - Load the test setup file (src/test/setup.ts) before each test suite
 *   - Resolve the "@" path alias to the src/ directory
 *
 * Key dependencies:
 *   - vitest: test runner (Vite-native, replaces Jest for the frontend)
 *   - @vitejs/plugin-react-swc: SWC-based React transform (faster than Babel)
 *   - jsdom: browser-like environment for component testing
 *
 * Notes:
 *   - This config is separate from the backend Jest config (jest.config.js)
 *   - Uses react-swc plugin for speed; the main vite.config.ts uses the
 *     standard @vitejs/plugin-react (Babel-based) for dev/build
 *   - Test files must match src/**/*.{test,spec}.{ts,tsx}
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
