// Build the final PDFs from the already-rendered PNGs.
// This guarantees every PDF viewer shows identical pixels — each PDF page is
// just one full-bleed PNG, with no CSS effects or filters that could trip
// up older/limited viewers.

const path = require('path');
const fs   = require('fs');
const playwrightPath = path.resolve(__dirname, '..', '..', 'desktop', 'node_modules', 'playwright');
const { chromium } = require(playwrightPath);

const here = __dirname;

function fileToDataUri(filePath, mime = 'image/png') {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function buildHtml(pngs, opts = {}) {
  const { pageSize = 'A4', landscape = false } = opts;
  const pages = pngs
    .map((src) => `<section class="page"><img src="${src}" alt=""/></section>`)
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: ${pageSize}${landscape ? ' landscape' : ''}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #000; }
  .page {
    width: ${pageSize === 'A3' ? (landscape ? '420mm' : '297mm') : '210mm'};
    height: ${pageSize === 'A3' ? (landscape ? '297mm' : '420mm') : '297mm'};
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
</style></head><body>
${pages}
</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page    = await context.newPage();

  // ---------- A4 multi-page brochure ----------
  console.log('→ Composing A4 brochure PDF from 10 PNGs…');
  const pagesDir = path.join(here, 'pages');
  const a4Pngs = fs.readdirSync(pagesDir)
    .filter((f) => /^page-\d+\.png$/.test(f))
    .sort()
    .map((f) => fileToDataUri(path.join(pagesDir, f)));

  const a4Html = buildHtml(a4Pngs, { pageSize: 'A4' });
  await page.setContent(a4Html, { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }))
    )
  ));
  await page.waitForTimeout(500);

  const a4Pdf = path.join(here, 'CourseIntellect-Brochure-2026.pdf');
  await page.pdf({
    path: a4Pdf,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  console.log('   ✓', a4Pdf);

  // ---------- A3 landscape foldable ----------
  console.log('→ Composing A3 foldable PDF from 2 PNGs…');
  const a3Pngs = ['Foldable-A3-outside.png', 'Foldable-A3-inside.png']
    .map((f) => fileToDataUri(path.join(here, f)));

  const a3Html = buildHtml(a3Pngs, { pageSize: 'A3', landscape: true });
  await page.setContent(a3Html, { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }))
    )
  ));
  await page.waitForTimeout(500);

  const a3Pdf = path.join(here, 'CourseIntellect-Foldable-A3.pdf');
  await page.pdf({
    path: a3Pdf,
    format: 'A3',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  console.log('   ✓', a3Pdf);

  await browser.close();
  console.log('\n✔ Done.');
})().catch((e) => {
  console.error('✗ Failed:', e);
  process.exit(1);
});
