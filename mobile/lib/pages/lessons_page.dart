import 'package:flutter/material.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/lesson_tile.dart';
import 'package:student/widgets/responsive_layout.dart';

class LessonsPage extends StatefulWidget {
  const LessonsPage({super.key});

  @override
  State<LessonsPage> createState() => _LessonsPageState();
}

class _LessonsPageState extends State<LessonsPage> {
  bool _loading = true;
  String? _error;
  List<LiveLessonRecord> _lessons = const [];

  @override
  void initState() {
    super.initState();
    _loadLessons();
  }

  Future<void> _loadLessons() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final lessons = await SchoolFeedApiService.instance.fetchLiveLessons();
      if (!mounted) return;
      setState(() {
        _lessons = lessons;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Dersler")),
      body: RefreshIndicator(
        onRefresh: _loadLessons,
        child: ResponsiveContent(
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                _messageCard(context, _error!)
              else if (_lessons.isEmpty)
                _messageCard(context, 'Bugün görünen ders kaydı bulunmuyor.')
              else
                ..._lessons.map(
                  (lesson) => LessonTile(
                    time: lesson.timeLabel,
                    title: lesson.title,
                    teacher: lesson.teacher,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _messageCard(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: theme.textTheme.bodyMedium,
      ),
    );
  }
}
