/**
 * Multi-tenant Color Palette Generator
 * Tek bir hex renkten tam bir renk paleti üretir (Tailwind 50-950 arası shade'ler).
 * HSL renk uzayında çalışır — hue sabit kalır, sadece lightness/saturation değişir.
 */

// ─── Hex ↔ HSL dönüşümleri ────────────────────────────────────────────

export function hexToHSL(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── Palet üretimi ────────────────────────────────────────────────────

// Tailwind tarzı lightness dağılımı
const SHADE_LIGHTNESS = {
  50: 97, 100: 93, 200: 85, 300: 75, 400: 62,
  500: 48, 600: 40, 700: 32, 800: 24, 900: 17, 950: 10,
};

/**
 * Tek bir hex renkten 11 shade'lik palet üretir.
 * @param {string} hex - Ana renk (#RRGGBB)
 * @returns {Object} shade → hex eşleşmeleri { 50: '#...', 100: '#...', ... }
 */
export function generatePalette(hex) {
  const { h, s } = hexToHSL(hex);
  const palette = {};

  for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
    // Çok açık/koyu tonlarda saturation azalt → daha doğal görünüm
    let adjS = s;
    const shadeNum = Number(shade);
    if (shadeNum <= 100) adjS = Math.max(s - 20, 30);
    else if (shadeNum >= 900) adjS = Math.max(s - 10, 25);

    palette[shade] = hslToHex(h, adjS, lightness);
  }
  return palette;
}

/**
 * Hex renkten HSL string üretir (CSS custom property formatı: "H S% L%")
 */
export function hexToHSLString(hex) {
  const { h, s, l } = hexToHSL(hex);
  return `${h} ${s}% ${l}%`;
}

/**
 * Ana renk + accent renkten tüm CSS custom property'leri üretir.
 * Inline root değişkenleri .light/.dark sınıf kurallarını ezdiği için
 * tema burada, üretim anında hesaba katılır.
 * @param {string} primaryHex - Ana marka rengi
 * @param {string} accentHex  - Vurgu rengi
 * @param {string} theme      - 'dark' | 'light' (çözülmüş tema)
 * @returns {Object} CSS variable adı → değer eşleşmeleri
 */
export function generateBrandCSSVariables(primaryHex, accentHex, theme = 'dark') {
  const primaryPalette = generatePalette(primaryHex);
  const accentPalette = generatePalette(accentHex);
  const light = theme === 'light';
  const vars = {};

  // Ana renk paleti
  for (const [shade, hex] of Object.entries(primaryPalette)) {
    vars[`--brand-p-${shade}`] = hex;
  }
  vars['--brand-primary-hex'] = primaryHex;
  // Tailwind brand.primary token'ı (hsl-var formatı, opacity modifier'ları destekler)
  vars['--brand-primary'] = hexToHSLString(primaryHex);
  vars['--ci-primary'] = hexToHSLString(primaryHex);
  vars['--brand-primary-hover'] = hexToHSLString(primaryPalette[600]);
  vars['--brand-primary-soft'] = `${hexToHSLString(primaryHex)} / ${light ? '0.10' : '0.14'}`;
  vars['--brand-primary-glow'] = `${hexToHSLString(primaryHex)} / ${light ? '0.22' : '0.32'}`;
  vars['--brand-primary-border'] = `${hexToHSLString(primaryHex)} / ${light ? '0.30' : '0.38'}`;
  // Metin olarak kullanılan ton: koyu zeminde açık shade, açık zeminde koyu shade
  vars['--brand-primary-text'] = hexToHSLString(light ? primaryPalette[600] : primaryPalette[400]);

  // Accent renk paleti
  for (const [shade, hex] of Object.entries(accentPalette)) {
    vars[`--brand-a-${shade}`] = hex;
  }
  vars['--brand-accent-hex'] = accentHex;
  // Tailwind brand.accent token'ı
  vars['--brand-accent'] = hexToHSLString(accentHex);
  vars['--ci-accent'] = hexToHSLString(accentHex);
  vars['--brand-accent-hover'] = hexToHSLString(accentPalette[600]);
  vars['--brand-accent-soft'] = `${hexToHSLString(accentHex)} / ${light ? '0.12' : '0.14'}`;
  vars['--brand-accent-glow'] = `${hexToHSLString(accentHex)} / ${light ? '0.24' : '0.35'}`;
  vars['--brand-accent-border'] = `${hexToHSLString(accentHex)} / ${light ? '0.34' : '0.42'}`;
  // Metin olarak kullanılan accent tonu (başlıklar, tablo başlıkları, linkler)
  vars['--brand-accent-text'] = hexToHSLString(light ? accentPalette[600] : accentPalette[500]);
  vars['--brand-gradient-start'] = hexToHSLString(accentPalette[500]);
  vars['--brand-gradient-end'] = hexToHSLString(primaryPalette[600]);

  // Sidebar gradient — açık temada beyaza yakın marka tintleri, koyuda derin tonlar
  if (light) {
    vars['--sidebar-from'] = '#ffffff';
    vars['--sidebar-via'] = primaryPalette[50];
    vars['--sidebar-to'] = primaryPalette[100];
    vars['--ci-sidebar-gradient-start'] = hexToHSLString('#ffffff');
    vars['--ci-sidebar-gradient-end'] = hexToHSLString(primaryPalette[100]);
    vars['--sidebar-active-bg'] = primaryPalette[600];
    vars['--sidebar-hover-bg'] = primaryPalette[100];
  } else {
    vars['--sidebar-from'] = primaryPalette[900];
    vars['--sidebar-via'] = primaryPalette[800];
    vars['--sidebar-to'] = primaryPalette[950];
    vars['--ci-sidebar-gradient-start'] = hexToHSLString(primaryPalette[900]);
    vars['--ci-sidebar-gradient-end'] = hexToHSLString(primaryPalette[950]);
    vars['--sidebar-active-bg'] = primaryPalette[700];
    vars['--sidebar-hover-bg'] = primaryPalette[800];
  }

  // İçerik yüzeyleri de sidebar gibi marka renginin hue'sunu takip eder.
  // index.css'teki sabit lacivert token'lar burada kurum rengine göre ezilir;
  // shadcn token'ları (--background/--card/--border...) bu ci- değişkenlerine
  // bağlı olduğu için tüm sayfalar/kartlar otomatik uyumlanır.
  {
    const { h, s } = hexToHSL(primaryHex);
    const surfaceS = Math.min(s, 70);           // yüzeyler için yumuşatılmış doygunluk
    const borderS = Math.min(s, 45);
    const hslStr = (sat, l) => `${h} ${sat}% ${l}%`;

    if (light) {
      vars['--ci-background'] = hslStr(Math.min(s, 40), 97);
      vars['--ci-card'] = '0 0% 100%';
      vars['--ci-card-muted'] = hslStr(Math.min(s, 38), 95);
      vars['--ci-border'] = hslStr(Math.min(s, 26), 85);
      vars['--ci-field'] = '0 0% 100%';
      vars['--ci-surface-1'] = hslStr(Math.min(s, 40), 98);
      vars['--ci-app-background'] = [
        `radial-gradient(circle at 86% 7%, hsl(${hslStr(Math.min(s, 92), 52)} / 0.06), transparent 24%)`,
        'radial-gradient(circle at 16% 90%, hsl(var(--brand-accent) / 0.06), transparent 28%)',
        `linear-gradient(135deg, ${hslToHex(h, Math.min(s, 35), 96)} 0%, ${hslToHex(h, Math.min(s, 35), 95)} 45%, ${hslToHex(h, Math.min(s, 35), 97)} 100%)`,
      ].join(', ');
      vars['--ci-panel-background'] = [
        'radial-gradient(circle at 12% 0%, hsl(var(--brand-accent) / 0.05), transparent 28%)',
        'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 253, 0.94))',
      ].join(', ');
    } else {
      vars['--ci-background'] = hslStr(surfaceS, 6);
      vars['--ci-card'] = hslStr(surfaceS, 12);
      vars['--ci-card-muted'] = hslStr(surfaceS, 10);
      vars['--ci-border'] = hslStr(borderS, 24);
      vars['--ci-field'] = hslStr(surfaceS, 11);
      vars['--ci-surface-1'] = hslStr(surfaceS, 12);
      vars['--ci-app-background'] = [
        'radial-gradient(circle at 8% 0%, hsl(var(--brand-accent) / 0.09), transparent 24%)',
        `radial-gradient(circle at 91% 7%, hsl(${hslStr(Math.min(s, 90), 54)} / 0.13), transparent 27%)`,
        `linear-gradient(135deg, ${hslToHex(h, surfaceS, 5)} 0%, ${hslToHex(h, surfaceS, 8)} 48%, ${hslToHex(h, surfaceS, 4)} 100%)`,
      ].join(', ');
      vars['--ci-panel-background'] = [
        'radial-gradient(circle at 12% 0%, hsl(var(--brand-accent) / 0.075), transparent 28%)',
        `linear-gradient(180deg, hsl(${hslStr(surfaceS, 12)} / 0.92), hsl(${hslStr(surfaceS, 9)} / 0.88))`,
      ].join(', ');
    }
  }

  // Accent tonu (butonlar, badge'ler)
  vars['--accent-from'] = accentPalette[500];
  vars['--accent-to'] = accentPalette[400];

  // Grafik serileri marka renklerini takip eder (1: primary, 2: accent)
  vars['--chart-1'] = hexToHSLString(light ? primaryPalette[600] : primaryPalette[400]);
  vars['--chart-2'] = hexToHSLString(light ? accentPalette[600] : accentPalette[500]);

  return vars;
}

/**
 * CSS değişkenlerini document root'a uygular.
 */
export function applyBrandVariables(vars) {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

/**
 * CSS değişkenlerini document root'tan kaldırır.
 */
export function removeBrandVariables(vars) {
  const root = document.documentElement;
  for (const prop of Object.keys(vars)) {
    root.style.removeProperty(prop);
  }
}

// Varsayılan SchoolAsist renkleri
export const DEFAULT_PRIMARY = '#07152E';
export const DEFAULT_ACCENT = '#FF7A00';
