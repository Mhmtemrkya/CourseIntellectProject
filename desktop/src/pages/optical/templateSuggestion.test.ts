import type { OpticalTemplateSuggestionDto, SaveOpticalTemplateRequest } from '../../types/api/generated';
import { applySuggestion, splitSubject } from './templateSuggestion';

const form: SaveOpticalTemplateRequest = {
  name: 'Eski', encoding: 'windows-1254', studentNoStart: 1, studentNoLength: 10, nameStart: 11, nameLength: 25,
  classStart: 36, classLength: 4, bookletStart: 40, bookletLength: 1, subjects: [{ name: 'Türkçe', start: 41, count: 40 }],
};

const suggestion: OpticalTemplateSuggestionDto = {
  supported: true, message: 'Öneri hazır.', encoding: 'utf-8', format: 'fixed', totalLines: 180, sampledLines: 180,
  typicalLineLength: 281, minLineLength: 281, maxLineLength: 281,
  fields: [
    { key: 'studentNo', label: 'Öğrenci no', start: 21, length: 10, confidence: 'high', reason: 'rakam' },
    { key: 'name', label: 'Ad soyad', start: 1, length: 20, confidence: 'high', reason: 'harf' },
    { key: 'class', label: 'Sınıf', start: 1, length: 0, confidence: 'none', reason: 'Algılanamadı / Dosyada bulunmuyor olabilir.' },
    { key: 'booklet', label: 'Kitapçık', start: 31, length: 1, confidence: 'high', reason: 'A-D' },
  ],
  numberCandidates: [
    { id: 'n1', start: 21, length: 10, distinctValues: 180, constant: false, leadingZeros: false, note: 'hepsi farklı' },
    { id: 'n2', start: 140, length: 5, distinctValues: 170, constant: false, leadingZeros: false, note: 'çoğu farklı' },
  ],
  answerBlocks: [{ label: 'Cevap bloğu 1', start: 32, count: 95, confidence: 'medium', reason: 'A-E', countNeedsConfirmation: true }],
  booklets: ['A', 'B', 'C', 'D'], flaggedLines: [], warnings: [], confirmations: ['Soru sayısını doğrulayın.'],
  aiStatus: 'not-needed', aiNotes: [], manualRecommended: false,
};

describe('applySuggestion', () => {
  it('alanları yerleştirir; bulunamayan alan okunmaz; blok ders adı olmadan gelir', () => {
    const next = applySuggestion(form, suggestion);
    expect(next).toEqual({
      ...form, encoding: 'utf-8', studentNoStart: 21, studentNoLength: 10, nameStart: 1, nameLength: 20,
      classStart: 1, classLength: 0, bookletStart: 31, bookletLength: 1, subjects: [{ name: '', start: 32, count: 95 }],
    });
    expect(next.name).toBe('Eski');
  });

  it('seçilen numara adayını kullanır; otomatik kodlama seçimi korunur', () => {
    const next = applySuggestion({ ...form, encoding: 'auto' }, suggestion, 'n2');
    expect([next.studentNoStart, next.studentNoLength, next.encoding]).toEqual([140, 5, 'auto']);
  });
});

describe('splitSubject', () => {
  it('bloğu ikiye böler; ikinci kısmın dersi seçilecek', () => {
    const next = splitSubject({ ...form, subjects: [{ name: 'Türkçe', start: 32, count: 95 }] }, 0, 20);
    expect(next.subjects).toEqual([{ name: 'Türkçe', start: 32, count: 20 }, { name: '', start: 52, count: 75 }]);
    expect(splitSubject(form, 0, 40)).toBe(form);
  });
});
