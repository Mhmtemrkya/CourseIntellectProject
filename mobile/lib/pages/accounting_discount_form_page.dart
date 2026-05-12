import 'package:flutter/material.dart';

import '../services/student_registry_store.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingDiscountFormPage extends StatefulWidget {
  const AccountingDiscountFormPage({super.key});

  @override
  State<AccountingDiscountFormPage> createState() =>
      _AccountingDiscountFormPageState();
}

class _AccountingDiscountFormPageState
    extends State<AccountingDiscountFormPage> {
  bool isScholarship = false;
  String student = '';
  String _studentUsername = '';
  String _studentClassName = '';
  List<StudentRegistryRecord> _students = const [];
  final rateController = TextEditingController(text: '15');
  final totalController = TextEditingController(text: '120000');
  final noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadStudents();
  }

  @override
  void dispose() {
    rateController.dispose();
    totalController.dispose();
    noteController.dispose();
    super.dispose();
  }

  Future<void> _loadStudents() async {
    await StudentRegistryStore.instance.ensureLoaded();
    final students = [...StudentRegistryStore.instance.students]
      ..sort((a, b) => a.fullName.compareTo(b.fullName));
    if (!mounted) return;
    setState(() {
      _students = students;
      final hasSelectedStudent = students.any(
        (item) => item.username == _studentUsername,
      );
      final selected = hasSelectedStudent
          ? students.firstWhere((item) => item.username == _studentUsername)
          : students.firstOrNull;
      student = selected?.fullName ?? '';
      _studentUsername = selected?.username ?? '';
      _studentClassName = selected?.className ?? '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final rate = double.tryParse(rateController.text) ?? 0;
    final total = double.tryParse(totalController.text) ?? 0;
    final discounted = total - (total * rate / 100);

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Yeni İndirim / Burs'),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AccountingHeroCard(
              eyebrow: 'Yeni tanım',
              title: 'Öğrenci bazlı burs ve indirim tanımlama',
              description:
                  'Oran değiştikçe tutar otomatik güncellenir ve önizleme alanı yeni bakiyeyi gösterir.',
              colors: [Color(0xFF0F172A), Color(0xFF0891B2)],
              metrics: [
                AccountingHeroMetric(label: 'Önizleme', value: 'Canlı'),
                AccountingHeroMetric(label: 'Durum', value: 'Onay akışı'),
              ],
            ),
            const SizedBox(height: 16),
            _card(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment<bool>(value: false, label: Text('İndirim')),
                      ButtonSegment<bool>(value: true, label: Text('Burs')),
                    ],
                    selected: {isScholarship},
                    onSelectionChanged: (value) =>
                        setState(() => isScholarship = value.first),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey(
                      '${_students.length}:${_studentUsername.isEmpty ? 'empty' : _studentUsername}',
                    ),
                    initialValue: _studentUsername.isEmpty
                        ? null
                        : _studentUsername,
                    decoration: const InputDecoration(
                      labelText: 'Öğrenci',
                      border: OutlineInputBorder(),
                    ),
                    items: _students
                        .map(
                          (value) => DropdownMenuItem(
                            value: value.username,
                            child: Text(
                              '${value.fullName} • ${value.className}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      final selected = _students
                          .where((item) => item.username == value)
                          .firstOrNull;
                      if (selected == null) return;
                      setState(() {
                        student = selected.fullName;
                        _studentUsername = selected.username;
                        _studentClassName = selected.className;
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: totalController,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Toplam Tutar',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: rateController,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: isScholarship ? 'Burs Oranı' : 'İndirim Oranı',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Not',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _card(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Önizleme',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _previewLine('Öğrenci', student),
                  _previewLine(
                    'Tanım Türü',
                    isScholarship ? 'Burs' : 'İndirim',
                  ),
                  _previewLine('Uygulanacak Oran', '%${rateController.text}'),
                  _previewLine(
                    'Yeni Tutar',
                    '₺${discounted.toStringAsFixed(0)}',
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _studentUsername.isEmpty
                          ? null
                          : () {
                              Navigator.pop(context, {
                                'studentName': student,
                                'studentUsername': _studentUsername,
                                'className': _studentClassName,
                                'title': noteController.text.trim().isEmpty
                                    ? (isScholarship
                                          ? 'Yeni Burs Tanımı'
                                          : 'Yeni İndirim Tanımı')
                                    : noteController.text.trim(),
                                'type': isScholarship ? 'Burs' : 'İndirim',
                                'rate': rateController.text.trim(),
                                'totalAmount': totalController.text.trim(),
                                'note': noteController.text.trim(),
                              });
                            },
                      child: const Text('Kaydı Oluştur'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(BuildContext context, {required Widget child}) {
    return AccountingPanel(child: child);
  }

  Widget _previewLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
