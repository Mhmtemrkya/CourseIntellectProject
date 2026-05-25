import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

import '../services/question_bank_store.dart';
import '../services/student_registry_store.dart';
import 'teacher_question_batch_create_page.dart';
import 'teacher_question_bank_detail_page.dart';
import 'teacher_question_studio_page.dart';

class TeacherQuestionBankPage extends StatefulWidget {
  const TeacherQuestionBankPage({super.key});

  @override
  State<TeacherQuestionBankPage> createState() =>
      _TeacherQuestionBankPageState();
}

class _TeacherQuestionBankPageState extends State<TeacherQuestionBankPage> {
  final _store = QuestionBankStore.instance;
  final TextEditingController _searchController = TextEditingController();
  String _subjectFilter = 'Tümü';
  String _classFilter = 'Tüm Sınıflar';
  List<String> _subjectOptions = const ['Tümü'];
  List<String> _classOptions = const ['Tüm Sınıflar'];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _load();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      await StudentRegistryStore.instance.ensureLoaded();
      await _store.loadQuestions();
      final subjects =
          _store.questions
              .map((item) => item.subject.trim())
              .where((item) => item.isNotEmpty)
              .toSet()
              .toList()
            ..sort();
      final classes =
          StudentRegistryStore.instance.students
              .map((item) => item.className.trim())
              .where((item) => item.isNotEmpty)
              .toSet()
              .toList()
            ..sort();
      _subjectOptions = ['Tümü', ...subjects];
      _classOptions = ['Tüm Sınıflar', ...classes];
      if (!_subjectOptions.contains(_subjectFilter)) {
        _subjectFilter = 'Tümü';
      }
      if (!_classOptions.contains(_classFilter)) {
        _classFilter = 'Tüm Sınıflar';
      }
    } catch (error) {
      _errorMessage = error.toString();
    }
    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final questions = _filteredQuestions();
    final questionSets = _groupQuestionSets(questions);
    final now = DateTime.now();
    final monthlyCount = _store.questions.where((item) {
      final createdAt = DateTime.tryParse(item.createdAt);
      return createdAt != null &&
          createdAt.year == now.year &&
          createdAt.month == now.month;
    }).length;
    final hasNoQuestions =
        !_isLoading && _errorMessage == null && _store.questions.isEmpty;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF07101C)
          : const Color(0xFFF4F7FB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: Text(
          "Soru Bankası",
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          _appBarAction(
            icon: Icons.download_rounded,
            tooltip: 'Dışa Aktar',
            onPressed: _exportQuestions,
            isDark: isDark,
          ),
          _appBarAction(
            icon: Icons.upload_rounded,
            tooltip: 'İçe Aktar',
            onPressed: _importQuestions,
            isDark: isDark,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _heroSection(
                isDark: isDark,
                totalQuestions: questions.length,
                monthlyCount: monthlyCount,
                subjectCount: _subjectOptions.length > 1
                    ? _subjectOptions.length - 1
                    : 0,
              ),
              const SizedBox(height: 16),
              if (hasNoQuestions)
                _emptyQuestionBankDesign(isDark)
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _filterPanel(isDark),
                    const SizedBox(height: 16),
                    _sectionHeader(
                      title: 'Soru Setleri',
                      subtitle: '${questionSets.length} set listeleniyor',
                      isDark: isDark,
                    ),
                    const SizedBox(height: 12),
                    if (_isLoading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_errorMessage != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Column(
                            children: [
                              Text(_errorMessage!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _load,
                                child: const Text('Tekrar Dene'),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      questionSets.isEmpty
                          ? _filteredEmptyState(isDark)
                          : Column(
                              children: questionSets
                                  .map((item) => questionTile(item))
                                  .toList(),
                            ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _appBarAction({
    required IconData icon,
    required String tooltip,
    required VoidCallback onPressed,
    required bool isDark,
  }) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        style: IconButton.styleFrom(
          backgroundColor: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.white,
          foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
          side: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : const Color(0xFFE2E8F0),
          ),
        ),
        icon: Icon(icon),
      ),
    );
  }

  Future<void> _openBatchCreate() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const TeacherQuestionBatchCreatePage()),
    );
    await _load();
  }

  Future<void> _openCreateQuestion() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const TeacherQuestionStudioPage()),
    );
    await _load();
  }

  Widget _heroSection({
    required bool isDark,
    required int totalQuestions,
    required int monthlyCount,
    required int subjectCount,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF061A2D), Color(0xFF0F766E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withValues(alpha: 0.24),
            blurRadius: 30,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                ),
                child: const Icon(
                  Icons.psychology_alt_outlined,
                  color: Colors.white,
                  size: 30,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Öğretmen Soru Bankası',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Soru üret, setle, sınıflara hazırla',
                      style: TextStyle(color: Colors.white70, height: 1.35),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _heroMetric(
                  '$totalQuestions',
                  'Toplam',
                  Icons.quiz_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _heroMetric(
                  '$monthlyCount',
                  'Bu ay',
                  Icons.add_circle_outline,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _heroMetric(
                  '$subjectCount',
                  'Ders',
                  Icons.menu_book_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF97316),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: _openCreateQuestion,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text(
                    'Yeni Soru',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    backgroundColor: Colors.white.withValues(alpha: 0.06),
                  ),
                  onPressed: _openBatchCreate,
                  icon: const Icon(Icons.layers_outlined),
                  label: const Text(
                    'Soru Seti',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.18)),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              backgroundColor: Colors.white.withValues(alpha: 0.05),
            ),
            onPressed: _importQuestions,
            icon: const Icon(Icons.upload_file_outlined),
            label: const Text(
              'JSON arşivinden içe aktar',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroMetric(String value, String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.white70, size: 20),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _filterPanel(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0D1724) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : const Color(0xFFE5E7EB),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.05),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: "Konu, soru veya öğretmen ara...",
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(vertical: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 42,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _subjectOptions.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final subject = _subjectOptions[index];
                final selected = _subjectFilter == subject;
                final accent = _subjectAccent(subject);
                return ChoiceChip(
                  label: Text(subject),
                  selected: selected,
                  selectedColor: accent,
                  backgroundColor: isDark
                      ? Colors.white.withValues(alpha: 0.04)
                      : const Color(0xFFF8FAFC),
                  labelStyle: TextStyle(
                    color: selected
                        ? Colors.white
                        : isDark
                        ? Colors.white.withValues(alpha: 0.78)
                        : accent,
                    fontWeight: FontWeight.w800,
                  ),
                  side: BorderSide(color: accent.withValues(alpha: 0.30)),
                  onSelected: (selectedValue) =>
                      setState(() => _subjectFilter = subject),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _classFilter,
            decoration: InputDecoration(
              labelText: 'Sınıf Filtresi',
              filled: true,
              fillColor: isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: BorderSide.none,
              ),
            ),
            items: _classOptions
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) =>
                setState(() => _classFilter = value ?? _classFilter),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader({
    required String title,
    required String subtitle,
    required bool isDark,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: TextStyle(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.58)
                      : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Yenile',
        ),
      ],
    );
  }

  Widget _emptyQuestionBankDesign(bool isDark) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 980),
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(vertical: 18),
          padding: const EdgeInsets.fromLTRB(22, 28, 22, 34),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF080D17) : Colors.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.10)
                  : const Color(0xFFE5E7EB),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.34 : 0.07),
                blurRadius: 38,
                offset: const Offset(0, 22),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: 245,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;
                    final iconSize = width < 520 ? 46.0 : 58.0;
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _QuestionBankOrbitPainter(isDark: isDark),
                          ),
                        ),
                        Positioned(
                          top: 14,
                          child: Icon(
                            Icons.psychology_alt_outlined,
                            size: width < 520 ? 64 : 78,
                            color: isDark
                                ? Colors.white
                                : const Color(0xFF111827),
                          ),
                        ),
                        Positioned(
                          top: 95,
                          child: _GlowingBoxIllustration(isDark: isDark),
                        ),
                        Positioned(
                          left: width * 0.16,
                          top: 76,
                          child: _floatingIcon(
                            Icons.description_outlined,
                            const Color(0xFFF97316),
                            isDark,
                            size: iconSize,
                          ),
                        ),
                        Positioned(
                          right: width * 0.16,
                          top: 78,
                          child: _floatingIcon(
                            Icons.auto_fix_high_outlined,
                            const Color(0xFFC084FC),
                            isDark,
                            size: iconSize,
                          ),
                        ),
                        Positioned(
                          left: width * 0.22,
                          bottom: 44,
                          child: _floatingIcon(
                            Icons.groups_2_outlined,
                            const Color(0xFF38BDF8),
                            isDark,
                            size: iconSize,
                          ),
                        ),
                        Positioned(
                          right: width * 0.22,
                          bottom: 48,
                          child: _floatingIcon(
                            Icons.bar_chart_rounded,
                            const Color(0xFF22C55E),
                            isDark,
                            size: iconSize,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Henüz soru oluşturulmadı',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Soru bankanızı oluşturmak için hemen yeni soru ekleyebilir\nveya içe aktararak arşivinizi zenginleştirebilirsiniz.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  height: 1.45,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.72)
                      : const Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 28),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 14,
                runSpacing: 12,
                children: [
                  SizedBox(
                    height: 56,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFF97316),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 34),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: _openCreateQuestion,
                      icon: const Icon(Icons.add_rounded),
                      label: const Text(
                        'Yeni Soru Ekle',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  SizedBox(
                    height: 56,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: isDark
                            ? Colors.white
                            : const Color(0xFF111827),
                        side: BorderSide(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.16)
                              : const Color(0xFFE2E8F0),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 34),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: _importQuestions,
                      icon: const Icon(Icons.upload_file_outlined),
                      label: const Text(
                        'İçe Aktar',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 30),
              Container(
                constraints: const BoxConstraints(maxWidth: 540),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.035)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB).withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.lightbulb_outline_rounded,
                        color: Color(0xFF60A5FA),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'PDF veya JSON dosyalarından içe aktararak sorularınızı hızlıca sisteme ekleyebilirsiniz.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.72)
                              : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filteredEmptyState(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 30, 22, 30),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0D1724) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : const Color(0xFFE5E7EB),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(
              Icons.manage_search_rounded,
              color: Color(0xFF2563EB),
              size: 30,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Bu filtrelere uygun soru bulunamadı',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontWeight: FontWeight.w900,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Arama kelimesini veya sınıf filtresini değiştirerek tekrar deneyebilirsin.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.64)
                  : const Color(0xFF64748B),
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _floatingIcon(
    IconData icon,
    Color color,
    bool isDark, {
    double size = 58,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.035)
            : Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.24)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Icon(icon, color: color, size: size * 0.46),
    );
  }

  /// QUESTION TILE
  Widget questionTile(_QuestionSetView set) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lead = set.questions.first;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TeacherQuestionBankDetailPage(question: lead),
          ),
        ).then((_) => _load());
      },
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF17181D) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.06)
                : const Color(0xFFE5E7EB),
          ),
          boxShadow: isDark
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 10),
                  ),
                ]
              : [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, 10),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        set.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark
                              ? Colors.white
                              : const Color(0xFF111827),
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${set.questions.length} soru',
                        style: TextStyle(
                          color: isDark
                              ? Colors.white70
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2563EB), Color(0xFF0EA5E9)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${set.questions.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _questionCover(
              isDark,
              lead.subject,
              set.title,
              set.questions.length,
            ),
          ],
        ),
      ),
    );
  }

  Widget _questionCover(
    bool isDark,
    String subject,
    String title,
    int questionCount,
  ) {
    final accent = _subjectAccent(subject);
    final safeTitle = _decodeSubject(title);
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: 180,
        width: double.infinity,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: _subjectGradient(subject),
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                left: -18,
                top: -20,
                child: Container(
                  width: 112,
                  height: 112,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                left: 24,
                top: 22,
                child: Text(
                  _subjectMark(subject),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.10),
                    fontSize: 54,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1.6,
                  ),
                ),
              ),
              Positioned(
                right: -24,
                bottom: -26,
                child: Container(
                  width: 148,
                  height: 148,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.10),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                right: 18,
                top: 18,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Text(
                    '$questionCount soru',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                      ),
                      child: Icon(_subjectIcon(subject), color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _decodeSubject(subject),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _subjectTagline(subject),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            safeTitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.4,
                              height: 1.05,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 10,
                      height: 56,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Color> _subjectGradient(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) {
      return const [Color(0xFF2563EB), Color(0xFF1D4ED8)];
    }
    if (normalized.contains('fiz')) {
      return const [Color(0xFF7C3AED), Color(0xFF5B21B6)];
    }
    if (normalized.contains('kim')) {
      return const [Color(0xFFEA580C), Color(0xFFC2410C)];
    }
    if (normalized.contains('biy')) {
      return const [Color(0xFF16A34A), Color(0xFF15803D)];
    }
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const [Color(0xFFDC2626), Color(0xFFB91C1C)];
    }
    if (normalized.contains('ing')) {
      return const [Color(0xFF0891B2), Color(0xFF0E7490)];
    }
    return const [Color(0xFF0F766E), Color(0xFF155E75)];
  }

  Color _subjectAccent(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return const Color(0xFF2563EB);
    if (normalized.contains('fiz')) return const Color(0xFF7C3AED);
    if (normalized.contains('kim')) return const Color(0xFFEA580C);
    if (normalized.contains('biy')) return const Color(0xFF16A34A);
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const Color(0xFFDC2626);
    }
    if (normalized.contains('ing')) return const Color(0xFF0891B2);
    return const Color(0xFF0F766E);
  }

  IconData _subjectIcon(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return Icons.calculate_rounded;
    if (normalized.contains('fiz')) return Icons.bolt_rounded;
    if (normalized.contains('kim')) return Icons.science_rounded;
    if (normalized.contains('biy')) return Icons.eco_rounded;
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return Icons.menu_book_rounded;
    }
    if (normalized.contains('ing')) return Icons.translate_rounded;
    return Icons.auto_awesome_rounded;
  }

  String _subjectMark(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return 'x²';
    if (normalized.contains('fiz')) return 'F';
    if (normalized.contains('kim')) return 'H₂O';
    if (normalized.contains('biy')) return 'DNA';
    if (normalized.contains('türk') || normalized.contains('turk')) return 'Aa';
    if (normalized.contains('ing')) return 'EN';
    return 'QB';
  }

  String _subjectTagline(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return 'FORMÜL • PROBLEM • MANTIK';
    if (normalized.contains('fiz')) return 'HAREKET • ENERJİ • KUVVET';
    if (normalized.contains('kim')) return 'TEPKİME • MADDE • BAĞ';
    if (normalized.contains('biy')) return 'CANLI • HÜCRE • SİSTEM';
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return 'DİL • ANLAM • PARAGRAF';
    }
    if (normalized.contains('ing')) return 'VOCAB • GRAMMAR • READING';
    return 'SET • PRATİK • TEKRAR';
  }

  String _decodeSubject(String subject) {
    return subject
        .replaceAll('&#xFC;', 'ü')
        .replaceAll('&#xDC;', 'Ü')
        .replaceAll('&#xE7;', 'ç')
        .replaceAll('&#xC7;', 'Ç')
        .replaceAll('&#x131;', 'ı')
        .replaceAll('&#x130;', 'İ')
        .replaceAll('&#xF6;', 'ö')
        .replaceAll('&#xD6;', 'Ö')
        .replaceAll('&#x15F;', 'ş')
        .replaceAll('&#x15E;', 'Ş')
        .replaceAll('&#x11F;', 'ğ')
        .replaceAll('&#x11E;', 'Ğ')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&Ccedil;', 'Ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&Scedil;', 'Ş')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&');
  }

  Future<void> _exportQuestions() async {
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/question-bank-export.json');
    final payload = _filteredQuestions().map((item) => item.toMap()).toList();
    await file.writeAsString(
      const JsonEncoder.withIndent('  ').convert(payload),
    );
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: 'Soru bankası dışa aktarma'),
    );
  }

  Future<void> _importQuestions() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json'],
    );
    final file = result?.files.single;
    if (file == null || file.path == null) return;
    final raw = await File(file.path!).readAsString();
    final parsed = jsonDecode(raw) as List<dynamic>;
    for (final item in parsed) {
      final map = Map<String, dynamic>.from(item as Map);
      await _store.addQuestion(
        subject: map['subject'] as String? ?? 'Genel',
        topic: map['topic'] as String? ?? 'Genel',
        difficulty: map['difficulty'] as String? ?? 'Orta',
        type: map['type'] as String? ?? 'Açık Uçlu',
        questionText:
            map['questionText'] as String? ?? map['question'] as String? ?? '',
        teacher: map['teacher'] as String? ?? 'Öğretmen',
        imagePath: map['imagePath'] as String?,
        options: (map['options'] as List<dynamic>? ?? const []).cast<String>(),
        correctOptionIndex: map['correctOptionIndex'] as int?,
        classTargets:
            (map['classTargets'] as List<dynamic>? ?? const ['Tüm Sınıflar'])
                .cast<String>(),
        solutionAssetPath: map['solutionAssetPath'] as String?,
        solutionAssetType: map['solutionAssetType'] as String?,
        revealCorrectAnswerToStudent:
            map['revealCorrectAnswerToStudent'] as bool? ?? false,
        expectedAnswer: map['expectedAnswer'] as String?,
      );
    }
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Soru bankası içe aktarıldı.')),
    );
  }

  List<QuestionBankRecord> _filteredQuestions() {
    final query = _searchController.text.trim().toLowerCase();
    return _store.questions.where((item) {
      final subjectMatch =
          _subjectFilter == 'Tümü' || item.subject == _subjectFilter;
      final classMatch =
          _classFilter == 'Tüm Sınıflar' ||
          item.classTargets.contains('Tüm Sınıflar') ||
          item.classTargets.contains(_classFilter);
      final searchText =
          '${item.topic} ${item.questionText} ${item.teacher} ${item.classTargets.join(' ')}'
              .toLowerCase();
      final searchMatch = query.isEmpty || searchText.contains(query);
      return subjectMatch && classMatch && searchMatch;
    }).toList();
  }

  List<_QuestionSetView> _groupQuestionSets(List<QuestionBankRecord> items) {
    final groups = <String, List<QuestionBankRecord>>{};
    final sortedItems = [...items]
      ..sort((a, b) {
        final aTime =
            DateTime.tryParse(a.createdAt) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final bTime =
            DateTime.tryParse(b.createdAt) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });

    for (final item in sortedItems) {
      final key = _questionSetKey(item);
      groups.putIfAbsent(key, () => <QuestionBankRecord>[]).add(item);
    }
    return groups.entries.map((entry) {
      final questions = [...entry.value]
        ..sort((a, b) {
          final aOrder = a.questionOrder ?? 9999;
          final bOrder = b.questionOrder ?? 9999;
          if (aOrder != bOrder) return aOrder.compareTo(bOrder);
          final aTime =
              DateTime.tryParse(a.createdAt) ??
              DateTime.fromMillisecondsSinceEpoch(0);
          final bTime =
              DateTime.tryParse(b.createdAt) ??
              DateTime.fromMillisecondsSinceEpoch(0);
          return aTime.compareTo(bTime);
        });
      return _QuestionSetView(
        key: entry.key,
        title: questions.first.questionSetTitle ?? questions.first.topic,
        questions: questions,
      );
    }).toList()..sort((a, b) {
      final aTime =
          DateTime.tryParse(a.questions.first.createdAt) ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final bTime =
          DateTime.tryParse(b.questions.first.createdAt) ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return bTime.compareTo(aTime);
    });
  }

  String _questionSetKey(QuestionBankRecord item) {
    if (item.questionSetKey != null && item.questionSetKey!.isNotEmpty) {
      return item.questionSetKey!;
    }
    final createdAt = DateTime.tryParse(item.createdAt);
    final bucket = createdAt == null
        ? item.createdAt
        : '${createdAt.year}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')} ${createdAt.hour.toString().padLeft(2, '0')}:${(createdAt.minute ~/ 10).toString()}';
    final classes = [...item.classTargets]..sort();
    return '${item.teacher}|${item.subject}|${item.topic}|$bucket|${classes.join(",")}';
  }
}

class _QuestionSetView {
  final String key;
  final String title;
  final List<QuestionBankRecord> questions;

  const _QuestionSetView({
    required this.key,
    required this.title,
    required this.questions,
  });
}

class _GlowingBoxIllustration extends StatelessWidget {
  final bool isDark;

  const _GlowingBoxIllustration({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 250,
      height: 142,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 118,
            height: 112,
            margin: const EdgeInsets.only(top: 26),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? const [Color(0xFF172033), Color(0xFF070B12)]
                    : const [Color(0xFFE2E8F0), Color(0xFFCBD5E1)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF97316).withValues(alpha: 0.32),
                  blurRadius: 36,
                  spreadRadius: 4,
                  offset: const Offset(0, -12),
                ),
              ],
            ),
            child: Icon(
              Icons.psychology_outlined,
              color: const Color(0xFFF97316).withValues(alpha: 0.76),
              size: 34,
            ),
          ),
          Positioned(
            top: 18,
            left: 54,
            child: Transform.rotate(
              angle: -0.42,
              child: _boxFlap(isLeft: true),
            ),
          ),
          Positioned(
            top: 18,
            right: 54,
            child: Transform.rotate(angle: 0.42, child: _boxFlap()),
          ),
          Positioned(
            top: 55,
            child: Container(
              width: 18,
              height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFFF97316).withValues(alpha: 0.72),
                    const Color(0xFFF97316).withValues(alpha: 0),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _boxFlap({bool isLeft = false}) {
    return Container(
      width: 92,
      height: 44,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF3A4558), Color(0xFF151C2B)]
              : const [Color(0xFFF8FAFC), Color(0xFFCBD5E1)],
          begin: isLeft ? Alignment.topLeft : Alignment.topRight,
          end: isLeft ? Alignment.bottomRight : Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: Colors.white.withValues(alpha: isDark ? 0.10 : 0.46),
        ),
      ),
    );
  }
}

class _QuestionBankOrbitPainter extends CustomPainter {
  final bool isDark;

  const _QuestionBankOrbitPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.53);
    final rect = Rect.fromCenter(
      center: center,
      width: size.width * 0.74,
      height: 106,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = (isDark ? Colors.white : const Color(0xFF64748B)).withValues(
        alpha: isDark ? 0.20 : 0.18,
      );

    final path = Path()..addOval(rect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final segment = metric.extractPath(distance, distance + 4);
        canvas.drawPath(segment, paint);
        distance += 12;
      }
    }

    final glowPaint = Paint()
      ..color = const Color(0xFFF97316).withValues(alpha: isDark ? 0.24 : 0.12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 34);
    canvas.drawCircle(center.translate(0, -10), 54, glowPaint);
  }

  @override
  bool shouldRepaint(covariant _QuestionBankOrbitPainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}
