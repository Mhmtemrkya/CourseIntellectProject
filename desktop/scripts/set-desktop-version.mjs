import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const raw = (process.argv[2] || '').trim().replace(/^desktop-v/i, '').replace(/^v/i, '');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(raw)) {
  console.error('Geçerli bir SemVer sürümü verin. Örnek: npm run desktop:version -- 1.2.0');
  process.exit(1);
}

function writeJson(file, mutate) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

writeJson(path.join(root, 'package.json'), (value) => { value.version = raw; });
writeJson(path.join(root, 'package-lock.json'), (value) => {
  value.version = raw;
  if (value.packages?.['']) value.packages[''].version = raw;
});
writeJson(path.join(root, 'src-tauri', 'tauri.conf.json'), (value) => { value.version = raw; });

const cargoFile = path.join(root, 'src-tauri', 'Cargo.toml');
const cargo = fs.readFileSync(cargoFile, 'utf8');
fs.writeFileSync(cargoFile, cargo.replace(/^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m, `$1"${raw}"`));

console.log(`SchoolAsist masaüstü sürümü ${raw} olarak ayarlandı.`);
