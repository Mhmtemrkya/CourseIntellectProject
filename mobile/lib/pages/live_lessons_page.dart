import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/material_download_service.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/responsive_overlays.dart';

class LiveLessonsPage extends StatefulWidget {
  const LiveLessonsPage({super.key});

  @override
  State<LiveLessonsPage> createState() => _LiveLessonsPageState();
}

class _LiveLessonsPageState extends State<LiveLessonsPage> {
  List<LiveLessonRecord> lessons = const [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadLessons();
  }

  Future<void> _loadLessons() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final records = await SchoolFeedApiService.instance.fetchLiveLessons();
      if (!mounted) return;
      setState(() {
        lessons = records;
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

  Future<void> _openMeeting(BuildContext context, String url) async {
    final uri = Uri.parse(url);

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Canlı ders bağlantısı açılamadı.")),
      );
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Şimdi Canlı':
        return const Color(0xFFEF5350);
      case 'Tamamlandi':
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

  ({String name, String url}) _parseMaterial(String raw) {
    final value = raw.trim();
    if (value.contains('::')) {
      final parts = value.split('::');
      return (
        name: parts.first.trim(),
        url: parts.length > 1
            ? parts.sublist(1).join('::').trim()
            : parts.first.trim(),
      );
    }
    return (name: value.split('/').last, url: '');
  }

  Future<void> _downloadMaterial(BuildContext context, String raw) async {
    final material = _parseMaterial(raw);
    if (material.url.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${material.name} için indirme bağlantısı bulunamadı. Materyali yeniden yükleyip canlı dersi tekrar oluşturun.',
          ),
        ),
      );
      return;
    }

    try {
      await MaterialDownloadService.instance.downloadAndOpen(
        fileName: material.name,
        url: material.url,
      );
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${material.name} indirildi.')));
    } on MaterialDownloadException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Materyal indirilemedi.')));
    }
  }

  void _showMaterialsSheet(
    BuildContext context, {
    required String title,
    required List<String> materials,
  }) {
    final theme = Theme.of(context);

    showModalBottomSheet(
      context: context,
      backgroundColor: theme.cardColor,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: ResponsiveSheetContainer(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
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
                  const SizedBox(height: 16),
                  Text(
                    '$title Materyalleri',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (materials.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                          'Bu canlı derse ait materyal bulunmuyor.',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    )
                  else
                    ...materials.map((item) {
                      final material = _parseMaterial(item);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _downloadMaterial(context, item),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: theme.scaffoldBackgroundColor,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.primary
                                        .withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.insert_drive_file_rounded,
                                    color: theme.colorScheme.primary,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    material.name,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.primary,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.download_rounded,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
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
    final liveCount = lessons
        .where((lesson) => lesson.status == 'Şimdi Canlı')
        .length;
    final upcomingCount =
        lessons.where((lesson) => lesson.status != 'Tamamlandi').length -
        liveCount;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Canlı Derslerim")),
      body: RefreshIndicator(
        onRefresh: _loadLessons,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _heroCard(
                  theme,
                  isDark,
                  lessons.length,
                  liveCount,
                  upcomingCount,
                ),
                const SizedBox(height: 18),
                Text(
                  "Bugünkü Canlı Dersler",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
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
                    message: 'Henüz planlanmış canlı ders bulunmuyor.',
                    icon: Icons.event_busy_rounded,
                  )
                else
                  ...lessons.map(
                    (lesson) => _lessonCard(
                      context,
                      theme,
                      isDark,
                      title: lesson.title,
                      subtitle: lesson.subtitle,
                      date: lesson.dateLabel,
                      time: lesson.timeLabel,
                      teacher: lesson.teacher,
                      platform: lesson.platform,
                      status: lesson.status,
                      statusColor: _statusColor(lesson.status),
                      accentColor: _accentColor(lesson.platform),
                      meetingUrl: lesson.meetingUrl,
                      materials: lesson.materials,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heroCard(
    ThemeData theme,
    bool isDark,
    int totalCount,
    int liveCount,
    int upcomingCount,
  ) {
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
              Icon(Icons.live_tv_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                "Canlı Ders Programın",
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
            "Canlı ders bağlantılarına hızlıca katıl, materyalleri görüntüle ve ders saatlerini takip et.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroMiniStat("$totalCount", "Toplam"),
              const SizedBox(width: 12),
              _heroMiniStat("$liveCount", "Canlı"),
              const SizedBox(width: 12),
              _heroMiniStat("$upcomingCount", "Sıradaki"),
            ],
          ),
        ],
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

  Widget _lessonCard(
    BuildContext context,
    ThemeData theme,
    bool isDark, {
    required String title,
    required String subtitle,
    required String date,
    required String time,
    required String teacher,
    required String platform,
    required String status,
    required Color statusColor,
    required Color accentColor,
    required String meetingUrl,
    required List<String> materials,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
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
          const SizedBox(height: 16),
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
                  icon: Icons.person_rounded,
                  text: teacher,
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
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showMaterialsSheet(
                    context,
                    title: title,
                    materials: materials,
                  ),
                  icon: const Icon(Icons.menu_book_rounded),
                  label: const Text("Materyaller"),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _openMeeting(context, meetingUrl),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text("Derse Katıl"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
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
}
