import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/duty_api_service.dart';

const List<String> _dutyTypes = ['Sabah Nöbeti', 'Öğle Arası', 'İdari Nöbet', 'Diğer'];
const List<String> _locations = [
  'A Blok - Zemin Kat', 'A Blok - 1. Kat', 'A Blok - 2. Kat',
  'B Blok - Zemin Kat', 'B Blok - 1. Kat', 'B Blok - 2. Kat',
  'Bahçe Alanı', 'Yemekhane', 'Giriş Kapısı', 'Kütüphane',
];
const List<String> _trDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

String _two(int v) => v.toString().padLeft(2, '0');
String _timeLabel(TimeOfDay t) => '${_two(t.hour)}:${_two(t.minute)}';
String _dateLabel(DateTime d) => '${_two(d.day)}.${_two(d.month)}.${d.year}';

class DutyCreatePage extends StatefulWidget {
  const DutyCreatePage({super.key});

  @override
  State<DutyCreatePage> createState() => _DutyCreatePageState();
}

class _DutyCreatePageState extends State<DutyCreatePage> {
  final DutyApiService _dutyApi = DutyApiService();
  final AdminDirectoryApiService _directory = AdminDirectoryApiService.instance;
  final TextEditingController _descriptionCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();

  String _dutyType = _dutyTypes.first;
  String _location = _locations.first;
  DateTime _date = DateTime.now();
  TimeOfDay _start = const TimeOfDay(hour: 7, minute: 30);
  TimeOfDay _end = const TimeOfDay(hour: 8, minute: 0);

  List<AdminStaffRecord> _teachers = [];
  final Set<String> _selectedIds = {};
  bool _loading = true;
  bool _saving = false;
  String _search = '';
  bool _repeatWeekly = false;
  int _repeatWeeks = 4;

  @override
  void initState() {
    super.initState();
    _loadTeachers();
  }

  @override
  void dispose() {
    _descriptionCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadTeachers() async {
    try {
      final list = await _directory.fetchStaff(role: 'Teacher');
      if (!mounted) return;
      setState(() {
        _teachers = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  String get _dayName => _trDays[_date.weekday - 1];

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime(bool start) async {
    final picked = await showTimePicker(context: context, initialTime: start ? _start : _end);
    if (picked != null) setState(() => start ? _start = picked : _end = picked);
  }

  Future<void> _save() async {
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('En az bir öğretmen seçin.')));
      return;
    }
    final startMin = _start.hour * 60 + _start.minute;
    final endMin = _end.hour * 60 + _end.minute;
    if (endMin <= startMin) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bitiş saati başlangıçtan sonra olmalı.')));
      return;
    }
    final todayDate = DateTime.now();
    if (DateTime(_date.year, _date.month, _date.day).isBefore(DateTime(todayDate.year, todayDate.month, todayDate.day))) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Geçmiş bir tarihe nöbet oluşturulamaz.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final selected = _teachers.where((t) => _selectedIds.contains(t.id)).toList();
      final isGuid = RegExp(r'^[0-9a-fA-F-]{36}$');
      final result = await _dutyApi.createDuty(
        dutyType: _dutyType,
        location: _location,
        dutyDate: DateTime.utc(_date.year, _date.month, _date.day),
        day: _dayName,
        startTime: _timeLabel(_start),
        endTime: _timeLabel(_end),
        description: _descriptionCtrl.text.trim(),
        repeatWeekly: _repeatWeekly,
        repeatWeeks: _repeatWeekly ? _repeatWeeks : 1,
        teachers: selected
            .map((t) => DutyTeacherInput(
                  teacherUserId: isGuid.hasMatch(t.id) ? t.id : null,
                  teacherName: t.fullName,
                  teacherUsername: t.username,
                  teacherBranch: t.departmentOrBranch,
                ))
            .toList(),
      );
      if (!mounted) return;
      final conflictNote = result.conflictCount > 0 ? ' · ${result.conflictCount} çakışma atlandı' : '';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${result.createdCount} nöbet atandı$conflictNote.')),
      );
      setState(() {
        _selectedIds.clear();
        _descriptionCtrl.clear();
        _repeatWeekly = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Nöbet oluşturulamadı: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final q = _search.trim().toLowerCase();
    final filtered = _teachers.where((t) =>
        q.isEmpty || t.fullName.toLowerCase().contains(q) || t.departmentOrBranch.toLowerCase().contains(q)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Nöbet Oluştur')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _sectionTitle(theme, 'Nöbet Bilgileri'),
                const SizedBox(height: 12),
                _dropdown(theme, 'Nöbet Türü', _dutyType, _dutyTypes, (v) => setState(() => _dutyType = v!)),
                const SizedBox(height: 12),
                _dropdown(theme, 'Nöbet Yeri', _location, _locations, (v) => setState(() => _location = v!)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _pickerField(theme, 'Tarih', _dateLabel(_date), Icons.calendar_today_rounded, _pickDate)),
                  const SizedBox(width: 12),
                  Expanded(child: _readonlyField(theme, 'Gün', _dayName)),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _pickerField(theme, 'Başlangıç', _timeLabel(_start), Icons.schedule_rounded, () => _pickTime(true))),
                  const SizedBox(width: 12),
                  Expanded(child: _pickerField(theme, 'Bitiş', _timeLabel(_end), Icons.schedule_rounded, () => _pickTime(false))),
                ]),
                const SizedBox(height: 12),
                _label(theme, 'Açıklama'),
                const SizedBox(height: 6),
                TextField(
                  controller: _descriptionCtrl,
                  maxLines: 3,
                  maxLength: 250,
                  decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Nöbet ile ilgili açıklama...'),
                ),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      SwitchListTile(
                        value: _repeatWeekly,
                        onChanged: (v) => setState(() => _repeatWeekly = v),
                        title: const Text('Haftalık tekrarla', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      if (_repeatWeekly)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          child: Row(
                            children: [
                              Text('Kaç hafta? ', style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.7))),
                              IconButton(
                                onPressed: () => setState(() => _repeatWeeks = (_repeatWeeks - 1).clamp(1, 20)),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text('$_repeatWeeks', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                              IconButton(
                                onPressed: () => setState(() => _repeatWeeks = (_repeatWeeks + 1).clamp(1, 20)),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                              const Spacer(),
                              Text('aynı gün', style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                _sectionTitle(theme, 'Öğretmen Seçimi (${_selectedIds.length})'),
                const SizedBox(height: 12),
                TextField(
                  controller: _searchCtrl,
                  onChanged: (v) => setState(() => _search = v),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded),
                    border: OutlineInputBorder(),
                    hintText: 'Öğretmen ara...',
                  ),
                ),
                const SizedBox(height: 8),
                if (filtered.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: Text('Öğretmen bulunamadı.', style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)))),
                  )
                else
                  ...filtered.map((t) {
                    final selected = _selectedIds.contains(t.id);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: CheckboxListTile(
                        value: selected,
                        onChanged: (_) => setState(() {
                          if (selected) {
                            _selectedIds.remove(t.id);
                          } else {
                            _selectedIds.add(t.id);
                          }
                        }),
                        title: Text(t.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(t.departmentOrBranch, style: const TextStyle(fontSize: 12)),
                        secondary: CircleAvatar(
                          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.15),
                          child: Text(
                            _initials(t.fullName),
                            style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 80),
              ],
            ),
      bottomNavigationBar: _loading
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save_rounded),
                  label: Text(_saving ? 'Kaydediliyor...' : 'Kaydet'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                ),
              ),
            ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  Widget _sectionTitle(ThemeData theme, String text) =>
      Text(text, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800));

  Widget _label(ThemeData theme, String text) =>
      Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface.withValues(alpha: 0.8)));

  Widget _dropdown(ThemeData theme, String label, String value, List<String> options, ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(theme, label),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: value,
          decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 14)),
          items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _pickerField(ThemeData theme, String label, String value, IconData icon, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(theme, label),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: InputDecorator(
            decoration: InputDecoration(border: const OutlineInputBorder(), suffixIcon: Icon(icon, size: 18)),
            child: Text(value),
          ),
        ),
      ],
    );
  }

  Widget _readonlyField(ThemeData theme, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(theme, label),
        const SizedBox(height: 6),
        InputDecorator(
          decoration: const InputDecoration(border: OutlineInputBorder()),
          child: Text(value, style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.7))),
        ),
      ],
    );
  }
}
