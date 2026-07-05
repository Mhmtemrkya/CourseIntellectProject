import 'dart:async';
import 'package:student/i18n/app_locale.dart';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/attendance_api_service.dart';
import 'package:student/services/attendance_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherAttendancePage extends StatefulWidget {
  final String? initialLessonTitle;

  const TeacherAttendancePage({super.key, this.initialLessonTitle});

  @override
  State<TeacherAttendancePage> createState() => _TeacherAttendancePageState();
}

class _TeacherAttendancePageState extends State<TeacherAttendancePage> {
  int selectedLesson = 0;
  int selectedTab = 0;
  Timer? qrTimer;
  Timer? countdownTimer;
  int qrRemainingSeconds = 0;
  String qrPayload = '';
  String _teacherName = '';
  bool _loadingLessons = true;
  bool _savingAttendance = false;
  Map<String, dynamic>? _qrSession;
  DateTime? _qrExpiresAt;
  bool _openingQrSession = false;

  List<Map<String, dynamic>> lessons = [];

  final Map<String, List<Map<String, dynamic>>> lessonStudents = {};

  List<Map<String, dynamic>> get students {
    if (lessons.isEmpty) return const [];
    final className = lessons[selectedLesson]["className"] as String;
    return lessonStudents[className] ?? const [];
  }

  bool get _attendanceAlreadyTaken {
    if (lessons.isEmpty) return false;
    final lesson = lessons[selectedLesson];
    final className = lesson["className"] as String;
    final lessonTitle = lesson["title"] as String;
    final today = DateTime.now();
    return AttendanceService.instance.all().any((record) {
      return record.className == className &&
          record.lesson == lessonTitle &&
          record.date.year == today.year &&
          record.date.month == today.month &&
          record.date.day == today.day;
    });
  }

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    await StudentRegistryStore.instance.ensureLoaded();
    await AttendanceService.instance.ensureLoaded();
    final session = await AuthSessionStore.instance.load();
    final allStudents = StudentRegistryStore.instance.students;
    final liveLessons = await SchoolFeedApiService.instance.fetchLiveLessons();
    final teacherLessons = liveLessons.where((lesson) {
      if (session == null) return true;
      final lessonTeacher = _normalizeText(lesson.teacher);
      final fullName = _normalizeText(session.fullName);
      final username = _normalizeText(session.username);
      return lessonTeacher.contains(fullName) ||
          fullName.contains(lessonTeacher) ||
          lessonTeacher.contains(username);
    }).toList();

    final builtLessons = teacherLessons.map((lesson) {
      return {
        "id": lesson.id,
        "title": lesson.title,
        "time": lesson.startsAt == null
            ? lesson.platform
            : '${lesson.timeLabel} • ${lesson.platform}',
        "className": lesson.className,
        "mode": lesson.platform.toLowerCase().contains('online')
            ? 'Online'
            : 'Sınıf İçi',
      };
    }).toList();

    lessonStudents.clear();
    for (final lesson in builtLessons) {
      final className = lesson["className"] as String;
      final lessonTitle = lesson["title"] as String;
      final existingRecords = AttendanceService.instance
          .all()
          .where(
            (record) =>
                record.className == className && record.lesson == lessonTitle,
          )
          .toList();
      final classStudents =
          allStudents
              .where((student) => student.className == className)
              .toList()
            ..sort((a, b) => a.fullName.compareTo(b.fullName));

      lessonStudents[className] = classStudents.asMap().entries.map((entry) {
        final student = entry.value;
        final latestRecord = existingRecords
            .where(
              (record) =>
                  _normalizeText(record.studentName) ==
                  _normalizeText(student.fullName),
            )
            .fold<AttendanceRecord?>(null, (previous, current) {
              if (previous == null) return current;
              return current.date.isAfter(previous.date) ? current : previous;
            });
        return {
          "no": student.schoolNumber.isNotEmpty
              ? student.schoolNumber
              : (entry.key + 1).toString().padLeft(3, '0'),
          "name": student.fullName,
          "status": _attendanceStatusToUi(latestRecord?.status),
        };
      }).toList();
    }

    var resolvedSelectedLesson = 0;
    if (widget.initialLessonTitle != null && builtLessons.isNotEmpty) {
      final initialIndex = builtLessons.indexWhere(
        (lesson) => lesson["title"] == widget.initialLessonTitle,
      );
      if (initialIndex >= 0) {
        resolvedSelectedLesson = initialIndex;
      }
    }
    if (!mounted) return;
    setState(() {
      _teacherName = session?.fullName ?? _teacherName;
      lessons = builtLessons;
      selectedLesson = resolvedSelectedLesson.clamp(
        0,
        builtLessons.isEmpty ? 0 : builtLessons.length - 1,
      );
      _loadingLessons = false;
    });
    if (lessons.isNotEmpty) {
      await _openQrSession(silent: true);
    }
  }

  @override
  void dispose() {
    qrTimer?.cancel();
    countdownTimer?.cancel();
    super.dispose();
  }

  /// Seçili ders için backend'de QR yoklama oturumu açar ve QR içeriğini
  /// desktop ile aynı formatta (token'lı JSON) üretir.
  Future<void> _openQrSession({bool silent = false}) async {
    if (lessons.isEmpty || _openingQrSession) return;
    final lesson = lessons[selectedLesson];
    final className = lesson["className"] as String;
    final lessonTitle = lesson["title"] as String;

    setState(() => _openingQrSession = true);
    try {
      final created = await AttendanceApiService.instance.openQrSession(
        className: className,
        lessonTitle: lessonTitle,
        durationMinutes: 30,
      );
      if (!mounted) return;
      setState(() {
        _qrSession = created;
        _qrExpiresAt = DateTime.tryParse(
          created['expiresAtUtc']?.toString() ?? '',
        );
        qrPayload = jsonEncode({
          'token': created['token'],
          'className': className,
          'lesson': lessonTitle,
        });
      });
      _startCountdown();
      if (!silent) _showInfo('QR yoklama oturumu açıldı.');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _qrSession = null;
        _qrExpiresAt = null;
        qrPayload = '';
      });
      if (!silent) _showInfo(error.toString());
    } finally {
      if (mounted) setState(() => _openingQrSession = false);
    }
  }

  void _startCountdown() {
    countdownTimer?.cancel();
    qrRemainingSeconds = _remainingSessionSeconds();
    countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final remaining = _remainingSessionSeconds();
      if (remaining == qrRemainingSeconds) return;
      setState(() => qrRemainingSeconds = remaining);
    });
  }

  int _remainingSessionSeconds() {
    final expires = _qrExpiresAt;
    if (expires == null) return 0;
    final diff = expires.difference(DateTime.now().toUtc()).inSeconds;
    return diff < 0 ? 0 : diff;
  }

  /// QR ile katılan öğrencileri backend oturumundan çekip listede
  /// "geldi" olarak işaretler (desktop'taki akışla aynı).
  Future<void> _applyQrScans() async {
    final sessionId = _qrSession?['id']?.toString();
    if (sessionId == null || lessons.isEmpty) {
      _showInfo('Önce QR oturumu açmalısın.');
      return;
    }
    if (_attendanceAlreadyTaken) {
      _showInfo('Bugünün yoklaması zaten kaydedilmiş.');
      return;
    }
    try {
      final className = lessons[selectedLesson]["className"] as String;
      final sessions = await AttendanceApiService.instance.fetchQrSessions(
        className: className,
      );
      final current = sessions.firstWhere(
        (item) => item['id']?.toString() == sessionId,
        orElse: () => const {},
      );
      final scanned = (current['scannedStudents'] as List<dynamic>? ?? [])
          .map(
            (item) =>
                _normalizeText((item as Map)['studentName']?.toString() ?? ''),
          )
          .where((item) => item.isNotEmpty)
          .toSet();
      if (scanned.isEmpty) {
        _showInfo('Henüz QR ile katılan öğrenci yok.');
        return;
      }
      var matched = 0;
      setState(() {
        for (final student in students) {
          if (scanned.contains(_normalizeText(student['name'] as String))) {
            student['status'] = 'present';
            matched++;
          }
        }
      });
      _showInfo('$matched öğrenci QR katılımıyla "geldi" olarak işaretlendi.');
    } catch (error) {
      _showInfo(error.toString());
    }
  }

  void _selectLesson(int index) {
    if (lessons.isEmpty) return;
    setState(() {
      selectedLesson = index;
      _qrSession = null;
      _qrExpiresAt = null;
      qrPayload = '';
    });
    _openQrSession(silent: true);
  }

  void _setStudentStatus(int index, String status) {
    if (students.isEmpty || _attendanceAlreadyTaken) return;
    setState(() {
      students[index]["status"] = status;
    });
  }

  void _markAllPresent() {
    if (students.isEmpty || _attendanceAlreadyTaken) return;
    setState(() {
      for (final student in students) {
        student["status"] = "present";
      }
    });
    _showInfo("Tüm öğrenciler geldi olarak işaretlendi.");
  }

  void _showInfo(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final present = students.where((e) => e["status"] == "present").length;
    final absent = students.where((e) => e["status"] == "absent").length;
    final late = students.where((e) => e["status"] == "late").length;
    final excuse = students.where((e) => e["status"] == "excuse").length;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Yoklama",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: lessons.isEmpty
            ? "Yoklama Takibi"
            : '${lessons[selectedLesson]["className"]} Yoklama Takibi',
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_loadingLessons)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: LinearProgressIndicator(),
              ),
            _topCard(theme, isDark),
            const SizedBox(height: 20),
            if (lessons.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Text(
                  'Öğretmene atanmış sınıf veya yoklama dersi bulunmuyor.'.tr,
                ),
              )
            else ...[
              _sectionTitle(
                theme,
                "Ders Seçimi",
                "Yoklama alınacak dersi seçin",
              ),
              const SizedBox(height: 12),
              _lessonStrip(theme),
              const SizedBox(height: 20),
              _sectionTabs(theme),
              const SizedBox(height: 16),
              if (selectedTab == 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _counter(
                      theme,
                      "✔",
                      present.toString(),
                      "Geldi",
                      Colors.green,
                    ),
                    _counter(
                      theme,
                      "✖",
                      absent.toString(),
                      "Gelmedi",
                      Colors.red,
                    ),
                    _counter(theme, "⏰", late.toString(), "Geç", Colors.orange),
                    _counter(
                      theme,
                      "!",
                      excuse.toString(),
                      "İzinli",
                      Colors.blue,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        "Öğrenci Listesi - ${lessons[selectedLesson]["title"]}",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _attendanceAlreadyTaken
                          ? null
                          : _markAllPresent,
                      icon: const Icon(Icons.done_all_rounded),
                      label: Text("Tümünü Geldi".tr),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Column(
                  children: students
                      .asMap()
                      .entries
                      .map((e) => _studentTile(theme, e.key, e.value, isDark))
                      .toList(),
                ),
              ] else ...[
                _qrAttendanceCard(theme, isDark),
                const SizedBox(height: 16),
                _qrInfoPanel(theme, isDark),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: (_savingAttendance || _attendanceAlreadyTaken)
                      ? null
                      : _saveAttendance,
                  icon: const Icon(Icons.save_rounded),
                  label: Text(
                    _attendanceAlreadyTaken
                        ? "Yoklama Alindi"
                        : _savingAttendance
                        ? "Kaydediliyor..."
                        : "Yoklamayi Kaydet",
                  ),
                ),
              ),
              if (_attendanceAlreadyTaken) ...[
                const SizedBox(height: 10),
                Text(
                  'Bu dersin yoklaması daha önce kaydedildi. Aynı ders için ikinci kez yoklama alınmaz.'.tr,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.72,
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _topCard(ThemeData theme, bool isDark) {
    final currentLesson = lessons.isEmpty
        ? {"title": "Yükleniyor", "time": "-", "mode": "-"}
        : lessons[selectedLesson];
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Seçili Ders".tr),
                const SizedBox(height: 4),
                Text(
                  currentLesson["title"] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  currentLesson["time"] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Row(
            children: [
              MiniStat("${lessons.length}", "Toplam\nDers"),
              const SizedBox(width: 12),
              MiniStat(
                "${lessons.where((item) => item["mode"] == "Online").length}",
                "Online",
              ),
              const SizedBox(width: 12),
              MiniStat("${students.length}", "Öğrenci"),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _saveAttendance() async {
    if (lessons.isEmpty || _savingAttendance) return;
    final lesson = lessons[selectedLesson];
    final className = lesson["className"] as String;
    final lessonTitle = lesson["title"] as String;
    setState(() {
      _savingAttendance = true;
    });

    try {
      await AttendanceService.instance.saveLessonAttendance(
        className: className,
        lesson: lessonTitle,
        students: students,
      );

      try {
        final document = pw.Document();
        document.addPage(
          pw.MultiPage(
            build: (_) => [
              pw.Text(
                'Yoklama Özeti'.tr,
                style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Text('$lessonTitle • $className'),
              pw.SizedBox(height: 16),
              pw.TableHelper.fromTextArray(
                headers: const ['No', 'Ad Soyad', 'Durum'],
                data: students
                    .map(
                      (student) => [
                        student['no']?.toString() ?? '-',
                        student['name']?.toString() ?? '-',
                        _pdfStatusLabel(
                          student['status'] as String? ?? 'present',
                        ),
                      ],
                    )
                    .toList(),
              ),
            ],
          ),
        );

        final directory = await getTemporaryDirectory();
        final file = File(
          '${directory.path}/yoklama_${DateTime.now().millisecondsSinceEpoch}.pdf',
        );
        await file.writeAsBytes(await document.save());
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(file.path)],
            text: '$lessonTitle yoklama raporu',
          ),
        );
      } catch (_) {
        // PDF/share yardımcı akışı başarısız olsa bile yoklama kaydı korunur.
      }

      if (!mounted) return;
      _showInfo("Yoklama kaydedildi.");
    } catch (_) {
      if (!mounted) return;
      _showInfo("Yoklama kaydedilemedi.");
    } finally {
      if (mounted) {
        setState(() {
          _savingAttendance = false;
        });
      }
    }
  }

  String _pdfStatusLabel(String value) {
    switch (value) {
      case 'present':
        return 'Katildi';
      case 'late':
        return 'Gec';
      case 'excuse':
        return 'Izinli';
      default:
        return 'Devamsiz';
    }
  }

  String _attendanceStatusToUi(String? value) {
    switch (_normalizeText(value ?? '')) {
      case 'present':
      case 'katıldı':
      case 'geldi':
        return 'present';
      case 'late':
      case 'gec':
        return 'late';
      case 'excuse':
      case 'izinli':
        return 'excuse';
      default:
        return 'absent';
    }
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

  Widget _sectionTitle(ThemeData theme, String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  Widget _lessonStrip(ThemeData theme) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: lessons.asMap().entries.map((entry) {
          final index = entry.key;
          final lesson = entry.value;
          final selected = selectedLesson == index;

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _selectLesson(index),
            child: Container(
              width: 180,
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: selected
                    ? theme.colorScheme.primary.withValues(alpha: 0.10)
                    : theme.cardColor,
                border: Border.all(
                  color: selected
                      ? theme.colorScheme.primary
                      : theme.dividerColor,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson["title"] as String,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lesson["time"] as String,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color:
                          (lesson["mode"] == "Online"
                                  ? const Color(0xFF7C3AED)
                                  : const Color(0xFF2563EB))
                              .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      lesson["mode"] as String,
                      style: TextStyle(
                        color: lesson["mode"] == "Online"
                            ? const Color(0xFF7C3AED)
                            : const Color(0xFF2563EB),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _sectionTabs(ThemeData theme) {
    final tabs = ["Manuel Yoklama", "QR Yoklama"];
    return Row(
      children: List.generate(tabs.length, (index) {
        final selected = selectedTab == index;
        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
              if (index == 1 && qrPayload.isEmpty) {
                _openQrSession(silent: true);
              }
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: EdgeInsets.only(right: index == 0 ? 8 : 0),
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(
                  tabs[index],
                  style: TextStyle(
                    color: selected
                        ? Colors.white
                        : theme.textTheme.bodyLarge?.color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _counter(
    ThemeData theme,
    String icon,
    String value,
    String label,
    Color color,
  ) {
    return Column(
      children: [
        CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.2),
          child: Text(icon, style: TextStyle(color: color, fontSize: 18)),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(label),
      ],
    );
  }

  Widget _studentTile(
    ThemeData theme,
    int index,
    Map<String, dynamic> student,
    bool isDark,
  ) {
    final status = student["status"] as String;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.14)
                : Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(child: Text((student["name"] as String)[0])),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "${student["no"]}  ${student["name"]}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  _statusLabel(status),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: _statusColor(status),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          _statusIconButton(
            selected: status == "present",
            icon: Icons.check_circle,
            color: Colors.green,
            tooltip: 'Geldi',
            onTap: () => _setStudentStatus(index, "present"),
          ),
          _statusIconButton(
            selected: status == "absent",
            icon: Icons.cancel,
            color: Colors.red,
            tooltip: 'Gelmedi',
            onTap: () => _setStudentStatus(index, "absent"),
          ),
          _statusIconButton(
            selected: status == "late",
            icon: Icons.access_time,
            color: Colors.orange,
            tooltip: 'Geç'.tr,
            onTap: () => _setStudentStatus(index, "late"),
          ),
          _statusIconButton(
            selected: status == "excuse",
            icon: Icons.info_rounded,
            color: Colors.blue,
            tooltip: 'İzinli'.tr,
            onTap: () => _setStudentStatus(index, "excuse"),
          ),
        ],
      ),
    );
  }

  /// Dar ekranlarda satırın taşmaması için kompakt durum butonu.
  Widget _statusIconButton({
    required bool selected,
    required IconData icon,
    required Color color,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.14) : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 21, color: selected ? color : Colors.grey),
        ),
      ),
    );
  }

  Widget _qrAttendanceCard(ThemeData theme, bool isDark) {
    final lesson = lessons[selectedLesson];
    const sessionSeconds = 30 * 60;
    final progress = (qrRemainingSeconds / sessionSeconds).clamp(0.0, 1.0);
    final remainingLabel =
        '${(qrRemainingSeconds ~/ 60).toString().padLeft(2, '0')}:${(qrRemainingSeconds % 60).toString().padLeft(2, '0')}';
    final hasSession = qrPayload.isNotEmpty && qrRemainingSeconds > 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Dinamik QR Yoklama",
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${lesson["title"]} • ${lesson["className"]}",
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.textTheme.bodyMedium?.color?.withValues(
                          alpha: 0.72,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: _openingQrSession ? null : () => _openQrSession(),
                icon: _openingQrSession
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh_rounded),
                label: const Text("Yenile"),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (hasSession)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(24),
              ),
              child: QrImageView(
                data: qrPayload,
                version: QrVersions.auto,
                size: 220,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: Colors.black,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: Colors.black,
                ),
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.qr_code_2_rounded,
                    size: 48,
                    color: theme.textTheme.bodySmall?.color,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _openingQrSession
                        ? 'QR oturumu açılıyor...'
                        : 'QR oturumu kapalı veya süresi doldu. "Yenile" ile yeni oturum aç.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: Text(
                  hasSession
                      ? "QR oturumu $remainingLabel boyunca geçerli"
                      : "QR oturumu aktif değil",
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                "%${(progress * 100).round()}",
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: theme.dividerColor.withValues(alpha: 0.2),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: hasSession ? _applyQrScans : null,
              icon: const Icon(Icons.fact_check_outlined),
              label: Text('QR Katılımlarını Listeye İşle'.tr),
            ),
          ),
        ],
      ),
    );
  }

  Widget _qrInfoPanel(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.16)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "QR ile yoklama nasil calisir?",
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          SizedBox(height: 10),
          Text("1. Öğretmen QR kodu sınıfa veya ekrana yansıtır.".tr),
          SizedBox(height: 6),
          Text("2. Öğrenciler uygulamadan QR kodu okutarak yoklama gönderir.".tr),
          SizedBox(height: 6),
          Text(
            "3. Kod her 60 saniyede değişir, bu sayede eski kodlar kullanılamaz.".tr,
          ),
          SizedBox(height: 6),
          Text(
            "4. Geç gelen öğrenciler için yeni QR ile katılım yeniden alınabilir.".tr,
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case "present":
        return Colors.green;
      case "absent":
        return Colors.red;
      case "late":
        return Colors.orange;
      case "excuse":
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case "present":
        return "Geldi";
      case "absent":
        return "Gelmedi";
      case "late":
        return "Gec";
      case "excuse":
        return "Izinli";
      default:
        return "-";
    }
  }
}

class MiniStat extends StatelessWidget {
  final String value;
  final String label;

  const MiniStat(this.value, this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Text(
          value,
          textAlign: TextAlign.center,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }
}
