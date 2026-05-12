import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const outputDir = path.join(rootDir, 'marketing', 'brochure-premium');
const sourceShotsDir = path.join(rootDir, 'marketing', 'brochure', 'screenshots');
const logoPath = path.join(rootDir, 'desktop', 'src', 'assets', 'brand', 'logo.png');

const shots = {
  admin: path.join(sourceShotsDir, 'admin-dashboard.png'),
  schedule: path.join(sourceShotsDir, 'admin-schedule.png'),
  teacher: path.join(sourceShotsDir, 'teacher-workspace.png'),
  finance: path.join(sourceShotsDir, 'finance-dashboard.png'),
  platform: path.join(sourceShotsDir, 'platform-tenants.png'),
  student: path.join(sourceShotsDir, 'student-mobile.png'),
  ai: path.join(sourceShotsDir, 'student-ai-mobile.png'),
  parent: path.join(sourceShotsDir, 'parent-mobile.png'),
};

function asset(filePath) {
  return pathToFileURL(filePath).href;
}

function featureItems(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function rolePills(items) {
  return items.map((item) => `<span>${item}</span>`).join('');
}

async function ensureAssets() {
  const required = [logoPath, ...Object.values(shots)];
  const missing = [];

  for (const filePath of required) {
    try {
      await fs.access(filePath);
    } catch {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Premium brochure assets are missing:\n${missing.join('\n')}\nRun desktop/scripts/generate-brochure.mjs first.`);
  }
}

function brochureHtml() {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    :root {
      --navy: #00354f;
      --navy-2: #082132;
      --ink: #081723;
      --muted: #637387;
      --paper: #f5f8fb;
      --line: #d9e3ec;
      --orange: #d9790b;
      --orange-2: #ffab2f;
      --teal: #00a8a8;
      --cyan: #18b7d4;
      --green: #31c878;
      --violet: #8b5cf6;
    }
    html, body {
      margin: 0;
      background: #cfd8e3;
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .sheet {
      position: relative;
      width: 1600px;
      height: 2200px;
      overflow: hidden;
      background:
        linear-gradient(120deg, rgba(0, 53, 79, .055) 0 1px, transparent 1px 80px),
        linear-gradient(30deg, rgba(217, 121, 11, .055) 0 1px, transparent 1px 92px),
        var(--paper);
      border: 1px solid rgba(8, 23, 35, .12);
    }
    .dark {
      color: #fff;
      background:
        linear-gradient(112deg, rgba(255,255,255,.045) 0 1px, transparent 1px 74px),
        linear-gradient(24deg, rgba(255,171,47,.065) 0 1px, transparent 1px 96px),
        linear-gradient(138deg, #04111a 0%, #08263a 52%, #03434a 100%);
    }
    .brand-row {
      position: absolute;
      left: 86px;
      top: 64px;
      display: flex;
      align-items: center;
      gap: 22px;
      z-index: 10;
    }
    .brand-row img {
      width: 104px;
      height: 104px;
      object-fit: contain;
    }
    .brand-word {
      font-size: 42px;
      font-weight: 950;
      letter-spacing: 0;
      color: #fff;
    }
    .brand-word .accent { color: var(--orange-2); }
    .light-brand .brand-word { color: var(--navy); }
    .light-brand .brand-word .accent { color: var(--orange); }
    .cover-logo {
      position: absolute;
      right: 82px;
      top: 72px;
      width: 260px;
      height: 260px;
      object-fit: contain;
      opacity: .9;
      filter: drop-shadow(0 24px 40px rgba(0,0,0,.25));
      z-index: 4;
    }
    .kicker {
      display: inline-flex;
      width: max-content;
      align-items: center;
      gap: 14px;
      border: 1px solid rgba(217, 121, 11, .35);
      color: var(--orange);
      background: rgba(217, 121, 11, .08);
      border-radius: 999px;
      padding: 13px 22px;
      font-size: 23px;
      font-weight: 900;
    }
    .dark .kicker {
      color: #ffd28f;
      background: rgba(255,255,255,.08);
      border-color: rgba(255,255,255,.16);
    }
    h1, h2, h3, p { margin: 0; letter-spacing: 0; }
    h1 {
      font-size: 126px;
      line-height: .96;
      font-weight: 980;
      max-width: 1160px;
    }
    h2 {
      font-size: 82px;
      line-height: 1.02;
      font-weight: 980;
      max-width: 1160px;
    }
    h3 {
      font-size: 36px;
      line-height: 1.12;
      font-weight: 900;
    }
    .lead {
      margin-top: 30px;
      font-size: 35px;
      line-height: 1.38;
      color: rgba(255,255,255,.82);
      max-width: 1020px;
    }
    .light-lead {
      margin-top: 26px;
      font-size: 31px;
      line-height: 1.42;
      color: var(--muted);
      max-width: 1080px;
    }
    .cover-copy {
      position: absolute;
      left: 86px;
      top: 306px;
      z-index: 5;
    }
    .cover-slash {
      position: absolute;
      right: -250px;
      top: 0;
      width: 780px;
      height: 2200px;
      background: linear-gradient(180deg, rgba(217,121,11,.82), rgba(0,168,168,.62));
      transform: skewX(-13deg);
      transform-origin: top;
      opacity: .78;
      z-index: 1;
    }
    .cover-montage {
      position: absolute;
      left: 74px;
      right: 66px;
      bottom: 192px;
      height: 850px;
      z-index: 3;
    }
    .laptop {
      position: absolute;
      left: 0;
      right: 290px;
      top: 60px;
      height: 730px;
      padding: 18px;
      border-radius: 42px;
      background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.2);
      box-shadow: 0 48px 130px rgba(0,0,0,.42);
    }
    .laptop img, .screen-card img, .phone img, .mini-screen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top left;
      display: block;
    }
    .laptop img {
      border-radius: 28px;
    }
    .hero-phone {
      position: absolute;
      right: 18px;
      top: 0;
      width: 390px;
      height: 812px;
      padding: 15px;
      border-radius: 58px;
      background: #071018;
      border: 1px solid rgba(255,255,255,.24);
      box-shadow: 0 46px 120px rgba(0,0,0,.5);
    }
    .hero-phone img {
      border-radius: 44px;
    }
    .cover-stats {
      position: absolute;
      left: 86px;
      right: 86px;
      bottom: 60px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 22px;
      z-index: 6;
    }
    .stat-tile {
      min-height: 146px;
      border-radius: 28px;
      padding: 25px 26px;
      color: #fff;
      background: rgba(255,255,255,.11);
      border: 1px solid rgba(255,255,255,.18);
      backdrop-filter: blur(12px);
    }
    .stat-tile strong {
      display: block;
      font-size: 42px;
      color: #ffd28f;
      line-height: 1;
    }
    .stat-tile span {
      display: block;
      margin-top: 12px;
      font-size: 20px;
      line-height: 1.25;
      color: rgba(255,255,255,.76);
    }
    .page-head {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 82px;
      z-index: 4;
    }
    .chapter {
      position: absolute;
      right: 86px;
      top: 78px;
      font-size: 21px;
      font-weight: 900;
      color: rgba(8,23,35,.42);
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .dark .chapter { color: rgba(255,255,255,.42); }
    .diagonal-panel {
      position: absolute;
      right: -170px;
      top: 0;
      width: 660px;
      height: 2200px;
      transform: skewX(-12deg);
      background: linear-gradient(180deg, rgba(0,53,79,.08), rgba(217,121,11,.14));
      z-index: 1;
    }
    .feature-grid {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 515px;
      display: grid;
      grid-template-columns: 1.02fr .98fr;
      gap: 42px;
      z-index: 3;
    }
    .feature-grid.reverse {
      grid-template-columns: .92fr 1.08fr;
    }
    .screen-card {
      position: relative;
      min-height: 760px;
      border-radius: 40px;
      padding: 16px;
      background: #081723;
      border: 1px solid rgba(8,23,35,.12);
      box-shadow: 0 34px 90px rgba(8,23,35,.2);
      overflow: hidden;
    }
    .screen-card img {
      border-radius: 28px;
    }
    .screen-card.tilt-left {
      transform: rotate(-1.4deg);
    }
    .screen-card.tilt-right {
      transform: rotate(1.2deg);
    }
    .screen-card .tag {
      position: absolute;
      left: 34px;
      top: 34px;
      padding: 12px 17px;
      border-radius: 999px;
      color: #fff;
      background: rgba(0,53,79,.88);
      border: 1px solid rgba(255,255,255,.18);
      font-size: 18px;
      font-weight: 900;
      z-index: 5;
    }
    .insight-card {
      min-height: 760px;
      border-radius: 40px;
      padding: 48px;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(217,227,236,.95);
      box-shadow: 0 30px 90px rgba(8,23,35,.12);
    }
    .insight-card.dark-card {
      color: #fff;
      background: linear-gradient(145deg, #061622, #0a3546);
      border-color: rgba(255,255,255,.14);
    }
    .insight-card p {
      margin-top: 18px;
      font-size: 28px;
      line-height: 1.42;
      color: var(--muted);
    }
    .dark-card p {
      color: rgba(255,255,255,.72);
    }
    .feature-list {
      list-style: none;
      padding: 0;
      margin: 34px 0 0;
      display: grid;
      gap: 17px;
    }
    .feature-list li {
      position: relative;
      min-height: 72px;
      border-radius: 20px;
      padding: 20px 22px 20px 60px;
      background: #eef4f8;
      color: #102536;
      font-size: 24px;
      font-weight: 750;
      line-height: 1.25;
    }
    .dark-card .feature-list li {
      background: rgba(255,255,255,.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,.08);
    }
    .feature-list li::before {
      content: "";
      position: absolute;
      left: 24px;
      top: 27px;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--orange), var(--orange-2));
      box-shadow: 0 0 0 6px rgba(217,121,11,.14);
    }
    .role-map {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 650px;
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 38px;
      z-index: 4;
    }
    .role-board {
      min-height: 1160px;
      border-radius: 42px;
      padding: 42px;
      color: #fff;
      background:
        linear-gradient(90deg, rgba(255,255,255,.045) 0 1px, transparent 1px 86px),
        linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 86px),
        linear-gradient(140deg, #071923, #0a3b4c);
      border: 1px solid rgba(255,255,255,.16);
      box-shadow: 0 34px 100px rgba(8,23,35,.23);
    }
    .role-row {
      display: grid;
      grid-template-columns: 132px 1fr;
      gap: 26px;
      align-items: start;
      padding: 26px 0;
      border-bottom: 1px solid rgba(255,255,255,.12);
    }
    .role-row:last-child { border-bottom: 0; }
    .role-icon {
      display: grid;
      place-items: center;
      width: 100px;
      height: 100px;
      border-radius: 28px;
      color: #fff;
      font-size: 42px;
      font-weight: 950;
      background: linear-gradient(135deg, var(--orange), var(--orange-2));
      box-shadow: 0 18px 42px rgba(217,121,11,.28);
    }
    .role-row h3 { font-size: 31px; }
    .role-row p {
      margin-top: 9px;
      color: rgba(255,255,255,.72);
      font-size: 22px;
      line-height: 1.36;
    }
    .pill-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 25px;
    }
    .pill-cloud span {
      padding: 12px 16px;
      border-radius: 999px;
      color: #0f2635;
      background: #fff;
      font-size: 18px;
      font-weight: 850;
    }
    .mini-stack {
      display: grid;
      gap: 26px;
    }
    .mini-screen {
      height: 352px;
      border-radius: 34px;
      padding: 12px;
      background: #081723;
      box-shadow: 0 24px 70px rgba(8,23,35,.18);
      transform: rotate(1deg);
    }
    .mini-screen:nth-child(2) { transform: rotate(-1deg); }
    .mini-screen:nth-child(3) { transform: rotate(.6deg); }
    .mini-screen img { border-radius: 24px; }
    .phone-row {
      position: absolute;
      left: 88px;
      right: 88px;
      top: 470px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 52px;
      z-index: 4;
    }
    .phone-card {
      text-align: center;
    }
    .phone {
      height: 900px;
      padding: 15px;
      border-radius: 62px;
      background: #071018;
      border: 1px solid rgba(255,255,255,.18);
      box-shadow: 0 42px 110px rgba(8,23,35,.25);
    }
    .phone img {
      border-radius: 46px;
      object-position: top center;
    }
    .phone-card h3 {
      margin-top: 24px;
      color: var(--navy);
    }
    .bottom-band {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 270px;
      padding: 54px 86px;
      color: #fff;
      background: linear-gradient(90deg, #071723, #0b3141);
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 34px;
      z-index: 7;
    }
    .bottom-band strong {
      display: block;
      color: #ffd28f;
      font-size: 30px;
      font-weight: 950;
    }
    .bottom-band span {
      display: block;
      margin-top: 12px;
      font-size: 21px;
      line-height: 1.32;
      color: rgba(255,255,255,.74);
    }
    .deal-wrap {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 675px;
      display: grid;
      grid-template-columns: .9fr 1.1fr;
      gap: 40px;
      z-index: 4;
    }
    .deal-card {
      border-radius: 44px;
      padding: 46px;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: 0 28px 90px rgba(8,23,35,.1);
    }
    .price-card {
      color: #fff;
      background:
        linear-gradient(90deg, rgba(255,255,255,.055) 0 1px, transparent 1px 74px),
        linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 74px),
        linear-gradient(145deg, #061622, #0a3e4d);
      border-color: rgba(255,255,255,.14);
    }
    .deal-card p {
      margin-top: 14px;
      color: var(--muted);
      font-size: 25px;
      line-height: 1.4;
    }
    .price-card p { color: rgba(255,255,255,.72); }
    .big-number {
      margin-top: 30px;
      color: #ffd28f;
      font-size: 108px;
      line-height: 1;
      font-weight: 990;
    }
    .process {
      margin-top: 34px;
      display: grid;
      gap: 18px;
    }
    .process div {
      display: grid;
      grid-template-columns: 70px 1fr;
      gap: 18px;
      align-items: start;
      padding: 20px;
      border-radius: 24px;
      background: #f0f5f8;
    }
    .process b {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      color: #fff;
      background: var(--orange);
      font-size: 24px;
    }
    .process strong {
      display: block;
      color: #112638;
      font-size: 24px;
    }
    .process span {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 20px;
      line-height: 1.3;
    }
    .closing-logo {
      width: 210px;
      height: 210px;
      object-fit: contain;
      margin-bottom: 12px;
    }
    .footer {
      position: absolute;
      left: 86px;
      right: 86px;
      bottom: 66px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(8,23,35,.13);
      padding-top: 28px;
      color: #64748b;
      font-size: 23px;
      z-index: 4;
    }
  </style>
</head>
<body>
  <section class="sheet dark" id="page-01">
    <div class="cover-slash"></div>
    <div class="brand-row">
      <img src="${asset(logoPath)}" alt="CourseIntellect" />
      <div class="brand-word">Course<span class="accent">Intellect</span></div>
    </div>
    <img class="cover-logo" src="${asset(logoPath)}" alt="" />
    <div class="cover-copy">
      <div class="kicker">Kurumsal Tanıtım Dosyası</div>
      <h1 style="margin-top:32px">CourseIntellect Eğitim Yönetim Platformu</h1>
      <p class="lead">Kurum yönetimi, akademik operasyon, finans süreçleri ve mobil paydaş deneyimi tek platformda birleşir.</p>
    </div>
    <div class="cover-montage">
      <div class="laptop"><img src="${asset(shots.schedule)}" alt="Ders programı ekranı" /></div>
      <div class="hero-phone"><img src="${asset(shots.ai)}" alt="Mobil AI ekranı" /></div>
    </div>
    <div class="cover-stats">
      <div class="stat-tile"><strong>7 rol</strong><span>Yönetici, öğretmen, öğrenci, veli, finans, idari, platform</span></div>
      <div class="stat-tile"><strong>3 kanal</strong><span>Web, desktop ve mobil tek backend ile çalışır</span></div>
      <div class="stat-tile"><strong>Canlı veri</strong><span>Kurum bazlı sınıf, program, ödeme ve bildirim akışı</span></div>
      <div class="stat-tile"><strong>AI destek</strong><span>Öğrenci çalışma desteği ve platform AI yönetimi</span></div>
    </div>
  </section>

  <section class="sheet" id="page-02">
    <div class="diagonal-panel"></div>
    <div class="brand-row light-brand">
      <img src="${asset(logoPath)}" alt="CourseIntellect" />
      <div class="brand-word">Course<span class="accent">Intellect</span></div>
    </div>
    <div class="chapter">Platform Kapsamı</div>
    <div class="page-head" style="top:210px">
      <div class="kicker">Rol Bazlı Kullanım</div>
      <h2 style="margin-top:26px">Kurum yönetimi için entegre rol mimarisi.</h2>
      <p class="light-lead">Yönetici, öğretmen, öğrenci, veli, finans ve platform ekipleri kendi iş akışlarında çalışırken kurum verisi merkezi olarak izlenir.</p>
    </div>
    <div class="role-map">
      <div class="role-board">
        <div class="role-row"><div class="role-icon">Y</div><div><h3>Kurum yöneticisi</h3><p>Sınıf, öğrenci, veli, öğretmen, ders programı, görev ve bildirim akışını yönetir.</p></div></div>
        <div class="role-row"><div class="role-icon">Ö</div><div><h3>Öğretmen</h3><p>Yoklama, ödev, içerik, soru bankası, sınav ve öğrenci geri bildirimlerini yürütür.</p></div></div>
        <div class="role-row"><div class="role-icon">S</div><div><h3>Öğrenci</h3><p>Ders programı, çalışma planı, canlı ders, sınav sonuçları ve AI destek ekranına erişir.</p></div></div>
        <div class="role-row"><div class="role-icon">V</div><div><h3>Veli</h3><p>Devamsızlık, ödeme, duyuru, görüşme, makbuz ve haftalık raporları takip eder.</p></div></div>
        <div class="role-row"><div class="role-icon">F</div><div><h3>Finans ve platform</h3><p>Tahsilat, taksit, faturalama, abonelik, kurum onayı ve destek süreçlerini izler.</p></div></div>
        <div class="pill-cloud">${rolePills(['Kurum bazlı veri', 'Rol yönetimi', 'Canlı backend', 'Mobil panel', 'Onay akışları', 'AI modülü'])}</div>
      </div>
      <div class="mini-stack">
        <div class="mini-screen"><img src="${asset(shots.admin)}" alt="Admin dashboard" /></div>
        <div class="mini-screen"><img src="${asset(shots.finance)}" alt="Finans dashboard" /></div>
        <div class="mini-screen"><img src="${asset(shots.platform)}" alt="Platform dashboard" /></div>
      </div>
    </div>
  </section>

  <section class="sheet" id="page-03">
    <div class="diagonal-panel"></div>
    <div class="chapter">Kurum Yönetimi</div>
    <div class="page-head">
      <div class="kicker">Akademik Planlama</div>
      <h2 style="margin-top:26px">Ders programı ve sınıf planlama süreçleri.</h2>
      <p class="light-lead">Kurum yöneticisi sınıf bazlı program oluşturur; çakışma ve branş kuralı backend tarafından korunur.</p>
    </div>
    <div class="feature-grid">
      <div class="screen-card tilt-left">
        <div class="tag">Canlı ders programı</div>
        <img src="${asset(shots.schedule)}" alt="Ders programı" />
      </div>
      <div class="insight-card">
        <h3>Planlama Yetkinlikleri</h3>
        <p>Kurum bazlı sınıf verisi, öğretmen branşı ve çakışma kontrolü birlikte çalışır; program oluşturma süreci yönetilebilir ve denetlenebilir hale gelir.</p>
        <ul class="feature-list">
          ${featureItems([
            'Kurumun kendi sınıfları ve öğretmenleriyle çalışma',
            'Aynı öğretmeni aynı gün ve saatte iki sınıfa atamama',
            'Fizik öğretmeninin matematik dersine atanmasını engelleme',
            'Sınıf, öğretmen, derslik ve saat bazlı program oluşturma',
            'Yönetici dashboard, görev merkezi ve KPI takibi',
          ])}
        </ul>
      </div>
    </div>
    <div class="bottom-band">
      <div><strong>Kurum bazlı</strong><span>Her okul kendi sınıf ve personel alanında çalışır.</span></div>
      <div><strong>Akıllı kontrol</strong><span>Çakışma ve branş kuralları backend seviyesinde korunur.</span></div>
      <div><strong>Hazır demo</strong><span>Görüşmede gerçek ekranlarla yönetim akışı gösterilir.</span></div>
    </div>
  </section>

  <section class="sheet dark" id="page-04">
    <div class="brand-row">
      <img src="${asset(logoPath)}" alt="CourseIntellect" />
      <div class="brand-word">Course<span class="accent">Intellect</span></div>
    </div>
    <div class="chapter">Öğretmen Paneli</div>
    <div class="page-head" style="top:210px">
      <div class="kicker">Akademik İş Akışları</div>
      <h2 style="margin-top:26px;color:#fff">Öğretmen çalışma alanı ve akademik üretim süreçleri.</h2>
      <p class="lead" style="max-width:1120px">Öğretmen günlük derslerini, yoklamasını, içeriklerini, ödev teslimlerini, soru bankasını ve canlı derslerini tek çalışma alanından yürütür.</p>
    </div>
    <div class="feature-grid reverse" style="top:735px">
      <div class="insight-card dark-card">
        <h3>Öğretmen tarafında hazır modüller</h3>
        <p>Satışta öğretmen iş yükünü azaltma ve akademik veriyi merkezi toplama vaadi öne çıkar.</p>
        <ul class="feature-list">
          ${featureItems([
            'Ders programı ve yoklama',
            'İçerik stüdyosu ve konu anlatımı',
            'Soru bankası ve soru cevap iş akışı',
            'Ödev oluşturma ve teslim merkezi',
            'Canlı ders ve raporlama',
          ])}
        </ul>
      </div>
      <div class="screen-card tilt-right">
        <div class="tag">Öğretmen çalışma alanı</div>
        <img src="${asset(shots.teacher)}" alt="Öğretmen paneli" />
      </div>
    </div>
  </section>

  <section class="sheet" id="page-05">
    <div class="diagonal-panel"></div>
    <div class="chapter">Mobil Deneyim</div>
    <div class="page-head">
      <div class="kicker">Öğrenci, Veli ve AI</div>
      <h2 style="margin-top:26px">Mobil paydaş deneyimi ve akademik erişim.</h2>
      <p class="light-lead">Öğrenci akademik akışını takip eder, AI destek merkezinden yardım alır; veli devamsızlık ve ödeme gibi kritik bilgilere erişir.</p>
    </div>
    <div class="phone-row">
      <div class="phone-card"><div class="phone"><img src="${asset(shots.student)}" alt="Öğrenci mobil" /></div><h3>Öğrenci</h3></div>
      <div class="phone-card"><div class="phone"><img src="${asset(shots.ai)}" alt="CourseIntellect AI" /></div><h3>AI Merkezi</h3></div>
      <div class="phone-card"><div class="phone"><img src="${asset(shots.parent)}" alt="Veli mobil" /></div><h3>Veli</h3></div>
    </div>
    <div class="bottom-band">
      <div><strong>Öğrenci</strong><span>Ders programı, çalışma planı, sınav sonucu, QR yoklama.</span></div>
      <div><strong>AI</strong><span>Öğrencinin sorusunu yönlendiren akıllı çalışma merkezi.</span></div>
      <div><strong>Veli</strong><span>Devamsızlık, ödeme, makbuz, görüşme ve duyuru takibi.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-06">
    <div class="diagonal-panel"></div>
    <div class="chapter">Finans Yönetimi</div>
    <div class="page-head">
      <div class="kicker">Tahsilat ve Muhasebe</div>
      <h2 style="margin-top:26px">Finans yönetimi ve tahsilat süreçleri.</h2>
      <p class="light-lead">Muhasebe paneli öğrenci hesapları, taksitler, tahsilatlar, makbuzlar ve geciken ödeme süreçlerini merkezi olarak yönetir.</p>
    </div>
    <div class="feature-grid">
      <div>
        <div class="screen-card tilt-left" style="height:545px;min-height:545px"><div class="tag">Finans dashboard</div><img src="${asset(shots.finance)}" alt="Finans paneli" /></div>
        <div class="screen-card tilt-right" style="height:385px;min-height:385px;margin-top:34px"><div class="tag">Platform kurumları</div><img src="${asset(shots.platform)}" alt="Platform paneli" /></div>
      </div>
      <div class="insight-card">
        <h3>Finans Operasyonları</h3>
        <p>Kurum yalnız eğitim operasyonunu değil, gelir ve ödeme takibini de aynı platformdan yönetebilir.</p>
        <ul class="feature-list">
          ${featureItems([
            'Tahsilat, taksit, fatura ve makbuz',
            'Geciken ödeme ve finans onay akışları',
            'İndirim, burs, maaş, kasa ve mutabakat',
            'Platform abonelikleri ve kurum paketleri',
            'Kurum marka/tema özelleştirme ve destek',
          ])}
        </ul>
      </div>
    </div>
    <div class="bottom-band">
      <div><strong>Muhasebe</strong><span>Öğrenci hesapları, tahsilat ve taksitlerin tek merkezi.</span></div>
      <div><strong>Platform</strong><span>Kurum, paket, destek ve abonelik yönetimi.</span></div>
      <div><strong>Büyüme</strong><span>Her yeni kurum aynı altyapıda tenant olarak açılır.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-07">
    <div class="diagonal-panel"></div>
    <div class="chapter">Veli Paneli</div>
    <div class="page-head">
      <div class="kicker">Bilgilendirme ve İletişim</div>
      <h2 style="margin-top:26px">Veli iletişimi ve öğrenci takibi tek mobil panelde.</h2>
      <p class="light-lead">Veli; devamsızlık, ödeme, sınav sonucu, makbuz, görüşme, mazeret ve duyuru süreçlerini kurumla bağlantılı şekilde takip eder.</p>
    </div>
    <div class="feature-grid reverse">
      <div class="insight-card">
        <h3>Veli Deneyimi</h3>
        <p>Veli paneli, kurum ile aile arasındaki bilgi akışını düzenli ve ölçülebilir hale getirir.</p>
        <ul class="feature-list">
          ${featureItems([
            'Çocuk seçimi ve öğrenci kartı',
            'Devamsızlık ve sınav sonucu takibi',
            'Bekleyen ödeme, makbuz ve finans görünümü',
            'Görüşme, geri bildirim ve mazeret bildirimleri',
            'Duyuru ve haftalık rapor erişimi',
          ])}
        </ul>
      </div>
      <div style="display:grid;place-items:center">
        <div class="phone" style="width:430px;height:930px"><img src="${asset(shots.parent)}" alt="Veli mobil paneli" /></div>
      </div>
    </div>
    <div class="bottom-band">
      <div><strong>Takip</strong><span>Devamsızlık, sınav ve haftalık durum bilgileri.</span></div>
      <div><strong>Finans</strong><span>Ödeme, makbuz ve bekleyen borç görünümü.</span></div>
      <div><strong>İletişim</strong><span>Görüşme, duyuru ve geri bildirim akışı.</span></div>
    </div>
  </section>

  <section class="sheet" id="page-08">
    <div class="diagonal-panel"></div>
    <div class="chapter">Platform Yönetimi</div>
    <div class="page-head">
      <div class="kicker">Kurum Ölçekleme</div>
      <h2 style="margin-top:26px">Çok kurumlu yapı ve merkezi platform yönetimi.</h2>
      <p class="light-lead">Platform yöneticisi kurumları, paketleri, abonelikleri, destek taleplerini, kullanım limitlerini ve özelleştirme süreçlerini merkezi olarak izler.</p>
    </div>
    <div class="feature-grid">
      <div class="screen-card tilt-left">
        <div class="tag">Platform kurum yönetimi</div>
        <img src="${asset(shots.platform)}" alt="Platform yönetimi" />
      </div>
      <div class="insight-card">
        <h3>Platform Yetkinlikleri</h3>
        <p>Yeni kurumlar aynı altyapıda ayrı tenant olarak açılır; paket, abonelik ve destek süreçleri merkezi yönetilir.</p>
        <ul class="feature-list">
          ${featureItems([
            'Kurum oluşturma, onaylama ve durum takibi',
            'Plan, abonelik ve kullanım limiti yönetimi',
            'Platform faturalama ve ödeme görünürlüğü',
            'Destek talepleri ve sistem ayarları',
            'Kurum tema ve marka özelleştirme',
          ])}
        </ul>
      </div>
    </div>
    <div class="bottom-band">
      <div><strong>Tenant yapı</strong><span>Her kurum kendi veri alanında çalışır.</span></div>
      <div><strong>Abonelik</strong><span>Paket, plan ve platform faturalama süreci.</span></div>
      <div><strong>Destek</strong><span>Kurumsal destek ve operasyon takibi.</span></div>
    </div>
  </section>

  <section class="sheet dark" id="page-09">
    <div class="brand-row">
      <img src="${asset(logoPath)}" alt="CourseIntellect" />
      <div class="brand-word">Course<span class="accent">Intellect</span></div>
    </div>
    <div class="chapter">Operasyon Görünürlüğü</div>
    <div class="page-head" style="top:210px">
      <div class="kicker">Yönetim Paneli</div>
      <h2 style="margin-top:26px;color:#fff">Kurum yönetimi için merkezi operasyon görünürlüğü.</h2>
      <p class="lead" style="max-width:1110px">Dashboard, görev merkezi, KPI görünümü, bildirimler ve hızlı işlem alanları kurum yöneticisinin günlük kararlarını destekler.</p>
    </div>
    <div class="feature-grid reverse" style="top:735px">
      <div class="insight-card dark-card">
        <h3>Yönetim Katmanı</h3>
        <p>Yönetim ekranları kurumun akademik ve idari akışını tek bakışta takip edilebilir hale getirir.</p>
        <ul class="feature-list">
          ${featureItems([
            'Günlük ders akışı ve hızlı program erişimi',
            'Öğrenci, öğretmen ve aktif sınıf istatistikleri',
            'Bekleyen etkileşim ve bildirim takibi',
            'Görev merkezi ve idari operasyonlar',
            'KPI paneli ve raporlama altyapısı',
          ])}
        </ul>
      </div>
      <div class="screen-card tilt-right">
        <div class="tag">Kurum dashboard</div>
        <img src="${asset(shots.admin)}" alt="Kurum yönetimi dashboard" />
      </div>
    </div>
  </section>

  <section class="sheet" id="page-10">
    <div class="diagonal-panel"></div>
    <div class="brand-row light-brand">
      <img src="${asset(logoPath)}" alt="CourseIntellect" />
      <div class="brand-word">Course<span class="accent">Intellect</span></div>
    </div>
    <div class="chapter">Canlı Geçiş Planı</div>
    <div class="page-head" style="top:210px">
      <div class="kicker">Pilot Kurulum Modeli</div>
      <h2 style="margin-top:26px">Pilot kurum için 30 günlük canlı geçiş planı.</h2>
      <p class="light-lead">Ürün demo verileriyle sunulur; satış sonrası kurumun gerçek sınıf, öğretmen, öğrenci, veli ve finans yapısına göre yapılandırılır.</p>
    </div>
    <div class="deal-wrap">
      <div class="deal-card price-card">
        <img class="closing-logo" src="${asset(logoPath)}" alt="CourseIntellect" />
        <h3>Pilot kurum paketi</h3>
        <p>Demo bugün gösterilir. Kuruma özel veri aktarımı, eğitim ve canlı geçiş takvimi satıştan sonra başlar.</p>
        <div class="big-number">30 gün</div>
        <p>Kuruma özel canlı kullanım hedefi.</p>
      </div>
      <div class="deal-card">
        <h3>Kurulum akışı</h3>
        <p>Bu dil, ürünün mevcut halini saklamadan ticari güven verir: “Hazır çekirdeği kuruma özel hale getiriyoruz.”</p>
        <div class="process">
          <div><b>1</b><span><strong>Ön satış ve pilot anlaşma</strong><span>Kurum ihtiyaçları, rol sayıları ve kullanılacak modüller netleşir.</span></span></div>
          <div><b>2</b><span><strong>Veri hazırlığı</strong><span>Sınıf, öğrenci, veli, öğretmen, ders ve finans verileri alınır.</span></span></div>
          <div><b>3</b><span><strong>Kuruma özel kurulum</strong><span>Tenant, marka, roller, yetkiler ve demo olmayan gerçek veri hazırlanır.</span></span></div>
          <div><b>4</b><span><strong>Canlı geçiş ve destek</strong><span>Ekip eğitimi, test kullanımı ve ilk ay iyileştirmeleri yapılır.</span></span></div>
        </div>
      </div>
    </div>
    <div class="footer"><span>CourseIntellect Eğitim Yönetim Platformu</span><span>Web + Desktop + Mobil + Backend</span></div>
  </section>
</body>
</html>`;
}

async function render() {
  await ensureAssets();
  await fs.mkdir(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, 'premium-brochure-source.html');
  await fs.writeFile(htmlPath, brochureHtml(), 'utf8');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 2200 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await page.waitForTimeout(600);

    const pages = [
      'page-01',
      'page-02',
      'page-03',
      'page-04',
      'page-05',
      'page-06',
      'page-07',
      'page-08',
      'page-09',
      'page-10',
    ];
    const outputs = [];
    for (const [index, id] of pages.entries()) {
      const filePath = path.join(outputDir, `courseintellect-premium-brochure-${String(index + 1).padStart(2, '0')}.png`);
      await page.locator(`#${id}`).screenshot({ path: filePath, animations: 'disabled' });
      outputs.push(filePath);
    }

    await context.close();
    console.log(JSON.stringify({ outputDir, htmlPath, pages: outputs }, null, 2));
  } finally {
    await browser.close();
  }
}

await render();
