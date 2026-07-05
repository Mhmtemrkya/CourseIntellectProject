import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/content_api_service.dart';
import '../services/content_store.dart';

class StudentNotesPage extends StatefulWidget {
  const StudentNotesPage({super.key});

  @override
  State<StudentNotesPage> createState() => _StudentNotesPageState();
}

class _StudentNotesPageState extends State<StudentNotesPage> {
  bool _loading = true;
  String? _error;
  List<ContentRecord> _contents = const [];
  List<MyContentStateRecord> _states = const [];
  final Map<String, String> _drafts = {};
  final Set<String> _saving = {};
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
        _drafts.clear();
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

  List<_NoteEntry> get _notes {
    final query = _searchController.text.trim().toLowerCase();
    final entries = <_NoteEntry>[];
    for (final state in _states) {
      if (state.note.trim().isEmpty) continue;
      ContentRecord? content;
      for (final item in _contents) {
        if ((item.id ?? '').toLowerCase() == state.contentId.toLowerCase()) {
          content = item;
          break;
        }
      }
      if (content == null) continue;
      if (query.isNotEmpty &&
          !'${content.title} ${content.subject} ${state.note}'.toLowerCase().contains(query)) {
        continue;
      }
      entries.add(_NoteEntry(state: state, content: content));
    }
    entries.sort((a, b) => (b.state.updatedAtUtc ?? DateTime(0)).compareTo(a.state.updatedAtUtc ?? DateTime(0)));
    return entries;
  }

  Future<void> _save(_NoteEntry entry) async {
    final id = entry.state.contentId;
    final next = _drafts[id] ?? entry.state.note;
    setState(() => _saving.add(id));
    try {
      await ContentApiService.instance.saveUserState(
        contentId: id,
        progress: entry.state.progress,
        liked: entry.state.liked,
        favorite: entry.state.favorite,
        note: next,
      );
      if (!mounted) return;
      setState(() {
        _states = _states
            .map(
              (item) => item.contentId == id
                  ? MyContentStateRecord(
                      contentId: item.contentId,
                      progress: item.progress,
                      liked: item.liked,
                      favorite: item.favorite,
                      note: next,
                      updatedAtUtc: DateTime.now().toUtc(),
                    )
                  : item,
            )
            .toList();
        _drafts.remove(id);
        _saving.remove(id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Not senkronize edildi.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving.remove(id));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Not kaydedilemedi: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notes = _notes;
    return Scaffold(
      appBar: AppBar(
        title: Text('Notlarım'.tr),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
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
                  Row(
                    children: [
                      const Icon(Icons.cloud_done_rounded, size: 18, color: Color(0xFF27B3A2)),
                      const SizedBox(width: 6),
                      Text('Bulutla senkron', style: theme.textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Notlarda ara...'.tr,
                      prefixIcon: Icon(Icons.search_rounded),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (notes.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 80),
                      child: Column(
                        children: [
                          Icon(Icons.sticky_note_2_outlined, size: 48, color: theme.disabledColor),
                          const SizedBox(height: 12),
                          Text('Henüz not almadın'.tr, style: TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(
                            'Bir içeriği açıp not aldığında burada toplanır ve senkronlanır.'.tr,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    )
                  else
                    ...notes.map((entry) => _noteCard(theme, entry)),
                ],
              ),
            ),
    );
  }

  Widget _noteCard(ThemeData theme, _NoteEntry entry) {
    final id = entry.state.contentId;
    final draft = _drafts[id] ?? entry.state.note;
    final dirty = _drafts.containsKey(id) && _drafts[id] != entry.state.note;
    final saving = _saving.contains(id);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.menu_book_rounded, size: 18, color: Color(0xFF7C3AED)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.content.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(entry.content.subject, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(
            initialValue: draft,
            maxLines: null,
            minLines: 3,
            onChanged: (value) => setState(() => _drafts[id] = value),
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                dirty ? 'Kaydedilmemiş değişiklik' : 'Senkron',
                style: TextStyle(
                  fontSize: 12,
                  color: dirty ? const Color(0xFFFFB020) : const Color(0xFF27B3A2),
                  fontWeight: FontWeight.w700,
                ),
              ),
              FilledButton.icon(
                onPressed: (!dirty || saving) ? null : () => _save(entry),
                icon: const Icon(Icons.save_rounded, size: 18),
                label: Text(saving ? 'Kaydediliyor...' : 'Kaydet'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NoteEntry {
  final MyContentStateRecord state;
  final ContentRecord content;

  const _NoteEntry({required this.state, required this.content});
}
