import 'package:flutter/material.dart';

import '../services/content_api_service.dart';
import '../services/content_store.dart';
import 'teacher_content_create_page.dart';
import 'teacher_content_detail_page.dart';

class TeacherContentPage extends StatefulWidget {
  const TeacherContentPage({super.key});

  @override
  State<TeacherContentPage> createState() => _TeacherContentPageState();
}

class _TeacherContentPageState extends State<TeacherContentPage> {
  bool _loading = true;
  String? _error;
  List<ContentRecord> _contents = const [];

  @override
  void initState() {
    super.initState();
    _loadContents();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF0F0F14)
          : const Color(0xFFF3F3F3),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          "CourseIntellect",
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFFF59E0B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.16),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "İçerik Yönetimi",
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          "Video, PDF, Word ve PowerPoint içeriklerini tek panelden yayınla. Eklenen içerikler öğrenci ekranında anında görünsün.",
                          style: TextStyle(color: Colors.white70, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _heroTag(
                              Icons.play_circle_fill_rounded,
                              '${_contents.where((e) => e.fileType == 'Video').length} video',
                            ),
                            _heroTag(
                              Icons.folder_copy_rounded,
                              '${_contents.where((e) => e.fileType != 'Video').length} belge',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0F172A),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 14,
                      ),
                    ),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const TeacherContentCreatePage(),
                      ),
                    ),
                    icon: const Icon(Icons.add),
                    label: const Text("Yeni İçerik"),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                StatBox(
                  '${_contents.length}',
                  "Toplam\nİçerik",
                  Icons.folder,
                  isDark: isDark,
                ),
                StatBox(
                  '${_contents.where((e) => e.fileType != 'Video').length}',
                  "Belge / Sunum",
                  Icons.picture_as_pdf,
                  isDark: isDark,
                ),
                StatBox(
                  '${_contents.where((e) => e.fileType == 'Video').length}',
                  "Video",
                  Icons.video_collection,
                  isDark: isDark,
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 48),
                child: Center(
                  child: Column(
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _loadContents,
                        child: const Text('Tekrar Dene'),
                      ),
                    ],
                  ),
                ),
              )
            else
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 0.9,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                children: _contents.map((item) {
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TeacherContentDetailPage(
                            content: item,
                            onContentChanged: _loadContents,
                          ),
                        ),
                      );
                    },
                    child: ContentCard(
                      title: item.title,
                      subtitle: '${item.subject} - ${item.grade}',
                      views: item.views,
                      size: item.size,
                      color: _colorForType(item.fileType),
                      icon: _iconForType(item.fileType),
                      duration: item.info,
                    ),
                  );
                }).toList(),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadContents() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ContentApiService.instance.fetchContents(
        visibleOnly: false,
      );
      if (!mounted) return;
      setState(() {
        _contents = items;
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

  Color _colorForType(String type) {
    switch (type) {
      case 'Video':
        return Colors.blue;
      case 'PDF':
        return Colors.orange;
      case 'Word':
        return Colors.indigo;
      case 'PowerPoint':
        return Colors.redAccent;
      default:
        return Colors.green;
    }
  }

  Widget _heroTag(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'Video':
        return Icons.video_library;
      case 'PDF':
        return Icons.picture_as_pdf;
      case 'Word':
        return Icons.description;
      case 'PowerPoint':
        return Icons.slideshow;
      default:
        return Icons.folder;
    }
  }
}

class StatBox extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  final bool isDark;

  const StatBox(
    this.value,
    this.label,
    this.icon, {
    super.key,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.orange),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}

class ContentCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String views;
  final String size;
  final Color color;
  final IconData icon;
  final String? duration;

  const ContentCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.views,
    required this.size,
    required this.color,
    required this.icon,
    this.duration,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [color.withValues(alpha: 0.8), color]),
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Colors.white),
              const Spacer(),
              if (duration != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    duration!,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(subtitle, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 6),
          Text(views, style: const TextStyle(color: Colors.white70)),
          Text(size, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Row(
            children: const [
              Text(
                'Detayi ac',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Spacer(),
              Icon(Icons.chevron_right_rounded, color: Colors.white),
            ],
          ),
        ],
      ),
    );
  }
}
