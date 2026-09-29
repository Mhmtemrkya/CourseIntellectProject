// TypeScript katılık kapısı: tsc'nin yakalamadığı kaçış kapılarını sayar.
// `any` tipi, @ts-ignore / @ts-nocheck / @ts-expect-error yorumları ve
// src altında kalan .js/.jsx dosyaları sıfır olmadıkça kapı kırmızıdır.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const srcDir = path.resolve('src');
const findings = [];
const leftoverJs = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) leftoverJs.push(path.relative('.', full));
    else if (/\.(ts|tsx)$/.test(entry.name)) scan(full);
  }
}

function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative('.', file);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const report = (pos, kind) => {
    const { line } = source.getLineAndCharacterOfPosition(pos);
    findings.push(`${rel}:${line + 1} ${kind}`);
  };
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) report(node.getStart(source), 'any');
    ts.forEachChild(node, visit);
  };
  visit(source);
  const directive = /@ts-(ignore|nocheck|expect-error)/g;
  let match;
  while ((match = directive.exec(text))) report(match.index, `@ts-${match[1]}`);
}

walk(srcDir);

const summary = `${findings.length} kaçış kapısı, ${leftoverJs.length} JS dosyası`;
if (process.argv.includes('--verbose')) {
  for (const line of findings) console.log(line);
  for (const file of leftoverJs) console.log(`${file} js`);
}
console.log(summary);
process.exit(findings.length === 0 && leftoverJs.length === 0 ? 0 : 1);
