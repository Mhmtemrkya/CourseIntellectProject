import 'dart:convert';

import 'package:student/i18n/app_locale.dart';
import 'package:flutter/material.dart';
import 'package:student/pages/counselor_planner_page.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

const _topicLabels = {
  'motivasyon': 'Motivasyon',
  'sinav-kaygisi': 'Sınav Kaygısı',
  'aile': 'Aile',
  'arkadas': 'Arkadaş İlişkileri',
  'akademik': 'Akademik',
  'diger': 'Diğer',
};

const _inventoryLabels = {
  'ogrenme-stili': 'Öğrenme Stili',
  'sinav-kaygisi': 'Sınav Kaygısı Ölçeği',
  'ilgi-envanteri': 'İlgi Envanteri',
};

/// Öğrenci rehberlik dosyası: özet, sınav trendi, devam, görüşmeler,
/// hedef/program ve envanterler — hepsi canlı veriden.
class CounselorStudentFilePage extends StatefulWidget {
  const CounselorStudentFilePage({super.key, required this.studentName});

  final String studentName;

  @override
  State<CounselorStudentFilePage> createState() =>
      _CounselorStudentFilePageState();
}

class _CounselorStudentFilePageState extends State<CounselorStudentFilePage> {
  Map<String, dynamic>? file;
  bool loading = true;
  String? error;
  int section = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data =
          await GuidanceApiService.instance.fetchStudentFile(widget.studentName);
      if (!mounted) return;
      setState(() {
        file = data;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  List<Map<String, dynamic>> _list(String key) =>
      ((file?[key] as List<dynamic>?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

  ({int total, int done, int? rate}) get planStats {
    List<dynamic> items = const [];
    try {
      items = jsonDecode(
              (file?['studyPlan']?['planItemsSerialized'] as String?) ?? '[]')
          as List<dynamic>;
    } catch (_) {}
    final tasks = items
        .whereType<Map<String, dynamic>>()
        .where((i) => i['type'] != 'goal')
        .toList();
    final done = tasks
        .where((i) => i['status'] == 'done' || i['done'] == true)
        .length;
    return (
      total: tasks.length,
      done: done,
      rate: tasks.isEmpty ? null : (done * 100 / tasks.length).round(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final profile =
        (file?['profile'] as Map<String, dynamic>?) ?? const <String, dynamic>{};

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(widget.studentName,
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      floatingActionButton: loading || error != null
          ? null
          : FloatingActionButton.extended(
              onPressed: _openSessionSheet,
              backgroundColor: _orange,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_comment_rounded),
              label: Text('Görüşme'.tr),
            ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(
                            onPressed: _load, child: const Text('Tekrar Dene')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      _headerCard(theme, isDark, profile),
                      const SizedBox(height: 14),
                      _sectionChips(theme),
                      const SizedBox(height: 14),
                      ..._sectionContent(theme, isDark),
                    ],
                  ),
                ),
    );
  }

  Widget _headerCard(
      ThemeData theme, bool isDark, Map<String, dynamic> profile) {
    final stats = planStats;
    final homework = (file?['homework'] as Map<String, dynamic>?) ?? const {};
    final total = (homework['total'] as num?)?.toInt() ?? 0;
    final submitted = (homework['submitted'] as num?)?.toInt() ?? 0;

    Widget metric(String label, String value) => Expanded(
          child: Column(
            children: [
              Text(value,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              Text(label,
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 11)),
            ],
          ),
        );

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navy, Color(0xFF1E3A66)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: _orange,
                child: Text(
                  widget.studentName
                      .split(' ')
                      .take(2)
                      .map((p) => p.isEmpty ? '' : p[0])
                      .join()
                      .toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.studentName,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 16)),
                    Text(
                      '${profile['className'] ?? ''}'
                      '${(profile['parentName'] ?? '').toString().isNotEmpty ? ' • Veli: ${profile['parentName']}' : ''}',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              metric('Program', stats.rate == null ? '—' : '%${stats.rate}'),
              metric('Ödev',
                  total == 0 ? '—' : '%${(submitted * 100 / total).round()}'),
              metric('Görüşme', '${_list('sessions').length}'),
              metric('Hedef',
                  '%${(file?['goal']?['progress'] as num?)?.toInt() ?? 0}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionChips(ThemeData theme) {
    const labels = ['Özet', 'Görüşmeler', 'Devam', 'Hedef & Program', 'Envanter'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i += 1)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(labels[i]),
                selected: section == i,
                selectedColor: _navy,
                labelStyle: TextStyle(
                  color: section == i
                      ? Colors.white
                      : theme.textTheme.bodyMedium?.color,
                  fontWeight: FontWeight.w700,
                ),
                onSelected: (_) => setState(() => section = i),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _sectionContent(ThemeData theme, bool isDark) =>
      switch (section) {
        1 => _sessionsSection(theme, isDark),
        2 => _attendanceSection(theme, isDark),
        3 => _goalSection(theme, isDark),
        4 => _inventorySection(theme, isDark),
        _ => _summarySection(theme, isDark),
      };

  BoxDecoration _cardDecoration(ThemeData theme, bool isDark) => BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      );

  // ── Özet: sınav trendi grafiği + branş listesi ─────────────────────
  List<Widget> _summarySection(ThemeData theme, bool isDark) {
    final exams = _list('exams');
    final scores = exams
        .map((e) => (e['score'] as num?)?.toDouble() ?? 0)
        .toList();

    final bySubject = <String, List<double>>{};
    for (final exam in exams) {
      bySubject
          .putIfAbsent(exam['subject'] as String? ?? 'Genel', () => [])
          .add((exam['score'] as num?)?.toDouble() ?? 0);
    }

    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sınav Trendi'.tr,
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            if (scores.length < 2)
              Text('Grafik için en az 2 sınav gerekli.'.tr,
                  style: theme.textTheme.bodySmall)
            else
              SizedBox(
                height: 120,
                child: CustomPaint(
                  size: const Size(double.infinity, 120),
                  painter: _SparklinePainter(
                    values: scores,
                    color: _orange,
                    gridColor: theme.dividerColor,
                  ),
                ),
              ),
            if (exams.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Son sınav: ${exams.last['examTitle']} — ${exams.last['score']} puan',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Branş Ortalamaları'.tr,
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (bySubject.isEmpty)
              Text('Sınav kaydı yok.'.tr, style: theme.textTheme.bodySmall)
            else
              ...bySubject.entries.map((entry) {
                final avg = entry.value.reduce((a, b) => a + b) /
                    entry.value.length;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 110,
                        child: Text(entry.key,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700),
                            overflow: TextOverflow.ellipsis),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: (avg / 100).clamp(0, 1),
                            minHeight: 8,
                            backgroundColor:
                                theme.dividerColor.withValues(alpha: 0.4),
                            valueColor: AlwaysStoppedAnimation(
                              avg >= 70
                                  ? const Color(0xFF22C55E)
                                  : avg >= 50
                                      ? _orange
                                      : const Color(0xFFEF4444),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(avg.round().toString(),
                          style:
                              const TextStyle(fontWeight: FontWeight.w800)),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    ];
  }

  // ── Görüşmeler ──────────────────────────────────────────────────────
  List<Widget> _sessionsSection(ThemeData theme, bool isDark) {
    final sessions = _list('sessions');
    if (sessions.isEmpty) {
      return [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: _cardDecoration(theme, isDark),
          child: Center(
              child: Text('Görüşme kaydı yok. Sağ alttan ekleyin.'.tr)),
        ),
      ];
    }
    return sessions
        .map((s) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              decoration: _cardDecoration(theme, isDark),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _orange.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          _topicLabels[s['topic']] ?? s['topic'].toString(),
                          style: const TextStyle(
                              color: _orange,
                              fontWeight: FontWeight.w800,
                              fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(s['sessionType']?.toString() ?? '',
                          style: theme.textTheme.bodySmall),
                      const Spacer(),
                      Text(_formatDate(s['sessionAtUtc']),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.hintColor)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(s['note']?.toString() ?? ''),
                  if (s['followUpAtUtc'] != null &&
                      s['followUpDone'] != true) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text('Takip: ${_formatDate(s['followUpAtUtc'])}',
                            style: const TextStyle(
                                color: _orange, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        TextButton(
                          onPressed: () async {
                            await GuidanceApiService.instance.updateSession(
                              s['id'].toString(),
                              {...s, 'followUpDone': true},
                            );
                            _load();
                          },
                          child: const Text('Takibi Tamamla'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ))
        .toList();
  }

  // ── Devam ───────────────────────────────────────────────────────────
  List<Widget> _attendanceSection(ThemeData theme, bool isDark) {
    final entries = _list('attendance');
    bool isAbsent(Map<String, dynamic> e) {
      final s = (e['status'] as String? ?? '').toLowerCase();
      return s.contains('absent') || s.contains('yok') || s.contains('gelmedi');
    }

    final absents = entries.where(isAbsent).toList().reversed.take(15).toList();
    final absentCount = entries.where(isAbsent).length;

    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            Column(children: [
              Text('${entries.length}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 22)),
              Text('Kayıt (120 gün)'.tr, style: theme.textTheme.bodySmall),
            ]),
            Column(children: [
              Text('$absentCount',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      color: Color(0xFFEF4444))),
              Text('Devamsızlık'.tr, style: theme.textTheme.bodySmall),
            ]),
            Column(children: [
              Text(
                entries.isEmpty
                    ? '—'
                    : '%${((entries.length - absentCount) * 100 / entries.length).round()}',
                style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 22,
                    color: Color(0xFF22C55E)),
              ),
              Text('Katılım'.tr, style: theme.textTheme.bodySmall),
            ]),
          ],
        ),
      ),
      const SizedBox(height: 12),
      if (absents.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: _cardDecoration(theme, isDark),
          child: Center(child: Text('Devamsızlık kaydı yok. 🎉'.tr)),
        )
      else
        ...absents.map((e) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: _cardDecoration(theme, isDark),
              child: Row(
                children: [
                  const Icon(Icons.event_busy_rounded,
                      color: Color(0xFFEF4444), size: 20),
                  const SizedBox(width: 10),
                  Text(_formatDate(e['lessonDate']),
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(e['lesson']?.toString() ?? '',
                        style: theme.textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            )),
    ];
  }

  // ── Hedef & Program ────────────────────────────────────────────────
  List<Widget> _goalSection(ThemeData theme, bool isDark) {
    final goal = (file?['goal'] as Map<String, dynamic>?) ?? const {};
    final stats = planStats;
    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Hedef',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton.icon(
                  onPressed: _openGoalSheet,
                  icon: const Icon(Icons.edit_rounded, size: 16),
                  label: Text('Düzenle'.tr),
                ),
              ],
            ),
            Text(
              (goal['targetSchool'] as String?)?.isNotEmpty == true
                  ? goal['targetSchool'] as String
                  : 'Henüz hedef tanımlanmadı',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
            if ((goal['targetField'] as String?)?.isNotEmpty == true ||
                (goal['targetScore'] as String?)?.isNotEmpty == true)
              Text('${goal['targetField'] ?? ''} ${goal['targetScore'] ?? ''}',
                  style: theme.textTheme.bodySmall),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: ((goal['progress'] as num?)?.toDouble() ?? 0) / 100,
                minHeight: 10,
                backgroundColor: theme.dividerColor.withValues(alpha: 0.4),
                valueColor: const AlwaysStoppedAnimation(_orange),
              ),
            ),
            const SizedBox(height: 4),
            Text('İlerleme %${(goal['progress'] as num?)?.toInt() ?? 0}',
                style: theme.textTheme.bodySmall),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Çalışma Programı'.tr,
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  stats.rate == null ? '—' : '%${stats.rate}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 26),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                      '${stats.done}/${stats.total} görev tamamlandı',
                      style: theme.textTheme.bodySmall),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: _navy),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => CounselorPlannerPage(
                        initialStudent: widget.studentName),
                  ),
                ).then((_) => _load()),
                icon: const Icon(Icons.edit_calendar_rounded),
                label: Text('Programı Düzenle'.tr),
              ),
            ),
          ],
        ),
      ),
    ];
  }

  // ── Envanter ────────────────────────────────────────────────────────
  List<Widget> _inventorySection(ThemeData theme, bool isDark) {
    final inventories = _list('inventories');
    return [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: _inventoryLabels.entries
            .map((entry) => ActionChip(
                  avatar: const Icon(Icons.add_rounded, size: 16),
                  label: Text(entry.value),
                  onPressed: () async {
                    await GuidanceApiService.instance.assignInventory({
                      'studentName': widget.studentName,
                      'inventoryType': entry.key,
                    });
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('${entry.value} atandı.')));
                    _load();
                  },
                ))
            .toList(),
      ),
      const SizedBox(height: 12),
      if (inventories.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: _cardDecoration(theme, isDark),
          child: Center(child: Text('Atanmış envanter yok.'.tr)),
        )
      else
        ...inventories.map((item) {
          List<dynamic> answers = const [];
          try {
            answers = jsonDecode(item['answersJson'] as String? ?? '[]')
                as List<dynamic>;
          } catch (_) {}
          final done = item['status'] == 'Tamamlandı';
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: _cardDecoration(theme, isDark),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _inventoryLabels[item['inventoryType']] ??
                            item['inventoryType'].toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (done
                                ? const Color(0xFF22C55E)
                                : _orange)
                            .withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        item['status'].toString(),
                        style: TextStyle(
                          color:
                              done ? const Color(0xFF22C55E) : _orange,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                if (answers.isNotEmpty) ...[
                  const Divider(height: 20),
                  ...answers.whereType<Map<String, dynamic>>().map(
                        (a) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a['q']?.toString() ?? '',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13)),
                              Text(a['a']?.toString() ?? '',
                                  style: theme.textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ),
                ],
              ],
            ),
          );
        }),
    ];
  }

  // ── Görüşme ekleme sheet'i ─────────────────────────────────────────
  void _openSessionSheet() {
    final noteController = TextEditingController();
    String sessionType = 'bireysel';
    String topic = 'akademik';
    String visibility = 'guidance';
    DateTime? followUp;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Görüşme Kaydı — ${widget.studentName}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: sessionType,
                        decoration: InputDecoration(labelText: 'Tür'.tr),
                        items: const [
                          DropdownMenuItem(
                              value: 'bireysel', child: Text('Bireysel')),
                          DropdownMenuItem(value: 'veli', child: Text('Veli')),
                          DropdownMenuItem(value: 'grup', child: Text('Grup')),
                        ],
                        onChanged: (v) =>
                            setSheetState(() => sessionType = v ?? 'bireysel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: topic,
                        decoration: const InputDecoration(labelText: 'Konu'),
                        items: _topicLabels.entries
                            .map((e) => DropdownMenuItem(
                                value: e.key, child: Text(e.value)))
                            .toList(),
                        onChanged: (v) =>
                            setSheetState(() => topic = v ?? 'diger'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: noteController,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Görüşme notu'.tr,
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: visibility,
                  decoration: const InputDecoration(labelText: 'Gizlilik'),
                  items: [
                    DropdownMenuItem(
                        value: 'private', child: Text('Sadece Ben')),
                    DropdownMenuItem(
                        value: 'guidance', child: Text('Rehberlik Servisi')),
                    DropdownMenuItem(
                        value: 'admin',
                        child: Text('İdareyle Paylaşılabilir'.tr)),
                  ],
                  onChanged: (v) =>
                      setSheetState(() => visibility = v ?? 'guidance'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(followUp == null
                          ? 'Takip tarihi yok'
                          : 'Takip: ${followUp!.day}.${followUp!.month}.${followUp!.year}'),
                    ),
                    TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: sheetContext,
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 180)),
                        );
                        if (picked != null) {
                          setSheetState(() => followUp = picked);
                        }
                      },
                      child: Text('Takip Tarihi Seç'.tr),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: _orange),
                    onPressed: () async {
                      if (noteController.text.trim().isEmpty) return;
                      await GuidanceApiService.instance.createSession({
                        'studentName': widget.studentName,
                        'className':
                            file?['profile']?['className'] ?? '',
                        'sessionType': sessionType,
                        'topic': topic,
                        'note': noteController.text.trim(),
                        'visibility': visibility,
                        if (followUp != null)
                          'followUpAtUtc': followUp!.toUtc().toIso8601String(),
                      });
                      if (!sheetContext.mounted) return;
                      Navigator.pop(sheetContext);
                      _load();
                    },
                    child: const Text('Kaydet'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Hedef düzenleme sheet'i ────────────────────────────────────────
  void _openGoalSheet() {
    final goal = (file?['goal'] as Map<String, dynamic>?) ?? const {};
    final school =
        TextEditingController(text: goal['targetSchool'] as String? ?? '');
    final field =
        TextEditingController(text: goal['targetField'] as String? ?? '');
    final score =
        TextEditingController(text: goal['targetScore'] as String? ?? '');
    double progress = ((goal['progress'] as num?)?.toDouble() ?? 0);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Hedef Düzenle'.tr,
                  style:
                      TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                  controller: school,
                  decoration:
                      const InputDecoration(labelText: 'Hedef okul')),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                        controller: field,
                        decoration:
                            InputDecoration(labelText: 'Alan/Bölüm'.tr)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                        controller: score,
                        decoration:
                            const InputDecoration(labelText: 'Puan/Net')),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('İlerleme: %${progress.round()}'),
              Slider(
                value: progress,
                max: 100,
                activeColor: _orange,
                onChanged: (v) => setSheetState(() => progress = v),
              ),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _navy),
                  onPressed: () async {
                    await GuidanceApiService.instance
                        .saveGoal(widget.studentName, {
                      'targetSchool': school.text.trim(),
                      'targetField': field.text.trim(),
                      'targetScore': score.text.trim(),
                      'progress': progress.round(),
                      'note': '',
                    });
                    if (!sheetContext.mounted) return;
                    Navigator.pop(sheetContext);
                    _load();
                  },
                  child: const Text('Kaydet'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(dynamic value) {
    final d = DateTime.tryParse(value?.toString() ?? '');
    if (d == null) return '—';
    return '${d.day}.${d.month}.${d.year}';
  }
}

/// Basit çizgi grafik: sınav puanlarının trendini çizer (0-100 aralığı).
class _SparklinePainter extends CustomPainter {
  _SparklinePainter({
    required this.values,
    required this.color,
    required this.gridColor,
  });

  final List<double> values;
  final Color color;
  final Color gridColor;

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = gridColor.withValues(alpha: 0.5)
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i += 1) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final path = Path();
    final fill = Path();
    final stepX =
        values.length > 1 ? size.width / (values.length - 1) : size.width;
    for (var i = 0; i < values.length; i += 1) {
      final x = stepX * i;
      final y = size.height * (1 - (values[i] / 100).clamp(0.0, 1.0));
      if (i == 0) {
        path.moveTo(x, y);
        fill.moveTo(x, size.height);
        fill.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fill.lineTo(x, y);
      }
    }
    fill.lineTo(stepX * (values.length - 1), size.height);
    fill.close();

    canvas.drawPath(
      fill,
      Paint()..color = color.withValues(alpha: 0.12),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round,
    );

    final dotPaint = Paint()..color = color;
    for (var i = 0; i < values.length; i += 1) {
      final x = stepX * i;
      final y = size.height * (1 - (values[i] / 100).clamp(0.0, 1.0));
      canvas.drawCircle(Offset(x, y), 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.values != values;
}
