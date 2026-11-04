import { foldTr } from './foldTr';
import type { OpticalSubjectBlockDto, OpticalSubjectTopicsDto } from '../types/api/generated';

// ─── Soru konusu listesi ─────────────────────────────────────────────────────
// Konu analizi konuları adıyla topladığı için aynı konu her denemede aynı yazılmalı. Konu hücresi
// dersin hazır listesinden, kurumun eklediği konulardan ya da daha önce yazılmış konulardan seçilir;
// listede olmayan konu yine yazılabilir (yalnız o soruya) ya da kurum listesine eklenebilir.

/** Sunucudaki OpticalTopicCatalog.Levels ile aynı; boş = tüm seviyeler. */
export const TOPIC_LEVELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: '5', label: '5. sınıf' },
  { key: '6', label: '6. sınıf' },
  { key: '7', label: '7. sınıf' },
  { key: 'LGS', label: '8. sınıf (LGS)' },
  { key: 'TYT', label: 'TYT' },
  { key: 'AYT', label: 'AYT' },
  { key: 'YDT', label: 'YDT' },
];

/** Seviye seçilince önerilen yanlış götürme (yalnız yeni denemede uygulanır). */
export const levelPenalty = (level: string): number | null =>
  level === 'LGS' ? 3 : ['TYT', 'AYT', 'YDT'].includes(level) ? 4 : null;

export type TopicSource = 'builtin' | 'custom' | 'used';

export interface TopicOption {
  name: string;
  group: string;
  source: TopicSource;
  /** Kurum konusunun kimliği (listeden kaldırmak için). */
  id?: string;
}

/** Arama ve eşleştirme anahtarı: büyük/küçük harf, Türkçe harf ve fazla boşluk farkı yok sayılır. */
export const topicKey = (text: string) => foldTr(text.trim().replace(/\s+/g, ' ')).replace(/[’‘`]/g, "'");

/** Seçim listesi sırası: kurumun konuları, hazır liste (ünite başlıklarıyla), daha önce yazılmış konular. */
export function topicOptions(subject: OpticalSubjectTopicsDto | undefined): TopicOption[] {
  if (!subject) return [];
  const seen = new Set<string>();
  const options: TopicOption[] = [];
  const add = (option: TopicOption) => {
    const key = topicKey(option.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };
  subject.custom.forEach((item) => add({ name: item.name, group: 'Kurumun eklediği konular', source: 'custom', id: item.id }));
  subject.groups.forEach((group) => group.topics.forEach((name) => add({ name, group: group.label, source: 'builtin' })));
  subject.used.forEach((name) => add({ name, group: 'Daha önce yazılmış konular', source: 'used' }));
  return options;
}

/**
 * Yazılan metne göre süzer: her kelime konu adında ya da ünite başlığında geçmeli. Adı aranan metinle
 * başlayanlar öne alınır; aynı öncelikte liste sırası korunur.
 */
export function filterTopics(options: readonly TopicOption[], term: string): TopicOption[] {
  const words = topicKey(term).split(' ').filter(Boolean);
  if (words.length === 0) return [...options];
  const scored = options.flatMap((option, index) => {
    const name = topicKey(option.name);
    const haystack = `${name} ${topicKey(option.group)}`;
    if (!words.every((word) => haystack.includes(word))) return [];
    const rank = name.startsWith(words.join(' ')) ? 0 : words.every((word) => name.includes(word)) ? 1 : 2;
    return [{ option, rank, index }];
  });
  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).map((item) => item.option);
}

/** Metin listedeki bir konuyla (harf farkı gözetmeksizin) aynıysa listedeki yazımı döner. */
export function matchTopic(options: readonly TopicOption[], text: string): TopicOption | undefined {
  const key = topicKey(text);
  return key ? options.find((option) => topicKey(option.name) === key) : undefined;
}

/** Hücredeki konu listede yoksa true (boş hücre hariç). */
export const isUnlisted = (options: readonly TopicOption[], text: string) => Boolean(text.trim()) && !matchTopic(options, text);

/**
 * Yapıştırılan konuları listedeki yazıma çevirir; listede olmayanlar yazıldığı gibi kalır ve ayrıca döner.
 * Benzer ama farklı konu sessizce değiştirilmez (konu analizini bozmamak için).
 */
export function alignTopics(options: readonly TopicOption[], topics: readonly string[]): { values: string[]; unlisted: string[] } {
  const unlisted: string[] = [];
  const values = topics.map((topic) => {
    const trimmed = topic.trim();
    if (!trimmed) return '';
    const match = matchTopic(options, trimmed);
    if (match) return match.name;
    if (!unlisted.some((item) => topicKey(item) === topicKey(trimmed))) unlisted.push(trimmed);
    return trimmed;
  });
  return { values, unlisted };
}

const LGS_ONLY = ['T.C. İnkılap Tarihi ve Atatürkçülük'];
const TYT_ONLY = ['Temel Matematik', 'Sosyal Bilimler'];
const AYT_ONLY = ['Türk Dili ve Edebiyatı', 'Tarih-1', 'Coğrafya-1', 'Tarih-2', 'Coğrafya-2', 'Felsefe Grubu'];

/**
 * Yeni denemede seviye tahmini (kullanıcı değiştirebilir): şablondaki derslerden, sonra şablon adından
 * ("… (LGS)"), olmazsa yanlış götürmeden (3 = LGS). Tahmin edilemezse boş (tüm seviyeler).
 */
export function guessLevel(blocks: readonly OpticalSubjectBlockDto[], penalty: number, templateName = ''): string {
  const names = blocks.map((block) => block.name);
  if (names.includes('Yabancı Dil (YDT)')) return 'YDT';
  if (names.some((name) => AYT_ONLY.includes(name))) return 'AYT';
  if (names.some((name) => TYT_ONLY.includes(name))) return 'TYT';
  if (names.some((name) => LGS_ONLY.includes(name))) return 'LGS';
  const named = ['LGS', 'TYT', 'AYT', 'YDT'].find((level) => new RegExp(`\\b${level}\\b`, 'i').test(templateName));
  if (named) return named;
  return penalty === 3 ? 'LGS' : '';
}

/**
 * Sınıf adından konu listesi seviyesi (yalnız listeyi daraltır): "8-A" → LGS, "9-B"/"10" → TYT,
 * "11"/"12" → AYT, 5–7 → o sınıf; adı LGS/TYT/AYT/YDT içeriyorsa o. Anlaşılamazsa boş (tüm seviyeler).
 */
export function levelForClass(className: string): string {
  const named = ['LGS', 'TYT', 'AYT', 'YDT'].find((level) => new RegExp(`\\b${level}\\b`, 'i').test(className));
  if (named) return named;
  const grade = Number(/(?:^|\D)(\d{1,2})(?!\d)/.exec(className)?.[1] ?? NaN);
  if (grade >= 5 && grade <= 7) return String(grade);
  if (grade === 8) return 'LGS';
  if (grade === 9 || grade === 10) return 'TYT';
  if (grade === 11 || grade === 12) return 'AYT';
  return '';
}
