import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/module_api_client.dart';
import '../services/optical_answer_key.dart';
import '../services/topic_catalog.dart';
import '../widgets/topic_picker.dart';
import '../widgets/admin_ui.dart';
import 'optical_study_plan_page.dart';
import 'optical_template_editor_page.dart';

/// Optik denemeler: şablonlar, deneme listesi ve cevap anahtarı düzenleme. Optik dosya aktarımı
/// masaüstünde yapılır; telefonda şablon kurulur, deneme açılır, cevap anahtarı ve konular girilir.
class OpticalExamsPage extends StatefulWidget {
  const OpticalExamsPage({super.key});

  @override
  State<OpticalExamsPage> createState() => _OpticalExamsPageState();
}

class _OpticalExamsPageState extends State<OpticalExamsPage> {
  final _client = ModuleApiClient.instance;
  List<Map<String, dynamic>> _exams = const [];
  List<Map<String, dynamic>> _templates = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_client.get('/api/optical-exams'), _client.get('/api/optical-exams/templates')]);
      if (!mounted) return;
      setState(() {
        _exams = asMapList(results[0]);
        _templates = asMapList(results[1]);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$error';
      });
    }
  }

  Future<void> _open(Map<String, dynamic>? summary) async {
    Map<String, dynamic>? exam;
    if (summary != null) {
      try {
        exam = asMap(await _client.get('/api/optical-exams/${summary['id']}'));
      } catch (error) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
        return;
      }
    }
    if (!mounted) return;
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => OpticalExamEditorPage(exam: exam, templates: _templates)),
    );
    if (saved == true) await _load();
  }

  Future<void> _openTemplate(Map<String, dynamic>? template) async {
    final saved = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => OpticalTemplateEditorPage(template: template)));
    if (saved == true) await _load();
  }

  /// Optik şablonlar: okuyucu dosyasının karakter düzeni; bir kez kurulur, sonraki denemelerde kullanılır.
  Widget _templatesPanel(TextStyle hint) => AdminPanel(
        key: const ValueKey('optical-templates'),
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text('Optik şablonlar'.tr, style: const TextStyle(fontWeight: FontWeight.w700))),
                TextButton.icon(onPressed: () => _openTemplate(null), icon: const Icon(Icons.add_rounded, size: 18), label: Text('Yeni şablon'.tr)),
              ],
            ),
            Text('Her optik okuyucu çıktısı için karakter düzeni bir kez tanımlanır.'.tr, style: hint),
            for (final template in _templates)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text('${template['name']}'),
                subtitle: Text(
                  OpticalSubjectBlock.listFrom(template['subjects']).map((item) => '${item.name} (${item.count})').join(' · '),
                  style: hint,
                ),
                trailing: const Icon(Icons.edit_outlined, size: 20),
                onTap: () => _openTemplate(template),
              ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    return AdminScaffold(
      appBar: AppBar(title: Text('Optik Denemeler'.tr)),
      floatingActionButton: _templates.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _open(null),
              icon: const Icon(Icons.add_rounded),
              label: Text('Yeni deneme'.tr),
            ),
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            Text('Cevap anahtarı ve soru konuları. Optik dosya aktarımı masaüstünden yapılır.'.tr, style: hint),
            const SizedBox(height: 12),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (_error != null)
              AdminPanel(child: Text(_error!))
            else ...[
              _templatesPanel(hint),
              const SizedBox(height: 12),
              if (_templates.isEmpty)
                AdminPanel(child: Text('Önce bir optik şablon oluşturun; ardından denemeyi açabilirsiniz.'.tr))
              else if (_exams.isEmpty)
              AdminPanel(child: Text('Henüz deneme yok. Yeni deneme ile cevap anahtarını girin.'.tr))
            else
              ..._exams.map((exam) => AdminPanel(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: EdgeInsets.zero,
                    child: ListTile(
                      title: Text('${exam['title']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        '${'${exam['examDateUtc'] ?? ''}'.split('T').first} · ${exam['templateName'] ?? ''} · '
                        '${'{n} soru'.tr.replaceFirst('{n}', '${exam['questionCount'] ?? 0}')} · '
                        '${'konu %{n}'.tr.replaceFirst('{n}', '${exam['topicCoverage'] ?? 0}')}',
                        style: hint,
                      ),
                      trailing: exam['status'] == 'Imported'
                          ? IconButton(
                              key: ValueKey('study-plan-open-${exam['id']}'),
                              tooltip: 'Çalışma planı'.tr,
                              icon: const Icon(Icons.event_available_rounded),
                              onPressed: () => Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => OpticalStudyPlanPage(examId: '${exam['id']}', examTitle: '${exam['title']}')),
                              ),
                            )
                          : const Icon(Icons.chevron_right_rounded),
                      onTap: () => _open(exam),
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

/// Deneme: puanlama kuralları + kitapçık başına soru tablosu (masaüstündeki OpticalExamEditor ile aynı).
class OpticalExamEditorPage extends StatefulWidget {
  const OpticalExamEditorPage({super.key, required this.exam, required this.templates, this.client, this.topicApi = const TopicCatalogApi()});

  final Map<String, dynamic>? exam;
  final List<Map<String, dynamic>> templates;

  /// Testlerde sahte istemci; null ise ModuleApiClient.
  final Future<void> Function(String? id, Map<String, Object?> body)? client;

  /// Soru konusu listesi uçları (testlerde sahtesi).
  final TopicCatalogApi topicApi;

  @override
  State<OpticalExamEditorPage> createState() => _OpticalExamEditorPageState();
}

class _PasteNote {
  const _PasteNote(this.subject, this.answers, this.result, [this.unlisted = const []]);
  final String subject;
  final bool answers;
  final OpticalPasteResult result;

  /// Yapıştırılan konulardan listede olmayanlar (yazıldığı gibi kaldı).
  final List<String> unlisted;
}

class _OpticalExamEditorPageState extends State<OpticalExamEditorPage> {
  final _title = TextEditingController();
  late DateTime _date;
  String _templateId = '';
  int _penalty = 4;
  bool _multiWrong = true;
  String _cancelledMode = 'exclude';
  String _level = '';
  late final TopicCatalogStore _topics = TopicCatalogStore(widget.topicApi)..addListener(_onTopics);
  bool _addingAll = false;
  bool _levelTouched = false;
  List<OpticalKeyDraft> _keys = [];
  int _active = 0;
  List<String> _problems = const [];
  _PasteNote? _note;
  bool _busy = false;
  final Map<String, TextEditingController> _topicControllers = {};

  List<OpticalSubjectBlock> _blocksOf(String id) =>
      OpticalSubjectBlock.listFrom(widget.templates.where((item) => '${item['id']}' == id).firstOrNull?['subjects']);
  List<OpticalSubjectBlock> get _blocks => _blocksOf(_templateId);
  String _templateName(String id) => '${widget.templates.where((item) => '${item['id']}' == id).firstOrNull?['name'] ?? ''}';

  @override
  void initState() {
    super.initState();
    final exam = widget.exam;
    _title.text = '${exam?['title'] ?? ''}';
    _date = DateTime.tryParse('${exam?['examDateUtc'] ?? ''}')?.toLocal() ?? DateTime.now();
    _templateId = '${exam?['templateId'] ?? widget.templates.firstOrNull?['id'] ?? ''}';
    _penalty = (exam?['wrongPenalty'] as num?)?.toInt() ?? 4;
    _multiWrong = exam?['multiMarkAsWrong'] as bool? ?? true;
    _cancelledMode = '${exam?['cancelledMode'] ?? 'exclude'}';
    _keys = opticalDraftsFrom(exam?['keys'], _blocks);
    // Eski denemede seviye yoksa tahmin edilir; yalnız konu listesini daraltır, kaydedince saklanır.
    final saved = '${exam?['level'] ?? ''}';
    _level = saved.isNotEmpty ? saved : guessLevel(_blocks, _penalty, _templateName(_templateId));
    _loadTopics();
  }

  void _onTopics() {
    if (mounted) setState(() {});
  }

  /// Konu listesi: seviye ya da şablon değişince yeniden alınır.
  Future<void> _loadTopics() => _topics.load(_level, _blocks.map((block) => block.name).toList());

  List<TopicOption> _optionsFor(String subject) => _topics.optionsFor(subject);

  void _changeLevel(String level) {
    setState(() {
      _level = level;
      final penalty = levelPenalty(level);
      if (widget.exam == null && penalty != null) _penalty = penalty;
    });
    _loadTopics();
  }

  void _setTopic(String subject, int index, String value) {
    final draft = _current.subjects[subject];
    if (draft == null) return;
    setState(() => draft.topics[index] = value);
    _syncTopics(_current.booklet, subject, draft.topics);
  }

  /// Aramalı konu sayfası: seçim, serbest yazım ya da listeye ekleme.
  Future<void> _pickTopic(OpticalSubjectBlock block, int index) async {
    final draft = _current.subjects[block.name];
    if (draft == null) return;
    final chosen = await pickTopic(
      context,
      store: _topics,
      subject: block.name,
      level: _level,
      title: '${block.name} · ${'{n}. Soru'.tr.replaceFirst('{n}', '${index + 1}')}',
      initial: draft.topics[index],
    );
    if (chosen != null && mounted) _setTopic(block.name, index, chosen);
  }

  /// Yapıştırmada listede olmayan konuları kurum listesine ekler; hücreler kaydedilen yazıma güncellenir.
  Future<void> _addUnlisted(OpticalSubjectBlock block, List<String> names) async {
    setState(() => _addingAll = true);
    final renamed = <String, String>{};
    for (final name in names) {
      final saved = await addTopicWithFeedback(context, _topics, block.name, _level, name);
      if (saved != null) renamed[name] = saved;
    }
    if (!mounted) return;
    final draft = _current.subjects[block.name];
    setState(() {
      _addingAll = false;
      if (draft != null) {
        for (var i = 0; i < draft.topics.length; i++) {
          draft.topics[i] = renamed[draft.topics[i].trim()] ?? draft.topics[i];
        }
        _syncTopics(_current.booklet, block.name, draft.topics);
      }
      final note = _note;
      if (note != null) _note = _PasteNote(note.subject, note.answers, note.result, names.where((name) => !renamed.containsKey(name)).toList());
    });
  }

  @override
  void dispose() {
    _title.dispose();
    _topics.dispose();
    for (final controller in _topicControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  /// Konu alanı denetleyicisi kitapçık + ders + soru başına; kitapçık değişince kendi metnini gösterir.
  TextEditingController _topicController(String booklet, String subject, int index, String value) =>
      _topicControllers.putIfAbsent('$booklet|$subject|$index', () => TextEditingController(text: value));

  /// Yapıştırma/kopyalama konu listesini değiştirince açık alanlar yeni metni gösterir.
  void _syncTopics(String booklet, String subject, List<String> topics) {
    for (var i = 0; i < topics.length; i++) {
      final controller = _topicControllers['$booklet|$subject|$i'];
      if (controller != null && controller.text != topics[i]) controller.text = topics[i];
    }
  }

  OpticalKeyDraft get _current => _keys[_active.clamp(0, _keys.length - 1)];

  void _changeTemplate(String id) {
    setState(() {
      _templateId = id;
      _keys = refitOpticalDrafts(_keys, _blocksOf(id));
      _problems = const [];
      _note = null;
      // Yeni denemede seviye henüz elle seçilmediyse yeni şablona göre yeniden tahmin edilir.
      if (widget.exam == null && !_levelTouched) {
        _level = guessLevel(_blocks, _penalty, _templateName(id));
        final penalty = levelPenalty(_level);
        if (penalty != null) _penalty = penalty;
      }
    });
    _loadTopics();
  }

  void _addBooklet() => setState(() {
        _keys = [..._keys, OpticalKeyDraft.empty(String.fromCharCode('A'.codeUnitAt(0) + _keys.length), _blocks)];
        _active = _keys.length - 1;
        _note = null;
      });

  void _removeBooklet() => setState(() {
        final prefix = '${_current.booklet}|';
        for (final key in _topicControllers.keys.where((key) => key.startsWith(prefix)).toList()) {
          _topicControllers.remove(key)?.dispose();
        }
        _keys = [..._keys]..removeAt(_active);
        _active = 0;
        _note = null;
      });

  void _copyTopicsFromFirst() => setState(() {
        final first = _keys.first;
        for (final entry in _current.subjects.entries) {
          final source = first.subjects[entry.key]?.topics;
          if (source != null) entry.value.topics.setAll(0, source.take(entry.value.topics.length));
          _syncTopics(_current.booklet, entry.key, entry.value.topics);
        }
      });

  void _setAnswer(String subject, int index, String answer) => setState(() {
        _current.subjects[subject]!.answers[index] = answer;
      });

  Future<void> _openPaste(OpticalSubjectBlock block) async {
    final picked = await showModalBottomSheet<(bool, String)>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PasteSheet(subject: block.name),
    );
    if (picked == null || !mounted) return;
    final (isAnswers, text) = picked;
    final draft = _current.subjects[block.name];
    if (draft == null) return;
    final result = isAnswers ? pasteOpticalAnswers(draft.answers, text) : pasteOpticalTopics(draft.topics, text);
    // Yapıştırılan konular listedeki yazıma çevrilir; listede olmayanlar yazıldığı gibi kalır ve sayılır.
    final to = result.to;
    final aligned = !isAnswers && to != null ? alignTopics(_optionsFor(block.name), result.values.take(to).toList()) : null;
    setState(() {
      if (result.from != null) (isAnswers ? draft.answers : draft.topics).setAll(0, result.values);
      if (aligned != null) draft.topics.setAll(0, aligned.values);
      if (!isAnswers) _syncTopics(_current.booklet, block.name, draft.topics);
      _note = _PasteNote(block.name, isAnswers, result, aligned?.unlisted ?? const []);
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2035));
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final missing = missingOpticalAnswers(_keys, _blocks);
    setState(() => _problems = missing);
    if (missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Her sorunun doğru cevabını seçin (iptal edilen soru için X).'.tr)),
      );
      return;
    }
    setState(() => _busy = true);
    final id = widget.exam?['id'] as String?;
    final body = <String, Object?>{
      'title': _title.text.trim(),
      'examDateUtc': DateTime.utc(_date.year, _date.month, _date.day, 9).toIso8601String(),
      'templateId': _templateId,
      'wrongPenalty': _penalty,
      'multiMarkAsWrong': _multiWrong,
      'cancelledMode': _cancelledMode,
      'keys': opticalPayloadKeys(_keys, _blocks),
      'level': _level,
    };
    try {
      final custom = widget.client;
      if (custom != null) {
        await custom(id, body);
      } else if (id != null) {
        await ModuleApiClient.instance.put('/api/optical-exams/$id', body);
      } else {
        await ModuleApiClient.instance.post('/api/optical-exams', body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Deneme kaydedildi'.tr)));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${'Deneme kaydedilemedi'.tr}: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = TextStyle(color: theme.hintColor, fontSize: 12);
    final blocks = _blocks;
    final total = blocks.fold<int>(0, (sum, block) => sum + block.count);
    int answeredIn(OpticalKeyDraft key) =>
        blocks.fold<int>(0, (sum, block) => sum + (key.subjects[block.name]?.answers.where((item) => item.isNotEmpty).length ?? 0));

    return AdminScaffold(
      appBar: AppBar(title: Text(widget.exam == null ? 'Yeni optik deneme'.tr : 'Denemeyi düzenle'.tr)),
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                TextField(
                  controller: _title,
                  decoration: InputDecoration(labelText: 'Deneme adı'.tr, hintText: 'Örn: 3. LGS Deneme Sınavı'.tr),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.event_rounded, size: 18),
                        label: Text('${_date.day.toString().padLeft(2, '0')}.${_date.month.toString().padLeft(2, '0')}.${_date.year}'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<String>(
                        initialValue: _templateId.isEmpty ? null : _templateId,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: 'Optik şablon'.tr, isDense: true),
                        items: widget.templates
                            .map((item) => DropdownMenuItem(value: '${item['id']}', child: Text('${item['name']}', overflow: TextOverflow.ellipsis)))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) _changeTemplate(value);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  key: ValueKey('optical-level-$_level'),
                  initialValue: _level,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: 'Seviye (konu listesi)'.tr, isDense: true),
                  items: [
                    DropdownMenuItem(value: '', child: Text('Tüm seviyeler'.tr)),
                    for (final (key, label) in topicLevels) DropdownMenuItem(value: key, child: Text(label.tr)),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    _levelTouched = true;
                    _changeLevel(value);
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  key: ValueKey('optical-penalty-$_penalty'),
                  initialValue: _penalty,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: 'Yanlış götürme'.tr, isDense: true),
                  items: [
                    DropdownMenuItem(value: 3, child: Text('3 yanlış 1 doğruyu götürür (LGS)'.tr)),
                    DropdownMenuItem(value: 4, child: Text('4 yanlış 1 doğruyu götürür (TYT/AYT)'.tr)),
                    DropdownMenuItem(value: 0, child: Text('Yanlış doğruyu götürmez'.tr)),
                  ],
                  onChanged: (value) => setState(() => _penalty = value ?? _penalty),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<bool>(
                        initialValue: _multiWrong,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: 'Çoklu işaretleme'.tr, isDense: true),
                        items: [
                          DropdownMenuItem(value: true, child: Text('Yanlış sayılır'.tr)),
                          DropdownMenuItem(value: false, child: Text('Boş sayılır'.tr)),
                        ],
                        onChanged: (value) => setState(() => _multiWrong = value ?? _multiWrong),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _cancelledMode,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: 'İptal edilen soru (anahtarda X)'.tr, isDense: true),
                        items: [
                          DropdownMenuItem(value: 'exclude', child: Text('Değerlendirme dışı'.tr)),
                          DropdownMenuItem(value: 'correct', child: Text('Herkese doğru sayılır'.tr)),
                        ],
                        onChanged: (value) => setState(() => _cancelledMode = value ?? _cancelledMode),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (blocks.isEmpty)
                  Text('Önce bir optik şablon oluşturun.'.tr, style: hint)
                else ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      for (var i = 0; i < _keys.length; i++)
                        ChoiceChip(
                          key: ValueKey('booklet-${_keys[i].booklet}'),
                          selected: i == _active,
                          label: Text('${'{n} kitapçığı'.tr.replaceFirst('{n}', _keys[i].booklet)}  ${answeredIn(_keys[i])}/$total'),
                          onSelected: (_) => setState(() {
                            _active = i;
                            _note = null;
                          }),
                        ),
                      if (_keys.length < 6)
                        TextButton.icon(onPressed: _addBooklet, icon: const Icon(Icons.add_rounded, size: 18), label: Text('Kitapçık ekle'.tr)),
                      if (_active > 0) TextButton(onPressed: _copyTopicsFromFirst, child: Text('Konuları A’dan kopyala'.tr)),
                      if (_keys.length > 1)
                        TextButton.icon(
                          onPressed: _removeBooklet,
                          style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
                          icon: const Icon(Icons.delete_outline_rounded, size: 18),
                          label: Text('Kitapçığı kaldır'.tr),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('Kitapçıkların cevap ve konuları ayrı tutulur.'.tr, style: hint),
                  const SizedBox(height: 4),
                  Text('Konuyu yazabilir ya da listeden arayarak seçebilirsiniz; listede olmayan konuyu kurum listesine ekleyebilirsiniz.'.tr, style: hint),
                  if (_topics.error)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text('Konu listesi alınamadı; konuları elle yazabilirsiniz.'.tr, style: const TextStyle(fontSize: 12, color: Color(0xFFB45309))),
                    ),
                  const SizedBox(height: 12),
                  for (final block in blocks) _subjectTable(block, theme, hint),
                ],
                if (_problems.isNotEmpty)
                  Container(
                    key: const ValueKey('optical-problems'),
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Kaydetmeden önce tamamlayın:'.tr,
                            style: TextStyle(fontWeight: FontWeight.w700, color: theme.colorScheme.onErrorContainer)),
                        for (final problem in _problems) Text('• $problem', style: TextStyle(color: theme.colorScheme.onErrorContainer, fontSize: 12)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const ValueKey('optical-save'),
                  onPressed: _busy || _title.text.trim().isEmpty || blocks.isEmpty ? null : _save,
                  child: Text('Kaydet'.tr),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _subjectTable(OpticalSubjectBlock block, ThemeData theme, TextStyle hint) {
    final booklet = _current.booklet;
    final draft = _current.subjects[block.name] ?? OpticalSubjectDraft.from(block.count, '', const []);
    final answered = draft.answers.where((item) => item.isNotEmpty).length;
    final topicCount = draft.topics.where((item) => item.trim().isNotEmpty).length;
    final note = _note?.subject == block.name ? _note : null;
    final from = note?.result.from;
    final to = note?.result.to;
    final highlight = theme.colorScheme.primary.withValues(alpha: 0.10);
    final complete = answered == block.count;
    final options = _optionsFor(block.name);
    final unlisted = note?.unlisted ?? const <String>[];

    return AdminPanel(
      key: ValueKey('optical-subject-${block.name}'),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(block.name, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
              Text(
                '{n} / {n} cevap'.tr.replaceFirst('{n}', '$answered').replaceFirst('{n}', '${block.count}'),
                style: TextStyle(fontSize: 12, color: complete ? const Color(0xFF059669) : const Color(0xFFB45309)),
              ),
              const SizedBox(width: 8),
              Text('{n} konu'.tr.replaceFirst('{n}', '$topicCount'), style: hint),
            ],
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _openPaste(block),
              icon: const Icon(Icons.content_paste_rounded, size: 18),
              label: Text('Toplu yapıştır'.tr),
            ),
          ),
          if (note != null)
            Container(
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: (note.result.warning != null ? const Color(0xFFF59E0B) : const Color(0xFF10B981)).withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                [
                  if (from != null)
                    (note.answers ? 'Cevaplar {n}–{n}. sorulara yerleşti (tabloda vurgulu).' : 'Konular {n}–{n}. sorulara yerleşti (tabloda vurgulu).')
                        .tr
                        .replaceFirst('{n}', '$from')
                        .replaceFirst('{n}', '$to'),
                  if (note.result.warning != null) note.result.warning!,
                ].join(' '),
                style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface),
              ),
            ),
          if (unlisted.isNotEmpty)
            Container(
              key: ValueKey('optical-unlisted-${block.name}'),
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${'Listede yok: {n} konu'.tr.replaceFirst('{n}', '${unlisted.length}')} (${unlisted.take(4).join(', ')}${unlisted.length > 4 ? '…' : ''}). ${'Yazıldığı gibi kaldı; aynı konu her denemede aynı adla yazılmalı.'.tr}',
                    style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface),
                  ),
                  TextButton.icon(
                    key: ValueKey('optical-add-unlisted-${block.name}'),
                    onPressed: _addingAll ? null : () => _addUnlisted(block, unlisted),
                    icon: const Icon(Icons.playlist_add_rounded, size: 18),
                    label: Text('Hepsini listeye ekle'.tr),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                SizedBox(width: 64, child: Text('Soru'.tr, style: hint)),
                Expanded(child: Text('Doğru Cevap'.tr, style: hint)),
              ],
            ),
          ),
          for (var i = 0; i < block.count; i++)
            Container(
              key: ValueKey('optical-row-${block.name}-${i + 1}'),
              color: from != null && to != null && i + 1 >= from && i + 1 <= to ? highlight : null,
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      SizedBox(
                        width: 64,
                        child: Text('{n}. Soru'.tr.replaceFirst('{n}', '${i + 1}'), style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Expanded(
                        child: Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: [
                            for (final choice in opticalAnswerChoices)
                              _AnswerChoice(
                                key: ValueKey('answer-$booklet-${block.name}-${i + 1}-$choice'),
                                label: choice,
                                selected: draft.answers[i] == choice,
                                onTap: () => _setAnswer(block.name, i, draft.answers[i] == choice ? '' : choice),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 64, top: 4),
                    child: TextField(
                      key: ValueKey('topic-$booklet-${block.name}-${i + 1}'),
                      controller: _topicController(booklet, block.name, i, draft.topics[i]),
                      maxLength: 150,
                      decoration: InputDecoration(
                        isDense: true,
                        counterText: '',
                        labelText: 'Konu'.tr,
                        hintText: options.isEmpty ? 'İsteğe bağlı'.tr : 'Yazın ya da listeden seçin'.tr,
                        helperText: isUnlistedTopic(options, draft.topics[i]) ? 'listede yok — yalnız bu soruya yazıldı'.tr : null,
                        helperStyle: const TextStyle(color: Color(0xFFB45309), fontSize: 11),
                        suffixIcon: IconButton(
                          key: ValueKey('topic-pick-$booklet-${block.name}-${i + 1}'),
                          tooltip: 'Listeden seç'.tr,
                          icon: const Icon(Icons.manage_search_rounded),
                          onPressed: () => _pickTopic(block, i),
                        ),
                      ),
                      onChanged: (value) {
                        final wasUnlisted = isUnlistedTopic(options, draft.topics[i]);
                        draft.topics[i] = value;
                        if (wasUnlisted != isUnlistedTopic(options, value)) setState(() {});
                      },
                      // Yazılan metin listedeki bir konuyla aynıysa listedeki yazım kullanılır.
                      onSubmitted: (value) {
                        final match = matchTopic(options, value);
                        if (match != null && match.name != value) _setTopic(block.name, i, match.name);
                      },
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Toplu yapıştırma: cevap dizisi ya da satır satır konu. Seçilen tür ve metin geri döner.
class _PasteSheet extends StatefulWidget {
  const _PasteSheet({required this.subject});
  final String subject;

  @override
  State<_PasteSheet> createState() => _PasteSheetState();
}

class _PasteSheetState extends State<_PasteSheet> {
  final _answers = TextEditingController();
  final _topics = TextEditingController();

  @override
  void dispose() {
    _answers.dispose();
    _topics.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.subject} · ${'Toplu yapıştır'.tr}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _answers,
            minLines: 2,
            maxLines: 4,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: 'Cevaplar (1. sorudan başlayarak sırayla)'.tr,
              hintText: 'ABCDEABCDE… ya da 1-A 2-C 3-B'.tr,
            ),
          ),
          const SizedBox(height: 6),
          OutlinedButton(onPressed: () => Navigator.pop(context, (true, _answers.text)), child: Text('Cevapları yerleştir'.tr)),
          const SizedBox(height: 12),
          TextField(
            controller: _topics,
            minLines: 3,
            maxLines: 8,
            decoration: InputDecoration(labelText: 'Konular (her satır bir soru)'.tr, hintText: 'Kesirler\nDenklemler\nGeometri'),
          ),
          const SizedBox(height: 6),
          OutlinedButton(onPressed: () => Navigator.pop(context, (false, _topics.text)), child: Text('Konuları yerleştir'.tr)),
        ],
      ),
    );
  }
}

class _AnswerChoice extends StatelessWidget {
  const _AnswerChoice({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final cancel = label == 'X';
    final background = selected ? (cancel ? const Color(0xFFE11D48) : scheme.primary) : Colors.transparent;
    final foreground = selected ? (cancel ? Colors.white : scheme.onPrimary) : scheme.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      label: cancel ? 'İptal edilen soru'.tr : label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? background : scheme.outlineVariant),
          ),
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: foreground)),
        ),
      ),
    );
  }
}
