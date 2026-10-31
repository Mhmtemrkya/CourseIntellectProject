import 'dart:convert';
import 'dart:typed_data';

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
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}$path',
    ).replace(queryParameters: query);
    final response = await http.get(uri, headers: _headers(session));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException(
        _serverMessage(response) ?? 'İstek başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<dynamic> _post(
    String path,
    Map<String, dynamic> body, [
    Map<String, String>? query,
  ]) async {
    final session = await _session();
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}$path',
    ).replace(queryParameters: query);
    final response = await http.post(
      uri,
      headers: _headers(session, json: true),
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException(
        _serverMessage(response) ?? 'İşlem başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  Future<dynamic> _put(String path, Map<String, dynamic> body) async {
    final session = await _session();
    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: _headers(session, json: true),
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException(
        _serverMessage(response) ?? 'İşlem başarısız (${response.statusCode}).',
      );
    }
    return response.body.isEmpty ? null : jsonDecode(response.body);
  }

  /// Sunucunun anlaşılır hata metni (ör. "gün kapatıldı", "aynı adlı öğrenci").
  static String? _serverMessage(http.Response response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body['message'] is String) {
        final message = (body['message'] as String).trim();
        return message.isEmpty ? null : message;
      }
    } catch (_) {}
    return null;
  }

  /// Gün sonu: yerel günü öğle saatiyle gönderir (saat dilimi günü kaydırmasın).
  static String _day(DateTime day) =>
      DateTime.utc(day.year, day.month, day.day).toIso8601String();

  Future<Map<String, dynamic>> getAccount({
    String? studentName,
    String? studentUserId,
  }) async {
    final result = await _get('/api/student-finance/account', {
      if (studentName != null && studentName.isNotEmpty)
        'studentName': studentName,
      if (studentUserId != null && studentUserId.isNotEmpty)
        'studentUserId': studentUserId,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  /// Cari hesap ekstresi (JSON): kurum künyesi, tarih sıralı borç/alacak
  /// hareketleri ve yürüyen bakiye sunucuda hesaplanır.
  Future<Map<String, dynamic>> getStatement({
    String? studentName,
    String? studentUserId,
    DateTime? fromUtc,
    DateTime? toUtc,
  }) async {
    final result = await _get(
      '/api/student-finance/statement',
      _statementQuery(
        studentName: studentName,
        studentUserId: studentUserId,
        fromUtc: fromUtc,
        toUtc: toUtc,
      ),
    );
    return Map<String, dynamic>.from(result as Map);
  }

  /// Aynı ekstrenin kurum künyeli, baskıya/paylaşıma uygun PDF çıktısı.
  Future<Uint8List> downloadStatementPdf({
    String? studentName,
    String? studentUserId,
    DateTime? fromUtc,
    DateTime? toUtc,
  }) async {
    final session = await _session();
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/student-finance/statement')
        .replace(
          queryParameters: {
            ..._statementQuery(
              studentName: studentName,
              studentUserId: studentUserId,
              fromUtc: fromUtc,
              toUtc: toUtc,
            ),
            'format': 'pdf',
          },
        );
    final response = await http.get(uri, headers: _headers(session));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StudentFinanceApiException(
        'Ekstre indirilemedi (${response.statusCode}).',
      );
    }
    return response.bodyBytes;
  }

  Map<String, String> _statementQuery({
    String? studentName,
    String? studentUserId,
    DateTime? fromUtc,
    DateTime? toUtc,
  }) => {
    if (studentName != null && studentName.isNotEmpty)
      'studentName': studentName,
    if (studentUserId != null && studentUserId.isNotEmpty)
      'studentUserId': studentUserId,
    if (fromUtc != null) 'fromUtc': fromUtc.toIso8601String(),
    if (toUtc != null) 'toUtc': toUtc.toIso8601String(),
  };

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

  /// [clientRequestId]: çift tahsilat koruması. Tahsilat penceresi açılışında
  /// BİR kez üretilir; aynı kimlikle gelen ikinci istek sunucuda yeni kayıt
  /// oluşturmaz, ilk makbuzu döndürür.
  Future<Map<String, dynamic>> recordPayment({
    required String studentName,
    required double amount,
    String method = 'Nakit',
    String? enrollmentContractId,
    String? financeInstallmentId,
    String? note,
    String? studentUserId,
    String? clientRequestId,
  }) async {
    final result = await _post('/api/student-finance/payments', {
      'studentName': studentName,
      'amount': amount,
      'method': method,
      'enrollmentContractId': ?enrollmentContractId,
      'financeInstallmentId': ?financeInstallmentId,
      'note': ?note,
      'studentUserId': ?studentUserId,
      'clientRequestId': ?clientRequestId,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  /// Bekleyen peşinatı makbuzlu tahsil eder ve sözleşmeyi "ödendi" işaretler.
  Future<Map<String, dynamic>> collectDownPayment({
    required String contractId,
    String method = 'Nakit',
  }) async {
    final result = await _post(
      '/api/student-finance/contracts/$contractId/collect-down-payment',
      {'method': method},
    );
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

  Future<Map<String, dynamic>> sendReminders({
    int upcomingWindowDays = 7,
  }) async {
    final result = await _post('/api/student-finance/reminders', const {}, {
      'upcomingWindowDays': '$upcomingWindowDays',
    });
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

  // ---- Banka mutabakatı (kalıcı kayıtlar) ----
  Future<List<Map<String, dynamic>>> getReconciliationEntries({String? status}) async {
    final result = await _get(
      '/api/student-finance/reconciliation/entries',
      status == null || status.isEmpty ? null : {'status': status},
    );
    return (result as List? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  /// action: 'ignore' (eşleşme beklenmez) ya da 'unmatch' (eşleşmeyi kaldır).
  Future<void> updateReconciliationEntry(String id, String action) async {
    await _put('/api/student-finance/reconciliation/entries/$id', {'action': action});
  }

  // ---- Gün sonu kasa kapanışı ----
  Future<Map<String, dynamic>> getDaySummary(DateTime day) async {
    final result = await _get('/api/student-finance/day-close', {'day': _day(day)});
    return Map<String, dynamic>.from(result as Map);
  }

  Future<List<Map<String, dynamic>>> getDayHistory() async {
    final result = await _get('/api/student-finance/day-close/history');
    return (result as List? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> closeDay({
    required DateTime day,
    required double countedCash,
    String? note,
  }) async {
    final result = await _post('/api/student-finance/day-close', {
      'day': _day(day),
      'countedCash': countedCash,
      'note': note,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  /// Kapanmış günü yeniden açar (yalnız yönetici).
  Future<void> reopenDay({required DateTime day, required String reason}) async {
    await _post('/api/student-finance/day-close/reopen', {
      'day': _day(day),
      'reason': reason,
    });
  }

  // ---- Sözleşme yaşam döngüsü ----
  /// action: 'freeze' / 'unfreeze' / 'cancel'.
  Future<Map<String, dynamic>> changeContractStatus({
    required String contractId,
    required String action,
    required String reason,
  }) async {
    final result = await _post('/api/student-finance/contracts/$contractId/status', {
      'action': action,
      'reason': reason,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  Future<Map<String, dynamic>> restructureInstallments({
    required String contractId,
    required int installmentCount,
    required DateTime firstDueDate,
    String? reason,
  }) async {
    final result = await _post('/api/student-finance/contracts/$contractId/restructure', {
      'installmentCount': installmentCount,
      'firstDueDate': DateTime(firstDueDate.year, firstDueDate.month, firstDueDate.day, 12)
          .toUtc()
          .toIso8601String(),
      'reason': reason,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  // ---- Toplu tahsilat ----
  Future<Map<String, dynamic>> bulkCollect({
    required List<Map<String, dynamic>> rows,
    required bool dryRun,
  }) async {
    final result = await _post('/api/student-finance/payments/bulk', {
      'rows': rows,
      'dryRun': dryRun,
    });
    return Map<String, dynamic>.from(result as Map);
  }
}
