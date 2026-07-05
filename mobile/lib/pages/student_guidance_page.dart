import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

const _inventoryMeta = <String, ({String label, List<String> questions})>{
  'ogrenme-stili': (
    label: 'Öğrenme Stili',
    questions: [
      'Yeni bir konuyu en kolay nasıl öğrenirsin? (okuyarak / dinleyerek / yaparak)',
      'Ders çalışırken ortamın nasıl olmalı? (sessiz / müzikli / kalabalık)',
      'Not tutar mısın, nasıl?',
      'En verimli çalıştığın saat aralığı hangisi?',
      'Bir konuyu anlamadığında ilk ne yaparsın?',
    ],
  ),
  'sinav-kaygisi': (
    label: 'Sınav Kaygısı Ölçeği',
    questions: [
      'Sınavdan önceki gece uykun nasıl olur?',
      'Sınav sırasında bildiğin soruları unuttuğun olur mu? Ne sıklıkla?',
      'Sınav sonuçları açıklanmadan önce neler hissedersin?',
      'Sınav kaygısının derslerini etkilediğini düşünüyor musun? Nasıl?',
      'Kaygını azaltmak için ne yapıyorsun?',
    ],
  ),
  'ilgi-envanteri': (
    label: 'İlgi Envanteri',
    questions: [
      'Boş zamanlarında en çok ne yapmaktan hoşlanırsın?',
      'Hangi dersleri seviyorsun, neden?',
      'İleride hangi mesleği yapmak istersin?',
      'Bir problemi çözerken tek başına mı, grupla mı çalışmayı tercih edersin?',
      'Seni en çok ne motive eder?',
    ],
  ),
};

/// Öğrencinin rehberlik ekranı: randevu talebi, randevularım ve atanan
/// envanterleri doldurma. Çalışma programı mevcut "Çalışma Planı" sayfasında
/// görünür (rehberin eklediği bloklar oraya düşer).
class StudentGuidancePage extends StatefulWidget {
  const StudentGuidancePage({super.key});

  @override
  State<StudentGuidancePage> createState() => _StudentGuidancePageState();
}

class _StudentGuidancePageState extends State<StudentGuidancePage> {
  List<Map<String, dynamic>> counselors = [];
  List<Map<String, dynamic>> appointments = [];
  List<Map<String, dynamic>> inventories = [];
  List<Map<String, dynamic>> slots = [];
  String? counselor;
  String? selectedSlot;
  final noteController = TextEditingController();
  bool loading = true;
  bool sending = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    noteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        GuidanceApiService.instance.fetchCounselors(),
        GuidanceApiService.instance.fetchAppointments(mine: true),
        GuidanceApiService.instance
            .fetchInventories()
            .catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        counselors = results[0];
        appointments = results[1];
        inventories = results[2];
        counselor ??= counselors.isNotEmpty
            ? counselors.first['fullName'] as String?
            : null;
        loading = false;
      });
      if (counselor != null) _loadSlots();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _loadSlots() async {
    if (counselor == null) return;
    try {
      final availability =
          await GuidanceApiService.instance.fetchAvailability(counselor);
      if (!mounted) return;
      setState(() {
        slots = ((availability['slots'] as List<dynamic>?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .where((s) => s['available'] == true)
            .toList();
        selectedSlot = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => slots = []);
    }
  }

  Future<void> _submit() async {
    if (counselor == null || selectedSlot == null) return;
    setState(() => sending = true);
    try {
      await GuidanceApiService.instance.createAppointment({
        'counselorName': counselor,
        'slot': selectedSlot,
        'topic': '',
        'note': noteController.text.trim(),
      });
      if (!mounted) return;
      noteController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Randevu talebin gönderildi.')));
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final pendingInventories =
        inventories.where((i) => i['status'] != 'Tamamlandı').toList();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Rehberlik',
            style: TextStyle(fontWeight: FontWeight.w800)),
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
                            onPressed: _load,
                            child: const Text('Tekrar Dene')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      if (pendingInventories.isNotEmpty) ...[
                        _inventoryBanner(theme, pendingInventories),
                        const SizedBox(height: 14),
                      ],
                      _requestCard(theme, isDark),
                      const SizedBox(height: 16),
                      const Text('Randevularım',
                          style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      if (appointments.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: _cardDecoration(theme, isDark),
                          child: const Center(
                              child: Text('Henüz randevu talebin yok.')),
                        )
                      else
                        ...appointments
                            .map((a) => _appointmentCard(theme, isDark, a)),
                      if (inventories
                          .where((i) => i['status'] == 'Tamamlandı')
                          .isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Text('Tamamladığım Envanterler',
                            style: TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        ...inventories
                            .where((i) => i['status'] == 'Tamamlandı')
                            .map((i) => Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(14),
                                  decoration: _cardDecoration(theme, isDark),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.task_alt_rounded,
                                          color: Color(0xFF22C55E), size: 20),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          _inventoryMeta[i['inventoryType']]
                                                  ?.label ??
                                              i['inventoryType'].toString(),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700),
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
                      ],
                    ],
                  ),
                ),
    );
  }

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

  Widget _inventoryBanner(
      ThemeData theme, List<Map<String, dynamic>> pending) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _orange.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.assignment_rounded, color: _orange, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text('Rehber öğretmenin senden envanter doldurmanı istedi',
                    style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: pending
                .map((item) => ActionChip(
                      backgroundColor: _orange,
                      label: Text(
                        _inventoryMeta[item['inventoryType']]?.label ??
                            item['inventoryType'].toString(),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700),
                      ),
                      onPressed: () => _openInventorySheet(item),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _requestCard(ThemeData theme, bool isDark) => Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Randevu Talep Et',
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            if (counselors.isEmpty)
              Text('Kurumunuzda tanımlı rehber öğretmen bulunamadı.',
                  style: theme.textTheme.bodySmall)
            else ...[
              DropdownButtonFormField<String>(
                initialValue: counselor,
                decoration:
                    const InputDecoration(labelText: 'Rehber Öğretmen'),
                items: counselors
                    .map((c) => DropdownMenuItem(
                          value: c['fullName'] as String,
                          child: Text(c['fullName'] as String),
                        ))
                    .toList(),
                onChanged: (v) {
                  setState(() => counselor = v);
                  _loadSlots();
                },
              ),
              const SizedBox(height: 12),
              if (slots.isEmpty)
                Text('Uygun saat bulunamadı.',
                    style: theme.textTheme.bodySmall)
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: slots
                      .map((s) => ChoiceChip(
                            label: Text(s['slot'].toString()),
                            selected: selectedSlot == s['slot'],
                            selectedColor: _navy,
                            labelStyle: TextStyle(
                              color: selectedSlot == s['slot']
                                  ? Colors.white
                                  : theme.textTheme.bodyMedium?.color,
                              fontWeight: FontWeight.w700,
                            ),
                            onSelected: (_) => setState(
                                () => selectedSlot = s['slot'] as String),
                          ))
                      .toList(),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Görüşmek istediğin konu (opsiyonel)',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _orange),
                  onPressed:
                      sending || selectedSlot == null ? null : _submit,
                  child: Text(
                      sending ? 'Gönderiliyor...' : 'Randevu Talebi Gönder'),
                ),
              ),
            ],
          ],
        ),
      );

  Widget _appointmentCard(
      ThemeData theme, bool isDark, Map<String, dynamic> a) {
    final status = a['status']?.toString() ?? '';
    final statusColor = switch (status) {
      'Onaylandı' => const Color(0xFF22C55E),
      'Reddedildi' => const Color(0xFFEF4444),
      'Tamamlandı' => const Color(0xFF3B82F6),
      _ => _orange,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration(theme, isDark),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(a['counselorName']?.toString() ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                Text(a['slot']?.toString() ?? '',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.hintColor)),
                if ((a['decisionNote']?.toString() ?? '').isNotEmpty)
                  Text('"${a['decisionNote']}"',
                      style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(status,
                style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 12)),
          ),
        ],
      ),
    );
  }

  void _openInventorySheet(Map<String, dynamic> item) {
    final meta = _inventoryMeta[item['inventoryType']];
    if (meta == null) return;
    final controllers =
        meta.questions.map((_) => TextEditingController()).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(meta.label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 12),
              for (var i = 0; i < meta.questions.length; i += 1) ...[
                Text('${i + 1}. ${meta.questions[i]}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: controllers[i],
                  maxLines: 2,
                  decoration: const InputDecoration(
                      hintText: 'Yanıtın...', isDense: true),
                ),
                const SizedBox(height: 12),
              ],
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _orange),
                  onPressed: () async {
                    final answers = [
                      for (var i = 0; i < meta.questions.length; i += 1)
                        {'q': meta.questions[i], 'a': controllers[i].text.trim()},
                    ];
                    if (answers.any((a) => (a['a'] as String).isEmpty)) {
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                          const SnackBar(
                              content: Text('Tüm soruları yanıtla.')));
                      return;
                    }
                    await GuidanceApiService.instance.completeInventory(
                        item['id'].toString(), jsonEncode(answers));
                    if (!sheetContext.mounted) return;
                    Navigator.pop(sheetContext);
                    _load();
                  },
                  child: const Text('Gönder'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
