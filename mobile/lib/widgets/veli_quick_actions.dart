import 'package:flutter/material.dart';

import '../pages/veli_devamsizlik_page.dart';
import '../pages/veli_odeme_page.dart';
import '../pages/veli_mesajlar_page.dart';

class VeliQuickActions extends StatelessWidget {
  const VeliQuickActions({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _QuickAction(
          icon: Icons.event_busy,
          label: "Devamsızlık",
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const VeliDevamsizlikPage(),
              ),
            );
          },
        ),

        _QuickAction(
          icon: Icons.bar_chart,
          label: "Sınav Sonuçları",
          onTap: () {},
        ),

        _QuickAction(
          icon: Icons.payment,
          label: "Ödeme Yap",
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const VeliOdemePage()),
            );
          },
        ),

        _QuickAction(
          icon: Icons.chat,
          label: "Mesaj Gönder",
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const VeliMesajlarPage()),
            );
          },
        ),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,

      child: Column(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: Colors.white,
            child: Icon(icon, color: Colors.orange),
          ),

          const SizedBox(height: 6),

          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}
