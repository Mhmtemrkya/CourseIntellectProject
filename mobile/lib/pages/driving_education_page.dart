import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingEducationPage extends StatefulWidget {
  const DrivingEducationPage({super.key});
  @override
  State<DrivingEducationPage> createState() => _DrivingEducationPageState();
}

class _DrivingEducationPageState extends State<DrivingEducationPage> {
  late Future<(DrivingPermissionSnapshot, Map<String, dynamic>)> _future;
  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() {
    _future = _load();
  });
  Future<(DrivingPermissionSnapshot, Map<String, dynamic>)> _load() async => (
    await DrivingPermissionsStore.instance.load(),
    await DrivingSchoolApiService.instance.educationOverview(),
  );
  String _date(dynamic raw) {
    final date = DateTime.tryParse('$raw')?.toLocal();
    if (date == null) return '-';
    String two(int n) => '$n'.padLeft(2, '0');
    return '${two(date.day)}.${two(date.month)}.${date.year} ${two(date.hour)}:${two(date.minute)}';
  }

  List<Map<String, dynamic>> _list(Map<String, dynamic> data, String key) =>
      (data[key] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<(DrivingPermissionSnapshot, Map<String, dynamic>)>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) return _error('${snapshot.error}');
          final permissions = snapshot.data!.$1;
          final data = snapshot.data!.$2;
          final classes = _list(data, 'classes'),
              sessions = _list(data, 'sessions'),
              exams = _list(data, 'exams'),
              candidates = _list(data, 'candidates');
          final reference = Map<String, dynamic>.from(
            data['reference'] as Map? ?? const {},
          );
          final instructors = _list(reference, 'instructors'),
              students = _list(reference, 'students');
          return DefaultTabController(
            length: 3,
            child: DrivingScaffold(
              appBar: AppBar(
                title: Text('Teorik Eğitim ve Sınav'.tr),
                bottom: const TabBar(
                  tabs: [
                    Tab(text: 'Sınıflar'),
                    Tab(text: 'Ders & Yoklama'),
                    Tab(text: 'Sınavlar'),
                  ],
                ),
              ),
              child: TabBarView(
                children: [
                  _classes(classes, instructors, students, permissions),
                  _sessions(sessions, classes, instructors, permissions),
                  _exams(exams, candidates, students, permissions),
                ],
              ),
            ),
          );
        },
      );

  Widget _classes(
    List<Map<String, dynamic>> rows,
    List<Map<String, dynamic>> instructors,
    List<Map<String, dynamic>> students,
    DrivingPermissionSnapshot p,
  ) => RefreshIndicator(
    onRefresh: () async => _reload(),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        if (p.can(DrivingPermissions.theoryManage))
          _action(
            Icons.add_business_rounded,
            'Yeni teorik sınıf',
            'Öğretmen, tarih, kapasite ve derslik belirleyin.',
            () => _createClass(instructors),
          ),
        if (rows.isEmpty) const _Empty('Henüz teorik sınıf oluşturulmadı.'),
        ...rows.map(
          (row) => Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${row['name']} • ${row['licenseClass']}',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Chip(
                        label: Text(
                          '${row['studentCount']}/${row['capacity']}',
                        ),
                      ),
                    ],
                  ),
                  Text('${row['instructorName']} • ${row['room'] ?? '-'}'),
                  Text(
                    '${_date(row['startsAtUtc'])} – ${_date(row['endsAtUtc'])}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (p.can(DrivingPermissions.theoryManage))
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () => _assignStudents(
                          '${row['id']}',
                          students
                              .where(
                                (x) =>
                                    '${x['licenseClass']}' ==
                                    '${row['licenseClass']}',
                              )
                              .toList(),
                          theory: true,
                        ),
                        icon: const Icon(Icons.group_add_rounded),
                        label: Text('Öğrenci Ata'.tr),
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

  Widget _sessions(
    List<Map<String, dynamic>> rows,
    List<Map<String, dynamic>> classes,
    List<Map<String, dynamic>> instructors,
    DrivingPermissionSnapshot p,
  ) => RefreshIndicator(
    onRefresh: () async => _reload(),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        if (p.can(DrivingPermissions.theoryManage))
          _action(
            Icons.calendar_month_rounded,
            'Ders programına ekle',
            'Sınıf, konu, öğretmen ve derslik planlayın.',
            () => _createSession(classes, instructors),
          ),
        if (rows.isEmpty) const _Empty('Bu tarih aralığında teorik ders yok.'),
        ...rows.map(
          (row) => Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: const CircleAvatar(child: Icon(Icons.menu_book_rounded)),
              title: Text(
                '${row['subject']}',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text(
                '${row['topic']}\n${_date(row['startsAtUtc'])} • ${row['className']} • ${row['room']}',
              ),
              isThreeLine: true,
              trailing: p.can(DrivingPermissions.theoryAttendance)
                  ? IconButton(
                      icon: const Icon(Icons.fact_check_rounded),
                      tooltip: 'Yoklama',
                      onPressed: () => _attendance(row),
                    )
                  : Chip(label: Text('${row['status']}')),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _exams(
    List<Map<String, dynamic>> exams,
    List<Map<String, dynamic>> candidates,
    List<Map<String, dynamic>> students,
    DrivingPermissionSnapshot p,
  ) => RefreshIndicator(
    onRefresh: () async => _reload(),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        if (p.can(DrivingPermissions.examManage))
          _action(
            Icons.assignment_add,
            'Yeni sınav ve komisyon',
            'E-sınav veya direksiyon sınavını komisyonla planlayın.',
            _createExam,
          ),
        if (exams.isEmpty)
          const _Empty('Planlanmış veya sonuçlanmış sınav yok.'),
        ...exams.map((exam) {
          final examCandidates = candidates
              .where((x) => '${x['examSessionId']}' == '${exam['id']}')
              .toList();
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${exam['title']}',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Chip(
                        label: Text(
                          '${exam['examType']}' == 'DrivingPractice'
                              ? 'Direksiyon'
                              : 'E-sınav',
                        ),
                      ),
                    ],
                  ),
                  Text('${_date(exam['startsAtUtc'])} • ${exam['location']}'),
                  Text(
                    'Komisyon: ${(exam['commission'] as List? ?? const []).map((x) => (x as Map)['fullName']).join(', ')}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (p.can(DrivingPermissions.examManage))
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () => _assignStudents(
                          '${exam['id']}',
                          students,
                          theory: false,
                        ),
                        icon: const Icon(Icons.person_add_alt_1),
                        label: Text('Aday Ekle'.tr),
                      ),
                    ),
                  if (examCandidates.isNotEmpty) const Divider(),
                  ...examCandidates.map(
                    (candidate) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${candidate['studentName']}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${candidate['attemptNo']}. deneme • ${candidate['status']}${candidate['score'] != null ? ' • ${candidate['score']} puan' : ''}${('${candidate['failureReason'] ?? ''}').isNotEmpty ? '\n${candidate['failureReason']}' : ''}',
                      ),
                      trailing: Wrap(
                        spacing: 4,
                        children: [
                          if (p.can(DrivingPermissions.examResultEnter) &&
                              candidate['status'] == 'Planned')
                            IconButton(
                              icon: const Icon(
                                Icons.task_alt_rounded,
                                color: Colors.green,
                              ),
                              tooltip: 'Sonuç gir',
                              onPressed: () => _result(candidate),
                            ),
                          if (p.can(DrivingPermissions.examManage) &&
                              candidate['status'] == 'Failed')
                            IconButton(
                              icon: const Icon(Icons.replay_rounded),
                              tooltip: 'Tekrar sınavı',
                              onPressed: () => _retry(candidate, exam, exams),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    ),
  );

  Widget _action(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback tap,
  ) => Card(
    color: Theme.of(
      context,
    ).colorScheme.primaryContainer.withValues(alpha: .45),
    child: ListTile(
      onTap: tap,
      leading: CircleAvatar(child: Icon(icon)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
    ),
  );
  Widget _error(String message) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          FilledButton.icon(
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
            label: Text('Tekrar Dene'.tr),
          ),
        ],
      ),
    ),
  );

  Future<DateTime?> _pickDateTime(DateTime initial) async {
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<bool> _run(Future<dynamic> Function() action, String success) async {
    try {
      await action();
      if (!mounted) return false;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(success)));
      _reload();
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
      return false;
    }
  }

  Future<void> _createClass(List<Map<String, dynamic>> instructors) async {
    if (instructors.isEmpty) return;
    final name = TextEditingController(),
        license = TextEditingController(text: 'B'),
        room = TextEditingController(),
        capacity = TextEditingController(text: '24');
    var instructorId = '${instructors.first['id']}';
    var start = DateTime.now().add(const Duration(days: 1)),
        end = DateTime.now().add(const Duration(days: 90));
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) => AlertDialog(
          title: Text('Yeni teorik sınıf'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Sınıf adı'),
                ),
                TextField(
                  controller: license,
                  decoration: const InputDecoration(
                    labelText: 'Ehliyet sınıfı',
                  ),
                ),
                DropdownButtonFormField<String>(
                  initialValue: instructorId,
                  decoration: const InputDecoration(labelText: 'Öğretmen'),
                  items: instructors
                      .map(
                        (x) => DropdownMenuItem(
                          value: '${x['id']}',
                          child: Text('${x['fullName']}'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => instructorId = v!,
                ),
                TextField(
                  controller: capacity,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Kapasite'),
                ),
                TextField(
                  controller: room,
                  decoration: const InputDecoration(labelText: 'Derslik'),
                ),
                ListTile(
                  title: Text('Başlangıç'.tr),
                  subtitle: Text(_date(start.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(start);
                    if (v != null) setState(() => start = v);
                  },
                ),
                ListTile(
                  title: Text('Bitiş'.tr),
                  subtitle: Text(_date(end.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(end);
                    if (v != null) setState(() => end = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Oluştur'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.createTheoryClass({
          'name': name.text,
          'licenseClass': license.text,
          'instructorStaffId': instructorId,
          'capacity': int.tryParse(capacity.text) ?? 24,
          'startsAtUtc': start.toUtc().toIso8601String(),
          'endsAtUtc': end.toUtc().toIso8601String(),
          'room': room.text,
        }),
        'Teorik sınıf oluşturuldu.',
      );
    }
  }

  Future<void> _createSession(
    List<Map<String, dynamic>> classes,
    List<Map<String, dynamic>> instructors,
  ) async {
    if (classes.isEmpty) return;
    final subject = TextEditingController(),
        topic = TextEditingController(),
        room = TextEditingController();
    var classId = '${classes.first['id']}';
    var start = DateTime.now().add(const Duration(days: 1)),
        end = start.add(const Duration(hours: 1));
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) => AlertDialog(
          title: Text('Teorik ders planla'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: classId,
                  decoration: const InputDecoration(labelText: 'Sınıf'),
                  items: classes
                      .map(
                        (x) => DropdownMenuItem(
                          value: '${x['id']}',
                          child: Text('${x['name']}'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => classId = v!,
                ),
                TextField(
                  controller: subject,
                  decoration: const InputDecoration(labelText: 'Ders alanı'),
                ),
                TextField(
                  controller: topic,
                  decoration: const InputDecoration(labelText: 'Konu'),
                ),
                TextField(
                  controller: room,
                  decoration: const InputDecoration(labelText: 'Derslik'),
                ),
                ListTile(
                  title: Text('Başlangıç'.tr),
                  subtitle: Text(_date(start.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(start);
                    if (v != null) {
                      setState(() {
                        start = v;
                        end = v.add(const Duration(hours: 1));
                      });
                    }
                  },
                ),
                ListTile(
                  title: Text('Bitiş'.tr),
                  subtitle: Text(_date(end.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(end);
                    if (v != null) setState(() => end = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Planla'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.createTheorySession({
          'theoryClassId': classId,
          'instructorStaffId': null,
          'subject': subject.text,
          'topic': topic.text,
          'startsAtUtc': start.toUtc().toIso8601String(),
          'endsAtUtc': end.toUtc().toIso8601String(),
          'room': room.text,
        }),
        'Teorik ders planlandı.',
      );
    }
  }

  Future<void> _createExam() async {
    final title = TextEditingController(),
        location = TextEditingController(),
        member = TextEditingController(),
        role = TextEditingController(text: 'Komisyon Başkanı'),
        organization = TextEditingController(),
        capacity = TextEditingController(text: '20');
    var type = 'TheoryEExam';
    var start = DateTime.now().add(const Duration(days: 7)),
        end = start.add(const Duration(hours: 1));
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) => AlertDialog(
          title: Text('Sınav ve komisyon'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Sınav türü'),
                  items: [
                    DropdownMenuItem(
                      value: 'TheoryEExam',
                      child: Text('E-sınav'.tr),
                    ),
                    DropdownMenuItem(
                      value: 'DrivingPractice',
                      child: Text('Direksiyon sınavı'.tr),
                    ),
                  ],
                  onChanged: (v) => type = v!,
                ),
                TextField(
                  controller: title,
                  decoration: const InputDecoration(labelText: 'Sınav adı'),
                ),
                TextField(
                  controller: location,
                  decoration: const InputDecoration(labelText: 'Konum'),
                ),
                TextField(
                  controller: capacity,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Kapasite'),
                ),
                const Divider(),
                TextField(
                  controller: member,
                  decoration: const InputDecoration(
                    labelText: 'Komisyon üyesi',
                  ),
                ),
                TextField(
                  controller: role,
                  decoration: const InputDecoration(labelText: 'Görevi'),
                ),
                TextField(
                  controller: organization,
                  decoration: const InputDecoration(labelText: 'Kurumu'),
                ),
                ListTile(
                  title: Text('Başlangıç'.tr),
                  subtitle: Text(_date(start.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(start);
                    if (v != null) {
                      setState(() {
                        start = v;
                        end = v.add(const Duration(hours: 1));
                      });
                    }
                  },
                ),
                ListTile(
                  title: Text('Bitiş'.tr),
                  subtitle: Text(_date(end.toIso8601String())),
                  onTap: () async {
                    final v = await _pickDateTime(end);
                    if (v != null) setState(() => end = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Oluştur'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.createExamSession({
          'examType': type,
          'title': title.text,
          'startsAtUtc': start.toUtc().toIso8601String(),
          'endsAtUtc': end.toUtc().toIso8601String(),
          'location': location.text,
          'capacity': int.tryParse(capacity.text) ?? 20,
          'commission': [
            {
              'fullName': member.text,
              'role': role.text,
              'organization': organization.text,
            },
          ],
        }),
        'Sınav ve komisyon oluşturuldu.',
      );
    }
  }

  Future<void> _assignStudents(
    String id,
    List<Map<String, dynamic>> students, {
    required bool theory,
  }) async {
    final selected = <String>{};
    final fee = TextEditingController(text: '0');
    // Grup (dönem) listesi — öğrenciyi grupla filtrele.
    final groups = <String, String>{};
    for (final s in students) {
      final gid = '${s['groupId'] ?? ''}';
      if (gid.isNotEmpty) groups[gid] = '${s['groupName'] ?? 'Grup'}';
    }
    var groupFilter = 'all';
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) {
          final visible = students
              .where((x) =>
                  groupFilter == 'all' || '${x['groupId'] ?? ''}' == groupFilter)
              .toList();
          return AlertDialog(
          title: Text(theory ? 'Sınıfa öğrenci ata' : 'Sınava aday ekle'),
          content: SizedBox(
            width: 420,
            height: 420,
            child: Column(
              children: [
                if (!theory)
                  TextField(
                    controller: fee,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Kişi başı sınav ücreti',
                    ),
                  ),
                if (groups.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: groupFilter,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: 'Grup / Dönem'.tr),
                    items: [
                      DropdownMenuItem(value: 'all', child: Text('Tüm gruplar'.tr)),
                      ...groups.entries.map(
                        (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                      ),
                    ],
                    onChanged: (v) => setState(() => groupFilter = v ?? 'all'),
                  ),
                Expanded(
                  child: ListView(
                    children: visible
                        .map(
                          (x) => CheckboxListTile(
                            value: selected.contains('${x['id']}'),
                            title: Text('${x['fullName']}'),
                            subtitle: Text([
                              '${x['licenseClass'] ?? ''}',
                              if (x['groupName'] != null) 'Grup: ${x['groupName']}',
                            ].where((t) => t.isNotEmpty).join(' • ')),
                            onChanged: (v) => setState(() {
                              if (v == true) {
                                selected.add('${x['id']}');
                              } else {
                                selected.remove('${x['id']}');
                              }
                            }),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: selected.isEmpty
                  ? null
                  : () => Navigator.pop(dialog, true),
              child: Text('Ekle'.tr),
            ),
          ],
        );
        },
      ),
    );
    if (ok == true) {
      await _run(
        () => theory
            ? DrivingSchoolApiService.instance.enrollTheoryStudents(
                id,
                selected.toList(),
              )
            : DrivingSchoolApiService.instance.addExamCandidates(
                id,
                selected.toList(),
                double.tryParse(fee.text) ?? 0,
              ),
        theory ? 'Öğrenciler sınıfa atandı.' : 'Adaylar sınava eklendi.',
      );
    }
  }

  Future<void> _attendance(Map<String, dynamic> session) async {
    final rows = await DrivingSchoolApiService.instance.theoryAttendance(
      '${session['id']}',
    );
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) => AlertDialog(
          title: Text('${session['subject']} yoklaması'),
          content: SizedBox(
            width: 480,
            height: 500,
            child: ListView(
              children: rows
                  .map(
                    (row) => Card(
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Column(
                          children: [
                            Text(
                              '${row['studentName']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            DropdownButtonFormField<String>(
                              initialValue: '${row['status']}',
                              items: [
                                DropdownMenuItem(
                                  value: 'Present',
                                  child: Text('Katıldı'.tr),
                                ),
                                DropdownMenuItem(
                                  value: 'Late',
                                  child: Text('Geç kaldı'.tr),
                                ),
                                DropdownMenuItem(
                                  value: 'Absent',
                                  child: Text('Katılmadı'.tr),
                                ),
                                DropdownMenuItem(
                                  value: 'Excused',
                                  child: Text('Mazeretli'.tr),
                                ),
                              ],
                              onChanged: (v) => row['status'] = v,
                            ),
                            TextFormField(
                              initialValue: '${row['note'] ?? ''}',
                              decoration: const InputDecoration(
                                labelText: 'Not',
                              ),
                              onChanged: (v) => row['note'] = v,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.saveTheoryAttendance(
          '${session['id']}',
          rows
              .map(
                (x) => {
                  'studentProfileId': '${x['studentDrivingProfileId']}',
                  'status': '${x['status']}',
                  'note': '${x['note'] ?? ''}',
                },
              )
              .toList(),
        ),
        'Yoklama kaydedildi.',
      );
    }
  }

  Future<void> _result(Map<String, dynamic> candidate) async {
    var passed = true;
    final score = TextEditingController(text: '70'),
        reason = TextEditingController(),
        note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (_, setState) => AlertDialog(
          title: Text('Sınav sonucu'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                value: passed,
                title: Text(passed ? 'Geçti' : 'Kaldı'),
                onChanged: (v) => setState(() => passed = v),
              ),
              TextField(
                controller: score,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Puan (0-100)'),
              ),
              if (!passed)
                TextField(
                  controller: reason,
                  decoration: const InputDecoration(
                    labelText: 'Başarısızlık nedeni',
                  ),
                ),
              TextField(
                controller: note,
                decoration: const InputDecoration(labelText: 'Sonuç notu'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: Text('Vazgeç'.tr),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: Text('Sonucu Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance
            .enterExamResult('${candidate['id']}', {
              'passed': passed,
              'score': double.tryParse(score.text),
              'failureReason': reason.text,
              'note': note.text,
            }),
        'Sınav sonucu kaydedildi.',
      );
    }
  }

  Future<void> _retry(
    Map<String, dynamic> candidate,
    Map<String, dynamic> exam,
    List<Map<String, dynamic>> exams,
  ) async {
    final alternatives = exams
        .where(
          (x) =>
              x['examType'] == exam['examType'] &&
              x['status'] == 'Planned' &&
              x['id'] != exam['id'],
        )
        .toList();
    if (alternatives.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Önce aynı türde yeni sınav oluşturun.'.tr)),
      );
      return;
    }
    var target = '${alternatives.first['id']}';
    final fee = TextEditingController(text: '0');
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Tekrar sınavı planla'.tr),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: target,
              items: alternatives
                  .map(
                    (x) => DropdownMenuItem(
                      value: '${x['id']}',
                      child: Text('${x['title']} • ${_date(x['startsAtUtc'])}'),
                    ),
                  )
                  .toList(),
              onChanged: (v) => target = v!,
            ),
            TextField(
              controller: fee,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Tekrar sınav ücreti',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text('Planla'.tr),
          ),
        ],
      ),
    );
    if (ok == true) {
      await _run(
        () => DrivingSchoolApiService.instance.scheduleExamRetry(
          '${candidate['id']}',
          target,
          double.tryParse(fee.text) ?? 0,
        ),
        'Tekrar sınavı planlandı.',
      );
    }
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(30),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.event_busy_rounded, size: 42),
            const SizedBox(height: 10),
            Text(text, textAlign: TextAlign.center),
          ],
        ),
      ),
    ),
  );
}
