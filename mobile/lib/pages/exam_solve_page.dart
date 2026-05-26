import 'dart:async';

import 'package:flutter/material.dart';
import 'package:student/services/api_config.dart';
import 'package:student/services/solution_session_api_service.dart';
import 'package:student/widgets/solution_drawing_canvas.dart';
import 'package:url_launcher/url_launcher.dart';

class ExamSolvePage extends StatefulWidget {
  final String? plannedExamId;
  final String? examTitle;
  final String? subject;
  final int questionCount;
  final bool isTeacherPreview;

  const ExamSolvePage({
    super.key,
    this.plannedExamId,
    this.examTitle,
    this.subject,
    this.questionCount = 10,
    this.isTeacherPreview = false,
  });

  @override
  State<ExamSolvePage> createState() => _ExamSolvePageState();
}

class _ExamSolvePageState extends State<ExamSolvePage> {
  int _currentIndex = 0;
  int _remainingSeconds = 0;
  Timer? _timer;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String _autosave = 'Hazır';
  SolutionSessionRecord? _session;
  SolutionSummaryRecord? _summary;
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _answerController = TextEditingController();

  SolutionQuestionRecord? get _question {
    final session = _session;
    if (session == null || session.questions.isEmpty) return null;
    return session.questions[_currentIndex];
  }

  @override
  void initState() {
    super.initState();
    _startSession();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _noteController.dispose();
    _answerController.dispose();
    super.dispose();
  }

  Future<void> _startSession() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await SolutionSessionApiService.instance.startSession(
        plannedExamId: widget.plannedExamId,
        title: widget.examTitle,
        subject: widget.subject,
        questionCount: widget.questionCount,
        isTeacherPreview: widget.isTeacherPreview,
      );
      if (!mounted) return;
      setState(() {
        _session = session;
        _remainingSeconds = session.durationSeconds;
        _noteController.text = session.questions.isEmpty
            ? ''
            : session.questions.first.note ?? '';
        _answerController.text = session.questions.isEmpty
            ? ''
            : session.questions.first.answer?.openAnswer ?? '';
        _loading = false;
      });
      _startTimer();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remainingSeconds <= 0) {
        timer.cancel();
        _finishExam();
        return;
      }
      setState(() => _remainingSeconds--);
    });
  }

  void _setQuestionIndex(int index) {
    final session = _session;
    if (session == null) return;
    setState(() {
      _currentIndex = index.clamp(0, session.questions.length - 1);
      _noteController.text = session.questions[_currentIndex].note ?? '';
      _answerController.text =
          session.questions[_currentIndex].answer?.openAnswer ?? '';
    });
  }

  Future<void> _selectAnswer(int index) async {
    final session = _session;
    final question = _question;
    if (session == null || question == null || _saving) return;
    setState(() {
      _saving = true;
      _autosave = 'Cevap kaydediliyor...';
    });
    try {
      final updated = await SolutionSessionApiService.instance.saveAnswer(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        selectedOptionIndex: index,
        timeSpentSeconds: question.timeSpentSeconds,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _autosave = 'Cevap kaydedildi';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _autosave = 'Cevap kaydedilemedi');
      _showSnack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveOpenAnswer() async {
    final session = _session;
    final question = _question;
    if (session == null || question == null || _saving) return;
    if (_answerController.text.trim().isEmpty) {
      _showSnack('Cevabınızı yazmadan kaydedemezsiniz.');
      return;
    }
    setState(() {
      _saving = true;
      _autosave = 'Cevap kaydediliyor...';
    });
    try {
      final updated = await SolutionSessionApiService.instance.saveAnswer(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        selectedOptionIndex: -1,
        openAnswer: _answerController.text.trim(),
        timeSpentSeconds: question.timeSpentSeconds,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _autosave = 'Cevap kaydedildi';
      });
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleFlag() async {
    final session = _session;
    final question = _question;
    if (session == null || question == null) return;
    try {
      setState(() => _autosave = 'İşaret kaydediliyor...');
      final updated = await SolutionSessionApiService.instance.saveFlag(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        isFlagged: !question.isFlagged,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _autosave = 'İşaret kaydedildi';
      });
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _saveNote() async {
    final session = _session;
    final question = _question;
    if (session == null || question == null) return;
    try {
      setState(() => _autosave = 'Not kaydediliyor...');
      final updated = await SolutionSessionApiService.instance.saveNote(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        note: _noteController.text,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
        _autosave = 'Not kaydedildi';
      });
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _saveStroke(Map<String, dynamic> stroke) async {
    final session = _session;
    final question = _question;
    if (session == null || question == null) return;
    try {
      setState(() => _autosave = 'Çizim kaydediliyor...');
      await SolutionSessionApiService.instance.saveStroke(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        stroke: stroke,
      );
      if (mounted) setState(() => _autosave = 'Çizim kaydedildi');
    } catch (_) {
      if (mounted) setState(() => _autosave = 'Çizim çevrimdışı kuyrukta');
    }
  }

  Future<void> _saveSnapshot(String dataUrl) async {
    final session = _session;
    final question = _question;
    if (session == null || question == null) return;
    try {
      await SolutionSessionApiService.instance.saveSnapshot(
        sessionId: session.id,
        questionAttemptId: question.attemptId,
        dataUrl: dataUrl,
      );
      final updated = await SolutionSessionApiService.instance.getSession(
        session.id,
      );
      if (mounted) setState(() => _session = updated);
    } catch (_) {
      if (mounted) {
        setState(() => _autosave = 'Snapshot daha sonra eşitlenecek');
      }
    }
  }

  Future<void> _finishExam() async {
    final session = _session;
    if (session == null || _saving) return;
    _timer?.cancel();
    setState(() => _saving = true);
    try {
      final summary = await SolutionSessionApiService.instance.complete(
        session.id,
      );
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _saving = false;
      });
      _showCompletionSheet();
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      _showSnack(error.toString());
      _startTimer();
    }
  }

  String _formatTime(int seconds) {
    final min = seconds ~/ 60;
    final sec = seconds % 60;
    return '${min.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  Future<void> _openPdf(PdfReportRecord? report) async {
    final url = ApiConfig.resolveAssetUrl(report?.downloadUrl);
    if (url.isEmpty) {
      _showSnack('PDF raporu henüz hazır değil.');
      return;
    }
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened) _showSnack('PDF raporu açılamadı.');
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _showCompletionSheet() {
    final summary = _summary;
    if (summary == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Color(0xFF08111F),
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(height: 24),
                const Icon(
                  Icons.check_circle_rounded,
                  size: 64,
                  color: Color(0xFF34D399),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Sınav tamamlandı',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  'Doğru: ${summary.correct} • Yanlış: ${summary.wrong} • Boş: ${summary.empty} • Başarı: %${summary.successPercent}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: summary.report?.downloadUrl == null
                      ? null
                      : () => _openPdf(summary.report),
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: Text(
                    summary.report?.downloadUrl == null
                        ? 'PDF hazırlanıyor'
                        : 'PDF raporu hazır',
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      Navigator.popUntil(context, (route) => route.isFirst),
                  child: const Text('Ana sayfaya dön'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF050B16),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF8A1C),
          secondary: Color(0xFF7C3AED),
          surface: Color(0xFF081426),
        ),
      ),
      child: Scaffold(
        body: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
              ? _ErrorState(message: _error!, onRetry: _startSession)
              : _buildContent(context),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    final session = _session!;
    final question = _question!;
    final size = MediaQuery.sizeOf(context);
    final isTablet = size.width >= 760;
    final answered = session.questions
        .where((item) => item.answer != null)
        .length;
    final progress = session.questions.isEmpty
        ? 0.0
        : answered / session.questions.length;

    return Column(
      children: [
        _TopBar(
          title: session.title,
          remaining: _formatTime(_remainingSeconds),
          current: _currentIndex + 1,
          total: session.questions.length,
          onBack: () => Navigator.pop(context),
          onFlag: _toggleFlag,
          isFlagged: question.isFlagged,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _ProgressHeader(
            progress: progress,
            subject: session.subject,
            topic: question.topic,
            autosave: _autosave,
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: isTablet
              ? Row(
                  children: [
                    Expanded(child: _questionPane(question, isTablet: true)),
                    Expanded(child: _canvasPane()),
                  ],
                )
              : DefaultTabController(
                  length: 2,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const TabBar(
                            indicatorSize: TabBarIndicatorSize.tab,
                            dividerColor: Colors.transparent,
                            tabs: [
                              Tab(text: 'Soru'),
                              Tab(text: 'Çözüm Kağıdı'),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: TabBarView(
                          children: [_questionPane(question), _canvasPane()],
                        ),
                      ),
                    ],
                  ),
                ),
        ),
        _BottomNav(
          current: _currentIndex + 1,
          total: session.questions.length,
          saving: _saving,
          onPrevious: _currentIndex == 0
              ? null
              : () => _setQuestionIndex(_currentIndex - 1),
          onNext: _currentIndex >= session.questions.length - 1
              ? _finishExam
              : () => _setQuestionIndex(_currentIndex + 1),
          onList: _openQuestionList,
        ),
      ],
    );
  }

  Widget _questionPane(
    SolutionQuestionRecord question, {
    bool isTablet = false,
  }) {
    final imageUrl = ApiConfig.resolveAssetUrl(question.imagePath);
    return ListView(
      padding: EdgeInsets.fromLTRB(16, 8, isTablet ? 8 : 16, 24),
      children: [
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Tag(
                    label: question.difficulty,
                    color: const Color(0xFFFF8A1C),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${question.subject} / ${question.topic}',
                      style: const TextStyle(color: Colors.white54),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                '${_currentIndex + 1}.',
                style: const TextStyle(
                  color: Color(0xFFFF8A1C),
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                question.questionText,
                style: const TextStyle(
                  fontSize: 18,
                  height: 1.45,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (imageUrl.isNotEmpty) ...[
                const SizedBox(height: 18),
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => Container(
                      height: 180,
                      alignment: Alignment.center,
                      color: Colors.white.withValues(alpha: 0.05),
                      child: const Text('Görsel yüklenemedi'),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (question.options.isNotEmpty)
          ...List.generate(question.options.length, (index) {
            final selected = question.answer?.selectedOptionIndex == index;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _OptionButton(
                label: String.fromCharCode(65 + index),
                text: question.options[index],
                selected: selected,
                onTap: _saving ? null : () => _selectAnswer(index),
              ),
            );
          })
        else
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Cevabın',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _answerController,
                  minLines: 3,
                  maxLines: 6,
                  decoration: InputDecoration(
                    hintText: 'Cevabını buraya yaz...',
                    filled: true,
                    fillColor: Colors.black.withValues(alpha: 0.22),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _saveOpenAnswer,
                    icon: const Icon(Icons.save_rounded, size: 18),
                    label: const Text('Cevabı Kaydet'),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Not Defteri',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _noteController,
                minLines: 3,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: 'Bu soru için notunu yaz...',
                  filled: true,
                  fillColor: Colors.black.withValues(alpha: 0.22),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  onPressed: _saveNote,
                  icon: const Icon(Icons.save_rounded, size: 18),
                  label: const Text('Notu Kaydet'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _canvasPane() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 24),
      child: SolutionDrawingCanvas(
        key: ValueKey(_question?.attemptId),
        initialSnapshotUrl: ApiConfig.resolveAssetUrl(_question?.snapshotUrl),
        onStrokeSaved: _saveStroke,
        onSnapshotSaved: _saveSnapshot,
      ),
    );
  }

  void _openQuestionList() {
    final session = _session;
    if (session == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Color(0xFF08111F),
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Soru Listesi',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 18),
              GridView.builder(
                shrinkWrap: true,
                itemCount: session.questions.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 5,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                ),
                itemBuilder: (context, index) {
                  final item = session.questions[index];
                  final active = index == _currentIndex;
                  final answered = item.answer != null;
                  return GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      _setQuestionIndex(index);
                    },
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: active
                            ? const Color(0xFFFF8A1C).withValues(alpha: 0.22)
                            : answered
                            ? const Color(0xFF34D399).withValues(alpha: 0.16)
                            : Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: active
                              ? const Color(0xFFFF8A1C)
                              : Colors.white.withValues(alpha: 0.10),
                        ),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final String title;
  final String remaining;
  final int current;
  final int total;
  final VoidCallback onBack;
  final VoidCallback onFlag;
  final bool isFlagged;

  const _TopBar({
    required this.title,
    required this.remaining,
    required this.current,
    required this.total,
    required this.onBack,
    required this.onFlag,
    required this.isFlagged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      child: Row(
        children: [
          IconButton.filledTonal(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  '$remaining • $current / $total soru',
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton.filledTonal(
            onPressed: onFlag,
            icon: Icon(
              isFlagged
                  ? Icons.bookmark_rounded
                  : Icons.bookmark_border_rounded,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  final double progress;
  final String subject;
  final String topic;
  final String autosave;

  const _ProgressHeader({
    required this.progress,
    required this.subject,
    required this.topic,
    required this.autosave,
  });

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFFF8A1C), width: 4),
                ),
                child: Text(
                  '%${(progress * 100).round()}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$subject · $topic',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        color: const Color(0xFFFF8A1C),
                        backgroundColor: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                autosave,
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int current;
  final int total;
  final bool saving;
  final VoidCallback? onPrevious;
  final VoidCallback onNext;
  final VoidCallback onList;

  const _BottomNav({
    required this.current,
    required this.total,
    required this.saving,
    required this.onPrevious,
    required this.onNext,
    required this.onList,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
      decoration: BoxDecoration(
        color: const Color(0xFF07111F).withValues(alpha: 0.94),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: saving ? null : onPrevious,
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Önceki'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: FloatingActionButton.small(
                heroTag: 'question-list',
                onPressed: onList,
                backgroundColor: const Color(0xFFFF8A1C),
                child: Text('$current/$total'),
              ),
            ),
            Expanded(
              child: FilledButton.icon(
                onPressed: saving ? null : onNext,
                icon: Icon(
                  current == total
                      ? Icons.done_all_rounded
                      : Icons.arrow_forward_rounded,
                ),
                label: Text(current == total ? 'Bitir' : 'Sonraki'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionButton extends StatelessWidget {
  final String label;
  final String text;
  final bool selected;
  final VoidCallback? onTap;

  const _OptionButton({
    required this.label,
    required this.text,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFFFF8A1C).withValues(alpha: 0.18)
              : Colors.white.withValues(alpha: 0.045),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? const Color(0xFFFF8A1C)
                : Colors.white.withValues(alpha: 0.10),
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: selected
                  ? const Color(0xFFFF8A1C)
                  : Colors.white10,
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const _GlassCard({
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.075),
            Colors.white.withValues(alpha: 0.035),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: child,
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;

  const _Tag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w900,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: _GlassCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 12),
              const Text(
                'Çözüm ekranı açılamadı',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Tekrar Dene'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
