import 'package:flutter/material.dart';
import 'package:student/pages/teacher_assignments_page.dart';
import 'package:student/pages/teacher_attendance_page.dart';
import 'package:student/pages/teacher_exams_page.dart';
import 'package:student/pages/teacher_live_lessons_page.dart';
import 'package:student/pages/teacher_meeting_approvals_page.dart';
import 'package:student/pages/teacher_chat_page.dart';
import 'package:student/pages/teacher_messages_page.dart';
import 'package:student/pages/teacher_question_bank_page.dart';
import 'package:student/pages/teacher_question_box_page.dart';
import 'package:student/pages/teacher_question_create_page.dart';
import 'package:student/pages/teacher_reports_page.dart';
import 'package:student/pages/teacher_schedule_page.dart';
import 'package:student/pages/teacher_content_page.dart';
import 'package:student/pages/teacher_announcements_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/exam_results_store.dart';
import 'package:student/services/smart_insight_service.dart';
import 'package:student/services/attendance_service.dart';
import 'package:student/services/accounting_finance_store.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/pages/student_study_plan_page.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/teacher_header.dart';

import '../widgets/adaptive_scaffold.dart';

class TeacherHomePage extends StatefulWidget {
  const TeacherHomePage({super.key});

  @override
  State<TeacherHomePage> createState() => _TeacherHomePageState();
}

class _TeacherHomePageState extends State<TeacherHomePage> {
  String selectedFilter = "Bugün";
  String _teacherName = 'Öğretmen';
  String _teacherSubtitle = 'Öğretmen Paneli';
  bool _loadingDashboard = true;

  final List<String> dashboardFilters = ["Bugün", "Bu Hafta", "Bu Ay"];

  final TextEditingController _taskTitleController = TextEditingController();
  final TextEditingController _taskSubtitleController = TextEditingController();

  List<Map<String, dynamic>> classComparison = const [];
  List<Map<String, dynamic>> scheduleItems = const [];
  final List<Map<String, dynamic>> _manualTasks = [];

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    try {
      await Future.wait([
        AttendanceService.instance.ensureLoaded(),
        AccountingFinanceStore.instance.loadDashboard(),
      ]);
      final session = await AuthSessionStore.instance.load();
      final lessons = await SchoolFeedApiService.instance.fetchLiveLessons();
      final examResults = await SchoolFeedApiService.instance
          .fetchExamResults();

      final teacherName = session?.fullName ?? _teacherName;
      final teacherLessons = lessons.where((lesson) {
        return _normalizeText(lesson.teacher) == _normalizeText(teacherName);
      }).toList();

      final comparison = _buildClassComparison(examResults);
      final schedule = teacherLessons.map((lesson) {
        return {
          "time": lesson.timeLabel.split(' - ').first,
          "title": lesson.title,
          "subtitle": "${lesson.className} • ${lesson.platform}",
          "status": lesson.status,
        };
      }).toList();

      if (!mounted) return;
      setState(() {
        _teacherName = teacherName;
        _teacherSubtitle = 'Bugün ${teacherLessons.length} ders';
        classComparison = comparison;
        scheduleItems = schedule;
        _loadingDashboard = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingDashboard = false;
      });
    }
  }

  List<Map<String, dynamic>> _buildClassComparison(
    List<ExamScoreRecord> records,
  ) {
    if (records.isEmpty) {
      return const [
        {
          "name": "Veri Yok",
          "average": 0,
          "trend": "0",
          "color": Color(0xFF9E9E9E),
        },
      ];
    }

    final grouped = <String, List<ExamScoreRecord>>{};
    for (final item in records) {
      grouped.putIfAbsent(item.className, () => []).add(item);
    }

    final entries =
        grouped.entries.map((entry) {
          final scores = entry.value.map((item) => item.score).toList()..sort();
          final average =
              (scores.fold<int>(0, (sum, score) => sum + score) / scores.length)
                  .round();
          final trendValue = scores.length > 1 ? scores.last - scores.first : 0;
          final color = average >= 80
              ? const Color(0xFF27B3A2)
              : average >= 65
              ? const Color(0xFFFFB020)
              : const Color(0xFFFF6B6B);
          return {
            "name": entry.key,
            "average": average,
            "trend": trendValue > 0 ? "+$trendValue" : "$trendValue",
            "color": color,
          };
        }).toList()..sort(
          (a, b) => (b["average"] as int).compareTo(a["average"] as int),
        );

    return entries.take(4).toList();
  }

  String _normalizeText(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u');
  }

  void _showInfo(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _openPage(Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }

  List<Map<String, dynamic>> get suggestions {
    final generated = SmartInsightService.instance.teacherSuggestions();
    final icons = [
      Icons.lightbulb_rounded,
      Icons.forward_to_inbox_rounded,
      Icons.quiz_rounded,
    ];
    final colors = [
      const Color(0xFFFFB020),
      const Color(0xFF4E8DF5),
      const Color(0xFF27B3A2),
    ];

    return List.generate(
      generated.length,
      (index) => {
        "title": generated[index]["title"],
        "subtitle": generated[index]["subtitle"],
        "icon": icons[index % icons.length],
        "color": colors[index % colors.length],
        "action": generated[index]["action"],
      },
    );
  }

  List<Map<String, dynamic>> get tasks {
    final absentCount = AttendanceService.instance
        .all()
        .where((item) => item.status == 'Devamsiz')
        .length;
    final overdueCount = AccountingFinanceStore.instance.installments
        .where((item) => item.status == 'Geciken')
        .length;
    return [
      ..._manualTasks,
      {
        "title": "Aktif ödev akışıni kontrol et",
        "subtitle":
            "Öğretmen panelinde açık ödevler ve teslimler seni bekliyor.",
        "icon": Icons.assignment_turned_in_rounded,
        "color": const Color(0xFFFF7A00),
        "action": "Ödevleri Ac",
        "page": const TeacherAssignmentsPage(),
      },
      {
        "title":
            "${AttendanceService.instance.all().length} yoklama kaydı izlendi",
        "subtitle": "Sınıf devam bilgileri ve PDF yoklama dokumleri hazır.",
        "icon": Icons.analytics_rounded,
        "color": const Color(0xFF27B3A2),
        "action": "Yoklamaya Git",
        "page": const TeacherAttendancePage(),
      },
      {
        "title": "${absentCount + overdueCount} öğrenci/veli takibi öneriliyor",
        "subtitle": "Devamsızlık ve finans sinyalleri birlikte izleniyor.",
        "icon": Icons.warning_amber_rounded,
        "color": const Color(0xFFFF6B6B),
        "action": "Risk Listesi",
        "page": null,
      },
    ];
  }

  List<Map<String, dynamic>> get notifications {
    final teacherSuggestions = SmartInsightService.instance
        .teacherSuggestions();
    final icons = [
      Icons.trending_down_rounded,
      Icons.mark_chat_unread_rounded,
      Icons.videocam_rounded,
    ];
    final colors = [
      const Color(0xFFFF6B6B),
      const Color(0xFF4E8DF5),
      const Color(0xFF27B3A2),
    ];
    return List.generate(
      teacherSuggestions.length,
      (index) => {
        "title": teacherSuggestions[index]["title"],
        "subtitle": teacherSuggestions[index]["subtitle"],
        "time": "${12 + (index * 18)} dk önce",
        "color": colors[index % colors.length],
        "icon": icons[index % icons.length],
      },
    );
  }

  List<Map<String, dynamic>> get riskyStudents {
    final grouped = <String, Map<String, dynamic>>{};
    for (final item in AttendanceService.instance.all()) {
      final current = grouped.putIfAbsent(
        item.studentName,
        () => {
          "name": item.studentName,
          "className": item.className,
          "score": 60,
          "attendance": 100,
          "missing": 0,
          "reason": "Ders devamı ve performans izleniyor.",
        },
      );
      if (item.status == 'Devamsiz') {
        current["missing"] = (current["missing"] as int) + 1;
        current["attendance"] = ((current["attendance"] as int) - 10).clamp(
          0,
          100,
        );
        current["score"] = ((current["score"] as int) - 6).clamp(0, 100);
        current["reason"] = 'Devamsızlık nedeniyle yakından takip öneriliyor.';
      } else if (item.status == 'Gec') {
        current["attendance"] = ((current["attendance"] as int) - 4).clamp(
          0,
          100,
        );
        current["score"] = ((current["score"] as int) - 2).clamp(0, 100);
        current["reason"] =
            'Gec kalma kayıtları zaman yönetimi destegi gerektirebilir.';
      }
    }

    final records = grouped.values
        .where(
          (item) =>
              (item["missing"] as int) > 0 || (item["attendance"] as int) < 85,
        )
        .toList();
    if (records.isNotEmpty) {
      return records.take(4).toList();
    }
    return [
      {
        "name": "Riskli kayıt yok",
        "className": "Tüm Sınıflar",
        "score": 100,
        "attendance": 100,
        "missing": 0,
        "reason": "Mevcut devamsızlık verilerinde kritik öğrenci görünmüyor.",
      },
    ];
  }

  void _openNotificationsSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final theme = Theme.of(context);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: notifications
                  .map(
                    (item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: (item["color"] as Color).withValues(
                          alpha: 0.14,
                        ),
                        foregroundColor: item["color"] as Color,
                        child: Icon(item["icon"] as IconData),
                      ),
                      title: Text(
                        item["title"] as String,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(item["subtitle"] as String),
                      trailing: Text(
                        item["time"] as String,
                        style: theme.textTheme.bodySmall,
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        _showInfo("Bildirim detayi açıldı.");
                      },
                    ),
                  )
                  .toList(),
            ),
          ),
        );
      },
    );
  }

  void _openGlobalFilter() {
    showDialog<void>(
      context: context,
      builder: (context) {
        String tempFilter = selectedFilter;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text("Panel Filtresi"),
              content: Wrap(
                spacing: 10,
                runSpacing: 10,
                children: dashboardFilters
                    .map(
                      (item) => ChoiceChip(
                        label: Text(item),
                        selected: tempFilter == item,
                        onSelected: (_) {
                          setDialogState(() {
                            tempFilter = item;
                          });
                        },
                      ),
                    )
                    .toList(),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Vazgec"),
                ),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      selectedFilter = tempFilter;
                    });
                    Navigator.pop(context);
                    _showInfo(
                      "Panel filtresi $selectedFilter olarak güncellendi.",
                    );
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

  void _openQuickCreateMenu() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _sheetAction(
                  icon: Icons.fact_check_rounded,
                  title: "Sınav Oluştur",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherExamsPage());
                  },
                ),
                _sheetAction(
                  icon: Icons.assignment_rounded,
                  title: "Ödev Ver",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherAssignmentsPage());
                  },
                ),
                _sheetAction(
                  icon: Icons.campaign_rounded,
                  title: "Duyuru Paylas",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherAnnouncementsPage());
                  },
                ),
                _sheetAction(
                  icon: Icons.help_center_rounded,
                  title: "Soru Oluştur",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherQuestionCreatePage());
                  },
                ),
                _sheetAction(
                  icon: Icons.folder_copy_rounded,
                  title: "İçerik Yükle",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherContentPage());
                  },
                ),
                _sheetAction(
                  icon: Icons.bar_chart_rounded,
                  title: "Rapor Gönder",
                  onTap: () {
                    Navigator.pop(context);
                    _openPage(const TeacherReportsPage());
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _taskTitleController.dispose();
    _taskSubtitleController.dispose();
    super.dispose();
  }

  void _openAddTaskDialog() {
    _taskTitleController.clear();
    _taskSubtitleController.clear();
    Color selectedColor = const Color(0xFF4E8DF5);
    IconData selectedIcon = Icons.task_alt_rounded;

    final taskColors = [
      const Color(0xFF4E8DF5),
      const Color(0xFFFF7A00),
      const Color(0xFF27B3A2),
      const Color(0xFFFF6B6B),
    ];

    final taskIcons = [
      Icons.task_alt_rounded,
      Icons.assignment_rounded,
      Icons.schedule_rounded,
      Icons.campaign_rounded,
    ];

    showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text("Yapilacak Ekle"),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _taskTitleController,
                      decoration: const InputDecoration(
                        labelText: "Baslik",
                        hintText: "Örnek: 11-A quiz sonucunu kontrol et",
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _taskSubtitleController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: "Açıklama",
                        hintText: "Bu görevin neden eklendigini yazın",
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "Renk",
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      children: taskColors.map((color) {
                        final selected = selectedColor == color;
                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            setDialogState(() {
                              selectedColor = color;
                            });
                          },
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              border: selected
                                  ? Border.all(color: Colors.black, width: 2)
                                  : null,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "Ikon",
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: taskIcons.map((icon) {
                        final selected = selectedIcon == icon;
                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            setDialogState(() {
                              selectedIcon = icon;
                            });
                          },
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: selectedColor.withValues(
                                alpha: selected ? 0.22 : 0.12,
                              ),
                              borderRadius: BorderRadius.circular(14),
                              border: selected
                                  ? Border.all(color: selectedColor, width: 1.5)
                                  : null,
                            ),
                            child: Icon(icon, color: selectedColor),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Vazgec"),
                ),
                ElevatedButton(
                  onPressed: () {
                    final title = _taskTitleController.text.trim();
                    final subtitle = _taskSubtitleController.text.trim();

                    if (title.isEmpty || subtitle.isEmpty) {
                      _showInfo("Baslik ve açıklama zorunlu.");
                      return;
                    }

                    setState(() {
                      _manualTasks.insert(0, {
                        "title": title,
                        "subtitle": subtitle,
                        "icon": selectedIcon,
                        "color": selectedColor,
                        "action": "Isaretle",
                        "page": null,
                      });
                    });

                    Navigator.pop(context);
                    _showInfo("Yeni yapılacak görev eklendi.");
                  },
                  child: const Text("Ekle"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final hasSidebar = SidebarState.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: hasSidebar
          ? null
          : TeacherHeader(
              title: "Ana Sayfa",
              teacherName: _teacherName,
              subtitle: _teacherSubtitle,
              onNotificationTap: _openNotificationsSheet,
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openQuickCreateMenu,
        backgroundColor: const Color(0xFFFF7A00),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text("Hızlı İşlem"),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _heroCard(theme, isDark),
              const SizedBox(height: 18),
              _sectionHeader(theme, title: "Hızlı İşlemler", actionText: ""),
              const SizedBox(height: 12),
              _quickActions(context),
              const SizedBox(height: 18),
              _filterRow(theme),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Bugün Yapılacaklar",
                actionText: "Ekle",
                onActionTap: _openAddTaskDialog,
              ),
              const SizedBox(height: 12),
              ...tasks.map((item) => _taskCard(theme, isDark, item)),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Akıllı Bildirimler",
                actionText: "Tümünü Gör",
                onActionTap: _openNotificationsSheet,
              ),
              const SizedBox(height: 12),
              _notificationsPanel(theme, isDark),
              const SizedBox(height: 18),
              _sectionHeader(theme, title: "Riskli Öğrenciler", actionText: ""),
              const SizedBox(height: 12),
              ...riskyStudents.map(
                (item) => _riskStudentCard(theme, isDark, item),
              ),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Sınıf Karşılaştırma",
                actionText: "",
              ),
              const SizedBox(height: 12),
              _classComparisonCard(theme, isDark),
              const SizedBox(height: 18),
              _sectionHeader(theme, title: "Akıllı Öneriler", actionText: ""),
              const SizedBox(height: 12),
              ...suggestions.map(
                (item) => _suggestionCard(theme, isDark, item),
              ),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Canlı Ders Sonrası Özet",
                actionText: "",
              ),
              const SizedBox(height: 12),
              _liveSummaryCard(theme, isDark),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Ders Programım",
                actionText: "Takvimi Aç",
                onActionTap: () {
                  _openPage(const TeacherSchedulePage());
                },
              ),
              const SizedBox(height: 12),
              _scheduleCard(theme, isDark),
              const SizedBox(height: 18),
              _sectionHeader(
                theme,
                title: "Duyurular",
                actionText: "Tümünü Gör",
                onActionTap: () {
                  _openPage(const TeacherAnnouncementsPage());
                },
              ),
              const SizedBox(height: 12),
              _announcementsCard(theme, isDark),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
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
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.space_dashboard_rounded,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              FilledButton.tonalIcon(
                onPressed: () => _openPage(const TeacherReportsPage()),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.bar_chart_rounded),
                label: const Text("Paneli Ac"),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            "Öğretmen operasyon merkezi",
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "$selectedFilter odakli görevler, riskli öğrenciler, sınıf karşılaştırmaları ve aksiyon önerileri tek ekranda.",
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth > 640;
              final statCards = [
                _heroStat("Bugünku Ders", "${scheduleItems.length}"),
                _heroStat("Akıllı Uyari", "${notifications.length}"),
                _heroStat("Riskli Öğrenci", "${riskyStudents.length}"),
              ];

              if (wide) {
                return Row(
                  children: [
                    for (var i = 0; i < statCards.length; i++) ...[
                      Expanded(child: statCards[i]),
                      if (i != statCards.length - 1) const SizedBox(width: 10),
                    ],
                  ],
                );
              }

              return Column(
                children: [
                  statCards[0],
                  const SizedBox(height: 10),
                  statCards[1],
                  const SizedBox(height: 10),
                  statCards[2],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String title, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.86),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterRow(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: dashboardFilters.map((item) {
                final selected = selectedFilter == item;
                return Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: ChoiceChip(
                    label: Text(item),
                    selected: selected,
                    onSelected: (_) {
                      setState(() {
                        selectedFilter = item;
                      });
                    },
                    selectedColor: const Color(0xFFFF7A00),
                    backgroundColor: theme.cardColor,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : null,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(width: 10),
        IconButton.filledTonal(
          onPressed: _openGlobalFilter,
          icon: const Icon(Icons.tune_rounded),
        ),
      ],
    );
  }

  Widget _taskCard(ThemeData theme, bool isDark, Map<String, dynamic> item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: (item["color"] as Color).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              item["icon"] as IconData,
              color: item["color"] as Color,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item["title"] as String,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  item["subtitle"] as String,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.textTheme.bodyMedium?.color?.withValues(
                      alpha: 0.72,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          FilledButton(
            onPressed: () {
              final page = item["page"] as Widget?;
              if (page != null) {
                _openPage(page);
              } else {
                _showInfo("Risk listesi bu ekranda aşağıda gosteriliyor.");
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: item["color"] as Color,
              foregroundColor: Colors.white,
            ),
            child: Text(item["action"] as String),
          ),
        ],
      ),
    );
  }

  Widget _notificationsPanel(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Column(
        children: notifications
            .map(
              (item) => Column(
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: (item["color"] as Color).withValues(
                        alpha: 0.14,
                      ),
                      foregroundColor: item["color"] as Color,
                      child: Icon(item["icon"] as IconData),
                    ),
                    title: Text(
                      item["title"] as String,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(item["subtitle"] as String),
                    trailing: Text(item["time"] as String),
                    onTap: () => _showNotificationDetail(item),
                  ),
                  if (item != notifications.last)
                    Divider(color: theme.dividerColor.withValues(alpha: 0.5)),
                ],
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _riskStudentCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(
                  0xFFFF6B6B,
                ).withValues(alpha: 0.14),
                foregroundColor: const Color(0xFFFF6B6B),
                child: Text((item["name"] as String)[0]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item["name"] as String,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${item["className"]} • Eksik görev: ${item["missing"]}",
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
                  color: const Color(0xFFFF6B6B).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  "${item["score"]}",
                  style: const TextStyle(
                    color: Color(0xFFFF6B6B),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            item["reason"] as String,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.74),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metricBox(
                  theme,
                  title: "Devam",
                  value: "%${item["attendance"]}",
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricBox(
                  theme,
                  title: "Başarı",
                  value: "${item["score"]}",
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricBox(
                  theme,
                  title: "Eksik",
                  value: "${item["missing"]}",
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    _openPage(TeacherChatPage(user: '${item["name"]} Velisi'));
                  },
                  child: const Text("Veliye Yaz"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    _openPage(const StudentStudyPlanPage());
                    _showInfo(
                      "${item["name"]} için çalışma planı taslağı açıldı.",
                    );
                  },
                  child: const Text("Planla"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metricBox(
    ThemeData theme, {
    required String title,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(title),
        ],
      ),
    );
  }

  Widget _classComparisonCard(ThemeData theme, bool isDark) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: _showClassComparisonDetail,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(24),
          boxShadow: _shadow(isDark),
        ),
        child: Column(
          children: classComparison.map((item) {
            final color = item["color"] as Color;
            final average = item["average"] as int;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item["name"] as String,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text("%$average"),
                      const SizedBox(width: 8),
                      Text(
                        item["trend"] as String,
                        style: TextStyle(
                          color: (item["trend"] as String).startsWith("+")
                              ? const Color(0xFF27B3A2)
                              : const Color(0xFFFF6B6B),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _fillBar(theme, value: average, color: color),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _suggestionCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: (item["color"] as Color).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              item["icon"] as IconData,
              color: item["color"] as Color,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item["title"] as String,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(item["subtitle"] as String),
              ],
            ),
          ),
          const SizedBox(width: 12),
          TextButton(
            onPressed: () {
              final action = item["action"] as String;
              if (action == "Sinavlara Git") {
                _openPage(const TeacherExamsPage());
              } else if (action == "Plani Ac") {
                _openPage(const StudentStudyPlanPage());
              } else if (action == "Taslagi Göster") {
                _openPage(TeacherChatPage(user: 'Veli Bilgilendirme Hattı'));
              } else {
                _showInfo("$action aksiyonu başlatıldı.");
              }
            },
            child: Text(item["action"] as String),
          ),
        ],
      ),
    );
  }

  void _showNotificationDetail(Map<String, dynamic> item) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item["title"] as String),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item["subtitle"] as String),
            const SizedBox(height: 12),
            Text('Zaman: ${item["time"]}'),
            const SizedBox(height: 8),
            const Text(
              'Bu kayıt, sınıf performansı, veli geri bildirimi ve katılım hareketlerine göre akıllı olarak oluşturuldu.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  void _showClassComparisonDetail() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          shrinkWrap: true,
          children: [
            Text(
              'Sınıf Karsilastirma Detayi',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            const Text(
              'Ortalama, trend ve risk seviyeleri birlikte listelenir.',
            ),
            const SizedBox(height: 16),
            ...classComparison.map(
              (item) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: (item["color"] as Color).withValues(
                    alpha: 0.14,
                  ),
                  foregroundColor: item["color"] as Color,
                  child: Text(item["name"] as String),
                ),
                title: Text('%${item["average"]} ortalama'),
                subtitle: Text(
                  'Trend ${item["trend"]} • Kazanim analizi hazır',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _liveSummaryCard(ThemeData theme, bool isDark) {
    final currentLesson = scheduleItems.isNotEmpty ? scheduleItems.first : null;
    final liveTitle =
        currentLesson?["subtitle"] as String? ?? 'Canlı ders özeti bekleniyor';
    final attendanceCount = AttendanceService.instance.all().length;
    final riskCount = riskyStudents.length;
    final questionCount = classComparison.fold<int>(
      0,
      (sum, item) => sum + (((item["average"] as int?) ?? 0) > 0 ? 1 : 0),
    );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: const Color(0xFF4E8DF5).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.play_circle_outline_rounded,
                  color: Color(0xFF4E8DF5),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  liveTitle,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              OutlinedButton(
                onPressed: () => _openPage(const TeacherLiveLessonsPage()),
                child: const Text("Ac"),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            currentLesson == null
                ? "Henüz canlı ders özeti oluşmadı. Yeni dersler planlandıkça burada güncel özet görünecek."
                : "Bugünkü canlı ders akışına göre yoklama, sınıf karşılaştırması ve riskli öğrenci sinyalleri birlikte izleniyor.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.74),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _SummaryChip(label: "$attendanceCount yoklama kaydı"),
              _SummaryChip(label: "$questionCount sınıf özeti"),
              _SummaryChip(label: "$riskCount riskli öğrenci"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _scheduleCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Column(
        children: scheduleItems.isEmpty
            ? [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: theme.scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.event_busy_rounded),
                  ),
                  title: const Text("Bugün planli canlı ders görünmüyor"),
                  subtitle: Text(
                    _loadingDashboard
                        ? "Takvim verisi yükleniyor."
                        : "Canlı dersler oluşturuldugünda burada listelenecek.",
                  ),
                  trailing: TextButton(
                    onPressed: () => _openPage(const TeacherSchedulePage()),
                    child: const Text("Takvim"),
                  ),
                ),
              ]
            : scheduleItems.map((item) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: theme.scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      item["time"] as String,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  title: Text(
                    item["title"] as String,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(item["subtitle"] as String),
                  trailing: TextButton(
                    onPressed: () => _openPage(const TeacherSchedulePage()),
                    child: Text(item["status"] as String),
                  ),
                );
              }).toList(),
      ),
    );
  }

  Widget _sectionHeader(
    ThemeData theme, {
    required String title,
    required String actionText,
    VoidCallback? onActionTap,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (actionText.isNotEmpty)
          TextButton(onPressed: onActionTap ?? () {}, child: Text(actionText)),
      ],
    );
  }

  Widget _announcementsCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: _shadow(isDark),
      ),
      child: Column(
        children: [
          _announcementItem(
            theme,
            icon: Icons.campaign_rounded,
            color: const Color(0xFFFFB020),
            title: "Yarin zumre toplantisi var",
            subtitle: "Saat 14:30'da öğretmenler odasında yapılacak.",
          ),
          _divider(theme),
          _announcementItem(
            theme,
            icon: Icons.videocam_rounded,
            color: const Color(0xFF4E8DF5),
            title: "Canlı ders bağlantılari güncellendi",
            subtitle: "Yeni bağlantılar ders sayfasina eklendi.",
          ),
          _divider(theme),
          _announcementItem(
            theme,
            icon: Icons.assignment_turned_in_rounded,
            color: const Color(0xFF69C36D),
            title: "Haftalık rapor teslim günu",
            subtitle: "Cuma 17:00'ye kadar sistemden yüklenmeli.",
          ),
        ],
      ),
    );
  }

  Widget _announcementItem(
    ThemeData theme, {
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.72,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickActions(BuildContext context) {
    final actions = [
      {
        "icon": Icons.videocam_rounded,
        "title": "Canlı\nDersler",
        "color": Colors.redAccent,
        "page": const TeacherLiveLessonsPage(),
      },
      {
        "icon": Icons.assignment_rounded,
        "title": "Ödevler",
        "color": Colors.orange,
        "page": const TeacherAssignmentsPage(),
      },
      {
        "icon": Icons.fact_check_rounded,
        "title": "Sınavlar",
        "color": Colors.green,
        "page": const TeacherExamsPage(),
      },
      {
        "icon": Icons.message_rounded,
        "title": "Mesajlar",
        "color": Colors.blue,
        "page": const TeacherMessagesPage(),
      },
      {
        "icon": Icons.folder_copy_rounded,
        "title": "İçerik\nYönetimi",
        "color": const Color(0xFF2563EB),
        "page": const TeacherContentPage(),
      },
      {
        "icon": Icons.analytics_rounded,
        "title": "Raporlar",
        "color": Colors.purple,
        "page": const TeacherReportsPage(),
      },
      {
        "icon": Icons.how_to_reg_rounded,
        "title": "Yoklama",
        "color": const Color(0xFF0EA5A4),
        "page": const TeacherAttendancePage(),
      },
      {
        "icon": Icons.live_help_rounded,
        "title": "Soru\nKutusu",
        "color": const Color(0xFF0891B2),
        "page": const QuestionBoxPage(),
      },
      {
        "icon": Icons.help_center_rounded,
        "title": "Soru\nBankasi",
        "color": const Color(0xFFFF6B6B),
        "page": const TeacherQuestionBankPage(),
      },
      {
        "icon": Icons.groups_2_rounded,
        "title": "Görüşme\nOnaylari",
        "color": const Color(0xFF7C3AED),
        "page": const TeacherMeetingApprovalsPage(),
      },
    ];

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: actions
          .map(
            (item) => _quickActionCard(
              context,
              icon: item["icon"] as IconData,
              title: item["title"] as String,
              color: item["color"] as Color,
              page: item["page"] as Widget,
            ),
          )
          .toList(),
    );
  }

  Widget _quickActionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required Widget page,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _openPage(page),
      child: Container(
        width: 112,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            colors: [color.withValues(alpha: 0.76), color],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 30),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sheetAction({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFFF7A00).withValues(alpha: 0.14),
        foregroundColor: const Color(0xFFFF7A00),
        child: Icon(icon),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      onTap: onTap,
    );
  }

  Widget _divider(ThemeData theme) {
    return Divider(height: 1, color: theme.dividerColor.withValues(alpha: 0.5));
  }

  Widget _fillBar(ThemeData theme, {required int value, required Color color}) {
    final safeValue = value.clamp(0, 100) / 100;

    return Container(
      height: 10,
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
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
          ),
        ),
      ),
    );
  }

  List<BoxShadow> _shadow(bool isDark) {
    return [
      BoxShadow(
        color: isDark
            ? Colors.black.withValues(alpha: 0.22)
            : Colors.black.withValues(alpha: 0.05),
        blurRadius: 16,
        offset: const Offset(0, 8),
      ),
    ];
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;

  const _SummaryChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}
