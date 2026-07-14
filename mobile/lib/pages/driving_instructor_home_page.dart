import 'package:flutter/material.dart';

import '../services/driving_school_api_service.dart';

class _EvaluationCriterion {
  const _EvaluationCriterion(
    this.key,
    this.category,
    this.label, {
    this.manualOnly = false,
  });
  final String key, category, label;
  final bool manualOnly;
}

const _evaluationCategories = <String, String>{
  'trafficRules': 'Trafik kuralları',
  'vehicleControl': 'Araç hâkimiyeti',
  'maneuvers': 'Manevralar',
  'safety': 'Güvenli sürüş',
};

const _evaluationCriteria = <_EvaluationCriterion>[
  _EvaluationCriterion(
    'trafficObservation',
    'trafficRules',
    'Trafik akışını gözlemleme',
  ),
  _EvaluationCriterion(
    'signsAndSignals',
    'trafficRules',
    'İşaret ve ışıklara uyum',
  ),
  _EvaluationCriterion('laneDiscipline', 'trafficRules', 'Şerit disiplini'),
  _EvaluationCriterion('speedManagement', 'trafficRules', 'Hız yönetimi'),
  _EvaluationCriterion('rightOfWay', 'trafficRules', 'Geçiş hakkı kuralları'),
  _EvaluationCriterion('followingDistance', 'trafficRules', 'Takip mesafesi'),
  _EvaluationCriterion(
    'seatingAndMirrors',
    'vehicleControl',
    'Koltuk ve ayna ayarı',
  ),
  _EvaluationCriterion(
    'steeringControl',
    'vehicleControl',
    'Direksiyon hâkimiyeti',
  ),
  _EvaluationCriterion(
    'pedalControl',
    'vehicleControl',
    'Gaz ve fren kontrolü',
  ),
  _EvaluationCriterion('gearSelection', 'vehicleControl', 'Doğru vites seçimi'),
  _EvaluationCriterion(
    'clutchControl',
    'vehicleControl',
    'Debriyaj kavrama kontrolü',
    manualOnly: true,
  ),
  _EvaluationCriterion(
    'clutchHillStart',
    'vehicleControl',
    'Debriyajla yokuş kalkışı',
    manualOnly: true,
  ),
  _EvaluationCriterion(
    'smoothStartStop',
    'maneuvers',
    'Yumuşak kalkış ve duruş',
  ),
  _EvaluationCriterion('parking', 'maneuvers', 'Park etme'),
  _EvaluationCriterion('reversing', 'maneuvers', 'Geri sürüş'),
  _EvaluationCriterion('turning', 'maneuvers', 'Dönüş ve U dönüşü'),
  _EvaluationCriterion('hillStart', 'maneuvers', 'Yokuşta kalkış'),
  _EvaluationCriterion('laneChange', 'maneuvers', 'Şerit değiştirme'),
  _EvaluationCriterion(
    'seatbeltAndChecks',
    'safety',
    'Emniyet kemeri ve son kontroller',
  ),
  _EvaluationCriterion('signaling', 'safety', 'Zamanında sinyal kullanımı'),
  _EvaluationCriterion('blindSpot', 'safety', 'Kör nokta kontrolü'),
  _EvaluationCriterion(
    'pedestrianAwareness',
    'safety',
    'Yaya ve bisikletli farkındalığı',
  ),
  _EvaluationCriterion(
    'hazardAnticipation',
    'safety',
    'Tehlikeyi önceden sezme',
  ),
  _EvaluationCriterion(
    'calmDecisionMaking',
    'safety',
    'Sakin ve güvenli karar verme',
  ),
];

class DrivingInstructorHomePage extends StatefulWidget {
  const DrivingInstructorHomePage({super.key});

  @override
  State<DrivingInstructorHomePage> createState() =>
      _DrivingInstructorHomePageState();
}

class _DrivingInstructorHomePageState extends State<DrivingInstructorHomePage> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() {
    _future = DrivingSchoolApiService.instance.instructorAppointments();
  });

  String _date(dynamic raw) {
    final value = DateTime.tryParse('$raw')?.toLocal();
    if (value == null) return '-';
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(value.day)}.${two(value.month)}.${value.year}  ${two(value.hour)}:${two(value.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _Message(
            icon: Icons.error_outline,
            text: '${snapshot.error}',
            onRetry: _reload,
          );
        }
        final rows = snapshot.data ?? const [];
        final today = DateTime.now();
        final todayCount = rows.where((row) {
          final date = DateTime.tryParse('${row['startsAtUtc']}')?.toLocal();
          return date != null &&
              date.year == today.year &&
              date.month == today.month &&
              date.day == today.day;
        }).length;
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 100),
            children: [
              _Hero(todayCount: todayCount, totalCount: rows.length),
              const SizedBox(height: 20),
              const Text(
                'Ders programım',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (rows.isEmpty)
                const _Empty()
              else
                ...rows.map((row) => _lessonCard(row)),
            ],
          ),
        );
      },
    );
  }

  Widget _lessonCard(Map<String, dynamic> row) {
    final status = '${row['status']}';
    final canStart =
        status == 'Planned' || status == 'Approved' || status == 'CheckedIn';
    final canComplete = status == 'InProgress';
    // Öğrenci gelmediyse: ders saati geldikten sonra devamsızlık yazılabilir.
    final startsAt = DateTime.tryParse('${row['startsAtUtc']}')?.toLocal();
    final canMarkNoShow =
        canStart && startsAt != null && DateTime.now().isAfter(startsAt);
    final color = canComplete
        ? const Color(0xFF16A34A)
        : status == 'Completed'
        ? const Color(0xFF64748B)
        : const Color(0xFFF97316);
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
                  backgroundColor: color.withValues(alpha: .12),
                  foregroundColor: color,
                  child: const Icon(Icons.route_rounded),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${row['studentName'] ?? '-'}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        _date(row['startsAtUtc']),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                _Status(value: status, color: color),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _Chip(
                  Icons.directions_car_rounded,
                  '${row['vehiclePlate'] ?? '-'}',
                ),
                _Chip(
                  Icons.speed_rounded,
                  '${row['currentKilometer'] ?? 0} km',
                ),
              ],
            ),
            if (canStart || canComplete) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => canComplete ? _complete(row) : _start(row),
                  icon: Icon(
                    canComplete ? Icons.flag_rounded : Icons.play_arrow_rounded,
                  ),
                  label: Text(
                    canComplete
                        ? 'Dersi Bitir ve Değerlendir'
                        : 'Ön Kontrol ve Dersi Başlat',
                  ),
                  style: FilledButton.styleFrom(backgroundColor: color),
                ),
              ),
            ],
            if (canMarkNoShow) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _markNoShow(row),
                  icon: const Icon(Icons.person_off_rounded),
                  label: const Text('Öğrenci Gelmedi'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFE11D48),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _start(Map<String, dynamic> row) async {
    final kilometer = TextEditingController(
      text: '${row['currentKilometer'] ?? ''}',
    );
    final note = TextEditingController();
    var brakes = false, tires = false, lights = false, fluids = false;
    final submit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          Widget check(String text, bool value, ValueChanged<bool?> changed) =>
              CheckboxListTile(
                value: value,
                onChanged: changed,
                title: Text(text),
                dense: true,
                contentPadding: EdgeInsets.zero,
              );
          return AlertDialog(
            title: const Text('Araç ön kontrolü'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: kilometer,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Başlangıç kilometresi',
                      prefixIcon: Icon(Icons.speed),
                    ),
                  ),
                  const SizedBox(height: 8),
                  check(
                    'Fren sistemi uygun',
                    brakes,
                    (v) => setDialogState(() => brakes = v == true),
                  ),
                  check(
                    'Lastikler uygun',
                    tires,
                    (v) => setDialogState(() => tires = v == true),
                  ),
                  check(
                    'Aydınlatma sistemi uygun',
                    lights,
                    (v) => setDialogState(() => lights = v == true),
                  ),
                  check(
                    'Sıvı seviyeleri uygun',
                    fluids,
                    (v) => setDialogState(() => fluids = v == true),
                  ),
                  TextField(
                    controller: note,
                    maxLength: 1000,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Ön kontrol notu (isteğe bağlı)',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Vazgeç'),
              ),
              FilledButton(
                onPressed:
                    brakes &&
                        tires &&
                        lights &&
                        fluids &&
                        int.tryParse(kilometer.text) != null
                    ? () => Navigator.pop(dialogContext, true)
                    : null,
                child: const Text('Dersi Başlat'),
              ),
            ],
          );
        },
      ),
    );
    if (submit != true || !mounted) return;
    await _run(
      () => DrivingSchoolApiService.instance.startLesson('${row['id']}', {
        'startKilometer': int.parse(kilometer.text),
        'brakesOk': brakes,
        'tiresOk': tires,
        'lightsOk': lights,
        'fluidsOk': fluids,
        'preCheckNote': note.text,
      }),
      'Ders güvenli şekilde başlatıldı.',
    );
  }

  /// Devamsızlık öğrencinin ders hakkını yakar; bu yüzden onay ister ve
  /// sonucunda kaç dakikanın düştüğünü açıkça söyleriz.
  Future<void> _markNoShow(Map<String, dynamic> row) async {
    final note = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Öğrenci gelmedi'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Devamsızlık yazıldığında kurum ayarına göre öğrencinin ders '
              'hakkından kesinti yapılır. Bu işlem geri alınamaz.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: note,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Not (isteğe bağlı)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFE11D48),
            ),
            child: const Text('Devamsızlık Yaz'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final result = await DrivingSchoolApiService.instance.markNoShow(
        '${row['id']}',
        note.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Devamsızlık yazıldı. ${result['penaltyMinutes']} dk ders '
              'hakkından düşüldü.',
            ),
          ),
        );
      }
      _reload();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Devamsızlık yazılamadı: $e')));
      }
    }
  }

  Future<void> _complete(Map<String, dynamic> row) async {
    final kilometer = TextEditingController(
      text: '${row['currentKilometer'] ?? ''}',
    );
    final note = TextEditingController();
    final automatic = '${row['transmissionType']}' == 'Automatic';
    final visibleCriteria = _evaluationCriteria
        .where((criterion) => !automatic || !criterion.manualOnly)
        .toList();
    final scores = {for (final criterion in visibleCriteria) criterion.key: 3};
    final submit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Dersi tamamla ve değerlendir'),
                const SizedBox(height: 4),
                Text(
                  automatic
                      ? 'Otomatik vites • ${visibleCriteria.length} kriter (debriyaj maddeleri uygulanmaz)'
                      : 'Manuel vites • ${visibleCriteria.length} kriter',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            content: SizedBox(
              width: 560,
              height: MediaQuery.sizeOf(context).height * .68,
              child: ListView(
                children: [
                  TextField(
                    controller: kilometer,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Bitiş kilometresi',
                      prefixIcon: Icon(Icons.speed),
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final category in _evaluationCategories.entries) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 4),
                      child: Text(
                        category.value,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    for (final criterion in visibleCriteria.where(
                      (item) => item.category == category.key,
                    ))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Expanded(child: Text(criterion.label)),
                            const SizedBox(width: 12),
                            DropdownButton<int>(
                              value: scores[criterion.key],
                              items: [1, 2, 3, 4, 5]
                                  .map(
                                    (value) => DropdownMenuItem(
                                      value: value,
                                      child: Text('$value / 5'),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) => setDialogState(
                                () => scores[criterion.key] = value ?? 3,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: note,
                    maxLength: 2000,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Öğrenci değerlendirmesi',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Vazgeç'),
              ),
              FilledButton(
                onPressed: int.tryParse(kilometer.text) != null
                    ? () => Navigator.pop(dialogContext, true)
                    : null,
                child: const Text('Tamamla'),
              ),
            ],
          );
        },
      ),
    );
    if (submit != true || !mounted) return;
    await _run(
      () => DrivingSchoolApiService.instance.completeLesson('${row['id']}', {
        'endKilometer': int.parse(kilometer.text),
        'criteria': scores,
        'instructorNote': note.text,
      }),
      'Ders tamamlandı ve öğrenci bakiyesi güncellendi.',
    );
  }

  Future<void> _run(Future<dynamic> Function() action, String success) async {
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(success), behavior: SnackBarBehavior.floating),
      );
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$error'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.todayCount, required this.totalCount});
  final int todayCount, totalCount;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF0F766E), Color(0xFF14B8A6)],
      ),
      borderRadius: BorderRadius.circular(26),
      boxShadow: const [
        BoxShadow(
          color: Color(0x3314B8A6),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.badge_rounded, color: Colors.white, size: 34),
        const SizedBox(height: 18),
        const Text(
          'Direksiyon Öğretmeni',
          style: TextStyle(
            color: Colors.white,
            fontSize: 25,
            fontWeight: FontWeight.w900,
          ),
        ),
        const Text(
          'Güvenli ders yönetimi ve değerlendirme',
          style: TextStyle(
            color: Color(0xFFCCFBF1),
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            _heroMetric('$todayCount', 'Bugünkü ders'),
            const SizedBox(width: 12),
            _heroMetric('$totalCount', 'Programda'),
          ],
        ),
      ],
    ),
  );
  Widget _heroMetric(String value, String label) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .14),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Color(0xFFCCFBF1), fontSize: 12),
          ),
        ],
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16),
        const SizedBox(width: 5),
        Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
}

class _Status extends StatelessWidget {
  const _Status({required this.value, required this.color});
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      value,
      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800),
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty();
  @override
  Widget build(BuildContext context) => const Card(
    child: Padding(
      padding: EdgeInsets.all(28),
      child: Column(
        children: [
          Icon(
            Icons.event_available_rounded,
            size: 45,
            color: Color(0xFF14B8A6),
          ),
          SizedBox(height: 12),
          Text(
            'Planlanmış direksiyon dersiniz bulunmuyor.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.text,
    required this.onRetry,
  });
  final IconData icon;
  final String text;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Tekrar Dene'),
          ),
        ],
      ),
    ),
  );
}
