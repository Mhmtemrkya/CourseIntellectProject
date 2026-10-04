import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import '../services/account_deletion_api_service.dart';
import '../services/auth_session_store.dart';

/// Hesabımı Sil ekranı — tüm rollerde Ayarlar/Profil altından erişilir.
/// App Store 5.1.1(v): uygulama içi hesap silme zorunludur.
class AccountDeletionPage extends StatefulWidget {
  const AccountDeletionPage({super.key});

  @override
  State<AccountDeletionPage> createState() => _AccountDeletionPageState();
}

class _AccountDeletionPageState extends State<AccountDeletionPage> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _status = const {'status': 'none'};
  bool _busy = false;
  bool _isAdmin = false;
  List<Map<String, dynamic>> _candidates = const [];
  List<Map<String, dynamic>> _tenantQueue = const [];

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
      final status = await AccountDeletionApiService.instance.getMyAccountDeletion();
      final session = await AuthSessionStore.instance.load();
      final isAdmin = (session?.primaryRole ?? '').toLowerCase() == 'admin';
      var candidates = const <Map<String, dynamic>>[];
      var queue = const <Map<String, dynamic>>[];
      if (isAdmin) {
        candidates = await AccountDeletionApiService.instance.getSuccessorCandidates();
        queue = await AccountDeletionApiService.instance.getTenantQueue();
      }
      if (!mounted) return;
      setState(() {
        _status = status;
        _isAdmin = isAdmin;
        _candidates = candidates;
        _tenantQueue = queue;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _hasActiveRequest {
    final s = (_status['status'] ?? 'none').toString();
    return s == 'Pending' || s == 'Scheduled';
  }

  List<String> get _retainedExplanation {
    final raw = _status['retainedRecordsExplanation'];
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return const [];
  }

  Future<void> _startDeletion() async {
    final input = await _promptReauth();
    if (input == null) return;
    setState(() => _busy = true);
    try {
      final result = await AccountDeletionApiService.instance.requestAccountDeletion(
        password: input.password,
        successorAdminUserId: input.successorId,
      );
      if (!mounted) return;
      setState(() => _status = result);
      _snack('Silme talebiniz alındı.'.tr);
    } catch (e) {
      if (!mounted) return;
      _snack(e.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    setState(() => _busy = true);
    try {
      final result = await AccountDeletionApiService.instance.cancelMyAccountDeletion();
      if (!mounted) return;
      setState(() => _status = result);
      _snack('Silme talebiniz iptal edildi.'.tr);
    } catch (e) {
      if (!mounted) return;
      _snack(e.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<({String password, String? successorId})?> _promptReauth() async {
    final controller = TextEditingController();
    var confirmed = false;
    String? successorId;
    return showModalBottomSheet<({String password, String? successorId})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheet) {
            final theme = Theme.of(context);
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.of(context).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hesabımı Sil'.tr,
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  Text(
                    'Devam etmek için parolanızı girin ve silmeyi onaylayın. Bekleme süresi dolana kadar iptal edebilirsiniz.'.tr,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: controller,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Parola'.tr,
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                    ),
                  ),
                  if (_isAdmin && _candidates.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text('Yönetimi devredeceğiniz kişi (tek yöneticiyseniz zorunlu)'.tr,
                        style: theme.textTheme.bodySmall),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      initialValue: successorId,
                      isExpanded: true,
                      decoration: const InputDecoration(prefixIcon: Icon(Icons.manage_accounts_outlined)),
                      hint: Text('Seçiniz…'.tr),
                      items: _candidates
                          .map((c) => DropdownMenuItem<String>(
                                value: c['id']?.toString(),
                                child: Text('${c['fullName'] ?? ''} · ${c['role'] ?? ''}',
                                    overflow: TextOverflow.ellipsis),
                              ))
                          .toList(),
                      onChanged: (v) => setSheet(() => successorId = v),
                    ),
                  ],
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: confirmed,
                    onChanged: (v) => setSheet(() => confirmed = v ?? false),
                    title: Text('Hesabımı ve kişisel verilerimi silmeyi onaylıyorum.'.tr),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                      onPressed: (confirmed && controller.text.isNotEmpty)
                          ? () => Navigator.pop(context, (password: controller.text, successorId: successorId))
                          : null,
                      child: Text('Silme talebini gönder'.tr),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final dangerBg = isDark ? const Color(0xFF2A1416) : const Color(0xFFFEF2F2);
    final dangerBorder = isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFECACA);

    return Scaffold(
      appBar: AppBar(title: Text('Hesabımı Sil'.tr)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                    ),
                  if (_hasActiveRequest) _buildActiveRequest(theme) else _buildStartCard(theme, dangerBg, dangerBorder),
                  if (_isAdmin && _tenantQueue.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildTenantQueue(theme),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildTenantQueue(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Kurumdaki silme talepleri (yalnız görüntüleme)'.tr,
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          ..._tenantQueue.map((item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text('${item['userDisplayName'] ?? ''} · ${item['requesterRole'] ?? ''}',
                          overflow: TextOverflow.ellipsis, style: theme.textTheme.bodyMedium),
                    ),
                    Text('${item['remainingDays'] ?? 0} ${'gün'.tr}',
                        style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800)),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildStartCard(ThemeData theme, Color dangerBg, Color dangerBorder) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: dangerBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: dangerBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626)),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Hesabı kalıcı olarak sil'.tr,
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            ),
          ]),
          const SizedBox(height: 10),
          Text(
            'Bu işlem geri alınamaz. Aşağıdakiler olur:'.tr,
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ..._retainedExplanation.map((line) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 3, right: 8),
                    child: Icon(Icons.check_circle_outline_rounded, size: 16),
                  ),
                  Expanded(child: Text(line, style: theme.textTheme.bodySmall)),
                ]),
              )),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              onPressed: _busy ? null : _startDeletion,
              icon: const Icon(Icons.delete_forever_rounded),
              label: Text('Hesabımı silmek istiyorum'.tr),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveRequest(ThemeData theme) {
    final remaining = (_status['remainingDays'] as num?)?.toInt() ?? 0;
    final finalizeAt = _status['finalizeAtUtc']?.toString();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.hourglass_top_rounded, color: Color(0xFFF59E0B)),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Silme talebiniz işleniyor'.tr,
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            ),
          ]),
          const SizedBox(height: 12),
          Text(
            '${'Kalan süre:'.tr} $remaining ${'gün'.tr}',
            style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          if (finalizeAt != null) ...[
            const SizedBox(height: 4),
            Text('${'Tamamlanma:'.tr} ${_formatDate(finalizeAt)}', style: theme.textTheme.bodySmall),
          ],
          const SizedBox(height: 8),
          Text(
            'Bu süre dolmadan talebinizi iptal edebilirsiniz. Süre dolunca hesabınız ve kişisel verileriniz otomatik silinir.'.tr,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _cancel,
              icon: const Icon(Icons.undo_rounded),
              label: Text('Talebi iptal et'.tr),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
  }
}
