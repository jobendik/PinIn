import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Vite configuration for the PinIn WebGL pinball runner.
// - `@` alias points at the src root so imports stay clean as the tree grows.
// - `three` is split into its own chunk because it dwarfs the game code.
export default defineConfig({
  base: '/PinIn/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
