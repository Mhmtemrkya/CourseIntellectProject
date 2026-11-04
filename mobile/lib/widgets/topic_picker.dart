import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/topic_catalog.dart';

// ─── Ders konusu seçimi (mobil) ──────────────────────────────────────────────
// Optik cevap anahtarı ve soru stüdyosu ortak kullanır: aramalı konu sayfası, kurum listesine ekleme
// ve kaldırma. Konular kayıtlarda düz metin kalır; kurum konusunu kaldırmak kayıtları değiştirmez.

/// Konu sayfasının sonucu: listeden seçim, yalnız bu kayda yazma, listeye ekleme ya da kurum konusunu kaldırma.
enum TopicPickAction { pick, free, add, remove }

/// Seviye ve derslerin konu listesi; geç gelen eski yanıt yok sayılır. Değişince dinleyicilere haber verir.
class TopicCatalogStore extends ChangeNotifier {
  TopicCatalogStore([this.api = const TopicCatalogApi()]);

  final TopicCatalogApi api;
  Map<String, dynamic>? _catalog;
  bool error = false;
  int _request = 0;

  Future<void> load(String level, List<String> subjects) async {
    final names = subjects.where((item) => item.isNotEmpty).toList();
    if (names.isEmpty) return;
    final request = ++_request;
    try {
      final result = await api.fetch(level, names);
      if (request != _request) return;
      _catalog = result;
      error = false;
    } catch (_) {
      if (request != _request) return;
      _catalog = null;
      error = true;
    }
    notifyListeners();
  }

  Map<String, dynamic>? _entry(String subject) =>
      (_catalog?['subjects'] as List? ?? const []).whereType<Map<String, dynamic>>().where((item) => item['subject'] == subject).firstOrNull;

  List<TopicOption> optionsFor(String subject) => topicOptions(_entry(subject));

  /// Kurum listesine ekler; (yazım, durum) döner: created, exists-builtin, exists-custom.
  Future<(String, String)> add(String subject, String level, String name) async {
    final result = await api.add(subject, level, name);
    final saved = result['topic'];
    final entry = _entry(subject);
    if (entry != null && saved is Map) {
      final custom = [...(entry['custom'] as List? ?? const [])];
      if (!custom.whereType<Map>().any((item) => item['id'] == saved['id'])) custom.add(saved);
      entry['custom'] = custom;
      notifyListeners();
    }
    return ('${result['name'] ?? ''}', '${result['status'] ?? ''}');
  }

  Future<void> remove(String id) async {
    await api.remove(id);
    for (final entry in (_catalog?['subjects'] as List? ?? const []).whereType<Map<String, dynamic>>()) {
      entry['custom'] = (entry['custom'] as List? ?? const []).whereType<Map>().where((item) => item['id'] != id).toList();
    }
    notifyListeners();
  }
}

void _toast(BuildContext context, String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

/// Kurum listesine ekler ve sonucu kullanıcıya söyler; kaydedilen yazımı ya da (hata) null döner.
Future<String?> addTopicWithFeedback(BuildContext context, TopicCatalogStore store, String subject, String level, String name) async {
  try {
    final (saved, status) = await store.add(subject, level, name);
    if (!context.mounted) return null;
    if (status == 'exists-builtin') _toast(context, '${'Bu konu listede zaten var'.tr}: $saved');
    if (status == 'created') _toast(context, '${'Konu listeye eklendi'.tr}: $saved');
    return saved.isEmpty ? null : saved;
  } catch (error) {
    if (context.mounted) _toast(context, '${'Konu eklenemedi'.tr}: $error');
    return null;
  }
}

/// Aramalı konu sayfasını açar; seçilen ya da yazılan konuyu döner (vazgeçilirse null). Listeye ekleme ve
/// kurum konusunu kaldırma burada yürütülür.
Future<String?> pickTopic(BuildContext context, {
  required TopicCatalogStore store,
  required String subject,
  required String level,
  required String title,
  required String initial,
}) async {
  final picked = await showModalBottomSheet<(TopicPickAction, String)>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => TopicPickerSheet(title: title, options: store.optionsFor(subject), initial: initial),
  );
  if (picked == null || !context.mounted) return null;
  final (action, text) = picked;
  switch (action) {
    case TopicPickAction.pick:
    case TopicPickAction.free:
      return text;
    case TopicPickAction.add:
      return addTopicWithFeedback(context, store, subject, level, text);
    case TopicPickAction.remove:
      try {
        await store.remove(text);
        if (context.mounted) _toast(context, 'Konu kurum listesinden kaldırıldı. Bu konuyu kullanan kayıtlar değişmez.'.tr);
      } catch (error) {
        if (context.mounted) _toast(context, '${'Konu kaldırılamadı'.tr}: $error');
      }
      return null;
  }
}

/// Aramalı konu sayfası: yazdıkça dersin konuları süzülür (Türkçe harf duyarsız). Arama boşken konular
/// başlıklarıyla listelenir. Listede olmayan metin için: yalnız bu soruya yaz ya da kurum listesine ekle.
class TopicPickerSheet extends StatefulWidget {
  const TopicPickerSheet({super.key, required this.title, required this.options, required this.initial});
  final String title;
  final List<TopicOption> options;
  final String initial;

  @override
  State<TopicPickerSheet> createState() => _TopicPickerSheetState();
}

class _TopicPickerSheetState extends State<TopicPickerSheet> {
  late final _search = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final term = _search.text.trim();
    // Hücrede zaten bir konu varsa sayfa onu aramayla açar; listedeki konuysa tüm liste gösterilir.
    final searching = term.isNotEmpty && matchTopic(widget.options, term) == null;
    final filtered = searching ? filterTopics(widget.options, term) : widget.options;
    final shown = filtered.take(120).toList();
    final hint = TextStyle(color: theme.hintColor, fontSize: 12);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(widget.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  TextField(
                    key: const ValueKey('topic-search'),
                    controller: _search,
                    autofocus: true,
                    maxLength: 150,
                    decoration: InputDecoration(
                      isDense: true,
                      counterText: '',
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Konu ara ya da yaz'.tr,
                    ),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (value) {
                      final text = value.trim();
                      if (text.isEmpty) return;
                      final match = matchTopic(widget.options, text) ?? (filtered.length == 1 ? filtered.first : null);
                      Navigator.pop(context, match != null ? (TopicPickAction.pick, match.name) : (TopicPickAction.free, text));
                    },
                  ),
                ],
              ),
            ),
            if (searching) ...[
              ListTile(
                key: const ValueKey('topic-free'),
                dense: true,
                leading: const Icon(Icons.edit_note_rounded),
                title: Text('“$term” — ${'yalnız bu soruya yaz'.tr}'),
                onTap: () => Navigator.pop(context, (TopicPickAction.free, term)),
              ),
              ListTile(
                key: const ValueKey('topic-add'),
                dense: true,
                leading: Icon(Icons.playlist_add_rounded, color: theme.colorScheme.primary),
                title: Text('“$term” ${'konusunu listeye ekle'.tr}', style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600)),
                onTap: () => Navigator.pop(context, (TopicPickAction.add, term)),
              ),
              const Divider(height: 1),
            ],
            Expanded(
              child: shown.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        widget.options.isEmpty ? 'Bu ders için hazır konu yok. Konuyu yazıp listeye ekleyebilirsiniz.'.tr : 'Eşleşen konu yok.'.tr,
                        style: hint,
                      ),
                    )
                  : ListView.builder(
                      itemCount: shown.length,
                      itemBuilder: (context, index) {
                        final option = shown[index];
                        final header = !searching && (index == 0 || shown[index - 1].group != option.group) ? option.group : null;
                        final selected = topicKey(option.name) == topicKey(widget.initial);
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (header != null)
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                                child: Text(header, style: hint.copyWith(fontWeight: FontWeight.w700, fontSize: 11)),
                              ),
                            ListTile(
                              key: ValueKey('topic-option-${option.name}'),
                              dense: true,
                              selected: selected,
                              title: Text(option.name),
                              subtitle: searching ? Text(option.group, style: hint) : null,
                              trailing: option.source == TopicSource.custom && option.id != null
                                  ? IconButton(
                                      tooltip: 'Kurum listesinden kaldır (denemeler değişmez)'.tr,
                                      icon: const Icon(Icons.close_rounded, size: 18),
                                      onPressed: () => Navigator.pop(context, (TopicPickAction.remove, option.id!)),
                                    )
                                  : null,
                              onTap: () => Navigator.pop(context, (TopicPickAction.pick, option.name)),
                            ),
                          ],
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
