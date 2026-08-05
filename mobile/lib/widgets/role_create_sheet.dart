import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';

/// Rol oluşturma bölmesi — masaüstündeki `RoleCreateDialog`'un mobil karşılığı.
///
/// Kurum yöneticisi rol adı, taban rol ve rolün GÖREBİLECEĞİ SAYFALARI seçer.
/// Hiçbir sayfa seçmemek geçerli bir tercihtir: rol yalnız kendi profilini görür.
///
/// Güvenlik (masaüstüyle aynı kurallar):
///  • Katalog SUNUCUDAN gelir, kaydederken sunucu yine aynı katalogla doğrular.
///    Platform yönetimi sayfaları katalogda yoktur — kurum yöneticisi kendine
///    platform yetkisi veremez.
///  • İstek daima `modulesRestricted: true` gönderir; bu bayrak olmadan boş
///    liste sunucuda "kısıt yok" (TAM YETKİ) anlamına gelirdi.
///  • Enforced olmayan sayfalar ayrıca etiketlenir (yalnız menüde gizlenir),
///    yanlış güven oluşmasın.
class RoleCreateSheet extends StatefulWidget {
  const RoleCreateSheet({super.key});

  /// Rol oluşturulduysa yeni rolü döner; iptal edilirse null.
  static Future<Map<String, dynamic>?> show(BuildContext context) =>
      showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => const RoleCreateSheet(),
      );

  @override
  State<RoleCreateSheet> createState() => _RoleCreateSheetState();
}

const _baseRoles = [
  (
    'Administrative',
    'İdari Personel',
    'Sekreter, kayıt görevlisi, müdür yardımcısı',
  ),
  ('Teacher', 'Öğretmen', 'Derse giren kadro'),
  ('Cafeteria', 'Yemekhane', 'Yemekhane personeli'),
];

class _RoleCreateSheetState extends State<RoleCreateSheet> {
  final _nameController = TextEditingController();

  List<Map<String, dynamic>> _groups = const [];
  bool _loading = true;
  String? _loadError;
  bool _saving = false;
  String _baseRole = 'Administrative';
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final groups = await AdminWorkflowApiService.instance
          .getRoleModuleCatalog();
      if (!mounted) return;
      setState(() => _groups = groups);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = '$e';
        _groups = const [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _itemsOf(Map<String, dynamic> group) =>
      (group['items'] as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  List<String> get _allKeys => [
    for (final group in _groups)
      for (final item in _itemsOf(group)) '${item['key']}',
  ];

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.length < 3) {
      _snack('Rol adı en az 3 karakter olmalı'.tr);
      return;
    }
    setState(() => _saving = true);
    try {
      final role = await AdminWorkflowApiService.instance.createCustomRole(
        name: name,
        baseRole: _baseRole,
        modules: _selected.toList(),
        // Boş liste "hiçbir sayfa" demek; bayrak olmadan sunucu tam yetki sayar.
        modulesRestricted: true,
      );
      if (!mounted) return;
      _snack('${'Rol oluşturuldu'.tr}: $name');
      Navigator.of(context).pop(role);
    } catch (e) {
      if (!mounted) return;
      _snack('${'Rol oluşturulamadı'.tr}: $e');
      setState(() => _saving = false);
    }
  }

  void _snack(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PopScope(
      canPop: !_saving,
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        maxChildSize: 0.96,
        minChildSize: 0.5,
        builder: (context, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
              child: Row(
                children: [
                  const Icon(Icons.verified_user_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Yeni Rol'.tr,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _loadError != null
                  ? _errorView(theme)
                  : ListView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                      children: _body(theme),
                    ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => Navigator.pop(context),
                      child: Text('Vazgeç'.tr),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _saving || _loading || _loadError != null
                          ? null
                          : _submit,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.check_rounded, size: 18),
                      label: Text(
                        _saving ? 'Oluşturuluyor…'.tr : 'Rolü Oluştur'.tr,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorView(ThemeData theme) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, size: 36),
          const SizedBox(height: 10),
          Text(
            '${'Sayfa kataloğu alınamadı.'.tr}\n$_loadError',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _load, child: Text('Tekrar dene'.tr)),
        ],
      ),
    ),
  );

  List<Widget> _body(ThemeData theme) {
    final allKeys = _allKeys;
    return [
      TextField(
        controller: _nameController,
        enabled: !_saving,
        maxLength: 80,
        decoration: InputDecoration(
          labelText: 'Rol adı'.tr,
          hintText: 'Örn: Kayıt Sorumlusu',
          border: const OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 4),
      Text(
        'Taban rol'.tr,
        style: theme.textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 6),
      Wrap(
        spacing: 8,
        children: _baseRoles
            .map(
              (item) => ChoiceChip(
                label: Text(item.$2.tr),
                selected: _baseRole == item.$1,
                onSelected: _saving
                    ? null
                    : (_) => setState(() => _baseRole = item.$1),
              ),
            )
            .toList(),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          _baseRoles.firstWhere((item) => item.$1 == _baseRole).$3.tr,
          style: theme.textTheme.labelSmall,
        ),
      ),

      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(
            child: Text(
              'Yetki matrisi'.tr,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Text(
            '${_selected.length} / ${allKeys.length}',
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: _saving || allKeys.isEmpty
                ? null
                : () => setState(() {
                    if (_selected.length == allKeys.length) {
                      _selected.clear();
                    } else {
                      _selected
                        ..clear()
                        ..addAll(allKeys);
                    }
                  }),
            child: Text(
              _selected.length == allKeys.length && allKeys.isNotEmpty
                  ? 'Tümünü kaldır'.tr
                  : 'Tümünü seç'.tr,
            ),
          ),
        ],
      ),
      Text(
        'Rolün görebileceği sayfaları işaretleyin. Hiçbirini seçmemek de geçerlidir.'
            .tr,
        style: theme.textTheme.labelSmall,
      ),
      const SizedBox(height: 8),

      ..._groups.map((group) => _groupCard(theme, group)),

      if (_selected.isEmpty)
        Container(
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFB45309).withValues(alpha: 0.08),
            border: Border.all(
              color: const Color(0xFFB45309).withValues(alpha: 0.4),
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                size: 18,
                color: Color(0xFFB45309),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hiçbir sayfa seçilmedi. Bu rolle giriş yapan personel yalnız kendi profilini görür.'
                      .tr,
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFB45309),
                  ),
                ),
              ),
            ],
          ),
        ),
    ];
  }

  Widget _groupCard(ThemeData theme, Map<String, dynamic> group) {
    final items = _itemsOf(group);
    final keys = items.map((item) => '${item['key']}').toList();
    final onCount = keys.where(_selected.contains).length;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 6, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${group['title']}  ($onCount/${keys.length})',
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _saving
                      ? null
                      : () => setState(() {
                          if (onCount == keys.length) {
                            _selected.removeAll(keys);
                          } else {
                            _selected.addAll(keys);
                          }
                        }),
                  child: Text(
                    onCount == keys.length ? 'Kaldır'.tr : 'Seç'.tr,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          ...items.map((item) {
            final key = '${item['key']}';
            final enforced = item['enforced'] == true;
            return CheckboxListTile(
              dense: true,
              value: _selected.contains(key),
              onChanged: _saving
                  ? null
                  : (value) => setState(() {
                      if (value == true) {
                        _selected.add(key);
                      } else {
                        _selected.remove(key);
                      }
                    }),
              title: Text(
                '${item['label']}',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              // Arkasında API kapısı olmayan sayfalar açıkça ayrılır.
              subtitle: enforced
                  ? null
                  : Text(
                      'Yalnız menüde gizlenir'.tr,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFB45309),
                      ),
                    ),
              controlAffinity: ListTileControlAffinity.leading,
            );
          }),
        ],
      ),
    );
  }
}
