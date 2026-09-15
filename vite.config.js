import path from 'path';
import { defineConfig } from 'vite'

export default defineConfig({
  base: '',
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, './src/client/components/index/index.ts')
      }
    },
    sourcemap: false,
    outDir: path.resolve(__dirname, './src/server/dist'),
    emptyOutDir: true
  }
});
