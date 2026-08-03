import 'package:flutter_test/flutter_test.dart';
import 'package:student/utils/format.dart';
import 'package:student/widgets/status_badge.dart';

void main() {
  group('para biçimi', () {
    test('tam sayıda kuruş yazmaz, küsuratlıda iki hane gösterir', () {
      expect(formatMoney(12500), '12.500 TL');
      expect(formatMoney(12500.5), '12.500,50 TL');
    });

    test('metin girdiyi Türkçe yazımla çözer', () {
      expect(formatMoney('12.500,75'), '12.500,75 TL');
      expect(formatMoney('₺ 3.000'), '3.000 TL');
      expect(formatMoney('1,234.56'), '1.234,56 TL');
    });

    test('geçersiz değeri sıfır sayar', () {
      expect(formatMoney(null), '0 TL');
      expect(formatMoney('abc'), '0 TL');
    });

    test('işaretli biçim gelir/gideri ayırır', () {
      expect(formatMoneySigned(500), '+500 TL');
      expect(formatMoneySigned(-500), '−500 TL');
    });
  });

  group('tarih biçimi', () {
    test('gün ve ayı iki haneli yazar', () {
      expect(formatDate('2026-08-02T09:00:00'), '02.08.2026');
      expect(formatDate(DateTime(2026, 8, 2)), '02.08.2026');
    });

    test('boşluklu ISO değerini çözer', () {
      expect(formatDate('2026-08-02 09:00:00'), '02.08.2026');
    });

    test('çözülemeyen değerde yer tutucu döner', () {
      expect(formatDate(null), '—');
      expect(formatDate('bir tarih değil'), '—');
    });

    test('uzun ve kısa biçimler', () {
      expect(formatDateLong(DateTime(2026, 8, 2)), '2 Ağustos 2026');
      expect(formatMonthYear(DateTime(2026, 8, 2)), 'Ağustos 2026');
      expect(formatDayShort(DateTime(2026, 8, 2)), '02.08 Paz');
      expect(formatDateTime(DateTime(2026, 8, 2, 14, 35)), '02.08.2026 14:35');
    });
  });

  group('durum sözlüğü', () {
    test('aynı anlamı taşıyan yazımları tek etikete bağlar', () {
      expect(resolveStatus('Ödendi').label, 'Ödendi');
      expect(resolveStatus('paid').label, 'Ödendi');
      expect(resolveStatus('PAID').tone, StatusTone.success);
    });

    test('normalize anahtar Türkçe karakterleri eler', () {
      expect(normalizeStatusKey('Kısmi Ödeme'), 'kismiodeme');
      expect(normalizeStatusKey('İptal'), 'iptal');
    });

    test('bilinmeyen durumda metni korur', () {
      final custom = resolveStatus('Kendi Durumum');
      expect(custom.label, 'Kendi Durumum');
      expect(custom.tone, StatusTone.neutral);
    });

    test('masaüstüyle aynı etiketler', () {
      expect(resolveStatus('overdue').label, 'Gecikti');
      expect(resolveStatus('cancelled').label, 'İptal');
      expect(resolveStatus('Active').label, 'Aktif');
    });
  });
}
