import 'package:flutter/material.dart';
import '../services/driving_school_api_service.dart';

class DrivingSchoolDashboardPage extends StatefulWidget {
  const DrivingSchoolDashboardPage({super.key});
  @override
  State<DrivingSchoolDashboardPage> createState() =>
      _DrivingSchoolDashboardPageState();
}

class _DrivingSchoolDashboardPageState
    extends State<DrivingSchoolDashboardPage> {
  late Future<Map<String, dynamic>> _future;
  @override
  void initState() {
    super.initState();
    _future = DrivingSchoolApiService.instance.dashboard();
  }

  void _reload() =>
      setState(() => _future = DrivingSchoolApiService.instance.dashboard());

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline_rounded, size: 48),
                const SizedBox(height: 12),
                Text('${snapshot.error}', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _reload,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Tekrar Dene'),
                ),
              ],
            ),
          ),
        );
      }
      final data = snapshot.data!;
      final kpis = Map<String, dynamic>.from(data['kpis'] as Map? ?? const {});
      final charts = Map<String, dynamic>.from(
        data['charts'] as Map? ?? const {},
      );
      final series = (charts['monthlyRegistrations'] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final alerts = (data['alerts'] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      return RefreshIndicator(
        onRefresh: () async => _reload(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 18, 16, 10),
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFF59E0B)],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x33EA580C),
                      blurRadius: 24,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.directions_car_filled_rounded,
                      color: Colors.white,
                      size: 34,
                    ),
                    SizedBox(height: 18),
                    Text(
                      'Sürücü Kursu',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Günlük operasyon merkezi',
                      style: TextStyle(
                        color: Color(0xFFFFEDD5),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverGrid.count(
                crossAxisCount: MediaQuery.sizeOf(context).width > 700 ? 4 : 2,
                childAspectRatio: 1.25,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _Kpi(
                    'Aktif Öğrenci',
                    kpis['activeStudents'],
                    Icons.groups_rounded,
                    const Color(0xFF3B82F6),
                  ),
                  _Kpi(
                    'Direksiyon Dersi',
                    kpis['todayDrivingLessons'],
                    Icons.route_rounded,
                    const Color(0xFFF97316),
                  ),
                  _Kpi(
                    'Aktif Öğretmen',
                    kpis['activeInstructors'],
                    Icons.school_rounded,
                    const Color(0xFF10B981),
                  ),
                  _Kpi(
                    'Aktif Araç',
                    kpis['activeVehicles'],
                    Icons.directions_car_rounded,
                    const Color(0xFF06B6D4),
                  ),
                  _Kpi(
                    'Eksik Evrak',
                    kpis['missingDocuments'],
                    Icons.warning_amber_rounded,
                    const Color(0xFFF59E0B),
                  ),
                  _Kpi(
                    'Yaklaşan Evrak',
                    kpis['expiringDocuments'],
                    Icons.event_busy_rounded,
                    const Color(0xFFEAB308),
                  ),
                  _Kpi(
                    'Bugünkü Tahsilat',
                    '₺${kpis['todayCollections'] ?? 0}',
                    Icons.payments_rounded,
                    const Color(0xFF16A34A),
                  ),
                ],
              ),
            ),
            if (alerts.isNotEmpty)
              SliverToBoxAdapter(
                child: Card(
                  margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Operasyon Uyarıları',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ...alerts.map((alert) {
                          final critical = alert['severity'] == 'Critical';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: (critical ? Colors.red : Colors.orange)
                                  .withValues(alpha: .08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: (critical ? Colors.red : Colors.orange)
                                    .withValues(alpha: .25),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  critical
                                      ? Icons.error_rounded
                                      : Icons.warning_amber_rounded,
                                  color: critical ? Colors.red : Colors.orange,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${alert['title']}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      Text(
                                        '${alert['message']}',
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),
              ),
            SliverToBoxAdapter(child: _RegistrationChart(series: series)),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      );
    },
  );
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.label, this.value, this.icon, this.color);
  final String label;
  final dynamic value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: .12),
            foregroundColor: color,
            child: Icon(icon),
          ),
          const Spacer(),
          Text(
            '$value',
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );
}

class _RegistrationChart extends StatelessWidget {
  const _RegistrationChart({required this.series});
  final List<Map<String, dynamic>> series;
  @override
  Widget build(BuildContext context) {
    final maxValue = series.fold<num>(
      1,
      (max, e) => (e['value'] as num? ?? 0) > max ? e['value'] as num : max,
    );
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Aylık Yeni Kayıtlar',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 180,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: series.map((item) {
                  final value = item['value'] as num? ?? 0;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            '$value',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Container(
                            height: 10 + (value / maxValue * 120),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                                colors: [Color(0xFFEA580C), Color(0xFFFBBF24)],
                              ),
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(9),
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${item['label']}',
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
