// GitHub Pages serves source modules directly; vendor the pinned SDK for browsers.
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { build }=createRequire(require.resolve('vite'))('esbuild');
await build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:process.cwd(),sourcefile:'team-client-entry.js'},bundle:true,
  outfile:'vendor/supabase.js',format:'esm',platform:'browser',target:'es2022',minify:true,
  legalComments:'eof'});
