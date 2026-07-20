import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import 'driving_appointment_request_page.dart';
import '../features/assistant/presentation/assistant_page.dart';

class DrivingStudentHomePage extends StatefulWidget {
  const DrivingStudentHomePage({super.key});
  @override
  State<DrivingStudentHomePage> createState() => _DrivingStudentHomePageState();
}

class _DrivingStudentHomePageState extends State<DrivingStudentHomePage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() {
    _future = DrivingSchoolApiService.instance.studentOverview();
  });

  String _date(dynamic raw) {
    final value = DateTime.tryParse('$raw')?.toLocal();
    if (value == null) return '-';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(value.day)}.${two(value.month)}.${value.year}  ${two(value.hour)}:${two(value.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
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
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text('${snapshot.error}', textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh),
                    label: Text('Tekrar Dene'.tr),
                  ),
                ],
              ),
            ),
          );
        }
        final data = snapshot.data!;
        final profile = Map<String, dynamic>.from(
          data['profile'] as Map? ?? const {},
        );
        final appointments = (data['appointments'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final purchased = profile['purchasedDrivingMinutes'] as int? ?? 0;
        final remaining = profile['remainingDrivingMinutes'] as int? ?? 0;
        final progress = purchased == 0
            ? 0.0
            : ((purchased - remaining) / purchased).clamp(0.0, 1.0);
        final evaluatedLessons =
            appointments.where((row) => row['safetyScore'] is num).toList()
              ..sort(
                (a, b) =>
                    '${a['startsAtUtc']}'.compareTo('${b['startsAtUtc']}'),
              );
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 100),
            children: [
              Card(
                color: const Color(0xFFF59E0B).withValues(alpha: .12),
                child: ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFF59E0B), foregroundColor: Colors.white, child: Icon(Icons.auto_awesome_rounded)),
                  title: const Text('SchoolAsist Asistan', style: TextStyle(fontWeight: FontWeight.w900)),
                  subtitle: const Text('Ders hakkı, randevu ve sınav durumunu güvenle sor'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AssistantPage())),
                ),
              ),
              const SizedBox(height: 12),
              _ProfileHero(
                profile: profile,
                purchased: purchased,
                remaining: remaining,
                progress: progress,
              ),
              if (evaluatedLessons.isNotEmpty) ...[
                const SizedBox(height: 20),
                _DevelopmentCard(lessons: evaluatedLessons),
              ],
              const SizedBox(height: 20),
              const Text(
                'Direksiyon programım',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (appointments.isEmpty)
                Card(
                  child: Padding(
                    padding: EdgeInsets.all(28),
                    child: Column(
                      children: [
                        Icon(
                          Icons.event_available_rounded,
                          size: 44,
                          color: Color(0xFF06B6D4),
                        ),
                        SizedBox(height: 10),
                        Text('Henüz planlanmış direksiyon dersiniz yok.'.tr),
                      ],
                    ),
                  ),
                ),
              ...appointments.map(_appointmentCard),
            ],
          ),
        );
      },
    );
  }

  static const _statusLabels = {
    'Planned': 'Planlandı',
    'Approved': 'Onaylandı',
    'Requested': 'Talep edildi',
    'WaitingApproval': 'Onay bekliyor',
    'CheckedIn': 'Buluşuldu',
    'InProgress': 'Ders sürüyor',
    'Completed': 'Tamamlandı',
    'Cancelled': 'İptal',
    'CancelledByStudent': 'İptal ettiniz',
    'CancelledByInstructor': 'Öğretmen iptal etti',
    'CancelledByInstitution': 'Kurum iptal etti',
    'NoShow': 'Gelmediniz',
    'Rescheduled': 'Yeniden planlandı',
    'Suspended': 'Askıda',
  };

  /// Geç iptalde ders hakkının bir kısmı yanar; öğrenciye bunu onaydan ÖNCE söyleriz.
  Future<void> _cancel(Map<String, dynamic> row) async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Randevuyu iptal et'.tr),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Derse az bir süre kaldıysa kurum kuralları gereği ders hakkınızın '
              'bir kısmı düşülebilir.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'İptal nedeni (en az 5 karakter)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text('İptal Et'.tr),
          ),
        ],
      ),
    );
    if (confirmed != true || reason.text.trim().length < 5 || !mounted) return;

    try {
      final result = await DrivingSchoolApiService.instance.cancelAppointment(
        '${row['id']}',
        reason.text.trim(),
      );
      if (mounted) {
        final penalty = (result['penaltyMinutes'] as num?)?.toInt() ?? 0;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              penalty > 0
                  ? 'Randevu iptal edildi. Geç iptal nedeniyle $penalty dk düşüldü.'
                  : 'Randevu iptal edildi, ders hakkınız iade edildi.',
            ),
          ),
        );
      }
      _reload();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('İptal edilemedi: $e')));
      }
    }
  }

  Widget _appointmentCard(Map<String, dynamic> row) {
    final status = '${row['status']}';
    final completed = status == 'Completed';
    final startsAt = DateTime.tryParse('${row['startsAtUtc']}')?.toLocal();
    final canCancel =
        const [
          'Planned',
          'Approved',
          'Requested',
          'WaitingApproval',
        ].contains(status) &&
        startsAt != null &&
        startsAt.isAfter(DateTime.now());
    final scores = [
      row['trafficRulesScore'],
      row['vehicleControlScore'],
      row['maneuversScore'],
      row['safetyScore'],
    ].whereType<num>().toList();
    final average = scores.isEmpty
        ? null
        : scores.reduce((a, b) => a + b) / scores.length;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(
                    0xFF2563EB,
                  ).withValues(alpha: .1),
                  foregroundColor: const Color(0xFF2563EB),
                  child: Icon(
                    completed ? Icons.task_alt_rounded : Icons.route_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _date(row['startsAtUtc']),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        '${row['instructorName'] ?? '-'} • ${row['vehiclePlate'] ?? '-'}',
                      ),
                    ],
                  ),
                ),
                Text(
                  _statusLabels[status] ?? status,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            if (canCancel) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _cancel(row),
                  icon: const Icon(Icons.event_busy_rounded),
                  label: Text('Randevuyu İptal Et'.tr),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          DrivingAppointmentRequestPage(sourceAppointment: row),
                    ),
                  ).then((_) => _reload()),
                  icon: const Icon(Icons.edit_calendar_rounded),
                  label: Text('Yeniden Planlama Talebi'.tr),
                ),
              ),
            ],
            if (average != null) ...[
              const Divider(height: 26),
              Row(
                children: [
                  const Icon(Icons.stars_rounded, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 8),
                  Text(
                    'Ders değerlendirmesi  ${average.toStringAsFixed(1)} / 5',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ],
            if ('${row['instructorNote'] ?? ''}'.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                '${row['instructorNote']}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DevelopmentCard extends StatelessWidget {
  const _DevelopmentCard({required this.lessons});
  final List<Map<String, dynamic>> lessons;

  static const _categories = <String, String>{
    'trafficRulesScore': 'Trafik',
    'vehicleControlScore': 'Araç hâkimiyeti',
    'maneuversScore': 'Manevra',
    'safetyScore': 'Güvenlik',
  };

  @override
  Widget build(BuildContext context) {
    double average(Map<String, dynamic> lesson) {
      final values = _categories.keys
          .map((key) => lesson[key])
          .whereType<num>();
      return values.fold<double>(0, (sum, value) => sum + value) /
          values.length;
    }

    final trend = lessons.map(average).toList();
    final latest = lessons.last;
    final first = trend.first;
    final change = trend.last - first;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Sürüş gelişimim',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                ),
                Text(
                  '${change >= 0 ? '+' : ''}${change.toStringAsFixed(1)} puan',
                  style: TextStyle(
                    color: change >= 0
                        ? const Color(0xFF16A34A)
                        : const Color(0xFFDC2626),
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${lessons.length} değerlendirilmiş dersin genel puan seyri',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 120,
              width: double.infinity,
              child: CustomPaint(painter: _TrendPainter(trend)),
            ),
            const SizedBox(height: 14),
            for (final category in _categories.entries) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      category.value,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    '${(latest[category.key] as num?)?.toStringAsFixed(1) ?? '-'} / 5',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              LinearProgressIndicator(
                value: ((latest[category.key] as num?)?.toDouble() ?? 0) / 5,
                minHeight: 7,
                borderRadius: BorderRadius.circular(10),
              ),
              const SizedBox(height: 9),
            ],
          ],
        ),
      ),
    );
  }
}

class _TrendPainter extends CustomPainter {
  const _TrendPainter(this.values);
  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    for (var step = 0; step <= 4; step++) {
      final y = size.height * step / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (values.isEmpty) return;
    Offset point(int index) {
      final x = values.length == 1
          ? size.width / 2
          : size.width * index / (values.length - 1);
      final y =
          size.height - ((values[index] - 1) / 4).clamp(0.0, 1.0) * size.height;
      return Offset(x, y);
    }

    final line = Paint()
      ..color = const Color(0xFF2563EB)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final path = Path()..moveTo(point(0).dx, point(0).dy);
    for (var index = 1; index < values.length; index++) {
      path.lineTo(point(index).dx, point(index).dy);
    }
    canvas.drawPath(path, line);
    final dot = Paint()..color = const Color(0xFF2563EB);
    for (var index = 0; index < values.length; index++) {
      canvas.drawCircle(point(index), 4, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) =>
      oldDelegate.values != values;
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.profile,
    required this.purchased,
    required this.remaining,
    required this.progress,
  });
  final Map<String, dynamic> profile;
  final int purchased, remaining;
  final double progress;
  @override
  Widget build(BuildContext context) {
    // Hero rengi tema vurgusundan türer (okul tarafındaki AdminHeroCard ile aynı
    // geometri); sabit mavi/turuncu marka paleti değişince ekranda kalıyordu.
    final accent = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF08111F),
            Color.lerp(const Color(0xFF08111F), accent, 0.32) ??
                const Color(0xFF08111F),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.24),
            blurRadius: 34,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.directions_car_filled_rounded,
            color: Colors.white,
            size: 34,
          ),
          const SizedBox(height: 16),
          Text(
            '${profile['fullName'] ?? 'Sürücü Adayı'}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            '${profile['packageName'] ?? '-'} • ${profile['licenseClass'] ?? '-'} • ${profile['transmissionType'] ?? '-'}',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.84),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  '$remaining dk kaldı',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                '$purchased dk',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress,
            minHeight: 9,
            borderRadius: BorderRadius.circular(20),
            backgroundColor: Colors.white.withValues(alpha: .2),
            color: Colors.white,
          ),
        ],
      ),
    );
  }
}
