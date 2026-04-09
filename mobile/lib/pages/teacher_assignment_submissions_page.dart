import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherAssignmentSubmissionsPage extends StatefulWidget {
  final Map<String, dynamic> assignment;

  const TeacherAssignmentSubmissionsPage({
    super.key,
    required this.assignment,
  });

  @override
  State<TeacherAssignmentSubmissionsPage> createState() => _TeacherAssignmentSubmissionsPageState();
}

class _TeacherAssignmentSubmissionsPageState extends State<TeacherAssignmentSubmissionsPage> {
  String _teacherName = '';

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    setState(() => _teacherName = session.fullName);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final submissions = List<Map<String, dynamic>>.from(
      widget.assignment["submissions"] as List<dynamic>? ?? const [],
    );

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Teslimler",
        teacherName: _teacherName.isEmpty ? 'Ogretmen' : _teacherName,
        subtitle: '${widget.assignment["subject"] as String? ?? 'Ders'} Ogretmeni',
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.assignment["title"] as String,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "${widget.assignment["className"]} • ${widget.assignment["deadline"]}",
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (submissions.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('Bu ödev için henüz teslim bulunmuyor.'),
              ),
            ...submissions.map(
              (item) => Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.cardColor,
                  borderRadius: BorderRadius.circular(20),
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
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor:
                          theme.colorScheme.primary.withValues(alpha: 0.14),
                      child: Text(
                        ((item["studentName"] as String? ?? item["name"] as String? ?? 'O')[0]),
                        style: TextStyle(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item["studentName"] as String? ?? item["name"] as String? ?? 'Ogrenci',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(item["submittedAt"] as String? ?? item["time"] as String? ?? 'Teslim edilmedi'),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          item["status"] as String? ?? 'Teslim Etti',
                          style: TextStyle(
                            color: (item["status"] as String? ?? 'Teslim Etti') == "Gecikti"
                                ? Colors.redAccent
                                : Colors.green,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text("Ek: ${(item["files"] as List<dynamic>? ?? const []).length} dosya"),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
