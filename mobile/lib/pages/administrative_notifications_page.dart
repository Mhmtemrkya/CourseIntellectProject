import 'package:flutter/material.dart';

import '../services/notification_api_service.dart';
import '../widgets/admin_ui.dart';

class AdministrativeNotificationsPage extends StatefulWidget {
  const AdministrativeNotificationsPage({super.key});

  @override
  State<AdministrativeNotificationsPage> createState() => _AdministrativeNotificationsPageState();
}

class _AdministrativeNotificationsPageState extends State<AdministrativeNotificationsPage> {
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
        targetRole: 'Administrative',
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
    return AdminScaffold(
      appBar: AppBar(
        title: const Text('İdari Bildirimler', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Bildirim merkezi',
            title: 'Kayıt, veli dönüşü ve evrak süreçlerine ait idari bildirimleri tek akışta görün.',
            description: 'Yeni öğrenci kaydı, otomatik veli bilgilendirmesi ve eksik evrak hatırlatmaları burada toplanır.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AdminHeroMetric(label: 'Toplam', value: '${_items.length}'),
              AdminHeroMetric(label: 'Takip', value: '${_items.where((item) => !item.isRead).length}'),
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
      case 'Kayit':
        return const Color(0xFF0F766E);
      case 'Evrak':
        return const Color(0xFF2563EB);
      default:
        return const Color(0xFF7C3AED);
    }
  }
}
