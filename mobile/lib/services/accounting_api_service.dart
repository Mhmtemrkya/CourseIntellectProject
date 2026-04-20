import 'dart:convert';

import 'package:http/http.dart' as http;

import 'accounting_finance_store.dart';
import 'api_config.dart';
import 'auth_session_store.dart';

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

class AccountingApiService {
  AccountingApiService._();

  static final AccountingApiService instance = AccountingApiService._();

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
    required String category,
    required String amount,
    required String date,
    required String reason,
  }) async {
    final response = await _authorizedJson('POST', '/api/accounting/invoices', {
      'title': title,
      'category': category,
      'amount': amount,
      'date': date,
      'reason': reason,
    });
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
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
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
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
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
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
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
