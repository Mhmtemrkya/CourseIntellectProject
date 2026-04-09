import 'package:flutter/material.dart';
import 'package:student/pages/student_homework_detail_page.dart';
import 'package:student/pages/student_homework_upload_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';


class HomeworkPage extends StatefulWidget {
  const HomeworkPage({super.key});

  @override
  State<HomeworkPage> createState() => _HomeworkPageState();
}

class _HomeworkPageState extends State<HomeworkPage> {
  int selectedTab = 0;
  List<Map<String, dynamic>> _assignments = const [];
  bool _loading = true;
  String? _error;
  String _studentName = '';

  final List<String> tabs = [
    "Aktif Odevler",
    "Teslim Edilenler",
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthSessionStore.instance.load();
    final resolvedStudentName = await SchoolFeedApiService.resolveLinkedStudentName(session);
    if (mounted) {
      setState(() => _studentName = resolvedStudentName);
    }
    await _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await HomeworkApiService.instance.fetchAssignments();
      if (!mounted) return;
      setState(() {
        _assignments = items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _openUpload(Map<String, dynamic> item) async {
    final result = await Navigator.push<int>(
      context,
      MaterialPageRoute(
        builder: (_) => StudentHomeworkUploadPage(homework: item),
      ),
    );

    if (result != null) {
      setState(() => selectedTab = 1);
      await _loadAssignments();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text("Odev teslim edildi • +$result XP"),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final activeHomeworks = _assignments.where((item) {
      final submissions = List<Map<String, dynamic>>.from(item["submissions"] as List<dynamic>? ?? const []);
      return !submissions.any((entry) => entry["studentName"] == _studentName);
    }).toList();
    final submittedHomeworks = _assignments.where((item) {
      final submissions = List<Map<String, dynamic>>.from(item["submissions"] as List<dynamic>? ?? const []);
      return submissions.any((entry) => entry["studentName"] == _studentName);
    }).toList();
    final currentList = selectedTab == 0 ? activeHomeworks : submittedHomeworks;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text("Ödevlerim"),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Column(
                        children: [
                          Text(_error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: _loadAssignments,
                            child: const Text('Tekrar Dene'),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _heroCard(theme, isDark, activeHomeworks.length, submittedHomeworks.length),
                        const SizedBox(height: 18),
                        _tabBar(theme),
                        const SizedBox(height: 18),
                        ...currentList.map((item) => _homeworkCard(theme, isDark, item)),
                      ],
                    ),
        ),
      ),
    );
  }

  Widget _heroCard(ThemeData theme, bool isDark, int activeCount, int submittedCount) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFF7A00),
            Color(0xFFFFA24A),
          ],
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
              Icon(Icons.assignment_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                "Odev Takibi",
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
            "Aktif ödevlerini takip et, materyalleri görüntüle ve teslimlerini zamanında tamamla.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat("$activeCount", "Aktif"),
              const SizedBox(width: 12),
              _heroStat("$submittedCount", "Teslim"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label) {
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

  Widget _tabBar(ThemeData theme) {
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
            },
            child: Container(
              margin: EdgeInsets.only(right: index == 0 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                tabs[index],
                textAlign: TextAlign.center,
                style: TextStyle(
                  color:
                      selected ? Colors.white : theme.textTheme.bodyMedium?.color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _homeworkCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
  ) {
    final isSubmitted = item["status"] == "Teslim Edildi";

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
                  color: (item["accentColor"] as Color).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.assignment_turned_in_rounded,
                  color: item["accentColor"] as Color,
                ),
              ),
              const SizedBox(width: 12),
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
                    const SizedBox(height: 4),
                    Text(
                      "${item["subject"]} • ${item["teacher"]}",
                      style: theme.textTheme.bodySmall?.copyWith(
                        color:
                            theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72),
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
                  color: (item["statusColor"] as Color).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  item["status"] as String,
                  style: TextStyle(
                    color: item["statusColor"] as Color,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.schedule_rounded,
                  text: item["deadline"] as String,
                  color: item["accentColor"] as Color,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.groups_rounded,
                  text: item["className"] as String,
                  color: item["accentColor"] as Color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => StudentHomeworkDetailPage(
                          homework: item,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.visibility_outlined),
                  label: const Text("Detay"),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: isSubmitted ? null : () => _openUpload(item),
                  icon: Icon(
                    isSubmitted
                        ? Icons.check_circle_outline_rounded
                        : Icons.upload_file_rounded,
                  ),
                  label: Text(
                    isSubmitted ? "Teslim Edildi" : "Odev Yukle",
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: item["accentColor"] as Color,
                    foregroundColor: Colors.white,
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
