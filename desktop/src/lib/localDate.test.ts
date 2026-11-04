import { localDateKey, localDateKeyOffset } from './localDate';

describe('localDateKey', () => {
  it('uses the local calendar day, not the UTC day', () => {
    // Yerel gece yarısı: UTC+ bölgelerde toISOString önceki günü verir.
    expect(localDateKey(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(localDateKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });

  it('offsets by whole local days', () => {
    expect(localDateKeyOffset(-14, new Date(2026, 10, 3, 1, 0))).toBe('2026-10-20');
    expect(localDateKeyOffset(0, new Date(2026, 2, 1, 23, 59))).toBe('2026-03-01');
  });
});
