import 'package:flutter/material.dart';
import 'package:student/services/library_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

/// Veli kütüphane ekranı: çocukların üzerindeki kitaplar, iade tarihleri
/// ve okuma sayısı.
class VeliLibraryPage extends StatefulWidget {
  const VeliLibraryPage({super.key});

  @override
  State<VeliLibraryPage> createState() => _VeliLibraryPageState();
}

class _VeliLibraryPageState extends State<VeliLibraryPage> {
  List<Map<String, dynamic>> children = [];
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
      final list = await LibraryApiService.instance.fetchParentChildren();
      if (!mounted) return;
      setState(() {
        children = list;
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

  String _formatDate(dynamic value) {
    final d = DateTime.tryParse(value?.toString() ?? '');
    if (d == null) return '—';
    return '${d.day}.${d.month}.${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Kütüphane',
            style: TextStyle(fontWeight: FontWeight.w800)),
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
                  child: children.isEmpty
                      ? ListView(
                          children: const [
                            Padding(
                              padding: EdgeInsets.all(48),
                              child: Center(
                                  child: Text('Bağlı öğrenci bulunamadı.')),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                          children: children.map((child) {
                            final loans = ((child['activeLoans']
                                        as List<dynamic>?) ??
                                    const [])
                                .whereType<Map<String, dynamic>>()
                                .toList();
                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: theme.cardColor,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(
                                        alpha: isDark ? 0.18 : 0.05),
                                    blurRadius: 10,
                                    offset: const Offset(0, 5),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      CircleAvatar(
                                        backgroundColor: _navy,
                                        child: Text(
                                          (child['studentName'] as String? ??
                                                  '?')
                                              .split(' ')
                                              .take(2)
                                              .map((p) =>
                                                  p.isEmpty ? '' : p[0])
                                              .join()
                                              .toUpperCase(),
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 13),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                                child['studentName']
                                                        as String? ??
                                                    '',
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w800)),
                                            Text(
                                              '${child['className'] ?? ''} • ${child['readCount'] ?? 0} kitap okudu',
                                              style: theme.textTheme.bodySmall
                                                  ?.copyWith(
                                                      color: theme.hintColor),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.auto_stories_rounded,
                                          color: _orange),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  if (loans.isEmpty)
                                    Text('Üzerinde kitap yok.',
                                        style: theme.textTheme.bodySmall)
                                  else
                                    ...loans.map((loan) {
                                      final overdue = loan['overdue'] == true;
                                      return Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 4),
                                        child: Row(
                                          children: [
                                            Icon(Icons.menu_book_rounded,
                                                size: 18,
                                                color: overdue
                                                    ? const Color(0xFFEF4444)
                                                    : _orange),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                  loan['bookTitle']
                                                          as String? ??
                                                      '',
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600),
                                                  overflow:
                                                      TextOverflow.ellipsis),
                                            ),
                                            Text(
                                              overdue
                                                  ? 'Gecikti!'
                                                  : _formatDate(
                                                      loan['dueAtUtc']),
                                              style: TextStyle(
                                                color: overdue
                                                    ? const Color(0xFFEF4444)
                                                    : const Color(0xFF22C55E),
                                                fontWeight: FontWeight.w800,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                ),
    );
  }
}
