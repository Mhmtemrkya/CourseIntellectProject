"""ÖSYM "En Küçük ve En Büyük Puanlar" tablolarını (TABLO-3 önlisans, TABLO-4 lisans)
tercih robotunun gömülü veri dosyasına çevirir. Yalnız Genel Kontenjan sütunları alınır.

Kullanım:
  python3 -I tools/preference-data/build_yks.py <yıl> <tablo3.xlsx> <tablo4.xlsx> <kaynak-url>

Çıktı: backend/CourseIntellect.Infrastructure/Resources/Preference/yks_<yıl>.csv.gz
Biçim (UTF-8, ';' ayraç, ilk satır başlık):
  code;level;universityType;university;city;unit;program;scoreType;quota;placed;minScore;maxScore;sourceUrl
"""
import csv
import gzip
import io
import re
import sys
from pathlib import Path

import openpyxl

def number(value):
    if value in (None, '--', ''):
        return ''
    try:
        return str(float(value)).rstrip('0').rstrip('.') if isinstance(value, float) else str(int(value))
    except (TypeError, ValueError):
        return ''

def rows(path, level):
    sheet = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    for index, row in enumerate(sheet.iter_rows(values_only=True)):
        if index < 3 or not row[0]:
            continue
        code = str(row[0]).strip()
        if not code.isdigit():
            continue
        university = str(row[2] or '').strip()
        match = re.search(r'\(([^()]+)\)\s*$', university)
        city = match.group(1).strip() if match else ''
        yield [code, level, str(row[1] or '').strip(), university, city, str(row[3] or '').strip(),
               str(row[4] or '').strip(), str(row[5] or '').strip(), number(row[6]), number(row[7]),
               number(row[8]), number(row[9])]

def main():
    year, tablo3, tablo4, source = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    out = Path(__file__).resolve().parents[2] / 'backend/CourseIntellect.Infrastructure/Resources/Preference' / f'yks_{year}.csv.gz'
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=';', lineterminator='\n')
    writer.writerow(['code', 'level', 'universityType', 'university', 'city', 'unit', 'program', 'scoreType',
                     'quota', 'placed', 'minScore', 'maxScore', 'sourceUrl'])
    count = 0
    for level, path in (('Önlisans', tablo3), ('Lisans', tablo4)):
        for row in rows(path, level):
            writer.writerow(row + [source])
            count += 1
    with gzip.open(out, 'wt', encoding='utf-8', compresslevel=9) as handle:
        handle.write(buffer.getvalue())
    print(f'{count} program yazıldı → {out} ({out.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
