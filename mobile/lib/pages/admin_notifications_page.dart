import 'package:flutter/material.dart';

import '../services/notification_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminNotificationsPage extends StatefulWidget {
  const AdminNotificationsPage({super.key});

  @override
  State<AdminNotificationsPage> createState() => _AdminNotificationsPageState();
}

class _AdminNotificationsPageState extends State<AdminNotificationsPage> {
  List<AppNotificationRecord> _items = const [];
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
      final items = await NotificationApiService.instance.fetchNotifications(
        targetRole: 'Admin',
      );
      if (!mounted) return;
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _items.where((item) => !item.isRead).length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Yönetici Bildirimleri', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Bildirim merkezi',
            title: 'Kurum genelindeki kritik olaylar ve onay bekleyen süreçler burada toplanır.',
            description: 'Yönetici görünümünde akademik, finansal ve operasyonel sinyaller tek akışta izlenir.',
            metrics: [
              AdminHeroMetric(label: 'Toplam', value: '${_items.length}'),
              AdminHeroMetric(label: 'Kritik', value: '$unreadCount'),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          else if (_error != null)
            AdminPanel(
              child: Column(
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
                ],
              ),
            )
          else
            ..._items.map(
              (item) => InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () async {
                  await NotificationApiService.instance.markAsRead(item.id);
                  await _load();
                },
                child: AdminPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: _colorFor(item.category).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(Icons.notifications_active_outlined, color: _colorFor(item.category)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 6),
                            Text(item.message, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.45)),
                            const SizedBox(height: 8),
                            Text(item.timeLabel, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                      if (!item.isRead)
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: Icon(Icons.brightness_1, size: 10, color: Color(0xFF2563EB)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Color _colorFor(String category) {
    switch (category) {
      case 'Finans':
        return const Color(0xFFB42318);
      case 'Akademik':
        return const Color(0xFF2563EB);
      case 'Kayit':
        return const Color(0xFF0F766E);
      default:
        return const Color(0xFF7C3AED);
    }
  }
}
