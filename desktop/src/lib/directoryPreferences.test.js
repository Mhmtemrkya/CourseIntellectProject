import {
  DEFAULT_DENSITY,
  normalizePreferences,
  readPreferences,
  toggleHiddenColumn,
  visibleColumns,
  writePreferences,
} from './directoryPreferences';

const columns = [
  { key: 'fullName' },
  { key: 'className' },
  { key: 'phone' },
];

describe('normalizePreferences', () => {
  it('bozuk kaydı güvenli varsayılana indirger', () => {
    expect(normalizePreferences(null)).toEqual({
      density: DEFAULT_DENSITY,
      hiddenColumns: [],
      pageSize: null,
    });
    expect(normalizePreferences({ density: 'ultra', hiddenColumns: 'hepsi', pageSize: -3 }))
      .toEqual({ density: DEFAULT_DENSITY, hiddenColumns: [], pageSize: null });
  });

  it('geçerli tercihleri korur ve sütun listesini tekilleştirir', () => {
    expect(normalizePreferences({ density: 'compact', hiddenColumns: ['phone', 'phone'], pageSize: 25 }))
      .toEqual({ density: 'compact', hiddenColumns: ['phone'], pageSize: 25 });
  });
});

describe('visibleColumns', () => {
  it('gizlenen sütunu düşürür', () => {
    expect(visibleColumns(columns, ['phone']).map((column) => column.key))
      .toEqual(['fullName', 'className']);
  });

  it('kimlik sütunu gizlenmiş görünse bile onu korur', () => {
    // Eski bir kayıt ilk sütunu gizlemiş olabilir; tablo kullanılamaz olmamalı.
    expect(visibleColumns(columns, ['fullName']).map((column) => column.key))
      .toEqual(['fullName', 'className', 'phone']);
  });
});

describe('toggleHiddenColumn', () => {
  it('gizler ve tekrar gösterir', () => {
    const hidden = toggleHiddenColumn(columns, [], 'phone');
    expect(hidden).toEqual(['phone']);
    expect(toggleHiddenColumn(columns, hidden, 'phone')).toEqual([]);
  });

  it('ilk sütunu gizlemeyi reddeder', () => {
    expect(toggleHiddenColumn(columns, [], 'fullName')).toEqual([]);
  });
});

describe('read/writePreferences', () => {
  beforeEach(() => localStorage.clear());

  it('tabloya özel saklar; başka tablo etkilenmez', () => {
    writePreferences('students-page', { density: 'compact', hiddenColumns: ['phone'] });
    expect(readPreferences('students-page')).toEqual({
      density: 'compact',
      hiddenColumns: ['phone'],
      pageSize: null,
    });
    expect(readPreferences('teachers-page').density).toBe(DEFAULT_DENSITY);
  });

  it('bozuk JSON kaydında varsayılana düşer', () => {
    localStorage.setItem('ci-directory:students-page', '{bozuk');
    expect(readPreferences('students-page').density).toBe(DEFAULT_DENSITY);
  });
});
