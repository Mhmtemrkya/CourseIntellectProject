import 'package:flutter/material.dart';

import '../services/staff_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'admin_staff_registration_page.dart';

class AdminPersonnelApprovalsPage extends StatefulWidget {
  const AdminPersonnelApprovalsPage({super.key});

  @override
  State<AdminPersonnelApprovalsPage> createState() =>
      _AdminPersonnelApprovalsPageState();
}

class _AdminPersonnelApprovalsPageState
    extends State<AdminPersonnelApprovalsPage> {
  final _store = StaffRegistryStore.instance;
  List<Map<String, String>> get _items {
    final activeStaff = _store.staff.take(3).toList();
    if (activeStaff.isEmpty) {
      return const [
        {
          'title': 'Personel onayi bekleniyor',
          'type': 'Operasyon',
          'status': 'Bekliyor',
          'detail':
              'Kadro verisi yüklendikten sonra talepler burada listelenecek.',
        },
      ];
    }

    return activeStaff.asMap().entries.map((entry) {
      final index = entry.key;
      final person = entry.value;
      return {
        'title':
            '${person.fullName} ${index == 0
                ? 'görev onayi'
                : index == 1
                ? 'izin talebi'
                : 'vardiya duzeni'}',
        'type': person.roleType,
        'status': index == 2 ? 'Onaylandı' : 'Bekliyor',
        'detail': index == 0
            ? 'Bu hafta için görev/plana yönelik onay bekleniyor'
            : index == 1
            ? 'Planlanan izin veya uygunluk değişikliği kontrol edilmeli'
            : 'Kampüs için vardiya dağılımı güncellendi',
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    _store.ensureLoaded();
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Personel ve Onay Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const AdminStaffRegistrationPage(),
              ),
            ),
            icon: const Icon(Icons.person_add_alt_1_outlined),
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Yetki merkezi',
            title:
                'Öğretmen, personel ve operasyon taleplerini yönetiçi seviyesinde onaylayın.',
            description:
                'Ek ders, izin, vardiya ve görev planları için tek bir onay görünümü sunulur.',
            metrics: [
              AdminHeroMetric(
                label: 'Bekleyen',
                value:
                    '${_items.where((item) => item['status'] == 'Bekliyor').length}',
              ),
              AdminHeroMetric(
                label: 'Kayıtlı Kadro',
                value: '${_store.staff.length}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            margin: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Yeni öğretmen veya personel kaydını burada açabilirsiniz.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminStaffRegistrationPage(),
                    ),
                  ),
                  icon: const Icon(Icons.add_circle_outline_rounded),
                  label: const Text('Yeni Kayıt'),
                ),
              ],
            ),
          ),
          ..._items.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item['title']!,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      AdminAccentBadge(
                        label: item['status']!,
                        color: item['status'] == 'Onaylandı'
                            ? const Color(0xFF14532D)
                            : const Color(0xFFB45309),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item['type']} • ${item['detail']}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.45),
                  ),
                  const SizedBox(height: 12),
                  if (item['status'] == 'Bekliyor')
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: () => _updateStatus(item, 'Onaylandı'),
                            child: const Text('Onayla'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _updateStatus(item, 'Reddedildi'),
                            child: const Text('Reddet'),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _updateStatus(Map<String, String> item, String status) {
    setState(() {
      item['status'] = status;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Talep durumu: $status'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
