import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

// Backend DrivingExpenseCategory ile birebir; personel maaş/primi kasıtlı olarak YOK.
const _categories = <String, String>{
  'Fuel': 'Mazot / Yakıt',
  'Maintenance': 'Bakım / Onarım',
  'Insurance': 'Sigorta / Kasko',
  'Rent': 'Kira',
  'Utilities': 'Fatura / Abonelik',
  'TaxFee': 'Vergi / Harç',
  'Office': 'Kırtasiye / Ofis',
  'Marketing': 'Reklam / Tanıtım',
  'Other': 'Diğer',
};
String _catLabel(dynamic v) => _categories['$v'] ?? '${v ?? '—'}';
String _money(dynamic v) => '₺${(double.tryParse('$v') ?? 0).toStringAsFixed(2)}';
String _dateOnly(dynamic raw) {
  final d = DateTime.tryParse('$raw')?.toLocal();
  return d == null ? '—' : '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
}

String _dateTime(dynamic raw) {
  final d = DateTime.tryParse('$raw')?.toLocal();
  if (d == null) return '—';
  return '${_dateOnly(raw)} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class DrivingExpensesPage extends StatefulWidget {
  const DrivingExpensesPage({super.key});
  @override
  State<DrivingExpensesPage> createState() => _DrivingExpensesPageState();
}

class _DrivingExpensesPageState extends State<DrivingExpensesPage> {
  bool _loading = true, _saving = false;
  String? _error;
  Map<String, dynamic> _data = const {};
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  String _categoryFilter = '';

  List<Map<String, dynamic>> get _items => ((_data['items'] as List?) ?? const [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
  List<Map<String, dynamic>> get _vehicles => ((_data['vehicles'] as List?) ?? const [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
  Map<String, dynamic> get _summary =>
      Map<String, dynamic>.from((_data['summary'] as Map?) ?? const {});

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
      final result = await Future.wait([
        DrivingSchoolApiService.instance.expenses(
          category: _categoryFilter.isEmpty ? null : _categoryFilter,
        ),
        DrivingPermissionsStore.instance.load(),
      ]);
      if (!mounted) return;
      setState(() {
        _data = result[0] as Map<String, dynamic>;
        _permissions = result[1] as DrivingPermissionSnapshot;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _message(String value, {bool error = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(value), backgroundColor: error ? Colors.red : null),
      );
    }
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Gideri sil'.tr),
        content: Text('“${item['title']}” gideri silinsin mi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('Sil'.tr)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await DrivingSchoolApiService.instance.deleteExpense('${item['id']}');
      _message('Gider silindi.'.tr);
      await _load();
    } catch (e) {
      _message('$e', error: true);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    final titleCtrl = TextEditingController(text: '${existing?['title'] ?? ''}');
    final amountCtrl = TextEditingController(
      text: existing == null ? '' : '${existing['amount'] ?? ''}',
    );
    final vendorCtrl = TextEditingController(text: '${existing?['vendorName'] ?? ''}');
    final invoiceCtrl = TextEditingController(text: '${existing?['invoiceNo'] ?? ''}');
    final noteCtrl = TextEditingController(text: '${existing?['note'] ?? ''}');
    var category = '${existing?['category'] ?? 'Fuel'}';
    if (!_categories.containsKey(category)) category = 'Other';
    var vehicleId = '${existing?['vehicleId'] ?? ''}';
    var date = DateTime.tryParse('${existing?['expenseDateUtc'] ?? ''}')?.toLocal() ?? DateTime.now();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(
            16, 8, 16, MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  existing == null ? 'Yeni Gider Faturası'.tr : 'Gideri Düzenle'.tr,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  decoration: InputDecoration(labelText: 'Kategori'.tr, border: const OutlineInputBorder()),
                  items: _categories.entries
                      .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => category = v ?? category,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(labelText: 'Başlık / açıklama'.tr, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Tutar (₺)'.tr, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setSheet(() => date = picked);
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(labelText: 'Gider tarihi'.tr, border: const OutlineInputBorder()),
                    child: Text(
                      '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}',
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: vehicleId.isEmpty ? '' : vehicleId,
                  decoration: InputDecoration(labelText: 'İlgili araç (opsiyonel)'.tr, border: const OutlineInputBorder()),
                  items: [
                    DropdownMenuItem(value: '', child: Text('— Yok —'.tr)),
                    ..._vehicles.map((v) => DropdownMenuItem(
                          value: '${v['id']}',
                          child: Text('${v['plateNumber']}'),
                        )),
                  ],
                  onChanged: (v) => vehicleId = v ?? '',
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: vendorCtrl,
                  decoration: InputDecoration(labelText: 'Tedarikçi (opsiyonel)'.tr, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: invoiceCtrl,
                  decoration: InputDecoration(labelText: 'Fatura no (opsiyonel)'.tr, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: noteCtrl,
                  decoration: InputDecoration(labelText: 'Not (opsiyonel)'.tr, border: const OutlineInputBorder()),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(sheetContext, true),
                    child: Text(existing == null ? 'Gideri Kaydet'.tr : 'Güncelle'.tr),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (saved != true) return;
    final amount = double.tryParse(amountCtrl.text.trim().replaceAll(',', '.'));
    if (titleCtrl.text.trim().length < 2) {
      _message('Gider başlığı en az 2 karakter olmalıdır.', error: true);
      return;
    }
    if (amount == null || amount <= 0) {
      _message('Geçerli bir tutar girin.', error: true);
      return;
    }
    final body = <String, dynamic>{
      'category': category,
      'title': titleCtrl.text.trim(),
      'vendorName': vendorCtrl.text.trim(),
      'invoiceNo': invoiceCtrl.text.trim(),
      'amount': amount,
      'expenseDateUtc': DateTime.utc(date.year, date.month, date.day, 12).toIso8601String(),
      'vehicleId': vehicleId.isEmpty ? null : vehicleId,
      'note': noteCtrl.text.trim(),
    };
    setState(() => _saving = true);
    try {
      if (existing == null) {
        await DrivingSchoolApiService.instance.createExpense(body);
        _message('Gider faturası oluşturuldu.'.tr);
      } else {
        await DrivingSchoolApiService.instance.updateExpense('${existing['id']}', body);
        _message('Gider güncellendi.'.tr);
      }
      await _load();
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Kurumdan bağımsız genel gider ekranı. Sürücü kursu bağlamında (driving
    // modülü açık) ince taneli driving.finance izinleri uygulanır; okul
    // bağlamında (driving modülü yok) görünürlük backend rol yetkisine bırakılır
    // (Admin/Accounting/BranchManager) — butonlar gösterilir, yetkisizde 403 döner.
    final drivingGated = _permissions.moduleAvailable;
    final canView = !drivingGated || _permissions.can(DrivingPermissions.financeView) || _loading;
    final canManage = !drivingGated || _permissions.can(DrivingPermissions.financeCollect);
    return DrivingScaffold(
      appBar: AppBar(
        title: Text('Giderler'.tr),
        actions: [
          if (canManage)
            IconButton(
              tooltip: 'Gider Ekle',
              icon: const Icon(Icons.add_rounded),
              onPressed: _saving ? null : () => _openForm(),
            ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: _saving ? null : () => _openForm(),
              icon: const Icon(Icons.receipt_long_rounded),
              label: Text('Gider Ekle'.tr),
            )
          : null,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: FilledButton(onPressed: _load, child: Text(_error!)))
          : !canView
          ? Center(child: Text('Bu modüle erişim yetkiniz yok.'.tr))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.trending_down_rounded, color: Colors.redAccent),
                      title: Text(
                        _money(_summary['total']),
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                      ),
                      subtitle: Text('${_summary['count'] ?? 0} ${'gider kaydı'.tr}'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        ChoiceChip(
                          label: Text('Tümü'.tr),
                          selected: _categoryFilter.isEmpty,
                          onSelected: (_) {
                            setState(() => _categoryFilter = '');
                            _load();
                          },
                        ),
                        ..._categories.entries.map((e) => Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: ChoiceChip(
                                label: Text(e.value),
                                selected: _categoryFilter == e.key,
                                onSelected: (_) {
                                  setState(() => _categoryFilter = e.key);
                                  _load();
                                },
                              ),
                            )),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: Text('Bu filtrede gider kaydı yok.'.tr)),
                    ),
                  ..._items.map(
                    (item) => Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${item['title']}',
                                    style: const TextStyle(fontWeight: FontWeight.w900),
                                  ),
                                ),
                                Text(
                                  _money(item['amount']),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    color: Colors.redAccent,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              runSpacing: 2,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Chip(
                                  label: Text(_catLabel(item['category'])),
                                  visualDensity: VisualDensity.compact,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                if ('${item['vehiclePlate'] ?? ''}'.isNotEmpty)
                                  Chip(
                                    avatar: const Icon(Icons.directions_car_rounded, size: 16),
                                    label: Text('${item['vehiclePlate']}'),
                                    visualDensity: VisualDensity.compact,
                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                _dateOnly(item['expenseDateUtc']),
                                if ('${item['vendorName'] ?? ''}'.isNotEmpty) '${item['vendorName']}',
                                if ('${item['invoiceNo'] ?? ''}'.isNotEmpty) '${'Fatura'.tr}: ${item['invoiceNo']}',
                              ].join(' • '),
                              style: const TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                            if ('${item['note'] ?? ''}'.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text('${item['note']}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              ),
                            const SizedBox(height: 4),
                            // Detay: kim oluşturdu, hangi şube, ne zaman.
                            Text(
                              '${'Oluşturan'.tr}: ${item['createdByName'] ?? '—'}'
                              '${('${item['branchName'] ?? ''}'.isNotEmpty) ? ' • ${'Şube'.tr}: ${item['branchName']}' : ''}'
                              ' • ${_dateTime(item['createdAtUtc'])}'
                              '${item['updatedAtUtc'] != null ? ' • (${'düzenlendi'.tr})' : ''}',
                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                            if (canManage)
                              Align(
                                alignment: Alignment.centerRight,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    TextButton(
                                      onPressed: () => _openForm(existing: item),
                                      child: Text('Düzenle'.tr),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                                      onPressed: () => _delete(item),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
