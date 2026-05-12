import 'package:flutter/material.dart';

import '../services/schedule_api_service.dart';

const scheduleDayOrder = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
];

const scheduleDayShort = {
  'Pazartesi': 'Pzt',
  'Salı': 'Sal',
  'Çarşamba': 'Çar',
  'Perşembe': 'Per',
  'Cuma': 'Cum',
  'Cumartesi': 'Cmt',
  'Pazar': 'Paz',
};

int scheduleDayIndex(String day) {
  final index = scheduleDayOrder.indexOf(day.trim());
  return index == -1 ? 999 : index;
}

String normalizeScheduleText(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll('ı', 'i')
      .replaceAll('İ', 'i')
      .replaceAll('ş', 's')
      .replaceAll('Ş', 's')
      .replaceAll('ğ', 'g')
      .replaceAll('Ğ', 'g')
      .replaceAll('ü', 'u')
      .replaceAll('Ü', 'u')
      .replaceAll('ö', 'o')
      .replaceAll('Ö', 'o')
      .replaceAll('ç', 'c')
      .replaceAll('Ç', 'c');
}

List<String> deriveScheduleDays(List<ScheduleEntryApiRecord> entries) {
  final set = <String>{
    ...scheduleDayOrder.take(5),
    ...entries.map((item) => item.day.trim()).where((item) => item.isNotEmpty),
  };
  final list = set.toList()..sort((a, b) => scheduleDayIndex(a).compareTo(scheduleDayIndex(b)));
  return list;
}

List<String> deriveScheduleTimeSlots(List<ScheduleEntryApiRecord> entries) {
  final set = entries.map((item) => item.time.trim()).where((item) => item.isNotEmpty).toSet();
  final list = set.toList()..sort();
  return list;
}

List<ScheduleEntryApiRecord> sortScheduleEntries(List<ScheduleEntryApiRecord> entries) {
  final sorted = [...entries]
    ..sort((a, b) {
      final dayCompare = scheduleDayIndex(a.day).compareTo(scheduleDayIndex(b.day));
      if (dayCompare != 0) return dayCompare;
      return a.time.compareTo(b.time);
    });
  return sorted;
}

class ScheduleGridView extends StatelessWidget {
  final List<ScheduleEntryApiRecord> entries;
  final List<String>? days;
  final List<String>? timeSlots;
  final bool showClassName;
  final bool showTeacher;
  final ValueChanged<ScheduleEntryApiRecord>? onEntryTap;
  final String emptyText;

  const ScheduleGridView({
    super.key,
    required this.entries,
    this.days,
    this.timeSlots,
    this.showClassName = true,
    this.showTeacher = true,
    this.onEntryTap,
    this.emptyText = 'Bu hücrede ders yok',
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activeDays = days ?? deriveScheduleDays(entries);
    final activeTimes = timeSlots ?? deriveScheduleTimeSlots(entries);

    if (activeTimes.isEmpty) {
      return _emptyCard(theme, 'Henüz çizelgeye yerleşen ders yok.');
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: 96 + (activeDays.length * 154),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _headerCell(theme, 'Saat', width: 96),
                ...activeDays.map((day) => _headerCell(theme, scheduleDayShort[day] ?? day, width: 154)),
              ],
            ),
            ...activeTimes.map(
              (time) => Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _timeCell(theme, time),
                  ...activeDays.map((day) {
                    final cellEntries = entries
                        .where((item) => item.day == day && item.time == time)
                        .toList();
                    return _lessonCell(theme, cellEntries);
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _headerCell(ThemeData theme, String text, {required double width}) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.10),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: Text(text, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
    );
  }

  Widget _timeCell(ThemeData theme, String time) {
    return Container(
      width: 96,
      constraints: const BoxConstraints(minHeight: 92),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.cardColor,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: Text(time, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
    );
  }

  Widget _lessonCell(ThemeData theme, List<ScheduleEntryApiRecord> cellEntries) {
    return Container(
      width: 154,
      constraints: const BoxConstraints(minHeight: 92),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: theme.cardColor,
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: cellEntries.isEmpty
          ? Text(emptyText, style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: cellEntries.map((entry) => _entryCard(theme, entry)).toList(),
            ),
    );
  }

  Widget _entryCard(ThemeData theme, ScheduleEntryApiRecord entry) {
    final card = Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(entry.subject, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800)),
          if (showClassName && entry.className.isNotEmpty) Text(entry.className, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
          if (showTeacher && entry.teacher.isNotEmpty) Text(entry.teacher, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
          if (entry.room.isNotEmpty) Text(entry.room, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
        ],
      ),
    );
    if (onEntryTap == null) return card;
    return InkWell(borderRadius: BorderRadius.circular(10), onTap: () => onEntryTap!(entry), child: card);
  }

  Widget _emptyCard(ThemeData theme, String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(16)),
      child: Text(text, textAlign: TextAlign.center),
    );
  }
}
