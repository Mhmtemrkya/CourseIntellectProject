import type { SaveOpticalTemplateRequest } from '../../types/api/generated';

// ─── Optik şablon düzeni: okuma özeti, çakışma ve örnek dosya önizlemesi ─────
// Sunucudaki OpticalParser ile aynı kurallar: karakter sayımı 1'den başlar, boş satırlar atlanır
// (satır numarası dosyadaki sırayı korur), satırda olmayan karakterler boşluk sayılır.

export type FieldKind = 'studentNo' | 'name' | 'class' | 'booklet' | 'subject';

export interface LayoutField {
  id: string;
  kind: FieldKind;
  label: string;
  start: number;
  length: number;
  color: string;
}

/** Her alanın vurgu rengi; koyu ve açık temada okunur (yarı saydam zemin + düz kenar). */
const FIELD_COLORS: Record<Exclude<FieldKind, 'subject'>, string> = {
  studentNo: '199 89% 48%',
  name: '262 83% 62%',
  class: '38 92% 50%',
  booklet: '346 84% 56%',
};
const SUBJECT_COLORS = ['152 69% 40%', '173 80% 36%', '84 70% 40%', '189 85% 42%', '292 70% 55%', '25 95% 53%'];

const READ_AS: Record<Exclude<FieldKind, 'subject'>, string> = {
  studentNo: 'öğrenci numarası',
  name: 'ad soyad',
  class: 'sınıf',
  booklet: 'kitapçık türü',
};

export function layoutFields(form: SaveOpticalTemplateRequest): LayoutField[] {
  return [
    { id: 'studentNo', kind: 'studentNo', label: 'Öğrenci no', start: form.studentNoStart, length: form.studentNoLength, color: FIELD_COLORS.studentNo },
    { id: 'name', kind: 'name', label: 'Ad soyad', start: form.nameStart, length: form.nameLength, color: FIELD_COLORS.name },
    { id: 'class', kind: 'class', label: 'Sınıf', start: form.classStart, length: form.classLength, color: FIELD_COLORS.class },
    { id: 'booklet', kind: 'booklet', label: 'Kitapçık', start: form.bookletStart, length: form.bookletLength, color: FIELD_COLORS.booklet },
    ...form.subjects.map((subject, index) => ({
      id: `subject-${index}`,
      kind: 'subject' as const,
      label: subject.name || `${index + 1}. ders`,
      start: subject.start,
      length: subject.count,
      color: SUBJECT_COLORS[index % SUBJECT_COLORS.length] ?? SUBJECT_COLORS[0] ?? '152 69% 40%',
    })),
  ];
}

/** Bitiş konumu = başlangıç + uzunluk − 1. */
export const endOf = (start: number, length: number) => start + length - 1;

export function spanText(start: number, length: number): string {
  return length === 1 ? `${start}. karakter` : `${start}–${endOf(start, length)}. karakterler`;
}

/** "Her satırın 1–10. karakterleri öğrenci numarası olarak okunacak." */
export function readingSummary(field: LayoutField): string {
  if (field.length <= 0) return 'Bu alan dosyadan okunmayacak.';
  if (field.start < 1) return 'Başlangıç konumu 1 ya da daha büyük olmalı.';
  const what = field.kind === 'subject' ? `${field.label} cevapları` : READ_AS[field.kind];
  const where = field.length === 1
    ? `Her satırın ${field.start}. karakteri ${what} olarak okunacak.`
    : `Her satırın ${field.start}–${endOf(field.start, field.length)}. karakterleri ${what} olarak okunacak.`;
  return field.kind === 'subject' ? `${where} Her soru bir karakterdir (${field.length} soru).` : where;
}

/** Kaydetmeden önce gösterilen düzen hataları: geçersiz başlangıç ve çakışan iki alan. */
export function layoutProblems(fields: readonly LayoutField[]): string[] {
  const used = fields.filter((field) => field.length > 0);
  const problems = used.filter((field) => field.start < 1)
    .map((field) => `${field.label}: başlangıç konumu 1 ya da daha büyük olmalı (karakter sayımı 1'den başlar).`);
  const valid = used.filter((field) => field.start >= 1);
  valid.forEach((a, i) => valid.slice(i + 1).forEach((b) => {
    if (a.start > endOf(b.start, b.length) || b.start > endOf(a.start, a.length)) return;
    const from = Math.max(a.start, b.start);
    const to = Math.min(endOf(a.start, a.length), endOf(b.start, b.length));
    problems.push(`${a.label} (${spanText(a.start, a.length)}) ile ${b.label} (${spanText(b.start, b.length)}) çakışıyor: ${spanText(from, to - from + 1)} iki alana birden ayrılmış.`);
  }));
  return problems;
}

// ─── Örnek dosya ─────────────────────────────────────────────────────────────

/** Sunucuyla aynı: "auto" BOM ya da geçerli UTF-8 ise UTF-8, değilse Türkçe Windows (1254). */
export function decodeSample(bytes: Uint8Array, encoding: string): { text: string; encoding: string } {
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const utf8 = () => new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  if (encoding === 'utf-8' || hasBom) return { text: utf8(), encoding: 'utf-8' };
  if (encoding === 'auto') {
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
    } catch {
      // geçerli UTF-8 değil → 1254
    }
  }
  return { text: new TextDecoder('windows-1254').decode(bytes), encoding: 'windows-1254' };
}

export interface SampleLine { line: number; text: string }

export function sampleLines(text: string, max = 5): SampleLine[] {
  return text.split(/\r?\n/)
    .map((value, index) => ({ line: index + 1, text: value.replace(/\r$/, '').replace(/\u001A/g, '') }))
    .filter((item) => item.text.trim().length > 0)
    .slice(0, max);
}

export interface FieldReading {
  field: LayoutField;
  value: string;
  /** Cevap alanında işaretlenmemiş (boşluk) soru numaraları; bu normaldir. */
  blankQuestions: number[];
  /** Satır bu alana yetmiyor: dosyada karşılığı olmayan karakterler. Bu bir düzen hatasıdır. */
  missing: string | null;
}

export function readSampleLine(sample: SampleLine, fields: readonly LayoutField[]): FieldReading[] {
  const length = sample.text.length;
  return fields.filter((field) => field.length > 0 && field.start >= 1).map((field) => {
    const end = endOf(field.start, field.length);
    const raw = sample.text.slice(field.start - 1, end);
    let missing: string | null = null;
    if (length < field.start) {
      missing = `${sample.line}. satır ${length} karakter; ${field.label} ${spanText(field.start, field.length)} arasında bekleniyor ama satır o konuma ulaşmıyor.`;
    } else if (length < end) {
      missing = field.kind === 'subject'
        ? `${sample.line}. satır ${length}. karakterde bitiyor; ${field.label} alanının ${length - field.start + 2}–${field.length}. soruları dosyada yok (boş bırakılmış cevap değil, satır kısa).`
        : `${sample.line}. satır ${length}. karakterde bitiyor; ${field.label} alanının son ${end - length} karakteri dosyada yok.`;
    }
    const blankQuestions = field.kind === 'subject'
      ? Array.from(raw).flatMap((char, index) => (char === ' ' ? [index + 1] : []))
      : [];
    const value = field.kind === 'subject' ? raw : field.kind === 'name' ? raw.split(' ').filter(Boolean).join(' ') : raw.trim();
    return { field, value, blankQuestions, missing };
  });
}

export interface Segment { text: string; field: LayoutField | null }

/** Satırı alanlara göre renklendirilecek parçalara böler; çakışan karakter ilk alana yazılır. */
export function segmentLine(text: string, fields: readonly LayoutField[]): Segment[] {
  const owner = Array.from(text).map((_, index) => fields.find((field) =>
    field.length > 0 && field.start >= 1 && index + 1 >= field.start && index + 1 <= endOf(field.start, field.length)) ?? null);
  const segments: Segment[] = [];
  Array.from(text).forEach((char, index) => {
    const field = owner[index] ?? null;
    const last = segments[segments.length - 1];
    if (last && last.field === field) last.text += char;
    else segments.push({ text: char, field });
  });
  return segments;
}

/** "1234567890" basamakları ve her 10. konumda sayı: üst satır onlar, alt satır birler. */
export function ruler(width: number): { tens: string; units: string } {
  let tens = '';
  let units = '';
  for (let position = 1; position <= width; position += 1) {
    units += String(position % 10);
    if (position % 10 === 0) {
      const label = String(position);
      tens = tens.slice(0, tens.length - (label.length - 1)) + label;
    } else {
      tens += ' ';
    }
  }
  return { tens, units };
}
