import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class StudentFinanceApiException implements Exception {
  final String message;
  const StudentFinanceApiException(this.message);
  @override
  String toString() => message;
}

/// Normalize finans modeli (öğrenci cari, taksit, tahsilat) + Faz 2-4 araçları.
class StudentFinanceApiService {
  StudentFinanceApiService._();
  static final StudentFinanceApiService instance = StudentFinanceApiService._();

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const StudentFinanceApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }

  Map<String, String> _headers(AuthSession session, {bool json = false}) => {
        'Authorization': 'Bearer ${session.accessToken}',
        if (json) 'Content-Type': 'application/json',
      };

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path')
        .replace(queryParameters: query);
    final response = await http.get(uri, headers: _headers(session));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException('İstek başarısız (${response.statusCode}).');
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body,
      [Map<String, String>? query]) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}$path')
        .replace(queryParameters: query);
    final response = await http.post(
      uri,
      headers: _headers(session, json: true),
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException('İşlem başarısız (${response.statusCode}).');
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getAccount({
    String? studentName,
    String? studentUserId,
  }) async {
    final result = await _get('/api/student-finance/account', {
      if (studentName != null && studentName.isNotEmpty) 'studentName': studentName,
      if (studentUserId != null && studentUserId.isNotEmpty)
        'studentUserId': studentUserId,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  // Veli: kendi çocuklarının finans hesapları + ödeme.
  Future<List<Map<String, dynamic>>> getParentChildrenFinance() async {
    final result = await _get('/api/parent/finance/children');
    return (result as List<dynamic>? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> parentPay({
    required String studentName,
    required double amount,
    String method = 'Online',
  }) async {
    final result = await _post('/api/parent/finance/pay', {
      'studentName': studentName,
      'amount': amount,
      'method': method,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> getDashboard({String? className}) async {
    final result = await _get('/api/student-finance/dashboard', {
      if (className != null && className.isNotEmpty) 'className': className,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<List<Map<String, dynamic>>> getSummaries({String? className}) async {
    final result = await _get('/api/student-finance/summaries', {
      if (className != null && className.isNotEmpty) 'className': className,
    });
    return (result as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> recordPayment({
    required String studentName,
    required double amount,
    String method = 'Nakit',
    String? enrollmentContractId,
    String? financeInstallmentId,
    String? note,
  }) async {
    final result = await _post('/api/student-finance/payments', {
      'studentName': studentName,
      'amount': amount,
      'method': method,
      'enrollmentContractId': ?enrollmentContractId,
      'financeInstallmentId': ?financeInstallmentId,
      'note': ?note,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> refund({
    required String studentName,
    required double amount,
    String? enrollmentContractId,
    String? reason,
  }) async {
    final result = await _post('/api/student-finance/refunds', {
      'studentName': studentName,
      'amount': amount,
      'enrollmentContractId': ?enrollmentContractId,
      'reason': ?reason,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> sendReminders({int upcomingWindowDays = 7}) async {
    final result = await _post(
      '/api/student-finance/reminders',
      const {},
      {'upcomingWindowDays': '$upcomingWindowDays'},
    );
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> reconcile({
    required List<Map<String, dynamic>> rows,
    int dateToleranceDays = 3,
  }) async {
    final result = await _post('/api/student-finance/reconciliation', {
      'rows': rows,
      'dateToleranceDays': dateToleranceDays,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> calculatePayroll(double grossSalary) async {
    final result = await _post('/api/student-finance/payroll/calculate', {
      'grossSalary': grossSalary,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> issueEInvoice({
    required String studentName,
    required double amount,
    required double vatRate,
    String? description,
  }) async {
    final result = await _post('/api/student-finance/e-invoice/issue', {
      'studentName': studentName,
      'amount': amount,
      'vatRate': vatRate,
      'description': ?description,
    });
    return Map<String, dynamic>.from(result as Map);
  }
}
