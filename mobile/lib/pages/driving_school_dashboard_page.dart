import 'package:flutter/material.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

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
        return DrivingErrorState(error: snapshot.error!, onRetry: _reload);
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
      final accent = Theme.of(context).colorScheme.primary;

      return RefreshIndicator(
        onRefresh: () async => _reload(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 6),
                child: DrivingHero(
                  eyebrow: 'Sürücü Kursu',
                  title: 'Operasyon Merkezi',
                  description:
                      'Kursiyer, ders, eğitmen ve filo operasyonlarının canlı özeti.',
                  metrics: [
                    DrivingHeroMetric(
                      label: 'Aktif Kursiyer',
                      value: '${kpis['activeStudents'] ?? 0}',
                    ),
                    DrivingHeroMetric(
                      label: 'Bugünkü Ders',
                      value: '${kpis['todayDrivingLessons'] ?? 0}',
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              sliver: SliverGrid.count(
                crossAxisCount: drivingGridColumns(context),
                childAspectRatio: 1.25,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  DrivingKpiCard(
                    label: 'Aktif Kursiyer',
                    value: '${kpis['activeStudents'] ?? 0}',
                    icon: Icons.groups_rounded,
                    color: accent,
                  ),
                  DrivingKpiCard(
                    label: 'Direksiyon Dersi',
                    value: '${kpis['todayDrivingLessons'] ?? 0}',
                    icon: Icons.route_rounded,
                    color: const Color(0xFFF97316),
                  ),
                  DrivingKpiCard(
                    label: 'Aktif Eğitmen',
                    value: '${kpis['activeInstructors'] ?? 0}',
                    icon: Icons.school_rounded,
                    color: const Color(0xFF10B981),
                  ),
                  DrivingKpiCard(
                    label: 'Aktif Araç',
                    value: '${kpis['activeVehicles'] ?? 0}',
                    icon: Icons.directions_car_rounded,
                    color: const Color(0xFF06B6D4),
                  ),
                  DrivingKpiCard(
                    label: 'Eksik Evrak',
                    value: '${kpis['missingDocuments'] ?? 0}',
                    icon: Icons.warning_amber_rounded,
                    color: const Color(0xFFF59E0B),
                  ),
                  DrivingKpiCard(
                    label: 'Yaklaşan Evrak',
                    value: '${kpis['expiringDocuments'] ?? 0}',
                    icon: Icons.event_busy_rounded,
                    color: const Color(0xFFEAB308),
                  ),
                  DrivingKpiCard(
                    label: 'Bugünkü Tahsilat',
                    value: '₺${kpis['todayCollections'] ?? 0}',
                    icon: Icons.payments_rounded,
                    color: const Color(0xFF16A34A),
                  ),
                  DrivingKpiCard(
                    label: 'Bakımdaki Araç',
                    value: '${kpis['vehiclesInMaintenance'] ?? 0}',
                    icon: Icons.build_rounded,
                    color: const Color(0xFFEF4444),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: DrivingPanel(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DrivingSectionTitle(title: 'Operasyon Uyarıları'),
                    const SizedBox(height: 10),
                    if (alerts.isEmpty)
                      const DrivingEmptyState(
                        icon: Icons.verified_user_rounded,
                        title: 'Kritik uyarı yok',
                        message: 'Evrak, bakım ve çakışma kontrolleri güncel.',
                      )
                    else
                      ...alerts.map((alert) {
                        final critical = alert['severity'] == 'Critical';
                        return DrivingListRow(
                          icon: critical
                              ? Icons.error_rounded
                              : Icons.warning_amber_rounded,
                          iconColor: DrivingStatusPill.colorOf(
                            context,
                            critical ? DrivingTone.danger : DrivingTone.warning,
                          ),
                          title: '${alert['title']}',
                          subtitle: '${alert['message']}',
                          trailing: DrivingStatusPill(
                            label: critical ? 'Kritik' : 'Uyarı',
                            tone: critical
                                ? DrivingTone.danger
                                : DrivingTone.warning,
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: DrivingPanel(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DrivingSectionTitle(title: 'Aylık Yeni Kayıtlar'),
                    const SizedBox(height: 18),
                    DrivingBarChart(series: series),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      );
    },
  );
}
