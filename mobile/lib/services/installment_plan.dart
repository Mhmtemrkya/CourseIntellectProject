/// Taksit planı: ilk taksit ayrı, kalan tutar kalan taksitlere eşit bölünür;
/// vadeler başlangıç tarihinden itibaren aylık ilerler. Kuruş farkı son taksite eklenir.
/// Taksit sayısı 1 ya da toplam boşsa tek taksit (ilk taksit tutarı) döner.
List<({double amount, DateTime due})> buildInstallmentPlan({
  required double total,
  required int count,
  required double first,
  required DateTime start,
}) {
  DateTime monthAfter(int months) {
    final target = DateTime(start.year, start.month + months, 1);
    final lastDay = DateTime(target.year, target.month + 1, 0).day;
    return DateTime(target.year, target.month, start.day > lastDay ? lastDay : start.day);
  }

  if (count <= 1 || total <= 0) {
    return [(amount: first > 0 ? first : total, due: start)];
  }

  final rest = total - first;
  final remainingCount = count - 1;
  final each = (rest / remainingCount * 100).floor() / 100;
  final lastFix = ((rest - each * remainingCount) * 100).round() / 100;
  return [
    (amount: first, due: start),
    for (var index = 1; index <= remainingCount; index++)
      (
        amount: index == remainingCount ? each + lastFix : each,
        due: monthAfter(index),
      ),
  ];
}
