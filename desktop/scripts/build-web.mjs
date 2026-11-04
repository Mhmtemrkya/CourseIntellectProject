#!/usr/bin/env node
// Web (tarayıcı) derlemesi: yalnız demo hesapların girebildiği, gizli bir taban yol
// altında sunulan sürüm. Kural sunucuda zorlanır (WebDemoAccessPolicy); bu derleme
// yalnız arayüzü sadeleştirir ve oturumu sekmeye özel tutar.
//
//   WEB_BASE_PATH="/<32-64 küçük harf/rakam>" REACT_APP_COURSE_INTELLECT_API_URL=https://... npm run build:web
//
// Gizli yol depoya yazılmaz; yayın betiği sunucudaki secrets dosyasından verir.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const basePath = (process.env.WEB_BASE_PATH ?? '').trim();
const local = process.argv.includes('--local');

if (!local && !/^\/[a-z0-9]{32,64}$/.test(basePath)) {
  console.error('WEB_BASE_PATH must be a slash followed by 32-64 lowercase letters/digits.');
  process.exit(2);
}
if (local && basePath && !/^\/[a-z0-9-]{1,64}$/.test(basePath)) {
  console.error('WEB_BASE_PATH is malformed.');
  process.exit(2);
}

const env = {
  ...process.env,
  PUBLIC_URL: basePath,
  REACT_APP_WEB_DEMO: 'true',
  REACT_APP_COURSE_INTELLECT_ENV: 'production',
  // CSP 'self' ile çalışsın: çalışma zamanı parçası satır içi gömülmez, kaynak haritası yayımlanmaz.
  INLINE_RUNTIME_CHUNK: 'false',
  GENERATE_SOURCEMAP: 'false',
  DISABLE_ESLINT_PLUGIN: 'true',
};

const result = spawnSync(process.execPath, [join(root, 'node_modules/@craco/craco/dist/bin/craco.js'), 'build'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const buildDir = process.env.BUILD_PATH ? resolve(root, process.env.BUILD_PATH) : join(root, 'build');
const html = readFileSync(join(buildDir, 'index.html'), 'utf8');
// Satır içi <script> CSP'yi delerdi; yalnız src'li script etiketlerine izin verilir.
const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs, body]) => !/\bsrc=/.test(attrs) || body.trim().length > 0);
if (inlineScripts.length > 0) {
  console.error(`build/index.html contains ${inlineScripts.length} inline script(s); the web CSP forbids them.`);
  process.exit(1);
}
if (basePath && !html.includes(`${basePath}/static/`)) {
  console.error('build/index.html does not reference the base path.');
  process.exit(1);
}
console.log('Web build ready.');
