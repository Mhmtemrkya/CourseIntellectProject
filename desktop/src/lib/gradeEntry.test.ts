import { classifyAssessment, currentPeriod, isInPeriod, periodOptions } from './gradeEntry';

describe('classifyAssessment', () => {
  it('reads the slot only from the assessment name', () => {
    expect(classifyAssessment('2026 - 2027 / 1. Dönem 2. Yazılı')).toBe('second');
    expect(classifyAssessment('Matematik Sınavı • 1. Yazılı')).toBe('first');
    expect(classifyAssessment('Performans Görevi')).toBe('performance');
    expect(classifyAssessment('Birinci yazılı')).toBe('first');
  });

  it('does not treat years or mock exams as written exams', () => {
    expect(classifyAssessment('1. LGS Deneme Sınavı 2026')).toBeNull();
    expect(classifyAssessment('ZTEST Yazılı 4')).toBeNull();
  });
});

describe('periods', () => {
  it('derives the current term from the date', () => {
    expect(currentPeriod(new Date(2026, 10, 4))).toBe('2026 - 2027 / 1. Dönem');
    expect(currentPeriod(new Date(2027, 0, 15))).toBe('2026 - 2027 / 1. Dönem');
    expect(currentPeriod(new Date(2027, 3, 1))).toBe('2026 - 2027 / 2. Dönem');
    expect(periodOptions(new Date(2026, 10, 4))).toContain('2026 - 2027 / 1. Dönem');
  });

  it('keeps results of other terms out', () => {
    const period = '2026 - 2027 / 1. Dönem';
    expect(isInPeriod({ dateLabel: '05.11.2026' }, period)).toBe(true);
    expect(isInPeriod({ dateLabel: '05.11.2025' }, period)).toBe(false);
    expect(isInPeriod({ dateLabel: '15 Mart 2027' }, period)).toBe(false);
  });
});
