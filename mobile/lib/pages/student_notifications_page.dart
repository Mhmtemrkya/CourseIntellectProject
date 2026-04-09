import 'package:flutter/material.dart';

import '../services/notification_api_service.dart';

class StudentNotificationsPage extends StatefulWidget {
  const StudentNotificationsPage({super.key});

  @override
  State<StudentNotificationsPage> createState() => _StudentNotificationsPageState();
}

class _StudentNotificationsPageState extends State<StudentNotificationsPage> {
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
        targetRole: 'Student',
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
    return Scaffold(
      appBar: AppBar(title: const Text('Canlı Bildirim Kutusu', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)]),
              borderRadius: BorderRadius.circular(26),
            ),
            child: const Text(
              'Öğretmen yanıtları, ödev yorumları ve sınav güncellemeleri burada toplanır.',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20, height: 1.2),
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          else if (_error != null)
            Center(
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
                borderRadius: BorderRadius.circular(22),
                onTap: () async {
                  await NotificationApiService.instance.markAsRead(item.id);
                  await _load();
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: _colorFor(item.category).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(_iconFor(item.category), color: _colorFor(item.category)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(item.message, style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 8),
                            Text(item.timeLabel, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                      if (!item.isRead)
                        const Icon(Icons.brightness_1, size: 10, color: Color(0xFF2563EB)),
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
      case 'Akademik':
        return const Color(0xFF2563EB);
      case 'Odev':
        return const Color(0xFF0F766E);
      case 'Sinav':
        return const Color(0xFFB45309);
      default:
        return const Color(0xFF7C3AED);
    }
  }

  IconData _iconFor(String category) {
    switch (category) {
      case 'Akademik':
        return Icons.forum_outlined;
      case 'Odev':
        return Icons.assignment_turned_in_outlined;
      case 'Sinav':
        return Icons.fact_check_outlined;
      default:
        return Icons.notifications_active_outlined;
    }
  }
}
