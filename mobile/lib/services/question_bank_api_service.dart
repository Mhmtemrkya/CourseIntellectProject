import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';
import 'question_bank_store.dart';

class QuestionBankApiException implements Exception {
  final String message;

  const QuestionBankApiException(this.message);

  @override
  String toString() => message;
}

class QuestionStudioDraftRecord {
  final String id;
  final String title;
  final String mode;
  final String payloadJson;
  final String updatedAtUtc;

  const QuestionStudioDraftRecord({
    required this.id,
    required this.title,
    required this.mode,
    required this.payloadJson,
    required this.updatedAtUtc,
  });

  factory QuestionStudioDraftRecord.fromMap(Map<String, dynamic> map) {
    return QuestionStudioDraftRecord(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      mode: map['mode']?.toString() ?? 'QuestionBank',
      payloadJson: map['payloadJson']?.toString() ?? '{}',
      updatedAtUtc: map['updatedAtUtc']?.toString() ?? '',
    );
  }
}

class QuestionBankApiService {
  QuestionBankApiService._();

  static final QuestionBankApiService instance = QuestionBankApiService._();

  Future<List<QuestionBankRecord>> fetchQuestions({String? className}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank').replace(
        queryParameters: className == null ? null : {'className': className},
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Soru bankası alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => _mapRecord(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<QuestionBankRecord> createQuestion(QuestionBankRecord record) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Soru oluşturulamadı (${response.statusCode}).',
      );
    }

    return _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<QuestionBankRecord> updateQuestion(QuestionBankRecord record) async {
    final id = record.id;
    if (id.isEmpty) {
      throw const QuestionBankApiException('Soru kimliği bulunamadı.');
    }

    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(_toPayload(record)),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Soru güncellenemedi (${response.statusCode}).',
      );
    }

    return _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deleteQuestion(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Soru silinemedi (${response.statusCode}).',
      );
    }
  }

  Future<QuestionBankRecord> incrementUsage(String id) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank/$id/usage'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Kullanım sayısı güncellenemedi (${response.statusCode}).',
      );
    }

    return _mapRecord(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<QuestionStudioDraftRecord> saveStudioDraft({
    String? id,
    required String title,
    required String mode,
    required Map<String, dynamic> payload,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/question-studio/drafts'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        if (id != null && id.isNotEmpty) 'id': id,
        'title': title.trim().isEmpty ? 'Adsız Soru Taslağı' : title.trim(),
        'mode': mode,
        'payloadJson': jsonEncode(payload),
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Taslak kaydedilemedi (${response.statusCode}).',
      );
    }

    return QuestionStudioDraftRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<String> uploadQuestionAsset({
    required String path,
    required String folder,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final file = File(path);
    if (!file.existsSync()) {
      throw const QuestionBankApiException('Dosya bulunamadı.');
    }

    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '${ApiConfig.baseUrl}/api/uploads',
      ).replace(queryParameters: {'folder': folder}),
    );
    request.headers['Authorization'] = 'Bearer ${session.accessToken}';
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        filename: file.uri.pathSegments.last,
      ),
    );

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Dosya yüklenemedi (${response.statusCode}).',
      );
    }

    final payload = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return payload['fileUrl'] as String? ??
        payload['fileName'] as String? ??
        file.uri.pathSegments.last;
  }

  Future<void> submitAttempt({
    required String questionId,
    required String studentName,
    required String studentUsername,
    required String answerText,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const QuestionBankApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/questionbank/$questionId/attempts'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'studentName': studentName,
        'studentUsername': studentUsername,
        'answerText': answerText,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw QuestionBankApiException(
        'Soru denemesi kaydedilemedi (${response.statusCode}).',
      );
    }
  }

  static QuestionBankRecord _mapRecord(Map<String, dynamic> map) {
    return QuestionBankRecord(
      id: map['id'] as String,
      subject: _normalizeLabel(map['subject'] as String),
      topic: map['topic'] as String,
      difficulty: _normalizeLabel(map['difficulty'] as String),
      type: _normalizeLabel(map['type'] as String),
      questionText: map['questionText'] as String,
      teacher: map['teacher'] as String,
      createdAt: map['createdAt'] as String,
      usageCount: map['usageCount'] as int,
      imagePath: map['imagePath'] as String?,
      options: (map['options'] as List<dynamic>? ?? const []).cast<String>(),
      correctOptionIndex: map['correctOptionIndex'] as int?,
      classTargets:
          ((map['classTargets'] as List<dynamic>? ?? const ['Tüm Sınıflar'])
                  .cast<String>())
              .map(_normalizeLabel)
              .toList(),
      solutionAssetPath: map['solutionAssetPath'] as String?,
      solutionAssetType: _normalizeNullable(
        map['solutionAssetType'] as String?,
      ),
      questionSetKey: map['questionSetKey'] as String?,
      questionSetTitle: map['questionSetTitle'] as String?,
      questionOrder: map['questionOrder'] as int?,
      revealCorrectAnswerToStudent:
          map['revealCorrectAnswerToStudent'] as bool? ?? false,
      expectedAnswer: map['expectedAnswer'] as String?,
      imagePlacement: map['imagePlacement'] as String? ?? 'Top',
      richTextHtml: map['richTextHtml'] as String?,
      solutionTextHtml: map['solutionTextHtml'] as String?,
      editorMetadataJson: map['editorMetadataJson'] as String?,
      publicationStatus: map['publicationStatus'] as String? ?? 'Published',
    );
  }

  static Map<String, dynamic> _toPayload(QuestionBankRecord record) {
    final payload = <String, dynamic>{
      'subject': record.subject,
      'topic': record.topic,
      'difficulty': record.difficulty,
      'type': record.type,
      'questionText': record.questionText,
      'teacher': record.teacher,
      'imagePlacement': record.imagePath == null
          ? 'None'
          : record.imagePlacement,
      'options': record.options,
      'classTargets': record.classTargets,
      'revealCorrectAnswerToStudent': record.revealCorrectAnswerToStudent,
      'publicationStatus': record.publicationStatus,
    };
    if (record.imagePath != null) {
      payload['imagePath'] = record.imagePath;
    }
    if (record.correctOptionIndex != null) {
      payload['correctOptionIndex'] = record.correctOptionIndex;
    }
    if (record.solutionAssetPath != null) {
      payload['solutionAssetPath'] = record.solutionAssetPath;
    }
    if (record.solutionAssetType != null) {
      payload['solutionAssetType'] = record.solutionAssetType;
    }
    if (record.questionSetKey != null) {
      payload['questionSetKey'] = record.questionSetKey;
    }
    if (record.questionSetTitle != null) {
      payload['questionSetTitle'] = record.questionSetTitle;
    }
    if (record.questionOrder != null) {
      payload['questionOrder'] = record.questionOrder;
    }
    if (record.expectedAnswer != null) {
      payload['expectedAnswer'] = record.expectedAnswer;
    }
    if (record.richTextHtml != null) {
      payload['richTextHtml'] = record.richTextHtml;
    }
    if (record.solutionTextHtml != null) {
      payload['solutionTextHtml'] = record.solutionTextHtml;
    }
    if (record.editorMetadataJson != null) {
      payload['editorMetadataJson'] = record.editorMetadataJson;
    }
    return payload;
  }

  static String _normalizeLabel(String value) {
    return switch (value) {
      'Coktan Secmeli' => 'Çoktan Seçmeli',
      'Acik Uclu' => 'Açık Uçlu',
      'Tüm Sınıflar' => 'Tüm Sınıflar',
      _ => value,
    };
  }

  static String? _normalizeNullable(String? value) {
    if (value == null) return null;
    return _normalizeLabel(value);
  }
}
