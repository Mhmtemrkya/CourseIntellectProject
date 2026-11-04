import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { applyOpticalStudyPlans, fetchOpticalStudyPlans } from '../../lib/api/modules';
import type { OpticalStudyPlanPreviewDto } from '../../types/api/generated';
import { OpticalStudyPlanDialog } from './OpticalStudyPlanDialog';

const mockToast = jest.fn();
jest.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../../lib/api/modules', () => ({ fetchOpticalStudyPlans: jest.fn(), applyOpticalStudyPlans: jest.fn() }));

const preview: OpticalStudyPlanPreviewDto = {
  examId: 'e1', examTitle: '2. LGS', hasTopics: true, studyPlanEnabled: true, message: null,
  students: [
    {
      studentUserId: 's1', studentName: 'Ayşe DOĞAN', className: '8-A', net: 3.67, hasParent: true, skipReason: null, alreadyApplied: false,
      weakTopics: [{ subject: 'Matematik', topic: 'Üslü İfadeler', correct: 0, wrong: 2, blank: 1, total: 3 }],
      tasks: [
        { title: 'Üslü İfadeler konu tekrarı', subject: 'Matematik', topic: 'Üslü İfadeler', date: '2026-11-03', durationMinutes: 30 },
        { title: 'Üslü İfadeler: 25 soru çöz', subject: 'Matematik', topic: 'Üslü İfadeler', date: '2026-11-04', durationMinutes: 40 },
      ],
      parentSummary: 'Ayşe DOĞAN, 2. LGS denemesinde toplam 3,67 net yaptı.',
    },
    {
      studentUserId: 's2', studentName: 'Mert KAYA', className: '8-A', net: 6, hasParent: false, skipReason: 'Bu denemede belirgin bir zayıf konu yok.',
      alreadyApplied: false, weakTopics: [], tasks: [], parentSummary: '',
    },
  ],
};

let root: Root;
let host: HTMLDivElement;
const originalActEnvironment: unknown = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  jest.mocked(fetchOpticalStudyPlans).mockResolvedValue(preview);
  jest.mocked(applyOpticalStudyPlans).mockResolvedValue({ applied: 1, tasksWritten: 2, parentsNotified: 1, skipped: [] });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
});

const clickText = async (text: string) => {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`${text} yok`);
  await act(async () => { Simulate.click(button); });
};

it('öneriyi gösterir, düzenlenen görevi ve veli özetini onayla gönderir', async () => {
  const onClose = jest.fn();
  await act(async () => root.render(<OpticalStudyPlanDialog examId="e1" examTitle="2. LGS" onClose={onClose} />));
  expect(document.body.textContent).toContain('Üslü İfadeler (2 Y, 1 B / 3)');
  expect(document.body.textContent).toContain('Bu denemede belirgin bir zayıf konu yok.');
  expect(document.body.textContent).toContain('1 öğrenci • 2 görev • 1 veliye özet');

  await clickText('Düzenle');
  const first = document.querySelector<HTMLInputElement>('input[aria-label="1. görev"]');
  if (!first) throw new Error('görev alanı yok');
  first.value = 'Üslü İfadeler video + özet';
  act(() => { Simulate.change(first); });
  const remove = document.querySelector<HTMLButtonElement>('button[aria-label="2. görevi kaldır"]');
  if (!remove) throw new Error('kaldır yok');
  act(() => { Simulate.click(remove); });

  await clickText('öğrenciye planı ekle');
  expect(applyOpticalStudyPlans).toHaveBeenCalledWith('e1', { students: [{
    studentUserId: 's1',
    tasks: [{ title: 'Üslü İfadeler video + özet', subject: 'Matematik', topic: 'Üslü İfadeler', date: '2026-11-03', durationMinutes: 30 }],
    sendParentSummary: true,
    parentSummary: preview.students[0]?.parentSummary,
  }] });
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Çalışma planları eklendi' }));
  expect(onClose).toHaveBeenCalled();
});

it('boş görev başlığıyla göndermez', async () => {
  await act(async () => root.render(<OpticalStudyPlanDialog examId="e1" examTitle="2. LGS" onClose={jest.fn()} />));
  await clickText('Düzenle');
  const first = document.querySelector<HTMLInputElement>('input[aria-label="1. görev"]');
  if (!first) throw new Error('görev alanı yok');
  first.value = '  ';
  act(() => { Simulate.change(first); });
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('boş görev başlığı');
  const submit = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes('öğrenciye planı ekle'));
  expect(submit?.disabled).toBe(true);
});
