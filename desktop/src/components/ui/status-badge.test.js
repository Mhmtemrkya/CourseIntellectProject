import { normalizeStatusKey, resolveStatus, STATUS_TONES } from './status-badge';

describe('normalizeStatusKey', () => {
  it('Türkçe karakter, boşluk ve alt çizgiyi eler', () => {
    expect(normalizeStatusKey('Kısmi Ödeme')).toBe('kismiodeme');
    expect(normalizeStatusKey('kismi_odeme')).toBe('kismiodeme');
    expect(normalizeStatusKey('PartialPayment')).toBe('partialpayment');
    expect(normalizeStatusKey('İptal')).toBe('iptal');
  });
});

describe('resolveStatus', () => {
  it('aynı anlamı taşıyan yazımları tek etikete bağlar', () => {
    expect(resolveStatus('Ödendi')).toEqual({ label: 'Ödendi', tone: 'success' });
    expect(resolveStatus('paid')).toEqual({ label: 'Ödendi', tone: 'success' });
    expect(resolveStatus('PAID')).toEqual({ label: 'Ödendi', tone: 'success' });
  });

  it('gecikme ve iptali doğru tonla verir', () => {
    expect(resolveStatus('overdue').tone).toBe('danger');
    expect(resolveStatus('Gecikti').tone).toBe('danger');
    expect(resolveStatus('Cancelled').tone).toBe('neutral');
  });

  it('aktif/pasif hesap durumlarını kapsar', () => {
    expect(resolveStatus('Active')).toEqual({ label: 'Aktif', tone: 'success' });
    expect(resolveStatus('Passive')).toEqual({ label: 'Pasif', tone: 'neutral' });
  });

  it('bilinmeyen durumda metni korur, ton nötr kalır', () => {
    expect(resolveStatus('Kendi Durumum')).toEqual({ label: 'Kendi Durumum', tone: 'neutral' });
    expect(resolveStatus(null)).toEqual({ label: '—', tone: 'neutral' });
  });
});

describe('tonlar', () => {
  it('her ton hem açık hem koyu temada renk tanımlar', () => {
    Object.entries(STATUS_TONES).forEach(([name, className]) => {
      // Marka tonu CSS değişkeni kullanır; diğerleri koyu tema karşılığı taşır.
      const themeAware = className.includes('dark:') || className.includes('--brand-accent');
      expect(`${name}:${themeAware}`).toBe(`${name}:true`);
    });
  });
});
