import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/student_empty_state_panel.dart';

class AssignmentsPage extends StatefulWidget {
  const AssignmentsPage({super.key});

  @override
  State<AssignmentsPage> createState() => _AssignmentsPageState();
}

class _AssignmentsPageState extends State<AssignmentsPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> assignments = const [];

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final items = await HomeworkApiService.instance.fetchAssignments();
      final currentName = session?.fullName ?? '';
      final filtered = items.where((item) {
        final submissions = (item["submissions"] as List<dynamic>? ?? const []);
        final className = item["className"]?.toString() ?? '';
        final matchesSubmission = submissions.any((submission) {
          final map = Map<String, dynamic>.from(submission as Map);
          return _normalize(map["studentName"]?.toString() ?? '') ==
              _normalize(currentName);
        });
        return matchesSubmission || className.isNotEmpty;
      }).toList();
      if (!mounted) return;
      setState(() => assignments = filtered);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Ödevler")),
      body: ResponsiveContent(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
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
            : assignments.isEmpty
            ? Padding(
                padding: const EdgeInsets.all(20),
                child: StudentEmptyStatePanel(
                  title: 'Henüz ödev bulunmuyor',
                  description:
                      'Öğretmenlerin sana verdiği ödevler burada listelenecek. Takipte kal, hiçbirini kaçırma.',
                  accentColor: const Color(0xFF2563EB),
                  icon: Icons.folder_copy_rounded,
                  primaryLabel: 'Derslerime Geri Dön',
                  onPrimary: () => Navigator.maybePop(context),
                  secondaryLabel: 'Yenile',
                  onSecondary: _loadAssignments,
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: assignments.length,
                itemBuilder: (context, index) {
                  final assignment = assignments[index];
                  final submitted = (assignment["status"]?.toString() ?? '')
                      .toLowerCase()
                      .contains('tamam');

                  return Container(
                    margin: const EdgeInsets.only(bottom: 15),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: Theme.of(context).cardColor,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          assignment["title"]?.toString() ?? '-',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(assignment["teacher"]?.toString() ?? '-'),
                        const SizedBox(height: 6),
                        Text(assignment["deadline"]?.toString() ?? ''),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Chip(
                              label: Text(
                                assignment["status"]?.toString() ?? 'Bekliyor',
                              ),
                              backgroundColor:
                                  ((assignment["statusColor"] as Color?) ??
                                          Colors.orange)
                                      .withValues(alpha: 0.2),
                            ),
                            ElevatedButton(
                              onPressed: submitted
                                  ? null
                                  : () async {
                                      try {
                                        final session = await AuthSessionStore
                                            .instance
                                            .load();
                                        if (session == null) return;
                                        final updated = await HomeworkApiService
                                            .instance
                                            .submitAssignment(
                                              assignmentId:
                                                  assignment["id"] as String,
                                              studentName: session.fullName,
                                              note:
                                                  'Mobil öğrenci ekranından teslim edildi.',
                                              files: const [],
                                            );
                                        if (!mounted) return;
                                        setState(
                                          () => assignments[index] = updated,
                                        );
                                      } catch (error) {
                                        if (!mounted) return;
                                        ScaffoldMessenger.of(
                                          this.context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(error.toString()),
                                          ),
                                        );
                                      }
                                    },
                              child: Text(
                                submitted ? "Teslim Edildi" : "Teslim Et",
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  String _normalize(String value) {
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
}
