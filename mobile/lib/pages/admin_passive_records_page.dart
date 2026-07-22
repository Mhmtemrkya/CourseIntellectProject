import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/admin_directory_api_service.dart';

const _roleLabels = {
  'Student': 'Öğrenci',
  'Teacher': 'Öğretmen',
  'Parent': 'Veli',
  'Administrative': 'İdari Personel',
  'Accounting': 'Muhasebe',
  'Cafeteria': 'Yemekhane',
  'BranchManager': 'Şube Müdürü',
  'Admin': 'Yönetici',
  'Developer': 'Geliştirici',
};

String _roleLabel(String? role) => _roleLabels[role] ?? (role ?? 'Diğer');

/// Pasife alınan tüm hesaplar (öğrenci/öğretmen/personel/veli). Yalnız burada
/// görünürler; aktifleştirilene kadar başka hiçbir listede çıkmazlar.
class AdminPassiveRecordsPage extends StatefulWidget {
  const AdminPassiveRecordsPage({super.key});

  @override
  State<AdminPassiveRecordsPage> createState() =>
      _AdminPassiveRecordsPageState();
}

class _AdminPassiveRecordsPageState extends State<AdminPassiveRecordsPage> {
  final _service = AdminDirectoryApiService.instance;
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _accounts = [];
  String _search = '';
  String _roleFilter = 'all';
  String? _busyUser;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _service.fetchPassiveAccounts();
      if (!mounted) return;
      setState(() => _accounts = rows);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<String> get _roles {
    final set = <String>{for (final a in _accounts) '${a['primaryRole']}'};
    return ['all', ...set];
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    return _accounts.where((a) {
      if (_roleFilter != 'all' && '${a['primaryRole']}' != _roleFilter) {
        return false;
      }
      if (term.isEmpty) return true;
      return '${a['fullName']} ${a['username']} ${a['detail']}'
          .toLowerCase()
          .contains(term);
    }).toList();
  }

  Future<void> _reactivate(Map<String, dynamic> account) async {
    final username = '${account['username']}';
    setState(() => _busyUser = username);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _service.updateUserStatus(username: username, isActive: true);
      setState(() => _accounts
          .removeWhere((a) => '${a['userId']}' == '${account['userId']}'));
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            '${account['fullName']} ${'yeniden aktifleştirildi.'.tr}',
          ),
        ),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busyUser = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Pasif Kayıtlar'.tr)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _ErrorState(error: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Pasife alınan öğrenci, öğretmen, personel ve veliler yalnız burada görünür. Aktifleştirilene kadar diğer hiçbir listede/seçimde çıkmazlar.'
                        .tr,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'İsim / kullanıcı adı ara...'.tr,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final role in _roles)
                        ChoiceChip(
                          selected: _roleFilter == role,
                          onSelected: (_) => setState(() => _roleFilter = role),
                          label: Text(
                            role == 'all' ? 'Tümü'.tr : _roleLabel(role),
                          ),
                          showCheckmark: false,
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_filtered.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Column(
                        children: [
                          Icon(Icons.people_outline_rounded,
                              size: 40, color: Colors.grey.shade400),
                          const SizedBox(height: 8),
                          Text('Pasif kayıt yok'.tr,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    )
                  else
                    ..._filtered.map(_accountCard),
                ],
              ),
            ),
    );
  }

  Widget _accountCard(Map<String, dynamic> account) {
    final username = '${account['username']}';
    final detail = '${account['detail'] ?? ''}';
    final initials = '${account['fullName'] ?? '?'}'
        .split(' ')
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0])
        .join();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.blueGrey.shade100,
              child: Text(
                initials.isEmpty ? '?' : initials,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Colors.blueGrey.shade800),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text('${account['fullName']}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade400),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(_roleLabel('${account['primaryRole']}'),
                            style: const TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail.isNotEmpty ? '$username • $detail' : username,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            OutlinedButton.icon(
              onPressed:
                  _busyUser == username ? null : () => _reactivate(account),
              icon: _busyUser == username
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.restore_rounded, size: 16),
              label: Text('Aktifleştir'.tr),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, size: 40, color: Colors.red),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text('$error', textAlign: TextAlign.center),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: Text('Tekrar dene'.tr)),
        ],
      ),
    );
  }
}
