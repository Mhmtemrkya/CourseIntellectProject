import {
  formatDate,
  formatDateTime,
  formatDayShort,
  formatMoney,
  formatMoneySigned,
  formatNumber,
  parseMoney,
  toDate,
} from './format';

describe('formatMoney', () => {
  it('tam sayıda kuruş yazmaz, küsuratlıda iki hane gösterir', () => {
    expect(formatMoney(12500)).toBe('12.500 TL');
    expect(formatMoney(12500.5)).toBe('12.500,50 TL');
  });

  it('metin girdiyi Türkçe yazımla çözer', () => {
    expect(formatMoney('12.500,75')).toBe('12.500,75 TL');
    expect(formatMoney('₺ 3.000')).toBe('3.000 TL');
  });

  it('boş/geçersiz değeri sıfır sayar', () => {
    expect(formatMoney(null)).toBe('0 TL');
    expect(formatMoney('abc')).toBe('0 TL');
  });

  it('para birimi kodunu kısaltmaya çevirir', () => {
    expect(formatMoney(100, { currency: 'TRY' })).toBe('100 TL');
    expect(formatMoney(100, { currency: 'USD' })).toBe('100 USD');
    expect(formatMoney(100, { showCurrency: false })).toBe('100');
  });

  it('işaretli biçimde gelir/gideri ayırır', () => {
    expect(formatMoneySigned(500)).toBe('+500 TL');
    expect(formatMoneySigned(-500)).toBe('−500 TL');
    expect(formatMoneySigned(0)).toBe('0 TL');
  });
});

describe('parseMoney', () => {
  it('Türkçe ve İngilizce yazımı ayırt eder', () => {
    expect(parseMoney('1.234,56')).toBeCloseTo(1234.56);
    expect(parseMoney('1,234.56')).toBeCloseTo(1234.56);
    expect(parseMoney(1234.56)).toBeCloseTo(1234.56);
  });
});

describe('formatNumber', () => {
  it('binlik ayırıcıyı Türkçe kurala göre koyar', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatNumber(12.5)).toBe('12,50');
  });
});

describe('tarih biçimleri', () => {
  const iso = '2026-08-02T14:35:00Z';

  it('günü ve ayı iki haneli yazar', () => {
    // Eski `toLocaleDateString("tr-TR")` "2.8.2026" üretiyordu.
    expect(formatDate('2026-08-02T09:00:00')).toBe('02.08.2026');
  });

  it('epoch ve Date girdisini kabul eder', () => {
    const date = new Date('2026-08-02T09:00:00');
    expect(formatDate(date)).toBe('02.08.2026');
    expect(formatDate(date.getTime())).toBe('02.08.2026');
  });

  it('boşluklu ISO değerini çözer', () => {
    expect(formatDate('2026-08-02 09:00:00')).toBe('02.08.2026');
  });

  it('çözülemeyen değerde yer tutucu döner', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate('bir tarih değil')).toBe('—');
    expect(formatDate(null, '-')).toBe('-');
    expect(toDate('bir tarih değil')).toBeNull();
  });

  it('tarih+saat ve kısa gün biçimleri tutarlı', () => {
    const local = new Date(iso);
    const [datePart, timePart] = formatDateTime(local).split(' ');
    expect(datePart).toBe(formatDate(local));
    expect(timePart).toMatch(/^\d{2}:\d{2}$/);
    expect(formatDayShort(local)).toMatch(/^\d{2}\.\d{2}/);
  });
});
