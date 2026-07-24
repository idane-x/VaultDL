import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { fileURLToPath, URL } from 'node:url';

// The @shared alias must be declared for the top-level (renderer) config AND for each
// electron sub-build, because vite-plugin-electron runs those in isolated Vite configs
// that do not inherit resolve.alias from the parent.
const sharedAlias = {
  '@shared': fileURLToPath(new URL('./electron/shared', import.meta.url)),
};

export default defineConfig({
  resolve: {
    alias: sharedAlias,
  },
  plugins: [
    react(),
    electron([
      {
        // Main process entry
        entry: 'electron/main.ts',
        vite: {
          resolve: { alias: sharedAlias },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Keep external so Node resolves them from node_modules at runtime.
              // - electron-store / node-7z / 7zip-bin: native/CJS + spawn a binary.
              // - cheerio: pulls in undici, which Rollup would otherwise eagerly bundle
              //   including its `node:sqlite` cache path (a Node 22 builtin absent from
              //   Electron's Node 20). Left external, undici loads that path lazily (never).
              external: ['electron-store', 'node-7z', '7zip-bin', 'cheerio'],
            },
          },
        },
      },
      {
        // Preload script — emitted as .mjs so Electron loads it as an ES module.
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          resolve: { alias: sharedAlias },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'es',
                entryFileNames: '[name].mjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
});
