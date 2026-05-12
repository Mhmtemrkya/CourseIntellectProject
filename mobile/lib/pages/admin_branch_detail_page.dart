import 'package:flutter/material.dart';

import '../widgets/admin_ui.dart';

class AdminBranchDetailPage extends StatelessWidget {
  final String branchName;
  final String summary;
  final Color color;

  const AdminBranchDetailPage({
    super.key,
    required this.branchName,
    required this.summary,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Öğrenci', '214'),
      ('Öğretmen', '16'),
      ('Doluluk', '%91'),
      ('Memnuniyet', '%94'),
    ];

    final units = [
      ('Akademik', 'Sınıf başarısı güçlü, 2 branşta destek planı var.'),
      ('Finans', 'Tahsilat akışı stabil, 1 kritik ödeme gecikmesi izleniyor.'),
      ('Operasyon', 'Teknik altyapı güncellendi, bakım planı tamamlandı.'),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          branchName,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Şube detayı',
            title: branchName,
            description: summary,
            colors: [const Color(0xFF0F172A), color],
            metrics: stats
                .map((item) => AdminHeroMetric(label: item.$1, value: item.$2))
                .toList(),
          ),
          const SizedBox(height: 16),
          ...units.map(
            (unit) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    unit.$1,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    unit.$2,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.45),
                  ),
                ],
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Şube raporu paylaşıma hazırlandı.'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            icon: const Icon(Icons.share_outlined),
            label: const Text('Şube Raporunu Paylaş'),
          ),
        ],
      ),
    );
  }
}
