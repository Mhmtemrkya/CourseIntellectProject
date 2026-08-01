import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';

import '../pages/exam_manage_sheet.dart';

/// Sınav listesi satırı — tür rozeti, künye, katılım/ortalama ve tek "Yönet"
/// butonu. Sayfadan ayrı tutulur ki tema/kontrast testinde tek başına çizilebilsin.
class ExamListRow extends StatelessWidget {
  final ExamRowData row;
  final VoidCallback onManage;

  const ExamListRow({super.key, required this.row, required this.onManage});

  static Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'tamamlandı':
        return const Color(0xFF059669);
      case 'taslak':
        return const Color(0xFFD97706);
      case 'iptal':
      case 'i̇ptal':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFF2563EB);
    }
  }

  static ({IconData icon, Color color}) _typeStyle(String type) {
    switch (type.toLowerCase()) {
      case 'deneme':
        return (icon: Icons.science_outlined, color: const Color(0xFFD97706));
      case 'ünite':
        return (icon: Icons.public_rounded, color: const Color(0xFFE11D48));
      case 'quiz':
        return (icon: Icons.menu_book_rounded, color: const Color(0xFF059669));
      case 'proje':
        return (icon: Icons.hub_outlined, color: const Color(0xFF7C3AED));
      default:
        return (icon: Icons.functions_rounded, color: const Color(0xFF2563EB));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = _typeStyle(row.type);
    final statusColor = _statusColor(row.status);
    final hasAttendance = (row.attendanceTotal ?? 0) > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: style.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(style.icon, color: style.color, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.type.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.6,
                        color: style.color,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      row.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (row.questionCount > 0) '${row.questionCount} soru',
                        if (row.duration.isNotEmpty) row.duration,
                        if (row.className.isNotEmpty) row.className,
                      ].join(' • '),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  row.status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _metric(
                theme,
                Icons.menu_book_outlined,
                'Ders',
                row.subject.isEmpty ? '—' : row.subject,
              ),
              _metric(
                theme,
                Icons.event_outlined,
                'Tarih',
                [
                  row.dateLabel,
                  row.startTime,
                ].where((value) => value.trim().isNotEmpty).join(' ').trim(),
              ),
              _metric(
                theme,
                Icons.groups_outlined,
                'Katılım',
                hasAttendance
                    ? '${row.attendancePresent}/${row.attendanceTotal}'
                    : '—',
              ),
              _metric(
                theme,
                Icons.insights_outlined,
                'Ortalama',
                row.averageScore == null ? '—' : '${row.averageScore}',
                valueColor: row.averageScore == null
                    ? null
                    : examScoreColor(row.averageScore),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 42,
            child: FilledButton(
              onPressed: onManage,
              child: Text('Yönet'.tr),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _metric(
    ThemeData theme,
    IconData icon,
    String label,
    String value, {
    Color? valueColor,
  }) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 13, color: theme.textTheme.bodySmall?.color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label.tr,
                  style: theme.textTheme.labelSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            value.isEmpty ? '—' : value,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 12,
              color: valueColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
