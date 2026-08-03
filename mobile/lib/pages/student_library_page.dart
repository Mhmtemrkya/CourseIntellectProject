import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/services/library_api_service.dart';
import 'package:student/utils/format.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

/// Öğrenci kütüphanesi: üzerimdeki kitaplar, rezervasyonlar, öneriler ve
/// katalogda arama + kitap ayırtma.
class StudentLibraryPage extends StatefulWidget {
  const StudentLibraryPage({super.key});

  @override
  State<StudentLibraryPage> createState() => _StudentLibraryPageState();
}

class _StudentLibraryPageState extends State<StudentLibraryPage> {
  Map<String, dynamic>? my;
  List<Map<String, dynamic>> books = [];
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
      final myData = await LibraryApiService.instance.fetchMy();
      final bookList = await LibraryApiService.instance.fetchBooks();
      if (!mounted) return;
      setState(() {
        my = myData;
        books = bookList;
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
      ((my?[key] as List<dynamic>?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

  List<Map<String, dynamic>> get filteredBooks => books.where((b) {
        if (search.isEmpty) return true;
        final q = search.toLowerCase();
        return (b['title'] as String? ?? '').toLowerCase().contains(q)
            || (b['author'] as String? ?? '').toLowerCase().contains(q);
      }).toList();

  // Tarih biçimi ortak `utils/format.dart`'tan gelir (02.08.2026).
  String _formatDate(dynamic value) => formatDate(value);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final activeLoans = _list('activeLoans');
    final reservations = _list('reservations');
    final recommendations = _list('recommendations');

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Kütüphane'.tr,
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
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      // Okuma karnesi
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [_navy, Color(0xFF1E3A66)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.auto_stories_rounded,
                                color: _orange, size: 38),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${my?['readCount'] ?? 0} kitap okudun 🎉',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 17),
                                  ),
                                  Text(
                                    '${activeLoans.length} kitap üzerinde • ${reservations.length} rezervasyon',
                                    style: TextStyle(
                                        color:
                                            Colors.white.withValues(alpha: 0.75),
                                        fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      if (activeLoans.isNotEmpty) ...[
                        Text('Üzerimdeki Kitaplar'.tr,
                            style: TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        ...activeLoans.map((loan) {
                          final overdue = loan['overdue'] == true;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(14),
                            decoration: _cardDecoration(theme, isDark),
                            child: Row(
                              children: [
                                Icon(Icons.menu_book_rounded,
                                    color: overdue
                                        ? const Color(0xFFEF4444)
                                        : _orange,
                                    size: 22),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                      loan['bookTitle'] as String? ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w800),
                                      overflow: TextOverflow.ellipsis),
                                ),
                                Text(
                                  overdue
                                      ? 'Gecikti!'
                                      : 'İade: ${_formatDate(loan['dueAtUtc'])}',
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
                        const SizedBox(height: 10),
                      ],

                      if (reservations.isNotEmpty) ...[
                        Text('Rezervasyonlarım'.tr,
                            style: TextStyle(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        ...reservations.map((r) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(14),
                              decoration: _cardDecoration(theme, isDark),
                              child: Row(
                                children: [
                                  const Icon(Icons.bookmark_rounded,
                                      color: _orange, size: 22),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(r['bookTitle'] as String? ?? '',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800),
                                            overflow: TextOverflow.ellipsis),
                                        Text(
                                          r['status'] == 'Hazır'
                                              ? 'Hazır — kütüphaneden alabilirsin!'
                                              : 'Sırada ${r['queuePosition']}. konumdasın',
                                          style: TextStyle(
                                            color: r['status'] == 'Hazır'
                                                ? const Color(0xFF22C55E)
                                                : theme.hintColor,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () async {
                                      await LibraryApiService.instance
                                          .cancelReservation(
                                              r['id'].toString());
                                      _load();
                                    },
                                    icon: const Icon(Icons.close_rounded,
                                        size: 20, color: Colors.redAccent),
                                  ),
                                ],
                              ),
                            )),
                        const SizedBox(height: 10),
                      ],

                      if (recommendations.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: _orange.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                                color: _orange.withValues(alpha: 0.4)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.star_rounded,
                                      color: _orange, size: 20),
                                  SizedBox(width: 8),
                                  Text('Öğretmenlerin Önerdi'.tr,
                                      style: TextStyle(
                                          fontWeight: FontWeight.w800)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ...recommendations.take(5).map((rec) => Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 4),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                            rec['bookTitle'] as String? ?? '',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w700)),
                                        Text(
                                          '${rec['teacherName']}${(rec['note'] as String? ?? '').isNotEmpty ? ' — "${rec['note']}"' : ''}',
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                                  color: theme.hintColor),
                                        ),
                                      ],
                                    ),
                                  )),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Katalog
                      const Text('Katalog',
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
                      ...filteredBooks.take(50).map((book) {
                        final available =
                            (book['availableCopies'] as num?)?.toInt() ?? 0;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(14),
                          decoration: _cardDecoration(theme, isDark),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(book['title'] as String? ?? '',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800),
                                        overflow: TextOverflow.ellipsis),
                                    Text(
                                      [
                                        book['author'],
                                        book['category'],
                                      ]
                                          .where((e) =>
                                              (e as String? ?? '').isNotEmpty)
                                          .join(' • '),
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(color: theme.hintColor),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              if (available > 0)
                                Text('$available müsait',
                                    style: const TextStyle(
                                        color: Color(0xFF22C55E),
                                        fontWeight: FontWeight.w800,
                                        fontSize: 12))
                              else
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                      foregroundColor: _orange),
                                  onPressed: () async {
                                    try {
                                      final result = await LibraryApiService
                                          .instance
                                          .reserve(book['id'].toString());
                                      if (!context.mounted) return;
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                              content: Text(
                                                  'Ayırtıldı — sıradaki konumun: ${result['queuePosition'] ?? 1}')));
                                      _load();
                                    } catch (e) {
                                      if (!context.mounted) return;
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                              content: Text(e.toString())));
                                    }
                                  },
                                  child: Text('Ayırt'.tr),
                                ),
                            ],
                          ),
                        );
                      }),
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
}
