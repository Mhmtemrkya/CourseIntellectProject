import type { OpticalTemplateSuggestionDto, SaveOpticalTemplateRequest } from '../../types/api/generated';

// ─── Dosyadan şablon önerisini forma uygulama ────────────────────────────────
// Konumlar sunucuda kurallı hesaplanır; burada yalnız forma yerleştirilir. Bulunamayan alan
// (karakter sayısı 0) okunmaz; cevap blokları ders adı olmadan gelir (kullanıcı listeden seçer).

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Yüksek güven',
  medium: 'Orta güven',
  low: 'Düşük güven',
  none: 'Algılanamadı',
};

export const AI_STATUS_LABEL: Record<string, string> = {
  used: 'Yerel yapay zekâ adayları yorumlamaya yardım etti; konumlar kurallı kontrollerle hesaplandı.',
  'not-needed': 'Dosya düzeni kurallı kontrollerle netleşti; yapay zekâya gerek olmadı.',
  disabled: 'Yerel yapay zekâ kapalı; öneri kurallı kontrollerle üretildi.',
  unavailable: 'Yerel yapay zekâya ulaşılamadı; öneri kurallı kontrollerle üretildi.',
  timeout: 'Yerel yapay zekâ zamanında yanıt vermedi; öneri kurallı kontrollerle üretildi.',
  invalid: 'Yerel yapay zekânın yanıtı geçersizdi ve kullanılmadı; öneri kurallı kontrollerle üretildi.',
};

/** Öneriyi forma yerleştirir. numberCandidateId verilirse öğrenci numarası o adaydan alınır. */
export function applySuggestion(
  form: SaveOpticalTemplateRequest,
  suggestion: OpticalTemplateSuggestionDto,
  numberCandidateId?: string,
): SaveOpticalTemplateRequest {
  const field = (key: string): [number, number] => {
    const found = suggestion.fields.find((item) => item.key === key);
    return found && found.length > 0 ? [found.start, found.length] : [1, 0];
  };
  const candidate = suggestion.numberCandidates.find((item) => item.id === numberCandidateId);
  const [studentNoStart, studentNoLength] = candidate ? [candidate.start, candidate.length] : field('studentNo');
  const [nameStart, nameLength] = field('name');
  const [classStart, classLength] = field('class');
  const [bookletStart, bookletLength] = field('booklet');
  return {
    ...form,
    // "Otomatik algıla" seçiliyse öyle kalır; değilse dosyanın çözüldüğü kodlama seçilir.
    encoding: form.encoding === 'auto' ? 'auto' : suggestion.encoding,
    studentNoStart, studentNoLength, nameStart, nameLength, classStart, classLength, bookletStart, bookletLength,
    subjects: suggestion.answerBlocks.length > 0
      ? suggestion.answerBlocks.map((block) => ({ name: '', start: block.start, count: block.count }))
      : form.subjects,
  };
}

/** Bir cevap bloğunu ilk `first` soru ve kalan sorular olarak ikiye böler (ikincinin dersi seçilecek). */
export function splitSubject(form: SaveOpticalTemplateRequest, index: number, first: number): SaveOpticalTemplateRequest {
  const subject = form.subjects[index];
  if (!subject || first < 1 || first >= subject.count) return form;
  const head = { ...subject, count: first };
  const tail = { name: '', start: subject.start + first, count: subject.count - first };
  return { ...form, subjects: [...form.subjects.slice(0, index), head, tail, ...form.subjects.slice(index + 1)] };
}
