import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../lib/safe-url.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { safeUrl, sanitizeContentUrls } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('dangerous schemes and protocol-relative urls are neutralised', () => {
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.example', '/\\evil.example', '']) {
    assert.equal(safeUrl(bad), '#', bad)
  }
})

test('site paths, http(s), mailto and tel are kept', () => {
  for (const ok of ['/iletisim', '#fiyatlar', 'https://schoolasist.com', 'http://example.com/a', 'mailto:info@schoolasist.com', 'tel:+905551112233']) {
    assert.equal(safeUrl(ok), ok)
  }
})

test('nested content links are sanitised, other text untouched', () => {
  const clean = sanitizeContentUrls({ title: 'javascript:not-a-link', cta: { href: 'javascript:alert(1)' }, links: [{ url: 'https://ok.example' }, { downloadUrl: 'data:x' }] })
  assert.equal(clean.title, 'javascript:not-a-link')
  assert.equal(clean.cta.href, '#')
  assert.equal(clean.links[0].url, 'https://ok.example')
  assert.equal(clean.links[1].downloadUrl, '#')
})
