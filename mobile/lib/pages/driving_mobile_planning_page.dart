import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import '../services/driving_permissions_store.dart';
import '../widgets/driving_ui.dart';
import 'driving_today_attendance_tab.dart';

class DrivingMobilePlanningPage extends StatefulWidget {
  const DrivingMobilePlanningPage({super.key});
  @override
  State<DrivingMobilePlanningPage> createState() =>
      _DrivingMobilePlanningPageState();
}

class _DrivingMobilePlanningPageState extends State<DrivingMobilePlanningPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true, _saving = false;
  String? _error;
  Map<String, dynamic> _reference = const {};
  List<Map<String, dynamic>> _calendar = const [], _requests = const [];
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;

  /// Takvim sekmesinde gösterilen gün.
  DateTime _day = DateTime.now();
  static const _slotStartHour = 7, _slotEndHour = 20;

  /// Takvimde yer tutan randevu durumları — backend'deki
  /// DrivingAppointmentStatuses.Blocking kümesiyle aynı.
  static const _blockingStatuses = {
    'Requested',
    'WaitingApproval',
    'Planned',
    'Approved',
    'CheckedIn',
    'InProgress',
  };
  List<Map<String, dynamic>> _list(String key) =>
      (_reference[key] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 5, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await Future.wait([
        DrivingSchoolApiService.instance.mobilePlanningReference(),
        DrivingSchoolApiService.instance.drivingCalendar(),
        DrivingSchoolApiService.instance.appointmentRequests(),
      ]);
      final permissions = await DrivingPermissionsStore.instance.load();
      if (mounted) {
        setState(() {
          _reference = result[0] as Map<String, dynamic>;
          _calendar = result[1] as List<Map<String, dynamic>>;
          _requests = result[2] as List<Map<String, dynamic>>;
          _permissions = permissions;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _date(dynamic raw) {
    final d = DateTime.tryParse('$raw')?.toLocal();
    if (d == null) return '-';
    return '${d.day}.${d.month}.${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  void _message(String value, {bool error = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(value),
          backgroundColor: error ? Colors.red : null,
        ),
      );
    }
  }

  Future<void> _run(Future<dynamic> Function() action, String success) async {
    setState(() => _saving = true);
    try {
      await action();
      _message(success);
      await _load();
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(
      title: Text('Mobil Planlama'.tr),
      bottom: TabBar(
        controller: _tabs,
        isScrollable: true,
        tabs: const [
          Tab(icon: Icon(Icons.today_rounded), text: 'Bugün'),
          Tab(icon: Icon(Icons.calendar_month), text: 'Takvim'),
          Tab(icon: Icon(Icons.approval), text: 'Talepler'),
          Tab(icon: Icon(Icons.group_add), text: 'Kayıtlar'),
          Tab(icon: Icon(Icons.add_task), text: 'Ders Planla'),
        ],
      ),
    ),
    child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton(onPressed: _load, child: Text(_error!)),
          )
        : TabBarView(
            controller: _tabs,
            children: [
              const DrivingTodayAttendanceTab(),
              _calendarTab(),
              _requestsTab(),
              _recordsTab(),
              _planningTab(),
            ],
          ),
  );

  /// Seçili günün saat ızgarası. Boş bir saate dokunulunca tarih/saat önceden
  /// dolu ders planlama formu açılır (masaüstündeki takvim tıklamasının
  /// mobil karşılığı); o saatte dersi olan öğretmen formda seçilemez.
  Widget _calendarTab() {
    final dayStart = DateTime(_day.year, _day.month, _day.day);
    final ofDay = _calendar.where((x) {
      final s = DateTime.tryParse('${x['startsAtUtc']}')?.toLocal();
      return s != null &&
          s.year == dayStart.year &&
          s.month == dayStart.month &&
          s.day == dayStart.day;
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left_rounded),
                    onPressed: () => setState(
                      () => _day = dayStart.subtract(const Duration(days: 1)),
                    ),
                  ),
                  Expanded(
                    child: Center(
                      child: Text(
                        _dayLabel(dayStart),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right_rounded),
                    onPressed: () => setState(
                      () => _day = dayStart.add(const Duration(days: 1)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${ofDay.length} randevu • Boş saate dokunarak randevu oluşturun'
                .tr,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          ...List.generate(_slotEndHour - _slotStartHour, (i) {
            final hour = _slotStartHour + i;
            final slotStart = dayStart.add(Duration(hours: hour));
            final slotEnd = slotStart.add(const Duration(hours: 1));
            final inSlot = ofDay.where((x) {
              final s = DateTime.tryParse('${x['startsAtUtc']}')?.toLocal();
              final e = DateTime.tryParse('${x['endsAtUtc']}')?.toLocal();
              return s != null &&
                  e != null &&
                  s.isBefore(slotEnd) &&
                  e.isAfter(slotStart);
            }).toList();

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 52,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: Text(
                        '${hour.toString().padLeft(2, '0')}:00',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: inSlot.isEmpty
                        ? InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: _saving
                                ? null
                                : () => _planLesson(initialStart: slotStart),
                            child: Container(
                              height: 46,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: Theme.of(
                                    context,
                                  ).dividerColor.withValues(alpha: .6),
                                ),
                              ),
                              child: Text(
                                'Boş — randevu oluştur'.tr,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          )
                        : Column(
                            children: inSlot
                                .map(
                                  (x) => Card(
                                    margin: const EdgeInsets.only(bottom: 6),
                                    child: ListTile(
                                      dense: true,
                                      leading: const CircleAvatar(
                                        child: Icon(Icons.route_rounded),
                                      ),
                                      title: Text(
                                        '${x['studentName']}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      subtitle: Text(
                                        '${_date(x['startsAtUtc'])}\n${x['instructorName']} • ${x['vehiclePlate']}',
                                      ),
                                      isThreeLine: true,
                                      trailing: Chip(
                                        label: Text('${x['status']}'),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _dayLabel(DateTime d) {
    const days = [
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
      'Pazar',
    ];
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year} • ${days[d.weekday - 1]}';
  }

  Widget _requestsTab() {
    final pending = _requests.where((x) => x['status'] == 'Pending').toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (pending.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'Bekleyen mobil talep yok.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ...pending.map(
            (x) => Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${x['fullName']}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      '${x['requestType'] == 'Reschedule' ? 'Yeniden planlama' : 'Yeni randevu'} • ${_date(x['requestedStartsAtUtc'])}',
                    ),
                    Text(
                      '${x['studentNote'] ?? ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: _saving
                                ? null
                                : () => _run(
                                    () => DrivingSchoolApiService.instance
                                        .decideAppointmentRequest(
                                          '${x['id']}',
                                          {
                                            'approved': true,
                                            'instructorProfileId': null,
                                            'vehicleId': null,
                                            'note': 'Mobil kurum onayı',
                                          },
                                        ),
                                    'Talep onaylandı.',
                                  ),
                            child: Text('Onayla'.tr),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _saving ? null : () => _reject(x),
                            child: Text('Reddet'.tr),
                          ),
                        ),
                      ],
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

  Widget _recordsTab() => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _saving ? null : _createStudent,
                icon: const Icon(Icons.person_add),
                label: Text('Kursiyer Kaydı'.tr),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _saving ? null : _createInstructor,
                icon: const Icon(Icons.co_present),
                label: Text('Öğretmen Atama'.tr),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const Text(
          'Kursiyerler',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        ..._list('students').map(
          (x) => Card(
            child: ListTile(
              title: Text('${x['fullName']}'),
              subtitle: Text('${x['licenseClass']} • ${x['transmissionType']}'),
              trailing: Chip(label: Text('${x['status']}')),
            ),
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'Direksiyon öğretmenleri',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        ..._list('instructors').map(
          (x) => Card(
            child: ListTile(
              title: Text('${x['fullName']}'),
              subtitle: Text('Sınıflar: ${x['licenseClasses']}'),
              trailing: Icon(
                x['isActive'] == true ? Icons.check_circle : Icons.pause_circle,
                color: x['isActive'] == true ? Colors.green : Colors.orange,
              ),
              onTap: _permissions.can(DrivingPermissions.instructorUpdate)
                  ? () => _manageInstructor(x)
                  : null,
            ),
          ),
        ),
      ],
    ),
  );

  Future<void> _manageInstructor(Map<String, dynamic> instructor) async {
    var automatic = instructor['automaticStatusEnabled'] != false;
    var active = instructor['isActive'] == true;
    final ready = instructor['complianceReady'] == true;
    final canDeactivate = _permissions.can(
      DrivingPermissions.instructorDeactivate,
    );
    final canOverride = _permissions.can(
      DrivingPermissions.overrideDocumentExpiry,
    );
    final reasonCtrl = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (_, setLocal) {
          final sensitive = !active || (active && !ready);
          return AlertDialog(
            title: Text('${instructor['fullName']}'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      ready ? Icons.verified_rounded : Icons.warning_rounded,
                      color: ready ? Colors.green : Colors.orange,
                    ),
                    title: Text(
                      ready
                          ? 'Çalışma izni geçerli'
                          : 'Çalışma izni eksik veya geçersiz',
                    ),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Otomatik yönetim'),
                    subtitle: const Text(
                      'İzin uygunsa aktif, değilse pasif tutulur.',
                    ),
                    value: automatic,
                    onChanged: (v) => setLocal(() => automatic = v),
                  ),
                  if (!automatic) ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Direksiyon öğretmeni aktif'),
                      value: active,
                      onChanged: active && !canDeactivate
                          ? null
                          : (v) => setLocal(() => active = v),
                    ),
                    if (active && !ready)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.gpp_maybe_rounded),
                        title: const Text('Yetkili istisna gerekir'),
                        subtitle: Text(
                          canOverride
                              ? 'Gerekçe ile aktif edilebilir.'
                              : 'Bu işlem için yetkiniz yok.',
                        ),
                      ),
                    TextField(
                      controller: reasonCtrl,
                      onChanged: (_) => setLocal(() {}),
                      maxLength: 500,
                      decoration: InputDecoration(
                        labelText: sensitive
                            ? 'Gerekçe (en az 10 karakter)'
                            : 'Gerekçe',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('Vazgeç'.tr),
              ),
              FilledButton(
                onPressed:
                    (!automatic && active && !ready && !canOverride) ||
                        (!automatic &&
                            sensitive &&
                            reasonCtrl.text.trim().length < 10)
                    ? null
                    : () async {
                        try {
                          await DrivingSchoolApiService.instance
                              .updateInstructorLifecycle(
                                '${instructor['id']}',
                                {
                                  'isActive': active,
                                  'automaticStatusEnabled': automatic,
                                  'allowComplianceOverride': active && !ready,
                                  'reason': reasonCtrl.text.trim(),
                                },
                              );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, true);
                          }
                        } catch (e) {
                          if (dialogContext.mounted) {
                            ScaffoldMessenger.of(
                              dialogContext,
                            ).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        }
                      },
                child: Text('Kaydet'.tr),
              ),
            ],
          );
        },
      ),
    );
    reasonCtrl.dispose();
    if (saved == true) await _load();
  }

  Widget _planningTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Card(
        child: Padding(
          padding: EdgeInsets.all(18),
          child: Text(
            'Kursiyer, başlangıç/bitiş, öğretmen, araç, buluşma noktası ve not ile ayrıntılı direksiyon dersi planlayın. Çakışma ve uygunluk kontrolleri kayıtta otomatik uygulanır.',
          ),
        ),
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        onPressed: _saving ? null : _planLesson,
        icon: const Icon(Icons.add_task_rounded),
        label: Text('Yeni Direksiyon Dersi Planla'.tr),
      ),
    ],
  );

  Future<void> _reject(Map<String, dynamic> request) async {
    final c = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text('Talebi reddet'.tr),
        content: TextField(
          controller: c,
          decoration: const InputDecoration(labelText: 'Ret nedeni'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(d, true),
            child: Text('Reddet'.tr),
          ),
        ],
      ),
    );
    if (ok == true && c.text.trim().length >= 5) {
      await _run(
        () => DrivingSchoolApiService.instance.decideAppointmentRequest(
          '${request['id']}',
          {'approved': false, 'note': c.text.trim()},
        ),
        'Talep reddedildi.',
      );
    }
  }

  Future<void> _createStudent() async {
    final candidates = _list('baseStudents'), packages = _list('packages');
    String? studentId, packageId;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (_, setLocal) => AlertDialog(
          title: Text('Kursiyer sürücü kaydı'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Öğrenci'),
                items: candidates
                    .map(
                      (x) => DropdownMenuItem(
                        value: '${x['id']}',
                        child: Text('${x['fullName']}'),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setLocal(() => studentId = v),
              ),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Paket'),
                items: packages
                    .map(
                      (x) => DropdownMenuItem(
                        value: '${x['id']}',
                        child: Text('${x['name']} • ${x['licenseClass']}'),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setLocal(() => packageId = v),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(d, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: studentId == null || packageId == null
                  ? null
                  : () => Navigator.pop(d, true),
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      final package = packages.firstWhere((x) => '${x['id']}' == packageId);
      await _run(
        () => DrivingSchoolApiService.instance.createStudentProfile({
          'studentId': studentId,
          'packageId': packageId,
          'licenseClass': package['licenseClass'],
          'transmissionType': package['transmissionType'] == 'Manual' ? 1 : 2,
        }),
        'Kursiyer kaydı oluşturuldu.',
      );
    }
  }

  Future<void> _createInstructor() async {
    final staff = _list('staff');
    String? staffId;
    final classes = TextEditingController(text: 'B');
    final permitNo = TextEditingController();
    DateTime? permitExpires;
    var manual = true, automatic = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (_, setLocal) => AlertDialog(
          title: Text('Direksiyon öğretmeni atama'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'Personel'),
                items: staff
                    .map(
                      (x) => DropdownMenuItem(
                        value: '${x['id']}',
                        child: Text('${x['fullName']}'),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setLocal(() => staffId = v),
              ),
              TextField(
                controller: classes,
                decoration: const InputDecoration(
                  labelText: 'Ehliyet sınıfları (B,C)',
                ),
              ),
              TextField(
                controller: permitNo,
                maxLength: 60,
                decoration: const InputDecoration(
                  labelText: 'MEB çalışma izni no',
                ),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Çalışma izni bitiş tarihi'),
                subtitle: Text(
                  permitExpires == null
                      ? 'Takip edilecekse izin no ile birlikte girin'
                      : '${permitExpires!.day}.${permitExpires!.month}.${permitExpires!.year}',
                ),
                trailing: const Icon(Icons.event_rounded),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: d,
                    initialDate:
                        permitExpires ??
                        DateTime.now().add(const Duration(days: 365)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 3650)),
                  );
                  if (picked != null) setLocal(() => permitExpires = picked);
                },
              ),
              CheckboxListTile(
                value: manual,
                title: Text('Manuel'.tr),
                onChanged: (v) => setLocal(() => manual = v == true),
              ),
              CheckboxListTile(
                value: automatic,
                title: Text('Otomatik'.tr),
                onChanged: (v) => setLocal(() => automatic = v == true),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(d, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: staffId == null ? null : () => Navigator.pop(d, true),
              child: Text('Ata'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.createInstructorProfile({
          'staffId': staffId,
          'licenseClasses': classes.text
              .split(',')
              .map((x) => x.trim())
              .where((x) => x.isNotEmpty)
              .toList(),
          'canTeachManual': manual,
          'canTeachAutomatic': automatic,
          'workingPermitNo': permitNo.text.trim(),
          'workingPermitExpiresAtUtc': permitExpires?.toUtc().toIso8601String(),
        }),
        'Öğretmen yetkinliği tanımlandı.',
      );
    }
    classes.dispose();
    permitNo.dispose();
  }

  /// O aralıkta dersi olan öğretmenlerin id'leri — çakışan öğretmen formda
  /// seçilemez. Nihai kural yine backend'de zorunlu uygulanır; bu yalnızca
  /// kullanıcıyı baştan doğru seçime yönlendirir.
  Set<String> _busyInstructorIds(DateTime start, DateTime end) {
    final busy = <String>{};
    for (final x in _calendar) {
      if (!_blockingStatuses.contains('${x['status']}')) continue;
      final s = DateTime.tryParse('${x['startsAtUtc']}')?.toLocal();
      final e = DateTime.tryParse('${x['endsAtUtc']}')?.toLocal();
      final id = '${x['instructorProfileId'] ?? ''}';
      if (s == null || e == null || id.isEmpty) continue;
      if (s.isBefore(end) && e.isAfter(start)) busy.add(id);
    }
    return busy;
  }

  Future<void> _planLesson({DateTime? initialStart}) async {
    final students = _list('students'),
        instructors = _list('instructors'),
        vehicles = _list('vehicles');
    // Grup (dönem) listesi — öğrenciyi grupla filtrelemek için.
    final groups = <String, String>{};
    for (final s in students) {
      final gid = '${s['groupId'] ?? ''}';
      if (gid.isNotEmpty) groups[gid] = '${s['groupName'] ?? 'Grup'}';
    }
    String? studentId, instructorId, vehicleId;
    var groupFilter = 'all'; // 'all' | <groupId>
    var start = initialStart ?? DateTime.now().add(const Duration(days: 1));
    var end = start.add(const Duration(hours: 1));
    final meeting = TextEditingController(), note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (_, setLocal) {
          final busy = _busyInstructorIds(start, end);
          final freeInstructors = instructors
              .where(
                (x) => x['isActive'] == true && !busy.contains('${x['id']}'),
              )
              .toList();
          final busyNames = instructors
              .where((x) => busy.contains('${x['id']}'))
              .map((x) => '${x['fullName']}')
              .toList();
          // Saat değişince seçili öğretmen dolmuş olabilir; geçersiz seçimi düşür.
          if (instructorId != null && busy.contains(instructorId)) {
            instructorId = null;
          }
          // Bu uçta hem kursiyer hem araç vites türünü METİN olarak döndürür
          // ("Manual"/"Automatic"), bu yüzden doğrudan karşılaştırılabilir.
          final student = students
              .where((x) => '${x['id']}' == studentId)
              .firstOrNull;
          final fitVehicles = vehicles.where((x) {
            if (x['isInMaintenance'] == true) return false;
            if (student == null) return true;
            return '${x['licenseClass']}'.toUpperCase() ==
                    '${student['licenseClass']}'.toUpperCase() &&
                '${x['transmissionType']}' == '${student['transmissionType']}';
          }).toList();
          if (vehicleId != null &&
              !fitVehicles.any((x) => '${x['id']}' == vehicleId)) {
            vehicleId = null;
          }

          return AlertDialog(
            title: Text('Ayrıntılı ders planlama'.tr),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (groups.isNotEmpty)
                      DropdownButtonFormField<String>(
                        initialValue: groupFilter,
                        decoration: InputDecoration(
                          labelText: 'Grup / Dönem'.tr,
                        ),
                        items: [
                          DropdownMenuItem(
                            value: 'all',
                            child: Text('Tüm gruplar'.tr),
                          ),
                          ...groups.entries.map(
                            (e) => DropdownMenuItem(
                              value: e.key,
                              child: Text(e.value),
                            ),
                          ),
                        ],
                        onChanged: (v) => setLocal(() {
                          groupFilter = v ?? 'all';
                          // Grup dışına düşen seçili öğrenciyi bırak.
                          if (studentId != null &&
                              groupFilter != 'all' &&
                              students
                                      .firstWhere(
                                        (x) => '${x['id']}' == studentId,
                                        orElse: () => const {},
                                      )['groupId']
                                      ?.toString() !=
                                  groupFilter) {
                            studentId = null;
                          }
                        }),
                      ),
                    DropdownButtonFormField<String>(
                      initialValue: studentId,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Kursiyer'),
                      items: students
                          .where(
                            (x) =>
                                groupFilter == 'all' ||
                                '${x['groupId'] ?? ''}' == groupFilter,
                          )
                          .map(
                            (x) => DropdownMenuItem(
                              value: '${x['id']}',
                              child: Text(
                                '${x['fullName']}${x['groupName'] != null ? ' — ${x['groupName']}' : ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setLocal(() => studentId = v),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: instructorId,
                      decoration: InputDecoration(
                        labelText: 'Öğretmen',
                        helperMaxLines: 3,
                        helperText: busyNames.isEmpty
                            ? '${freeInstructors.length} öğretmen müsait'
                            : 'Bu saatte dersi olduğu için seçilemez: ${busyNames.join(', ')}',
                      ),
                      items: freeInstructors
                          .map(
                            (x) => DropdownMenuItem(
                              value: '${x['id']}',
                              child: Text('${x['fullName']}'),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setLocal(() => instructorId = v),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: vehicleId,
                      decoration: InputDecoration(
                        labelText: 'Araç',
                        helperText: student != null && fitVehicles.isEmpty
                            ? 'Kursiyerin sınıf/vitesine uygun araç yok.'
                            : null,
                      ),
                      items: fitVehicles
                          .map(
                            (x) => DropdownMenuItem(
                              value: '${x['id']}',
                              child: Text('${x['plateNumber']}'),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setLocal(() => vehicleId = v),
                    ),
                    ListTile(
                      title: Text('Başlangıç'.tr),
                      subtitle: Text(_date(start)),
                      onTap: () async {
                        final v = await _pickDateTime(start);
                        if (v != null) {
                          setLocal(() {
                            start = v;
                            end = v.add(const Duration(hours: 1));
                          });
                        }
                      },
                    ),
                    ListTile(
                      title: Text('Bitiş'.tr),
                      subtitle: Text(_date(end)),
                      onTap: () async {
                        final v = await _pickDateTime(end);
                        if (v != null) setLocal(() => end = v);
                      },
                    ),
                    TextField(
                      controller: meeting,
                      decoration: const InputDecoration(
                        labelText: 'Buluşma noktası',
                      ),
                    ),
                    TextField(
                      controller: note,
                      decoration: const InputDecoration(labelText: 'Ders notu'),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(d, false),
                child: Text('Vazgeç'.tr),
              ),
              FilledButton(
                onPressed:
                    studentId == null ||
                        instructorId == null ||
                        vehicleId == null
                    ? null
                    : () => Navigator.pop(d, true),
                child: Text('Planla'.tr),
              ),
            ],
          );
        },
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.createDetailedAppointment({
          'studentDrivingProfileId': studentId,
          'instructorProfileId': instructorId,
          'vehicleId': vehicleId,
          'startsAtUtc': start.toUtc().toIso8601String(),
          'endsAtUtc': end.toUtc().toIso8601String(),
          'meetingPoint': meeting.text,
          'notes': note.text,
          'overrides': <String>[],
          'overrideReason': null,
        }),
        'Direksiyon dersi planlandı.',
      );
    }
  }

  Future<DateTime?> _pickDateTime(DateTime initial) async {
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 370)),
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    return time == null
        ? null
        : DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }
}
