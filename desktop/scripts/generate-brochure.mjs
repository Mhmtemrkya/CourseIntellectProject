import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const outputDir = path.join(rootDir, 'marketing', 'brochure');
const shotsDir = path.join(outputDir, 'screenshots');
const baseUrl = process.env.BROCHURE_APP_URL || 'http://127.0.0.1:3000';
const apiUrl = process.env.BROCHURE_API_URL || 'http://127.0.0.1:5206';
const legalConsentVersion = '2026-05-02.kvkk.v1';

const users = {
  admin: { username: 'kurum.admin', password: 'KRM2026A' },
  platform: { username: 'admin@courseintlecct.com', password: 'Admin2026!' },
  finance: { username: 'muhasebe.selim', password: 'MHS2026A' },
  teacher: { username: 'ogrt.hasan', password: 'HYN2026A' },
  student: { username: 'ali10a241', password: 'ALI2026A' },
  parent: { username: 'veli.ayse', password: 'VLI2026A' },
};

const captures = [
  {
    key: 'admin-dashboard',
    user: 'admin',
    path: '/dashboard',
    viewport: { width: 1440, height: 920 },
  },
  {
    key: 'admin-schedule',
    user: 'admin',
    path: '/schedule',
    readySelector: '[data-testid="schedule-page"]',
    viewport: { width: 1440, height: 920 },
  },
  {
    key: 'teacher-workspace',
    user: 'teacher',
    path: '/t/dashboard',
    viewport: { width: 1440, height: 920 },
  },
  {
    key: 'finance-dashboard',
    user: 'finance',
    path: '/finance/dashboard',
    viewport: { width: 1440, height: 920 },
  },
  {
    key: 'platform-tenants',
    user: 'platform',
    path: '/sa/tenants',
    viewport: { width: 1440, height: 920 },
  },
  {
    key: 'student-mobile',
    user: 'student',
    path: '/s/dashboard',
    viewport: { width: 390, height: 844 },
    mobile: true,
  },
  {
    key: 'student-ai-mobile',
    user: 'student',
    path: '/s/ai',
    viewport: { width: 390, height: 844 },
    mobile: true,
  },
  {
    key: 'parent-mobile',
    user: 'parent',
    path: '/p/dashboard',
    viewport: { width: 390, height: 844 },
    mobile: true,
  },
];

const sessionCache = new Map();

function mapBackendRoleToDesktopRole(role) {
  switch ((role || '').toLowerCase()) {
    case 'admin':
    case 'developer':
      return 'admin';
    case 'accounting':
      return 'finance';
    case 'teacher':
      return 'teacher';
    case 'student':
      return 'student';
    case 'parent':
      return 'parent';
    case 'administrative':
      return 'administrative';
    default:
      return 'student';
  }
}

function getHomePathForRole(role, isPlatformAdmin) {
  switch (role) {
    case 'admin':
      return isPlatformAdmin ? '/sa/dashboard' : '/dashboard';
    case 'finance':
      return '/finance/dashboard';
    case 'teacher':
      return '/t/dashboard';
    case 'student':
      return '/s/dashboard';
    case 'parent':
      return '/p/dashboard';
    case 'administrative':
      return '/admin/operations';
    default:
      return '/dashboard';
  }
}

function createDesktopUser(payload) {
  const backendRole = payload?.user?.primaryRole || payload?.user?.role || '';
  const role = mapBackendRoleToDesktopRole(backendRole);
  const isPlatformAdmin = Boolean(payload?.user?.isPlatformAdmin);
  const tenantName = payload?.user?.tenantName || (isPlatformAdmin ? 'Platform' : 'CourseIntellect Desktop');

  return {
    id: payload?.user?.id || '',
    name: payload?.user?.fullName || payload?.user?.name || '',
    email: payload?.user?.email || `${payload?.user?.username || 'user'}@courseintellect.local`,
    role,
    backendRole,
    isPlatformAdmin,
    username: payload?.user?.username || '',
    tenantId: payload?.user?.tenantId || null,
    tenantSlug: payload?.user?.tenantSlug || '',
    tenant: tenantName,
    branch: payload?.user?.campus || 'Merkez Kampus',
    department: payload?.user?.departmentOrBranch || '',
    extraRoles: payload?.user?.extraRoles || [],
    homePath: getHomePathForRole(role, isPlatformAdmin),
  };
}

async function getSession(userKey) {
  if (sessionCache.has(userKey)) {
    return sessionCache.get(userKey);
  }

  const credentials = users[userKey];
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${userKey}: ${response.status}`);
  }

  const payload = await response.json();
  const session = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAtUtc: payload.expiresAtUtc,
    refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
    user: createDesktopUser(payload),
  };

  sessionCache.set(userKey, session);
  return session;
}

function initStorage({ session, version }) {
  localStorage.setItem('courseintellect-desktop-session', JSON.stringify(session));
  localStorage.setItem('courseintellect.legalConsent.status', 'accepted');
  localStorage.setItem('courseintellect.legalConsent.version', version);
  localStorage.setItem('courseintellect.legalConsent.decidedAt', new Date().toISOString());
  localStorage.setItem('courseintellect.legalConsent.marketing', 'true');
  localStorage.setItem('courseintellect.legalConsent.push', 'true');
  localStorage.setItem('courseintellect.legalConsent.analytics', 'true');
}

async function captureScreens(browser) {
  const results = {};
  for (const item of captures) {
    const session = await getSession(item.user);
    const context = await browser.newContext({
      viewport: item.viewport,
      isMobile: Boolean(item.mobile),
      deviceScaleFactor: item.mobile ? 2 : 1,
      userAgent: item.mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    await context.addInitScript(initStorage, { session, version: legalConsentVersion });
    const page = await context.newPage();

    const initialPath = session.user.homePath || item.path;
    await page.goto(`${baseUrl}${initialPath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);

    if (new URL(page.url()).pathname !== item.path) {
      await page.evaluate((targetPath) => {
        window.history.pushState({}, '', targetPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, item.path);
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      if (item.readySelector) {
        await page.waitForSelector(item.readySelector, { timeout: 15000 }).catch(() => {});
      }
      await page.waitForTimeout(1600);
    }

    if (item.mobile) {
      const closeButton = page.getByTestId('sidebar-close-button');
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true });
        await page.waitForTimeout(1000);
      }
      await page.addStyleTag({
        content: `
          [data-testid="sidebar"],
          [data-testid="sidebar-open-button"] {
            display: none !important;
          }
        `,
      });
      await page.waitForTimeout(300);
    }

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.style.scrollbarWidth = 'thin';
    });

    const outputPath = path.join(shotsDir, `${item.key}.png`);
    await page.screenshot({ path: outputPath, fullPage: false, animations: 'disabled' });
    results[item.key] = outputPath;
    await context.close();
  }

  return results;
}

function img(shots, key) {
  return pathToFileURL(shots[key]).href;
}

function featureList(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function brochureHtml(shots) {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #d7dde5;
      color: #101720;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .sheet {
      position: relative;
      width: 1600px;
      height: 2200px;
      overflow: hidden;
      background: #f7fafc;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
    .dark {
      background: linear-gradient(135deg, #07131d 0%, #102635 52%, #12423f 100%);
      color: white;
    }
    .topline {
      position: absolute;
      left: 90px;
      top: 76px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .mark {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: #d9790b;
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 900;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      width: max-content;
      border: 1px solid rgba(217, 121, 11, .35);
      color: #d9790b;
      background: rgba(217, 121, 11, .08);
      border-radius: 999px;
      padding: 12px 22px;
      font-weight: 800;
      font-size: 22px;
    }
    .dark .eyebrow {
      color: #ffd08a;
      background: rgba(255,255,255,.08);
      border-color: rgba(255,255,255,.14);
    }
    h1, h2, h3, p { margin: 0; }
    h1 {
      font-size: 112px;
      line-height: 1.02;
      letter-spacing: 0;
      max-width: 1180px;
    }
    h2 {
      font-size: 78px;
      line-height: 1.05;
      letter-spacing: 0;
      max-width: 1100px;
    }
    h3 {
      font-size: 34px;
      letter-spacing: 0;
    }
    .lead {
      margin-top: 34px;
      font-size: 34px;
      line-height: 1.42;
      color: rgba(255,255,255,.82);
      max-width: 1050px;
    }
    .light-lead {
      margin-top: 28px;
      font-size: 31px;
      line-height: 1.42;
      color: #536173;
      max-width: 1050px;
    }
    .hero-copy {
      position: absolute;
      left: 90px;
      top: 220px;
      z-index: 2;
    }
    .screen {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 34px;
      box-shadow: 0 34px 90px rgba(0,0,0,.32);
      border: 1px solid rgba(255,255,255,.18);
      background: #0b141c;
    }
    .desktop-frame {
      position: absolute;
      left: 90px;
      right: 90px;
      bottom: 150px;
      height: 830px;
      border-radius: 42px;
      padding: 18px;
      background: rgba(255,255,255,.1);
      box-shadow: 0 46px 120px rgba(0,0,0,.38);
    }
    .mobile-frame {
      position: absolute;
      right: 120px;
      bottom: 92px;
      width: 365px;
      height: 790px;
      padding: 14px;
      border-radius: 56px;
      background: #071016;
      box-shadow: 0 42px 100px rgba(0,0,0,.45);
      border: 1px solid rgba(255,255,255,.22);
      z-index: 3;
    }
    .mobile-frame img {
      border-radius: 42px;
      box-shadow: none;
      border: 0;
    }
    .metrics {
      position: absolute;
      left: 90px;
      right: 90px;
      bottom: 62px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      z-index: 4;
    }
    .metric {
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 24px;
      padding: 24px 26px;
    }
    .metric strong {
      display: block;
      font-size: 42px;
      color: #ffd08a;
    }
    .metric span {
      display: block;
      margin-top: 8px;
      font-size: 19px;
      color: rgba(255,255,255,.72);
    }
    .page-head {
      position: absolute;
      left: 90px;
      top: 86px;
      right: 90px;
    }
    .grid-two {
      position: absolute;
      left: 90px;
      right: 90px;
      top: 430px;
      display: grid;
      grid-template-columns: 1.15fr .85fr;
      gap: 42px;
      align-items: start;
    }
    .grid-two.even {
      grid-template-columns: .86fr 1.14fr;
    }
    .shot-card {
      border-radius: 38px;
      padding: 14px;
      background: #111c27;
      box-shadow: 0 32px 80px rgba(15, 23, 42, .20);
      border: 1px solid rgba(15,23,42,.08);
    }
    .shot-card img {
      width: 100%;
      height: 720px;
      object-fit: cover;
      object-position: top left;
      border-radius: 28px;
      display: block;
    }
    .copy-panel {
      background: #ffffff;
      border: 1px solid #e3e9f0;
      border-radius: 34px;
      padding: 44px;
      box-shadow: 0 24px 70px rgba(15,23,42,.08);
    }
    .copy-panel h3 { color: #0f2534; }
    .copy-panel p {
      margin-top: 16px;
      color: #526173;
      font-size: 25px;
      line-height: 1.45;
    }
    ul.features {
      list-style: none;
      padding: 0;
      margin: 32px 0 0;
      display: grid;
      gap: 16px;
    }
    ul.features li {
      position: relative;
      padding: 18px 18px 18px 52px;
      border-radius: 18px;
      background: #f2f6fa;
      color: #1f2d3a;
      font-size: 23px;
      line-height: 1.28;
      font-weight: 650;
    }
    ul.features li::before {
      content: "";
      position: absolute;
      left: 20px;
      top: 25px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #d9790b;
    }
    .band {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 260px;
      background: #0c1c28;
      color: #fff;
      padding: 58px 90px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 28px;
    }
    .band strong {
      display: block;
      color: #ffd08a;
      font-size: 28px;
    }
    .band span {
      display: block;
      margin-top: 12px;
      color: rgba(255,255,255,.72);
      font-size: 21px;
      line-height: 1.34;
    }
    .phones {
      position: absolute;
      top: 410px;
      left: 110px;
      right: 110px;
      display: flex;
      justify-content: center;
      gap: 64px;
      align-items: flex-start;
    }
    .phone {
      width: 410px;
      height: 888px;
      padding: 16px;
      border-radius: 58px;
      background: #081018;
      border: 1px solid rgba(255,255,255,.18);
      box-shadow: 0 36px 90px rgba(0,0,0,.25);
    }
    .phone img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      border-radius: 44px;
    }
    .phone-label {
      margin-top: 24px;
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      color: #0f2534;
    }
    .timeline {
      position: absolute;
      left: 90px;
      right: 90px;
      top: 510px;
      display: grid;
      gap: 26px;
    }
    .step {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 28px;
      align-items: start;
      padding: 32px;
      background: #fff;
      border: 1px solid #e3e9f0;
      border-radius: 30px;
      box-shadow: 0 20px 60px rgba(15,23,42,.08);
    }
    .step-num {
      width: 86px;
      height: 86px;
      display: grid;
      place-items: center;
      border-radius: 24px;
      background: #d9790b;
      color: white;
      font-size: 32px;
      font-weight: 900;
    }
    .step h3 { font-size: 31px; }
    .step p {
      margin-top: 10px;
      color: #566475;
      font-size: 23px;
      line-height: 1.42;
    }
    .footer-note {
      position: absolute;
      left: 90px;
      right: 90px;
      bottom: 72px;
      padding-top: 34px;
      border-top: 1px solid rgba(15,23,42,.12);
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 22px;
    }
  </style>
</head>
<body>
  <section class="sheet dark" id="page-01">
    <div class="topline"><div class="mark">CI</div><span>CourseIntellect</span></div>
    <div class="hero-copy">
      <div class="eyebrow">Gerçek ürün ekranlarıyla tanıtım broşürü</div>
      <h1 style="margin-top:30px">Kurum yönetimi, akademi ve finans tek platformda.</h1>
      <p class="lead">Web, desktop ve mobil deneyimi aynı veri üzerinde çalışır. Kurum yöneticisi, öğretmen, öğrenci, veli ve muhasebe ekipleri için ayrı paneller sunar.</p>
    </div>
    <div class="desktop-frame"><img class="screen" src="${img(shots, 'admin-dashboard')}" /></div>
    <div class="mobile-frame"><img class="screen" src="${img(shots, 'student-mobile')}" /></div>
    <div class="metrics">
      <div class="metric"><strong>7 rol</strong><span>Yönetici, öğretmen, öğrenci, veli, idari, finans, platform</span></div>
      <div class="metric"><strong>Mobil + Web</strong><span>Gerçek zamanlı kurum deneyimi</span></div>
      <div class="metric"><strong>Finans</strong><span>Tahsilat, taksit, fatura, makbuz</span></div>
      <div class="metric"><strong>AI</strong><span>Öğrenci destek ve platform AI yönetimi</span></div>
    </div>
  </section>

  <section class="sheet" id="page-02">
    <div class="page-head">
      <div class="eyebrow">Kurum Yönetimi</div>
      <h2 style="margin-top:28px">Sınıf, öğretmen, ders programı ve operasyon tek merkezde.</h2>
      <p class="light-lead">Kurum yöneticisi, canlı backend verisiyle öğrenci, veli, öğretmen ve sınıf yönetimini takip eder. Ders programında çakışma ve branş kuralları backend tarafından korunur.</p>
    </div>
    <div class="grid-two">
      <div class="shot-card"><img src="${img(shots, 'admin-schedule')}" /></div>
      <div class="copy-panel">
        <h3>Yönetim paneli</h3>
        <p>Kurum bazlı çalışma sayesinde her okulun sınıf, personel ve ders programı kendi alanında yönetilir.</p>
        <ul class="features">
          ${featureList([
            'Öğrenci, veli, öğretmen ve personel kayıtları',
            'Sınıf ve grup yönetimi',
            'Ders programı oluşturma ve çakışma engeli',
            'Öğretmen branşına göre ders atama',
            'Duyuru, belge, bildirim ve idari kayıtlar',
          ])}
        </ul>
      </div>
    </div>
    <div class="band">
      <div><strong>Operasyon</strong><span>Görev merkezi, KPI paneli, global arama ve idari iş akışları.</span></div>
      <div><strong>Akademik</strong><span>Program, içerik, sınav, soru bankası, ödev ve raporlama.</span></div>
      <div><strong>Güvenlik</strong><span>Rol yönetimi, onay süreçleri ve kurum bazlı veri ayrımı.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-03">
    <div class="page-head">
      <div class="eyebrow">Öğretmen ve Akademik Süreç</div>
      <h2 style="margin-top:28px">Öğretmen kendi sınıfını, içeriğini ve öğrenci takibini yönetir.</h2>
      <p class="light-lead">Ders programı, yoklama, ödev, soru bankası, sınavlar, canlı ders ve haftalık raporlar öğretmen panelinde bir araya gelir.</p>
    </div>
    <div class="grid-two even">
      <div class="copy-panel">
        <h3>Öğretmen çalışma alanı</h3>
        <p>Öğretmen paneli günlük akışı hızlandırmak için akademik işlemleri tek ekranda toplar.</p>
        <ul class="features">
          ${featureList([
            'Ders programı ve yoklama',
            'İçerik stüdyosu ve konu anlatımı',
            'Soru bankası ve soru cevap iş akışı',
            'Ödev oluşturma ve teslim merkezi',
            'Canlı ders odası ve öğretmen raporları',
          ])}
        </ul>
      </div>
      <div class="shot-card"><img src="${img(shots, 'teacher-workspace')}" /></div>
    </div>
    <div class="band">
      <div><strong>Soru Bankası</strong><span>Konu, sınıf ve zorluk bazlı soru yönetimi.</span></div>
      <div><strong>Ödev</strong><span>Öğrenci teslimleri ve öğretmen kontrol merkezi.</span></div>
      <div><strong>Canlı Ders</strong><span>Öğrenci ve öğretmen için canlı ders akışı.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-04">
    <div class="page-head">
      <div class="eyebrow">Mobil Deneyim</div>
      <h2 style="margin-top:28px">Öğrenci ve veli tarafı cebinde çalışır.</h2>
      <p class="light-lead">Öğrenci ders programını, çalışmalarını, sınav sonuçlarını ve AI destek ekranını takip eder. Veli devamsızlık, ödeme, duyuru, görüşme ve haftalık rapor akışına ulaşır.</p>
    </div>
    <div class="phones">
      <div><div class="phone"><img src="${img(shots, 'student-mobile')}" /></div><div class="phone-label">Öğrenci</div></div>
      <div><div class="phone"><img src="${img(shots, 'student-ai-mobile')}" /></div><div class="phone-label">CourseIntellect AI</div></div>
      <div><div class="phone"><img src="${img(shots, 'parent-mobile')}" /></div><div class="phone-label">Veli</div></div>
    </div>
    <div class="band">
      <div><strong>Öğrenci</strong><span>Ders programı, çalışma planı, QR yoklama, sınavlar ve yanlışlarım.</span></div>
      <div><strong>Veli</strong><span>Devamsızlık, ödeme, makbuz, görüşme, mazeret ve duyurular.</span></div>
      <div><strong>İletişim</strong><span>Rol bazlı mesajlaşma, bildirim ve geri bildirim akışı.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-05">
    <div class="page-head">
      <div class="eyebrow">Finans ve Platform Yönetimi</div>
      <h2 style="margin-top:28px">Tahsilat, faturalama ve kurum onayı aynı sistemde.</h2>
      <p class="light-lead">Muhasebe paneli öğrenci hesapları, taksitler, makbuzlar, geciken ödemeler ve kasa raporunu yönetir. Platform paneli kurumları, planları, destek taleplerini ve özelleştirmeyi kontrol eder.</p>
    </div>
    <div class="grid-two">
      <div class="shot-card"><img src="${img(shots, 'finance-dashboard')}" /></div>
      <div class="copy-panel">
        <h3>Gelir ve abonelik akışı</h3>
        <p>Finans operasyonları kurum içinde, platform abonelikleri ise merkezi yönetimde takip edilir.</p>
        <ul class="features">
          ${featureList([
            'Tahsilat, taksit, fatura ve makbuz yönetimi',
            'Geciken ödemeler ve otomatik hatırlatma akışları',
            'İndirim, burs, maaş ve kasa raporları',
            'Kurum onayı, paketler ve platform faturalama',
            'Kurum marka/tema özelleştirme',
          ])}
        </ul>
      </div>
    </div>
    <div style="position:absolute;left:760px;right:90px;bottom:326px;height:435px" class="shot-card"><img style="height:405px" src="${img(shots, 'platform-tenants')}" /></div>
  </section>

  <section class="sheet" id="page-06">
    <div class="page-head">
      <div class="eyebrow">Pilot Kurulum Modeli</div>
      <h2 style="margin-top:28px">Bugün satış, 30 gün içinde kuruma özel canlı geçiş.</h2>
      <p class="light-lead">Ürün demo verileriyle gösterilir; satış sonrası kurumun gerçek sınıf, personel, öğrenci, veli ve finans yapısına göre uyarlanır.</p>
    </div>
    <div class="timeline">
      <div class="step"><div class="step-num">1</div><div><h3>Ön satış ve pilot kurum anlaşması</h3><p>Kurum ihtiyaçları, kullanıcı rolleri, şube yapısı ve kullanılacak modüller netleştirilir.</p></div></div>
      <div class="step"><div class="step-num">2</div><div><h3>Veri hazırlığı ve kurulum</h3><p>Öğrenci, veli, öğretmen, sınıf, ders ve finans verileri sisteme aktarılır. Kurum markası uygulanır.</p></div></div>
      <div class="step"><div class="step-num">3</div><div><h3>Test, eğitim ve canlı kullanım</h3><p>Yönetici, öğretmen, öğrenci, veli ve muhasebe rolleriyle test yapılır. Ekip eğitimi sonrası canlı geçiş tamamlanır.</p></div></div>
      <div class="step"><div class="step-num">4</div><div><h3>İlk ay destek ve geliştirme</h3><p>Kurumdan gelen gerçek kullanım geri bildirimleriyle öncelikli iyileştirmeler yapılır.</p></div></div>
    </div>
    <div class="footer-note"><span>CourseIntellect Eğitim Yönetim Platformu</span><span>Web + Desktop + Mobil + Backend</span></div>
  </section>
</body>
</html>`;
}

async function renderBrochure(browser, shots) {
  const html = brochureHtml(shots);
  const htmlPath = path.join(outputDir, 'brochure-source.html');
  await fs.writeFile(htmlPath, html, 'utf8');

  const context = await browser.newContext({
    viewport: { width: 1600, height: 2200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  await page.waitForTimeout(500);

  const pageIds = ['page-01', 'page-02', 'page-03', 'page-04', 'page-05', 'page-06'];
  const outputs = [];
  for (const [index, id] of pageIds.entries()) {
    const element = page.locator(`#${id}`);
    const filePath = path.join(outputDir, `courseintellect-brochure-${String(index + 1).padStart(2, '0')}.png`);
    await element.screenshot({ path: filePath, animations: 'disabled' });
    outputs.push(filePath);
  }

  await context.close();
  return { htmlPath, outputs };
}

await fs.mkdir(shotsDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const shots = await captureScreens(browser);
  const result = await renderBrochure(browser, shots);
  console.log(JSON.stringify({
    outputDir,
    screenshots: shots,
    brochureHtml: result.htmlPath,
    pages: result.outputs,
  }, null, 2));
} finally {
  await browser.close();
}
