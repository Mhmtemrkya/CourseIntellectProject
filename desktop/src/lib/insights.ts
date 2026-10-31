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
  },
};

export const diagnosisOf = (code: string | null | undefined): DiagnosisMeta => DIAGNOSES[code ?? ''] ?? MISCONCEPTION;

export const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
