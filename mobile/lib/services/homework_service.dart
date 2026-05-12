import 'package:flutter/material.dart';

class HomeworkService extends ChangeNotifier {
  HomeworkService._();

  static final HomeworkService instance = HomeworkService._();

  final List<Map<String, dynamic>> _assignments = [
    {
      'id': 'hw-1',
      'title': 'Turev Uygulamalari',
      'className': '11-A',
      'subject': 'Matematik',
      'teacher': 'Hasan Yildiz',
      'deadline': '22 Mart • 23:59',
      'description':
          'Türev konusu ile ilgili verilen uygulama sorularını çözünüz.',
      'materials': ['Turev_Notlari.pdf', 'Örnek_Sorular.docx'],
      'submissions': <Map<String, dynamic>>[],
      'total': 24,
      'createdAt': DateTime(2026, 3, 18, 9, 0).toIso8601String(),
    },
    {
      'id': 'hw-2',
      'title': 'Fonksiyon Grafik Çalışmasi',
      'className': '10-B',
      'subject': 'Matematik',
      'teacher': 'Hasan Yildiz',
      'deadline': '24 Mart • 20:00',
      'description': 'Fonksiyon grafiklerini yorumlayiniz.',
      'materials': ['Fonksiyon_Grafikleri.png'],
      'submissions': <Map<String, dynamic>>[],
      'total': 28,
      'createdAt': DateTime(2026, 3, 18, 10, 0).toIso8601String(),
    },
    {
      'id': 'hw-3',
      'title': 'Limit Tekrar Ödevi',
      'className': '12-A',
      'subject': 'Matematik',
      'teacher': 'Hasan Yildiz',
      'deadline': '18 Mart • 17:00',
      'description':
          'Limit tekrar sorularını tamamlayınız ve çözümü notlarla destekleyiniz.',
      'materials': ['Limit_Özet.pdf'],
      'submissions': <Map<String, dynamic>>[
        {
          'student': 'Ali Yilmaz',
          'note': 'Cozum notlarını da ekledim.',
          'files': ['Ali_Limit_Cozum.pdf'],
          'submittedAt': DateTime(2026, 3, 17, 18, 30).toIso8601String(),
        },
      ],
      'total': 22,
      'createdAt': DateTime(2026, 3, 15, 15, 0).toIso8601String(),
    },
  ];

  List<Map<String, dynamic>> teacherAssignments() {
    final items = _assignments.map(_buildTeacherItem).toList();
    items.sort(
      (a, b) => (b['createdAt'] as String).compareTo(a['createdAt'] as String),
    );
    return items;
  }

  List<Map<String, dynamic>> activeAssignmentsForStudent(String studentName) {
    return _assignments
        .where((item) => !_hasSubmission(item, studentName))
        .map((item) => _buildStudentItem(item, submitted: false))
        .toList();
  }

  List<Map<String, dynamic>> submittedAssignmentsForStudent(
    String studentName,
  ) {
    return _assignments
        .where((item) => _hasSubmission(item, studentName))
        .map((item) => _buildStudentItem(item, submitted: true))
        .toList();
  }

  void createAssignment({
    required String title,
    required String className,
    required String deadline,
    required String description,
    required List<String> materials,
    String subject = 'Matematik',
    String teacher = 'Hasan Yildiz',
  }) {
    _assignments.insert(0, {
      'id': 'hw-${DateTime.now().microsecondsSinceEpoch}',
      'title': title,
      'className': className,
      'subject': subject,
      'teacher': teacher,
      'deadline': deadline,
      'description': description,
      'materials': List<String>.from(materials),
      'submissions': <Map<String, dynamic>>[],
      'total': 25,
      'createdAt': DateTime.now().toIso8601String(),
    });
    notifyListeners();
  }

  void deleteAssignment(String assignmentId) {
    _assignments.removeWhere((item) => item['id'] == assignmentId);
    notifyListeners();
  }

  void submitAssignment({
    required String assignmentId,
    required String studentName,
    required String note,
    required List<String> files,
  }) {
    final index = _assignments.indexWhere((item) => item['id'] == assignmentId);
    if (index == -1) return;

    final submissions = List<Map<String, dynamic>>.from(
      _assignments[index]['submissions'] as List<dynamic>,
    );
    submissions.removeWhere((item) => item['student'] == studentName);
    submissions.add({
      'student': studentName,
      'note': note,
      'files': List<String>.from(files),
      'submittedAt': DateTime.now().toIso8601String(),
    });
    _assignments[index] = {..._assignments[index], 'submissions': submissions};
    notifyListeners();
  }

  Map<String, dynamic> _buildTeacherItem(Map<String, dynamic> source) {
    final submissions = List<Map<String, dynamic>>.from(
      source['submissions'] as List<dynamic>,
    );
    final submitted = submissions.length;
    final total = source['total'] as int? ?? 25;
    final status = submitted == 0
        ? 'Yeni'
        : submitted >= total
        ? 'Tamamlandi'
        : 'Devam Ediyor';
    final statusColor = submitted == 0
        ? const Color(0xFF4E8DF5)
        : submitted >= total
        ? const Color(0xFF69C36D)
        : const Color(0xFFFFB020);

    return {
      ...source,
      'submitted': submitted,
      'total': total,
      'status': status,
      'statusColor': statusColor,
      'accentColor': submitted == 0
          ? const Color(0xFF4E8DF5)
          : const Color(0xFFFF7A00),
    };
  }

  Map<String, dynamic> _buildStudentItem(
    Map<String, dynamic> source, {
    required bool submitted,
  }) {
    return {
      ...source,
      'status': submitted ? 'Teslim Edildi' : 'Bekliyor',
      'statusColor': submitted
          ? const Color(0xFF69C36D)
          : const Color(0xFFFFB020),
      'accentColor': submitted
          ? const Color(0xFF69C36D)
          : const Color(0xFFFF7A00),
    };
  }

  bool _hasSubmission(Map<String, dynamic> source, String studentName) {
    final submissions = List<Map<String, dynamic>>.from(
      source['submissions'] as List<dynamic>,
    );
    return submissions.any((item) => item['student'] == studentName);
  }
}
