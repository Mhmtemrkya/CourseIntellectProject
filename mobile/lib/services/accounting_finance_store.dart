import 'package:flutter/material.dart';

import 'accounting_api_service.dart';

String _normalizeFinanceText(Object? value) {
  final text = (value ?? '').toString().trim();
  return text.isEmpty ? '' : text;
}

String _normalizeInvoiceCategory(Object? value) {
  final text = _normalizeFinanceText(value);
  final normalized = text.toLowerCase();
  if (normalized.contains('öğrenci') ||
      normalized.contains('öğrenci') ||
      normalized.contains('kurs')) {
    return 'Öğrenci Faturaları';
  }
  if (normalized.contains('maaş') ||
      normalized.contains('maas') ||
      normalized.contains('bordro')) {
    return 'Maaş Faturaları';
  }
  if (normalized.contains('mekan') ||
      normalized.contains('kira') ||
      normalized.contains('elektrik') ||
      normalized.contains('internet')) {
    return 'Dershane Mekân Giderleri';
  }
  if (text.isEmpty) {
    return 'Diğer Gider Faturaları';
  }
  return text == 'Diğer Gider Faturaları' ? text : 'Diğer Gider Faturaları';
}

String _normalizeInvoiceStatus(Object? value) {
  final normalized = _normalizeFinanceText(value).toLowerCase();
  if (normalized.contains('paid') ||
      normalized.contains('öden') ||
      normalized.contains('oden')) {
    return 'Ödendi';
  }
  if (normalized.contains('overdue') || normalized.contains('gec')) {
    return 'Gecikmiş';
  }
  return 'Bekliyor';
}

String _normalizeSalaryStatus(Object? value) {
  final normalized = _normalizeFinanceText(value).toLowerCase();
  if (normalized.contains('paid') ||
      normalized.contains('öden') ||
      normalized.contains('oden')) {
    return 'Ödendi';
  }
  if (normalized.contains('rejected') || normalized.contains('redd')) {
    return 'Reddedildi';
  }
  if (normalized.contains('approved') ||
      normalized.contains('planlandı') ||
      normalized.contains('planlandı')) {
    return 'Planlandı';
  }
  if (normalized.contains('planned') ||
      normalized.contains('pending') ||
      normalized.contains('bekli')) {
    return 'Bekliyor';
  }
  return _normalizeFinanceText(value);
}

String _normalizeApprovalStatus(Object? value) {
  final normalized = _normalizeFinanceText(value).toLowerCase();
  if (normalized.contains('approved') || normalized.contains('onay')) {
    return 'Onaylandı';
  }
  if (normalized.contains('rejected') || normalized.contains('redd')) {
    return 'Reddedildi';
  }
  return 'Bekliyor';
}

String _normalizeInstallmentStatus(Object? value) {
  final normalized = _normalizeFinanceText(value).toLowerCase();
  if (normalized.contains('öden') ||
      normalized.contains('oden') ||
      normalized.contains('paid')) {
    return 'Ödendi';
  }
  if (normalized.contains('sonraki')) {
    return 'Sonraki Ay';
  }
  if (normalized.contains('gec') ||
      normalized.contains('late') ||
      normalized.contains('overdue')) {
    return 'Geciken';
  }
  return 'Bekleyen';
}

String _normalizeApprovalCategory(Object? value) {
  final text = _normalizeFinanceText(value);
  final normalized = text.toLowerCase();
  if (normalized.contains('maaş') || normalized.contains('maas')) {
    return 'Maaş';
  }
  if (normalized.contains('taksit')) {
    return 'Taksit';
  }
  if (normalized.contains('fatura')) {
    return 'Fatura';
  }
  return text;
}

class InvoiceRecord {
  final String id;
  final String title;
  final String category;
  final String subtitle;
  final String amount;
  String status;

  InvoiceRecord({
    this.id = '',
    required this.title,
    required this.category,
    required this.subtitle,
    required this.amount,
    required this.status,
  });

  factory InvoiceRecord.fromMap(Map<String, dynamic> map) {
    return InvoiceRecord(
      id: map['id'] as String? ?? '',
      title: _normalizeFinanceText(map['title']),
      category: _normalizeInvoiceCategory(map['category']),
      subtitle: _normalizeFinanceText(map['subtitle']),
      amount: _normalizeFinanceText(map['amount']),
      status: _normalizeInvoiceStatus(map['status']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'category': category,
    'subtitle': subtitle,
    'amount': amount,
    'status': status,
  };
}

class SalaryRecord {
  final String id;
  final String employee;
  final String role;
  final String amount;
  final String payDate;
  String status;

  SalaryRecord({
    this.id = '',
    required this.employee,
    required this.role,
    required this.amount,
    required this.payDate,
    required this.status,
  });

  factory SalaryRecord.fromMap(Map<String, dynamic> map) {
    return SalaryRecord(
      id: map['id'] as String? ?? '',
      employee: _normalizeFinanceText(map['employee']),
      role: _normalizeFinanceText(map['role']),
      amount: _normalizeFinanceText(map['amount']),
      payDate: _normalizeFinanceText(map['payDate']),
      status: _normalizeSalaryStatus(map['status']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'employee': employee,
    'role': role,
    'amount': amount,
    'payDate': payDate,
    'status': status,
  };
}

class ApprovalRecord {
  final String id;
  final String title;
  final String reason;
  final String category;
  String status;
  final String sourceType;
  final String sourceKey;

  ApprovalRecord({
    this.id = '',
    required this.title,
    required this.reason,
    required this.category,
    required this.status,
    required this.sourceType,
    required this.sourceKey,
  });

  factory ApprovalRecord.fromMap(Map<String, dynamic> map) {
    return ApprovalRecord(
      id: map['id'] as String? ?? '',
      title: _normalizeFinanceText(map['title']),
      reason: _normalizeFinanceText(map['reason']),
      category: _normalizeApprovalCategory(map['category']),
      status: _normalizeApprovalStatus(map['status']),
      sourceType: _normalizeFinanceText(map['sourceType']),
      sourceKey: _normalizeFinanceText(map['sourceKey']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'reason': reason,
    'category': category,
    'status': status,
    'sourceType': sourceType,
    'sourceKey': sourceKey,
  };
}

class CollectionRecord {
  final String id;
  final String name;
  final String className;
  final String amount;
  final String method;
  final String time;
  final String note;

  CollectionRecord({
    this.id = '',
    required this.name,
    required this.className,
    required this.amount,
    required this.method,
    required this.time,
    required this.note,
  });

  factory CollectionRecord.fromMap(Map<String, dynamic> map) {
    return CollectionRecord(
      id: map['id'] as String? ?? '',
      name: _normalizeFinanceText(map['name']),
      className: _normalizeFinanceText(map['className']),
      amount: _normalizeFinanceText(map['amount']),
      method: _normalizeFinanceText(map['method']),
      time: _normalizeFinanceText(map['time']),
      note: _normalizeFinanceText(map['note']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'className': className,
    'amount': amount,
    'method': method,
    'time': time,
    'note': note,
  };
}

class InstallmentRecord {
  final String id;
  final String student;
  String status;
  final String amount;
  final String due;
  final String note;

  InstallmentRecord({
    this.id = '',
    required this.student,
    required this.status,
    required this.amount,
    required this.due,
    required this.note,
  });

  factory InstallmentRecord.fromMap(Map<String, dynamic> map) {
    return InstallmentRecord(
      id: map['id'] as String? ?? '',
      student: _normalizeFinanceText(map['student']),
      status: _normalizeInstallmentStatus(map['status']),
      amount: _normalizeFinanceText(map['amount']),
      due: _normalizeFinanceText(map['due']),
      note: _normalizeFinanceText(map['note']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'student': student,
    'status': status,
    'amount': amount,
    'due': due,
    'note': note,
  };
}

class FinanceNotificationRecord {
  final String id;
  final String title;
  final String message;
  final String time;
  bool unread;

  FinanceNotificationRecord({
    this.id = '',
    required this.title,
    required this.message,
    required this.time,
    required this.unread,
  });

  factory FinanceNotificationRecord.fromMap(Map<String, dynamic> map) {
    return FinanceNotificationRecord(
      id: map['id'] as String? ?? '',
      title: _normalizeFinanceText(map['title']),
      message: _normalizeFinanceText(map['message']),
      time: _normalizeFinanceText(map['time']),
      unread: map['unread'] as bool,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'message': message,
    'time': time,
    'unread': unread,
  };
}

class AuditLogRecord {
  final String id;
  final String title;
  final String detail;
  final String time;

  AuditLogRecord({
    this.id = '',
    required this.title,
    required this.detail,
    required this.time,
  });

  factory AuditLogRecord.fromMap(Map<String, dynamic> map) {
    return AuditLogRecord(
      id: map['id'] as String? ?? '',
      title: _normalizeFinanceText(map['title']),
      detail: _normalizeFinanceText(map['detail']),
      time: _normalizeFinanceText(map['time']),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'detail': detail,
    'time': time,
  };
}

class AccountingBenefitRecord {
  final String id;
  final String studentName;
  final String studentUsername;
  final String className;
  final String benefitType;
  final String title;
  final String rate;
  final String totalAmount;
  final String netAmount;
  final String status;
  final String note;
  final String createdAtLabel;

  const AccountingBenefitRecord({
    this.id = '',
    required this.studentName,
    required this.studentUsername,
    required this.className,
    required this.benefitType,
    required this.title,
    required this.rate,
    required this.totalAmount,
    required this.netAmount,
    required this.status,
    required this.note,
    required this.createdAtLabel,
  });

  factory AccountingBenefitRecord.fromMap(Map<String, dynamic> map) {
    return AccountingBenefitRecord(
      id: map['id'] as String? ?? '',
      studentName: _normalizeFinanceText(map['studentName']),
      studentUsername: _normalizeFinanceText(map['studentUsername']),
      className: _normalizeFinanceText(map['className']),
      benefitType: _normalizeFinanceText(map['benefitType']),
      title: _normalizeFinanceText(map['title']),
      rate: _normalizeFinanceText(map['rate']),
      totalAmount: _normalizeFinanceText(map['totalAmount']),
      netAmount: _normalizeFinanceText(map['netAmount']),
      status: _normalizeFinanceText(map['status']),
      note: _normalizeFinanceText(map['note']),
      createdAtLabel: _normalizeFinanceText(map['createdAtLabel']),
    );
  }
}

class AccountingFinanceStore extends ChangeNotifier {
  AccountingFinanceStore._() {
    loadDashboard();
  }

  static final AccountingFinanceStore instance = AccountingFinanceStore._();

  bool isLoaded = false;
  String? lastError;

  List<InvoiceRecord> invoices = [];
  List<SalaryRecord> salaries = [];
  List<ApprovalRecord> approvals = [];
  List<CollectionRecord> collections = [];
  List<InstallmentRecord> installments = [];
  List<AccountingBenefitRecord> benefits = [];
  List<FinanceNotificationRecord> notifications = [];
  List<AuditLogRecord> auditLogs = [];

  Future<void> loadDashboard() async {
    try {
      final payload = await AccountingApiService.instance.fetchDashboard();
      invoices = payload.invoices;
      salaries = payload.salaries;
      approvals = payload.approvals;
      collections = payload.collections;
      installments = payload.installments;
      benefits = payload.benefits;
      notifications = payload.notifications;
      auditLogs = payload.auditLogs;
      lastError = null;
      isLoaded = true;
    } catch (error) {
      lastError = error.toString();
      isLoaded = true;
    }
    notifyListeners();
  }

  List<InvoiceRecord> invoicesFor(String category) =>
      invoices.where((invoice) => invoice.category == category).toList();

  String approvalStatusFor(String sourceType, String sourceKey) {
    final sourceTypeNormalized = sourceType.trim().toLowerCase();
    final sourceKeyNormalized = sourceKey.trim();
    final approval = approvals.where((item) {
      return item.sourceType.trim().toLowerCase() == sourceTypeNormalized &&
          item.sourceKey.trim() == sourceKeyNormalized;
    }).firstOrNull;
    return approval?.status ?? '';
  }

  int countForCategory(String category) => invoicesFor(category).length;

  int get totalReceivables =>
      installments.fold<int>(0, (sum, item) => sum + parseAmount(item.amount));
  int get collectedTotal =>
      collections.fold<int>(0, (sum, item) => sum + parseAmount(item.amount));
  int get pendingTotal => installments
      .where((item) => item.status == 'Bekleyen' || item.status == 'Sonraki Ay')
      .fold<int>(0, (sum, item) => sum + parseAmount(item.amount));
  int get overdueTotal => installments
      .where((item) => item.status == 'Geciken')
      .fold<int>(0, (sum, item) => sum + parseAmount(item.amount));

  int parseAmount(String amount) {
    final normalized = amount
        .replaceAll('₺', '')
        .replaceAll('.', '')
        .replaceAll(',', '')
        .trim();
    return int.tryParse(normalized) ?? 0;
  }

  String formatAmount(int amount) {
    final text = amount.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < text.length; i++) {
      final reverseIndex = text.length - i;
      buffer.write(text[i]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write('.');
      }
    }
    return '₺${buffer.toString()}';
  }

  Future<void> addInvoice({
    required String title,
    required String category,
    required String amount,
    required String date,
    required String reason,
  }) async {
    await AccountingApiService.instance.createInvoice(
      title: title,
      category: category,
      amount: amount,
      date: date,
      reason: reason,
    );
    await loadDashboard();
  }

  Future<void> addSalary({
    required String employee,
    required String role,
    required String amount,
    required String payDate,
    required String reason,
  }) async {
    await AccountingApiService.instance.createSalary(
      employee: employee,
      role: role,
      amount: amount,
      payDate: payDate,
      reason: reason,
    );
    await loadDashboard();
  }

  Future<void> updateSalary({
    required String id,
    required String employee,
    required String role,
    required String amount,
    required String payDate,
    required String status,
  }) async {
    await AccountingApiService.instance.updateSalary(
      salaryId: id,
      employee: employee,
      role: role,
      amount: amount,
      payDate: payDate,
      status: status,
    );
    await loadDashboard();
  }

  Future<void> deleteSalary(String id) async {
    await AccountingApiService.instance.deleteSalary(id);
    await loadDashboard();
  }

  Future<void> addCollection({
    required String name,
    required String className,
    required String amount,
    required String method,
    required String note,
  }) async {
    await AccountingApiService.instance.createCollection(
      name: name,
      className: className,
      amount: amount,
      method: method,
      note: note,
    );
    await loadDashboard();
  }

  Future<void> updateCollection({
    required String id,
    required String name,
    required String className,
    required String amount,
    required String method,
    required String note,
  }) async {
    await AccountingApiService.instance.updateCollection(
      collectionId: id,
      name: name,
      className: className,
      amount: amount,
      method: method,
      note: note,
    );
    await loadDashboard();
  }

  Future<void> deleteCollection(String id) async {
    await AccountingApiService.instance.deleteCollection(id);
    await loadDashboard();
  }

  Future<void> addInstallment({
    required String student,
    required String amount,
    required String due,
    required String note,
  }) async {
    await AccountingApiService.instance.createInstallment(
      student: student,
      amount: amount,
      due: due,
      note: note,
    );
    await loadDashboard();
  }

  Future<void> updateApprovalStatus(
    ApprovalRecord approval,
    String status,
  ) async {
    await AccountingApiService.instance.updateApprovalStatus(
      approvalId: approval.id,
      status: status,
    );
    await loadDashboard();
  }

  Future<void> markAllNotificationsRead() async {
    await AccountingApiService.instance.markAllNotificationsRead();
    await loadDashboard();
  }

  Future<void> addFinanceNotification({
    required String title,
    required String message,
  }) async {
    await AccountingApiService.instance.createNotification(
      title: title,
      message: message,
    );
    await loadDashboard();
  }

  Future<void> addBenefit({
    required String studentName,
    required String studentUsername,
    required String className,
    required String benefitType,
    required String title,
    required String rate,
    required String totalAmount,
    required String note,
  }) async {
    await AccountingApiService.instance.createBenefit(
      studentName: studentName,
      studentUsername: studentUsername,
      className: className,
      benefitType: benefitType,
      title: title,
      rate: rate,
      totalAmount: totalAmount,
      note: note,
    );
    await loadDashboard();
  }

  Future<void> ensureOverdueAlerts() async {
    for (final item in installments.where(
      (record) => record.status == 'Geciken',
    )) {
      final exists = notifications.any(
        (note) => note.title.contains(item.student),
      );
      if (!exists) {
        await addFinanceNotification(
          title: '${item.student} ödemesi gecikti',
          message:
              'Sayın veli, ${item.student} için ${item.amount} tutarlı ödemenizde gecikme bulunuyor. Lütfen kurumla iletişime geçiniz.',
        );
      }
    }
  }

  Future<void> updateInstallment({
    required String id,
    required String amount,
    required String due,
    required String status,
    required String note,
  }) async {
    await AccountingApiService.instance.updateInstallment(
      installmentId: id,
      amount: amount,
      due: due,
      status: status,
      note: note,
    );
    await loadDashboard();
  }

  String exportSummary(String type) {
    switch (type) {
      case 'Excel':
        return 'Tahsilatlar: ${collections.length}\nTaksitler: ${installments.length}\nFaturalar: ${invoices.length}\nBekleyen Onaylar: ${approvals.where((item) => item.status == 'Bekliyor').length}';
      case 'PDF':
        return 'Yönetim Özeti\nToplam Tahsilat: ${formatAmount(collectedTotal)}\nGeciken Ödeme: ${formatAmount(overdueTotal)}\nMaaş Kayıtları: ${salaries.length}';
      default:
        return 'Makbuz Paketleri\nSon Tahsilat: ${collections.firstOrNull?.name ?? '-'}\nToplam Makbuz: ${collections.length}';
    }
  }
}
