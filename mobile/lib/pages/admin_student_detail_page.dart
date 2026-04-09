import 'package:flutter/material.dart';

import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminStudentDetailPage extends StatelessWidget {
  final StudentRegistryRecord student;

  const AdminStudentDetailPage({
    super.key,
    required this.student,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (student.status) {
      'Finans Uyarı' => const Color(0xFFB42318),
      'Risk İzleme' => const Color(0xFFB45309),
      'Görüşme Bekliyor' => const Color(0xFF7C3AED),
      _ => const Color(0xFF14532D),
    };

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Ogrenci Detayi', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Kayit profili',
            title: student.fullName,
            description: '${student.className} sinifi, ${student.currentSchool} ogrencisi. Veli ve sistem bilgileri asagida tek ekranda yonetilir.',
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
                const AdminSectionTitle(title: 'Genel Ogrenci Bilgileri'),
                const SizedBox(height: 12),
                _infoRow('Ad Soyad', student.fullName),
                _infoRow('TC Kimlik No', student.tcNo),
                _infoRow('Sinif', student.className),
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
                const AdminSectionTitle(title: 'Veli ve Iletisim Bilgileri'),
                const SizedBox(height: 12),
                _infoRow('Veli Ad Soyad', student.parentName),
                _infoRow('Telefon', student.parentPhone),
                _infoRow('E-Posta', student.parentEmail.isEmpty ? 'Kayitli degil' : student.parentEmail),
                _infoRow('Adres', student.address.isEmpty ? 'Kayitli degil' : student.address),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Sistem Giris Bilgileri'),
                const SizedBox(height: 12),
                _credentialCard(context, 'Kullanici Adi', student.username),
                const SizedBox(height: 10),
                _credentialCard(context, 'Sifre', student.password),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Idari Not ve Durum'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    AdminAccentBadge(label: student.status, color: statusColor),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        student.note.isEmpty ? 'Bu ogrenci icin ek idari not bulunmuyor.' : student.note,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.45),
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
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _credentialCard(BuildContext context, String title, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
          const SizedBox(width: 12),
          SelectableText(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
