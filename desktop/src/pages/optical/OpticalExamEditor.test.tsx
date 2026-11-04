import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { addTopic, fetchTopics, saveOpticalExam } from '../../lib/api/modules';
import type { OpticalExamDto, OpticalTemplateDto, OpticalTopicCatalogDto } from '../../types/api/generated';
import { OpticalExamEditor } from './OpticalEditors';

const mockToast = jest.fn();
jest.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../../lib/api/modules', () => ({
  saveOpticalExam: jest.fn(), saveOpticalTemplate: jest.fn(),
  fetchTopics: jest.fn(), addTopic: jest.fn(), deleteTopic: jest.fn(),
}));

// Radix Popover konumlandırması jsdom'da ResizeObserver ister.
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const catalog: OpticalTopicCatalogDto = {
  level: 'LGS',
  levels: [{ key: 'LGS', label: '8. sınıf (LGS)' }],
  subjects: [
    { subject: 'Türkçe', groups: [{ label: 'Anlam Bilgisi', topics: ['Sözcükte Anlam', 'Paragrafta Anlam'] }], custom: [], used: ['Paragraf'] },
    {
      subject: 'Matematik',
      groups: [{ label: 'Sayılar ve İşlemler', topics: ['Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler'] }],
      custom: [{ id: 'c1', subject: 'Matematik', level: 'LGS', name: 'Sayı Örüntüleri' }],
      used: [],
    },
  ],
};

const template: OpticalTemplateDto = {
  id: 'tpl', name: 'LGS', encoding: 'windows-1254', studentNoStart: 1, studentNoLength: 10, nameStart: 11, nameLength: 20,
  classStart: 31, classLength: 4, bookletStart: 35, bookletLength: 1, lineLength: 42,
  subjects: [{ name: 'Türkçe', start: 36, count: 3 }, { name: 'Matematik', start: 39, count: 4 }],
};

const exam: OpticalExamDto = {
  id: 'exam', title: '1. Deneme', examDateUtc: '2026-10-20T09:00:00Z', templateId: 'tpl', wrongPenalty: 3, multiMarkAsWrong: true,
  cancelledMode: 'exclude', level: '', status: 'imported', fileName: 'x.txt', importedStudentCount: 12, importedAtUtc: '2026-10-21T09:00:00Z',
  keys: [
    { booklet: 'A', subjects: [
      { subject: 'Türkçe', answers: 'ABC', topics: ['Paragraf', 'Paragraf', 'Sözcükte Anlam'] },
      { subject: 'Matematik', answers: 'DEX*', topics: [] },
    ] },
    { booklet: 'B', subjects: [
      { subject: 'Türkçe', answers: 'CBA', topics: [] },
      { subject: 'Matematik', answers: 'EDCB', topics: [] },
    ] },
  ],
};

let root: Root;
let host: HTMLDivElement;
const originalActEnvironment: unknown = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
const onSaved = jest.fn();

async function render(current: OpticalExamDto | null) {
  await act(async () => root.render(<OpticalExamEditor open exam={current} templates={[template]} onClose={jest.fn()} onSaved={onSaved} />));
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  jest.clearAllMocks();
  jest.mocked(saveOpticalExam).mockResolvedValue(null);
  jest.mocked(fetchTopics).mockResolvedValue(catalog);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
});

const section = (name: string) => {
  const found = document.querySelector<HTMLElement>(`section[aria-label="${name} cevap anahtarı"]`);
  if (!found) throw new Error(`${name} bölümü yok`);
  return found;
};
const rowLabels = (name: string) => Array.from(section(name).querySelectorAll('tbody th')).map((cell) => cell.textContent);
const selected = (name: string) => Array.from(section(name).querySelectorAll('[role="radiogroup"]'))
  .map((group) => group.querySelector('[aria-checked="true"]')?.textContent ?? '');
const topics = (name: string) => Array.from(section(name).querySelectorAll<HTMLInputElement>('tbody input')).map((input) => input.value);
const choose = (name: string, question: number, answer: string) => {
  const group = section(name).querySelector(`[aria-label="${question}. soru doğru cevap"]`);
  const button = Array.from(group?.querySelectorAll('button') ?? []).find((item) => item.textContent === answer);
  if (!button) throw new Error('seçenek yok');
  act(() => Simulate.click(button));
};
const clickText = (text: string) => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.startsWith(text));
  if (!button) throw new Error(`${text} butonu yok`);
  act(() => Simulate.click(button));
};
const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  element.value = value;
  act(() => Simulate.change(element));
};
const press = (element: HTMLElement, key: string) => act(() => { Simulate.keyDown(element, { key }); });
const topicInput = (name: string, question: number) => {
  const input = section(name).querySelector<HTMLInputElement>(`[aria-label="${question}. soru konusu"]`);
  if (!input) throw new Error('konu alanı yok');
  return input;
};
const optionTexts = () => Array.from(document.querySelectorAll('[role="option"]')).map((item) => item.textContent ?? '');
const lastPayload = () => jest.mocked(saveOpticalExam).mock.calls.at(-1)?.[1];

it('mevcut kaydı ders başlıkları altında, 1’den başlayan soru satırlarıyla açar', async () => {
  await render(exam);
  expect(rowLabels('Türkçe')).toEqual(['1. Soru', '2. Soru', '3. Soru']);
  expect(rowLabels('Matematik')).toEqual(['1. Soru', '2. Soru', '3. Soru', '4. Soru']);
  expect(selected('Türkçe')).toEqual(['A', 'B', 'C']);
  expect(selected('Matematik')).toEqual(['D', 'E', 'X', 'X']);
  expect(topics('Türkçe')).toEqual(['Paragraf', 'Paragraf', 'Sözcükte Anlam']);
  expect(section('Türkçe').querySelectorAll('[role="radiogroup"]')[0]?.querySelectorAll('button')).toHaveLength(6);
});

it('kitapçıklar ayrı tutulur ve kitapçık değişince girilenler korunur', async () => {
  await render(exam);
  clickText('B kitapçığı');
  expect(selected('Türkçe')).toEqual(['C', 'B', 'A']);
  choose('Türkçe', 2, 'E');
  const input = section('Türkçe').querySelector<HTMLInputElement>('[aria-label="1. soru konusu"]');
  if (!input) throw new Error('konu alanı yok');
  typeInto(input, 'Kesirler');
  press(input, 'Enter');
  clickText('A kitapçığı');
  expect(selected('Türkçe')).toEqual(['A', 'B', 'C']);
  clickText('B kitapçığı');
  expect(selected('Türkçe')).toEqual(['C', 'E', 'A']);
  expect(topics('Türkçe')[0]).toBe('Kesirler');

  await act(async () => { clickText('Kaydet'); });
  expect(saveOpticalExam).toHaveBeenCalledWith('exam', expect.objectContaining({ title: '1. Deneme' }));
  expect(lastPayload()?.keys).toEqual([
    { booklet: 'A', subjects: [
      { subject: 'Türkçe', answers: 'ABC', topics: ['Paragraf', 'Paragraf', 'Sözcükte Anlam'] },
      { subject: 'Matematik', answers: 'DEXX', topics: [] },
    ] },
    { booklet: 'B', subjects: [
      { subject: 'Türkçe', answers: 'CEA', topics: ['Kesirler', '', ''] },
      { subject: 'Matematik', answers: 'EDCB', topics: [] },
    ] },
  ]);
});

it('yeni denemede eksik cevapla kaydetmez, toplu yapıştırma yerleştiği soruları gösterir', async () => {
  await render(null);
  const title = document.querySelector<HTMLInputElement>('#exam-title');
  if (!title) throw new Error('başlık yok');
  typeInto(title, 'Yeni Deneme');
  expect(selected('Matematik')).toEqual(['', '', '', '']);

  await act(async () => { clickText('Kaydet'); });
  expect(saveOpticalExam).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('A kitapçığı / Türkçe: 3 soru cevapsız (1, 2, 3)');

  const paste = (name: string) => {
    const button = Array.from(section(name).querySelectorAll('button')).find((item) => item.textContent === 'Toplu yapıştır');
    if (!button) throw new Error('yapıştır yok');
    act(() => Simulate.click(button));
    return section(name);
  };
  const math = paste('Matematik');
  const [answers, topicArea] = Array.from(math.querySelectorAll('textarea'));
  if (!answers || !topicArea) throw new Error('alan yok');
  typeInto(answers, 'ABC');
  clickText('Cevapları yerleştir');
  expect(selected('Matematik')).toEqual(['A', 'B', 'C', '']);
  expect(math.querySelector('[role="status"]')?.textContent).toContain('1–3. sorulara yerleşti');
  expect(math.querySelector('[role="status"]')?.textContent).toContain('bu derste 4 soru var');
  expect(math.querySelectorAll('tbody tr[class*="bg-sky-500"]')).toHaveLength(3);

  typeInto(topicArea, 'Kesirler\nDenklemler\nGeometri\nOlasılık');
  clickText('Konuları yerleştir');
  expect(topics('Matematik')).toEqual(['Kesirler', 'Denklemler', 'Geometri', 'Olasılık']);

  choose('Matematik', 4, 'X');
  ['A', 'B', 'C'].forEach((answer, index) => choose('Türkçe', index + 1, answer));
  await act(async () => { clickText('Kaydet'); });
  expect(saveOpticalExam).toHaveBeenCalledWith(null, expect.objectContaining({ title: 'Yeni Deneme', templateId: 'tpl' }));
  expect(lastPayload()?.keys).toEqual([{ booklet: 'A', subjects: [
    { subject: 'Türkçe', answers: 'ABC', topics: [] },
    { subject: 'Matematik', answers: 'ABCX', topics: ['Kesirler', 'Denklemler', 'Geometri', 'Olasılık'] },
  ] }]);
  expect(onSaved).toHaveBeenCalled();
});

it('seviyeyi tahmin eder, konu listesini o seviyeyle ister ve kaydeder', async () => {
  await render(exam);
  expect(document.querySelector<HTMLSelectElement>('#exam-level')?.value).toBe('LGS');
  expect(fetchTopics).toHaveBeenLastCalledWith('LGS', ['Türkçe', 'Matematik']);

  const level = document.querySelector<HTMLSelectElement>('#exam-level');
  if (!level) throw new Error('seviye yok');
  level.value = 'TYT';
  await act(async () => { Simulate.change(level); });
  expect(fetchTopics).toHaveBeenLastCalledWith('TYT', ['Türkçe', 'Matematik']);
  // Mevcut denemede seviye değişince yanlış götürme kendiliğinden değişmez.
  expect(document.querySelector<HTMLSelectElement>('#exam-penalty')?.value).toBe('3');

  await act(async () => { clickText('Kaydet'); });
  expect(lastPayload()?.level).toBe('TYT');
});

it('konu hücresi Türkçe harf duyarsız süzer, Enter seçip sonraki soruya geçer', async () => {
  await render(exam);
  const first = topicInput('Matematik', 1);
  act(() => { first.focus(); });
  typeInto(first, 'uslu');
  expect(optionTexts()[0]).toBe('Üslü İfadelerSayılar ve İşlemler');
  expect(optionTexts()).toHaveLength(3);
  press(first, 'Enter');
  expect(topicInput('Matematik', 1).value).toBe('Üslü İfadeler');
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  expect(document.activeElement).toBe(topicInput('Matematik', 2));

  // Boş aramada kurumun konuları en üstte, ünite başlıklarıyla birlikte listelenir.
  const second = topicInput('Matematik', 2);
  act(() => Simulate.click(second));
  expect(optionTexts()[0]).toContain('Sayı Örüntüleri');
  expect(document.body.textContent).toContain('Kurumun eklediği konular');
  expect(document.body.textContent).toContain('Sayılar ve İşlemler');
});

it('listede olmayan konu yalnız o soruya yazılır ya da kurum listesine eklenir', async () => {
  jest.mocked(addTopic).mockResolvedValue({ status: 'created', name: 'Sayısal Akıl Yürütme', topic: { id: 'c2', subject: 'Matematik', level: 'LGS', name: 'Sayısal Akıl Yürütme' } });
  await render(exam);

  const first = topicInput('Matematik', 1);
  typeInto(first, 'Bulmaca');
  expect(optionTexts()).toEqual(['“Bulmaca” — yalnız bu soruya yaz', '“Bulmaca” konusunu listeye ekle']);
  press(first, 'Enter');
  expect(topicInput('Matematik', 1).value).toBe('Bulmaca');
  expect(section('Matematik').textContent).toContain('listede yok');

  const second = topicInput('Matematik', 2);
  typeInto(second, 'sayısal akıl yürütme');
  press(second, 'ArrowDown');
  await act(async () => { Simulate.keyDown(second, { key: 'Enter' }); });
  expect(addTopic).toHaveBeenCalledWith({ subject: 'Matematik', level: 'LGS', name: 'sayısal akıl yürütme' });
  expect(topicInput('Matematik', 2).value).toBe('Sayısal Akıl Yürütme');
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Konu listeye eklendi' }));

  // Eklenen konu artık listede: üçüncü soruda aranınca çıkar.
  const third = topicInput('Matematik', 3);
  typeInto(third, 'akil');
  expect(optionTexts()[0]).toContain('Sayısal Akıl Yürütme');
});

it('yapıştırılan konular listedeki yazıma çevrilir, listede olmayanlar sayılır ve eklenebilir', async () => {
  jest.mocked(addTopic).mockResolvedValue({ status: 'created', name: 'Sayı Bulmacaları', topic: { id: 'c3', subject: 'Matematik', level: 'LGS', name: 'Sayı Bulmacaları' } });
  await render(exam);
  const button = Array.from(section('Matematik').querySelectorAll('button')).find((item) => item.textContent === 'Toplu yapıştır');
  if (!button) throw new Error('yapıştır yok');
  act(() => Simulate.click(button));
  const topicArea = section('Matematik').querySelectorAll('textarea')[1];
  if (!topicArea) throw new Error('alan yok');
  typeInto(topicArea, 'uslu ifadeler\nKAREKÖKLÜ İFADELER\nsayı bulmacaları\n');
  clickText('Konuları yerleştir');
  expect(topics('Matematik')).toEqual(['Üslü İfadeler', 'Kareköklü İfadeler', 'sayı bulmacaları', '']);
  expect(section('Matematik').textContent).toContain('Listede yok: 1 konu (sayı bulmacaları)');

  await act(async () => { clickText('Hepsini listeye ekle'); });
  expect(addTopic).toHaveBeenCalledWith({ subject: 'Matematik', level: 'LGS', name: 'sayı bulmacaları' });
  expect(topics('Matematik')).toEqual(['Üslü İfadeler', 'Kareköklü İfadeler', 'Sayı Bulmacaları', '']);
  expect(section('Matematik').textContent).not.toContain('Listede yok');
});

it('Escape aramayı iptal eder, hücre önceki konusunda kalır', async () => {
  await render(exam);
  const first = topicInput('Türkçe', 1);
  typeInto(first, 'yarım kalan arama');
  press(first, 'Escape');
  expect(topicInput('Türkçe', 1).value).toBe('Paragraf');
  expect(optionTexts()).toEqual([]);
});
