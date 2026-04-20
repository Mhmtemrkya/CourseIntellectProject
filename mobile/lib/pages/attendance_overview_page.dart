import 'package:flutter/material.dart';

import '../services/attendance_service.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';

class AttendanceOverviewPage extends StatefulWidget {
  const AttendanceOverviewPage({super.key});

  @override
  State<AttendanceOverviewPage> createState() => _AttendanceOverviewPageState();
}

class _AttendanceOverviewPageState extends State<AttendanceOverviewPage> {
  String _classFilter = 'Tümu';
  String _statusFilter = 'Tümu';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await AttendanceService.instance.refresh();
    if (!mounted) return;
    setState(() {
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final all = AttendanceService.instance.all();
    final classes = [
      'Tümu',
      ...{for (final item in all) item.className},
    ];
    final filtered = all.where((item) {
      final classMatch =
          _classFilter == 'Tümu' || item.className == _classFilter;
      final statusMatch =
          _statusFilter == 'Tümu' || item.status == _statusFilter;
      return classMatch && statusMatch;
    }).toList();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Devamsızlık Paneli'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ResponsiveContent(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Tüm öğrenciler için yoklama ve devamsızlık görünümü',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Gün gün, tarih tarih ve sube bazlı filtrelenebilir tek panel.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.86),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _classFilter,
                            decoration: const InputDecoration(
                              labelText: 'Şube / Sınıf',
                              border: OutlineInputBorder(),
                            ),
                            items: classes
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item,
                                    child: Text(item),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _classFilter = value ?? 'Tümu'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _statusFilter,
                            decoration: const InputDecoration(
                              labelText: 'Durum',
                              border: OutlineInputBorder(),
                            ),
                            items:
                                const [
                                      'Tümu',
                                      'Katildi',
                                      'Gec',
                                      'Devamsiz',
                                      'Izinli',
                                    ]
                                    .map(
                                      (item) => DropdownMenuItem(
                                        value: item,
                                        child: Text(item),
                                      ),
                                    )
                                    .toList(),
                            onChanged: (value) =>
                                setState(() => _statusFilter = value ?? 'Tümu'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    ...filtered.map((item) => _row(context, item)),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _row(BuildContext context, AttendanceRecord item) {
    final theme = Theme.of(context);
    final color = switch (item.status) {
      'Katildi' => const Color(0xFF0F766E),
      'Gec' => const Color(0xFFB54708),
      'Izinli' => const Color(0xFF2563EB),
      _ => const Color(0xFFB42318),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.12),
            foregroundColor: color,
            child: const Icon(Icons.school_outlined),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.studentName,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.className} • ${item.lesson} • ${item.date.day}.${item.date.month}.${item.date.year}',
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              item.status,
              style: TextStyle(color: color, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
