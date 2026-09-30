import { cardTone, cardToneForPath, cardHeading } from './card-palette';
import { CardHeader, CardTitle } from './card';

test('semantic tones distinguish overdue counts, amounts and academic cards', () => {
  expect(cardTone('Geciken Kayıt')).toBe('amber');
  expect(cardTone('Geciken Tutar')).toBe('rose');
  expect(cardTone('Tahsilat')).toBe('emerald');
  expect(cardTone('Ödevler')).toBe('violet');
  expect(cardTone('Ders Programı')).toBe('blue');
  expect(cardTone('Yoklama')).toBe('cyan');
  expect(cardTone('Net Akış', 'rose')).toBe('rose');
});

test('content heading and module scope give quiet cards a useful tone', () => {
  expect(cardHeading(<CardHeader><CardTitle>Randevular</CardTitle></CardHeader>)).toBe('Randevular');
  expect(cardHeading(<table><tbody><tr><td>Tahsilat</td></tr></tbody></table>)).toBeNull();
  expect(cardToneForPath('/teacher/assignments')).toBe('violet');
  expect(cardToneForPath('/finance/late-payments')).toBe('rose');
});
