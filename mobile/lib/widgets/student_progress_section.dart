import 'package:flutter/material.dart';

import '../services/content_api_service.dart';
import '../services/school_feed_api_service.dart';

/// Öğrenci ana sayfasında "Başarı Sıralaması" kartı ve gün/hafta/ay/yıl
/// geçişli "Çalışma İstatistiklerim" grafiğini birlikte gösterir. Veriler
/// gerçek kaynaklardan (sınıf sıralaması ucu, sınav sonuçları ve içerik
/// etkileşimleri) türetilir.
class StudentProgressSection extends StatefulWidget {
  const StudentProgressSection({super.key});

  @override
  State<StudentProgressSection> createState() => _StudentProgressSectionState();
}

class _StudentProgressSectionState extends State<StudentProgressSection> {
  ClassRankingRecord? _ranking;
  List<DateTime> _events = const [];
  int _examCount = 0;
  int _contentCount = 0;
  bool _loading = true;
  String _range = 'week';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final ranking = await SchoolFeedApiService.instance.fetchClassRanking();
      final exams = await SchoolFeedApiService.instance.fetchExamResults();
      List<MyContentStateRecord> engagement = const [];
      try {
        engagement = await ContentApiService.instance.fetchMyEngagement();
      } catch (_) {
        engagement = const [];
      }

      final events = <DateTime>[];
      var examCount = 0;
      for (final exam in exams) {
        final parsed = DateTime.tryParse(exam.date);
        if (parsed != null) {
          events.add(parsed);
          examCount++;
        }
      }
      for (final state in engagement) {
        if (state.updatedAtUtc != null) events.add(state.updatedAtUtc!.toLocal());
      }

      if (!mounted) return;
      setState(() {
        _ranking = ranking;
        _events = events;
        _examCount = examCount;
        _contentCount = engagement.length;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  List<_Bucket> _buckets(String range) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final buckets = <_Bucket>[];
    const monthShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    switch (range) {
      case 'day':
        for (var i = 13; i >= 0; i--) {
          final start = today.subtract(Duration(days: i));
          buckets.add(_Bucket(start, start.add(const Duration(days: 1)), '${start.day}'));
        }
        break;
      case 'month':
        for (var i = 11; i >= 0; i--) {
          final start = DateTime(today.year, today.month - i, 1);
          final end = DateTime(today.year, today.month - i + 1, 1);
          buckets.add(_Bucket(start, end, monthShort[start.month - 1]));
        }
        break;
      case 'year':
        for (var i = 4; i >= 0; i--) {
          final start = DateTime(today.year - i, 1, 1);
          final end = DateTime(today.year - i + 1, 1, 1);
          buckets.add(_Bucket(start, end, '${start.year}'));
        }
        break;
      case 'week':
      default:
        for (var i = 7; i >= 0; i--) {
          final start = today.subtract(Duration(days: i * 7 + 6));
          final end = today.subtract(Duration(days: i * 7)).add(const Duration(days: 1));
          buckets.add(_Bucket(start, end, '${start.day}.${start.month}'));
        }
        break;
    }
    for (final event in _events) {
      for (final bucket in buckets) {
        if (!event.isBefore(bucket.start) && event.isBefore(bucket.end)) {
          bucket.value++;
          break;
        }
      }
    }
    return buckets;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _rankCard(context),
        const SizedBox(height: 16),
        _statsCard(context),
      ],
    );
  }

  Widget _rankCard(BuildContext context) {
    final ranking = _ranking;
    final hasRank = ranking != null && ranking.rank > 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFF4E8DF5)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Başarı Sıralaması',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  hasRank ? '${ranking.rank} / ${ranking.totalStudents}' : '—',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 26),
                ),
                const SizedBox(height: 2),
                Text(
                  hasRank
                      ? '${ranking.className.isEmpty ? 'Sınıf' : ranking.className} • not ortalaması ${ranking.average.toStringAsFixed(1)}'
                      : 'Sınıf içi sıralama (not ortalamasına göre)',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statsCard(BuildContext context) {
    final theme = Theme.of(context);
    final buckets = _buckets(_range);
    final maxValue = buckets.fold<int>(0, (m, b) => b.value > m ? b.value : m);
    final total = buckets.fold<int>(0, (s, b) => s + b.value);
    final ranges = const [('day', 'Gün'), ('week', 'Hafta'), ('month', 'Ay'), ('year', 'Yıl')];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.insights_rounded, size: 20, color: Color(0xFFFF7A1A)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Çalışma İstatistiklerim',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: ranges.map((item) {
              final selected = _range == item.$1;
              return ChoiceChip(
                label: Text(item.$2),
                selected: selected,
                onSelected: (_) => setState(() => _range = item.$1),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _metric(theme, 'Sınav', '$_examCount')),
              const SizedBox(width: 10),
              Expanded(child: _metric(theme, 'İçerik', '$_contentCount')),
              const SizedBox(width: 10),
              Expanded(child: _metric(theme, 'Toplam Aktivite', '$total')),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 132,
            child: total == 0
                ? Center(
                    child: Text(
                      'Bu aralıkta çalışma hareketi bulunamadı.',
                      style: theme.textTheme.bodySmall,
                    ),
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: buckets.map((bucket) {
                      final ratio = maxValue == 0 ? 0.0 : bucket.value / maxValue;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (bucket.value > 0)
                                Text(
                                  '${bucket.value}',
                                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700),
                                ),
                              const SizedBox(height: 2),
                              Container(
                                height: 86 * ratio + (bucket.value > 0 ? 6 : 2),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(6),
                                  gradient: const LinearGradient(
                                    begin: Alignment.bottomCenter,
                                    end: Alignment.topCenter,
                                    colors: [Color(0xFFFF7A1A), Color(0xFFFFB020)],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                bucket.label,
                                maxLines: 1,
                                overflow: TextOverflow.clip,
                                style: TextStyle(fontSize: 8, color: theme.textTheme.bodySmall?.color),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _metric(ThemeData theme, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Text(value, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(label, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _Bucket {
  final DateTime start;
  final DateTime end;
  final String label;
  int value = 0;

  _Bucket(this.start, this.end, this.label);
}
