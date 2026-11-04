import 'dart:convert';

import 'package:flutter/painting.dart';

// Optik şablon düzeni (masaüstü templateLayout.ts ile aynı kurallar): okuma özeti, çakışma,
// örnek dosya çözme ve satır okuma. Sunucudaki OpticalParser ile uyumlu: sayım 1'den başlar,
// boş satırlar atlanır ama satır numarası korunur.

enum OpticalFieldKind { studentNo, name, className, booklet, subject }

class OpticalLayoutField {
  const OpticalLayoutField(this.id, this.kind, this.label, this.start, this.length, this.color);
  final String id;
  final OpticalFieldKind kind;
  final String label;
  final int start;
  final int length;
  final Color color;

  bool get used => length > 0 && start >= 1;
  int get end => start + length - 1;
}

const _fieldColors = {
  OpticalFieldKind.studentNo: Color(0xFF0EA5E9),
  OpticalFieldKind.name: Color(0xFF8B5CF6),
  OpticalFieldKind.className: Color(0xFFF59E0B),
  OpticalFieldKind.booklet: Color(0xFFF43F5E),
};
const _subjectColors = [Color(0xFF10B981), Color(0xFF0D9488), Color(0xFF65A30D), Color(0xFF06B6D4), Color(0xFFD946EF), Color(0xFFF97316)];

const _readAs = {
  OpticalFieldKind.studentNo: 'öğrenci numarası',
  OpticalFieldKind.name: 'ad soyad',
  OpticalFieldKind.className: 'sınıf',
  OpticalFieldKind.booklet: 'kitapçık türü',
};

/// Şablon gövdesindeki (API ile aynı anahtarlar) alanlar ve ders blokları.
List<OpticalLayoutField> opticalLayoutFields(Map<String, dynamic> form) {
  int n(String key) => (form[key] as num?)?.toInt() ?? 0;
  final subjects = form['subjects'] is List ? (form['subjects'] as List).whereType<Map>().toList() : const <Map>[];
  return [
    OpticalLayoutField('studentNo', OpticalFieldKind.studentNo, 'Öğrenci no', n('studentNoStart'), n('studentNoLength'), _fieldColors[OpticalFieldKind.studentNo]!),
    OpticalLayoutField('name', OpticalFieldKind.name, 'Ad soyad', n('nameStart'), n('nameLength'), _fieldColors[OpticalFieldKind.name]!),
    OpticalLayoutField('class', OpticalFieldKind.className, 'Sınıf', n('classStart'), n('classLength'), _fieldColors[OpticalFieldKind.className]!),
    OpticalLayoutField('booklet', OpticalFieldKind.booklet, 'Kitapçık', n('bookletStart'), n('bookletLength'), _fieldColors[OpticalFieldKind.booklet]!),
    for (var i = 0; i < subjects.length; i++)
      OpticalLayoutField(
        'subject-$i',
        OpticalFieldKind.subject,
        '${subjects[i]['name'] ?? ''}'.isEmpty ? '${i + 1}. ders' : '${subjects[i]['name']}',
        (subjects[i]['start'] as num?)?.toInt() ?? 0,
        (subjects[i]['count'] as num?)?.toInt() ?? 0,
        _subjectColors[i % _subjectColors.length],
      ),
  ];
}

String opticalSpanText(int start, int length) => length == 1 ? '$start. karakter' : '$start–${start + length - 1}. karakterler';

/// "Her satırın 1–10. karakterleri öğrenci numarası olarak okunacak."
String opticalReadingSummary(OpticalLayoutField field) {
  if (field.length <= 0) return 'Bu alan dosyadan okunmayacak.';
  if (field.start < 1) return 'Başlangıç konumu 1 ya da daha büyük olmalı.';
  final what = field.kind == OpticalFieldKind.subject ? '${field.label} cevapları' : _readAs[field.kind]!;
  final where = field.length == 1
      ? 'Her satırın ${field.start}. karakteri $what olarak okunacak.'
      : 'Her satırın ${field.start}–${field.end}. karakterleri $what olarak okunacak.';
  return field.kind == OpticalFieldKind.subject ? '$where Her soru bir karakterdir (${field.length} soru).' : where;
}

/// Kaydetmeyi engelleyen düzen hataları: geçersiz başlangıç ve çakışan iki alan.
List<String> opticalLayoutProblems(List<OpticalLayoutField> fields) {
  final used = fields.where((field) => field.length > 0).toList();
  final problems = [
    for (final field in used.where((field) => field.start < 1))
      '${field.label}: başlangıç konumu 1 ya da daha büyük olmalı (karakter sayımı 1\'den başlar).',
  ];
  final valid = used.where((field) => field.start >= 1).toList();
  for (var i = 0; i < valid.length; i++) {
    for (var j = i + 1; j < valid.length; j++) {
      final a = valid[i];
      final b = valid[j];
      if (a.start > b.end || b.start > a.end) continue;
      final from = a.start > b.start ? a.start : b.start;
      final to = a.end < b.end ? a.end : b.end;
      problems.add('${a.label} (${opticalSpanText(a.start, a.length)}) ile ${b.label} (${opticalSpanText(b.start, b.length)}) çakışıyor: '
          '${opticalSpanText(from, to - from + 1)} iki alana birden ayrılmış.');
    }
  }
  return problems;
}

// ─── Örnek dosya ─────────────────────────────────────────────────────────────

/// Windows-1254: 0x80–0x9F aralığı ve Türkçe harfler; kalan üst yarı Latin-1 ile aynıdır.
const _cp1254High = [
  0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x8E, 0x8F,
  0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x9E, 0x0178,
];
const _cp1254Turkish = {0xD0: 0x011E, 0xDD: 0x0130, 0xDE: 0x015E, 0xF0: 0x011F, 0xFD: 0x0131, 0xFE: 0x015F};

String decodeWindows1254(List<int> bytes) => String.fromCharCodes(bytes.map((byte) {
      if (byte < 0x80) return byte;
      if (byte < 0xA0) return _cp1254High[byte - 0x80];
      return _cp1254Turkish[byte] ?? byte;
    }));

/// Sunucuyla aynı: "auto" BOM ya da geçerli UTF-8 ise UTF-8, değilse Türkçe Windows (1254).
({String text, String encoding}) decodeOpticalSample(List<int> bytes, String encoding) {
  final hasBom = bytes.length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
  String utf(bool strict) => utf8.decode(bytes, allowMalformed: !strict).replaceFirst('﻿', '');
  if (encoding == 'utf-8' || hasBom) return (text: utf(false), encoding: 'utf-8');
  if (encoding == 'auto') {
    try {
      return (text: utf(true), encoding: 'utf-8');
    } on FormatException {
      // geçerli UTF-8 değil → 1254
    }
  }
  return (text: decodeWindows1254(bytes), encoding: 'windows-1254');
}

class OpticalSampleLine {
  const OpticalSampleLine(this.line, this.text);
  final int line;
  final String text;
}

List<OpticalSampleLine> opticalSampleLines(String text, {int max = 5}) {
  final rows = text.split(RegExp(r'\r?\n'));
  final result = <OpticalSampleLine>[];
  for (var i = 0; i < rows.length && result.length < max; i++) {
    final value = rows[i].replaceAll('\r', '').replaceAll('\u001A', '');
    if (value.trim().isNotEmpty) result.add(OpticalSampleLine(i + 1, value));
  }
  return result;
}

class OpticalFieldReading {
  const OpticalFieldReading(this.field, this.value, this.blankQuestions, this.missing);
  final OpticalLayoutField field;
  final String value;

  /// İşaretlenmemiş (boşluk) soru numaraları; normaldir.
  final List<int> blankQuestions;

  /// Satır bu alana yetmiyor; dosyada karşılığı olmayan karakterler (düzen hatası olabilir).
  final String? missing;
}

List<OpticalFieldReading> readOpticalSampleLine(OpticalSampleLine sample, List<OpticalLayoutField> fields) {
  final length = sample.text.length;
  return fields.where((field) => field.used).map((field) {
    final from = field.start - 1 < length ? field.start - 1 : length;
    final to = field.end < length ? field.end : length;
    final raw = sample.text.substring(from, to);
    String? missing;
    if (length < field.start) {
      missing = '${sample.line}. satır $length karakter; ${field.label} ${opticalSpanText(field.start, field.length)} arasında bekleniyor ama satır o konuma ulaşmıyor.';
    } else if (length < field.end) {
      missing = field.kind == OpticalFieldKind.subject
          ? '${sample.line}. satır $length. karakterde bitiyor; ${field.label} alanının ${length - field.start + 2}–${field.length}. soruları dosyada yok (boş bırakılmış cevap değil, satır kısa).'
          : '${sample.line}. satır $length. karakterde bitiyor; ${field.label} alanının son ${field.end - length} karakteri dosyada yok.';
    }
    final blanks = field.kind == OpticalFieldKind.subject ? [for (var i = 0; i < raw.length; i++) if (raw[i] == ' ') i + 1] : <int>[];
    final value = switch (field.kind) {
      OpticalFieldKind.subject => raw,
      OpticalFieldKind.name => raw.split(' ').where((part) => part.isNotEmpty).join(' '),
      _ => raw.trim(),
    };
    return OpticalFieldReading(field, value, blanks, missing);
  }).toList();
}

/// Satırı alanlara göre renklendirilecek parçalara böler; çakışan karakter ilk alana yazılır.
List<(String, OpticalLayoutField?)> segmentOpticalLine(String text, List<OpticalLayoutField> fields) {
  final segments = <(String, OpticalLayoutField?)>[];
  for (var i = 0; i < text.length; i++) {
    final position = i + 1;
    final owner = fields.where((field) => field.used && position >= field.start && position <= field.end).firstOrNull;
    if (segments.isNotEmpty && segments.last.$2 == owner) {
      segments[segments.length - 1] = (segments.last.$1 + text[i], owner);
    } else {
      segments.add((text[i], owner));
    }
  }
  return segments;
}

/// Karakter cetveli: üst satır her 10. konumda sayı, alt satır birler basamağı.
({String tens, String units}) opticalRuler(int width) {
  var tens = '';
  final units = StringBuffer();
  for (var position = 1; position <= width; position++) {
    units.write(position % 10);
    if (position % 10 == 0) {
      final label = '$position';
      tens = tens.substring(0, tens.length - (label.length - 1)) + label;
    } else {
      tens += ' ';
    }
  }
  return (tens: tens, units: units.toString());
}
