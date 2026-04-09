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
 * @param {string} primaryHex - Ana marka rengi
 * @param {string} accentHex  - Vurgu rengi
 * @returns {Object} CSS variable adı → değer eşleşmeleri
 */
export function generateBrandCSSVariables(primaryHex, accentHex) {
  const primaryPalette = generatePalette(primaryHex);
  const accentPalette = generatePalette(accentHex);
  const vars = {};

  // Ana renk paleti
  for (const [shade, hex] of Object.entries(primaryPalette)) {
    vars[`--brand-p-${shade}`] = hex;
  }
  vars['--brand-primary-hex'] = primaryHex;

  // Accent renk paleti
  for (const [shade, hex] of Object.entries(accentPalette)) {
    vars[`--brand-a-${shade}`] = hex;
  }
  vars['--brand-accent-hex'] = accentHex;

  // Sidebar gradient
  vars['--sidebar-from'] = primaryPalette[900];
  vars['--sidebar-via'] = primaryPalette[800];
  vars['--sidebar-to'] = primaryPalette[950];

  // Aktif menü item rengi
  vars['--sidebar-active-bg'] = primaryPalette[700];
  vars['--sidebar-hover-bg'] = primaryPalette[800];

  // Accent tonu (butonlar, badge'ler)
  vars['--accent-from'] = accentPalette[500];
  vars['--accent-to'] = accentPalette[400];

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

// Varsayılan CourseIntellect renkleri
export const DEFAULT_PRIMARY = '#00354F';
export const DEFAULT_ACCENT = '#D9790B';
