import { TextDecoder, TextEncoder } from 'util';
import type { SaveOpticalTemplateRequest } from '../../types/api/generated';
import {
  decodeSample, layoutFields, layoutProblems, readSampleLine, readingSummary, ruler, sampleLines, segmentLine,
} from './templateLayout';

// jsdom TextDecoder sağlamaz; tarayıcıdakiyle aynı WHATWG çözücüsü Node'dan alınır.
Object.assign(globalThis, { TextDecoder, TextEncoder });

const form: SaveOpticalTemplateRequest = {
  name: 'Test', encoding: 'windows-1254',
  studentNoStart: 1, studentNoLength: 10, nameStart: 11, nameLength: 25, classStart: 36, classLength: 4, bookletStart: 40, bookletLength: 1,
  subjects: [{ name: 'Türkçe', start: 41, count: 5 }],
};
const byId = (template: SaveOpticalTemplateRequest, id: string) => {
  const field = layoutFields(template).find((item) => item.id === id);
  if (!field) throw new Error(id);
  return field;
};

describe('okuma özeti', () => {
  it('bitişi başlangıç + uzunluk − 1 ile hesaplar', () => {
    expect(readingSummary(byId(form, 'studentNo'))).toBe('Her satırın 1–10. karakterleri öğrenci numarası olarak okunacak.');
    expect(readingSummary(byId(form, 'name'))).toBe('Her satırın 11–35. karakterleri ad soyad olarak okunacak.');
    expect(readingSummary(byId(form, 'class'))).toBe('Her satırın 36–39. karakterleri sınıf olarak okunacak.');
    expect(readingSummary(byId(form, 'subject-0'))).toContain('41–45. karakterleri Türkçe cevapları');
  });

  it('tek karakterli ve kullanılmayan alan', () => {
    expect(readingSummary(byId(form, 'booklet'))).toBe('Her satırın 40. karakteri kitapçık türü olarak okunacak.');
    expect(readingSummary(byId({ ...form, classLength: 0 }, 'class'))).toBe('Bu alan dosyadan okunmayacak.');
  });

  it('konum değişince özet de değişir', () => {
    expect(readingSummary(byId({ ...form, studentNoStart: 3, studentNoLength: 6 }, 'studentNo'))).toBe('Her satırın 3–8. karakterleri öğrenci numarası olarak okunacak.');
  });
});

describe('çakışma', () => {
  it('hangi iki alanın ve hangi karakterlerin çakıştığını söyler', () => {
    expect(layoutProblems(layoutFields(form))).toEqual([]);
    const problems = layoutProblems(layoutFields({ ...form, nameLength: 27 }));
    expect(problems).toEqual(['Ad soyad (11–37. karakterler) ile Sınıf (36–39. karakterler) çakışıyor: 36–37. karakterler iki alana birden ayrılmış.']);
  });

  it('kullanılmayan alan çakışma sayılmaz; tek karakter çakışması tekil yazılır', () => {
    expect(layoutProblems(layoutFields({ ...form, classStart: 20, classLength: 0 }))).toEqual([]);
    expect(layoutProblems(layoutFields({ ...form, bookletStart: 39 }))[0]).toContain('39. karakter iki alana birden');
  });
});

describe('örnek dosya', () => {
  const pad = (value: string, width: number) => value.padEnd(width, ' ');
  const line = `${pad('1234', 10)}${pad('AYŞE DEMİR', 25)}${pad('10-A', 4)}BA C E`;

  it('Türkçe karakterleri 1254 ve UTF-8 ile doğru çözer', () => {
    const utf8 = new TextEncoder().encode(line);
    expect(decodeSample(utf8, 'utf-8').text).toBe(line);
    expect(decodeSample(utf8, 'auto').encoding).toBe('utf-8');
    const cp1254 = Uint8Array.from([0x41, 0x59, 0xde, 0x45, 0x20, 0xdd, 0xfd, 0xf0]);
    expect(decodeSample(cp1254, 'windows-1254').text).toBe('AYŞE İığ');
    expect(decodeSample(cp1254, 'auto')).toEqual({ text: 'AYŞE İığ', encoding: 'windows-1254' });
  });

  it('boş satırları atlar ama satır numarasını korur', () => {
    expect(sampleLines(`ilk\r\n\r\n   \r\nüçüncü\u001A\r\n`)).toEqual([{ line: 1, text: 'ilk' }, { line: 4, text: 'üçüncü' }]);
  });

  it('her alanı okur; boş bırakılmış cevabı eksik karakterden ayırır', () => {
    const readings = readSampleLine({ line: 1, text: line }, layoutFields(form));
    const value = (id: string) => readings.find((item) => item.field.id === id);
    expect(value('studentNo')?.value).toBe('1234');
    expect(value('name')?.value).toBe('AYŞE DEMİR');
    expect(value('class')?.value).toBe('10-A');
    expect(value('booklet')?.value).toBe('B');
    expect(value('subject-0')?.value).toBe('A C E');
    expect(value('subject-0')?.blankQuestions).toEqual([2, 4]);
    expect(value('subject-0')?.missing).toBeNull();

    const short = readSampleLine({ line: 3, text: line.slice(0, 43) }, layoutFields(form)).find((item) => item.field.id === 'subject-0');
    expect(short?.missing).toBe('3. satır 43. karakterde bitiyor; Türkçe alanının 4–5. soruları dosyada yok (boş bırakılmış cevap değil, satır kısa).');
    const none = readSampleLine({ line: 2, text: '12345' }, layoutFields(form)).find((item) => item.field.id === 'name');
    expect(none?.missing).toContain('2. satır 5 karakter; Ad soyad 11–35. karakterler arasında bekleniyor');
  });

  it('satırı alanlara böler ve cetvel 1’den başlar', () => {
    const segments = segmentLine('12AB', layoutFields({ ...form, studentNoLength: 2, nameStart: 3, nameLength: 1, classLength: 0, bookletLength: 0, subjects: [] }));
    expect(segments.map((item) => [item.text, item.field?.id ?? null])).toEqual([['12', 'studentNo'], ['A', 'name'], ['B', null]]);
    expect(ruler(12)).toEqual({ tens: '        10  ', units: '123456789012' });
  });
});
