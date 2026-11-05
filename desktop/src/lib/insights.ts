// Konu analizi teşhis kataloğu. Sunucudaki StudentInsightCalculator ile aynı metinler;
// sunucu yalnız teşhis kodunu döndürür, metin burada (çeviri katmanı bu sabit cümleleri çevirir).

/** advice: personel/veliye üçüncü tekil; selfAdvice: öğrencinin kendisine "sen" diliyle. */
export interface DiagnosisMeta { label: string; advice: string; selfAdvice: string; tone: string }

export const MISCONCEPTION: DiagnosisMeta = {
  label: 'Yanlışlar ağırlıkta',
  advice: 'Kavram yanılgısı olabilir; temel kuralları tekrar edip çözümlü örneklerle hata analizi yapması önerilir.',
  selfAdvice: 'Burada bir kavram yanılgısı olabilir; temel kuralları tekrar et, sonra çözümlü örneklerle yanlışlarının nedenine bak.',
  tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export const DIAGNOSES: Record<string, DiagnosisMeta> = {
  misconception: MISCONCEPTION,
  skipping: {
    label: 'Boş bırakma eğilimi',
    advice: 'Kolaydan zora sıralanmış kısa testlerle soruya başlama alışkanlığı kazanması önerilir.',
    selfAdvice: 'Soruları boş bırakma eğilimindesin; kolaydan zora giden kısa testlerle soruya başlama alışkanlığı kazanabilirsin.',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  declining: {
    label: 'Son çalışmalarda düşüş',
    advice: 'Kısa bir konu tekrarı yapıp son yanlışlarını yeniden çözmesi önerilir.',
    selfAdvice: 'Son çalışmalarında biraz düşüş var; kısa bir konu tekrarı yapıp son yanlışlarını yeniden çözmeni öneririm.',
    tone: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },  improving: {
    label: 'Toparlanıyor',
    advice: 'Toparlanma var; aynı tempoda devam edip haftada bir kısa tekrarla kazanımı pekiştirmesi önerilir.',
    selfAdvice: 'Bu konuda toparlanıyorsun; aynı tempoda devam et, haftada bir kısa tekrarla pekiştir.',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  class_wide: {
    label: 'Ortak zorluk',
    advice: 'Birçok öğrencinin zorlandığı bir konu; temel örneklerden başlayıp adım adım zorlaşan alıştırmalarla ilerlemesi önerilir.',
    selfAdvice: 'Bu konu birçok öğrenci için zor; temel örneklerden başlayıp adım adım zorlaşan sorularla ilerleyebilirsin.',
    tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  stale: {
    label: 'Uzun süredir çalışılmadı',
    advice: 'Bu konu uzun süredir çalışılmamış; kısa bir hatırlatma tekrarı ve birkaç soruyla konuyu tazelemesi önerilir.',
    selfAdvice: 'Bu konuya uzun süredir bakmadın; kısa bir hatırlatma tekrarı ve birkaç soruyla tazeleyebilirsin.',
    tone: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
};

export const diagnosisOf = (code: string | null | undefined): DiagnosisMeta => DIAGNOSES[code ?? ''] ?? MISCONCEPTION;

export const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;

/** Önerinin dayanağı ("neden"): sunucunun döndürdüğü sayılardan kurulur; yeni metin üretmez. */
export interface TopicEvidence { solved: number; wrong: number; blank: number; successRate: number; trend?: string | null; previousSuccessRate?: number | null; recentSuccessRate?: number | null }

export function topicReason(topic: TopicEvidence): string {
  const parts = [`${topic.solved} sorudan ${topic.wrong} yanlış`];
  if (topic.blank > 0) parts.push(`${topic.blank} boş`);
  let text = `${parts.join(', ')} • başarı ${formatPct(topic.successRate)}`;
  if ((topic.trend === 'down' || topic.trend === 'up') && topic.previousSuccessRate != null && topic.recentSuccessRate != null) {
    text += ` • ${formatPct(topic.previousSuccessRate)} → ${formatPct(topic.recentSuccessRate)}`;
  }
  return text;
}

/** Haftalık somut adım: önerilen soru sayısı birkaç güne bölünür. */
export function questionPlan(questions: number | null | undefined): string | null {
  if (!questions || questions <= 0) return null;
  const perDay = Math.ceil(questions / 4);
  return `Bu hafta: ${questions} soru, 4 güne bölerek günde ~${perDay}; hafta sonunda kısa bir mini test.`;
}

/** Önceki önerinin sonucu ("o konuda sonrasında ne oldu"; öneriye bağlanmaz). */
export const FOLLOWUP_STATUS: Record<string, { label: string; tone: string }> = {
  improved: { label: 'İlerleme var', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  steady: { label: 'Belirgin değişim yok', tone: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  declined: { label: 'Düşüş var', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  pending: { label: 'Ölçülüyor', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  not_practiced: { label: 'Çalışılmadı', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};

const PENDING_STATUS = { label: 'Ölçülüyor', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' };
export const followupStatusOf = (status: string | null | undefined) => FOLLOWUP_STATUS[status ?? ''] ?? PENDING_STATUS;

/** Öğretmene sınıf önerisi türleri. */
export interface ClassActionMeta { label: string; advice: string; tone: string }

export const STUDY_GROUP: ClassActionMeta = {
  label: 'Etüt grubu',
  advice: 'Birkaç öğrenci aynı konuda zorlanıyor; küçük bir etüt grubunda birlikte çalışmaları önerilir.',
  tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export const CLASS_ACTIONS: Record<string, ClassActionMeta> = {
  study_group: STUDY_GROUP,
  class_review: {
    label: 'Sınıf tekrarı',
    advice: 'Sınıfın önemli bir kısmı zorlanıyor; derste kısa bir konu tekrarı ve birlikte çözülen örnekler önerilir.',
    tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
};

export const classActionOf = (kind: string | null | undefined): ClassActionMeta => CLASS_ACTIONS[kind ?? ''] ?? STUDY_GROUP;
