import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:student/pages/teacher_exam_results_page.dart';
import 'package:student/services/admin_directory_api_service.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/reports_analytics_api_service.dart';
import 'package:student/services/teacher_weekly_report_api_service.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/responsive_overlays.dart';

class TeacherReportsPage extends StatefulWidget {
  const TeacherReportsPage({super.key});

  @override
  State<TeacherReportsPage> createState() => _TeacherReportsPageState();
}

class _TeacherReportsPageState extends State<TeacherReportsPage> {
  final List<String> periods = ["Bugün", "Bu Hafta", "Bu Ay"];
  String selectedPeriod = "Bu Ay";
  String selectedClass = "Tüm Sınıflar";

  List<String> classFilters = ["Tüm Sınıflar"];
  List<Map<String, dynamic>> classReports = const [];
  List<Map<String, dynamic>> topics = const [];
  TeacherWeeklyReportBootstrapRecord? _weeklyBootstrap;
  List<TeacherWeeklyReportRecord> _sentWeeklyReports = const [];
  bool _sendingWeeklyReport = false;
  bool _uploadingWeeklyAttachment = false;

  String _normalizeClassName(String value) =>
      value.trim().toLowerCase().replaceAll('-', '').replaceAll(' ', '');

  String _attachmentComposerLabel(String fileType) {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return 'PDF hazır';
      case 'image':
        return 'Görsel hazır';
      case 'video':
        return 'Video hazır';
      default:
        return 'Ek dosya hazır';
    }
  }

  String _attachmentComposerTag(String fileType) {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'image':
        return 'IMG';
      case 'video':
        return 'VID';
      default:
        return 'DOS';
    }
  }

  @override
  void initState() {
    super.initState();
    _loadReports();
    _loadWeeklyReportData();
  }

  Future<void> _loadReports() async {
    final analytics = await ReportsAnalyticsApiService.instance
        .fetchTeacherAnalytics();
    final reports =
        analytics.classReports
            .map(
              (item) => {
                "className": item.className,
                "studentCount": item.studentCount,
                "average": item.average,
                "attendance": item.attendance,
                "completion": item.completion,
                "trend": item.trend,
                "topTopic": item.topTopic,
                "supportTopic": item.supportTopic,
                "exam": {
                  "title": "${item.className} Akademik Performans Raporu",
                  "className": item.className,
                  "date": "Güncel Rapor",
                },
              },
            )
            .toList()
          ..sort(
            (a, b) =>
                (a["className"] as String).compareTo(b["className"] as String),
          );

    final topicItems = analytics.topics
        .map(
          (item) => {
            "name": item.name,
            "success": item.success,
            "questionCount": item.questionCount,
            "riskLevel": item.riskLevel,
            "color": item.success >= 80
                ? const Color(0xFF27B3A2)
                : item.success >= 65
                ? const Color(0xFFFFB020)
                : const Color(0xFFFF6B6B),
          },
        )
        .toList();

    if (!mounted) return;
    setState(() {
      classReports = reports;
      topics = topicItems;
      classFilters = [
        'Tüm Sınıflar',
        ...reports.map((item) => item["className"] as String),
      ];
      if (selectedClass != 'Tüm Sınıflar' &&
          !classFilters.contains(selectedClass)) {
        selectedClass = 'Tüm Sınıflar';
      }
    });
    await _loadWeeklyReportData();
  }

  Future<void> _loadWeeklyReportData() async {
    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) return;

      TeacherWeeklyReportBootstrapRecord? bootstrap;
      try {
        bootstrap = await TeacherWeeklyReportApiService.instance.fetchBootstrap(
          teacherUsername: session.username,
        );
      } catch (_) {
        bootstrap = null;
      }

      final sentReports = await TeacherWeeklyReportApiService.instance
          .fetchForTeacher(
            teacherUsername: session.username,
            teacherName: session.fullName,
          )
          .catchError((_) => <TeacherWeeklyReportRecord>[]);

      final reportStudents = await TeacherWeeklyReportApiService.instance
          .fetchReportStudents()
          .catchError((_) => <TeacherWeeklyReportStudentRecord>[]);
      final fallbackStudents = await AdminDirectoryApiService.instance
          .fetchStudents()
          .catchError((_) => <AdminStudentRecord>[]);
      final fallbackClasses = await AdminDirectoryApiService.instance
          .fetchClasses()
          .catchError((_) => <String>[]);

      final mergedStudents = bootstrap?.students.isNotEmpty == true
          ? bootstrap!.students
          : reportStudents.isNotEmpty
          ? reportStudents
          : fallbackStudents
                .map(
                  (item) => TeacherWeeklyReportStudentRecord(
                    fullName: item.fullName,
                    username: item.username.isNotEmpty
                        ? item.username
                        : item.fullName,
                    className: item.className,
                    parentName: item.parentName,
                    parentEmail: item.parentEmail,
                  ),
                )
                .toList();
      final mergedClasses = {
        for (final item in {
          ...?bootstrap?.classes,
          ...fallbackClasses,
          ...reportStudents.map((item) => item.className),
          ...classReports.map((item) => item["className"] as String),
        }.where((item) => item.trim().isNotEmpty))
          _normalizeClassName(item): item,
      }.values.toList();
      final mergedSubjects = {
        ...?bootstrap?.subjects,
        ...topics.map((item) => item["name"] as String),
        'Matematik',
        'Türkçe',
        'Fen Bilimleri',
        'Sosyal Bilgiler',
      }.where((item) => item.trim().isNotEmpty).toList();

      if (!mounted) return;
      setState(() {
        _weeklyBootstrap = TeacherWeeklyReportBootstrapRecord(
          classes: mergedClasses,
          subjects: mergedSubjects,
          students: mergedStudents,
        );
        _sentWeeklyReports = sentReports;
      });
    } catch (error) {
      if (!mounted) return;
      _showInfo(error.toString());
    }
  }

  List<Map<String, dynamic>> get filteredClassReports {
    if (selectedClass == "Tüm Sınıflar") {
      return classReports;
    }
    return classReports
        .where((item) => item["className"] == selectedClass)
        .toList();
  }

  int get totalStudents => filteredClassReports.fold<int>(
    0,
    (sum, item) => sum + (item["studentCount"] as int),
  );

  int get averageScore {
    if (filteredClassReports.isEmpty) return 0;
    final total = filteredClassReports.fold<int>(
      0,
      (sum, item) => sum + (item["average"] as int),
    );
    return (total / filteredClassReports.length).round();
  }

  int get averageAttendance {
    if (filteredClassReports.isEmpty) return 0;
    final total = filteredClassReports.fold<int>(
      0,
      (sum, item) => sum + (item["attendance"] as int),
    );
    return (total / filteredClassReports.length).round();
  }

  int get averageCompletion {
    if (filteredClassReports.isEmpty) return 0;
    final total = filteredClassReports.fold<int>(
      0,
      (sum, item) => sum + (item["completion"] as int),
    );
    return (total / filteredClassReports.length).round();
  }

  List<Map<String, dynamic>> get priorityClasses {
    final sorted = [...filteredClassReports];
    sorted.sort((a, b) => (a["average"] as int).compareTo(b["average"] as int));
    return sorted.take(3).toList();
  }

  void _showInfo(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _openExportDialog() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: ResponsiveSheetContainer(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _actionTile(
                    icon: Icons.picture_as_pdf_rounded,
                    title: "PDF Olarak Dışa Aktar",
                    subtitle:
                        "$selectedPeriod filtreli yönetiçi özeti oluşturur.",
                    onTap: () {
                      Navigator.pop(context);
                      _showInfo("PDF raporu hazırlanıyor...");
                    },
                  ),
                  _actionTile(
                    icon: Icons.table_chart_rounded,
                    title: "Excel Olarak Dışa Aktar",
                    subtitle: "Sınıf bazlı puan ve devam verilerini indirir.",
                    onTap: () {
                      Navigator.pop(context);
                      _showInfo("Excel raporu hazırlanıyor...");
                    },
                  ),
                  _actionTile(
                    icon: Icons.share_rounded,
                    title: "İdare ile Paylaş",
                    subtitle:
                        "Seçili raporu müdür yardımcısı paneline gönderir.",
                    onTap: () {
                      Navigator.pop(context);
                      _showInfo("Rapor yönetime paylaşıldı.");
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openFilterDialog() {
    String tempClass = selectedClass;

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              content: ResponsiveDialogContainer(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Rapor Filtresi",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text("Sınıf Seçimi"),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: tempClass,
                      items: classFilters
                          .map(
                            (item) => DropdownMenuItem(
                              value: item,
                              child: Text(item),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        setLocalState(() {
                          tempClass = value;
                        });
                      },
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text("Vazgeç"),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      selectedClass = tempClass;
                    });
                    Navigator.pop(dialogContext);
                  },
                  child: const Text("Uygula"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _openKpiDetail(String title, String value, String insight) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          content: ResponsiveDialogContainer(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  value,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                Text(insight),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Kapat"),
            ),
          ],
        );
      },
    );
  }

  void _openClassDetail(Map<String, dynamic> report) {
    final exam = report["exam"] as Map<String, dynamic>;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        final theme = Theme.of(context);
        return SafeArea(
          child: ResponsiveSheetContainer(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Wrap(
                runSpacing: 14,
                children: [
                  Text(
                    "${report["className"]} Detay Raporu",
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  _detailStatRow("Öğrenci Sayısı", "${report["studentCount"]}"),
                  _detailStatRow("Sınıf Ortalaması", "${report["average"]}"),
                  _detailStatRow("Devam Oranı", "%${report["attendance"]}"),
                  _detailStatRow("Görev Tamamlama", "%${report["completion"]}"),
                  _detailStatRow("En Güçlü Konu", report["topTopic"] as String),
                  _detailStatRow(
                    "Destek Gereken Konu",
                    report["supportTopic"] as String,
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            _showInfo(
                              "${report["className"]} için veli bilgilendirme taslağı oluşturuldu.",
                            );
                          },
                          icon: const Icon(Icons.campaign_outlined),
                          label: const Text("Bilgilendir"),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.push(
                              this.context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    TeacherExamResultsPage(exam: exam),
                              ),
                            );
                          },
                          icon: const Icon(Icons.analytics_outlined),
                          label: const Text("Sonuçları Aç"),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openTopicDetail(Map<String, dynamic> topic) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          content: ResponsiveDialogContainer(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  topic["name"] as String,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 16),
                Text("Başarı Oranı: %${topic["success"]}"),
                const SizedBox(height: 8),
                Text("Çözülen Soru: ${topic["questionCount"]}"),
                const SizedBox(height: 8),
                Text("Durum: ${topic["riskLevel"]}"),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _showInfo(
                  "${topic["name"]} için telafi çalışma planı oluşturuldu.",
                );
              },
              child: const Text("Plan Oluştur"),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Tamam"),
            ),
          ],
        );
      },
    );
  }

  Future<void> _openWeeklyReportComposer() async {
    final session = await AuthSessionStore.instance.load();
    final bootstrap = _weeklyBootstrap;
    if (!mounted) return;
    final pageContext = context;
    if (!pageContext.mounted) return;
    if (session == null || bootstrap == null) {
      _showInfo("Rapor oluşturma verisi henüz hazır değil.");
      return;
    }

    String selectedClass = bootstrap.classes.isNotEmpty
        ? bootstrap.classes.first
        : '';
    String selectedSubject = bootstrap.subjects.isNotEmpty
        ? bootstrap.subjects.first
        : '';
    String selectedStudentKey = '';
    String title = '';
    String summary = '';
    String highlights = '';
    String supportNotes = '';
    String weeklyPeriod = 'Bu Hafta';
    final attachments = <TeacherWeeklyReportAttachmentRecord>[];

    List<TeacherWeeklyReportStudentRecord> scopedStudents() {
      if (selectedClass.isEmpty) return bootstrap.students;
      final normalizedSelectedClass = _normalizeClassName(selectedClass);
      return bootstrap.students
          .where(
            (item) =>
                _normalizeClassName(item.className) == normalizedSelectedClass,
          )
          .toList();
    }

    await showModalBottomSheet<void>(
      context: pageContext,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final students = scopedStudents();
            if (selectedStudentKey.isEmpty && students.isNotEmpty) {
              selectedStudentKey = students.first.username.isNotEmpty
                  ? students.first.username
                  : students.first.fullName;
            }
            final selectedStudent = students
                .where(
                  (item) =>
                      (item.username.isNotEmpty
                          ? item.username
                          : item.fullName) ==
                      selectedStudentKey,
                )
                .firstOrNull;

            Future<void> handlePickAttachment() async {
              try {
                setSheetState(() => _uploadingWeeklyAttachment = true);
                final result = await FilePicker.platform.pickFiles(
                  allowMultiple: false,
                  type: FileType.custom,
                  allowedExtensions: const [
                    'pdf',
                    'png',
                    'jpg',
                    'jpeg',
                    'webp',
                    'mp4',
                    'mov',
                    'avi',
                    'doc',
                    'docx',
                  ],
                  withData: true,
                );
                final file = result?.files.firstOrNull;
                if (file == null) return;
                final uploaded = await TeacherWeeklyReportApiService.instance
                    .uploadAttachment(file: file);
                setSheetState(() {
                  attachments.add(uploaded);
                });
              } catch (error) {
                _showInfo(error.toString());
              } finally {
                if (mounted) {
                  setSheetState(() => _uploadingWeeklyAttachment = false);
                }
              }
            }

            Future<void> handleSubmit() async {
              if (selectedClass.isEmpty ||
                  selectedSubject.isEmpty ||
                  selectedStudent == null ||
                  summary.trim().isEmpty) {
                _showInfo("Sınıf, öğrenci, ders ve özet alanlarını doldur.");
                return;
              }

              try {
                setSheetState(() => _sendingWeeklyReport = true);
                final created = await TeacherWeeklyReportApiService.instance
                    .create(
                      teacherUsername: session.username,
                      teacherName: session.fullName,
                      studentUsername: selectedStudent.username,
                      studentName: selectedStudent.fullName,
                      className: selectedClass,
                      subject: selectedSubject,
                      title: title.trim().isEmpty
                          ? '$selectedSubject Haftalık Gelişim Raporu'
                          : title.trim(),
                      summary: summary.trim(),
                      highlights: highlights.trim(),
                      supportNotes: supportNotes.trim(),
                      weeklyPeriodLabel: weeklyPeriod,
                      attachments: attachments,
                    );
                if (!mounted) return;
                setState(() {
                  _sentWeeklyReports = [created, ..._sentWeeklyReports];
                });
                if (!pageContext.mounted) return;
                Navigator.of(pageContext).pop();
                _showInfo(
                  "${selectedStudent.fullName} için rapor veliye gönderildi.",
                );
              } catch (error) {
                _showInfo(error.toString());
              } finally {
                if (mounted) {
                  setSheetState(() => _sendingWeeklyReport = false);
                }
              }
            }

            return SafeArea(
              child: ResponsiveSheetContainer(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    20,
                    8,
                    20,
                    20 + MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          "Haftalık rapor oluştur",
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "Rapor seçilen öğrencinin veli haftalık rapor alanına düşürülür.",
                        ),
                        const SizedBox(height: 18),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final compact = constraints.maxWidth < 520;
                            final classField = DropdownButtonFormField<String>(
                              initialValue: selectedClass.isEmpty
                                  ? null
                                  : selectedClass,
                              isExpanded: true,
                              items: bootstrap.classes
                                  .map(
                                    (item) => DropdownMenuItem(
                                      value: item,
                                      child: Text(
                                        item,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              decoration: const InputDecoration(
                                labelText: "Sınıf",
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (value) {
                                setSheetState(() {
                                  selectedClass = value ?? '';
                                  selectedStudentKey = '';
                                });
                              },
                            );
                            final subjectField =
                                DropdownButtonFormField<String>(
                                  initialValue: selectedSubject.isEmpty
                                      ? null
                                      : selectedSubject,
                                  isExpanded: true,
                                  items: bootstrap.subjects
                                      .map(
                                        (item) => DropdownMenuItem(
                                          value: item,
                                          child: Text(
                                            item,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      )
                                      .toList(),
                                  decoration: const InputDecoration(
                                    labelText: "Ders",
                                    border: OutlineInputBorder(),
                                  ),
                                  onChanged: (value) {
                                    setSheetState(() {
                                      selectedSubject = value ?? '';
                                    });
                                  },
                                );

                            if (compact) {
                              return Column(
                                children: [
                                  classField,
                                  const SizedBox(height: 12),
                                  subjectField,
                                ],
                              );
                            }

                            return Row(
                              children: [
                                Expanded(child: classField),
                                const SizedBox(width: 12),
                                Expanded(child: subjectField),
                              ],
                            );
                          },
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: selectedStudentKey.isEmpty
                              ? null
                              : selectedStudentKey,
                          isExpanded: true,
                          items: students
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.username.isNotEmpty
                                      ? item.username
                                      : item.fullName,
                                  child: Text(
                                    "${item.fullName} • ${item.parentName}",
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          decoration: const InputDecoration(
                            labelText: "Öğrenci",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) {
                            setSheetState(() {
                              selectedStudentKey = value ?? '';
                            });
                          },
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: weeklyPeriod,
                          items: const ["Bu Hafta", "Geçen Hafta", "Aylık Özet"]
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text(item),
                                ),
                              )
                              .toList(),
                          decoration: const InputDecoration(
                            labelText: "Dönem",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) {
                            setSheetState(() {
                              weeklyPeriod = value ?? 'Bu Hafta';
                            });
                          },
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          decoration: const InputDecoration(
                            labelText: "Rapor Başlığı",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) => title = value,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          maxLines: 5,
                          decoration: const InputDecoration(
                            labelText: "Öğretmen Özeti",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) => summary = value,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: "Güçlü Yönler",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) => highlights = value,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: "Destek Notları",
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (value) => supportNotes = value,
                        ),
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      "Ek Dosyalar",
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  FilledButton.tonalIcon(
                                    onPressed: _uploadingWeeklyAttachment
                                        ? null
                                        : handlePickAttachment,
                                    icon: const Icon(Icons.attach_file_rounded),
                                    label: Text(
                                      _uploadingWeeklyAttachment
                                          ? "Yükleniyor"
                                          : "Dosya Ekle",
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              if (attachments.isEmpty)
                                const Text(
                                  "Görsel, PDF veya dosya ekleyebilirsin.",
                                )
                              else
                                ...attachments.asMap().entries.map(
                                  (entry) => Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 12,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    child: Row(
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: const Color(
                                            0xFFDBEAFE,
                                          ),
                                          foregroundColor: const Color(
                                            0xFF2563EB,
                                          ),
                                          child: Text(
                                            _attachmentComposerTag(
                                              entry.value.fileType,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _attachmentComposerLabel(
                                                  entry.value.fileType,
                                                ),
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              Text(
                                                entry.value.fileType
                                                    .toUpperCase(),
                                              ),
                                            ],
                                          ),
                                        ),
                                        IconButton(
                                          onPressed: () {
                                            setSheetState(() {
                                              attachments.removeAt(entry.key);
                                            });
                                          },
                                          icon: const Icon(Icons.close_rounded),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _sendingWeeklyReport
                                    ? null
                                    : () => Navigator.pop(context),
                                child: const Text("Vazgec"),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _sendingWeeklyReport
                                    ? null
                                    : handleSubmit,
                                icon: const Icon(Icons.send_rounded),
                                label: Text(
                                  _sendingWeeklyReport
                                      ? "Gönderiliyor"
                                      : "Veliye Gönder",
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _openTeacherWeeklyReportDetail(TeacherWeeklyReportRecord report) {
    showDialog<void>(
      context: context,
      builder: (context) {
        final theme = Theme.of(context);
        return Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _reportBadge(report.subject),
                          _reportBadge(report.className),
                          _reportBadge(report.weeklyPeriodLabel),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        report.title,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "${report.teacherName} • ${report.studentName}",
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ],
                  ),
                ),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _reportPanel(
                          title: "Öğretmen Özeti",
                          child: Text(report.summary),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: _reportPanel(
                                title: "Guclu Yonler",
                                child: Text(
                                  report.highlights.isEmpty
                                      ? "Ek guclu yon notu girilmedi."
                                      : report.highlights,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _reportPanel(
                                title: "Destek Alanlari",
                                child: Text(
                                  report.supportNotes.isEmpty
                                      ? "Ek destek notu girilmedi."
                                      : report.supportNotes,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _reportPanel(
                          title: "Ek Dosyalar",
                          child: report.attachments.isEmpty
                              ? const Text("Bu rapora ek dosya yüklenmedi.")
                              : Column(
                                  children: report.attachments
                                      .map(
                                        (item) => ListTile(
                                          contentPadding: EdgeInsets.zero,
                                          leading: CircleAvatar(
                                            backgroundColor: const Color(
                                              0xFFDBEAFE,
                                            ),
                                            foregroundColor: const Color(
                                              0xFF2563EB,
                                            ),
                                            child: Text(
                                              item.fileType.characters.first,
                                            ),
                                          ),
                                          title: Text(item.name),
                                          subtitle: Text(item.fileType),
                                        ),
                                      )
                                      .toList(),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text("Kapat"),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final reportTheme = _ReportTheme(theme, isDark);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.scaffoldBackgroundColor,
        elevation: 0,
        title: const Text(
          "Raporlar",
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: () {
              _showInfo("3 yeni rapor bildirimi var.");
            },
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _heroCard(reportTheme),
                const SizedBox(height: 18),
                _periodChips(reportTheme),
                const SizedBox(height: 18),
                _toolbar(reportTheme),
                const SizedBox(height: 18),
                _sectionHeader(theme, "Haftalık Veli Raporları"),
                const SizedBox(height: 12),
                _weeklyReportComposerPanel(reportTheme),
                const SizedBox(height: 22),
                _sectionHeader(theme, "Genel Gosterge Paneli"),
                const SizedBox(height: 12),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isNarrow = constraints.maxWidth < 700;
                    final itemWidth = isNarrow
                        ? constraints.maxWidth
                        : (constraints.maxWidth - 12) / 2;

                    final cards = [
                      _kpiCard(
                        reportTheme,
                        title: "Toplam Öğrenci",
                        value: "$totalStudents",
                        subtitle: "Rapor kapsamindaki aktif öğrenci",
                        icon: Icons.groups_2_rounded,
                        color: const Color(0xFF4E8DF5),
                        onTap: () => _openKpiDetail(
                          "Toplam Öğrenci",
                          "$totalStudents",
                          "Seçili filtreye göre izlenen tüm sınıflardaki öğrenci sayısı.",
                        ),
                      ),
                      _kpiCard(
                        reportTheme,
                        title: "Genel Ortalama",
                        value: "$averageScore",
                        subtitle: "Sınav ve ödeve dayalı net başarı",
                        icon: Icons.auto_graph_rounded,
                        color: const Color(0xFF27B3A2),
                        onTap: () => _openKpiDetail(
                          "Genel Ortalama",
                          "$averageScore",
                          "Sınıf ortalamalari toplu olarak hesaplandi. Yukselen grafik korunuyor.",
                        ),
                      ),
                      _kpiCard(
                        reportTheme,
                        title: "Devam Orani",
                        value: "%$averageAttendance",
                        subtitle: "Canlı ders ve yoklama uyumu",
                        icon: Icons.fact_check_rounded,
                        color: const Color(0xFFFFB020),
                        onTap: () => _openKpiDetail(
                          "Devam Orani",
                          "%$averageAttendance",
                          "Devam verisi ders katılımı ve yoklama kayıtlarından oluşturuldu.",
                        ),
                      ),
                      _kpiCard(
                        reportTheme,
                        title: "Görev Tamamlama",
                        value: "%$averageCompletion",
                        subtitle: "Ödev ve quiz teslim disiplini",
                        icon: Icons.assignment_turned_in_rounded,
                        color: const Color(0xFFFF6B6B),
                        onTap: () => _openKpiDetail(
                          "Görev Tamamlama",
                          "%$averageCompletion",
                          "Eksik teslimi olan sınıflar için otomatik takip listesi önerilir.",
                        ),
                      ),
                    ];

                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: cards
                          .map(
                            (card) => SizedBox(width: itemWidth, child: card),
                          )
                          .toList(),
                    );
                  },
                ),
                const SizedBox(height: 22),
                _sectionHeader(theme, "Sınıf Bazli Performans"),
                const SizedBox(height: 12),
                ...filteredClassReports.map(
                  (report) => _classReportCard(reportTheme, report),
                ),
                const SizedBox(height: 22),
                _sectionHeader(theme, "Konu Analizi"),
                const SizedBox(height: 12),
                ...topics.map((topic) => _topicCard(reportTheme, topic)),
                const SizedBox(height: 22),
                _sectionHeader(theme, "Öncelikli Aksiyonlar"),
                const SizedBox(height: 12),
                _priorityPanel(reportTheme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heroCard(_ReportTheme reportTheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFB020)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF7A00).withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.insights_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const Spacer(),
              FilledButton.tonalIcon(
                onPressed: _openExportDialog,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.file_download_outlined),
                label: const Text("Dışa Aktar"),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            "Akademik rapor merkezi",
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "$selectedPeriod filtresiyle sınıf performansı, konu zorlugu ve takip önceliklerini tek ekranda yönetin.",
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _periodChips(_ReportTheme reportTheme) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: periods.map((period) {
        final selected = selectedPeriod == period;
        return ChoiceChip(
          label: Text(period),
          selected: selected,
          onSelected: (_) {
            setState(() {
              selectedPeriod = period;
            });
          },
          labelStyle: TextStyle(
            color: selected ? Colors.white : reportTheme.textColor,
            fontWeight: FontWeight.w700,
          ),
          selectedColor: const Color(0xFFFF7A00),
          backgroundColor: reportTheme.surfaceColor,
          side: BorderSide(
            color: selected ? Colors.transparent : reportTheme.borderColor,
          ),
        );
      }).toList(),
    );
  }

  Widget _toolbar(_ReportTheme reportTheme) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: _openFilterDialog,
            child: Ink(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: reportTheme.cardColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: reportTheme.borderColor),
              ),
              child: Row(
                children: [
                  const Icon(Icons.filter_alt_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      selectedClass,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_down_rounded),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        IconButton.filledTonal(
          onPressed: () {
            setState(() {
              selectedClass = "Tüm Sınıflar";
              selectedPeriod = "Bu Ay";
            });
            _showInfo("Filtreler sifirlandi.");
          },
          icon: const Icon(Icons.restart_alt_rounded),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          onPressed: _openExportDialog,
          style: IconButton.styleFrom(backgroundColor: const Color(0xFFFF7A00)),
          icon: const Icon(Icons.ios_share_rounded),
        ),
      ],
    );
  }

  Widget _sectionHeader(ThemeData theme, String title) {
    return Text(
      title,
      style: theme.textTheme.titleMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  Widget _kpiCard(
    _ReportTheme reportTheme, {
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: reportTheme.cardColor,
          borderRadius: BorderRadius.circular(24),
          boxShadow: reportTheme.shadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 18),
            Text(
              value,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: reportTheme.textColor,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: reportTheme.textColor,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: reportTheme.subtleTextColor,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _weeklyReportComposerPanel(_ReportTheme reportTheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: reportTheme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: reportTheme.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.auto_stories_rounded,
                  color: Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Öğrenci için haftalık rapor oluştur",
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: reportTheme.textColor,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Sınıf seç, öğrenciyi belirle, ek dosya yükle ve veliye tek adımda gönder.",
                      style: TextStyle(color: reportTheme.subtleTextColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _miniMetric(
                  reportTheme,
                  label: "Sınıf",
                  value: "${_weeklyBootstrap?.classes.length ?? 0}",
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniMetric(
                  reportTheme,
                  label: "Öğrenci",
                  value: "${_weeklyBootstrap?.students.length ?? 0}",
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniMetric(
                  reportTheme,
                  label: "Gönderilen",
                  value: "${_sentWeeklyReports.length}",
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _openWeeklyReportComposer,
              icon: const Icon(Icons.send_rounded),
              label: const Text("Rapor Oluştur ve Veliye Gönder"),
            ),
          ),
          if (_sentWeeklyReports.isNotEmpty) ...[
            const SizedBox(height: 18),
            ..._sentWeeklyReports
                .take(3)
                .map(
                  (report) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(22),
                      onTap: () => _openTeacherWeeklyReportDetail(report),
                      child: Ink(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          color: Colors.white,
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: _reportAccent(
                                report.subject,
                              ).withValues(alpha: 0.10),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    color: _reportAccent(
                                      report.subject,
                                    ).withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Center(
                                    child: Text(
                                      _reportGlyph(report.subject),
                                      style: TextStyle(
                                        color: _reportAccent(report.subject),
                                        fontWeight: FontWeight.w900,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _reportCardTitle(report),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Color(0xFF0F172A),
                                          fontSize: 18,
                                          fontWeight: FontWeight.w800,
                                          height: 1.2,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        _reportCardMeta(report),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _reportBadge(
                                  report.className.isEmpty
                                      ? 'Sınıf'
                                      : report.className,
                                ),
                                _reportBadge(
                                  report.subject.isEmpty
                                      ? 'Rapor'
                                      : report.subject,
                                ),
                                _reportBadge("${report.attachments.length} ek"),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _reportCardSummary(report),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xFF475569),
                                height: 1.5,
                              ),
                            ),
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Row(
                                children: [
                                  Icon(
                                    Icons.visibility_outlined,
                                    size: 18,
                                    color: Color(0xFF334155),
                                  ),
                                  SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Raporu aç ve detayları incele',
                                      style: TextStyle(
                                        color: Color(0xFF334155),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _miniMetric(
    _ReportTheme reportTheme, {
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: reportTheme.surfaceColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: reportTheme.subtleTextColor, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: reportTheme.textColor,
              fontWeight: FontWeight.w800,
              fontSize: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _classReportCard(
    _ReportTheme reportTheme,
    Map<String, dynamic> report,
  ) {
    final average = report["average"] as int;
    final attendance = report["attendance"] as int;
    final completion = report["completion"] as int;
    final trend = report["trend"] as String;
    final positiveTrend = trend.startsWith("+");

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: reportTheme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: reportTheme.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF7A00).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.school_rounded,
                  color: Color(0xFFFF7A00),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      report["className"] as String,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: reportTheme.textColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${report["studentCount"]} öğrenci • En guclu konu: ${report["topTopic"]}",
                      style: TextStyle(color: reportTheme.subtleTextColor),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color:
                      (positiveTrend
                              ? const Color(0xFF27B3A2)
                              : const Color(0xFFFF6B6B))
                          .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  trend,
                  style: TextStyle(
                    color: positiveTrend
                        ? const Color(0xFF27B3A2)
                        : const Color(0xFFFF6B6B),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _progressLine(
            reportTheme,
            label: "Sınıf Ortalamasi",
            value: average,
            color: const Color(0xFF4E8DF5),
          ),
          const SizedBox(height: 12),
          _progressLine(
            reportTheme,
            label: "Devam Orani",
            value: attendance,
            color: const Color(0xFF27B3A2),
          ),
          const SizedBox(height: 12),
          _progressLine(
            reportTheme,
            label: "Görev Tamamlama",
            value: completion,
            color: const Color(0xFFFFB020),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: reportTheme.surfaceColor,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(
              "Destek odagi: ${report["supportTopic"]}",
              style: TextStyle(
                color: reportTheme.textColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _openClassDetail(report),
                  child: const Text("Detay"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => TeacherExamResultsPage(
                          exam: report["exam"] as Map<String, dynamic>,
                        ),
                      ),
                    );
                  },
                  child: const Text("Sonuçlar"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _progressLine(
    _ReportTheme reportTheme, {
    required String label,
    required int value,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: reportTheme.textColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Text(
              "%$value",
              style: TextStyle(
                color: reportTheme.textColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _fillBar(reportTheme, value: value, color: color),
      ],
    );
  }

  Widget _topicCard(_ReportTheme reportTheme, Map<String, dynamic> topic) {
    final color = topic["color"] as Color;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => _openTopicDetail(topic),
        child: Ink(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: reportTheme.cardColor,
            borderRadius: BorderRadius.circular(22),
            boxShadow: reportTheme.shadow,
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      topic["name"] as String,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: reportTheme.textColor,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      topic["riskLevel"] as String,
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      "${topic["questionCount"]} soru çözüldü",
                      style: TextStyle(color: reportTheme.subtleTextColor),
                    ),
                  ),
                  Text(
                    "%${topic["success"]}",
                    style: TextStyle(
                      color: reportTheme.textColor,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _fillBar(
                reportTheme,
                value: topic["success"] as int,
                color: color,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _priorityPanel(_ReportTheme reportTheme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: reportTheme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: reportTheme.shadow,
      ),
      child: Column(
        children: [
          ...priorityClasses.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(
                      0xFFFF6B6B,
                    ).withValues(alpha: 0.12),
                    foregroundColor: const Color(0xFFFF6B6B),
                    child: Text((item["className"] as String).split("-").first),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item["className"] as String,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: reportTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Öncelik konusu: ${item["supportTopic"]}",
                          style: TextStyle(color: reportTheme.subtleTextColor),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    "${item["average"]}",
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: reportTheme.textColor,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    _showInfo("Telafi grubu plan taslağı hazırlandi.");
                  },
                  icon: const Icon(Icons.group_add_outlined),
                  label: const Text("Telafi Grubu"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    _showInfo("Haftalık rapor yönetime gönderildi.");
                  },
                  icon: const Icon(Icons.send_outlined),
                  label: const Text("Rapor Gönder"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _fillBar(
    _ReportTheme reportTheme, {
    required int value,
    required Color color,
  }) {
    final safeValue = value.clamp(0, 100) / 100;

    return Container(
      height: 10,
      width: double.infinity,
      decoration: BoxDecoration(
        color: reportTheme.surfaceColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: safeValue,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              colors: [color.withValues(alpha: 0.72), color],
            ),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.22),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailStatRow(String label, String value) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _reportBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _reportPanel({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Color _reportAccent(String subject) {
    final normalized = subject.toLowerCase();
    if (normalized.contains('matem')) return const Color(0xFF2563EB);
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const Color(0xFFDC2626);
    }
    if (normalized.contains('fen')) return const Color(0xFF059669);
    if (normalized.contains('ing')) return const Color(0xFF7C3AED);
    if (normalized.contains('sosyal') ||
        normalized.contains('coğraf') ||
        normalized.contains('cograf')) {
      return const Color(0xFFF97316);
    }
    return const Color(0xFF0F766E);
  }

  String _reportGlyph(String subject) {
    final normalized = subject.toLowerCase();
    if (normalized.contains('matem')) return '∑';
    if (normalized.contains('türk') || normalized.contains('turk')) return 'TR';
    if (normalized.contains('fen')) return 'FN';
    if (normalized.contains('ing')) return 'EN';
    if (normalized.contains('sosyal') ||
        normalized.contains('coğraf') ||
        normalized.contains('cograf')) {
      return 'SB';
    }
    return 'RP';
  }

  String _reportCardTitle(TeacherWeeklyReportRecord report) {
    final title = report.title.trim();
    if (title.isNotEmpty) return title;
    final subject = report.subject.trim().isEmpty
        ? 'Haftalık Rapor'
        : report.subject.trim();
    return '$subject Haftalık Gelişim Raporu';
  }

  String _reportCardMeta(TeacherWeeklyReportRecord report) {
    final student = report.studentName.trim().isEmpty
        ? 'Öğrenci seçimi'
        : report.studentName.trim();
    final parent = report.parentName.trim().isEmpty
        ? 'Veli bilgisi'
        : report.parentName.trim();
    return '$student • $parent';
  }

  String _reportCardSummary(TeacherWeeklyReportRecord report) {
    final summary = report.summary.trim();
    if (summary.isNotEmpty) return summary;
    return 'Bu rapor için öğretmen özeti kaydedildi. Detayı açarak tüm notları ve ek dosyaları inceleyebilirsin.';
  }

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFFF7A00).withValues(alpha: 0.12),
        foregroundColor: const Color(0xFFFF7A00),
        child: Icon(icon),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(subtitle),
      onTap: onTap,
    );
  }
}

class _ReportTheme {
  final ThemeData theme;
  final bool isDark;

  _ReportTheme(this.theme, this.isDark);

  Color get cardColor => theme.cardColor;
  Color get surfaceColor =>
      isDark ? const Color(0xFF161920) : const Color(0xFFF5F7FB);
  Color get borderColor =>
      isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE6EAF2);
  Color get textColor => theme.textTheme.bodyLarge?.color ?? Colors.black;
  Color get subtleTextColor =>
      theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.72) ??
      Colors.black54;

  List<BoxShadow> get shadow => [
    BoxShadow(
      color: isDark
          ? Colors.black.withValues(alpha: 0.22)
          : Colors.black.withValues(alpha: 0.05),
      blurRadius: 16,
      offset: const Offset(0, 8),
    ),
  ];
}
