import 'package:flutter/material.dart';
import 'content_detail_page.dart';
import 'student_favorites_page.dart';
import 'student_notes_page.dart';

import '../services/auth_session_store.dart';
import '../services/content_api_service.dart';
import '../services/content_store.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/premium_resource_card.dart';
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
  List<String> _weakSubjects = const [];
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
    await _loadRecommendations();
  }

  // Çözülen sınavlardan konu analizi: en zayıf dersleri çıkarır, içerik
  // önerileri bu derslere göre önceliklenir.
  Future<void> _loadRecommendations() async {
    try {
      final results = await SchoolFeedApiService.instance.fetchExamResults();
      final bySubject = <String, List<int>>{};
      for (final ExamScoreRecord item in results) {
        if (item.subject.trim().isEmpty || item.score <= 0) continue;
        bySubject.putIfAbsent(item.subject.trim(), () => []).add(item.score);
      }
      final ranked = bySubject.entries
          .map((entry) => MapEntry(entry.key, entry.value.reduce((a, b) => a + b) / entry.value.length))
          .toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      if (!mounted) return;
      setState(() {
        _weakSubjects = ranked.map((entry) => entry.key).toList();
      });
    } catch (_) {
      // öneriler isteğe bağlı; hata sessizce yutulur.
    }
  }

  List<ContentRecord> get _recommended {
    final pool = _contents.where((item) {
      if (!item.isVisibleToStudents) return false;
      final contentGrade = _extractGrade(item.grade);
      if (_studentGrade.isNotEmpty && contentGrade.isNotEmpty && contentGrade != _studentGrade) {
        return false;
      }
      return item.progress < 1;
    }).toList();
    if (_weakSubjects.isEmpty) {
      return pool.where((item) => item.progress == 0).take(8).toList();
    }
    final order = {for (var i = 0; i < _weakSubjects.length; i++) _weakSubjects[i]: i};
    final ranked = pool.where((item) => order.containsKey(item.subject)).toList()
      ..sort((a, b) => (order[a.subject] ?? 99).compareTo(order[b.subject] ?? 99));
    final fallback = pool.where((item) => !order.containsKey(item.subject)).toList();
    return [...ranked, ...fallback].take(8).toList();
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
                      _quickAccessRow(),
                      const SizedBox(height: 14),
                      if (_recommended.isNotEmpty) ...[
                        _recommendedSection(),
                        const SizedBox(height: 16),
                      ],
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

  Widget _quickAccessRow() {
    return Row(
      children: [
        Expanded(
          child: _quickAccessButton(
            icon: Icons.star_rounded,
            label: 'Favori Konularım',
            color: const Color(0xFFFF9D2E),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const StudentFavoritesPage()),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _quickAccessButton(
            icon: Icons.sticky_note_2_rounded,
            label: 'Notlarım',
            color: const Color(0xFF7C3AED),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const StudentNotesPage()),
            ),
          ),
        ),
      ],
    );
  }

  Widget _quickAccessButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _recommendedSection() {
    final theme = Theme.of(context);
    final items = _recommended;
    final reason = _weakSubjects.isNotEmpty
        ? 'Çözdüğün testlere göre: ${_weakSubjects.first}'
        : 'Sana özel öneriler';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.auto_awesome_rounded, size: 18, color: Color(0xFFFF9D2E)),
            const SizedBox(width: 6),
            Text('Önerilen Konular', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          ],
        ),
        const SizedBox(height: 2),
        Text(reason, style: theme.textTheme.bodySmall),
        const SizedBox(height: 10),
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final item = items[index];
              final accent = resourceTheme(item.subject).hue;
              return GestureDetector(
                onTap: () => _openContent(item),
                child: Container(
                  width: 200,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              item.isVideo ? Icons.play_circle_fill_rounded : Icons.description_rounded,
                              color: accent,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              item.subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: accent, fontWeight: FontWeight.w800, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, height: 1.25, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _openContent(ContentRecord item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ContentDetailPage(
          title: item.title,
          subject: item.subject,
          teacher: item.teacher,
          info: item.info,
          isVideo: item.isVideo,
          fileType: item.fileType,
          description: item.description,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          size: item.size,
          grade: item.grade,
          id: item.id,
          playlist: const [],
        ),
      ),
    );
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
          id: item.id,
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
    String? id,
  }) {
    final theme = resourceTheme(subject);
    final accent = theme.hue;

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
              id: id,
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
          color: isDark(context) ? const Color(0xFF0B1728) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isDark(context)
                ? Colors.white.withValues(alpha: 0.10)
                : const Color(0xFFE2E8F0),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(
                alpha: isDark(context) ? 0.30 : 0.06,
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
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(22),
                    ),
                    color: isDark(context)
                        ? const Color(0xFF0B1728)
                        : Colors.white,
                    gradient: RadialGradient(
                      center: const Alignment(0.9, -1.2),
                      radius: 1.6,
                      colors: [
                        accent.withValues(alpha: isDark(context) ? 0.34 : 0.20),
                        accent.withValues(alpha: 0.04),
                      ],
                    ),
                  ),
                  child: Stack(
                    children: [
                      Positioned(
                        left: 12,
                        top: -8,
                        child: Text(
                          theme.mark,
                          style: TextStyle(
                            fontSize: 56,
                            fontWeight: FontWeight.w900,
                            color: accent.withValues(alpha: 0.12),
                            height: 1,
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.bottomRight,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Icon(
                            isVideo
                                ? Icons.play_circle_fill_rounded
                                : Icons.description_rounded,
                            size: 28,
                            color: accent,
                          ),
                        ),
                      ),
                    ],
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
                      color: accent.withValues(alpha: 0.13),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.30),
                      ),
                    ),
                    child: Text(
                      fileType,
                      style: TextStyle(
                        color: accent,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
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
                      color: isDark(context)
                          ? Colors.white.withValues(alpha: 0.06)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      info,
                      style: TextStyle(
                        color: isDark(context)
                            ? const Color(0xFFCBD5E1)
                            : const Color(0xFF475569),
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

}
