import 'package:flutter_test/flutter_test.dart';
import 'package:student/services/installment_plan.dart';

void main() {
  test('ilk taksit ayrı, kalan eşit ve aylık bölünür', () {
    final plan = buildInstallmentPlan(
      total: 120000,
      count: 12,
      first: 10000,
      start: DateTime(2026, 12, 1),
    );
    expect(plan.length, 12);
    expect(plan.first.amount, 10000);
    expect(plan[1].amount, 10000);
    expect(plan.fold<double>(0, (sum, item) => sum + item.amount), closeTo(120000, 0.001));
    expect(plan[1].due, DateTime(2027, 1, 1));
    expect(plan.last.due, DateTime(2027, 11, 1));
  });

  test('kuruş farkı son taksite eklenir ve ay sonu taşmaz', () {
    final plan = buildInstallmentPlan(total: 1000, count: 4, first: 100, start: DateTime(2027, 1, 31));
    expect(plan.fold<double>(0, (sum, item) => sum + item.amount), closeTo(1000, 0.001));
    expect(plan[1].due, DateTime(2027, 2, 28));
  });

  test('tek taksit', () {
    final plan = buildInstallmentPlan(total: 0, count: 1, first: 5000, start: DateTime(2026, 12, 1));
    expect(plan.single.amount, 5000);
  });
}
