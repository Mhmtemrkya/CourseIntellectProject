import 'package:flutter/material.dart';

import '../services/linked_children_service.dart';
import '../services/reports_analytics_api_service.dart';

class ExamAnalysisPage extends StatefulWidget {
  const ExamAnalysisPage({super.key});

  @override
  State<ExamAnalysisPage> createState() => _ExamAnalysisPageState();
}

class _ExamAnalysisPageState extends State<ExamAnalysisPage> {
  bool _loading = true;
  String? _error;
  String _studentName = 'Öğrenci';
  ExamAnalyticsRecord? _analytics;

  @override
  void initState() {
    super.initState();
    _loadAnalysis();
  }

  Future<void> _loadAnalysis() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final children = await LinkedChildrenService.instance
          .loadLinkedChildren();
      final studentName = children.isNotEmpty
          ? children.first.fullName
          : _studentName;
      final analytics = await ReportsAnalyticsApiService.instance
          .fetchExamAnalytics(studentName);
      if (!mounted) return;
      setState(() {
        _studentName = studentName;
        _analytics = analytics;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Widget _card(BuildContext context, Widget child) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: theme.brightness == Brightness.dark
                ? Colors.black.withValues(alpha: 0.24)
                : Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _statItem(
    BuildContext context,
    String title,
    String value,
    Color color,
    IconData icon,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(title, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }

  Widget _progressRow(
    BuildContext context,
    String lesson,
    double progress,
    String score,
    Color color,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                lesson,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              Text(
                score,
                style: TextStyle(color: color, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: Colors.grey.shade300,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _insightTile(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    Color color,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final analytics = _analytics;
    final subjects =
        analytics?.subjects ?? const <ExamAnalyticsSubjectRecord>[];
    final average = analytics?.averageScore ?? 0;
    final correctEstimate = analytics?.netAverage ?? 0;
    final wrongEstimate = analytics?.riskScore ?? 0;
    final strongest = analytics?.strongestSubject;
    final weakest = analytics?.weakestSubject;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Detaylı Analiz")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loadAnalysis,
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _card(
                    context,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "$_studentName analiz özeti",
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _statItem(
                              context,
                              "Ortalama",
                              "$average",
                              Colors.orange,
                              Icons.bar_chart,
                            ),
                            const SizedBox(width: 12),
                            _statItem(
                              context,
                              "Net Ort.",
                              "$correctEstimate",
                              Colors.green,
                              Icons.check_circle,
                            ),
                            const SizedBox(width: 12),
                            _statItem(
                              context,
                              "Risk",
                              "$wrongEstimate",
                              Colors.red,
                              Icons.cancel,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  _card(
                    context,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Ders Bazlı Başarı",
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (subjects.isEmpty)
                          const Text(
                            'Ders bazlı analiz için henüz sonuç kaydı bulunmuyor.',
                          )
                        else
                          ...subjects.asMap().entries.map((entry) {
                            final avg = entry.value.averageScore;
                            final color = _subjectColor(
                              entry.value.subject,
                              entry.key,
                            );
                            return _progressRow(
                              context,
                              entry.value.subject,
                              avg / 100,
                              '%$avg',
                              color,
                            );
                          }),
                      ],
                    ),
                  ),
                  _card(
                    context,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Analiz Notları",
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        _insightTile(
                          context,
                          Icons.trending_up,
                          strongest == null
                              ? 'Güçlü ders bekleniyor'
                              : 'En güçlü ders: $strongest',
                          strongest == null
                              ? 'Yeni sınav kaydı geldikce burada otomatik yorum olusacak.'
                              : 'Bu dersteki performans diğer derslere göre daha yüksek.',
                          Colors.green,
                        ),
                        _insightTile(
                          context,
                          Icons.lightbulb_outline,
                          weakest == null
                              ? 'Destek alanı bekleniyor'
                              : 'Ek tekrar önerisi: $weakest',
                          weakest == null
                              ? 'Destek önerisi için daha fazla veri gerekiyor.'
                              : 'Bu alanda ek tekrar ve soru çözüm oturumu faydali olabilir.',
                          Colors.orange,
                        ),
                        _insightTile(
                          context,
                          Icons.timer_outlined,
                          "Sınav hareketleri izlendi",
                          (analytics?.examCount ?? 0) == 0
                              ? 'Henüz sınav sonucu kaydı yok.'
                              : '${analytics?.examCount ?? 0} sonuç kaydı analiz edildi ve güncel tablo oluşturuldu.',
                          Colors.blue,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Color _subjectColor(String subject, int index) {
    switch (subject) {
      case 'Matematik':
        return const Color(0xFFF59E0B);
      case 'Fizik':
        return const Color(0xFF2563EB);
      case 'Kimya':
        return const Color(0xFF16A34A);
      case 'Turkce':
      case 'Türkçe':
        return const Color(0xFF7C3AED);
      default:
        const palette = [
          Color(0xFFF59E0B),
          Color(0xFF2563EB),
          Color(0xFF16A34A),
          Color(0xFF7C3AED),
        ];
        return palette[index % palette.length];
    }
  }
}
