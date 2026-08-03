import 'dart:convert';

import 'package:http/http.dart' as http;

import 'accounting_finance_store.dart';
import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class AccountingApiException implements Exception {
  final String message;

  const AccountingApiException(this.message);

  @override
  String toString() => message;
}

class AccountingDashboardPayload {
  final List<InvoiceRecord> invoices;
  final List<SalaryRecord> salaries;
  final List<ApprovalRecord> approvals;
  final List<CollectionRecord> collections;
  final List<InstallmentRecord> installments;
  final List<AccountingBenefitRecord> benefits;
  final List<FinanceNotificationRecord> notifications;
  final List<AuditLogRecord> auditLogs;

  const AccountingDashboardPayload({
    required this.invoices,
    required this.salaries,
    required this.approvals,
    required this.collections,
    required this.installments,
    required this.benefits,
    required this.notifications,
    required this.auditLogs,
  });
}

/// Gider defteri satırı (ortak /api/finance/expenses).
class ExpenseLedgerRecord {
  final String id;
  final String title;
  final String category;
  final int amount;
  final DateTime? expenseDate;

  const ExpenseLedgerRecord({
    required this.id,
    required this.title,
    required this.category,
    required this.amount,
    required this.expenseDate,
  });

  factory ExpenseLedgerRecord.fromMap(Map<String, dynamic> map) {
    final raw = map['expenseDateUtc'] as String?;
    return ExpenseLedgerRecord(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? '',
      category: map['category'] as String? ?? '',
      amount: ((map['amount'] as num?) ?? 0).round(),
      expenseDate: raw == null ? null : DateTime.tryParse(raw)?.toLocal(),
    );
  }
}

class AccountingApiService {
  AccountingApiService._();

  static final AccountingApiService instance = AccountingApiService._();

  /// Gider defteri (Finans > Giderler) — kurumdan bağımsız ortak uç.
  /// Muhasebe panosundaki "Gider" toplamı bordro ve fatura yanında bunu da sayar;
  /// aksi hâlde muhasebecinin girdiği kira/elektrik faturası panoda görünmez.
  /// Uç düz dizi DEĞİL `{ items, summary, ... }` döner.
  Future<List<ExpenseLedgerRecord>> fetchExpenseLedger() async {
    final response = await _authorizedGet('/api/finance/expenses');
    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return (map['items'] as List<dynamic>? ?? const [])
        .map(
          (item) => ExpenseLedgerRecord.fromMap(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<AccountingDashboardPayload> fetchDashboard() async {
    final response = await _authorizedGet('/api/accounting/dashboard');
    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return AccountingDashboardPayload(
      invoices: (map['invoices'] as List<dynamic>)
          .map(
            (item) =>
                InvoiceRecord.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      salaries: (map['salaries'] as List<dynamic>)
          .map(
            (item) =>
                SalaryRecord.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      approvals: (map['approvals'] as List<dynamic>)
          .map(
            (item) =>
                ApprovalRecord.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      collections: (map['collections'] as List<dynamic>)
          .map(
            (item) => CollectionRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      installments: (map['installments'] as List<dynamic>)
          .map(
            (item) => InstallmentRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      benefits: (map['benefits'] as List<dynamic>? ?? const [])
          .map(
            (item) => AccountingBenefitRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      notifications: (map['notifications'] as List<dynamic>)
          .map(
            (item) => FinanceNotificationRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      auditLogs: (map['auditLogs'] as List<dynamic>)
          .map(
            (item) =>
                AuditLogRecord.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
    );
  }

  Future<InvoiceRecord> createInvoice({
    required String title,
    required String counterparty,
    required String category,
    required String amount,
    required String date,
    required String dueDate,
    required String reason,
    required bool isPaid,
    required String paymentMethod,
    String invoiceNumber = '',
  }) async {
    final response = await _authorizedJson('POST', '/api/accounting/invoices', {
      'title': title,
      'counterparty': counterparty,
      'invoiceNumber': invoiceNumber.trim().isEmpty
          ? null
          : invoiceNumber.trim(),
      'category': category,
      'amount': amount,
      'date': date,
      'dueDateUtc': dueDate.isEmpty
          ? null
          : DateTime.parse('${dueDate}T12:00:00').toUtc().toIso8601String(),
      'reason': reason,
      'isPaid': isPaid,
      'paymentMethod': isPaid ? paymentMethod : null,
    });
    return InvoiceRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<InvoiceRecord> markInvoicePaid({
    required String invoiceId,
    required String paymentMethod,
    required String paidDate,
    String note = '',
  }) async {
    final response = await _authorizedJson(
      'PUT',
      '/api/accounting/invoices/$invoiceId/mark-paid',
      {
        'paymentMethod': paymentMethod,
        'paidAtUtc': DateTime.parse(
          '${paidDate}T12:00:00',
        ).toUtc().toIso8601String(),
        'note': note.trim().isEmpty ? null : note.trim(),
      },
    );
    return InvoiceRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<SalaryRecord> createSalary({
    required String employee,
    required String role,
    required String amount,
    required String payDate,
    required String reason,
  }) async {
    final response = await _authorizedJson('POST', '/api/accounting/salaries', {
      'employee': employee,
      'role': role,
      'amount': amount,
      'payDate': payDate,
      'reason': reason,
    });
    return SalaryRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<Map<String, dynamic>> calculatePayroll({
    required double grossSalary,
    String? employee,
    int? year,
  }) async {
    final response = await _authorizedJson(
      'POST',
      '/api/student-finance/payroll/calculate',
      {'grossSalary': grossSalary, 'employee': employee, 'year': year},
    );
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<SalaryRecord> updateSalary({
    required String salaryId,
    required String employee,
    required String role,
    required String amount,
    required String payDate,
    required String status,
  }) async {
    final response =
        await _authorizedJson('PUT', '/api/accounting/salaries/$salaryId', {
          'employee': employee,
          'role': role,
          'amount': amount,
          'payDate': payDate,
          'status': status,
        });
    return SalaryRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deleteSalary(String salaryId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AccountingApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/accounting/salaries/$salaryId'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AccountingApiException(
        'Bordro silinemedi (${response.statusCode}).',
      );
    }
  }

  Future<CollectionRecord> createCollection({
    required String name,
    required String className,
    required String amount,
    required String method,
    required String note,
  }) async {
    final response = await _authorizedJson(
      'POST',
      '/api/accounting/collections',
      {
        'name': name,
        'className': className,
        'amount': amount,
        'method': method,
        'note': note,
      },
    );
    return CollectionRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<CollectionRecord> updateCollection({
    required String collectionId,
    required String name,
    required String className,
    required String amount,
    required String method,
    required String note,
  }) async {
    final response = await _authorizedJson(
      'PUT',
      '/api/accounting/collections/$collectionId',
      {
        'name': name,
        'className': className,
        'amount': amount,
        'method': method,
        'note': note,
      },
    );
    return CollectionRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deleteCollection(String collectionId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AccountingApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    final response = await http.delete(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/accounting/collections/$collectionId',
      ),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AccountingApiException(
        'Tahsilat silinemedi (${response.statusCode}).',
      );
    }
  }

  Future<InstallmentRecord> createInstallment({
    required String student,
    required String amount,
    required String due,
    required String note,
  }) async {
    final response = await _authorizedJson(
      'POST',
      '/api/accounting/installments',
      {'student': student, 'amount': amount, 'due': due, 'note': note},
    );
    return InstallmentRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<ApprovalRecord> updateApprovalStatus({
    required String approvalId,
    required String status,
  }) async {
    final response = await _authorizedJson(
      'PUT',
      '/api/accounting/approvals/$approvalId/status',
      {'status': status},
    );
    return ApprovalRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<InstallmentRecord> updateInstallment({
    required String installmentId,
    required String amount,
    required String due,
    required String status,
    required String note,
  }) async {
    final response = await _authorizedJson(
      'PUT',
      '/api/accounting/installments/$installmentId',
      {'amount': amount, 'due': due, 'status': status, 'note': note},
    );
    return InstallmentRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<FinanceNotificationRecord> createNotification({
    required String title,
    required String message,
  }) async {
    final response = await _authorizedJson(
      'POST',
      '/api/accounting/notifications',
      {'title': title, 'message': message},
    );
    return FinanceNotificationRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<AccountingBenefitRecord> createBenefit({
    required String studentName,
    required String studentUsername,
    required String className,
    required String benefitType,
    required String title,
    required String rate,
    required String totalAmount,
    required String note,
  }) async {
    final response = await _authorizedJson('POST', '/api/accounting/benefits', {
      'studentName': studentName,
      'studentUsername': studentUsername,
      'className': className,
      'benefitType': benefitType,
      'title': title,
      'rate': rate,
      'totalAmount': totalAmount,
      'note': note,
    });
    return AccountingBenefitRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<Map<String, dynamic>> sendBulkReminders() async {
    final response = await _authorizedJson(
      'POST',
      '/api/accounting/bulk-reminders',
      {},
    );
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<void> markAllNotificationsRead() async {
    await _authorizedJson('PUT', '/api/accounting/notifications/read-all', {});
  }

  Future<http.Response> _authorizedGet(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AccountingApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AccountingApiException(
        'Muhasebe verileri alınamadı (${response.statusCode}).',
      );
    }
    return response;
  }

  Future<http.Response> _authorizedJson(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const AccountingApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    late http.Response response;
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session.accessToken}',
      ...ScopeHeaders.merged,
    };
    final encoded = jsonEncode(body);
    switch (method) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: encoded);
        break;
      case 'PUT':
        response = await http.put(uri, headers: headers, body: encoded);
        break;
      default:
        throw const AccountingApiException('Desteklenmeyen istek tipi.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AccountingApiException(
        'Muhasebe işlemi tamamlanamadı (${response.statusCode}).',
      );
    }
    return response;
  }
}
