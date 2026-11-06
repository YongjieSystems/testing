import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [{
    name: 'employee-manual',
    generateBundle() {
      for(const file of ['manuals/employee-handbook-2026-11-06.pdf','manuals/quote-quick-reference-2026-11-06-v2.pdf'])
        this.emitFile({type:'asset',fileName:file,source:readFileSync(new URL('./'+file,import.meta.url))});
    },
  }],
  base: './',
  server: { port: 3000, host: '127.0.0.1' },
});
