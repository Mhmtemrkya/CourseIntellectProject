import 'package:flutter/material.dart';

import '../services/driving_school_api_service.dart';

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
  List<Map<String, dynamic>> _list(String key) =>
      (_reference[key] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
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
      if (mounted) {
        setState(() {
          _reference = result[0] as Map<String, dynamic>;
          _calendar = result[1] as List<Map<String, dynamic>>;
          _requests = result[2] as List<Map<String, dynamic>>;
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
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Mobil Planlama'),
      bottom: TabBar(
        controller: _tabs,
        isScrollable: true,
        tabs: const [
          Tab(icon: Icon(Icons.calendar_month), text: 'Takvim'),
          Tab(icon: Icon(Icons.approval), text: 'Talepler'),
          Tab(icon: Icon(Icons.group_add), text: 'Kayıtlar'),
          Tab(icon: Icon(Icons.add_task), text: 'Ders Planla'),
        ],
      ),
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton(onPressed: _load, child: Text(_error!)),
          )
        : TabBarView(
            controller: _tabs,
            children: [
              _calendarTab(),
              _requestsTab(),
              _recordsTab(),
              _planningTab(),
            ],
          ),
  );

  Widget _calendarTab() => RefreshIndicator(
    onRefresh: _load,
    child: ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _calendar.length,
      itemBuilder: (_, i) {
        final x = _calendar[i];
        return Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.route_rounded)),
            title: Text(
              '${x['studentName']}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              '${_date(x['startsAtUtc'])}\n${x['instructorName']} • ${x['vehiclePlate']}',
            ),
            isThreeLine: true,
            trailing: Chip(label: Text('${x['status']}')),
          ),
        );
      },
    ),
  );

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
                            child: const Text('Onayla'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _saving ? null : () => _reject(x),
                            child: const Text('Reddet'),
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
                label: const Text('Kursiyer Kaydı'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _saving ? null : _createInstructor,
                icon: const Icon(Icons.co_present),
                label: const Text('Öğretmen Atama'),
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
            ),
          ),
        ),
      ],
    ),
  );

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
        label: const Text('Yeni Direksiyon Dersi Planla'),
      ),
    ],
  );

  Future<void> _reject(Map<String, dynamic> request) async {
    final c = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Talebi reddet'),
        content: TextField(
          controller: c,
          decoration: const InputDecoration(labelText: 'Ret nedeni'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(d, true),
            child: const Text('Reddet'),
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
          title: const Text('Kursiyer sürücü kaydı'),
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
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: studentId == null || packageId == null
                  ? null
                  : () => Navigator.pop(d, true),
              child: const Text('Kaydet'),
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
    var manual = true, automatic = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (_, setLocal) => AlertDialog(
          title: const Text('Direksiyon öğretmeni atama'),
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
              CheckboxListTile(
                value: manual,
                title: const Text('Manuel'),
                onChanged: (v) => setLocal(() => manual = v == true),
              ),
              CheckboxListTile(
                value: automatic,
                title: const Text('Otomatik'),
                onChanged: (v) => setLocal(() => automatic = v == true),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(d, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: staffId == null ? null : () => Navigator.pop(d, true),
              child: const Text('Ata'),
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
        }),
        'Öğretmen yetkinliği tanımlandı.',
      );
    }
  }

  Future<void> _planLesson() async {
    final students = _list('students'),
        instructors = _list('instructors'),
        vehicles = _list('vehicles');
    String? studentId, instructorId, vehicleId;
    var start = DateTime.now().add(const Duration(days: 1));
    var end = DateTime.now().add(const Duration(days: 1, hours: 1));
    final meeting = TextEditingController(), note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (_, setLocal) => AlertDialog(
          title: const Text('Ayrıntılı ders planlama'),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: 'Kursiyer'),
                    items: students
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
                    decoration: const InputDecoration(labelText: 'Öğretmen'),
                    items: instructors
                        .where((x) => x['isActive'] == true)
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
                    decoration: const InputDecoration(labelText: 'Araç'),
                    items: vehicles
                        .where((x) => x['isInMaintenance'] != true)
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
                    title: const Text('Başlangıç'),
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
                    title: const Text('Bitiş'),
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
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed:
                  studentId == null || instructorId == null || vehicleId == null
                  ? null
                  : () => Navigator.pop(d, true),
              child: const Text('Planla'),
            ),
          ],
        ),
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
