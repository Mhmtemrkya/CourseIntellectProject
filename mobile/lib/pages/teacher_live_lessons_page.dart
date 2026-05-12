import 'package:flutter/material.dart';
import 'package:student/pages/teacher_create_live_lesson_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/responsive_overlays.dart';
import 'package:student/widgets/teacher_header.dart';
import 'package:url_launcher/url_launcher.dart';

class TeacherLiveLessonsPage extends StatefulWidget {
  const TeacherLiveLessonsPage({super.key});

  @override
  State<TeacherLiveLessonsPage> createState() => _TeacherLiveLessonsPageState();
}

class _TeacherLiveLessonsPageState extends State<TeacherLiveLessonsPage> {
  String _teacherName = '';
  List<LiveLessonRecord> lessons = const [];
  bool _isLoading = true;
  String? _errorMessage;

  Future<void> _openMeeting(BuildContext context, String url) async {
    final uri = Uri.parse(url);

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Canlı ders bağlantısı açılamadı.")),
      );
    }
  }

  Future<void> _deleteLesson(
    BuildContext context,
    LiveLessonRecord lesson,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Canlı Dersi Sil'),
        content: Text('"${lesson.title}" silinsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await SchoolFeedApiService.instance.deleteLiveLesson(lesson.id);
      await _loadLessons();
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Canlı ders silindi')),
      );
    } on SchoolFeedApiException catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  void initState() {
    super.initState();
    _initializePage();
  }

  Future<void> _initializePage() async {
    final session = await AuthSessionStore.instance.load();
    if (mounted && session != null) {
      setState(() => _teacherName = session.fullName);
    }
    await _loadLessons();
  }

  Future<void> _loadLessons() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final allLessons = await SchoolFeedApiService.instance.fetchLiveLessons();
      final filteredLessons = _teacherName.trim().isEmpty
          ? allLessons
          : allLessons.where((lesson) {
              return _normalizeText(lesson.teacher) ==
                  _normalizeText(_teacherName);
            }).toList();
      if (!mounted) return;
      setState(() {
        lessons = filteredLessons;
        _isLoading = false;
      });
    } on SchoolFeedApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            'Canlı dersler yüklenirken beklenmeyen bir hata oluştu.';
        _isLoading = false;
      });
    }
  }

  Future<void> _createLesson() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const TeacherCreateLiveLessonPage()),
    );

    if (!mounted) return;
    if (result == null) return;

    try {
      final schedule = _parseSchedule(
        result["time"] as String,
        result["date"] as String?,
      );
      await SchoolFeedApiService.instance.createLiveLesson(
        title: result["title"] as String,
        subtitle: result["subtitle"] as String,
        teacher: _teacherName,
        className: result["className"] as String,
        platform: result["platform"] as String,
        meetingUrl: result["meetingUrl"] as String,
        startsAt: schedule.$1,
        durationMinutes: schedule.$2,
        materials: List<String>.from(result["materials"] as List),
      );
      await _loadLessons();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Canlı ders kaydedildi")));
    } on SchoolFeedApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Canlı ders kaydedilemedi.")),
      );
    }
  }

  (DateTime, int) _parseSchedule(String value, [String? dateStr]) {
    final cleaned = value.trim();
    final parts = cleaned.split('-').map((item) => item.trim()).toList();
    final startParts = parts.first.split(':');
    final startHour = int.tryParse(startParts.first) ?? DateTime.now().hour;
    final startMinute = startParts.length > 1
        ? int.tryParse(startParts[1]) ?? 0
        : 0;
    final now = DateTime.now();
    int year = now.year;
    int month = now.month;
    int day = now.day;
    if (dateStr != null && dateStr.trim().isNotEmpty) {
      final dateParts = dateStr.trim().split('.');
      if (dateParts.length == 3) {
        day = int.tryParse(dateParts[0]) ?? day;
        month = int.tryParse(dateParts[1]) ?? month;
        year = int.tryParse(dateParts[2]) ?? year;
      }
    }
    final startsAt = DateTime(year, month, day, startHour, startMinute);

    int durationMinutes = 60;
    if (parts.length > 1) {
      final endParts = parts[1].split(':');
      final endHour = int.tryParse(endParts.first) ?? startHour + 1;
      final endMinute = endParts.length > 1
          ? int.tryParse(endParts[1]) ?? 0
          : 0;
      final endsAt = DateTime(year, month, day, endHour, endMinute);
      durationMinutes = endsAt.difference(startsAt).inMinutes;
      if (durationMinutes <= 0) {
        durationMinutes = 60;
      }
    }

    return (startsAt, durationMinutes);
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

  Color _statusColor(String status) {
    switch (status) {
      case 'Şimdi Canlı':
        return const Color(0xFFEF5350);
      case 'Tamamlandı':
        return const Color(0xFF64748B);
      default:
        return const Color(0xFF69C36D);
    }
  }

  Color _accentColor(String platform) {
    return platform == 'Zoom'
        ? const Color(0xFFFF7A00)
        : const Color(0xFF4E8DF5);
  }

  void _showToolSheet(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color color,
    required String description,
    required String actionText,
  }) {
    final theme = Theme.of(context);

    showModalBottomSheet(
      context: context,
      backgroundColor: theme.cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return ResponsiveSheetContainer(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Wrap(
              runSpacing: 14,
              children: [
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: color, size: 30),
                ),
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  description,
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("$title: $actionText")),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: color,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(actionText),
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

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Canlı Dersler",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${lessons.length} aktif plan',
        showBackButton: true,
      ),
      body: RefreshIndicator(
        onRefresh: _loadLessons,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _heroCard(theme, isDark),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _createLesson,
                    icon: const Icon(Icons.add_circle_outline_rounded),
                    label: const Text("Canlı Ders Oluştur"),
                  ),
                ),
                const SizedBox(height: 18),
                _sectionTitle(theme, "Bugünkü Canlı Dersler"),
                const SizedBox(height: 12),
                if (_isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 36),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (_errorMessage != null)
                  _infoCard(
                    theme,
                    message: _errorMessage!,
                    icon: Icons.wifi_off_rounded,
                  )
                else if (lessons.isEmpty)
                  _infoCard(
                    theme,
                    message: 'Henüz oluşturduğun bir canlı ders bulunmuyor.',
                    icon: Icons.videocam_off_rounded,
                  )
                else
                  ...lessons.asMap().entries.map((entry) {
                    final index = entry.key;
                    final lesson = entry.value;

                    return _lessonCard(
                      context,
                      theme,
                      isDark,
                      index: index,
                      title: lesson.title,
                      subtitle: lesson.subtitle,
                      date: lesson.dateLabel,
                      time: lesson.timeLabel,
                      className: lesson.className,
                      platform: lesson.platform,
                      status: lesson.status,
                      statusColor: _statusColor(lesson.status),
                      accentColor: _accentColor(lesson.platform),
                      meetingUrl: lesson.meetingUrl,
                      isPrimary: index == 0,
                    );
                  }),
                const SizedBox(height: 18),
                _sectionTitle(theme, "Canlı Ders Araçları"),
                const SizedBox(height: 12),
                _toolsRow(context),
              ],
            ),
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
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFF9A3D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF7A00).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.videocam_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                "Canlı Ders Merkezi",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "Zoom ve Microsoft Teams bağlantılarınızı tek ekrandan yönetin, canlı derslerinize hızlıca katılın.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroMiniStat(lessons.length.toString(), "Toplam"),
              const SizedBox(width: 12),
              _heroMiniStat(
                lessons
                    .where((e) => e.status == "Şimdi Canlı")
                    .length
                    .toString(),
                "Canlı",
              ),
              const SizedBox(width: 12),
              _heroMiniStat(
                lessons
                    .where((e) => e.status != "Şimdi Canlı")
                    .length
                    .toString(),
                "Sıradaki",
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroMiniStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(ThemeData theme, String title) {
    return Text(
      title,
      style: theme.textTheme.titleMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  Widget _infoCard(
    ThemeData theme, {
    required String message,
    required IconData icon,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Icon(icon, size: 34, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _lessonCard(
    BuildContext context,
    ThemeData theme,
    bool isDark, {
    required int index,
    required String title,
    required String subtitle,
    required String date,
    required String time,
    required String className,
    required String platform,
    required String status,
    required Color statusColor,
    required Color accentColor,
    required String meetingUrl,
    required bool isPrimary,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isPrimary
              ? accentColor.withValues(alpha: 0.30)
              : theme.dividerColor.withValues(alpha: 0.35),
          width: isPrimary ? 1.4 : 1,
        ),
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
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  platform == "Zoom"
                      ? Icons.video_call_rounded
                      : Icons.groups_rounded,
                  color: accentColor,
                  size: 30,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
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
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.72,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.calendar_today_rounded,
                  text: date,
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.schedule_rounded,
                  text: time,
                  color: accentColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.groups_rounded,
                  text: "Sınıf $className",
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.link_rounded,
                  text: platform,
                  color: accentColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: () => _openMeeting(context, meetingUrl),
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const Text("Canlı Derse Katıl"),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 52,
                  height: 52,
                  child: OutlinedButton(
                    onPressed: () => _deleteLesson(context, lessons[index]),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red.shade600,
                      side: BorderSide(color: Colors.red.shade200),
                    ),
                    child: const Icon(Icons.delete_outline_rounded),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaChip(
    ThemeData theme, {
    required IconData icon,
    required String text,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _toolsRow(BuildContext context) {
    return Row(
      children: [
        _toolCard(
          context,
          icon: Icons.screen_share_rounded,
          title: "Ekran Paylaş",
          color: Colors.blue,
          onTap: () => _showToolSheet(
            context,
            title: "Ekran Paylaş",
            icon: Icons.screen_share_rounded,
            color: Colors.blue,
            description:
                "Canlı derste ekranını paylaşarak sunum veya PDF gösterebilirsin.",
            actionText: "Paylaşımı Başlat",
          ),
        ),
        const SizedBox(width: 12),
        _toolCard(
          context,
          icon: Icons.mic_rounded,
          title: "Ses Kontrol",
          color: Colors.green,
          onTap: () => _showToolSheet(
            context,
            title: "Ses Kontrol",
            icon: Icons.mic_rounded,
            color: Colors.green,
            description:
                "Mikrofon ve ses ayarlarını bu alandan yönetebilirsin.",
            actionText: "Ses Ayarlarını Aç",
          ),
        ),
        const SizedBox(width: 12),
        _toolCard(
          context,
          icon: Icons.insert_drive_file_rounded,
          title: "Ders Notu",
          color: Colors.purple,
          onTap: () => _showToolSheet(
            context,
            title: "Ders Notu",
            icon: Icons.insert_drive_file_rounded,
            color: Colors.purple,
            description: "Canlı ders notları ve materyalleri yönetebilirsin.",
            actionText: "Notları Aç",
          ),
        ),
      ],
    );
  }

  Widget _toolCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);

    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: theme.brightness == Brightness.dark
                    ? Colors.black.withValues(alpha: 0.16)
                    : Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
