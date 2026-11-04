import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/module_api_client.dart';
import '../widgets/admin_ui.dart';

/// Deneme sonrası çalışma planı uçları; testlerde sahtesi verilir.
class OpticalStudyPlanApi {
  const OpticalStudyPlanApi();

  Future<Map<String, dynamic>> preview(String examId) async {
    final result = await ModuleApiClient.instance.get('/api/optical-exams/$examId/study-plans');
    return result is Map<String, dynamic> ? result : const {};
  }

  Future<Map<String, dynamic>> apply(String examId, List<Map<String, Object?>> students) async {
    final result = await ModuleApiClient.instance.post('/api/optical-exams/$examId/study-plans/apply', {'students': students});
    return result is Map<String, dynamic> ? result : const {};
  }
}

class _Draft {
  _Draft(Map<String, dynamic> row)
      : tasks = [for (final task in (row['tasks'] as List? ?? const []).whereType<Map>()) Map<String, dynamic>.from(task)],
        sendParent = row['hasParent'] == true,
        summary = TextEditingController(text: '${row['parentSummary'] ?? ''}') {
    selected = tasks.isNotEmpty && row['skipReason'] == null && row['alreadyApplied'] != true;
  }

  bool selected = false;
  final List<Map<String, dynamic>> tasks;
  bool sendParent;
  final TextEditingController summary;
}

/// Deneme sonrası çalışma planı (masaüstü OpticalStudyPlanDialog ile aynı akış): öğrenci başına zayıf
/// konulardan bir haftalık görev önerisi ve veli özeti. Öğretmen düzenler, seçer ve onaylar.
class OpticalStudyPlanPage extends StatefulWidget {
  const OpticalStudyPlanPage({super.key, required this.examId, required this.examTitle, this.api = const OpticalStudyPlanApi()});

  final String examId;
  final String examTitle;
  final OpticalStudyPlanApi api;

  @override
  State<OpticalStudyPlanPage> createState() => _OpticalStudyPlanPageState();
}

class _OpticalStudyPlanPageState extends State<OpticalStudyPlanPage> {
  static const _maxTasks = 10;
  Map<String, dynamic>? _preview;
  String? _error;
  bool _busy = false;
  final Map<String, _Draft> _drafts = {};

  List<Map<String, dynamic>> get _rows => (_preview?['students'] as List? ?? const []).whereType<Map<String, dynamic>>().toList();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final draft in _drafts.values) {
      draft.summary.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await widget.api.preview(widget.examId);
      if (!mounted) return;
      setState(() {
        _preview = result;
        for (final row in _rows) {
          _drafts['${row['studentUserId']}'] = _Draft(row);
        }
      });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  bool _blocked(Map<String, dynamic> row) => '${row['skipReason'] ?? ''}'.startsWith('Kurumda aynı adlı');

  List<String> get _problems {
    final problems = <String>[];
    for (final row in _rows) {
      final draft = _drafts['${row['studentUserId']}'];
      if (draft == null || !draft.selected) continue;
      final name = '${row['studentName']}';
      if (draft.tasks.isEmpty) problems.add('$name: ${'en az bir görev gerekli.'.tr}');
      if (draft.tasks.any((task) => '${task['title'] ?? ''}'.trim().isEmpty)) problems.add('$name: ${'boş görev başlığı var.'.tr}');
    }
    return problems;
  }

  Future<void> _apply() async {
    final chosen = _rows.where((row) => _drafts['${row['studentUserId']}']?.selected == true).toList();
    if (chosen.isEmpty || _problems.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      final result = await widget.api.apply(widget.examId, [
        for (final row in chosen)
          {
            'studentUserId': row['studentUserId'],
            'tasks': _drafts['${row['studentUserId']}']!.tasks,
            'sendParentSummary': row['hasParent'] == true && _drafts['${row['studentUserId']}']!.sendParent,
            'parentSummary': _drafts['${row['studentUserId']}']!.summary.text,
          },
      ]);
      if (!mounted) return;
      final skipped = (result['skipped'] as List? ?? const []).map((item) => '$item').toList();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${'{n} öğrenciye {n} görev eklendi'.tr.replaceFirst('{n}', '${result['applied'] ?? 0}').replaceFirst('{n}', '${result['tasksWritten'] ?? 0}')}'
            '${skipped.isEmpty ? '' : ' · ${skipped.join(' ')}'}'),
      ));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${'Planlar eklenemedi'.tr}: $error')));
    }
  }

  Future<void> _editTask(String studentId, int index) async {
    final draft = _drafts[studentId];
    if (draft == null) return;
    final task = draft.tasks[index];
    final title = TextEditingController(text: '${task['title'] ?? ''}');
    final minutes = TextEditingController(text: '${task['durationMinutes'] ?? 30}');
    var date = DateTime.tryParse('${task['date']}') ?? DateTime.now().add(const Duration(days: 1));
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialog) => AlertDialog(
          title: Text('Görevi düzenle'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(key: const ValueKey('plan-task-title'), controller: title, maxLength: 120, decoration: InputDecoration(labelText: 'Görev'.tr)),
              TextField(controller: minutes, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Süre (dk)'.tr)),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.event_rounded, size: 18),
                label: Text('${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}'),
                onPressed: () async {
                  final picked = await showDatePicker(context: dialogContext, initialDate: date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 60)));
                  if (picked != null) setDialog(() => date = picked);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text('Tamam'.tr)),
          ],
        ),
      ),
    );
    if (saved == true && mounted) {
      setState(() {
        task['title'] = title.text.trim();
        task['durationMinutes'] = (int.tryParse(minutes.text) ?? 30).clamp(10, 240);
        task['date'] = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      });
    }
    title.dispose();
    minutes.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    final chosen = _rows.where((row) => _drafts['${row['studentUserId']}']?.selected == true).length;
    final problems = _problems;
    final message = _preview?['message'];

    return AdminScaffold(
      appBar: AppBar(title: Text('${widget.examTitle} · ${'Çalışma planı'.tr}')),
      child: Column(
        children: [
          Expanded(
            child: _preview == null
                ? Center(child: _error == null ? const CircularProgressIndicator() : Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      Text('Her öğrenci için bu denemede zorlandığı konulardan bir haftalık plan önerildi. Düzenleyip onaylayın; onaylamadan hiçbir şey kaydedilmez.'.tr, style: hint),
                      if (message != null) ...[
                        const SizedBox(height: 8),
                        AdminPanel(child: Text('$message', style: const TextStyle(color: Color(0xFFB45309)))),
                      ],
                      if (_preview?['studyPlanEnabled'] == false) ...[
                        const SizedBox(height: 8),
                        Text('Kurumunuzun paketinde Çalışma Programı kapalı: görevler kaydedilir ama öğrenciler programı açamaz.'.tr, style: hint),
                      ],
                      const SizedBox(height: 10),
                      for (final row in _rows) _studentCard(row, hint),
                      if (problems.isNotEmpty)
                        AdminPanel(child: Text(problems.join('\n'), style: const TextStyle(color: Colors.red, fontSize: 12))),
                    ],
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  key: const ValueKey('study-plan-apply'),
                  onPressed: _busy || chosen == 0 || problems.isNotEmpty ? null : _apply,
                  icon: const Icon(Icons.event_available_rounded),
                  label: Text('{n} öğrenciye planı ekle'.tr.replaceFirst('{n}', '$chosen')),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _studentCard(Map<String, dynamic> row, TextStyle hint) {
    final id = '${row['studentUserId']}';
    final draft = _drafts[id]!;
    final weak = (row['weakTopics'] as List? ?? const []).whereType<Map>().toList();
    final blocked = _blocked(row);
    return AdminPanel(
      key: ValueKey('study-plan-$id'),
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CheckboxListTile(
            contentPadding: const EdgeInsets.only(left: 4),
            controlAffinity: ListTileControlAffinity.leading,
            value: draft.selected,
            onChanged: blocked || draft.tasks.isEmpty ? null : (value) => setState(() => draft.selected = value ?? false),
            title: Text('${row['studentName']}', style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(
              weak.isEmpty
                  ? '${row['skipReason'] ?? 'Zayıf konu yok'.tr}'
                  : weak.map((topic) => '${topic['topic']} (${topic['wrong']} Y, ${topic['blank']} B / ${topic['total']})').join(' • '),
              style: hint,
            ),
          ),
          if (blocked) Padding(padding: const EdgeInsets.only(left: 16), child: Text('${row['skipReason']}', style: const TextStyle(color: Colors.red, fontSize: 12))),
          if (row['alreadyApplied'] == true)
            Padding(
              padding: const EdgeInsets.only(left: 16, bottom: 4),
              child: Text('Bu denemenin planı daha önce eklendi; yeniden eklerseniz bekleyen görevler yenisiyle değişir.'.tr, style: hint),
            ),
          if (!blocked)
            for (var i = 0; i < draft.tasks.length; i++)
              ListTile(
                key: ValueKey('plan-task-$id-$i'),
                dense: true,
                contentPadding: const EdgeInsets.only(left: 16),
                title: Text('${draft.tasks[i]['title']}'),
                subtitle: Text('${draft.tasks[i]['date']} · ${draft.tasks[i]['durationMinutes']} dk', style: hint),
                onTap: () => _editTask(id, i),
                trailing: IconButton(
                  tooltip: 'Görevi kaldır'.tr,
                  icon: const Icon(Icons.delete_outline_rounded, size: 20),
                  onPressed: () => setState(() => draft.tasks.removeAt(i)),
                ),
              ),
          if (!blocked && draft.tasks.length < _maxTasks && (draft.tasks.isNotEmpty || weak.isNotEmpty))
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: TextButton.icon(
                onPressed: () {
                  final last = draft.tasks.isEmpty ? null : draft.tasks.last;
                  final tomorrow = DateTime.now().add(const Duration(days: 1));
                  setState(() => draft.tasks.add({
                        'title': 'Yeni görev'.tr,
                        'subject': last?['subject'] ?? (weak.isEmpty ? '' : weak.first['subject']),
                        'topic': '',
                        'date': last?['date'] ?? '${tomorrow.year}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}',
                        'durationMinutes': 30,
                      }));
                },
                icon: const Icon(Icons.add_rounded, size: 18),
                label: Text('Görev ekle'.tr),
              ),
            ),
          if (!blocked && row['hasParent'] == true) ...[
            SwitchListTile(
              contentPadding: const EdgeInsets.only(left: 16),
              value: draft.sendParent,
              onChanged: (value) => setState(() => draft.sendParent = value),
              title: Text('Veliye özet gönder'.tr, style: const TextStyle(fontSize: 14)),
            ),
            if (draft.sendParent)
              Padding(
                padding: const EdgeInsets.only(left: 16),
                child: TextField(controller: draft.summary, maxLines: 3, maxLength: 600, decoration: InputDecoration(labelText: 'Veli özeti'.tr)),
              ),
          ],
        ],
      ),
    );
  }
}
