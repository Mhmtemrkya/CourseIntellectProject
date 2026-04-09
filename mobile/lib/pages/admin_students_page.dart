import 'package:flutter/material.dart';

import 'admin_parent_contact_page.dart';
import 'admin_student_detail_page.dart';
import '../services/admin_directory_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminStudentsPage extends StatefulWidget {
  const AdminStudentsPage({super.key});

  @override
  State<AdminStudentsPage> createState() => _AdminStudentsPageState();
}

class _AdminStudentsPageState extends State<AdminStudentsPage> {
  final TextEditingController _searchController = TextEditingController();
  List<AdminStudentRecord> _students = const [];
  bool _loading = true;
  String? _error;
  String _selectedClass = 'Tümü';

  @override
  void initState() {
    super.initState();
    _loadStudents();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadStudents() async {
    try {
      final students = await AdminDirectoryApiService.instance.fetchStudents();
      if (!mounted) return;
      setState(() {
        _students = students;
        _loading = false;
        _error = null;
      });
    } on AdminDirectoryApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = _students;
    final classes = ['Tümü', ...{for (final item in students) item.className}.toList()..sort()];
    final filtered = students.where((student) {
      final matchesClass = _selectedClass == 'Tümü' || student.className == _selectedClass;
      final query = _searchController.text.trim().toLowerCase();
      final matchesQuery = query.isEmpty ||
          student.fullName.toLowerCase().contains(query) ||
          student.parentName.toLowerCase().contains(query) ||
          student.currentSchool.toLowerCase().contains(query);
      return matchesClass && matchesQuery;
    }).toList();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Öğrenci Listesi', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Öğrenci yönetimi',
            title: 'Kurumdaki tüm öğrencileri sınıf, veli ve durum bilgisiyle yönetin.',
            description: 'Yönetici görünümünde öğrenci arama, sınıf filtreleme ve hızlı erişim aksiyonları tek ekranda sunulur.',
            metrics: [
              AdminHeroMetric(label: 'Toplam', value: '${students.length}'),
              AdminHeroMetric(label: 'Filtrelenen', value: '${filtered.length}'),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_error!, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () {
                      setState(() {
                        _loading = true;
                        _error = null;
                      });
                      _loadStudents();
                    },
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            )
          else
            ...[
          AdminPanel(
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Öğrenci veya veli ara',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedClass,
                  decoration: const InputDecoration(
                    labelText: 'Sınıf Filtresi',
                    border: OutlineInputBorder(),
                  ),
                  items: classes
                      .map((value) => DropdownMenuItem(value: value, child: Text(value)))
                      .toList(),
                  onChanged: (value) => setState(() => _selectedClass = value ?? 'Tümü'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...filtered.map((student) => _studentCard(context, student)),
          ],
        ],
      ),
    );
  }

  Widget _studentCard(BuildContext context, AdminStudentRecord student) {
    final color = switch (student.status) {
      'Passive' => const Color(0xFFB45309),
      _ => const Color(0xFF14532D),
    };
    final mappedStudent = StudentRegistryRecord(
      fullName: student.fullName,
      tcNo: student.tcNo,
      className: student.className,
      currentSchool: student.currentSchool,
      schoolNumber: student.schoolNumber,
      birthDate: student.birthDate,
      programType: student.programType,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      address: student.address,
      note: student.note,
      username: student.username,
      password: 'Guvenli sekilde saklaniyor',
      status: student.status == 'Active' ? 'Aktif' : 'Pasif',
    );

    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                child: Text(
                  student.fullName[0],
                  style: TextStyle(color: color, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(student.fullName, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('${student.className} • Veli: ${student.parentName}', style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              AdminAccentBadge(label: student.status, color: color),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.phone_outlined, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(student.parentPhone, style: Theme.of(context).textTheme.bodyMedium),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${student.currentSchool} • TC: ${student.tcNo} • Kullanici: ${student.username}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonalIcon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AdminStudentDetailPage(student: mappedStudent),
                  ),
                ),
                icon: const Icon(Icons.badge_outlined),
                label: const Text('Detay'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AdminParentContactPage(student: mappedStudent),
                  ),
                ),
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('Veli İletişimi'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
