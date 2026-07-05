import 'package:flutter/material.dart';
import 'package:student/pages/counselor_student_file_page.dart';
import 'package:student/services/guidance_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

Color riskColor(String level) => switch (level) {
      'high' => const Color(0xFFEF4444),
      'medium' => const Color(0xFFF59E0B),
      _ => const Color(0xFF22C55E),
    };

String riskLabel(String level) => switch (level) {
      'high' => 'Yüksek',
      'medium' => 'Orta',
      _ => 'Düşük',
    };

/// Vaka Merkezi: canlı devamsızlık/sınav/ödev verisinden hesaplanan risk
/// listesi, incelenecek öğrenciler ve yaklaşan takipler.
class CounselorHomePage extends StatefulWidget {
  const CounselorHomePage({super.key});

  @override
  State<CounselorHomePage> createState() => _CounselorHomePageState();
}

class _CounselorHomePageState extends State<CounselorHomePage> {
  List<Map<String, dynamic>> students = [];
  List<Map<String, dynamic>> followUps = [];
  bool loading = true;
  String? error;
  String search = '';
  String riskFilter = 'all';

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
        GuidanceApiService.instance.fetchOverview(),
        GuidanceApiService.instance
            .fetchFollowUps()
            .catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        students = results[0];
        followUps = results[1];
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

  List<Map<String, dynamic>> get filtered => students.where((s) {
        if (riskFilter != 'all' && s['riskLevel'] != riskFilter) return false;
        if (search.isNotEmpty &&
            !(s['studentName'] as String? ?? '')
                .toLowerCase()
                .contains(search.toLowerCase())) {
          return false;
        }
        return true;
      }).toList();

  int get attentionCount =>
      students.where((s) => s['needsAttention'] == true).length;

  void _openFile(String name) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CounselorStudentFilePage(studentName: name),
      ),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Vaka Merkezi',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? _errorView(theme)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      _statsRow(theme, isDark),
                      const SizedBox(height: 16),
                      if (followUps.isNotEmpty) ...[
                        _followUpsCard(theme, isDark),
                        const SizedBox(height: 16),
                      ],
                      _searchAndFilter(theme, isDark),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        Padding(
                          padding: const EdgeInsets.all(32),
                          child: Center(
                            child: Text('Filtreye uyan öğrenci yok.',
                                style: theme.textTheme.bodyMedium),
                          ),
                        )
                      else
                        ...filtered.map((s) => _studentCard(theme, isDark, s)),
                    ],
                  ),
                ),
    );
  }

  Widget _errorView(ThemeData theme) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 42, color: Colors.redAccent),
              const SizedBox(height: 12),
              Text(error ?? '', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
            ],
          ),
        ),
      );

  Widget _statsRow(ThemeData theme, bool isDark) {
    Widget stat(String label, String value, IconData icon, Color color) =>
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(height: 8),
                Text(value,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w900)),
                Text(label,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.hintColor)),
              ],
            ),
          ),
        );

    return Row(
      children: [
        stat('Öğrenci', '${students.length}', Icons.groups_rounded,
            const Color(0xFF3B82F6)),
        const SizedBox(width: 10),
        stat('İlgilenilecek', '$attentionCount', Icons.report_rounded,
            const Color(0xFFEF4444)),
        const SizedBox(width: 10),
        stat('Takip', '${followUps.length}', Icons.alarm_rounded, _orange),
      ],
    );
  }

  Widget _followUpsCard(ThemeData theme, bool isDark) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _orange.withValues(alpha: isDark ? 0.12 : 0.08),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _orange.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.alarm_rounded, color: _orange, size: 20),
                SizedBox(width: 8),
                Text('Yaklaşan Takipler',
                    style: TextStyle(fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 10),
            ...followUps.take(4).map((f) => InkWell(
                  onTap: () => _openFile(f['studentName'] as String? ?? ''),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            f['studentName'] as String? ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          _formatDate(f['followUpAtUtc']),
                          style: const TextStyle(
                              color: _orange, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                )),
          ],
        ),
      );

  Widget _searchAndFilter(ThemeData theme, bool isDark) => Column(
        children: [
          TextField(
            onChanged: (v) => setState(() => search = v),
            decoration: InputDecoration(
              hintText: 'Öğrenci ara...',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              filled: true,
              fillColor: theme.cardColor,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final entry in const [
                  ('all', 'Tümü'),
                  ('high', 'Yüksek Risk'),
                  ('medium', 'Orta Risk'),
                  ('low', 'Düşük Risk'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(entry.$2),
                      selected: riskFilter == entry.$1,
                      selectedColor: _navy,
                      labelStyle: TextStyle(
                        color: riskFilter == entry.$1
                            ? Colors.white
                            : theme.textTheme.bodyMedium?.color,
                        fontWeight: FontWeight.w700,
                      ),
                      onSelected: (_) =>
                          setState(() => riskFilter = entry.$1),
                    ),
                  ),
              ],
            ),
          ),
        ],
      );

  Widget _studentCard(ThemeData theme, bool isDark, Map<String, dynamic> s) {
    final level = s['riskLevel'] as String? ?? 'low';
    final reasons = (s['riskReasons'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => _openFile(s['studentName'] as String? ?? ''),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: riskColor(level).withValues(alpha: 0.15),
                child: Text(
                  (s['studentName'] as String? ?? '?')
                      .split(' ')
                      .take(2)
                      .map((p) => p.isEmpty ? '' : p[0])
                      .join()
                      .toUpperCase(),
                  style: TextStyle(
                      color: riskColor(level), fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s['studentName'] as String? ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(
                      reasons.isNotEmpty
                          ? reasons.first
                          : (s['className'] as String? ?? ''),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.hintColor),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: riskColor(level).withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      riskLabel(level),
                      style: TextStyle(
                        color: riskColor(level),
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  if (s['needsAttention'] == true)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text('incelenmedi',
                          style: TextStyle(
                              fontSize: 10, color: Color(0xFFEF4444))),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(dynamic value) {
    final d = DateTime.tryParse(value?.toString() ?? '');
    if (d == null) return '—';
    return '${d.day}.${d.month}.${d.year}';
  }
}
