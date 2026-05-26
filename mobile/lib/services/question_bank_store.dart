import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'question_bank_api_service.dart';

class QuestionBankRecord {
  final String id;
  final String subject;
  final String topic;
  final String difficulty;
  final String type;
  final String questionText;
  final String teacher;
  final String createdAt;
  final int usageCount;
  final String? imagePath;
  final List<String> options;
  final int? correctOptionIndex;
  final List<String> classTargets;
  final String? solutionAssetPath;
  final String? solutionAssetType;
  final String? questionSetKey;
  final String? questionSetTitle;
  final int? questionOrder;
  final bool revealCorrectAnswerToStudent;
  final String? expectedAnswer;
  final String imagePlacement;
  final String? richTextHtml;
  final String? solutionTextHtml;
  final String? editorMetadataJson;
  final String publicationStatus;

  QuestionBankRecord({
    required this.id,
    required this.subject,
    required this.topic,
    required this.difficulty,
    required this.type,
    required this.questionText,
    required this.teacher,
    required this.createdAt,
    required this.usageCount,
    this.imagePath,
    this.options = const [],
    this.correctOptionIndex,
    this.classTargets = const ['Tüm Sınıflar'],
    this.solutionAssetPath,
    this.solutionAssetType,
    this.questionSetKey,
    this.questionSetTitle,
    this.questionOrder,
    this.revealCorrectAnswerToStudent = false,
    this.expectedAnswer,
    this.imagePlacement = 'Top',
    this.richTextHtml,
    this.solutionTextHtml,
    this.editorMetadataJson,
    this.publicationStatus = 'Published',
  });

  factory QuestionBankRecord.fromMap(Map<String, dynamic> map) {
    return QuestionBankRecord(
      id: map['id'] as String,
      subject: map['subject'] as String,
      topic: map['topic'] as String,
      difficulty: map['difficulty'] as String,
      type: map['type'] as String,
      questionText: map['questionText'] as String,
      teacher: map['teacher'] as String,
      createdAt: map['createdAt'] as String,
      usageCount: map['usageCount'] as int,
      imagePath: map['imagePath'] as String?,
      options: (map['options'] as List<dynamic>? ?? const []).cast<String>(),
      correctOptionIndex: map['correctOptionIndex'] as int?,
      classTargets:
          (map['classTargets'] as List<dynamic>? ?? const ['Tüm Sınıflar'])
              .cast<String>(),
      solutionAssetPath: map['solutionAssetPath'] as String?,
      solutionAssetType: map['solutionAssetType'] as String?,
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

  List<String?> get optionImagePaths {
    final raw = editorMetadataJson;
    if (raw == null || raw.trim().isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return const [];
      final assets = decoded['optionAssets'];
      if (assets is! List) return const [];
      final paths = List<String?>.filled(options.length, null);
      for (var position = 0; position < assets.length; position++) {
        final asset = assets[position];
        if (asset is! Map) continue;
        final value = asset['imagePath']?.toString().trim();
        if (value == null || value.isEmpty) continue;
        final rawIndex = asset['index'];
        final index = rawIndex is num ? rawIndex.toInt() : position;
        if (index >= 0 && index < paths.length) {
          paths[index] = value;
        }
      }
      return paths;
    } catch (_) {
      return const [];
    }
  }

  QuestionBankRecord copyWith({
    String? subject,
    String? topic,
    String? difficulty,
    String? type,
    String? questionText,
    String? teacher,
    String? createdAt,
    int? usageCount,
    String? imagePath,
    List<String>? options,
    int? correctOptionIndex,
    List<String>? classTargets,
    String? solutionAssetPath,
    String? solutionAssetType,
    String? questionSetKey,
    String? questionSetTitle,
    int? questionOrder,
    bool? revealCorrectAnswerToStudent,
    String? expectedAnswer,
    String? imagePlacement,
    String? richTextHtml,
    String? solutionTextHtml,
    String? editorMetadataJson,
    String? publicationStatus,
  }) {
    return QuestionBankRecord(
      id: id,
      subject: subject ?? this.subject,
      topic: topic ?? this.topic,
      difficulty: difficulty ?? this.difficulty,
      type: type ?? this.type,
      questionText: questionText ?? this.questionText,
      teacher: teacher ?? this.teacher,
      createdAt: createdAt ?? this.createdAt,
      usageCount: usageCount ?? this.usageCount,
      imagePath: imagePath ?? this.imagePath,
      options: options ?? this.options,
      correctOptionIndex: correctOptionIndex ?? this.correctOptionIndex,
      classTargets: classTargets ?? this.classTargets,
      solutionAssetPath: solutionAssetPath ?? this.solutionAssetPath,
      solutionAssetType: solutionAssetType ?? this.solutionAssetType,
      questionSetKey: questionSetKey ?? this.questionSetKey,
      questionSetTitle: questionSetTitle ?? this.questionSetTitle,
      questionOrder: questionOrder ?? this.questionOrder,
      revealCorrectAnswerToStudent:
          revealCorrectAnswerToStudent ?? this.revealCorrectAnswerToStudent,
      expectedAnswer: expectedAnswer ?? this.expectedAnswer,
      imagePlacement: imagePlacement ?? this.imagePlacement,
      richTextHtml: richTextHtml ?? this.richTextHtml,
      solutionTextHtml: solutionTextHtml ?? this.solutionTextHtml,
      editorMetadataJson: editorMetadataJson ?? this.editorMetadataJson,
      publicationStatus: publicationStatus ?? this.publicationStatus,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'subject': subject,
    'topic': topic,
    'difficulty': difficulty,
    'type': type,
    'questionText': questionText,
    'teacher': teacher,
    'createdAt': createdAt,
    'usageCount': usageCount,
    'imagePath': imagePath,
    'options': options,
    'correctOptionIndex': correctOptionIndex,
    'classTargets': classTargets,
    'solutionAssetPath': solutionAssetPath,
    'solutionAssetType': solutionAssetType,
    'questionSetKey': questionSetKey,
    'questionSetTitle': questionSetTitle,
    'questionOrder': questionOrder,
    'revealCorrectAnswerToStudent': revealCorrectAnswerToStudent,
    'expectedAnswer': expectedAnswer,
    'imagePlacement': imagePlacement,
    'richTextHtml': richTextHtml,
    'solutionTextHtml': solutionTextHtml,
    'editorMetadataJson': editorMetadataJson,
    'publicationStatus': publicationStatus,
  };
}

class QuestionBankStore extends ChangeNotifier {
  QuestionBankStore._();

  static final QuestionBankStore instance = QuestionBankStore._();

  bool isLoaded = false;
  List<QuestionBankRecord> questions = [];

  Future<void> loadQuestions({String? className}) async {
    questions = await QuestionBankApiService.instance.fetchQuestions(
      className: className,
    );
    isLoaded = true;
    notifyListeners();
  }

  Future<QuestionBankRecord> addQuestion({
    required String subject,
    required String topic,
    required String difficulty,
    required String type,
    required String questionText,
    required String teacher,
    String? imagePath,
    List<String> options = const [],
    int? correctOptionIndex,
    List<String> classTargets = const ['Tüm Sınıflar'],
    String? solutionAssetPath,
    String? solutionAssetType,
    String? questionSetKey,
    String? questionSetTitle,
    int? questionOrder,
    bool revealCorrectAnswerToStudent = false,
    String? expectedAnswer,
    String imagePlacement = 'Top',
    String? richTextHtml,
    String? solutionTextHtml,
    String? editorMetadataJson,
    String publicationStatus = 'Published',
  }) async {
    final created = await QuestionBankApiService.instance.createQuestion(
      QuestionBankRecord(
        id: '',
        subject: subject,
        topic: topic,
        difficulty: difficulty,
        type: type,
        questionText: questionText,
        teacher: teacher,
        createdAt: '',
        usageCount: 0,
        imagePath: imagePath,
        options: options,
        correctOptionIndex: correctOptionIndex,
        classTargets: classTargets,
        solutionAssetPath: solutionAssetPath,
        solutionAssetType: solutionAssetType,
        questionSetKey: questionSetKey,
        questionSetTitle: questionSetTitle,
        questionOrder: questionOrder,
        revealCorrectAnswerToStudent: revealCorrectAnswerToStudent,
        expectedAnswer: expectedAnswer,
        imagePlacement: imagePlacement,
        richTextHtml: richTextHtml,
        solutionTextHtml: solutionTextHtml,
        editorMetadataJson: editorMetadataJson,
        publicationStatus: publicationStatus,
      ),
    );
    questions.insert(0, created);
    notifyListeners();
    return created;
  }

  Future<void> updateQuestion(QuestionBankRecord updated) async {
    final index = questions.indexWhere((item) => item.id == updated.id);
    final refreshed = await QuestionBankApiService.instance.updateQuestion(
      updated,
    );
    if (index == -1) {
      questions.insert(0, refreshed);
    } else {
      questions[index] = refreshed;
    }
    notifyListeners();
  }

  Future<void> deleteQuestion(String id) async {
    await QuestionBankApiService.instance.deleteQuestion(id);
    questions.removeWhere((item) => item.id == id);
    notifyListeners();
  }

  Future<void> incrementUsage(String id) async {
    final index = questions.indexWhere((item) => item.id == id);
    final updated = await QuestionBankApiService.instance.incrementUsage(id);
    if (index == -1) {
      questions.add(updated);
    } else {
      questions[index] = updated;
    }
    notifyListeners();
  }
}
