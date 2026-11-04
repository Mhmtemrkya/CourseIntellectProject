import type { OpticalAnswerKeyDto, OpticalSubjectBlockDto } from '../../types/api/generated';

// ─── Optik cevap anahtarı taslağı ────────────────────────────────────────────
// Ekranda her ders için soru başına bir satır (cevap + konu) tutulur. API ise ders başına
// tek cevap dizisi ("ABCX…") ve soru sırasıyla konu listesi bekler; dönüşüm burada yapılır.

/** Anahtarda kullanılabilen cevaplar; X iptal edilen soru. Boş dize = henüz girilmedi. */
export const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E', 'X'] as const;

export interface SubjectDraft { answers: string[]; topics: string[] }
export interface KeyDraft { booklet: string; subjects: Record<string, SubjectDraft> }

/** Sunucu iptal için '*' de kabul eder; ekranda ikisi de X olarak gösterilir. */
export function normalizeAnswer(value: string): string {
  const upper = value.trim().toUpperCase();
  if (upper === '*') return 'X';
  return ANSWER_CHOICES.find((choice) => choice === upper) ?? '';
}

const fit = (values: string[], count: number) =>
  Array.from({ length: count }, (_, index) => values[index] ?? '');

/** Kayıtlı (ya da önceki taslaktaki) değerleri şablonun soru sayısına göre satırlara yerleştirir. */
export function subjectDraft(count: number, answers: string, topics: readonly string[]): SubjectDraft {
  const letters = Array.from(answers.replace(/\s/g, '')).map(normalizeAnswer);
  return { answers: fit(letters, count), topics: fit(topics.map((topic) => topic ?? ''), count) };
}

export const emptyKey = (booklet: string, blocks: readonly OpticalSubjectBlockDto[]): KeyDraft => ({
  booklet,
  subjects: Object.fromEntries(blocks.map((block) => [block.name, subjectDraft(block.count, '', [])])),
});

/** Kayıtlı anahtarları taslağa çevirir; anahtar yoksa boş bir A kitapçığı açar. */
export function toDrafts(keys: readonly OpticalAnswerKeyDto[], blocks: readonly OpticalSubjectBlockDto[]): KeyDraft[] {
  if (keys.length === 0) return [emptyKey('A', blocks)];
  return keys.map((key) => ({
    booklet: key.booklet,
    subjects: Object.fromEntries(blocks.map((block) => {
      const existing = key.subjects.find((item) => item.subject === block.name);
      return [block.name, subjectDraft(block.count, existing?.answers ?? '', existing?.topics ?? [])];
    })),
  }));
}

/** Şablon değişince aynı adlı derslerin girilen bilgileri korunur; soru sayısına göre kırpılır ya da uzatılır. */
export function refitDrafts(drafts: readonly KeyDraft[], blocks: readonly OpticalSubjectBlockDto[]): KeyDraft[] {
  return drafts.map((draft) => ({
    booklet: draft.booklet,
    subjects: Object.fromEntries(blocks.map((block) => {
      const existing = draft.subjects[block.name];
      return [block.name, { answers: fit(existing?.answers ?? [], block.count), topics: fit(existing?.topics ?? [], block.count) }];
    })),
  }));
}

/** Kaydetmeyi engelleyen eksikler: cevabı girilmemiş sorular (kitapçık / ders / soru no). */
export function missingAnswers(drafts: readonly KeyDraft[], blocks: readonly OpticalSubjectBlockDto[]): string[] {
  const problems: string[] = [];
  drafts.forEach((draft) => blocks.forEach((block) => {
    const empty = (draft.subjects[block.name]?.answers ?? []).flatMap((answer, index) => (answer ? [] : [index + 1]));
    if (empty.length === 0) return;
    const shown = empty.length > 6 ? `${empty.slice(0, 6).join(', ')}…` : empty.join(', ');
    problems.push(`${draft.booklet} kitapçığı / ${block.name}: ${empty.length} soru cevapsız (${shown})`);
  }));
  return problems;
}

/** API gövdesi: cevaplar soru sırasıyla tek dizi; hiç konu girilmemişse boş liste, yoksa her soru için bir satır. */
export function toPayloadKeys(drafts: readonly KeyDraft[], blocks: readonly OpticalSubjectBlockDto[]): OpticalAnswerKeyDto[] {
  return drafts.map((draft) => ({
    booklet: draft.booklet,
    subjects: blocks.map((block) => {
      const value = draft.subjects[block.name] ?? subjectDraft(block.count, '', []);
      const topics = fit(value.topics, block.count).map((topic) => topic.trim());
      return {
        subject: block.name,
        answers: fit(value.answers, block.count).join(''),
        topics: topics.some((topic) => topic.length > 0) ? topics : [],
      };
    }),
  }));
}

export interface PasteResult {
  values: string[];
  /** Yerleşen soru aralığı (1'den başlar); hiçbir şey yerleşmediyse null. */
  range: [number, number] | null;
  warning: string | null;
}

/**
 * Toplu cevap: "ABCDE…", "A B C", "A,B,C" ya da "1-A 2-B" biçimlerini kabul eder. Soru numaraları
 * atlanır, harfler 1. sorudan başlayarak sırayla yerleşir.
 */
export function pasteAnswers(current: readonly string[], text: string): PasteResult {
  const cleaned = text.toUpperCase().replace(/\d+\s*[-.):]?/g, ' ');
  const letters = Array.from(cleaned.replace(/[\s,;|/]+/g, ''));
  const invalid = Array.from(new Set(letters.filter((letter) => normalizeAnswer(letter) === '')));
  if (invalid.length > 0) {
    return { values: [...current], range: null, warning: `Geçersiz karakter: ${invalid.join(' ')}. Yalnız A, B, C, D, E ve X (iptal) kullanılabilir.` };
  }
  return place(current, letters.map(normalizeAnswer), 'cevap');
}

/** Toplu konu: her satır bir soru; boş satır o sorunun konusunu boş bırakır. */
export function pasteTopics(current: readonly string[], text: string): PasteResult {
  const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((line) => line.trim());
  return place(current, lines, 'konu satırı');
}

function place(current: readonly string[], incoming: string[], noun: string): PasteResult {
  const count = current.length;
  if (incoming.length === 0 || (incoming.length === 1 && incoming[0] === '')) {
    return { values: [...current], range: null, warning: 'Yapıştırılacak veri bulunamadı.' };
  }
  const placed = Math.min(incoming.length, count);
  const values = current.map((value, index) => (index < placed ? incoming[index] ?? '' : value));
  let warning: string | null = null;
  if (incoming.length > count) {
    warning = `${incoming.length} ${noun} yapıştırıldı, bu derste ${count} soru var; fazla ${incoming.length - count} tanesi alınmadı.`;
  } else if (incoming.length < count) {
    warning = `${incoming.length} ${noun} yapıştırıldı, bu derste ${count} soru var; ${placed + 1}–${count}. sorular değişmedi.`;
  }
  return { values, range: [1, placed], warning };
}
