import 'package:flutter/material.dart';

import '../services/attendance_service.dart';
import '../services/linked_children_service.dart';
import '../services/message_api_service.dart';
import '../services/school_feed_api_service.dart';

class VeliTeacherFeedbackPage extends StatefulWidget {
  const VeliTeacherFeedbackPage({super.key});

  @override
  State<VeliTeacherFeedbackPage> createState() =>
      _VeliTeacherFeedbackPageState();
}

class _VeliTeacherFeedbackPageState extends State<VeliTeacherFeedbackPage> {
  bool _loading = true;
  String? _error;
  List<_FeedbackNote> _notes = const [];

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  Future<void> _loadNotes() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      await AttendanceService.instance.refresh();
      final threads = await MessageApiService.instance.fetchThreads();
      final examResults = await SchoolFeedApiService.instance
          .fetchExamResults();
      final attendance = AttendanceService.instance.all();
      final notes = <_FeedbackNote>[];

      for (final thread in threads.where((item) {
        final role = item.contactRole.toLowerCase();
        return role.contains('teacher') || role.contains('öğretmen');
      })) {
        notes.add(
          _FeedbackNote(
            title: thread.contactName,
            detail: thread.lastMessagePreview,
            time: _formatDateTime(thread.lastMessageAt),
            color: const Color(0xFF2563EB),
          ),
        );
      }

      for (final child in linkedChildren) {
        final childAttendance = attendance
            .where(
              (item) =>
                  _normalizeText(item.studentName) ==
                  _normalizeText(child.fullName),
            )
            .toList();
        final absentCount = childAttendance
            .where(
              (item) =>
                  _normalizeText(item.status).contains('devamsız') ||
                  _normalizeText(item.status) == 'absent',
            )
            .length;
        final lateCount = childAttendance
            .where(
              (item) =>
                  _normalizeText(item.status).contains('gec') ||
                  _normalizeText(item.status) == 'late',
            )
            .length;
        final childExams = examResults
            .where(
              (item) =>
                  _normalizeText(item.studentName) ==
                  _normalizeText(child.fullName),
            )
            .toList();

        if (childExams.isNotEmpty) {
          final average =
              childExams.fold<int>(0, (sum, item) => sum + item.score) /
              childExams.length;
          notes.add(
            _FeedbackNote(
              title: '${child.fullName} • Akademik Durum',
              detail:
                  'Son ${childExams.length} sınav kaydının ortalaması ${average.toStringAsFixed(0)}. ${child.className} için bu özet canlı sınav verisinden oluşturuldu.',
              time: 'Sınav Sonuçları',
              color: const Color(0xFF0F766E),
            ),
          );
        }

        if (absentCount > 0 || lateCount > 0) {
          notes.add(
            _FeedbackNote(
              title: '${child.fullName} • Katılım Özeti',
              detail:
                  '$absentCount devamsızlık ve $lateCount geç kalma kaydı var. Bu kart öğretmen yoklama verisinden oluşuyor.',
              time: 'Yoklama Kayıtları',
              color: const Color(0xFF7C3AED),
            ),
          );
        }
      }

      if (!mounted) return;
      setState(() => _notes = notes);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Öğretmen Geri Bildirim Kutusu',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: _buildBody(context),
      ),
    );
  }

  List<Widget> _buildBody(BuildContext context) {
    if (_loading) {
      return const [
        Padding(
          padding: EdgeInsets.only(top: 48),
          child: Center(child: CircularProgressIndicator()),
        ),
      ];
    }

    if (_error != null) {
      return [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_error!),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _loadNotes,
                child: const Text('Tekrar Dene'),
              ),
            ],
          ),
        ),
      ];
    }

    if (_notes.isEmpty) {
      return [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Text('Henüz gösterilecek geri bildirim bulunmuyor.'),
        ),
      ];
    }

    return _notes
        .map(
          (note) => Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  note.title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                Text(
                  note.detail,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  note.time,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: note.color),
                ),
              ],
            ),
          ),
        )
        .toList();
  }

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    return '${local.day.toString().padLeft(2, '0')}.${local.month.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
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
}

class _FeedbackNote {
  final String title;
  final String detail;
  final String time;
  final Color color;

  const _FeedbackNote({
    required this.title,
    required this.detail,
    required this.time,
    required this.color,
  });
}
