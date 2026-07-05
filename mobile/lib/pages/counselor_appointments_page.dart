import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);
const _weekDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

/// Rehberin müsaitlik yönetimi ve randevu onay ekranı.
class CounselorAppointmentsPage extends StatefulWidget {
  const CounselorAppointmentsPage({super.key});

  @override
  State<CounselorAppointmentsPage> createState() =>
      _CounselorAppointmentsPageState();
}

class _CounselorAppointmentsPageState extends State<CounselorAppointmentsPage> {
  List<Map<String, dynamic>> appointments = [];
  List<String> slots = [];
  bool loading = true;
  String? error;

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
      final results = await Future.wait([
        GuidanceApiService.instance.fetchAppointments(),
        GuidanceApiService.instance
            .fetchAvailability()
            .catchError((_) => <String, dynamic>{'slots': []}),
      ]);
      if (!mounted) return;
      setState(() {
        appointments = results[0] as List<Map<String, dynamic>>;
        slots = ((results[1] as Map<String, dynamic>)['slots']
                    as List<dynamic>? ??
                const [])
            .whereType<Map<String, dynamic>>()
            .map((s) => s['slot'].toString())
            .toList();
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

  Future<void> _saveSlots(List<String> next) async {
    try {
      await GuidanceApiService.instance.saveAvailability(next);
      if (!mounted) return;
      setState(() => slots = next);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _decide(Map<String, dynamic> appointment, bool approved) async {
    try {
      await GuidanceApiService.instance
          .decideAppointment(appointment['id'].toString(), approved: approved);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(approved
            ? 'Randevu onaylandı, bildirim gönderildi.'
            : 'Randevu reddedildi, bildirim gönderildi.'),
      ));
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void _openAddSlotSheet() {
    String day = 'Pazartesi';
    TimeOfDay time = const TimeOfDay(hour: 9, minute: 0);

    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Müsaitlik Slotu Ekle'.tr,
                  style:
                      TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: day,
                decoration: InputDecoration(labelText: 'Gün'.tr),
                items: _weekDays
                    .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                    .toList(),
                onChanged: (v) => setSheetState(() => day = v ?? 'Pazartesi'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await showTimePicker(
                      context: sheetContext, initialTime: time);
                  if (picked != null) setSheetState(() => time = picked);
                },
                icon: const Icon(Icons.access_time_rounded, size: 18),
                label: Text(
                    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}'),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _navy),
                  onPressed: () {
                    final slot =
                        '$day ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                    Navigator.pop(sheetContext);
                    if (!slots.contains(slot)) {
                      _saveSlots([...slots, slot]..sort());
                    }
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final pending =
        appointments.where((a) => a['status'] == 'Bekliyor').toList();
    final others =
        appointments.where((a) => a['status'] != 'Bekliyor').toList();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Randevular',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddSlotSheet,
        backgroundColor: _orange,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.more_time_rounded),
        label: const Text('Slot Ekle'),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      _slotsCard(theme, isDark),
                      const SizedBox(height: 16),
                      Text('Bekleyen Talepler (${pending.length})',
                          style:
                              const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      if (pending.isEmpty)
                        _emptyCard(theme, isDark, 'Bekleyen talep yok.')
                      else
                        ...pending
                            .map((a) => _appointmentCard(theme, isDark, a,
                                pendingActions: true)),
                      const SizedBox(height: 16),
                      Text('Geçmiş & Onaylılar'.tr,
                          style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      if (others.isEmpty)
                        _emptyCard(theme, isDark, 'Kayıt yok.')
                      else
                        ...others.map(
                            (a) => _appointmentCard(theme, isDark, a)),
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

  Widget _emptyCard(ThemeData theme, bool isDark, String message) => Container(
        padding: const EdgeInsets.all(20),
        decoration: _cardDecoration(theme, isDark),
        child: Center(
            child: Text(message, style: theme.textTheme.bodyMedium)),
      );

  Widget _slotsCard(ThemeData theme, bool isDark) => Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(theme, isDark),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Haftalık Müsaitlik'.tr,
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (slots.isEmpty)
              Text('Slot eklemeden randevu alınamaz.'.tr,
                  style: theme.textTheme.bodySmall)
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: slots
                    .map((slot) => Chip(
                          label: Text(slot,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 12)),
                          deleteIcon:
                              const Icon(Icons.close_rounded, size: 16),
                          onDeleted: () =>
                              _saveSlots(slots.where((s) => s != slot).toList()),
                        ))
                    .toList(),
              ),
          ],
        ),
      );

  Widget _appointmentCard(ThemeData theme, bool isDark, Map<String, dynamic> a,
      {bool pendingActions = false}) {
    final status = a['status']?.toString() ?? '';
    final statusColor = switch (status) {
      'Onaylandı' => const Color(0xFF22C55E),
      'Reddedildi' => const Color(0xFFEF4444),
      'Tamamlandı' => const Color(0xFF3B82F6),
      _ => _orange,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration(theme, isDark),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${a['requesterName']}'
                  '${a['requesterRole'] == 'parent' ? ' (Veli)' : ''}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
          const SizedBox(height: 4),
          Text(
            '${a['slot']}'
            '${(a['studentName']?.toString() ?? '').isNotEmpty && a['requesterRole'] == 'parent' ? ' • ${a['studentName']}' : ''}',
            style:
                theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
          ),
          if ((a['note']?.toString() ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('"${a['note']}"',
                  style: theme.textTheme.bodySmall),
            ),
          if (pendingActions) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF22C55E)),
                    onPressed: () => _decide(a, true),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Onayla'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEF4444)),
                    onPressed: () => _decide(a, false),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Reddet'),
                  ),
                ),
              ],
            ),
          ] else if (status == 'Onaylandı') ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () async {
                  await GuidanceApiService.instance
                      .completeAppointment(a['id'].toString());
                  _load();
                },
                child: Text('Görüşme Yapıldı'.tr),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
