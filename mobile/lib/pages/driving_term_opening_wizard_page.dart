import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingTermOpeningWizardPage extends StatefulWidget {
  const DrivingTermOpeningWizardPage({super.key});

  @override
  State<DrivingTermOpeningWizardPage> createState() =>
      _DrivingTermOpeningWizardPageState();
}

class _DrivingTermOpeningWizardPageState
    extends State<DrivingTermOpeningWizardPage> {
  static const _steps = [
    'Dönem bilgileri',
    'Kontenjan',
    'Kursiyer listesi',
    'Eksik bilgi ve evraklar',
    'Teorik ders programı',
    'Derslik ve öğretmen',
    'MEBBİS’e hazır kursiyerler',
    'Son kontrol ve çıktı',
  ];

  final _name = TextEditingController();
  final _code = TextEditingController();
  final _description = TextEditingController();
  final _quota = TextEditingController(text: '24');
  final _licenseClass = TextEditingController(text: 'B');
  final _className = TextEditingController();
  final _room = TextEditingController();
  final _sessionSubject = TextEditingController(text: 'Trafik ve Çevre');
  final _sessionTopic = TextEditingController(text: 'Temel trafik bilgisi');
  int _current = 0;
  int _termYear = DateTime.now().year;
  int _termNumber = DateTime.now().month;
  late DateTime _deadline;
  late DateTime _theoryStart;
  late DateTime _theoryEnd;
  String _instructorId = '';
  final Set<String> _selected = {};
  final List<Map<String, dynamic>> _sessions = [];
  Map<String, dynamic>? _options;
  Map<String, dynamic>? _validation;
  Map<String, dynamic>? _result;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _theoryStart = DateTime(now.year, now.month, now.day + 7, 9);
    _theoryEnd = _theoryStart.add(const Duration(days: 30));
    _deadline = _theoryStart.subtract(const Duration(days: 1));
    _name.text = '${now.year} / ${now.month}. Dönem';
    _className.text = '${now.year} B Sınıfı Teorik Eğitim';
    _load();
  }

  Future<void> _load() async {
    try {
      final value = await DrivingSchoolApiService.instance
          .termOpeningWizardOptions();
      if (mounted) setState(() => _options = value);
    } catch (e) {
      if (mounted) {
        setState(() => _error = '$e'.replaceFirst('Bad state: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _students =>
      (_options?['students'] as List? ?? const [])
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();
  List<Map<String, dynamic>> get _instructors =>
      (_options?['instructors'] as List? ?? const [])
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();
  List<Map<String, dynamic>> get _selectedStudents =>
      _students.where((x) => _selected.contains('${x['id']}')).toList();

  Map<String, dynamic> _payload() => {
    'name': _name.text.trim(),
    'description': _description.text.trim(),
    'termYear': _termYear,
    'termNumber': _termNumber,
    'mebbisTermCode': _code.text.trim(),
    'quota': int.tryParse(_quota.text) ?? 0,
    'registrationDeadlineUtc': _deadline.toUtc().toIso8601String(),
    'licenseClass': _licenseClass.text.trim().toUpperCase(),
    'studentProfileIds': _selected.toList(),
    'theoryClassName': _className.text.trim(),
    'instructorStaffId': _instructorId,
    'room': _room.text.trim(),
    'theoryStartsAtUtc': _theoryStart.toUtc().toIso8601String(),
    'theoryEndsAtUtc': _theoryEnd.toUtc().toIso8601String(),
    'sessions': _sessions
        .map(
          (x) => {
            ...x,
            'startsAtUtc': (x['startsAtUtc'] as DateTime)
                .toUtc()
                .toIso8601String(),
            'endsAtUtc': (x['endsAtUtc'] as DateTime).toUtc().toIso8601String(),
          },
        )
        .toList(),
  };

  Future<void> _validate() async {
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance
          .validateTermOpeningWizard(_payload());
      if (mounted) setState(() => _validation = value);
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _open() async {
    setState(() => _saving = true);
    try {
      final value = await DrivingSchoolApiService.instance
          .openTermOpeningWizard(_payload());
      if (mounted) setState(() => _result = value);
      _message('Dönem güvenle açıldı.');
    } catch (e) {
      _message('$e', error: true);
      await _validate();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _share(String path, String filename) async {
    setState(() => _saving = true);
    try {
      final bytes = await DrivingSchoolApiService.instance
          .downloadAuthenticated(path);
      final file = File('${(await getTemporaryDirectory()).path}/$filename');
      await file.writeAsBytes(bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path)], title: filename),
      );
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text.replaceFirst('Bad state: ', '')),
        backgroundColor: error ? Colors.red : null,
      ),
    );
  }

  Future<DateTime> _pick(DateTime value, {bool dateOnly = false}) async {
    final date = await showDatePicker(
      context: context,
      initialDate: value,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime(2100),
    );
    if (date == null || dateOnly) {
      return date == null
          ? value
          : DateTime(date.year, date.month, date.day, 23, 59);
    }
    if (!mounted) return value;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(value),
    );
    return DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? value.hour,
      time?.minute ?? value.minute,
    );
  }

  String _date(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year} ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  @override
  void dispose() {
    for (final controller in [
      _name,
      _code,
      _description,
      _quota,
      _licenseClass,
      _className,
      _room,
      _sessionSubject,
      _sessionTopic,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(title: const Text('Dönem Açma Sihirbazı')),
    child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
          )
        : Column(
            children: [
              _progress(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _content(),
                ),
              ),
              if (_result == null) _navigation(),
            ],
          ),
  );

  Widget _progress() => SizedBox(
    height: 68,
    child: ListView.separated(
      padding: const EdgeInsets.all(10),
      scrollDirection: Axis.horizontal,
      itemCount: _steps.length,
      separatorBuilder: (_, _) => const SizedBox(width: 6),
      itemBuilder: (_, index) => ChoiceChip(
        selected: index == _current,
        label: Text('${index + 1}. ${_steps[index]}'),
        onSelected: (_) => setState(() => _current = index),
      ),
    ),
  );

  Widget _content() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        '${_current + 1}. ${_steps[_current]}',
        style: Theme.of(
          context,
        ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
      ),
      const SizedBox(height: 16),
      switch (_current) {
        0 => _termInfo(),
        1 => _capacity(),
        2 => _studentList(),
        3 => _missingDocuments(),
        4 => _schedule(),
        5 => _assignments(),
        6 => _mebbisReady(),
        _ => _finalStep(),
      },
    ],
  );

  Widget _termInfo() => Column(
    children: [
      TextField(
        controller: _name,
        maxLength: 120,
        decoration: const InputDecoration(labelText: 'Dönem adı'),
      ),
      TextField(
        controller: _code,
        maxLength: 40,
        decoration: const InputDecoration(labelText: 'MEBBİS dönem kodu'),
      ),
      Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: '$_termYear',
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Yıl'),
              onChanged: (x) => _termYear = int.tryParse(x) ?? 0,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              initialValue: '$_termNumber',
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Dönem no'),
              onChanged: (x) => _termNumber = int.tryParse(x) ?? 0,
            ),
          ),
        ],
      ),
      ListTile(
        title: const Text('Son kayıt tarihi'),
        subtitle: Text(_date(_deadline)),
        trailing: const Icon(Icons.edit_calendar),
        onTap: () async {
          final value = await _pick(_deadline, dateOnly: true);
          if (mounted) setState(() => _deadline = value);
        },
      ),
      TextField(
        controller: _description,
        maxLength: 500,
        maxLines: 3,
        decoration: const InputDecoration(labelText: 'Açıklama'),
      ),
    ],
  );

  Widget _capacity() => Column(
    children: [
      TextField(
        controller: _quota,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Kontenjan (1-100)'),
      ),
      const SizedBox(height: 12),
      Card(
        child: ListTile(
          title: Text('${_selected.length} kursiyer seçildi'),
          subtitle: Text(
            '${((int.tryParse(_quota.text) ?? 0) - _selected.length).clamp(0, 100)} kişilik yer kaldı.',
          ),
        ),
      ),
    ],
  );

  Widget _studentList() => Column(
    children: _students.map((x) {
      final id = '${x['id']}';
      final full = _selected.length >= (int.tryParse(_quota.text) ?? 0);
      return CheckboxListTile(
        value: _selected.contains(id),
        onChanged: full && !_selected.contains(id)
            ? null
            : (checked) => setState(() {
                checked == true ? _selected.add(id) : _selected.remove(id);
                _validation = null;
              }),
        title: Text(
          '${x['fullName']}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '#${x['studentNumber']} · ${x['licenseClass']} · ${x['mebbisReady'] == true ? 'MEBBİS’e hazır' : '${(x['missing'] as List).length} eksik'}',
        ),
        secondary: Icon(
          x['mebbisReady'] == true ? Icons.verified : Icons.warning_amber,
          color: x['mebbisReady'] == true ? Colors.green : Colors.orange,
        ),
      );
    }).toList(),
  );

  Widget _missingDocuments() => Column(
    children: _selectedStudents.map((x) {
      final missing = (x['missing'] as List? ?? const [])
          .map((e) => '$e')
          .toList();
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${x['fullName']}',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              if (missing.isEmpty)
                const Chip(
                  label: Text('Eksiksiz'),
                  avatar: Icon(Icons.check, color: Colors.green),
                )
              else
                Wrap(
                  spacing: 5,
                  runSpacing: 5,
                  children: missing
                      .map(
                        (m) => Chip(
                          label: Text(m),
                          avatar: const Icon(
                            Icons.error_outline,
                            color: Colors.red,
                          ),
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        ),
      );
    }).toList(),
  );

  Widget _schedule() => Column(
    children: [
      TextField(
        controller: _sessionSubject,
        maxLength: 120,
        decoration: const InputDecoration(labelText: 'Ders'),
      ),
      TextField(
        controller: _sessionTopic,
        maxLength: 250,
        decoration: const InputDecoration(labelText: 'Konu'),
      ),
      FilledButton.icon(
        onPressed: () => setState(() {
          final startsAt = _sessions.isEmpty
              ? _theoryStart
              : (_sessions.last['endsAtUtc'] as DateTime).add(
                  const Duration(minutes: 15),
                );
          _sessions.add({
            'subject': _sessionSubject.text.trim(),
            'topic': _sessionTopic.text.trim(),
            'startsAtUtc': startsAt,
            'endsAtUtc': startsAt.add(const Duration(minutes: 45)),
            'instructorStaffId': null,
            'room': '',
          });
          _validation = null;
        }),
        icon: const Icon(Icons.add),
        label: const Text('45 dakikalık ders ekle'),
      ),
      const SizedBox(height: 12),
      ..._sessions.asMap().entries.map(
        (entry) => Card(
          child: ListTile(
            title: Text('${entry.value['subject']} — ${entry.value['topic']}'),
            subtitle: Text(
              '${_date(entry.value['startsAtUtc'] as DateTime)} · 45 dk',
            ),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: () => setState(() => _sessions.removeAt(entry.key)),
            ),
          ),
        ),
      ),
    ],
  );

  Widget _assignments() => Column(
    children: [
      TextField(
        controller: _className,
        maxLength: 150,
        decoration: const InputDecoration(labelText: 'Teorik sınıf adı'),
      ),
      TextField(
        controller: _licenseClass,
        maxLength: 20,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(labelText: 'Ehliyet sınıfı'),
      ),
      DropdownButtonFormField<String>(
        initialValue: _instructorId.isEmpty ? null : _instructorId,
        decoration: const InputDecoration(labelText: 'Ana öğretmen'),
        items: _instructors
            .map(
              (x) => DropdownMenuItem(
                value: '${x['id']}',
                child: Text('${x['fullName']}'),
              ),
            )
            .toList(),
        onChanged: (x) => setState(() => _instructorId = x ?? ''),
      ),
      TextField(
        controller: _room,
        maxLength: 120,
        decoration: const InputDecoration(labelText: 'Derslik'),
      ),
      ListTile(
        title: const Text('Eğitim başlangıcı'),
        subtitle: Text(_date(_theoryStart)),
        onTap: () async {
          final value = await _pick(_theoryStart);
          if (mounted) setState(() => _theoryStart = value);
        },
      ),
      ListTile(
        title: const Text('Eğitim bitişi'),
        subtitle: Text(_date(_theoryEnd)),
        onTap: () async {
          final value = await _pick(_theoryEnd);
          if (mounted) setState(() => _theoryEnd = value);
        },
      ),
    ],
  );

  Widget _mebbisReady() {
    final ready = _selectedStudents
        .where((x) => x['mebbisReady'] == true)
        .length;
    return Column(
      children: [
        _metric('Seçilen kursiyer', _selected.length, Colors.blue),
        _metric('MEBBİS’e hazır', ready, Colors.green),
        _metric('Düzeltme gereken', _selected.length - ready, Colors.orange),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(14),
            child: Text(
              'Devam edildiğinde sunucu dönem, evrak, öğretmen ve derslik çakışmalarını yeniden kontrol eder.',
            ),
          ),
        ),
      ],
    );
  }

  Widget _metric(String label, int count, Color color) => Card(
    child: ListTile(
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: .12),
        child: Text(
          '$count',
          style: TextStyle(color: color, fontWeight: FontWeight.w900),
        ),
      ),
      title: Text(label),
    ),
  );

  Widget _finalStep() {
    if (_result != null) {
      return Column(
        children: [
          const Icon(Icons.verified_rounded, size: 64, color: Colors.green),
          const SizedBox(height: 10),
          Text(
            '${_result!['name']} açıldı',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          Text(
            '${_result!['studentCount']} kursiyer · ${_result!['sessionCount']} ders',
          ),
          const SizedBox(height: 18),
          _output(
            'MEBBİS aday listesini paylaş',
            '${_result!['mebbisRosterUrl']}',
            'mebbis-aday-listesi.csv',
          ),
          _output(
            'Dönem raporunu paylaş',
            '${_result!['termReportUrl']}',
            'donem-raporu.pdf',
          ),
          _output(
            'Ders programını paylaş',
            '${_result!['scheduleUrl']}',
            'ders-programi.pdf',
          ),
        ],
      );
    }
    if (_validation == null) {
      return FilledButton.icon(
        onPressed: _saving ? null : _validate,
        icon: const Icon(Icons.fact_check),
        label: const Text('Son kontrolü çalıştır'),
      );
    }
    final errors = (_validation!['errors'] as List? ?? const [])
        .map((e) => '$e')
        .toList();
    final warnings = (_validation!['warnings'] as List? ?? const [])
        .map((e) => '$e')
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: (_validation!['ready'] == true ? Colors.green : Colors.red)
              .withValues(alpha: .08),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Text(
              _validation!['ready'] == true
                  ? 'Dönem açılmaya hazır.'
                  : 'Düzeltilmesi gereken alanlar var.',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ),
        ...errors.map(
          (x) => ListTile(
            leading: const Icon(Icons.error, color: Colors.red),
            title: Text(x),
          ),
        ),
        ...warnings.map(
          (x) => ListTile(
            leading: const Icon(Icons.warning, color: Colors.orange),
            title: Text(x),
          ),
        ),
        if (_validation!['ready'] == true)
          FilledButton.icon(
            onPressed: _saving ? null : _open,
            icon: const Icon(Icons.lock_open),
            label: const Text('Dönemi aç ve atamaları tamamla'),
          ),
      ],
    );
  }

  Widget _output(String label, String path, String filename) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: OutlinedButton.icon(
      onPressed: _saving ? null : () => _share(path, filename),
      icon: const Icon(Icons.ios_share),
      label: Text(label),
    ),
  );

  Widget _navigation() => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          OutlinedButton.icon(
            onPressed: _current == 0 || _saving
                ? null
                : () => setState(() => _current--),
            icon: const Icon(Icons.chevron_left),
            label: const Text('Geri'),
          ),
          if (_current < 7)
            FilledButton.icon(
              onPressed: _saving
                  ? null
                  : () async {
                      if (_current == 6) await _validate();
                      if (mounted) setState(() => _current++);
                    },
              icon: const Icon(Icons.chevron_right),
              label: const Text('Devam'),
            ),
        ],
      ),
    ),
  );
}
