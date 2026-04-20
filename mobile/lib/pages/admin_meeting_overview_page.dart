import 'package:flutter/material.dart';

import '../services/meeting_request_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminMeetingOverviewPage extends StatefulWidget {
  const AdminMeetingOverviewPage({super.key});

  @override
  State<AdminMeetingOverviewPage> createState() =>
      _AdminMeetingOverviewPageState();
}

class _AdminMeetingOverviewPageState extends State<AdminMeetingOverviewPage> {
  bool _loading = true;
  String? _error;
  List<MeetingRequestApiRecord> _requests = const [];

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
      final data = await MeetingRequestApiService.instance.fetchRequests();
      if (!mounted) return;
      setState(() => _requests = data);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  _SlotView _parseSlot(String raw) {
    final candidate = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
    if (candidate != null) {
      return _SlotView(
        fullDate: MaterialLocalizations.of(context).formatFullDate(candidate),
        time: MaterialLocalizations.of(context).formatTimeOfDay(
          TimeOfDay.fromDateTime(candidate),
          alwaysUse24HourFormat: true,
        ),
      );
    }
    return _SlotView(fullDate: raw, time: raw);
  }

  @override
  Widget build(BuildContext context) {
    final pending = _requests.where((item) => item.status == 'Bekliyor').length;
    final approved = _requests
        .where((item) => item.status == 'Onaylandı')
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Görüşme Akışı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Yönetici denetimi',
            title:
                'Veli taleplerini ve öğretmen onaylarını tek yönetiçi ekranında takip edin.',
            description:
                'Kim talep göndermiş, hangi öğretmen hangi saati onaylamış ya da reddetmiş bu ekranda görünür.',
            colors: const [Color(0xFF111827), Color(0xFF0F766E)],
            metrics: [
              AdminHeroMetric(label: 'Toplam', value: '${_requests.length}'),
              AdminHeroMetric(label: 'Bekleyen', value: '$pending'),
              AdminHeroMetric(label: 'Onaylanan', value: '$approved'),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Center(
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              ),
            )
          else
            ..._requests.map((item) {
              final slot = _parseSlot(item.slot);
              final statusColor = switch (item.status) {
                'Onaylandı' => const Color(0xFF10B981),
                'Reddedildi' => const Color(0xFFEF4444),
                _ => const Color(0xFFF59E0B),
              };
              return AdminPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.parentName,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                        AdminAccentBadge(
                          label: item.status,
                          color: statusColor,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${item.studentName} • ${item.topic}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _chip(slot.fullDate),
                        _chip(slot.time),
                        _chip(item.onlineMeeting ? 'Online' : 'Yüz yüze'),
                        _chip(item.advisor),
                      ],
                    ),
                    if (item.note.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        item.note,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(height: 1.4),
                      ),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _SlotView {
  final String fullDate;
  final String time;

  const _SlotView({required this.fullDate, required this.time});
}
