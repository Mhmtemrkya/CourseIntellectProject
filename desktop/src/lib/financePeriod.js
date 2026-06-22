// Finans sayfaları için ortak dönem (Günlük/Haftalık/Aylık/Yıllık) yardımcıları.
// Tahsilat/taksit kalemleri "dd.MM.yyyy" veya "dd.MM.yyyy HH:mm" (ve bazen
// "dd.MM.yyyy • HH:mm") biçiminde tarih taşır; bunları parse edip seçili
// döneme göre süzeriz.

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_TR_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// "dd.MM.yyyy[ HH:mm]" / ISO / Date → Date | null
export function parseTrDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).replace(' • ', ' ').trim();
  if (!raw) return null;

  // dd.MM.yyyy [HH:mm]
  const m = raw.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h, mi] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 0), Number(mi || 0));
  }
  // ISO veya tarayıcının çözebildiği diğer biçimler
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

// period ∈ 'day' | 'week' (Pzt–Paz) | 'month' | 'year'
export function periodRange(period, anchor = new Date()) {
  const a = anchor instanceof Date ? anchor : new Date(anchor);
  if (period === 'day') {
    const start = startOfDay(a);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'week') {
    const day = (a.getDay() + 6) % 7; // Pazartesi = 0
    const start = startOfDay(new Date(a.getFullYear(), a.getMonth(), a.getDate() - day));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'year') {
    return { start: new Date(a.getFullYear(), 0, 1, 0, 0, 0, 0), end: new Date(a.getFullYear(), 11, 31, 23, 59, 59, 999) };
  }
  // month (varsayılan)
  return {
    start: new Date(a.getFullYear(), a.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function inRange(date, range) {
  if (!date || !range) return false;
  const t = date.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

// items: kayıt listesi; getDate: kalemden tarih (string/Date) döndüren fn
export function filterByPeriod(items, getDate, period, anchor = new Date()) {
  if (!Array.isArray(items)) return [];
  const range = periodRange(period, anchor);
  return items.filter((item) => inRange(parseTrDateTime(getDate(item)), range));
}

// anchor'ı bir dönem ileri/geri kaydır (delta = +1 / -1)
export function shiftAnchor(period, anchor, delta) {
  const a = anchor instanceof Date ? new Date(anchor) : new Date(anchor);
  if (period === 'day') a.setDate(a.getDate() + delta);
  else if (period === 'week') a.setDate(a.getDate() + delta * 7);
  else if (period === 'year') a.setFullYear(a.getFullYear() + delta);
  else a.setMonth(a.getMonth() + delta);
  return a;
}

export function periodLabel(period, anchor = new Date()) {
  const a = anchor instanceof Date ? anchor : new Date(anchor);
  if (period === 'day') {
    return `${String(a.getDate()).padStart(2, '0')}.${String(a.getMonth() + 1).padStart(2, '0')}.${a.getFullYear()}`;
  }
  if (period === 'week') {
    const { start, end } = periodRange('week', a);
    const sameMonth = start.getMonth() === end.getMonth();
    const s = `${start.getDate()}${sameMonth ? '' : ' ' + MONTHS_TR_SHORT[start.getMonth()]}`;
    return `${s}–${end.getDate()} ${MONTHS_TR_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (period === 'year') return `${a.getFullYear()}`;
  return `${MONTHS_TR[a.getMonth()]} ${a.getFullYear()}`;
}

export { MONTHS_TR, MONTHS_TR_SHORT };
