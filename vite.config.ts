import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [{
    name: 'employee-manual',
    generateBundle() {
      this.emitFile({type:'asset',fileName:'manuals/employee-manual-v1.5.0.pdf',
        source:readFileSync(new URL('./manuals/employee-manual-v1.5.0.pdf',import.meta.url))});
    },
  }],
  base: './',
  server: { port: 3000, host: '127.0.0.1' },
});
