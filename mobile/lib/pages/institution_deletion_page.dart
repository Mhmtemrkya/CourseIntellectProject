import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import '../services/account_deletion_api_service.dart';

/// Kurumu Sil ekranı — yalnız kurum yöneticisi. Talep platform yöneticisinin
/// onayına düşer; işlem öncesi etkilenecek kayıtlar gösterilir.
class InstitutionDeletionPage extends StatefulWidget {
  const InstitutionDeletionPage({super.key});

  @override
  State<InstitutionDeletionPage> createState() => _InstitutionDeletionPageState();
}

class _InstitutionDeletionPageState extends State<InstitutionDeletionPage> {
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Map<String, dynamic> _status = const {'status': 'none'};

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
      final status = await AccountDeletionApiService.instance.getMyInstitutionDeletion();
      if (!mounted) return;
      setState(() => _status = status);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _statusText => (_status['status'] ?? 'none').toString();
  bool get _hasActiveRequest =>
      _statusText == 'PendingPlatformApproval' || _statusText == 'Approved' || _statusText == 'Scheduled';

  Map<String, dynamic> get _impact {
    final raw = _status['impact'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  Future<void> _request() async {
    final password = await _promptReauth();
    if (password == null) return;
    setState(() => _busy = true);
    try {
      final result = await AccountDeletionApiService.instance.requestInstitutionDeletion(password: password);
      if (!mounted) return;
      setState(() => _status = result);
      _snack('Kurum silme talebiniz platform onayına gönderildi.'.tr);
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

  Future<String?> _promptReauth() async {
    final controller = TextEditingController();
    var confirmed = false;
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) {
          final theme = Theme.of(context);
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.of(context).viewInsets.bottom + 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Kurumu Sil'.tr, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text(
                  'Bu talep platform yöneticisinin onayına düşer. Onaylanırsa kurumun verileri temizlenir; finans ve eğitim kayıtları kişisel bilgiler silinerek anonim saklanır.'.tr,
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
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: confirmed,
                  onChanged: (v) => setSheet(() => confirmed = v ?? false),
                  title: Text('Kurumun tamamen silinmesini talep ediyorum.'.tr),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                    onPressed: (confirmed && controller.text.isNotEmpty)
                        ? () => Navigator.pop(context, controller.text)
                        : null,
                    child: Text('Talebi gönder'.tr),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Kurumu Sil'.tr)),
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
                  _buildImpactCard(theme),
                  const SizedBox(height: 14),
                  if (_hasActiveRequest) _buildStatusCard(theme) else _buildRequestButton(theme),
                ],
              ),
            ),
    );
  }

  Widget _buildImpactCard(ThemeData theme) {
    final impact = _impact;
    int v(String k) => (impact[k] as num?)?.toInt() ?? 0;
    final rows = <(String, int)>[
      ('Kullanıcılar'.tr, v('userCount')),
      ('Öğrenciler'.tr, v('studentCount')),
      ('Dosya/belge'.tr, v('fileCount')),
      ('Finans kaydı'.tr, v('financeRecordCount')),
      ('Eğitim kaydı'.tr, v('educationRecordCount')),
    ];
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
          Text('Etkilenecek kayıtlar'.tr,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          ...rows.map((r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(r.$1, style: theme.textTheme.bodyMedium),
                    Text('${r.$2}', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900)),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildRequestButton(ThemeData theme) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
        onPressed: _busy ? null : _request,
        icon: const Icon(Icons.domain_disabled_rounded),
        label: Text('Kurum silme talebi oluştur'.tr),
      ),
    );
  }

  Widget _buildStatusCard(ThemeData theme) {
    final reject = _status['rejectReason']?.toString();
    final label = switch (_statusText) {
      'PendingPlatformApproval' => 'Platform onayı bekleniyor'.tr,
      'Approved' || 'Scheduled' => 'Onaylandı — silme zamanlandı'.tr,
      _ => _statusText,
    };
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(children: [
        const Icon(Icons.hourglass_top_rounded, color: Color(0xFFF59E0B)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            if (reject != null && reject.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('${'Red gerekçesi:'.tr} $reject', style: theme.textTheme.bodySmall),
            ],
          ]),
        ),
      ]),
    );
  }
}
