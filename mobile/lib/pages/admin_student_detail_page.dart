import 'package:flutter/material.dart';

import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'admin_student_edit_page.dart';

class AdminStudentDetailPage extends StatefulWidget {
  final StudentRegistryRecord student;

  const AdminStudentDetailPage({super.key, required this.student});

  @override
  State<AdminStudentDetailPage> createState() => _AdminStudentDetailPageState();
}

class _AdminStudentDetailPageState extends State<AdminStudentDetailPage> {
  late StudentRegistryRecord _student = widget.student;
  bool _deleting = false;

  Future<void> _openEdit() async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AdminStudentEditPage(student: _student),
      ),
    );
    if (result == true) {
      final refreshed = StudentRegistryStore.instance.students.firstWhere(
        (item) => item.id == _student.id,
        orElse: () => _student,
      );
      if (!mounted) return;
      setState(() => _student = refreshed);
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Öğrenciyi Sil'),
        content: Text(
          '${_student.fullName} adli öğrenciyi ve kullanıcı kaydini silmek istediginize emin misiniz? Bu islem geri alinamaz.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB42318),
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _deleting = true);
    try {
      await StudentRegistryStore.instance.deleteStudent(_student.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Öğrenci silindi.')));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Silme başarısız: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = _student;
    final statusColor = switch (student.status) {
      'Finans Uyarı' => const Color(0xFFB42318),
      'Risk İzleme' => const Color(0xFFB45309),
      'Görüşme Bekliyor' => const Color(0xFF7C3AED),
      _ => const Color(0xFF14532D),
    };

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Öğrenci Detayı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Düzenle',
            icon: const Icon(Icons.edit_outlined),
            onPressed: _deleting ? null : _openEdit,
          ),
          IconButton(
            tooltip: 'Sil',
            icon: _deleting
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(
                    Icons.delete_outline_rounded,
                    color: Color(0xFFB42318),
                  ),
            onPressed: _deleting || student.id.isEmpty ? null : _confirmDelete,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Kayıt profili',
            title: student.fullName,
            description:
                '${student.className} sınıfı, ${student.currentSchool} öğrencisi. Veli ve sistem bilgileri aşağıda tek ekranda yönetilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AdminHeroMetric(label: 'Durum', value: student.status),
              AdminHeroMetric(label: 'Program', value: student.programType),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Genel Öğrenci Bilgileri'),
                const SizedBox(height: 12),
                _infoRow('Ad Soyad', student.fullName),
                _infoRow('TC Kimlik No', student.tcNo),
                _infoRow('Sınıf', student.className),
                _infoRow('Okudugu Okul', student.currentSchool),
                _infoRow('Okul No', student.schoolNumber),
                _infoRow('Dogum Tarihi', student.birthDate),
                _infoRow('Alan / Program', student.programType),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Veli ve İletişim Bilgileri'),
                const SizedBox(height: 12),
                _infoRow('Veli Ad Soyad', student.parentName),
                _infoRow('Telefon', student.parentPhone),
                _infoRow(
                  'E-Posta',
                  student.parentEmail.isEmpty
                      ? 'Kayıtlı değil'
                      : student.parentEmail,
                ),
                _infoRow(
                  'Adres',
                  student.address.isEmpty ? 'Kayıtlı değil' : student.address,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Sistem Giriş Bilgileri'),
                const SizedBox(height: 12),
                _credentialCard(context, 'Kullanıcı Adı', student.username),
                const SizedBox(height: 10),
                _credentialCard(context, 'Şifre', student.password),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'İdari Not ve Durum'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    AdminAccentBadge(label: student.status, color: statusColor),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        student.note.isEmpty
                            ? 'Bu öğrenci için ek idari not bulunmuyor.'
                            : student.note,
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(height: 1.45),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(value, textAlign: TextAlign.right)),
        ],
      ),
    );
  }

  Widget _credentialCard(BuildContext context, String title, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).scaffoldBackgroundColor.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          SelectableText(
            value,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
