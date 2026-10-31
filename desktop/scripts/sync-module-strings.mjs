// Yeni modüllerin (zümre, kulüp, ziyaretçi, tercih robotu) TR→EN sözlüğünü
// masaüstü kaynağından mobil Dart haritasına yazar. Tek kaynak masaüstüdür:
//   node scripts/sync-module-strings.mjs          → mobile/lib/i18n/strings_modules_tr_en.dart
//   node scripts/sync-module-strings.mjs --check  → dosya güncel değilse 1 ile çıkar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../src/lib/i18n/dictionary-modules.ts');
const target = path.resolve(here, '../../mobile/lib/i18n/strings_modules_tr_en.dart');

const text = fs.readFileSync(source, 'utf8');
const entries = [];
// 'TR': 'EN' çiftleri (tek tırnak, kaçışlı tırnak destekli).
const pair = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g;
let match;
while ((match = pair.exec(text))) entries.push([match[1], match[2]]);

const unescape = (value) => value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const dart = (value) => `'${unescape(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
const seen = new Set();
const lines = [];
for (const [tr, en] of entries) {
  if (seen.has(tr)) continue;
  seen.add(tr);
  lines.push(`  ${dart(tr)}: ${dart(en)},`);
}
const output = `// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: desktop/src/lib/i18n/dictionary-modules.ts
// Üretim: node desktop/scripts/sync-module-strings.mjs
const Map<String, String> kTrEnModules = {
${lines.join('\n')}
};
`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== output) {
    console.error('strings_modules_tr_en.dart güncel değil: node desktop/scripts/sync-module-strings.mjs');
    process.exit(1);
  }
  console.log(`Modül çevirileri güncel (${lines.length}).`);
} else {
  fs.writeFileSync(target, output);
  console.log(`${lines.length} çeviri yazıldı → ${path.relative(process.cwd(), target)}`);
}
