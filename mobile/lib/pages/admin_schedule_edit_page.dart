import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/courses_api_service.dart';
import '../services/schedule_api_service.dart';
import '../services/schedule_store.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import 'admin_class_management_page.dart';

class AdminScheduleEditPage extends StatefulWidget {
  final ScheduleEntryApiRecord? entry;

  const AdminScheduleEditPage({super.key, this.entry});

  @override
  State<AdminScheduleEditPage> createState() => _AdminScheduleEditPageState();
}

class _AdminScheduleEditPageState extends State<AdminScheduleEditPage> {
  final _store = ScheduleStore.instance;
  final _staffStore = StaffRegistryStore.instance;
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _room = TextEditingController();

  List<String> _classOptions = const [];
  List<CourseRecord> _courseOptions = const [];
  bool _isSaving = false;
  bool _isLoading = true;
  String? _lookupMessage;

  String? _selectedClass;
  String? _selectedSubject;
  String _day = 'Pazartesi';
  TimeOfDay? _startTime;
  String? _teacher;

  static const _days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];

  @override
  void initState() {
    super.initState();
    final entry = widget.entry;
    _room.text = entry?.room == 'Derslik' ? '' : (entry?.room ?? '');
    if (entry != null) {
      _selectedClass = entry.className;
      _selectedSubject = entry.subject;
      _teacher = entry.teacher;
      if (_days.contains(entry.day)) {
        _day = entry.day;
      }
      _startTime = _parseTime(entry.time);
    }
    _loadLookups();
  }

  @override
  void dispose() {
    _room.dispose();
    super.dispose();
  }

  Future<void> _loadLookups() async {
    setState(() => _isLoading = true);
    try {
      await Future.wait([
        _store.ensureLoaded(),
        _staffStore.ensureLoaded(),
        StudentRegistryStore.instance.ensureLoaded(),
      ]);
      List<String> remoteClasses = const [];
      List<CourseRecord> courses = const [];

      try {
        remoteClasses = await AdminDirectoryApiService.instance.fetchClasses();
      } catch (_) {}

      try {
        courses = await CoursesApiService.instance.fetchAll(isActive: true);
      } catch (_) {}

      if (!mounted) return;

      final classSet = <String>{
        ...remoteClasses
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty),
        ...StudentRegistryStore.instance.students
            .map((item) => item.className.trim())
            .where((item) => item.isNotEmpty),
        ..._store.entries
            .map((item) => item.className.trim())
            .where((item) => item.isNotEmpty),
        ..._staffStore.teachers
            .expand((item) => item.assignedClasses)
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty),
        if ((_selectedClass ?? '').trim().isNotEmpty) _selectedClass!.trim(),
      };
      final classes = classSet.toList()..sort((a, b) => a.compareTo(b));

      final allSubjects = <String>{
        ...courses
            .map((item) => item.name.trim())
            .where((item) => item.isNotEmpty),
        ..._store.entries
            .map((item) => item.subject.trim())
            .where((item) => item.isNotEmpty),
        ..._staffStore.teachers
            .map((item) => item.branchOrDepartment.trim())
            .where((item) => item.isNotEmpty && item != 'Branş bekleniyor'),
        if ((_selectedSubject ?? '').trim().isNotEmpty)
          _selectedSubject!.trim(),
      }.toList()..sort((a, b) => a.compareTo(b));

      final uniqueCourses = <CourseRecord>[];
      final seen = <String>{};
      for (final subject in allSubjects) {
        final matched = courses
            .where((item) => item.name.trim() == subject)
            .firstOrNull;
        final key = subject.trim().toLowerCase();
        if (seen.add(key)) {
          uniqueCourses.add(
            matched ??
                CourseRecord(
                  id: key,
                  name: subject,
                  description: '',
                  category: subject,
                  price: '0',
                  duration: '',
                  level: '',
                  isActive: true,
                ),
          );
        }
      }

      setState(() {
        _classOptions = classes;
        _courseOptions = uniqueCourses;
        _selectedClass = _resolveSelectedValue(_selectedClass, _classOptions);
        _selectedSubject = _resolveSelectedValue(
          _selectedSubject,
          _courseOptions.map((item) => item.name).toList(),
        );
        _teacher = _resolveSelectedTeacher(_teacher);
        _lookupMessage = classes.isEmpty || uniqueCourses.isEmpty
            ? 'Sınıf veya ders listesi eksik. Sınıf ekleyebilir ya da kurs kayıtlarını kontrol edebilirsiniz.'
            : null;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _lookupMessage =
            'Liste verileri yüklenemedi. Mevcut kayıtları kontrol edin.';
        _isLoading = false;
      });
    }
  }

  TimeOfDay? _parseTime(String value) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(value.trim());
    if (match == null) return null;
    final hour = int.tryParse(match.group(1) ?? '');
    final minute = int.tryParse(match.group(2) ?? '');
    if (hour == null || minute == null) return null;
    return TimeOfDay(hour: hour, minute: minute);
  }

  String _formatTime(TimeOfDay time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime ?? const TimeOfDay(hour: 9, minute: 0),
    );
    if (picked != null) {
      setState(() => _startTime = picked);
    }
  }

  List<String> _teacherOptionsForSelectedLesson() {
    final subject = (_selectedSubject ?? '').trim();
    if (subject.isEmpty) {
      return const [];
    }

    final course = _courseOptions
        .where((item) => item.name.trim() == subject)
        .firstOrNull;
    final normalizedSubject = _normalize(subject);
    final normalizedCategory = _normalize(course?.category ?? '');

    final options =
        _staffStore.teachers
            .where((teacher) {
              final branch = _normalize(teacher.branchOrDepartment);
              if (branch.isEmpty) {
                return false;
              }
              final categoryMatches =
                  normalizedCategory.isNotEmpty &&
                  (branch.contains(normalizedCategory) ||
                      normalizedCategory.contains(branch));
              final subjectMatches =
                  normalizedSubject.isNotEmpty &&
                  (branch.contains(normalizedSubject) ||
                      normalizedSubject.contains(branch));
              return categoryMatches || subjectMatches;
            })
            .map((item) => item.fullName)
            .toSet()
            .toList()
          ..sort();

    if (_teacher != null &&
        _teacher!.trim().isNotEmpty &&
        !options.contains(_teacher)) {
      options.add(_teacher!.trim());
      options.sort();
    }

    return options;
  }

  String _normalize(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ı', 'i')
        .replaceAll('İ', 'i')
        .replaceAll('ş', 's')
        .replaceAll('Ş', 's')
        .replaceAll('ğ', 'g')
        .replaceAll('Ğ', 'g')
        .replaceAll('ü', 'u')
        .replaceAll('Ü', 'u')
        .replaceAll('ö', 'o')
        .replaceAll('Ö', 'o')
        .replaceAll('ç', 'c')
        .replaceAll('Ç', 'c');
  }

  String? _resolveSelectedValue(String? current, List<String> options) {
    if (current == null || current.trim().isEmpty) {
      return options.firstOrNull;
    }
    return options.contains(current.trim())
        ? current.trim()
        : options.firstOrNull;
  }

  String? _resolveSelectedTeacher(String? current) {
    final teachers = _teacherOptionsForSelectedLesson();
    if (current == null || current.trim().isEmpty) {
      return teachers.firstOrNull;
    }
    return teachers.contains(current.trim())
        ? current.trim()
        : teachers.firstOrNull;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    if (_selectedClass == null || _selectedClass!.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Lütfen bir sınıf seçin.')));
      return;
    }
    if (_selectedSubject == null || _selectedSubject!.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Lütfen bir ders seçin.')));
      return;
    }
    if (_teacher == null || _teacher!.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Seçilen derse uygun bir öğretmen seçin.'),
        ),
      );
      return;
    }
    if (_startTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen başlangıç saatini seçin.')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      if (widget.entry == null) {
        await _store.createEntry(
          className: _selectedClass!.trim(),
          day: _day,
          time: _formatTime(_startTime!),
          subject: _selectedSubject!.trim(),
          teacher: _teacher!.trim(),
          room: _room.text.trim().isEmpty ? null : _room.text.trim(),
        );
      } else {
        await _store.updateEntry(
          id: widget.entry!.id,
          className: _selectedClass!.trim(),
          day: _day,
          time: _formatTime(_startTime!),
          subject: _selectedSubject!.trim(),
          teacher: _teacher!.trim(),
          room: _room.text.trim().isEmpty ? null : _room.text.trim(),
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.entry == null
                ? 'Ders programı kaydedildi.'
                : 'Ders programı güncellendi.',
          ),
        ),
      );
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Kaydedilemedi: $error')));
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEdit = widget.entry != null;
    final teacherOptions = _teacherOptionsForSelectedLesson();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isEdit ? 'Ders Programını Düzenle' : 'Ders Programı Oluştur',
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_lookupMessage != null) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDF2F8),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(_lookupMessage!),
                    ),
                  ],
                  _section(
                    theme,
                    title: 'Sınıf ve Ders',
                    children: [
                      if (_classOptions.isEmpty)
                        _emptyPickerCard(
                          context,
                          title: 'Sınıf listesi boş',
                          description:
                              'Önce sınıf ekleyin, sonra burada liste halinde görünsün.',
                          buttonLabel: 'Sınıf Ekle',
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    const AdminClassManagementPage(),
                              ),
                            );
                            await _loadLookups();
                          },
                        )
                      else
                        DropdownButtonFormField<String>(
                          key: ValueKey(
                            'schedule-class-${_selectedClass ?? 'empty'}-${_classOptions.length}',
                          ),
                          initialValue: _selectedClass,
                          decoration: _fieldDecoration('Sınıf'),
                          items: _classOptions
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text(item),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _selectedClass = value),
                          validator: (value) =>
                              (value == null || value.trim().isEmpty)
                              ? 'Sınıf seçimi zorunludur.'
                              : null,
                        ),
                      const SizedBox(height: 12),
                      if (_courseOptions.isEmpty)
                        _emptyPickerCard(
                          context,
                          title: 'Ders listesi boş',
                          description:
                              'Dersler kurs kayıtlarından gelir. Kurs yönetiminden ders ekleyin.',
                          buttonLabel: 'Listeyi Yenile',
                          onTap: _loadLookups,
                        )
                      else
                        DropdownButtonFormField<String>(
                          key: ValueKey(
                            'schedule-subject-${_selectedSubject ?? 'empty'}-${_courseOptions.length}',
                          ),
                          initialValue: _selectedSubject,
                          decoration: _fieldDecoration('Ders'),
                          items: _courseOptions
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.name,
                                  child: Text(item.name),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            setState(() {
                              _selectedSubject = value;
                              _teacher = _resolveSelectedTeacher(null);
                            });
                          },
                          validator: (value) =>
                              (value == null || value.trim().isEmpty)
                              ? 'Ders seçimi zorunludur.'
                              : null,
                        ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _room,
                        decoration: _fieldDecoration(
                          'Derslik',
                          hint: 'Örn: Derslik 3',
                        ),
                      ),
                    ],
                  ),
                  _section(
                    theme,
                    title: 'Gün ve Saat',
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _day,
                        decoration: _fieldDecoration('Gün'),
                        items: _days
                            .map(
                              (day) => DropdownMenuItem(
                                value: day,
                                child: Text(day),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _day = value ?? 'Pazartesi'),
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: _pickTime,
                        borderRadius: BorderRadius.circular(12),
                        child: InputDecorator(
                          decoration: _fieldDecoration('Başlangıç Saati')
                              .copyWith(
                                suffixIcon: const Icon(
                                  Icons.access_time_rounded,
                                ),
                              ),
                          child: Text(
                            _startTime == null
                                ? 'Saat seçin'
                                : _formatTime(_startTime!),
                          ),
                        ),
                      ),
                    ],
                  ),
                  _section(
                    theme,
                    title: 'Öğretmen',
                    children: [
                      if (_selectedSubject == null ||
                          _selectedSubject!.trim().isEmpty)
                        Text(
                          'Önce ders seçildiğinde uygun öğretmenler burada listelenir.',
                          style: theme.textTheme.bodySmall,
                        )
                      else if (teacherOptions.isEmpty)
                        Text(
                          'Seçilen derse uygun öğretmen bulunamadı. Önce ilgili branş öğretmenini ekleyin veya branş bilgisini güncelleyin.',
                          style: theme.textTheme.bodySmall,
                        )
                      else
                        DropdownButtonFormField<String>(
                          key: ValueKey(
                            'schedule-teacher-${_teacher ?? 'empty'}-${teacherOptions.length}',
                          ),
                          initialValue:
                              _teacher != null &&
                                  teacherOptions.contains(_teacher)
                              ? _teacher
                              : teacherOptions.firstOrNull,
                          decoration: _fieldDecoration('Öğretmen'),
                          items: teacherOptions
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text(item),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _teacher = value),
                          validator: (value) =>
                              (value == null || value.trim().isEmpty)
                              ? 'Öğretmen seçimi zorunludur.'
                              : null,
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _isSaving ? null : _save,
                    icon: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            isEdit ? Icons.save_outlined : Icons.check_rounded,
                          ),
                    label: Text(
                      _isSaving
                          ? 'Kaydediliyor...'
                          : (isEdit ? 'Güncelle' : 'Kaydet'),
                    ),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _section(
    ThemeData theme, {
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
    );
  }

  Widget _emptyPickerCard(
    BuildContext context, {
    required String title,
    required String description,
    required String buttonLabel,
    required Future<void> Function() onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(description, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async => onTap(),
            icon: const Icon(Icons.refresh_rounded),
            label: Text(buttonLabel),
          ),
        ],
      ),
    );
  }
}
