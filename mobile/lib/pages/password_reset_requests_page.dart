import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/auth_api_service.dart';
import '../widgets/admin_ui.dart';

class PasswordResetRequestsPage extends StatefulWidget {
  const PasswordResetRequestsPage({super.key});

  @override
  State<PasswordResetRequestsPage> createState() =>
      _PasswordResetRequestsPageState();
}

class _PasswordResetRequestsPageState extends State<PasswordResetRequestsPage> {
  String _status = 'Pending';
  bool _loading = true;
  String _error = '';
  List<PasswordResetRequestRecord> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final records = await AuthApiService.instance.fetchPasswordResetRequests(
        status: _status,
      );
      if (!mounted) return;
      setState(() => _items = records);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Şifre talepleri alınamadı.');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _review(
    PasswordResetRequestRecord request,
    bool approved,
  ) async {
    final noteController = TextEditingController();
    final confirm = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 8,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminAccentBadge(
                  label: approved ? 'Onay' : 'Ret',
                  color: approved
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                ),
                const SizedBox(height: 12),
                Text(
                  approved ? 'Geçici Şifre Üret' : 'Talebi Reddet',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${request.fullName} için şifre sıfırlama talebini sonuçlandırın.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: noteController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: 'Not (isteğe bağlı)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(sheetContext, true),
                    child: Text(
                      approved ? 'Onayla ve Şifre Üret' : 'Talebi Reddet',
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirm != true) {
      noteController.dispose();
      return;
    }

    try {
      final result = await AuthApiService.instance.reviewPasswordResetRequest(
        id: request.id,
        approved: approved,
        note: noteController.text,
      );
      noteController.dispose();
      await _load();
      if (!mounted) return;
      if (result.temporaryPassword.isNotEmpty) {
        await _showTemporaryPassword(result);
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(result.message)));
      }
    } on AuthApiException catch (error) {
      noteController.dispose();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _showTemporaryPassword(PasswordResetReviewResult result) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Geçici Şifre Oluşturuldu'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Kullanıcı bu şifreyle giriş yapınca doğrudan yeni şifre belirleme ekranına yönlenir.',
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: SelectableText(
                  result.temporaryPassword,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Kapat'),
            ),
            FilledButton.icon(
              onPressed: () async {
                await Clipboard.setData(
                  ClipboardData(text: result.temporaryPassword),
                );
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Geçici şifre kopyalandı.')),
                );
              },
              icon: const Icon(Icons.copy_rounded),
              label: const Text('Kopyala'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final pendingCount = _items
        .where((item) => item.status == 'Pending')
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Şifre Talepleri',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AdminHeroCard(
              eyebrow: 'Güvenli hesap erişimi',
              title: 'Şifre sıfırlama taleplerini onaylayın.',
              description:
                  'Onaylanan kullanıcıya geçici şifre verilir ve ilk girişte yeni şifre belirlemesi zorunlu olur.',
              colors: const [Color(0xFF111827), Color(0xFFF97316)],
              metrics: [
                AdminHeroMetric(label: 'Listelenen', value: '${_items.length}'),
                AdminHeroMetric(label: 'Bekleyen', value: '$pendingCount'),
              ],
            ),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _filters.map((filter) {
                  final selected = _status == filter.$1;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(filter.$2),
                      selected: selected,
                      onSelected: (_) {
                        setState(() => _status = filter.$1);
                        _load();
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(28),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error.isNotEmpty)
              AdminPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Talepler alınamadı',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(_error),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              )
            else if (_items.isEmpty)
              const AdminPanel(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Center(child: Text('Bu filtrede talep yok.')),
                ),
              )
            else
              ..._items.map(_requestCard),
          ],
        ),
      ),
    );
  }

  Widget _requestCard(PasswordResetRequestRecord item) {
    final color = _statusColor(item.status);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AdminPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.12),
                  child: Icon(Icons.key_rounded, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.fullName,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${item.requestedEmail} • ${item.username}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                AdminAccentBadge(
                  label: _statusLabel(item.status),
                  color: color,
                ),
                AdminAccentBadge(
                  label: item.primaryRole,
                  color: const Color(0xFF6366F1),
                ),
                AdminAccentBadge(
                  label: _formatDate(item.requestedAtUtc),
                  color: const Color(0xFF64748B),
                ),
              ],
            ),
            if (item.status == 'Pending') ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _review(item, true),
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text('Onayla'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _review(item, false),
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Reddet'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime? value) {
    if (value == null) return '-';
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(local.day)}.${two(local.month)}.${local.year} ${two(local.hour)}:${two(local.minute)}';
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'Pending':
        return 'Bekliyor';
      case 'Approved':
        return 'Geçici Şifre Verildi';
      case 'Rejected':
        return 'Reddedildi';
      case 'Used':
        return 'Şifre Yenilendi';
      case 'Expired':
        return 'Süresi Doldu';
      default:
        return status;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Pending':
        return const Color(0xFFF59E0B);
      case 'Approved':
        return const Color(0xFF2563EB);
      case 'Rejected':
        return const Color(0xFFEF4444);
      case 'Used':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF64748B);
    }
  }
}

const _filters = <(String, String)>[
  ('Pending', 'Bekleyen'),
  ('Approved', 'Onaylanan'),
  ('Rejected', 'Reddedilen'),
  ('Used', 'Tamamlanan'),
  ('Expired', 'Süresi Dolan'),
  ('All', 'Tümü'),
];
