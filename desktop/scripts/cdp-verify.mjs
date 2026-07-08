import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const mod = page.locator('text=Akademik Yönetim').first();
await mod.click().catch(() => {});
await page.waitForTimeout(800);
await page.locator('text=Nöbet Oluştur').first().click().catch(() => {});
await page.waitForTimeout(5000);

console.log('HREF:', await page.evaluate(() => location.href));
console.log('BODY LEN:', await page.evaluate(() => document.body.innerText.length));
console.log('HAS NOBET FORM:', await page.evaluate(() => document.body.innerText.includes('NÖBET BILGILERI') || document.body.innerText.includes('Nöbet zamanı')));
console.log('ERRORS:', errors.length, errors.join(' | '));
await page.screenshot({ path: process.env.SHOT || 'verify.png' });
process.exit(0);
