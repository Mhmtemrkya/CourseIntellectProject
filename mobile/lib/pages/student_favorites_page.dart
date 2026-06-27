import 'package:flutter/material.dart';

import '../services/content_api_service.dart';
import '../services/content_store.dart';
import 'content_detail_page.dart';

class StudentFavoritesPage extends StatefulWidget {
  const StudentFavoritesPage({super.key});

  @override
  State<StudentFavoritesPage> createState() => _StudentFavoritesPageState();
}

class _StudentFavoritesPageState extends State<StudentFavoritesPage> {
  bool _loading = true;
  String? _error;
  List<ContentRecord> _contents = const [];
  List<MyContentStateRecord> _states = const [];
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final results = await Future.wait([
        ContentApiService.instance.fetchContents(visibleOnly: true),
        ContentApiService.instance.fetchMyEngagement(),
      ]);
      if (!mounted) return;
      setState(() {
        _contents = results[0] as List<ContentRecord>;
        _states = results[1] as List<MyContentStateRecord>;
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

  List<ContentRecord> get _favorites {
    final favIds = _states
        .where((item) => item.favorite)
        .map((item) => item.contentId.toLowerCase())
        .toSet();
    final query = _searchController.text.trim().toLowerCase();
    return _contents.where((item) {
      if (!favIds.contains((item.id ?? '').toLowerCase())) return false;
      if (query.isEmpty) return true;
      return '${item.title} ${item.subject} ${item.teacher}'
          .toLowerCase()
          .contains(query);
    }).toList();
  }

  Future<void> _removeFavorite(ContentRecord item) async {
    final matches = _states
        .where((entry) => entry.contentId.toLowerCase() == (item.id ?? '').toLowerCase());
    final state = matches.isEmpty ? null : matches.first;
    setState(() {
      _states = _states
          .map(
            (entry) => entry.contentId.toLowerCase() == (item.id ?? '').toLowerCase()
                ? MyContentStateRecord(
                    contentId: entry.contentId,
                    progress: entry.progress,
                    liked: entry.liked,
                    favorite: false,
                    note: entry.note,
                    updatedAtUtc: entry.updatedAtUtc,
                  )
                : entry,
          )
          .toList();
    });
    try {
      await ContentApiService.instance.saveUserState(
        contentId: item.id ?? '',
        progress: (state?.progress ?? item.progress * 100),
        liked: state?.liked ?? false,
        favorite: false,
        note: state?.note ?? '',
      );
    } catch (_) {
      // sessizce yut; bir sonraki yenilemede tutarlanır.
    }
  }

  void _open(ContentRecord item) {
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
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final favorites = _favorites;
    return Scaffold(
      appBar: AppBar(title: const Text('Favori Konularım')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _load, child: const Text('Tekrar Dene')),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      hintText: 'Favorilerde ara...',
                      prefixIcon: Icon(Icons.search_rounded),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (favorites.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 80),
                      child: Column(
                        children: [
                          Icon(Icons.star_border_rounded, size: 48, color: theme.disabledColor),
                          const SizedBox(height: 12),
                          const Text(
                            'Henüz favori konun yok',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'İçerik sayfasında bir konuyu yıldızladığında burada görünür.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    )
                  else
                    ...favorites.map((item) => _favoriteCard(theme, item)),
                ],
              ),
            ),
    );
  }

  Widget _favoriteCard(ThemeData theme, ContentRecord item) {
    final accent = const Color(0xFFFF9D2E);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        onTap: () => _open(item),
        leading: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            item.isVideo ? Icons.play_circle_fill_rounded : Icons.description_rounded,
            color: accent,
          ),
        ),
        title: Text(
          item.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text('${item.subject}${item.teacher.isNotEmpty ? ' • ${item.teacher}' : ''}'),
        trailing: IconButton(
          tooltip: 'Favoriden çıkar',
          icon: const Icon(Icons.star_rounded, color: Color(0xFFFF9D2E)),
          onPressed: () => _removeFavorite(item),
        ),
      ),
    );
  }
}
