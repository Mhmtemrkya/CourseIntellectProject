import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminGlobalSearchPage extends StatefulWidget {
  const AdminGlobalSearchPage({super.key});

  @override
  State<AdminGlobalSearchPage> createState() => _AdminGlobalSearchPageState();
}

class _AdminGlobalSearchPageState extends State<AdminGlobalSearchPage> {
  final _studentStore = StudentRegistryStore.instance;
  final _staffStore = StaffRegistryStore.instance;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _controller.text.trim().toLowerCase();
    final students = _studentStore.students.where((item) {
      return query.isEmpty ||
          item.fullName.toLowerCase().contains(query) ||
          item.parentName.toLowerCase().contains(query);
    }).toList();
    final staff = _staffStore.staff.where((item) {
      return query.isEmpty ||
          item.fullName.toLowerCase().contains(query) ||
          item.branchOrDepartment.toLowerCase().contains(query);
    }).toList();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Global Arama Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminPanel(
            child: TextField(
              controller: _controller,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Öğrenci, veli, öğretmen ara',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const AdminSectionTitle(title: 'Öğrenci Sonuçları'),
          const SizedBox(height: 12),
          ...students.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 10),
              child: Text(
                '${item.fullName} • ${item.className} • ${item.parentName}',
              ),
            ),
          ),
          const SizedBox(height: 8),
          const AdminSectionTitle(title: 'Kadro Sonuçları'),
          const SizedBox(height: 12),
          ...staff.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 10),
              child: Text(
                '${item.fullName} • ${item.roleType} • ${item.branchOrDepartment}',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
