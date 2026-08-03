/**
 * Biçimlendirme tek kaynağı: para, sayı ve tarih.
 *
 * Bu dosyadan ÖNCE her ekran kendi `toLocaleString`/`toLocaleDateString`
 * çağrısını yazıyordu; aynı tutar bir ekranda "12.500 ₺", diğerinde
 * "12.500,00 TRY", tarih bir yerde "2.8.2026" diğerinde "02.08.2026"
 * görünüyordu. Yeni ekranlarda doğrudan bu yardımcıları kullan.
 *
 * Standart:
 *  - para  → "12.500 TL" (tam sayıysa kuruşsuz), "12.500,50 TL"
 *  - tarih → "02.08.2026" (gün/ay iki haneli)
 *  - saat  → "14:35"
 */

const LOCALE = 'tr-TR';

/** Para birimi kodu → ekranda gösterilen kısaltma. */
export const CURRENCY_LABELS = {
  TRY: 'TL',
  TL: 'TL',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
};

/** "12.500,50", "12,500.50", "₺12.500" gibi girdileri sayıya çevirir. */
export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  const raw = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma > -1 && lastComma > lastDot) {
    // Türkçe yazım: nokta binlik, virgül ondalık.
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastComma > -1) {
    // İngilizce yazım: virgül binlik, nokta ondalık.
    normalized = raw.replace(/,/g, '');
  } else if (lastDot > -1) {
    // Virgül yok: "3.000" Türkçe metinde ÜÇ BİN demektir. Noktadan sonrası tam
    // üç haneyse binlik ayırıcı sayılır; "12.5" gibi değerler ondalık kalır.
    const tail = raw.slice(lastDot + 1);
    normalized = /^\d{3}$/.test(tail) ? raw.replace(/\./g, '') : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Ondalıksız/ondalıklı sayı: 1.234 · 1.234,5 */
export function formatNumber(value, { decimals } = {}) {
  const amount = typeof value === 'number' ? value : parseMoney(value);
  const digits = decimals ?? (Number.isInteger(amount) ? 0 : 2);
  return amount.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  });
}

/**
 * Para: "12.500 TL". Tam sayıda kuruş yazılmaz (tablolar okunaklı kalsın),
 * küsuratlı tutarda iki hane gösterilir.
 */
export function formatMoney(value, { currency = 'TRY', showCurrency = true, decimals } = {}) {
  const text = formatNumber(value, { decimals });
  if (!showCurrency) return text;
  const label = CURRENCY_LABELS[String(currency || 'TRY').toUpperCase()] || currency;
  return `${text} ${label}`;
}

/** İşaretli para: gelir/gider ayrımı olan yerlerde (+1.000 TL / -250 TL). */
export function formatMoneySigned(value, options) {
  const amount = typeof value === 'number' ? value : parseMoney(value);
  const text = formatMoney(Math.abs(amount), options);
  if (amount === 0) return text;
  return `${amount > 0 ? '+' : '−'}${text}`;
}

/** Girdi ne olursa olsun geçerli bir Date ya da null. */
export function toDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Epoch (Date.now(), getTime()) değerleri metne çevrilirse geçersiz tarih olur.
  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }

  const raw = String(value).trim();
  if (!raw) return null;
  // "2026-08-02 14:35" gibi boşluklu ISO değerleri Safari/WebKit'te NaN döner.
  const parsed = new Date(raw.includes(' ') && raw.includes('-') ? raw.replace(' ', 'T') : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 02.08.2026 (çözülemeyen değerde "—") */
export function formatDate(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 02.08.2026 14:35 */
export function formatDateTime(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** 14:35 */
export function formatTime(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** 2 Ağustos 2026 */
export function formatDateLong(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Ağustos 2026 */
export function formatMonthYear(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

/**
 * 02.08 Paz — takvim/liste başlıkları için kısa gün.
 * Intl bu alan birleşimini "02/08 Paz" olarak verdiğinden parçalar elle
 * birleştirilir; uygulamanın her yerinde ayırıcı nokta.
 */
export function formatDayShort(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const weekday = date.toLocaleDateString(LOCALE, { weekday: 'short' });
  return `${day}.${month} ${weekday}`;
}
