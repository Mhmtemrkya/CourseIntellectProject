import 'package:flutter/material.dart';
import 'package:student/pages/veli_exam_results_page.dart';
import '../pages/veli_odeme_page.dart';
import '../pages/veli_mesajlar_page.dart';
import '../pages/veli_devamsizlik_page.dart';
import 'responsive_layout.dart';

class VeliStatsGrid extends StatelessWidget {
  const VeliStatsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: ResponsiveLayout.columns(
        context,
        phone: 2,
        tablet: 2,
        largeTablet: 4,
      ),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: ResponsiveLayout.isLargeTablet(context) ? 1.55 : 1.3,

      children: [
        /// DEVAMSIZLIK
        _StatCard(
          title: "Devamsızlık",
          value: "8%",
          icon: Icons.cancel,
          iconColor: Colors.orange,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VeliDevamsizlikPage()),
            );
          },
        ),

        /// SON SINAV
        _StatCard(
          title: "Sınav Sonuçları",
          value: "85",
          icon: Icons.book,
          iconColor: Colors.blue,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VeliExamResultsPage()),
            );
          },
        ),

        /// ÖDEME
        _StatCard(
          title: "Ödeme",
          value: "₺7.000",
          icon: Icons.payment,
          iconColor: Colors.green,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VeliOdemePage()),
            );
          },
        ),

        /// MESAJ
        _StatCard(
          title: "Mesaj",
          value: "3",
          icon: Icons.chat,
          iconColor: Colors.red,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VeliMesajlarPage()),
            );
          },
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;
  final VoidCallback? onTap;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,

      child: Card(
        color: Theme.of(context).cardColor,

        elevation: 2,

        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),

        child: Padding(
          padding: const EdgeInsets.all(12),

          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,

            children: [
              Icon(icon, color: iconColor, size: 30),

              const SizedBox(height: 8),

              Text(
                value,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),

              Text(title),
            ],
          ),
        ),
      ),
    );
  }
}
