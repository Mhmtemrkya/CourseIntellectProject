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

# ÖSYM tablosu ili yalnız adında il geçmeyen üniversitelerde parantezle yazar
# ("GAZİ ÜNİVERSİTESİ (ANKARA)"). Diğerlerinin adı ille başlar ("ADIYAMAN ÜNİVERSİTESİ").
PROVINCES = sorted((
    'ADANA ADIYAMAN AFYONKARAHİSAR AĞRI AKSARAY AMASYA ANKARA ANTALYA ARDAHAN ARTVİN AYDIN BALIKESİR BARTIN '
    'BATMAN BAYBURT BİLECİK BİNGÖL BİTLİS BOLU BURDUR BURSA ÇANAKKALE ÇANKIRI ÇORUM DENİZLİ DİYARBAKIR DÜZCE '
    'EDİRNE ELAZIĞ ERZİNCAN ERZURUM ESKİŞEHİR GAZİANTEP GİRESUN GÜMÜŞHANE HAKKARİ HATAY IĞDIR ISPARTA İSTANBUL '
    'İZMİR KAHRAMANMARAŞ KARABÜK KARAMAN KARS KASTAMONU KAYSERİ KIRIKKALE KIRKLARELİ KIRŞEHİR KİLİS KOCAELİ '
    'KONYA KÜTAHYA MALATYA MANİSA MARDİN MERSİN MUĞLA MUŞ NEVŞEHİR NİĞDE ORDU OSMANİYE RİZE SAKARYA SAMSUN '
    'SİİRT SİNOP SİVAS ŞANLIURFA ŞIRNAK TEKİRDAĞ TOKAT TRABZON TUNCELİ UŞAK VAN YALOVA YOZGAT ZONGULDAK'
).split(), key=len, reverse=True)
# Adında il geçmeyen ve parantezle de yazılmayan istisnalar.
KNOWN_CITIES = {'GEBZE TEKNİK ÜNİVERSİTESİ': 'KOCAELİ'}


def city_of(university):
    match = re.search(r'\(([^()]+)\)\s*$', university)
    if match:
        return match.group(1).strip()
    if university in KNOWN_CITIES:
        return KNOWN_CITIES[university]
    for province in PROVINCES:
        if university.startswith(province + ' '):
            return province
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
        city = city_of(university)
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
            if not row[4]:
                raise SystemExit(f'İl bulunamadı: {row[3]} — KNOWN_CITIES sözlüğüne ekleyin.')
            writer.writerow(row + [source])
            count += 1
    with gzip.open(out, 'wt', encoding='utf-8', compresslevel=9) as handle:
        handle.write(buffer.getvalue())
    print(f'{count} program yazıldı → {out} ({out.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
