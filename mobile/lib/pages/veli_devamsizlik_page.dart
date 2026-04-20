import 'package:flutter/material.dart';

import '../services/attendance_service.dart';
import '../services/linked_children_service.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';

class VeliDevamsizlikPage extends StatefulWidget {
  const VeliDevamsizlikPage({super.key});

  @override
  State<VeliDevamsizlikPage> createState() => _VeliDevamsizlikPageState();
}

class _VeliDevamsizlikPageState extends State<VeliDevamsizlikPage> {
  String _period = 'Ay';
  String _status = 'Tümu';
  String _selectedChild = '';
  List<LinkedChildRecord> _children = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    final selectedChild = _selectedChild.isNotEmpty
        ? _selectedChild
        : (children.isNotEmpty ? children.first.fullName : '');
    if (selectedChild.isNotEmpty) {
      await AttendanceService.instance.refresh(studentName: selectedChild);
    }
    if (!mounted) return;
    setState(() {
      _children = children;
      _selectedChild = selectedChild;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final records = AttendanceService.instance
        .forStudent(_selectedChild)
        .where((item) => _status == 'Tümu' || item.status == _status)
        .toList();
    final grouped = <String, List<AttendanceRecord>>{};
    for (final record in records) {
      final key =
          '${record.date.day.toString().padLeft(2, '0')}.${record.date.month.toString().padLeft(2, '0')}.${record.date.year}';
      grouped.putIfAbsent(key, () => []).add(record);
    }

    final absent = records.where((item) => item.status == 'Devamsiz').length;
    final late = records.where((item) => item.status == 'Gec').length;
    final excuse = records.where((item) => item.status == 'Izinli').length;

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: hasSidebar ? null : const AppHeader(title: 'Devamsızlık Takibi'),
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
                          colors: [Color(0xFF0F172A), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selectedChild,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Gün, hafta ve ay bazında devamsızlık ve geç kalma hareketleri.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.86),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              _metricCard('Devamsiz', '$absent'),
                              _metricCard('Gec', '$late'),
                              _metricCard('Izinli', '$excuse'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final compact = constraints.maxWidth < 720;
                        final controls = [
                          DropdownButtonFormField<String>(
                            isExpanded: true,
                            initialValue: _selectedChild,
                            decoration: const InputDecoration(
                              labelText: 'Çocuk',
                              border: OutlineInputBorder(),
                            ),
                            items: _children
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item.fullName,
                                    child: Text(
                                      item.displayLabel,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) async {
                              setState(() {
                                _selectedChild = value ?? _selectedChild;
                                _loading = true;
                              });
                              await _load();
                            },
                          ),
                          DropdownButtonFormField<String>(
                            isExpanded: true,
                            initialValue: _period,
                            decoration: const InputDecoration(
                              labelText: 'Görünüm',
                              border: OutlineInputBorder(),
                            ),
                            items: const ['Gün', 'Hafta', 'Ay']
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item,
                                    child: Text(item),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => _period = value ?? 'Ay'),
                          ),
                          DropdownButtonFormField<String>(
                            isExpanded: true,
                            initialValue: _status,
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
                                        child: Text(
                                          item,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    )
                                    .toList(),
                            onChanged: (value) =>
                                setState(() => _status = value ?? 'Tümu'),
                          ),
                        ];

                        if (compact) {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              controls[0],
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(child: controls[1]),
                                  const SizedBox(width: 12),
                                  Expanded(child: controls[2]),
                                ],
                              ),
                            ],
                          );
                        }

                        return Row(
                          children: [
                            Expanded(child: controls[0]),
                            const SizedBox(width: 12),
                            Expanded(child: controls[1]),
                            const SizedBox(width: 12),
                            Expanded(child: controls[2]),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    ...grouped.entries.map(
                      (entry) => _dateCard(context, entry.key, entry.value),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _metricCard(String label, String value) {
    return Container(
      width: 120,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateCard(
    BuildContext context,
    String dateLabel,
    List<AttendanceRecord> records,
  ) {
    final theme = Theme.of(context);
    final issueCount = records.where((item) => item.status != 'Katildi').length;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: CircleAvatar(
            backgroundColor: issueCount == 0
                ? const Color(0xFF0F766E).withValues(alpha: 0.12)
                : const Color(0xFFB54708).withValues(alpha: 0.12),
            foregroundColor: issueCount == 0
                ? const Color(0xFF0F766E)
                : const Color(0xFFB54708),
            child: Icon(
              issueCount == 0
                  ? Icons.check_circle_outline_rounded
                  : Icons.event_busy_outlined,
            ),
          ),
          title: Text(
            dateLabel,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          subtitle: Text(
            issueCount == 0
                ? 'Tüm derslere katıldı'
                : '$issueCount hareket kaydı var',
            style: theme.textTheme.bodySmall,
          ),
          children: records
              .map((record) => _recordCard(context, record))
              .toList(),
        ),
      ),
    );
  }

  Widget _recordCard(BuildContext context, AttendanceRecord record) {
    final theme = Theme.of(context);
    final color = switch (record.status) {
      'Katildi' => const Color(0xFF0F766E),
      'Gec' => const Color(0xFFB54708),
      'Izinli' => const Color(0xFF2563EB),
      _ => const Color(0xFFB42318),
    };

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.calendar_today_outlined, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.lesson,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${record.className} • Yoklama kaydı',
                  style: theme.textTheme.bodySmall,
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
              record.status,
              style: TextStyle(color: color, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
