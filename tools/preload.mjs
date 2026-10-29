// Velocizza il primo caricamento: i moduli del sito si scoprono uno dopo l'altro (main.js importa A, A importa B...),
// quindi il browser li scarica a catena. Questo script legge gli import statici partendo da main.js e scrive in
// index.html un <link rel="modulepreload"> per ciascuno, così partono tutti insieme.
// Lo lancia la pubblicazione (.github/workflows/pages.yml); in locale non serve e index.html resta com'è.
//   node tools/preload.mjs [cartella-pubblica]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public'));
const ENTRY = '/src/main.js';
// import 'x'; import a from 'x'; import {a} from 'x'; export {a} from 'x'. Gli import dinamici import('x') non contano: sono lazy di proposito.
const STATIC_IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

const seen = [];
function visit(url) {
  if (seen.includes(url)) return;
  const file = join(root, url);
  if (!existsSync(file)) return;
  seen.push(url);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(STATIC_IMPORT)) visit(posix.normalize(posix.join(posix.dirname(url), match[1])));
}
visit(ENTRY);

const page = join(root, 'index.html');
let text = readFileSync(page, 'utf8');
if (text.includes('rel="modulepreload"')) {
  console.log('index.html ha già i modulepreload: niente da fare.');
} else {
  const links = seen.map((url) => `  <link rel="modulepreload" href="${url}">`).join('\n');
  if (!text.includes('  <script type="module" src="/src/main.js"></script>')) throw new Error('index.html: manca lo script di avvio');
  text = text.replace('</head>', `${links}\n</head>`);
  writeFileSync(page, text);
  console.log(`index.html: ${seen.length} moduli in modulepreload.`);
}
