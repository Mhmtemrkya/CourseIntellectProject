import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);
const _days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const _subjects = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih', 'Coğrafya', 'İngilizce', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Genel'];

const _templates = <String, ({String label, List<(int, String, int, String, String)> items})>{
  'tyt-sprint': (
    label: 'TYT Sprint (yoğun hafta)',
    items: [
      (0, '17:00', 60, 'Matematik', 'TYT problem çözümü'),
      (0, '19:00', 45, 'Türkçe', 'Paragraf denemesi'),
      (1, '17:00', 60, 'Fizik', 'Konu tekrarı + 20 soru'),
      (2, '17:00', 60, 'Matematik', 'Eksik konu çalışması'),
      (3, '17:00', 45, 'Kimya', 'Soru bankası'),
      (4, '17:00', 45, 'Türkçe', 'Dil bilgisi tekrarı'),
      (5, '10:00', 120, 'Genel', 'TYT deneme sınavı'),
      (5, '14:00', 60, 'Genel', 'Deneme analizi'),
      (6, '11:00', 60, 'Genel', 'Haftalık genel tekrar'),
    ],
  ),
  'lgs-duzen': (
    label: 'LGS Düzenli Çalışma',
    items: [
      (0, '17:30', 45, 'Matematik', 'Günün konusu + 15 soru'),
      (1, '17:30', 45, 'Fen Bilimleri', 'Konu tekrarı'),
      (2, '17:30', 45, 'Türkçe', 'Paragraf + sözcük'),
      (3, '17:30', 45, 'Matematik', 'Yeni nesil sorular'),
      (4, '17:30', 45, 'Sosyal Bilgiler', 'Tekrar + test'),
      (5, '10:00', 90, 'Genel', 'LGS deneme'),
      (6, '15:00', 45, 'Genel', 'Hata defteri incelemesi'),
    ],
  ),
  'aliskanlik': (
    label: 'Alışkanlık Kazanma (hafif)',
    items: [
      (0, '18:00', 30, 'Genel', 'Günlük ders tekrarı'),
      (2, '18:00', 30, 'Genel', 'Günlük ders tekrarı'),
      (4, '18:00', 30, 'Genel', 'Haftalık özet çıkarma'),
      (5, '11:00', 45, 'Genel', 'Serbest okuma'),
    ],
  ),
};

/// Rehberin öğrenci adına haftalık çalışma programı düzenlediği ekran.
/// Öğrencinin kendi Çalışma Planı sayfasıyla aynı veri modelini kullanır.
class CounselorPlannerPage extends StatefulWidget {
  const CounselorPlannerPage({super.key, this.initialStudent});

  final String? initialStudent;

  @override
  State<CounselorPlannerPage> createState() => _CounselorPlannerPageState();
}

class _CounselorPlannerPageState extends State<CounselorPlannerPage> {
  List<Map<String, dynamic>> students = [];
  String? student;
  List<Map<String, dynamic>> planItems = [];
  bool loading = false;
  bool dirty = false;
  String? error;
  late DateTime weekStart;

  @override
  void initState() {
    super.initState();
    weekStart = _startOfWeek(DateTime.now());
    student = widget.initialStudent;
    GuidanceApiService.instance.fetchOverview().then((list) {
      if (!mounted) return;
      setState(() => students = list);
    }).catchError((e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    });
    if (student != null) _loadPlan();
  }

  DateTime _startOfWeek(DateTime date) {
    final d = DateTime(date.year, date.month, date.day);
    return d.subtract(Duration(days: (d.weekday - 1) % 7));
  }

  String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  List<DateTime> get weekDates =>
      List.generate(7, (i) => weekStart.add(Duration(days: i)));

  Future<void> _loadPlan() async {
    if (student == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final plan = await GuidanceApiService.instance.fetchStudyPlan(student!);
      List<dynamic> items = const [];
      try {
        items =
            jsonDecode(plan['planItemsSerialized'] as String? ?? '[]') as List;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        planItems = items.whereType<Map<String, dynamic>>().toList();
        loading = false;
        dirty = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (student == null) return;
    try {
      await GuidanceApiService.instance
          .updateStudyPlan(student!, jsonEncode(planItems));
      if (!mounted) return;
      setState(() => dirty = false);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Program kaydedildi: $student')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  List<Map<String, dynamic>> _tasksFor(DateTime day) {
    final key = _iso(day);
    final tasks = planItems
        .where((i) =>
            i['type'] != 'goal' &&
            (i['date']?.toString() ?? '').startsWith(key))
        .toList()
      ..sort((a, b) => (a['startTime']?.toString() ?? '')
          .compareTo(b['startTime']?.toString() ?? ''));
    return tasks;
  }

  void _applyTemplate(String key) {
    final template = _templates[key];
    if (template == null) return;
    final now = DateTime.now().toIso8601String();
    setState(() {
      planItems = [
        ...planItems,
        for (final (day, time, minutes, subject, title) in template.items)
          {
            'id': 'g-${DateTime.now().millisecondsSinceEpoch}-$day-$time',
            'type': 'task',
            'title': title,
            'subject': subject,
            'topic': '',
            'date': _iso(weekDates[day]),
            'startTime': time,
            'endTime': '',
            'durationMinutes': minutes,
            'status': 'pending',
            'source': 'counselor',
            'createdAt': now,
          },
      ];
      dirty = true;
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${template.label} uygulandı — kaydetmeyi unutmayın.')));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Çalışma Programı',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (student != null)
            PopupMenuButton<String>(
              icon: const Icon(Icons.auto_awesome_rounded, color: _orange),
              tooltip: 'Şablon uygula',
              onSelected: _applyTemplate,
              itemBuilder: (_) => _templates.entries
                  .map((e) =>
                      PopupMenuItem(value: e.key, child: Text(e.value.label)))
                  .toList(),
            ),
        ],
      ),
      floatingActionButton: dirty
          ? FloatingActionButton.extended(
              onPressed: _save,
              backgroundColor: _orange,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.save_rounded),
              label: const Text('Kaydet'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: DropdownButtonFormField<String>(
              initialValue: student,
              decoration: InputDecoration(
                labelText: 'Öğrenci',
                filled: true,
                fillColor: theme.cardColor,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
              items: [
                if (student != null &&
                    !students.any((s) => s['studentName'] == student))
                  DropdownMenuItem(value: student, child: Text(student!)),
                ...students.map((s) => DropdownMenuItem(
                      value: s['studentName'] as String,
                      child: Text(
                          '${s['studentName']} (${s['className'] ?? ''})'),
                    )),
              ],
              onChanged: (v) {
                setState(() => student = v);
                _loadPlan();
              },
            ),
          ),
          if (student != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() =>
                        weekStart = weekStart.subtract(const Duration(days: 7))),
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Expanded(
                    child: Center(
                      child: Text(
                        '${weekDates.first.day}.${weekDates.first.month} – ${weekDates.last.day}.${weekDates.last.month}.${weekDates.last.year}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() =>
                        weekStart = weekStart.add(const Duration(days: 7))),
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
            ),
          Expanded(
            child: student == null
                ? const Center(child: Text('Önce öğrenci seçin.'))
                : loading
                    ? const Center(child: CircularProgressIndicator())
                    : error != null
                        ? Center(child: Text(error!))
                        : ListView.builder(
                            padding:
                                const EdgeInsets.fromLTRB(16, 8, 16, 96),
                            itemCount: 7,
                            itemBuilder: (_, index) =>
                                _dayCard(theme, isDark, index),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _dayCard(ThemeData theme, bool isDark, int index) {
    final date = weekDates[index];
    final tasks = _tasksFor(date);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
            child: Row(
              children: [
                Text(_days[index],
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(width: 8),
                Text('${date.day}.${date.month}',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.hintColor)),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => _openAddSheet(index),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Ekle'),
                ),
              ],
            ),
          ),
          if (tasks.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Text('Blok yok',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.hintColor)),
            )
          else
            ...tasks.map((task) {
              final done = task['status'] == 'done' || task['done'] == true;
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: done
                        ? const Color(0xFF22C55E).withValues(alpha: 0.1)
                        : theme.scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: done
                          ? const Color(0xFF22C55E).withValues(alpha: 0.4)
                          : theme.dividerColor,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        done
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        size: 18,
                        color: done
                            ? const Color(0xFF22C55E)
                            : theme.hintColor,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(task['title']?.toString() ?? '',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            Text(
                              '${task['subject']} • ${task['startTime'] ?? '—'} • ${task['durationMinutes']} dk',
                              style: theme.textTheme.bodySmall
                                  ?.copyWith(color: theme.hintColor),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            planItems.removeWhere(
                                (i) => i['id'] == task['id']);
                            dirty = true;
                          });
                        },
                        icon: const Icon(Icons.delete_outline_rounded,
                            size: 20, color: Colors.redAccent),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  void _openAddSheet(int dayIndex) {
    final titleController = TextEditingController();
    String subject = 'Matematik';
    TimeOfDay time = const TimeOfDay(hour: 17, minute: 0);
    int minutes = 45;

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
              Text('${_days[dayIndex]} — Çalışma Bloğu',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                    labelText: 'Başlık (örn. Paragraf denemesi)'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: subject,
                decoration: const InputDecoration(labelText: 'Ders'),
                items: _subjects
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) =>
                    setSheetState(() => subject = v ?? 'Genel'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final picked = await showTimePicker(
                            context: sheetContext, initialTime: time);
                        if (picked != null) {
                          setSheetState(() => time = picked);
                        }
                      },
                      icon: const Icon(Icons.access_time_rounded, size: 18),
                      label: Text(
                          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: minutes,
                      decoration:
                          const InputDecoration(labelText: 'Süre'),
                      items: const [30, 45, 60, 90, 120]
                          .map((m) => DropdownMenuItem(
                              value: m, child: Text('$m dk')))
                          .toList(),
                      onChanged: (v) =>
                          setSheetState(() => minutes = v ?? 45),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _navy),
                  onPressed: () {
                    setState(() {
                      planItems.add({
                        'id':
                            'g-${DateTime.now().millisecondsSinceEpoch}',
                        'type': 'task',
                        'title': titleController.text.trim().isEmpty
                            ? 'Çalışma bloğu'
                            : titleController.text.trim(),
                        'subject': subject,
                        'topic': '',
                        'date': _iso(weekDates[dayIndex]),
                        'startTime':
                            '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
                        'endTime': '',
                        'durationMinutes': minutes,
                        'status': 'pending',
                        'source': 'counselor',
                        'createdAt': DateTime.now().toIso8601String(),
                      });
                      dirty = true;
                    });
                    Navigator.pop(sheetContext);
                  },
                  child: const Text('Ekle'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
