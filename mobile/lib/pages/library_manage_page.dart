import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:student/services/admin_directory_api_service.dart';
import 'package:student/services/library_api_service.dart';

const _navy = Color(0xFF15294B);
const _orange = Color(0xFFF7941D);

/// İdari personel/yönetici kütüphane yönetimi: katalog, barkod (ISBN)
/// taramayla kitap ekleme, ödünç verme ve iade alma.
class LibraryManagePage extends StatefulWidget {
  const LibraryManagePage({super.key});

  @override
  State<LibraryManagePage> createState() => _LibraryManagePageState();
}

class _LibraryManagePageState extends State<LibraryManagePage> {
  int section = 0; // 0: Katalog, 1: Ödünç
  List<Map<String, dynamic>> books = [];
  List<Map<String, dynamic>> loans = [];
  List<Map<String, dynamic>> students = [];
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
      final loanList = await LibraryApiService.instance.fetchLoans();
      List<Map<String, dynamic>> studentList = const [];
      try {
        final records = await AdminDirectoryApiService.instance.fetchStudents();
        studentList = records
            .map((s) => {'fullName': s.fullName, 'className': s.className})
            .toList();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        books = bookList;
        loans = loanList;
        students = studentList;
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
            || (b['author'] as String? ?? '').toLowerCase().contains(q)
            || (b['isbn'] as String? ?? '').contains(search);
      }).toList();

  List<Map<String, dynamic>> get activeLoans =>
      loans.where((l) => l['returnedAtUtc'] == null).toList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Kütüphane',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Hatırlatma gönder',
            onPressed: () async {
              try {
                final result = await LibraryApiService.instance.sendReminders();
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(
                        '${result['notified'] ?? 0} ödünç için bildirim gönderildi.')));
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(e.toString())));
              }
            },
            icon: const Icon(Icons.notifications_active_outlined),
          ),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      floatingActionButton: section == 0
          ? FloatingActionButton.extended(
              onPressed: () => _openBookSheet(),
              backgroundColor: _orange,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Kitap Ekle'),
            )
          : null,
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
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: Row(
                        children: [
                          for (final entry in const [(0, 'Katalog'), (1, 'Ödünç Takibi')])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(entry.$1 == 1
                                    ? 'Ödünç Takibi (${activeLoans.length})'
                                    : entry.$2),
                                selected: section == entry.$1,
                                selectedColor: _navy,
                                labelStyle: TextStyle(
                                  color: section == entry.$1
                                      ? Colors.white
                                      : theme.textTheme.bodyMedium?.color,
                                  fontWeight: FontWeight.w700,
                                ),
                                onSelected: (_) =>
                                    setState(() => section = entry.$1),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _load,
                        child: section == 0
                            ? _catalogList(theme, isDark)
                            : _loansList(theme, isDark),
                      ),
                    ),
                  ],
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

  Widget _catalogList(ThemeData theme, bool isDark) {
    final items = filteredBooks;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      children: [
        TextField(
          onChanged: (v) => setState(() => search = v),
          decoration: InputDecoration(
            hintText: 'Kitap, yazar veya ISBN ara...',
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
        const SizedBox(height: 12),
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: Text(
                books.isEmpty
                    ? 'Katalog boş. Sağ alttan kitap ekleyin.'
                    : 'Aramaya uyan kitap yok.',
                style: theme.textTheme.bodyMedium,
              ),
            ),
          )
        else
          ...items.map((book) {
            final available = (book['availableCopies'] as num?)?.toInt() ?? 0;
            final total = (book['totalCopies'] as num?)?.toInt() ?? 1;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: _cardDecoration(theme, isDark),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_navy, Color(0xFF1E3A66)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        (book['title'] as String? ?? '?')
                            .split(' ')
                            .take(2)
                            .map((p) => p.isEmpty ? '' : p[0])
                            .join()
                            .toUpperCase(),
                        style: const TextStyle(
                            color: _orange,
                            fontWeight: FontWeight.w900,
                            fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(book['title'] as String? ?? '',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800),
                            overflow: TextOverflow.ellipsis),
                        Text(
                          [
                            book['author'],
                            book['category'],
                            if ((book['shelf'] as String? ?? '').isNotEmpty)
                              'Raf ${book['shelf']}',
                          ].where((e) => (e as String? ?? '').isNotEmpty).join(' • '),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.hintColor),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$available/$total müsait',
                          style: TextStyle(
                            color: available > 0
                                ? const Color(0xFF22C55E)
                                : const Color(0xFFEF4444),
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: available > 0 ? _orange : theme.disabledColor,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                    onPressed:
                        available > 0 ? () => _openCheckoutSheet(book) : null,
                    child: const Text('Ödünç Ver'),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _loansList(ThemeData theme, bool isDark) {
    final items = activeLoans;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Center(
                child: Text('Dışarıda kitap yok.',
                    style: theme.textTheme.bodyMedium)),
          )
        else
          ...items.map((loan) {
            final overdue = loan['overdue'] == true;
            final due = DateTime.tryParse(loan['dueAtUtc']?.toString() ?? '');
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: _cardDecoration(theme, isDark),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(loan['bookTitle'] as String? ?? '',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800),
                            overflow: TextOverflow.ellipsis),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (overdue
                                  ? const Color(0xFFEF4444)
                                  : const Color(0xFF22C55E))
                              .withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          overdue
                              ? '${loan['overdueDays']} gün gecikti'
                              : due == null
                                  ? '—'
                                  : 'Son: ${due.day}.${due.month}',
                          style: TextStyle(
                            color: overdue
                                ? const Color(0xFFEF4444)
                                : const Color(0xFF22C55E),
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${loan['studentName']}${(loan['className'] as String? ?? '').isNotEmpty ? ' (${loan['className']})' : ''}',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.hintColor),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: _navy),
                          onPressed: () async {
                            try {
                              final result = await LibraryApiService.instance
                                  .returnLoan(loan['id'].toString());
                              if (!mounted) return;
                              final fine =
                                  (result['fineAmount'] as num?)?.toDouble() ?? 0;
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                  content: Text(fine > 0
                                      ? 'İade alındı — ceza ₺$fine'
                                      : 'İade alındı.')));
                              _load();
                            } catch (e) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString())));
                            }
                          },
                          child: const Text('İade Al'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            try {
                              await LibraryApiService.instance
                                  .extendLoan(loan['id'].toString());
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text('Süre uzatıldı.')));
                              _load();
                            } catch (e) {
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString())));
                            }
                          },
                          child: const Text('Uzat'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  // ── ISBN barkod tarama ──────────────────────────────────────────────
  Future<String?> _scanIsbn() async {
    return Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const _IsbnScanPage()),
    );
  }

  // ── Kitap ekleme sheet'i ────────────────────────────────────────────
  void _openBookSheet() {
    final title = TextEditingController();
    final author = TextEditingController();
    final publisher = TextEditingController();
    final isbn = TextEditingController();
    final category = TextEditingController();
    final shelf = TextEditingController();
    int copies = 1;
    bool lookupBusy = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          Future<void> runLookup(String value) async {
            if (value.trim().length < 9) return;
            setSheetState(() => lookupBusy = true);
            try {
              final result =
                  await LibraryApiService.instance.lookupIsbn(value.trim());
              if (result['found'] == true) {
                title.text = (result['title'] as String?) ?? title.text;
                author.text = (result['author'] as String?) ?? author.text;
                publisher.text =
                    (result['publisher'] as String?) ?? publisher.text;
              }
            } catch (_) {}
            setSheetState(() => lookupBusy = false);
          }

          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Kitap Ekle',
                      style: TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 16)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: isbn,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'ISBN',
                            suffixIcon: lookupBusy
                                ? const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2)),
                                  )
                                : null,
                          ),
                          onSubmitted: runLookup,
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: _navy),
                        onPressed: () async {
                          final scanned = await _scanIsbn();
                          if (scanned != null && scanned.isNotEmpty) {
                            isbn.text = scanned;
                            await runLookup(scanned);
                          }
                        },
                        icon: const Icon(Icons.qr_code_scanner_rounded,
                            size: 18),
                        label: const Text('Tara'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                      controller: title,
                      decoration:
                          const InputDecoration(labelText: 'Kitap adı *')),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                            controller: author,
                            decoration:
                                const InputDecoration(labelText: 'Yazar')),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                            controller: publisher,
                            decoration:
                                const InputDecoration(labelText: 'Yayınevi')),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                            controller: category,
                            decoration:
                                const InputDecoration(labelText: 'Kategori')),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                            controller: shelf,
                            decoration:
                                const InputDecoration(labelText: 'Raf')),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        width: 96,
                        child: DropdownButtonFormField<int>(
                          initialValue: copies,
                          decoration:
                              const InputDecoration(labelText: 'Kopya'),
                          items: List.generate(10, (i) => i + 1)
                              .map((n) => DropdownMenuItem(
                                  value: n, child: Text('$n')))
                              .toList(),
                          onChanged: (v) =>
                              setSheetState(() => copies = v ?? 1),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: _orange),
                      onPressed: () async {
                        if (title.text.trim().isEmpty) return;
                        try {
                          await LibraryApiService.instance.createBook({
                            'title': title.text.trim(),
                            'author': author.text.trim(),
                            'publisher': publisher.text.trim(),
                            'isbn': isbn.text.trim(),
                            'category': category.text.trim(),
                            'shelf': shelf.text.trim(),
                            'totalCopies': copies,
                          });
                          if (!sheetContext.mounted) return;
                          Navigator.pop(sheetContext);
                          _load();
                        } catch (e) {
                          if (!sheetContext.mounted) return;
                          ScaffoldMessenger.of(sheetContext).showSnackBar(
                              SnackBar(content: Text(e.toString())));
                        }
                      },
                      child: const Text('Kaydet'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Ödünç verme sheet'i ─────────────────────────────────────────────
  void _openCheckoutSheet(Map<String, dynamic> book) {
    String query = '';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final matches = students.where((s) {
            if (query.isEmpty) return true;
            return (s['fullName'] as String? ?? '')
                .toLowerCase()
                .contains(query.toLowerCase());
          }).take(30).toList();

          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            child: SizedBox(
              height: MediaQuery.of(sheetContext).size.height * 0.6,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ödünç Ver — ${book['title']}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 16),
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (v) => setSheetState(() => query = v),
                    decoration: const InputDecoration(
                      hintText: 'Öğrenci ara...',
                      prefixIcon: Icon(Icons.search_rounded, size: 20),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: ListView.builder(
                      itemCount: matches.length,
                      itemBuilder: (_, index) {
                        final student = matches[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: _navy,
                            child: Text(
                              (student['fullName'] as String? ?? '?')
                                  .split(' ')
                                  .take(2)
                                  .map((p) => p.isEmpty ? '' : p[0])
                                  .join()
                                  .toUpperCase(),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13),
                            ),
                          ),
                          title: Text(student['fullName'] as String? ?? '',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700)),
                          subtitle:
                              Text(student['className'] as String? ?? ''),
                          onTap: () async {
                            try {
                              await LibraryApiService.instance.checkout(
                                bookId: book['id'].toString(),
                                studentName:
                                    student['fullName'] as String? ?? '',
                                className:
                                    student['className'] as String? ?? '',
                              );
                              if (!sheetContext.mounted) return;
                              ScaffoldMessenger.of(sheetContext).showSnackBar(
                                  SnackBar(
                                      content: Text(
                                          '${book['title']} → ${student['fullName']}')));
                              Navigator.pop(sheetContext);
                              _load();
                            } catch (e) {
                              if (!sheetContext.mounted) return;
                              ScaffoldMessenger.of(sheetContext).showSnackBar(
                                  SnackBar(content: Text(e.toString())));
                            }
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Basit ISBN barkod tarayıcı: ilk okunan barkodu döndürür.
class _IsbnScanPage extends StatefulWidget {
  const _IsbnScanPage();

  @override
  State<_IsbnScanPage> createState() => _IsbnScanPageState();
}

class _IsbnScanPageState extends State<_IsbnScanPage> {
  final MobileScannerController controller = MobileScannerController();
  bool handled = false;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (handled) return;
    final value = capture.barcodes
        .map((b) => b.rawValue ?? '')
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');
    if (value.isEmpty) return;
    handled = true;
    Navigator.pop(context, value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ISBN Barkodu Tara')),
      body: Stack(
        children: [
          MobileScanner(controller: controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 260,
              height: 140,
              decoration: BoxDecoration(
                border: Border.all(color: _orange, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
