import 'package:flutter/material.dart';

class VeliAttendanceStatus extends StatelessWidget {
  const VeliAttendanceStatus({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),

      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)],
      ),

      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          Text(
            "Devam Durumu",
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 8),

          Text(
            "Devam Oranı: 92%",
            style: Theme.of(context).textTheme.bodyMedium,
          ),

          const SizedBox(height: 6),

          LinearProgressIndicator(
            value: 0.92,
            color: Colors.green,
            backgroundColor: Theme.of(context).dividerColor,
          ),

          const SizedBox(height: 16),

          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _AttendanceBox(
                title: "45",
                subtitle: "Katılım",
                color: Colors.green,
              ),

              _AttendanceBox(
                title: "3",
                subtitle: "Devamsız",
                color: Colors.red,
              ),

              _AttendanceBox(
                title: "2",
                subtitle: "İzinli",
                color: Colors.orange,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttendanceBox extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color color;

  const _AttendanceBox({
    required this.title,
    required this.subtitle,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),

        Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
