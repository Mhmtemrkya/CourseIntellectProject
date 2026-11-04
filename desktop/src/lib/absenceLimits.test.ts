import { absenceDayCounts, absenceLimitFor } from './absenceLimits';

describe('absenceLimitFor', () => {
  it('applies the verified high-school rule only', () => {
    expect(absenceLimitFor('10-A')).toMatchObject({ unexcusedDays: 10, totalDays: 30 });
    expect(absenceLimitFor('Hazırlık-B')).toMatchObject({ unexcusedDays: 10, totalDays: 30 });
    expect(absenceLimitFor('7-A')).toBeNull();
    expect(absenceLimitFor('3-C')).toBeNull();
    expect(absenceLimitFor('')).toBeNull();
  });
});

describe('absenceDayCounts', () => {
  it('counts days, not lessons, and keeps excused separate', () => {
    const counts = absenceDayCounts([
      { lessonDate: '2026-11-02T00:00:00Z', status: 'Devamsiz' },
      { lessonDate: '2026-11-02T00:00:00Z', status: 'Devamsiz' },
      { lessonDate: '2026-11-03T00:00:00Z', status: 'Izinli' },
      { lessonDate: '2026-11-04T00:00:00Z', status: 'Katildi' },
      { lessonDate: '2026-11-05T00:00:00Z', status: 'Izinli' },
      { lessonDate: '2026-11-05T00:00:00Z', status: 'Devamsiz' },
    ]);
    expect(counts).toEqual({ unexcusedDays: 2, excusedDays: 1, totalDays: 3 });
  });
});
