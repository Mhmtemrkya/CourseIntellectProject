// Render the A3 tri-fold (landscape, 3 panels per side, 2 sides) brochure to PDF + PNGs.
const path = require('path');
const fs   = require('fs');
const playwrightPath = path.resolve(__dirname, '..', '..', 'desktop', 'node_modules', 'playwright');
const { chromium } = require(playwrightPath);

const here     = __dirname;
const htmlPath = path.join(here, 'foldable.html');
const fileUrl  = 'file:///' + htmlPath.replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  // A3 landscape at 96dpi ≈ 1587 x 1123, but we want crisp print so use higher base
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1587, height: 1123 },
  });
  const page = await context.newPage();

  console.log('→ Loading foldable HTML…');
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

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

  // ---------- PDF (A3 landscape, 2 sheets) ----------
  console.log('→ Rendering PDF (A3 landscape, 2 sides)…');
  const pdfPath = path.join(here, 'CourseIntellect-Foldable-A3.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A3',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  console.log('   ✓', pdfPath);

  // ---------- Per-sheet PNGs ----------
  const sheetCount = await page.locator('.sheet').count();
  console.log(`→ Rendering ${sheetCount} per-sheet PNGs…`);
  const labels = ['outside', 'inside'];

  for (let i = 0; i < sheetCount; i++) {
    const el = page.locator('.sheet').nth(i);
    const file = path.join(here, `Foldable-A3-${labels[i] ?? `sheet-${i+1}`}.png`);
    await el.screenshot({ path: file, omitBackground: false });
    console.log('   ✓', path.relative(here, file));
  }

  await browser.close();
  console.log('\n✔ Done.');
})().catch((e) => {
  console.error('✗ Render failed:', e);
  process.exit(1);
});
