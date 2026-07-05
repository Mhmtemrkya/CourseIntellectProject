import 'package:flutter/material.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

const _topicLabels = {
  'motivasyon': 'Motivasyon',
  'sinav-kaygisi': 'Sınav Kaygısı',
  'aile': 'Aile',
  'arkadas': 'Arkadaş',
  'akademik': 'Akademik',
  'diger': 'Diğer',
};

/// İdareyle paylaşılabilir rehberlik özeti: yalnız sayılar; not içerikleri
/// bu rapora asla dahil edilmez.
class CounselorReportsPage extends StatefulWidget {
  const CounselorReportsPage({super.key});

  @override
  State<CounselorReportsPage> createState() => _CounselorReportsPageState();
}

class _CounselorReportsPageState extends State<CounselorReportsPage> {
  Map<String, dynamic>? report;
  List<String> classes = [];
  String classFilter = 'all';
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        GuidanceApiService.instance
            .fetchClassReport(classFilter == 'all' ? null : classFilter),
        GuidanceApiService.instance
            .fetchOverview()
            .catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        report = results[0] as Map<String, dynamic>;
        classes = ((results[1] as List<Map<String, dynamic>>)
                .map((s) => s['className']?.toString() ?? '')
                .where((c) => c.isNotEmpty)
                .toSet()
                .toList())
          ..sort();
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  List<Map<String, dynamic>> _list(String key) =>
      ((report?[key] as List<dynamic>?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final appointments =
        (report?['appointments'] as Map<String, dynamic>?) ?? const {};

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Rehberlik Raporu',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      // Sınıf filtresi
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final entry in [
                              ('all', 'Tümü'),
                              ...classes.map((c) => (c, c)),
                            ])
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(entry.$2),
                                  selected: classFilter == entry.$1,
                                  selectedColor: _navy,
                                  labelStyle: TextStyle(
                                    color: classFilter == entry.$1
                                        ? Colors.white
                                        : theme.textTheme.bodyMedium?.color,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  onSelected: (_) {
                                    setState(() => classFilter = entry.$1);
                                    _load();
                                  },
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _statGrid(theme, isDark, appointments),
                      const SizedBox(height: 16),
                      _barsCard(
                        theme,
                        isDark,
                        title: 'Konu Dağılımı',
                        entries: _list('sessionsByTopic')
                            .map((e) => (
                                  _topicLabels[e['topic']] ??
                                      e['topic'].toString(),
                                  (e['count'] as num?)?.toInt() ?? 0
                                ))
                            .toList(),
                      ),
                      const SizedBox(height: 16),
                      _barsCard(
                        theme,
                        isDark,
                        title: 'Aylık Görüşme',
                        entries: _list('sessionsByMonth')
                            .map((e) => (
                                  e['month'].toString(),
                                  (e['count'] as num?)?.toInt() ?? 0
                                ))
                            .toList(),
                        color: _navy,
                      ),
                      const SizedBox(height: 16),
                      _barsCard(
                        theme,
                        isDark,
                        title: 'Görüşme Türleri',
                        entries: _list('sessionsByType')
                            .map((e) => (
                                  e['type'].toString(),
                                  (e['count'] as num?)?.toInt() ?? 0
                                ))
                            .toList(),
                        color: const Color(0xFF8B5CF6),
                      ),
                    ],
                  ),
                ),
    );
  }

  BoxDecoration _cardDecoration(ThemeData theme, bool isDark) => BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      );

  Widget _statGrid(
      ThemeData theme, bool isDark, Map<String, dynamic> appointments) {
    Widget tile(String label, String value, Color color) => Container(
          padding: const EdgeInsets.all(14),
          decoration: _cardDecoration(theme, isDark),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      color: color)),
              Text(label,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.hintColor)),
            ],
          ),
        );

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.2,
      children: [
        tile('Toplam Görüşme', '${report?['totalSessions'] ?? 0}', _navy),
        tile('Toplam Randevu', '${appointments['total'] ?? 0}', _orange),
        tile('Onaylanan', '${appointments['approved'] ?? 0}',
            const Color(0xFF22C55E)),
        tile('Bekleyen', '${appointments['pending'] ?? 0}',
            const Color(0xFFEF4444)),
      ],
    );
  }

  Widget _barsCard(
    ThemeData theme,
    bool isDark, {
    required String title,
    required List<(String, int)> entries,
    Color color = _orange,
  }) {
    final maxValue = entries.isEmpty
        ? 1
        : entries.map((e) => e.$2).reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(theme, isDark),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (entries.isEmpty)
            Text('Kayıt yok.', style: theme.textTheme.bodySmall)
          else
            ...entries.map((entry) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 100,
                        child: Text(entry.$1,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 12),
                            overflow: TextOverflow.ellipsis),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(7),
                          child: LinearProgressIndicator(
                            value: maxValue == 0 ? 0 : entry.$2 / maxValue,
                            minHeight: 12,
                            backgroundColor:
                                theme.dividerColor.withValues(alpha: 0.35),
                            valueColor: AlwaysStoppedAnimation(color),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text('${entry.$2}',
                          style:
                              const TextStyle(fontWeight: FontWeight.w900)),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}
