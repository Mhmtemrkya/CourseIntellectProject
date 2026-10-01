import 'package:flutter_test/flutter_test.dart';
import 'package:student/utils/input_formatters.dart';

void main() {
  group('e-posta', () {
    test('boş opsiyonel, geçersiz red, geçerli kabul', () {
      expect(AppInputFormatters.validateEmail(''), isNull);
      expect(AppInputFormatters.validateEmail('veli@kurum.com'), isNull);
      expect(AppInputFormatters.validateEmail('veli@'), isNotNull);
      expect(AppInputFormatters.validateEmail('veli', required: true), isNotNull);
    });
  });

  group('doğum tarihi', () {
    test('biçim ve mantık', () {
      expect(AppInputFormatters.validateBirthDate(''), isNull);
      expect(AppInputFormatters.validateBirthDate('10.05.2010'), isNull);
      expect(AppInputFormatters.validateBirthDate('2010-05-10'), isNotNull);
      expect(AppInputFormatters.validateBirthDate('32.01.2010'), isNotNull);
      expect(AppInputFormatters.validateBirthDate('10.05.2999'), isNotNull);
    });
  });
}
