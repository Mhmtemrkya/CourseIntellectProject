// Light mode + marka paleti doğrulama: build'i statik sunar, admin/finance
// sayfalarını light & dark + kırmızı accent varyantıyla yakalar.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = '/Users/oguzhanmindivanli/Desktop/CourseIntellectProject';
const requireFromDesktop = createRequire(path.join(repoRoot, 'desktop', 'package.json'));
const { chromium } = requireFromDesktop('playwright');
const buildDir = path.join(repoRoot, 'desktop', 'build');
const outputRoot = path.join(repoRoot, 'screenshots', 'light-mode-verify');
const port = 4193;
const baseUrl = `http://127.0.0.1:${port}`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let urlPath = decodeURIComponent(new URL(req.url, baseUrl).pathname);
        // homepage:"./" nedeniyle derin rotalarda (/finance/...) statik istekler
        // /finance/static/... olarak gelir — build köküne indirge.
        const staticIdx = urlPath.indexOf('/static/');
        if (staticIdx > 0) urlPath = urlPath.slice(staticIdx);
        let filePath = path.join(buildDir, urlPath);
        let data;
        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
          data = await fs.readFile(filePath);
        } catch {
          filePath = path.join(buildDir, 'index.html');
          data = await fs.readFile(filePath);
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        res.writeHead(500); res.end(String(err));
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const routes = [
  ['/dashboard', 'dashboard'],
  ['/students', 'students'],
  ['/finance/dashboard', 'finance-dashboard'],
  ['/finance/student-accounts', 'finance-student-accounts'],
  ['/reports', 'reports'],
  ['/settings', 'settings'],
];

// Marka değişkenlerini uygulamanın kendi üreticisiyle hesapla. src/lib altındaki
// dosya ESM ama .js uzantılı (desktop paketi CJS) — geçici .mjs kopyasından import et.
import os from 'node:os';
const paletteSrc = path.join(repoRoot, 'desktop', 'src', 'lib', 'colorPalette.js');
const paletteTmp = path.join(os.tmpdir(), `ci-colorPalette-${Date.now()}.mjs`);
await fs.copyFile(paletteSrc, paletteTmp);
const { generateBrandCSSVariables } = await import(paletteTmp);
await fs.rm(paletteTmp, { force: true });

// TenantCustomization.jsx'teki hazır palet seçenekleri (orayla senkron tut)
const PRESETS = [
  { id: 'default', primary: '#00354F', accent: '#D9790B' },
  { id: 'blue', primary: '#1e40af', accent: '#3b82f6' },
  { id: 'green', primary: '#166534', accent: '#22c55e' },
  { id: 'purple', primary: '#581c87', accent: '#a855f7' },
  { id: 'red', primary: '#991b1b', accent: '#ef4444' },
  { id: 'teal', primary: '#115e59', accent: '#14b8a6' },
];

const session = {
  accessToken: 'screenshot-token',
  refreshToken: 'screenshot-refresh-token',
  expiresAtUtc: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiresAtUtc: '2099-01-01T00:00:00.000Z',
  user: {
    id: 'verify-admin', name: 'Burak', email: 'burak@courseintellect.com',
    role: 'admin', backendRole: 'admin', isPlatformAdmin: false,
    username: 'burak', tenantId: 'demo-tenant', tenantSlug: 'ozel-yildiz-koleji',
    tenant: 'Özel Yıldız Koleji', branch: 'Merkez Kampüs', department: '',
    extraRoles: [], modules: [], permissions: [], hasRoleManagementPolicy: false,
    homePath: '/dashboard', mustChangePassword: false, subscriptionRequired: false,
  },
};

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
const server = await startServer();
console.log('server up');

const browser = await chromium.launch({ headless: true });
// Baz temalar tüm sayfalarda; her palet light'ta tüm sayfalarda, dark'ta
// yoğun accent kullanan iki sayfada spot-check edilir.
const variants = [
  { key: 'light', theme: 'light' },
  { key: 'dark', theme: 'dark' },
  ...PRESETS.flatMap((p) => [
    { key: `light-${p.id}`, theme: 'light', preset: p },
    { key: `dark-${p.id}`, theme: 'dark', preset: p, routes: [['/dashboard', 'dashboard'], ['/reports', 'reports']] },
  ]),
];

for (const variant of variants) {
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1512, height: 982 } });
  await context.addInitScript(({ session, theme }) => {
    window.localStorage.setItem('courseintellect-desktop-session', JSON.stringify(session));
    window.localStorage.setItem('courseintellect-theme', theme);
    window.localStorage.setItem('ci-branch-selected', '1');
    window.localStorage.setItem('courseintellect.legalConsent.status', 'accepted');
    window.localStorage.setItem('courseintellect.legalConsent.version', '2026-05-02.kvkk.v1');
    window.localStorage.setItem('courseintellect.legalConsent.decidedAt', new Date().toISOString());
  }, { session, theme: variant.theme });

  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const presetVars = variant.preset
    ? generateBrandCSSVariables(variant.preset.primary, variant.preset.accent, variant.theme)
    : null;

  for (const [route, name] of (variant.routes || routes)) {
    try {
      await page.goto(route, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1600);
      // İlk yüklemede oturum okunmadan DashboardLayout /login'e, Login de
      // homePath'e atabiliyor; rota kaydıysa uygulama içi navigasyonla geri dön.
      const landed = await page.evaluate(() => window.location.pathname);
      if (landed !== route) {
        await page.evaluate((r) => {
          window.history.pushState({}, '', r);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, route);
        await page.waitForTimeout(1600);
      }
      if (presetVars) {
        // ThemeContext.applyBrandVariables ile aynı: root'a inline yaz
        await page.evaluate((vars) => {
          for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
        }, presetVars);
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: path.join(outputRoot, `${variant.key}-${name}.png`), fullPage: false, animations: 'disabled' });
      console.log(`ok: ${variant.key} ${route}`);
    } catch (err) {
      console.log(`FAIL: ${variant.key} ${route}: ${err.message}`);
    }
  }
  await context.close();
  if (consoleErrors.length) console.log(`console errors (${variant.key}):`, consoleErrors.slice(0, 5));
}

await browser.close();
server.close();
console.log('done ->', outputRoot);
