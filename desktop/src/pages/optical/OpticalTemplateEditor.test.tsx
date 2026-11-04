import { TextDecoder, TextEncoder } from 'util';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { saveOpticalTemplate, suggestOpticalTemplate } from '../../lib/api/modules';
import type { OpticalTemplateDto, OpticalTemplateSuggestionDto } from '../../types/api/generated';
import { OpticalTemplateEditor } from './OpticalEditors';

// jsdom TextDecoder sağlamaz; önizleme dosyayı tarayıcıdakiyle aynı WHATWG çözücüsüyle okur.
Object.assign(globalThis, { TextDecoder, TextEncoder });

const mockToast = jest.fn();
jest.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../../lib/api/modules', () => ({ saveOpticalExam: jest.fn(), saveOpticalTemplate: jest.fn(), suggestOpticalTemplate: jest.fn() }));

const legacy: OpticalTemplateDto = {
  id: 'tpl', name: 'Eski şablon', encoding: 'windows-1254', studentNoStart: 1, studentNoLength: 10, nameStart: 11, nameLength: 20,
  classStart: 31, classLength: 4, bookletStart: 35, bookletLength: 1, lineLength: 76,
  subjects: [{ name: 'Matematik', start: 36, count: 20 }, { name: 'Fen', start: 56, count: 20 }],
};

let root: Root;
let host: HTMLDivElement;
const originalActEnvironment: unknown = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  jest.clearAllMocks();
  jest.mocked(saveOpticalTemplate).mockResolvedValue(legacy);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
});

const render = (template: OpticalTemplateDto | null) =>
  act(() => root.render(<OpticalTemplateEditor open template={template} onClose={jest.fn()} onSaved={jest.fn()} />));
const selects = () => Array.from(document.querySelectorAll<HTMLSelectElement>('select[aria-label="Ders"]'));
const options = (select: HTMLSelectElement | undefined) => Array.from(select?.options ?? []).map((option) => option.value);
const clickText = (text: string) => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`${text} yok`);
  act(() => Simulate.click(button));
};

it('dersler gruplu listeden seçilir; başka satırda seçilen ders listede çıkmaz', () => {
  render(null);
  const [first] = selects();
  expect(first?.value).toBe('Türkçe');
  expect(Array.from(first?.querySelectorAll('optgroup') ?? []).map((group) => group.label)).toContain('LGS');
  expect(options(first)).toEqual(expect.arrayContaining(['Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Fizik']));

  clickText('Ders ekle');
  const [, second] = selects();
  expect(second?.value).toBe('Matematik');
  expect(options(second)).not.toContain('Türkçe');
  expect(options(selects()[0])).not.toContain('Matematik');
});

it('listede olmayan eski ders adı korunur ve kaydedilir', async () => {
  render(legacy);
  const [, fen] = selects();
  expect(fen?.value).toBe('Fen');
  expect(fen?.options[0]?.textContent).toBe('Fen (mevcut kayıt)');

  await act(async () => { clickText('Kaydet'); });
  expect(jest.mocked(saveOpticalTemplate).mock.calls[0]?.[1].subjects.map((item) => item.name)).toEqual(['Matematik', 'Fen']);
});

const type = (id: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(id);
  input.value = value;
  act(() => Simulate.change(input));
};
const summary = (id: string) => document.querySelector(`[data-testid="reading-${id}"]`)?.textContent;
const saveButton = () => Array.from(document.querySelectorAll('button')).find((item) => item.textContent === 'Kaydet');

it('okuma özeti konumla birlikte güncellenir; çakışmada kaydetmez ve iki alanı söyler', () => {
  render(null);
  expect(summary('studentNo')).toBe('Her satırın 1–10. karakterleri öğrenci numarası olarak okunacak.');
  expect(summary('booklet')).toBe('Her satırın 40. karakteri kitapçık türü olarak okunacak.');
  expect(document.body.textContent).toContain('Karakter sayısı, ismin harf sayısı değildir.');
  expect(document.body.textContent).toContain('Bu değerleri nasıl bulabilirim?');

  type('tpl-name', 'Yeni');
  type('tpl-class-length', '0');
  expect(summary('class')).toBe('Bu alan dosyadan okunmayacak.');
  type('tpl-studentNo-start', '2');
  type('tpl-studentNo-length', '9');
  expect(summary('studentNo')).toBe('Her satırın 2–10. karakterleri öğrenci numarası olarak okunacak.');

  type('tpl-name-length', '27');
  expect(document.querySelector('[role="alert"]')).toBeNull();
  type('tpl-booklet-start', '30');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Ad soyad (11–37. karakterler) ile Kitapçık (30. karakter) çakışıyor');
  expect(saveButton()?.disabled).toBe(true);
});

// ─── Dosyadan otomatik öneri ────────────────────────────────────────────────

const suggestion: OpticalTemplateSuggestionDto = {
  supported: true, message: 'Öneri hazır.', encoding: 'utf-8', format: 'fixed', totalLines: 180, sampledLines: 180,
  typicalLineLength: 281, minLineLength: 281, maxLineLength: 281,
  fields: [
    { key: 'studentNo', label: 'Öğrenci no', start: 21, length: 10, confidence: 'low', reason: 'iki rakam alanı var' },
    { key: 'name', label: 'Ad soyad', start: 1, length: 20, confidence: 'high', reason: 'harf ve boşluk' },
    { key: 'class', label: 'Sınıf', start: 1, length: 0, confidence: 'none', reason: 'Algılanamadı / Dosyada bulunmuyor olabilir.' },
    { key: 'booklet', label: 'Kitapçık', start: 31, length: 1, confidence: 'high', reason: 'A-D' },
  ],
  numberCandidates: [
    { id: 'n1', start: 21, length: 10, distinctValues: 180, constant: false, leadingZeros: false, note: 'hepsi farklı' },
    { id: 'n2', start: 140, length: 5, distinctValues: 170, constant: false, leadingZeros: false, note: 'çoğu farklı' },
  ],
  answerBlocks: [{ label: 'Cevap bloğu 1', start: 32, count: 95, confidence: 'medium', reason: 'A-E', countNeedsConfirmation: true }],
  booklets: ['A', 'B', 'C', 'D'], flaggedLines: [{ line: 1, kind: 'header', reason: 'Başlık satırı olabilir.' }], warnings: [],
  confirmations: ['Cevap bloğu 1: gerçek soru sayısını doğrulayın.'], aiStatus: 'disabled', aiNotes: [], manualRecommended: false,
};

const pickSuggestionFile = async (name: string) => {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Öneri için optik dosyası"]');
  if (!input) throw new Error('dosya alanı yok');
  const file = new File(['AYŞE DEMİR          1109161866CABCDE'], name, { type: 'text/plain' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { Simulate.change(input); });
  // FileReader jsdom'da zamanlayıcıyla biter; okuma ve yanıt işlenene kadar bekle.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
};
const value = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)?.value;

it('yeni şablonda öneri forma yerleşir; cevap bloğu ders seçilene kadar kaydedilmez', async () => {
  jest.mocked(suggestOpticalTemplate).mockResolvedValue(suggestion);
  render(null);
  await pickSuggestionFile('ornek.dat');

  expect(suggestOpticalTemplate).toHaveBeenCalledWith(expect.any(File), 'auto');
  expect(document.body.textContent).toContain('Bu özellik dosya düzenini önerir. Cevap anahtarı ve soru konuları ayrıca girilir.');
  expect(document.querySelector('[data-testid="suggested-class"]')?.textContent).toContain('Algılanamadı');
  expect(document.querySelector('[data-testid="suggested-studentNo"]')?.textContent).toContain('Düşük güven');
  expect(document.body.textContent).toContain('1. satır: Başlık satırı olabilir.');
  expect([value('tpl-name-start'), value('tpl-name-length'), value('tpl-studentNo-start'), value('tpl-booklet-start'), value('tpl-class-length')])
    .toEqual(['1', '20', '21', '31', '0']);
  expect([value('tpl-subject-0-start'), value('tpl-subject-0-length')]).toEqual(['32', '95']);
  expect(selects()[0]?.options[0]?.textContent).toBe('Cevap bloğu 1 — ders seçin');
  expect(document.querySelector('[data-testid="optical-sample-line"]')).not.toBeNull();

  // Numara adayı değişince yalnız öğrenci numarası güncellenir.
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="optical-number-candidate"]'));
  act(() => { if (radios[1]) Simulate.change(radios[1]); });
  expect([value('tpl-studentNo-start'), value('tpl-studentNo-length')]).toEqual(['140', '5']);

  type('tpl-name', 'İnternet örneği');
  expect(saveButton()?.disabled).toBe(true);
  expect(document.body.textContent).toContain('Cevap bloğu 1 için listeden ders seçin.');
  const select = selects()[0];
  if (!select) throw new Error('ders yok');
  select.value = 'Türkçe';
  act(() => Simulate.change(select));
  expect(saveButton()?.disabled).toBe(false);
  expect(saveOpticalTemplate).not.toHaveBeenCalled();
});

it('düzenlenen şablonda öneri ayrı gösterilir; form ancak "Öneriyi uygula" ile değişir', async () => {
  jest.mocked(suggestOpticalTemplate).mockResolvedValue(suggestion);
  render(legacy);
  await pickSuggestionFile('ornek.dat');
  expect(value('tpl-name-length')).toBe('20');
  expect(value('tpl-subject-0-start')).toBe('36');
  clickText('Öneriyi uygula');
  expect([value('tpl-subject-0-start'), value('tpl-subject-0-length'), value('tpl-booklet-start')]).toEqual(['32', '95', '31']);
  expect(document.body.textContent).toContain('Öneri forma uygulandı');
});

it('geç gelen eski analiz yanıtı yeni dosyanın önerisinin üzerine yazmaz', async () => {
  let resolveOld: (value: OpticalTemplateSuggestionDto) => void = () => undefined;
  const newer = { ...suggestion, fields: suggestion.fields.map((field) => (field.key === 'name' ? { ...field, length: 18 } : field)) };
  jest.mocked(suggestOpticalTemplate)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(newer);
  render(null);
  await pickSuggestionFile('eski.dat');
  await pickSuggestionFile('yeni.dat');
  expect(value('tpl-name-length')).toBe('18');
  await act(async () => { resolveOld(suggestion); });
  expect(value('tpl-name-length')).toBe('18');
});

it('pencere kapanınca bekleyen analiz yeni açılan forma yazılmaz', async () => {
  let resolveOld: (value: OpticalTemplateSuggestionDto) => void = () => undefined;
  jest.mocked(suggestOpticalTemplate).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  render(null);
  await pickSuggestionFile('eski.dat');
  act(() => root.render(<OpticalTemplateEditor open={false} template={null} onClose={jest.fn()} onSaved={jest.fn()} />));
  render(null);
  await act(async () => { resolveOld(suggestion); });
  expect(value('tpl-name-length')).toBe('25');
  expect(document.querySelector('[data-testid="optical-suggestion"]')).toBeNull();
});

it('analiz hatasında anlaşılır mesaj verir, elle giriş açık kalır', async () => {
  jest.mocked(suggestOpticalTemplate).mockRejectedValue(new Error('Sunucuya ulaşılamadı'));
  render(null);
  await pickSuggestionFile('ornek.dat');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Dosya analiz edilemedi: Sunucuya ulaşılamadı. Değerleri elle girebilirsiniz.');
  expect(value('tpl-name-length')).toBe('25');
});

it('bloğu derslere böler', () => {
  render(null);
  clickText('Bloğu derslere böl');
  type('tpl-split-0', '15');
  clickText('Böl');
  expect([value('tpl-subject-0-length'), value('tpl-subject-1-start'), value('tpl-subject-1-length')]).toEqual(['15', '56', '25']);
});
