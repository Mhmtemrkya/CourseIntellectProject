import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/services/library_api_service.dart';
import 'package:student/services/student_registry_store.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

/// Öğretmen/rehber kütüphane ekranı: katalogda arama ve öğrenciye/sınıfa
/// kitap önerme; gönderilen öneriler listesi.
class TeacherLibraryPage extends StatefulWidget {
  const TeacherLibraryPage({super.key});

  @override
  State<TeacherLibraryPage> createState() => _TeacherLibraryPageState();
}

class _TeacherLibraryPageState extends State<TeacherLibraryPage> {
  List<Map<String, dynamic>> books = [];
  List<Map<String, dynamic>> recommendations = [];
  List<String> classes = [];
  List<String> studentNames = [];
  bool loading = true;
  String? error;
  String search = '';

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
      final bookList = await LibraryApiService.instance.fetchBooks();
      final recList = await LibraryApiService.instance
          .fetchRecommendations()
          .catchError((_) => <Map<String, dynamic>>[]);
      try {
        await StudentRegistryStore.instance.ensureLoaded();
        final students = StudentRegistryStore.instance.students;
        studentNames = students.map((s) => s.fullName).toSet().toList()..sort();
        classes = students
            .map((s) => s.className)
            .where((c) => c.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        books = bookList;
        recommendations = recList;
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

  List<Map<String, dynamic>> get filteredBooks => books.where((b) {
        if (search.isEmpty) return true;
        final q = search.toLowerCase();
        return (b['title'] as String? ?? '').toLowerCase().contains(q)
            || (b['author'] as String? ?? '').toLowerCase().contains(q);
      }).toList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Kütüphane'.tr,
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(
                            onPressed: _load, child: const Text('Tekrar Dene')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      if (recommendations.isNotEmpty) ...[
                        Text('Gönderdiğim Öneriler'.tr,
                            style: TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        ...recommendations.take(5).map((rec) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: _cardDecoration(theme, isDark),
                              child: Row(
                                children: [
                                  const Icon(Icons.star_rounded,
                                      color: _orange, size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                            rec['bookTitle'] as String? ?? '',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800),
                                            overflow: TextOverflow.ellipsis),
                                        Text(
                                          ((rec['studentName'] as String? ??
                                                          '')
                                                      .isNotEmpty
                                                  ? rec['studentName']
                                                  : rec['className'])
                                              .toString(),
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                                  color: theme.hintColor),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            )),
                        const SizedBox(height: 10),
                      ],
                      Text('Katalog — önermek için kitaba dokun'.tr,
                          style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      TextField(
                        onChanged: (v) => setState(() => search = v),
                        decoration: InputDecoration(
                          hintText: 'Kitap veya yazar ara...'.tr,
                          prefixIcon:
                              const Icon(Icons.search_rounded, size: 20),
                          filled: true,
                          fillColor: theme.cardColor,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (filteredBooks.isEmpty)
                        Padding(
                          padding: const EdgeInsets.all(32),
                          child: Center(
                              child: Text('Kitap bulunamadı.'.tr,
                                  style: theme.textTheme.bodyMedium)),
                        )
                      else
                        ...filteredBooks.take(60).map((book) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: _cardDecoration(theme, isDark),
                              child: ListTile(
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(18)),
                                title: Text(book['title'] as String? ?? '',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800)),
                                subtitle: Text(
                                  [
                                    book['author'],
                                    book['category'],
                                  ]
                                      .where((e) =>
                                          (e as String? ?? '').isNotEmpty)
                                      .join(' • '),
                                  style: theme.textTheme.bodySmall,
                                ),
                                trailing: const Icon(
                                    Icons.recommend_rounded,
                                    color: _orange),
                                onTap: () => _openRecommendSheet(book),
                              ),
                            )),
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

  void _openRecommendSheet(Map<String, dynamic> book) {
    String target = 'class';
    String? className = classes.isNotEmpty ? classes.first : null;
    String? studentName;
    final note = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Öner — ${book['title']}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 16),
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: Text('Sınıfa'.tr),
                      selected: target == 'class',
                      selectedColor: _navy,
                      labelStyle: TextStyle(
                          color: target == 'class' ? Colors.white : null,
                          fontWeight: FontWeight.w700),
                      onSelected: (_) =>
                          setSheetState(() => target = 'class'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: Text('Öğrenciye'.tr),
                      selected: target == 'student',
                      selectedColor: _navy,
                      labelStyle: TextStyle(
                          color: target == 'student' ? Colors.white : null,
                          fontWeight: FontWeight.w700),
                      onSelected: (_) =>
                          setSheetState(() => target = 'student'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (target == 'class')
                DropdownButtonFormField<String>(
                  initialValue: className,
                  decoration: InputDecoration(labelText: 'Sınıf'.tr),
                  items: classes
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setSheetState(() => className = v),
                )
              else
                DropdownButtonFormField<String>(
                  initialValue: studentName,
                  decoration: InputDecoration(labelText: 'Öğrenci'.tr),
                  items: studentNames
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setSheetState(() => studentName = v),
                ),
              const SizedBox(height: 10),
              TextField(
                controller: note,
                maxLines: 2,
                decoration: const InputDecoration(
                    labelText: 'Not (opsiyonel)',
                    hintText: 'Neden bu kitap?'),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: _orange),
                  onPressed: () async {
                    final valid = target == 'class'
                        ? (className ?? '').isNotEmpty
                        : (studentName ?? '').isNotEmpty;
                    if (!valid) return;
                    try {
                      await LibraryApiService.instance.recommend({
                        'bookId': book['id'].toString(),
                        'studentName':
                            target == 'student' ? studentName : '',
                        'className': target == 'class' ? className : '',
                        'note': note.text.trim(),
                      });
                      if (!sheetContext.mounted) return;
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                          SnackBar(
                              content: Text('Öneri gönderildi.'.tr)));
                      Navigator.pop(sheetContext);
                      _load();
                    } catch (e) {
                      if (!sheetContext.mounted) return;
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                          SnackBar(content: Text(e.toString())));
                    }
                  },
                  child: Text('Gönder'.tr),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
