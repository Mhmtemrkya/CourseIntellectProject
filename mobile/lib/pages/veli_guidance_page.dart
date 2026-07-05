import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

/// Veli rehberlik ekranı: çocukların çalışma programı uyumu + hedef özeti
/// ve rehber öğretmenden randevu talebi.
class VeliGuidancePage extends StatefulWidget {
  const VeliGuidancePage({super.key});

  @override
  State<VeliGuidancePage> createState() => _VeliGuidancePageState();
}

class _VeliGuidancePageState extends State<VeliGuidancePage> {
  List<Map<String, dynamic>> childSummary = [];
  List<Map<String, dynamic>> counselors = [];
  List<Map<String, dynamic>> appointments = [];
  List<Map<String, dynamic>> slots = [];
  String? counselor;
  String? selectedSlot;
  String? selectedChild;
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
        GuidanceApiService.instance
            .fetchParentChildSummary()
            .catchError((_) => <Map<String, dynamic>>[]),
        GuidanceApiService.instance.fetchCounselors(),
        GuidanceApiService.instance.fetchAppointments(mine: true),
      ]);
      if (!mounted) return;
      setState(() {
        childSummary = results[0];
        counselors = results[1];
        appointments = results[2];
        counselor ??= counselors.isNotEmpty
            ? counselors.first['fullName'] as String?
            : null;
        selectedChild ??= childSummary.isNotEmpty
            ? childSummary.first['studentName'] as String?
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
        'studentName': selectedChild ?? '',
        'topic': '',
        'note': noteController.text.trim(),
      });
      if (!mounted) return;
      noteController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Randevu talebiniz gönderildi.'.tr)));
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
                      ...childSummary
                          .map((child) => _childCard(theme, isDark, child)),
                      if (childSummary.isNotEmpty) const SizedBox(height: 8),
                      _requestCard(theme, isDark),
                      const SizedBox(height: 16),
                      Text('Randevularım'.tr,
                          style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      if (appointments.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: _cardDecoration(theme, isDark),
                          child: Center(
                              child: Text('Henüz randevu talebiniz yok.'.tr)),
                        )
                      else
                        ...appointments
                            .map((a) => _appointmentCard(theme, isDark, a)),
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

  Widget _childCard(ThemeData theme, bool isDark, Map<String, dynamic> child) {
    final compliance =
        (child['compliance'] as Map<String, dynamic>?) ?? const {};
    final goal = child['goal'] as Map<String, dynamic>?;
    final rate = (compliance['rate'] as num?)?.toInt();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navy, Color(0xFF1E3A66)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: _orange,
                child: Text(
                  (child['studentName'] as String? ?? '?')
                      .split(' ')
                      .take(2)
                      .map((p) => p.isEmpty ? '' : p[0])
                      .join()
                      .toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(child['studentName'] as String? ?? '',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900)),
                    Text(child['className'] as String? ?? '',
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 12)),
                  ],
                ),
              ),
              Text(rate == null ? '—' : '%$rate',
                  style: const TextStyle(
                      color: _orange,
                      fontWeight: FontWeight.w900,
                      fontSize: 22)),
            ],
          ),
          const SizedBox(height: 12),
          Text('Çalışma programı uyumu'.tr,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (rate ?? 0) / 100,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.15),
              valueColor: const AlwaysStoppedAnimation(_orange),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${compliance['done'] ?? 0}/${compliance['total'] ?? 0} görev tamamlandı',
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7), fontSize: 11),
          ),
          if (goal != null &&
              (goal['targetSchool'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.school_rounded,
                    color: _orange, size: 16),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Hedef: ${goal['targetSchool']}',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text('%${(goal['progress'] as num?)?.toInt() ?? 0}',
                    style: const TextStyle(
                        color: _orange, fontWeight: FontWeight.w900)),
              ],
            ),
          ],
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
            Text('Rehber Öğretmenden Randevu'.tr,
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            if (counselors.isEmpty)
              Text('Kurumda tanımlı rehber öğretmen bulunamadı.'.tr,
                  style: theme.textTheme.bodySmall)
            else ...[
              if (childSummary.length > 1) ...[
                DropdownButtonFormField<String>(
                  initialValue: selectedChild,
                  decoration: InputDecoration(labelText: 'Öğrenci'.tr),
                  items: childSummary
                      .map((c) => DropdownMenuItem(
                            value: c['studentName'] as String,
                            child: Text(c['studentName'] as String),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => selectedChild = v),
                ),
                const SizedBox(height: 10),
              ],
              DropdownButtonFormField<String>(
                initialValue: counselor,
                decoration:
                    InputDecoration(labelText: 'Rehber Öğretmen'.tr),
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
                Text('Uygun saat bulunamadı.'.tr,
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
                decoration: InputDecoration(
                  labelText: 'Görüşme konusu (opsiyonel)'.tr,
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
                  child: Text(sending
                      ? 'Gönderiliyor...'
                      : 'Randevu Talebi Gönder'),
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
                Text(
                  '${a['slot']}'
                  '${(a['studentName']?.toString() ?? '').isNotEmpty ? ' • ${a['studentName']}' : ''}',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.hintColor),
                ),
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
}
