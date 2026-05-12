// Render the cinematic CourseIntellect brochure to PDF + per-page PNGs.
// Run from the desktop/ directory (which has playwright installed):
//   cd desktop && node ../marketing/brochure/render.cjs

const path = require('path');
const fs   = require('fs');
const playwrightPath = path.resolve(__dirname, '..', '..', 'desktop', 'node_modules', 'playwright');
const { chromium } = require(playwrightPath);

const here     = __dirname;
const htmlPath = path.join(here, 'brochure.html');
const fileUrl  = 'file:///' + htmlPath.replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1240, height: 1754 },
  });
  const page = await context.newPage();

  console.log('→ Loading brochure HTML…');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Inline ALL images as base64 data URIs — guarantees they end up
  // embedded in the PDF regardless of viewer/printer quirks.
  console.log('→ Inlining all images as base64…');
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    for (const img of imgs) {
      if (img.src.startsWith('data:')) continue;
      try {
        const r = await fetch(img.src);
        const blob = await r.blob();
        const b64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        img.src = b64;
      } catch (e) {
        console.warn('Inline failed for', img.src, e);
      }
    }
  });

  console.log('→ Waiting for fonts & images to fully decode…');
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((res) => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    }));
    await Promise.all(imgs.map((img) =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    ));
  });
  await page.waitForTimeout(1000);

  // ---------- PDF (A4 multi-page) ----------
  console.log('→ Rendering PDF (A4 multi-page)…');
  const pdfPath = path.join(here, 'CourseIntellect-Brochure-2026.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  console.log('   ✓', pdfPath);

  // ---------- Per-page PNGs ----------
  const pageCount = await page.locator('.page').count();
  console.log(`→ Rendering ${pageCount} per-page PNGs…`);
  const pagesDir = path.join(here, 'pages');
  if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

  for (let i = 0; i < pageCount; i++) {
    const el = page.locator('.page').nth(i);
    const file = path.join(pagesDir, `page-${String(i + 1).padStart(2, '0')}.png`);
    await el.screenshot({ path: file, omitBackground: false });
    console.log('   ✓', path.relative(here, file));
  }

  await browser.close();
  console.log('\n✔ Done.');
})().catch((e) => {
  console.error('✗ Render failed:', e);
  process.exit(1);
});
