import type { OpticalSubjectTopicsDto } from '../types/api/generated';
import { alignTopics, filterTopics, guessLevel, isUnlisted, levelForClass, levelPenalty, matchTopic, topicKey, topicOptions } from './topicCatalog';

const subject: OpticalSubjectTopicsDto = {
  subject: 'Matematik',
  groups: [{ label: 'Sayılar ve İşlemler', topics: ['Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler'] }],
  custom: [{ id: 'c1', subject: 'Matematik', level: 'LGS', name: 'Sayı Örüntüleri' }],
  used: ['Sayı Bulmacaları', 'üslü ifadeler'],
};
const options = topicOptions(subject);

it('sıra: kurum konuları, hazır liste, daha önce yazılanlar; tekrarlar bir kez', () => {
  expect(options.map((item) => item.name)).toEqual(['Sayı Örüntüleri', 'Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler', 'Sayı Bulmacaları']);
  expect(options[0]).toMatchObject({ source: 'custom', id: 'c1' });
});

it('Türkçe harf duyarsız süzer, adı arananla başlayanı öne alır', () => {
  expect(topicKey('  ÜSLÜ   İfadeler ')).toBe(topicKey('uslu ifadeler'));
  expect(filterTopics(options, 'uslu').map((item) => item.name)).toEqual(['Üslü İfadeler']);
  expect(filterTopics(options, 'ifade').map((item) => item.name)).toEqual(['Üslü İfadeler', 'Kareköklü İfadeler']);
  expect(filterTopics(options, 'islemler')).toHaveLength(3);
  expect(matchTopic(options, 'KAREKÖKLÜ İFADELER')?.name).toBe('Kareköklü İfadeler');
  expect(isUnlisted(options, 'Bulmaca')).toBe(true);
  expect(isUnlisted(options, '  ')).toBe(false);
});

it('yapıştırılan konuları listedeki yazıma çevirir, olmayanları bir kez sayar', () => {
  expect(alignTopics(options, ['uslu ifadeler', 'Bulmaca', ' bulmaca ', ''])).toEqual({
    values: ['Üslü İfadeler', 'Bulmaca', 'bulmaca', ''],
    unlisted: ['Bulmaca'],
  });
});

it('seviyeyi derslerden, şablon adından ya da yanlış götürmeden tahmin eder', () => {
  expect(guessLevel([{ name: 'T.C. İnkılap Tarihi ve Atatürkçülük', start: 1, count: 10 }], 4)).toBe('LGS');
  expect(guessLevel([{ name: 'Temel Matematik', start: 1, count: 40 }], 3)).toBe('TYT');
  expect(guessLevel([{ name: 'Felsefe Grubu', start: 1, count: 20 }], 4)).toBe('AYT');
  expect(guessLevel([{ name: 'Matematik', start: 1, count: 20 }], 4, 'Okul optik formu (LGS)')).toBe('LGS');
  expect(guessLevel([{ name: 'Matematik', start: 1, count: 20 }], 4, 'Telgsiz form')).toBe('');
  expect(guessLevel([{ name: 'Matematik', start: 1, count: 20 }], 3)).toBe('LGS');
  expect(levelPenalty('TYT')).toBe(4);
  expect(levelPenalty('6')).toBeNull();
});

it('sınıf adından konu seviyesi çıkarır', () => {
  expect(levelForClass('8-A')).toBe('LGS');
  expect(levelForClass('6B')).toBe('6');
  expect(levelForClass('10/C')).toBe('TYT');
  expect(levelForClass('12-A Sayısal')).toBe('AYT');
  expect(levelForClass('TYT Hazırlık')).toBe('TYT');
  expect(levelForClass('Tüm Sınıflar')).toBe('');
  expect(levelForClass('3-A')).toBe('');
});
