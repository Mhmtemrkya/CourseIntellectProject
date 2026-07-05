import 'package:flutter_test/flutter_test.dart';
import 'package:student/i18n/app_locale.dart';

void main() {
  test('TR varsayılan: metin aynen döner', () {
    AppLocale.language.value = 'tr';
    expect('Giriş Yapın'.tr, 'Giriş Yapın');
    expect('Öğrenci'.tr, 'Öğrenci');
  });

  test('EN: sözlükteki metinler çevrilir', () {
    AppLocale.language.value = 'en';
    expect('Giriş Yapın'.tr, 'Sign In');
    expect('Öğrenci'.tr, 'Student');
    expect('Kaydet'.tr, 'Save');
    expect('Vaka Merkezi'.tr, 'Case Center');
    expect('Kütüphane'.tr, 'Library');
    expect('Randevularım'.tr, 'My Appointments');
    expect('Kabul Et ve Devam Et'.tr, 'Accept and Continue');
  });

  test('EN: sözlükte olmayan metin Türkçe kalır', () {
    AppLocale.language.value = 'en';
    expect('Zzz bilinmeyen metin qqq'.tr, 'Zzz bilinmeyen metin qqq');
  });

  test('EN: sayısal kalıp korunur', () {
    AppLocale.language.value = 'en';
    expect('5 kayıt'.tr, '5 records');
    expect('12 öğrenci'.tr, '12 students');
  });

  test('EN: ay kısaltması çevrilir', () {
    AppLocale.language.value = 'en';
    expect('Temmuz'.tr, 'July');
  });
}
