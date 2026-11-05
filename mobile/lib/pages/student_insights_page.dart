import 'dart:async';

import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/module_api_client.dart';
import '../widgets/admin_ui.dart';
import '../widgets/topic_recommendations_card.dart';


String _pct(Object? raw) {
  final value = (raw as num?)?.toDouble();
  if (value == null) return '—';
  final text = value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(1).replaceAll('.', ',');
  return '%$text';
}

Color _successColor(num value) => value >= 80
    ? const Color(0xFF16A34A)
    : value >= 50
    ? const Color(0xFFD97706)
    : const Color(0xFFE11D48);

Widget _successBar(BuildContext context, Object? raw) {
  final value = ((raw as num?) ?? 0).toDouble().clamp(0, 100);
  return Row(
    children: [
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: value / 100,
            minHeight: 6,
            color: _successColor(value),
            backgroundColor: Theme.of(context).dividerColor.withValues(alpha: 0.2),
          ),
        ),
      ),
      const SizedBox(width: 8),
      SizedBox(
        width: 48,
        child: Text(_pct(raw), textAlign: TextAlign.end, style: const TextStyle(fontSize: 12)),
      ),
    ],
  );
}

/// Öğrenci konu analizi (öğretmen, rehber, yönetici). Hangi öğrenci hangi konuda zorlanıyor.
class StudentInsightsPage extends StatefulWidget {
  const StudentInsightsPage({super.key});

  @override
  State<StudentInsightsPage> createState() => _StudentInsightsPageState();
}

class _StudentInsightsPageState extends State<StudentInsightsPage> {
  final _client = ModuleApiClient.instance;
  Map<String, dynamic>? _overview;
  bool _isTeacher = false;
  Map<String, dynamic>? _class;
  String _className = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(AuthSessionStore.instance.load().then((session) {
      final role = (session?.primaryRole ?? '').toLowerCase();
      if (mounted) setState(() => _isTeacher = role == 'teacher');
    }));
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    try {
      final overview = asMap(await _client.get('/api/insights'));
      final classes = asMapList(overview['classes']);
      setState(() {
        _overview = overview;
        _error = null;
        if (_className.isEmpty && classes.isNotEmpty) _className = '${classes.first['className']}';
      });
      await _loadClass();
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  Future<void> _loadClass() async {
    if (_className.isEmpty) return;
    try {
      final data = asMap(await _client.get('/api/insights/classes/${Uri.encodeComponent(_className)}'));
      if (mounted) setState(() => _class = data);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  /// Öğretmene sınıf önerisi: sınıf tekrarı ya da etüt grubu (adlar yalnız personele gelir).
  Widget _classAction(Map<String, dynamic> action, TextStyle hint) {
    final kind = classActionKinds['${action['kind']}'] ?? classActionKinds['study_group']!;
    final names = (action['studentNames'] as List?)?.map((item) => '$item').toList() ?? const <String>[];
    final plan = questionPlan(action['suggestedQuestions']);
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${action['topic']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text('${action['subject']}', style: hint),
                  ],
                ),
              ),
              AdminAccentBadge(label: kind.$1.tr, color: kind.$3),
            ],
          ),
          const SizedBox(height: 6),
          Text(kind.$2.tr),
          if (names.isNotEmpty) Text(names.join(', '), style: const TextStyle(fontWeight: FontWeight.w700)),
          if (plan != null) Text(plan),
          Text(
            '${'Neden:'.tr} ${'konuda soru çözen {n} öğrenciden {m} öğrenci zorlanıyor'.tr.replaceFirst('{n}', '${action['studentCount']}').replaceFirst('{m}', '${action['strugglingStudentCount']}')} • ${'sınıf başarısı'.tr} ${_pct(action['successRate'])}',
            style: hint,
          ),
        ],
      ),
    );
  }

  /// Sınıfta son 8 haftanın öneri sonuçları; hiç kayıt yoksa gösterilmez.
  Widget? _followupSummary(Map<String, dynamic> summary, TextStyle hint) {
    int n(String key) => (summary[key] as num?)?.toInt() ?? 0;
    if (n('improved') + n('steady') + n('declined') + n('pending') + n('notPracticed') == 0) return null;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(
        '${'Son 8 haftadaki öneriler: '.tr}${'{a} konuda ilerleme, {b} konuda belirgin değişim yok, {c} konuda düşüş'.tr.replaceFirst('{a}', '${n('improved')}').replaceFirst('{b}', '${n('steady')}').replaceFirst('{c}', '${n('declined')}')} • ${'{d} ölçülüyor, {e} çalışılmadı'.tr.replaceFirst('{d}', '${n('pending')}').replaceFirst('{e}', '${n('notPracticed')}')}',
        style: hint,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final overview = _overview;
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    if (overview == null) {
      return AdminScaffold(
        appBar: AppBar(title: Text('Konu Analizi'.tr)),
        child: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Padding(
                  padding: const EdgeInsets.all(24),
                  child: FilledButton(onPressed: _loadOverview, child: Text(_error!)),
                ),
        ),
      );
    }
    final classes = asMapList(overview['classes']);
    final data = _class;
    final students = asMapList(data?['students']);
    final struggling = asMapList(data?['topics']).where((item) => ((item['strugglingStudentCount'] as num?) ?? 0) > 0).toList();

    return AdminScaffold(
      appBar: AppBar(title: Text('Konu Analizi'.tr)),
      child: RefreshIndicator(
        onRefresh: _loadClass,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            AdminHeroCard(
              eyebrow:
                  (overview['aiEnabled'] == true
                          ? 'Yapay zekâ notu: {m}'.tr.replaceFirst('{m}', '${overview['aiModel']}')
                          : 'Yapay zekâ notu kapalı — şablon not')
                      .tr,
              title: 'Öğrenci Konu Analizi'.tr,
              description: 'Hangi öğrencinin hangi konuda zorlandığını, nedenini ve ne yapılabileceğini gösterir.'.tr,
              colors: const [Color(0xFF083344), Color(0xFF0891B2)],
              metrics: [
                AdminHeroMetric(label: 'Aktif öğrenci'.tr, value: '${data?['activeStudentCount'] ?? 0}/${data?['studentCount'] ?? 0}'),
                AdminHeroMetric(label: 'Çözülen soru'.tr, value: '${data?['solved'] ?? 0}'),
                AdminHeroMetric(label: 'Sınıf başarısı'.tr, value: _pct(data?['successRate'])),
              ],
            ),
            const SizedBox(height: 12),
            if (classes.isEmpty)
              AdminPanel(
                child: Text(
                  (_isTeacher
                          ? 'Konu analizinde yalnız ders verdiğiniz ya da size atanmış sınıflar görünür. Yöneticiniz ders programınızı, sınıf öğretmenliğinizi ya da personel kaydınızdaki atanmış sınıfları girdiğinde sınıflarınız burada listelenir.'
                          : 'Öğrenciler sınıflara atanınca analiz burada görünür.')
                      .tr,
                ),
              )
            else ...[
              DropdownButtonFormField<String>(
                initialValue: _className,
                decoration: InputDecoration(labelText: 'Sınıf'.tr, isDense: true),
                items: classes.map((item) => DropdownMenuItem(value: '${item['className']}', child: Text('${item['className']}'))).toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _className = value;
                    _class = null;
                  });
                  _loadClass();
                },
              ),
              const SizedBox(height: 8),
              Text(
                'Optik denemelerde yalnız cevap anahtarında konusu girilmiş sorular dahildir. Bir konu en az {n} soru çözülmeden “zayıf” sayılmaz.'
                    .tr
                    .replaceFirst('{n}', '${data?['minSample'] ?? 5}'),
                style: hint,
              ),
              const SizedBox(height: 12),
              if (data == null)
                const Center(
                  child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()),
                )
              else if (((data['solved'] as num?) ?? 0) == 0)
                AdminPanel(
                  child: Column(
                    children: [
                      const Icon(Icons.menu_book_outlined, size: 36),
                      const SizedBox(height: 8),
                      Text('Bu sınıfta henüz konu verisi yok'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(
                        'Öğrenciler online sınav ya da soru bankası çalışması yaptıkça analiz oluşur.'.tr,
                        style: hint,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else ...[
                AdminSectionTitle(title: 'Sınıf için öneriler'.tr),
                if (asMapList(data['actions']).isEmpty)
                  Text('Sınıf düzeyinde öneri için yeterli ortak zorluk yok; öneriler öğrenci bazında aşağıda.'.tr, style: hint),
                ...asMapList(data['actions']).map((action) => _classAction(action, hint)),
                ?_followupSummary(asMap(data['followups']), hint),
                const SizedBox(height: 12),
                AdminSectionTitle(title: 'Sınıfın zorlandığı konular'.tr),
                if (struggling.isEmpty) Text('Belirgin bir ortak zorluk yok.'.tr, style: hint),
                ...struggling
                    .take(6)
                    .map(
                      (topic) => AdminPanel(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text('${topic['topic']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                ),
                                AdminAccentBadge(
                                  label: '{n} öğrenci'.tr.replaceFirst('{n}', '${topic['strugglingStudentCount']}'),
                                  color: const Color(0xFFE11D48),
                                ),
                              ],
                            ),
                            Text('${topic['subject']}', style: hint),
                            const SizedBox(height: 6),
                            _successBar(context, topic['successRate']),
                          ],
                        ),
                      ),
                    ),
                const SizedBox(height: 8),
                AdminSectionTitle(title: 'Öğrenciler'.tr),
                ...students.map((student) {
                  final weak = ((student['weakTopicCount'] as num?) ?? 0).toInt();
                  final solved = ((student['solved'] as num?) ?? 0).toInt();
                  return AdminPanel(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => StudentInsightDetailPage(
                            studentUserId: '${student['studentUserId']}',
                            aiEnabled: overview['aiEnabled'] == true,
                          ),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text('${student['fullName']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                              ),
                              if (weak > 0) AdminAccentBadge(label: '${'Zayıf konu'.tr}: $weak', color: const Color(0xFFE11D48)),
                              const Icon(Icons.chevron_right_rounded),
                            ],
                          ),
                          const SizedBox(height: 6),
                          if (solved > 0) _successBar(context, student['successRate']) else Text('Veri yok'.tr, style: hint),
                          if (student['topWeakTopic'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text('${'Öncelik'.tr}: ${student['topWeakTopic']} (${student['topWeakSubject']})', style: hint),
                            ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class StudentInsightDetailPage extends StatefulWidget {
  final String studentUserId;
  final bool aiEnabled;
  const StudentInsightDetailPage({super.key, required this.studentUserId, required this.aiEnabled});

  @override
  State<StudentInsightDetailPage> createState() => _StudentInsightDetailPageState();
}

class _StudentInsightDetailPageState extends State<StudentInsightDetailPage> {
  final _client = ModuleApiClient.instance;
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = asMap(await _client.get('/api/insights/students/${widget.studentUserId}'));
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
      });
      // Not hazırlanırken birkaç saniyede bir yenilenir.
      _poll?.cancel();
      if (asMap(data['note'])['status'] == 'pending') _poll = Timer(const Duration(seconds: 3), _load);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  void _snack(String text) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _generate() async {
    setState(() => _busy = true);
    try {
      await _client.post('/api/insights/students/${widget.studentUserId}/note', {});
      await _load();
    } catch (error) {
      _snack('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _review(String noteId, String action, [String? edited]) async {
    setState(() => _busy = true);
    try {
      await _client.post('/api/insights/notes/$noteId/review', {'action': action, 'editedText': edited});
      _snack((action == 'reject' ? 'Not reddedildi' : 'Değerlendirme kaydedildi').tr);
      await _load();
    } catch (error) {
      _snack('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(String noteId, String text) async {
    final controller = TextEditingController(text: text);
    final result = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Düzelt'.tr),
        content: TextField(controller: controller, maxLines: 6, maxLength: 2000),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, controller.text.trim()), child: Text('Kaydet'.tr)),
        ],
      ),
    );
    controller.dispose();
    if (result != null && result.length >= 20) await _review(noteId, 'edit', result);
  }

  /// Önceki önerinin sonrası: öneri anındaki başarı → sonraki cevaplar ("işe yaradı" denmez).
  Widget _followup(Map<String, dynamic> item, TextStyle hint) {
    final status = followupStatuses['${item['status']}'] ?? followupStatuses['pending']!;
    final issued = DateTime.tryParse('${item['issuedAtUtc']}')?.toLocal();
    final date = issued == null ? '' : '${issued.day.toString().padLeft(2, '0')}.${issued.month.toString().padLeft(2, '0')}.${issued.year}';
    final after = item['afterSuccessRate'];
    final result = after != null
        ? '${_pct(item['baselineSuccessRate'])} → ${_pct(after)} (${'{n} yeni soru'.tr.replaceFirst('{n}', '${item['afterSolved']}')})'
        : '${item['status']}' == 'not_practiced'
            ? 'Öneriden sonra bu konuda soru çözülmedi.'.tr
            : 'Ölçüm için en az 5 yeni soru gerekiyor (şu an {n}).'.tr.replaceFirst('{n}', '${item['afterSolved']}');
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['topic']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                Text('${item['subject']} • ${'öneri:'.tr} $date', style: hint),
                Text(result, style: hint),
              ],
            ),
          ),
          AdminAccentBadge(label: status.$1.tr, color: status.$2),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    return AdminScaffold(
      appBar: AppBar(title: Text('${data?['fullName'] ?? 'Öğrenci'.tr}')),
      child: data == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: FilledButton(onPressed: _load, child: Text(_error!)),
                    ),
            )
          : ((data['solved'] as num?) ?? 0) == 0
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Bu öğrenci henüz online sınav ya da soru bankası çalışması yapmamış.'.tr, textAlign: TextAlign.center),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                children: [
                  Text(
                    '${data['className']} • ${'({n} soru)'.tr.replaceFirst('{n}', '${data['solved']}')} • ${_pct(data['successRate'])}',
                    style: hint,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: asMapList(data['subjects'])
                        .map(
                          (subject) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.4)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${subject['subject']}', style: hint),
                                Text(_pct(subject['successRate']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 12),
                  _noteCard(asMap(data['note']), asMapList(data['weakTopics']).isNotEmpty, hint),
                  const SizedBox(height: 12),
                  AdminSectionTitle(title: 'Öncelikli konular'.tr),
                  if (asMapList(data['weakTopics']).isEmpty) Text('Belirgin bir zayıf konu yok.'.tr, style: hint),
                  ...asMapList(data['weakTopics']).map((topic) {
                    final diagnosis = topicDiagnoses['${topic['diagnosis']}'] ?? topicDiagnoses['misconception']!;
                    return AdminPanel(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              ?topicPriorityBadge(context, topic['priority']),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${topic['topic']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                                    Text('${topic['subject']}', style: hint),
                                  ],
                                ),
                              ),
                              AdminAccentBadge(label: diagnosis.$1.tr, color: diagnosis.$3),
                            ],
                          ),
                          const SizedBox(height: 6),
                          _successBar(context, topic['successRate']),
                          if (topic['classSuccessRate'] != null)
                            Text('Sınıf %{n}'.tr.replaceFirst('%{n}', _pct(topic['classSuccessRate'])), style: hint),
                          const SizedBox(height: 6),
                          ...topicAdviceLines(topic, diagnosis.$2, hint),
                        ],
                      ),
                    );
                  }),
                  if (asMapList(data['followups']).isNotEmpty) ...[
                    const SizedBox(height: 8),
                    AdminSectionTitle(title: 'Önceki öneriler ve sonrası'.tr),
                    ...asMapList(data['followups']).map((item) => _followup(item, hint)),
                  ],
                  if (asMapList(data['strongTopics']).isNotEmpty) ...[
                    const SizedBox(height: 8),
                    AdminSectionTitle(title: 'Güçlü konular'.tr),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: asMapList(data['strongTopics'])
                          .map(
                            (topic) => AdminAccentBadge(
                              label: '${topic['topic']} • ${_pct(topic['successRate'])}',
                              color: const Color(0xFF16A34A),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 12),
                  AdminSectionTitle(title: 'Ders / Konu'.tr),
                  ...asMapList(data['topics']).map((topic) {
                    final status = topic['hasEnoughData'] != true
                        ? 'Yetersiz veri'
                        : topic['isWeak'] == true
                        ? 'Zayıf'
                        : topic['isStrong'] == true
                        ? 'Güçlü'
                        : 'Normal';
                    final trend = '${topic['trend']}';
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text('${topic['topic']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        '${topic['subject']} • ${'Doğru'.tr} ${topic['correct']} • ${'Yanlış'.tr} ${topic['wrong']} • ${'Boş'.tr} ${topic['blank']}',
                        style: hint,
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (trend == 'up') const Icon(Icons.north_east_rounded, size: 14, color: Color(0xFF16A34A)),
                              if (trend == 'down') const Icon(Icons.south_east_rounded, size: 14, color: Color(0xFFE11D48)),
                              Text(
                                _pct(topic['successRate']),
                                style: TextStyle(fontWeight: FontWeight.w800, color: _successColor((topic['successRate'] as num?) ?? 0)),
                              ),
                            ],
                          ),
                          Text(status.tr, style: hint),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }

  Widget _noteCard(Map<String, dynamic> note, bool hasWeak, TextStyle hint) {
    final status = '${note['status']}';
    final ready = status == 'ready' && note['text'] != null;
    final noteId = '${note['id']}';
    final review = '${note['reviewStatus']}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: const Color(0xFF0891B2).withValues(alpha: 0.08),
        border: Border.all(color: const Color(0xFF0891B2).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, size: 18, color: Color(0xFF0891B2)),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Öğretmen notu'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              if (ready)
                AdminAccentBadge(
                  label: note['source'] == 'llm' ? '${'Yapay zekâ'.tr} • ${note['model'] ?? ''}' : 'Şablon'.tr,
                  color: const Color(0xFF64748B),
                ),
            ],
          ),
          if (review == 'Approved' || review == 'Edited' || review == 'Rejected')
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: AdminAccentBadge(
                label:
                    (review == 'Approved'
                            ? 'Onaylandı'
                            : review == 'Edited'
                            ? 'Öğretmen düzeltti'
                            : 'Reddedildi')
                        .tr,
                color: review == 'Rejected' ? const Color(0xFFE11D48) : const Color(0xFF16A34A),
              ),
            ),
          const SizedBox(height: 8),
          if (status == 'pending')
            Row(
              children: [
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 8),
                Text('Not hazırlanıyor…'.tr, style: hint),
              ],
            )
          else if (ready) ...[
            Text('${note['text']}'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _review(noteId, 'approve'),
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: Text('Doğru'.tr),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _edit(noteId, '${note['text']}'),
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: Text('Düzelt'.tr),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _review(noteId, 'reject'),
                  icon: const Icon(Icons.thumb_down_outlined, size: 18),
                  label: Text('Yanlış'.tr),
                ),
              ],
            ),
            Text('Değerlendirmeniz, kurumunuza özel öneri modelini eğitmek için kullanılır.'.tr, style: hint),
          ] else
            Text(
              (hasWeak
                      ? (widget.aiEnabled
                            ? 'Konu analizinden öğretmen için kısa bir not oluşturulabilir.'
                            : 'Yapay zekâ kapalı; not, konu analizinden şablonla oluşturulur.')
                      : 'Belirgin bir zayıf konu yok; not güçlü konuları özetler.')
                  .tr,
              style: hint,
            ),
          if ((!ready || note['isCurrent'] != true) && status != 'pending')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: FilledButton.icon(
                onPressed: _busy ? null : _generate,
                icon: const Icon(Icons.refresh_rounded),
                label: Text((ready ? 'Veri değişti — yenile' : 'Not oluştur').tr),
              ),
            ),
        ],
      ),
    );
  }
}
