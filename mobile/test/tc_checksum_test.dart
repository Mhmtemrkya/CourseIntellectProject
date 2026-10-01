import 'package:flutter_test/flutter_test.dart';
import 'package:student/utils/input_formatters.dart';

void main() {
  test('TC checksum: geçerli kabul, geçersiz/biçimsiz red', () {
    expect(AppInputFormatters.validateTcKimlik('10000000146'), isNull);
    expect(AppInputFormatters.validateTcKimlik('12345678901'), isNotNull);
    expect(AppInputFormatters.validateTcKimlik('123'), isNotNull);
    expect(AppInputFormatters.validateTcKimlik('01000000146'), isNotNull);
    expect(AppInputFormatters.validateTcKimlik('', required: false), isNull);
  });
}
