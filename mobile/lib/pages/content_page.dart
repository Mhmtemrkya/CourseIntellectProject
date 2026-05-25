import 'package:flutter/material.dart';
import 'content_detail_page.dart';

import '../services/auth_session_store.dart';
import '../services/content_api_service.dart';
import '../services/content_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/student_empty_state_panel.dart';

class ContentPage extends StatefulWidget {
  const ContentPage({super.key});

  @override
  State<ContentPage> createState() => _ContentPageState();
}

class _ContentPageState extends State<ContentPage>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> fadeAnim;
  late Animation<Offset> slideAnim;
  bool _loading = true;
  String? _error;
  List<ContentRecord> _contents = const [];
  String _selectedType = 'all';
  String _selectedSubject = 'Tümü';
  String _studentGrade = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    fadeAnim = Tween<double>(begin: 0, end: 1).animate(_controller);

    slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(_controller);

    _controller.forward();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthSessionStore.instance.load();
    final resolvedClassName =
        await SchoolFeedApiService.resolveLinkedStudentClassName(session);
    final grade = _extractGrade(resolvedClassName);
    if (mounted) {
      setState(() {
        _studentGrade = grade;
      });
    }
    await _loadContents();
  }

  static String _extractGrade(String className) {
    final match = RegExp(r'^\s*(\d{1,2})').firstMatch(className);
    return match?.group(1) ?? '';
  }

  @override
  void dispose() {
    _searchController.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadContents() async {
    try {
      final items = await ContentApiService.instance.fetchContents(
        visibleOnly: true,
      );
      if (!mounted) return;
      setState(() {
        _contents = items;
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

  bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredContents;
    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      appBar: hasSidebar ? null : AppBar(title: const Text("İçerikler")),
      body: FadeTransition(
        opacity: fadeAnim,
        child: SlideTransition(
          position: slideAnim,
          child: ResponsiveContent(
            padding: const EdgeInsets.all(16),
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
                          onPressed: _loadContents,
                          child: const Text('Tekrar Dene'),
                        ),
                      ],
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _filters(),
                      const SizedBox(height: 16),
                      Expanded(
                        child: filtered.isEmpty
                            ? SingleChildScrollView(
                                child: StudentEmptyStatePanel(
                                  title: 'Henüz içerik bulunmuyor',
                                  description:
                                      'Bu derse ait konu anlatımı içerikleri henüz eklenmemiş. Yeni içerikler eklendiğinde burada görebilirsin.',
                                  accentColor: const Color(0xFF6366F1),
                                  icon: Icons.menu_book_rounded,
                                  primaryLabel: 'İçeriklere Göz At',
                                  onPrimary: _loadContents,
                                ),
                              )
                            : contentGrid(filtered),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  List<ContentRecord> get _filteredContents {
    return _contents.where((item) {
      if (!item.isVisibleToStudents) return false;
      // Sınıf/grade filtresi: içerik bir grade'e bağlıysa (ör. "10. Sınıf"),
      // yalnızca öğrencinin grade'iyle eşleşenleri göster. Grade boşsa
      // tüm sınıflara açıktır.
      final contentGrade = _extractGrade(item.grade);
      if (_studentGrade.isNotEmpty &&
          contentGrade.isNotEmpty &&
          contentGrade != _studentGrade) {
        return false;
      }
      final query = _searchController.text.trim().toLowerCase();
      final matchesQuery =
          query.isEmpty ||
          '${item.title} ${item.subject} ${item.teacher}'
              .toLowerCase()
              .contains(query);
      final matchesSubject =
          _selectedSubject == 'Tümü' || item.subject == _selectedSubject;
      final type = item.fileType.toLowerCase();
      final matchesType =
          _selectedType == 'all' ||
          (_selectedType == 'video' && type.contains('video')) ||
          (_selectedType == 'pdf' && type.contains('pdf')) ||
          (_selectedType == 'completed' && item.progress >= 1) ||
          (_selectedType == 'inprogress' &&
              item.progress > 0 &&
              item.progress < 1);
      return matchesQuery && matchesSubject && matchesType;
    }).toList();
  }

  Widget _filters() {
    final subjects = ['Tümü', ..._contents.map((item) => item.subject).toSet()];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _searchController,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            hintText: 'İçerik ara...',
            prefixIcon: Icon(Icons.search_rounded),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children:
              [
                ('all', 'Tümü'),
                ('video', 'Videolar'),
                ('pdf', 'PDF'),
                ('inprogress', 'Devam Eden'),
                ('completed', 'Tamamlanan'),
              ].map((item) {
                final selected = _selectedType == item.$1;
                return ChoiceChip(
                  label: Text(item.$2),
                  selected: selected,
                  onSelected: (_) => setState(() => _selectedType = item.$1),
                );
              }).toList(),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 42,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemBuilder: (context, index) {
              final subject = subjects[index];
              final selected = _selectedSubject == subject;
              return ChoiceChip(
                label: Text(subject),
                selected: selected,
                onSelected: (_) => setState(() => _selectedSubject = subject),
              );
            },
            separatorBuilder: (_, index) => const SizedBox(width: 8),
            itemCount: subjects.length,
          ),
        ),
      ],
    );
  }

  /// GRID
  Widget contentGrid(List<ContentRecord> visible) {
    return GridView.builder(
      padding: const EdgeInsets.only(bottom: 24),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: ResponsiveLayout.columns(
          context,
          phone: 2,
          tablet: 3,
          largeTablet: 4,
        ),
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: ResponsiveLayout.isLargeTablet(context)
            ? 1.02
            : ResponsiveLayout.isTablet(context)
            ? 0.9
            : 0.78,
      ),
      itemCount: visible.length,
      itemBuilder: (context, index) {
        final item = visible[index];
        return contentCard(
          subject: item.subject,
          title: item.title,
          teacher: item.teacher,
          info: item.info,
          progress: item.progress,
          isVideo: item.isVideo,
          fileType: item.fileType,
          description: item.description,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          size: item.size,
          grade: item.grade,
          playlistKey: item.playlistKey,
        );
      },
    );
  }

  /// CARD
  Widget contentCard({
    required String subject,
    required String title,
    required String teacher,
    required String info,
    required double progress,
    required bool isVideo,
    required String fileType,
    required String description,
    String? fileName,
    String? fileUrl,
    required String size,
    required String grade,
    String? playlistKey,
  }) {
    final accent = _accentForType(fileType);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ContentDetailPage(
              title: title,
              subject: subject,
              teacher: teacher,
              info: info,
              isVideo: isVideo,
              fileType: fileType,
              description: description,
              fileName: fileName,
              fileUrl: fileUrl,
              size: size,
              grade: grade,
              playlist: isVideo
                  ? (_contents.where((item) {
                      if (!item.isVisibleToStudents || !item.isVideo) {
                        return false;
                      }
                      if (playlistKey != null && playlistKey.isNotEmpty) {
                        return item.playlistKey == playlistKey;
                      }
                      return item.fileName == fileName;
                    }).toList()..sort((left, right) {
                      final leftOrder = left.playlistOrder ?? 9999;
                      final rightOrder = right.playlistOrder ?? 9999;
                      if (leftOrder != rightOrder) {
                        return leftOrder.compareTo(rightOrder);
                      }
                      return left.title.toLowerCase().compareTo(
                        right.title.toLowerCase(),
                      );
                    }))
                  : const [],
            ),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark(context) ? const Color(0xFF171B22) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: accent.withValues(alpha: 0.12)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(
                alpha: isDark(context) ? 0.18 : 0.06,
              ),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  height: 84,
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(22),
                    ),
                    gradient: LinearGradient(
                      colors: [
                        accent.withValues(alpha: 0.88),
                        accent.withValues(alpha: 0.54),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Align(
                    alignment: Alignment.bottomRight,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Icon(
                        isVideo
                            ? Icons.play_circle_fill_rounded
                            : Icons.description_rounded,
                        size: 28,
                        color: Colors.white.withValues(alpha: 0.92),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.16),
                      ),
                    ),
                    child: Text(
                      fileType,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 10,
                  bottom: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      info,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      subject,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        color: accent,
                      ),
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      height: 1.3,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    teacher,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: Theme.of(
                        context,
                      ).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 7,
                            backgroundColor: accent.withValues(alpha: 0.12),
                            color: accent,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '%${(progress * 100).round()}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _accentForType(String type) {
    switch (type) {
      case 'PDF':
        return const Color(0xFFF59E0B);
      case 'Word':
        return const Color(0xFF4F46E5);
      case 'PowerPoint':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFF2563EB);
    }
  }
}
