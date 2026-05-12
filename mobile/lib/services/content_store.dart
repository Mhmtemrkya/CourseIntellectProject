import 'package:flutter/material.dart';

class ContentRecord {
  final String? id;
  final String subject;
  final String title;
  final String teacher;
  final String info;
  final double progress;
  final String fileType;
  final String grade;
  final String views;
  final String size;
  final String description;
  final String? fileName;
  final String? fileUrl;
  final String? playlistKey;
  final String? playlistTitle;
  final int? playlistOrder;
  final String publishStatus;

  const ContentRecord({
    this.id,
    required this.subject,
    required this.title,
    required this.teacher,
    required this.info,
    required this.progress,
    required this.fileType,
    required this.grade,
    required this.views,
    required this.size,
    required this.description,
    this.fileName,
    this.fileUrl,
    this.playlistKey,
    this.playlistTitle,
    this.playlistOrder,
    this.publishStatus = 'Aktif',
  });

  bool get isVideo => fileType.toLowerCase().contains('video');
  bool get isVisibleToStudents {
    final status = publishStatus.trim().toLowerCase();
    return status == 'aktif' ||
        status == 'yayında' ||
        status == 'yayında' ||
        status == 'active' ||
        status == 'published';
  }

  ContentRecord copyWith({
    String? id,
    String? subject,
    String? title,
    String? teacher,
    String? info,
    double? progress,
    String? fileType,
    String? grade,
    String? views,
    String? size,
    String? description,
    String? fileName,
    String? fileUrl,
    String? playlistKey,
    String? playlistTitle,
    int? playlistOrder,
    String? publishStatus,
  }) {
    return ContentRecord(
      id: id ?? this.id,
      subject: subject ?? this.subject,
      title: title ?? this.title,
      teacher: teacher ?? this.teacher,
      info: info ?? this.info,
      progress: progress ?? this.progress,
      fileType: fileType ?? this.fileType,
      grade: grade ?? this.grade,
      views: views ?? this.views,
      size: size ?? this.size,
      description: description ?? this.description,
      fileName: fileName ?? this.fileName,
      fileUrl: fileUrl ?? this.fileUrl,
      playlistKey: playlistKey ?? this.playlistKey,
      playlistTitle: playlistTitle ?? this.playlistTitle,
      playlistOrder: playlistOrder ?? this.playlistOrder,
      publishStatus: publishStatus ?? this.publishStatus,
    );
  }
}

class ContentStore extends ChangeNotifier {
  ContentStore._();

  static final ContentStore instance = ContentStore._();

  final List<ContentRecord> _contents = [];

  List<ContentRecord> get contents => List.unmodifiable(_contents);

  int get totalCount => _contents.length;
  int get pdfCount => _contents.where((item) => !item.isVideo).length;
  int get videoCount => _contents.where((item) => item.isVideo).length;

  void replaceContents(List<ContentRecord> records) {
    _contents
      ..clear()
      ..addAll(records);
    notifyListeners();
  }

  void addContent(ContentRecord record) {
    _contents.insert(0, record);
    notifyListeners();
  }

  void updateContent(ContentRecord original, ContentRecord updated) {
    final index = _contents.indexOf(original);
    if (index == -1) {
      return;
    }
    _contents[index] = updated;
    notifyListeners();
  }

  void removeById(String id) {
    _contents.removeWhere((item) => item.id == id);
    notifyListeners();
  }
}
