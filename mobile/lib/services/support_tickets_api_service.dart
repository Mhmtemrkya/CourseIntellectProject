import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class SupportTicketRecord {
  final String id;
  final String ticketNumber;
  final String subject;
  final String tenantName;
  final String requestedBy;
  final String category;
  final String priority;
  final String status;
  final String summary;
  final String lastMessage;
  final int messages;
  final DateTime createdAtUtc;
  final DateTime updatedAtUtc;

  const SupportTicketRecord({
    required this.id,
    required this.ticketNumber,
    required this.subject,
    required this.tenantName,
    required this.requestedBy,
    required this.category,
    required this.priority,
    required this.status,
    required this.summary,
    required this.lastMessage,
    required this.messages,
    required this.createdAtUtc,
    required this.updatedAtUtc,
  });

  bool get hasReply =>
      lastMessage.isNotEmpty && lastMessage.trim() != summary.trim();

  factory SupportTicketRecord.fromMap(Map<String, dynamic> m) {
    return SupportTicketRecord(
      id: m['id']?.toString() ?? '',
      ticketNumber: m['ticketNumber']?.toString() ?? '',
      subject: m['subject']?.toString() ?? '',
      // Backend SupportTicketDto'da alan adı `tenant` (camelCase JSON) — eski isim de tutulur
      tenantName: (m['tenant'] ?? m['tenantName'])?.toString() ?? '',
      requestedBy: (m['user'] ?? m['requestedBy'])?.toString() ?? '',
      category: m['category']?.toString() ?? 'Genel',
      priority: m['priority']?.toString() ?? 'normal',
      status: m['status']?.toString() ?? 'open',
      summary: m['summary']?.toString() ?? '',
      lastMessage: m['lastMessage']?.toString() ?? '',
      messages: (m['messages'] is num) ? (m['messages'] as num).toInt() : 0,
      createdAtUtc: DateTime.tryParse(m['createdAtUtc']?.toString() ?? '') ??
          DateTime.now(),
      updatedAtUtc: DateTime.tryParse(m['updatedAtUtc']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class SupportTicketException implements Exception {
  final String message;
  final String? code;
  const SupportTicketException(this.message, {this.code});
  @override
  String toString() => message;
}

class SupportTicketsApiService {
  SupportTicketsApiService._();

  static final SupportTicketsApiService instance = SupportTicketsApiService._();

  Future<List<SupportTicketRecord>> fetchMine() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SupportTicketException('Oturum bulunamadı.');
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/support-tickets/mine'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SupportTicketException(
        'Destek talepleri alınamadı (${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);
    final list = decoded is List ? decoded : (decoded is Map && decoded['data'] is List ? decoded['data'] as List : <dynamic>[]);
    return list
        .map((item) => SupportTicketRecord.fromMap(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<SupportTicketRecord> create({
    required String subject,
    required String summary,
    String category = 'Genel',
    String priority = 'normal',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SupportTicketException('Oturum bulunamadı.');
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/support-tickets'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'subject': subject,
        'summary': summary,
        'category': category,
        'priority': priority,
      }),
    );

    if (response.statusCode == 403) {
      String message = 'Yalnızca kurum yöneticisi destek talebi oluşturabilir.';
      String? code = 'TENANT_ADMIN_REQUIRED';
      try {
        final body = jsonDecode(response.body);
        if (body is Map) {
          message = body['message']?.toString() ?? message;
          code = body['code']?.toString() ?? code;
        }
      } catch (_) {}
      throw SupportTicketException(message, code: code);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Talep oluşturulamadı (${response.statusCode}).';
      try {
        final body = jsonDecode(response.body);
        if (body is Map && body['message'] != null) {
          message = body['message'].toString();
        }
      } catch (_) {}
      throw SupportTicketException(message);
    }

    final decoded = jsonDecode(response.body);
    final raw = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    final map = raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw;
    return SupportTicketRecord.fromMap(map);
  }
}
