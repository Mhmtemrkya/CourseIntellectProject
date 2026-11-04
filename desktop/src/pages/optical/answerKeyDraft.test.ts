import {
  emptyKey, missingAnswers, pasteAnswers, pasteTopics, refitDrafts, toDrafts, toPayloadKeys,
} from './answerKeyDraft';

const blocks = [{ name: 'Türkçe', start: 41, count: 3 }, { name: 'Matematik', start: 44, count: 4 }];

describe('toDrafts', () => {
  it('kayıtlı cevap ve konuları soru sırasıyla satırlara açar', () => {
    const [draft] = toDrafts([{ booklet: 'A', subjects: [
      { subject: 'Türkçe', answers: 'ACB', topics: ['Paragraf', '', 'Sözcükte Anlam'] },
      { subject: 'Matematik', answers: 'DX*E', topics: [] },
    ] }], blocks);
    expect(draft?.subjects['Türkçe']).toEqual({ answers: ['A', 'C', 'B'], topics: ['Paragraf', '', 'Sözcükte Anlam'] });
    expect(draft?.subjects['Matematik']?.answers).toEqual(['D', 'X', 'X', 'E']);
    expect(draft?.subjects['Matematik']?.topics).toEqual(['', '', '', '']);
  });

  it('anahtar yoksa boş bir A kitapçığı açar', () => {
    const drafts = toDrafts([], blocks);
    expect(drafts.map((item) => item.booklet)).toEqual(['A']);
    expect(drafts[0]?.subjects['Matematik']?.answers).toHaveLength(4);
  });
});

describe('toPayloadKeys', () => {
  it('cevapları tek dizi, konuları soru sırasıyla liste yapar; hiç konu yoksa boş liste', () => {
    const drafts = toDrafts([{ booklet: 'B', subjects: [
      { subject: 'Türkçe', answers: 'ACB', topics: [] },
      { subject: 'Matematik', answers: 'DXCE', topics: [] },
    ] }], blocks);
    const tr = drafts[0]?.subjects['Türkçe'];
    if (tr) tr.topics[1] = '  Cümlede Anlam ';
    expect(toPayloadKeys(drafts, blocks)).toEqual([{ booklet: 'B', subjects: [
      { subject: 'Türkçe', answers: 'ACB', topics: ['', 'Cümlede Anlam', ''] },
      { subject: 'Matematik', answers: 'DXCE', topics: [] },
    ] }]);
  });

  it('kaydedip yeniden açınca aynı tablo gelir', () => {
    const saved = [{ booklet: 'A', subjects: [
      { subject: 'Türkçe', answers: 'EEA', topics: ['Kesirler', 'Denklemler', 'Geometri'] },
      { subject: 'Matematik', answers: 'ABCD', topics: [] },
    ] }];
    expect(toPayloadKeys(toDrafts(saved, blocks), blocks)).toEqual(saved);
  });
});

describe('missingAnswers', () => {
  it('cevapsız soruları kitapçık ve ders adıyla bildirir', () => {
    const drafts = [emptyKey('A', blocks)];
    const tr = drafts[0]?.subjects['Türkçe'];
    if (tr) tr.answers = ['A', '', 'B'];
    const problems = missingAnswers(drafts, blocks);
    expect(problems[0]).toBe('A kitapçığı / Türkçe: 1 soru cevapsız (2)');
    expect(problems[1]).toContain('Matematik: 4 soru cevapsız');
  });
});

describe('refitDrafts', () => {
  it('şablon değişince aynı adlı dersin girilenlerini korur, soru sayısına uydurur', () => {
    const drafts = toDrafts([{ booklet: 'A', subjects: [{ subject: 'Matematik', answers: 'ABCD', topics: ['K1', 'K2', 'K3', 'K4'] }] }], blocks);
    const [next] = refitDrafts(drafts, [{ name: 'Matematik', start: 1, count: 2 }, { name: 'Fen', start: 3, count: 2 }]);
    expect(next?.subjects['Matematik']).toEqual({ answers: ['A', 'B'], topics: ['K1', 'K2'] });
    expect(next?.subjects['Fen']).toEqual({ answers: ['', ''], topics: ['', ''] });
  });
});

describe('pasteAnswers', () => {
  const empty = ['', '', '', ''];

  it('düz, boşluklu ve numaralı biçimleri sırayla yerleştirir', () => {
    expect(pasteAnswers(empty, 'abcx').values).toEqual(['A', 'B', 'C', 'X']);
    expect(pasteAnswers(empty, 'A, B, C, D').values).toEqual(['A', 'B', 'C', 'D']);
    expect(pasteAnswers(empty, '1-A 2-C\n3.B 4) E').values).toEqual(['A', 'C', 'B', 'E']);
  });

  it('eksikte hangi sorulara yerleştiğini ve uyuşmazlığı söyler', () => {
    const result = pasteAnswers(['', '', '', 'E'], 'AB');
    expect(result.values).toEqual(['A', 'B', '', 'E']);
    expect(result.range).toEqual([1, 2]);
    expect(result.warning).toContain('3–4. sorular değişmedi');
  });

  it('fazlasını almaz ve uyarır', () => {
    const result = pasteAnswers(empty, 'ABCDEA');
    expect(result.values).toEqual(['A', 'B', 'C', 'D']);
    expect(result.warning).toContain('fazla 2 tanesi alınmadı');
  });

  it('geçersiz karakterde hiçbir şeyi değiştirmez', () => {
    const result = pasteAnswers(empty, 'ABFZ');
    expect(result.values).toEqual(empty);
    expect(result.range).toBeNull();
    expect(result.warning).toContain('F Z');
  });
});

describe('pasteTopics', () => {
  it('her satırı bir soruya koyar, boş satır konuyu boş bırakır', () => {
    const result = pasteTopics(['', '', ''], 'Kesirler\r\n\nGeometri\n');
    expect(result.values).toEqual(['Kesirler', '', 'Geometri']);
    expect(result.warning).toBeNull();
  });
});
