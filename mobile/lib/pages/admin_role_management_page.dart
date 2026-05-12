import 'package:flutter/material.dart';

import 'admin_accounting_registration_page.dart';
import 'admin_staff_registration_page.dart';
import '../services/admin_directory_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminRoleManagementPage extends StatefulWidget {
  const AdminRoleManagementPage({super.key});

  @override
  State<AdminRoleManagementPage> createState() =>
      _AdminRoleManagementPageState();
}

class _AdminRoleManagementPageState extends State<AdminRoleManagementPage> {
  List<AdminStaffRecord> _staffRecords = const [];
  List<RoleSummaryRecord> _roleSummaries = const [];
  late final List<_RoleProfile> _roles = [
    _RoleProfile(
      title: 'Yönetici',
      description:
          'Tüm modüllere erişir, onay verir ve kurum genel ayarlarını yönetir.',
      mainGoal:
          'Kurumsal karar, onay ve yetki mimarisini güvenli şekilde yönetmek.',
      riskNote:
          'Bu rolde gereksiz fazla kullanıcı olması kritik onay ve veri güvenliği riski oluşturur.',
      color: const Color(0xFF1D4ED8),
      icon: Icons.admin_panel_settings_outlined,
      isActive: true,
      requiresApprovalForCriticalActions: false,
      loginEnabled: true,
      messagingScope: 'Tüm roller',
      moduleAccess: {
        'Akademik': true,
        'Finans': true,
        'Operasyon': true,
        'Duyurular': true,
        'Onaylar': true,
      },
      criticalPowers: [
        'Rol açma / kapatma',
        'İndirim ve maaş onayı',
        'Kurum ayarları',
      ],
      assignedUsers: ['Ece Arslan', 'Merkez Yönetim Hesabı'],
    ),
    _RoleProfile(
      title: 'Öğretmen',
      description:
          'Sınıf yönetimi, içerik, sınav, soru bankası ve veli görüşme süreçlerini yürütür.',
      mainGoal:
          'Akademik süreçleri yönetmek ve öğrenci performansını artırmak.',
      riskNote:
          'Finans veya onay ekranlarının açık kalması görev karmaşasına neden olur.',
      color: const Color(0xFF7C3AED),
      icon: Icons.menu_book_outlined,
      isActive: true,
      requiresApprovalForCriticalActions: false,
      loginEnabled: true,
      messagingScope: 'Öğrenci, veli, yönetiçi',
      moduleAccess: {
        'Akademik': true,
        'Finans': false,
        'Operasyon': false,
        'Duyurular': true,
        'Onaylar': false,
      },
      criticalPowers: [
        'Not ve deneme girişi',
        'İçerik yayını',
        'Görüşme talebi onayı',
      ],
      assignedUsers: ['Hasan Yıldız', 'Nehir Kaya', '3 aktif öğretmen daha'],
    ),
    _RoleProfile(
      title: 'Muhasebeci',
      description:
          'Tahsilat, taksit, burs ve ödeme süreçlerini yönetir; onay vermez, takip eder.',
      mainGoal:
          'Tahsilat ve ödeme operasyonunu hatasız yürütmek, finansal kayıtları düzenli tutmak.',
      riskNote: 'Onay yetkisi açılırsa finans kontrol zinciri bozulur.',
      color: const Color(0xFF14532D),
      icon: Icons.account_balance_wallet_outlined,
      isActive: true,
      requiresApprovalForCriticalActions: true,
      loginEnabled: true,
      messagingScope: 'Veli, yönetiçi',
      moduleAccess: {
        'Akademik': false,
        'Finans': true,
        'Operasyon': false,
        'Duyurular': false,
        'Onaylar': false,
      },
      criticalPowers: ['Tahsilat oluşturma', 'Bordro hazırlama', 'Onay takibi'],
      assignedUsers: ['Muhasebe Birimi', 'Ceren Aksoy'],
    ),
    _RoleProfile(
      title: 'İdari Birimler',
      description:
          'Öğrenci kaydı, evrak takibi, duyuru ve veli iletişim süreçlerini yürütür.',
      mainGoal:
          'Kayıt, evrak ve veli bilgilendirme operasyonunu hızlı ve eksiksiz yürütmek.',
      riskNote:
          'Finans yetkisi verilirse kayıt ve tahsilat süreçleri birbirine karışır.',
      color: const Color(0xFF0F766E),
      icon: Icons.apartment_outlined,
      isActive: true,
      requiresApprovalForCriticalActions: false,
      loginEnabled: true,
      messagingScope: 'Veli, yönetiçi, muhasebe',
      moduleAccess: {
        'Akademik': false,
        'Finans': false,
        'Operasyon': true,
        'Duyurular': true,
        'Onaylar': false,
      },
      criticalPowers: [
        'Öğrenci kaydı açma',
        'Evrak takibi',
        'Veli bilgilendirme',
      ],
      assignedUsers: ['Öğrenci İşleri', 'İdari Masa 1'],
    ),
  ];

  int _selectedIndex = 0;

  _RoleProfile get _selectedRole => _roles[_selectedIndex];

  @override
  void initState() {
    super.initState();
    _loadDirectoryData();
  }

  @override
  void dispose() => super.dispose();

  Future<void> _loadDirectoryData() async {
    try {
      final roles = await AdminDirectoryApiService.instance.fetchRoles();
      final staff = await AdminDirectoryApiService.instance.fetchStaff();
      if (!mounted) return;
      setState(() {
        _roleSummaries = roles;
        _staffRecords = staff;
        for (final role in _roles) {
          RoleSummaryRecord? summary;
          for (final item in _roleSummaries) {
            if (_toUiRole(item.roleName) == role.title) {
              summary = item;
              break;
            }
          }
          if (summary == null) continue;
          role.isActive = summary.isActive;
          role.loginEnabled = summary.loginEnabled;
          role.requiresApprovalForCriticalActions =
              summary.requiresCriticalApproval;
          role.messagingScope = summary.messagingScope;
          for (final key in role.moduleAccess.keys.toList()) {
            role.moduleAccess[key] = summary.moduleAccess.contains(key);
          }
        }
      });
    } catch (_) {
      if (!mounted) return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = _roleSummaries.isEmpty
        ? _roles.where((item) => item.isActive).length
        : _roleSummaries.length;
    final loginEnabledCount = _roleSummaries.isEmpty
        ? _roles.where((item) => item.loginEnabled).length
        : _roleSummaries.where((item) => item.loginEnabled).length;
    final approvalCount = _roleSummaries.isEmpty
        ? _roles.where((item) => item.requiresApprovalForCriticalActions).length
        : _roleSummaries.where((item) => item.requiresCriticalApproval).length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Yetki ve Rol Yönetimi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Rol merkezi',
            title:
                'Kurumdaki her rolün amacı, erişimi ve kritik yetkisi açık şekilde yönetilsin.',
            description:
                'Bu ekranda rolün sadece açık olup olmadığı değil; hangi modüllere eriştiği, kimlerle mesajlaşabildiği ve kritik işlemlerde onay gerekip gerekmediği belirlenir.',
            colors: const [Color(0xFF0F172A), Color(0xFF1D4ED8)],
            metrics: [
              AdminHeroMetric(label: 'Aktif Rol', value: '$activeCount'),
              AdminHeroMetric(label: 'Giriş Açık', value: '$loginEnabledCount'),
              AdminHeroMetric(label: 'Onaylı Rol', value: '$approvalCount'),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Bu Ekran Ne İşe Yarar?'),
                const SizedBox(height: 12),
                _policyTile(
                  context,
                  'Görev ayrımını netleştirir',
                  'Her rol sadece kendi işi için gerekli modüllere erişir. Böylece karmaşa ve hata azalır.',
                ),
                _policyTile(
                  context,
                  'Kritik onay zincirini korur',
                  'Maaş, indirim, finans ve kurumsal kararlar yanlış role açılmaz.',
                ),
                _policyTile(
                  context,
                  'Kullanıcı atamasını kontrollü hale getirir',
                  'Bir rolün gerçekten kimlerde aktif olduğu ve o rolün amacı aynı ekranda görülür.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Rol Kartları'),
                const SizedBox(height: 12),
                ..._roles.asMap().entries.map(
                  (entry) => _roleCard(context, entry.key, entry.value),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _roleDetailPanel(context),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Yönetim Kuralları'),
                const SizedBox(height: 12),
                _policyTile(
                  context,
                  'Kritik finans ve maaş onayı yalnızca yönetiçide kalır.',
                  'Muhasebe hazırlık yapar, karar ve onay yönetiçi tarafından verilir.',
                ),
                _policyTile(
                  context,
                  'İdari birimler kayıt ve evrak sürecini yürütür.',
                  'Yeni öğrenci açabilir, belge takibi yapabilir, ancak finans onayı veremez.',
                ),
                _policyTile(
                  context,
                  'Öğretmen akademik modüllerde güçlü, finansal modüllerde kapalıdır.',
                  'Bu ayrım rol karmaşasını engeller ve güvenliği artırır.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _roleCard(BuildContext context, int index, _RoleProfile role) {
    final selected = _selectedIndex == index;

    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => setState(() => _selectedIndex = index),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? role.color.withValues(alpha: 0.10)
              : Theme.of(
                  context,
                ).scaffoldBackgroundColor.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: selected
                ? role.color
                : Theme.of(context).dividerColor.withValues(alpha: 0.18),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: role.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(role.icon, color: role.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    role.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    role.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                AdminAccentBadge(
                  label: role.isActive ? 'Aktif' : 'Pasif',
                  color: role.isActive ? role.color : Colors.grey,
                ),
                const SizedBox(height: 8),
                Text(
                  role.loginEnabled ? 'Giriş Açık' : 'Giriş Kapalı',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _roleDetailPanel(BuildContext context) {
    final role = _selectedRole;
    final assignedPeople = _assignedPeopleFor(role);

    return AdminPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (assignedPeople.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: role.color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                '${role.title} rolünde kayıtlı ${assignedPeople.length} kullanıcı bulundu. Bu bölüm backend listesinden okunur.',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(height: 1.4),
              ),
            ),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  '${role.title} Rol Detayı',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              AdminAccentBadge(label: role.title, color: role.color),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            role.description,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: role.color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Rolün Amacı',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  role.mainGoal,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: role.isActive,
            onChanged: (value) {
              setState(() => role.isActive = value);
            },
            title: const Text('Rol aktif'),
            subtitle: const Text(
              'Bu rol sistem içinde görünür ve atanabilir olsun',
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: role.loginEnabled,
            onChanged: (value) {
              setState(() => role.loginEnabled = value);
            },
            title: const Text('Giriş yetkisi açık'),
            subtitle: const Text(
              'Bu roldeki kullanıcılar login ekranından giriş yapabilsin',
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: role.requiresApprovalForCriticalActions,
            onChanged: (value) {
              setState(() => role.requiresApprovalForCriticalActions = value);
            },
            title: const Text('Kritik işlemde onay gereksinimi'),
            subtitle: const Text(
              'Bu roldeki kritik işlemler yönetiçi onayıyla tamamlansın',
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Mesajlaşma Kapsamı',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(
                context,
              ).scaffoldBackgroundColor.withValues(alpha: 0.45),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(
              role.messagingScope,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Bu Role Atanmış Kullanıcılar',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          if (assignedPeople.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).scaffoldBackgroundColor.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Text('Bu role atanmış aktif kullanıcı yok.'),
            )
          else
            ...assignedPeople.map(
              (person) => Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).scaffoldBackgroundColor.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.person_outline_rounded,
                      color: role.color,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(person.displayName),
                          const SizedBox(height: 4),
                          Text(
                            person.subtitle,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (person.extraRoles.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: person.extraRoles
                                  .map(
                                    (extraRole) => Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: role.color.withValues(
                                          alpha: 0.10,
                                        ),
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
                                      ),
                                      child: Text(
                                        'Ek Yetki: $extraRole',
                                        style: TextStyle(
                                          color: role.color,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (person.canUndo)
                      IconButton(
                        tooltip: 'Son atamayı geri al',
                        onPressed: () => _undoLastAssignment(person),
                        icon: const Icon(Icons.undo_rounded),
                      ),
                    Switch(
                      value: person.isActive,
                      onChanged: person.canToggle
                          ? (value) => _togglePersonStatus(person, value)
                          : null,
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          Text(
            'Modül Erişimleri',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          ...role.moduleAccess.entries.map(
            (entry) => SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: entry.value,
              onChanged: (value) =>
                  setState(() => role.moduleAccess[entry.key] = value),
              title: Text(entry.key),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Rolün Kritik Kullanım Alanları',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          ...role.criticalPowers.map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).scaffoldBackgroundColor.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(Icons.verified_outlined, color: role.color, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(item)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2).withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Risk / Dikkat Notu',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF991B1B),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  role.riskNote,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.4,
                    color: const Color(0xFF7F1D1D),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openAssignUserModal(context, role),
                  icon: const Icon(Icons.manage_accounts_outlined),
                  label: const Text('Kullanıcı Ata'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    await AdminDirectoryApiService.instance.updateRolePolicy(
                      roleName: _toApiRole(role.title),
                      isActive: role.isActive,
                      loginEnabled: role.loginEnabled,
                      requiresCriticalApproval:
                          role.requiresApprovalForCriticalActions,
                      messagingScope: role.messagingScope,
                      moduleAccess: role.moduleAccess.entries
                          .where((entry) => entry.value)
                          .map((entry) => entry.key)
                          .toList(),
                    );
                    await _loadDirectoryData();
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(
                          '${role.title} rol ayarları güncellendi.',
                        ),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Rol Ayarlarını Kaydet'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _policyTile(BuildContext context, String title, String detail) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).scaffoldBackgroundColor.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            detail,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4),
          ),
        ],
      ),
    );
  }

  List<_AssignedPerson> _assignedPeopleFor(_RoleProfile role) {
    if (_staffRecords.isNotEmpty) {
      switch (role.title) {
        case 'Öğretmen':
          return _staffRecords
              .where(
                (person) =>
                    person.role == 'Teacher' ||
                    person.extraRoles.contains('Teacher'),
              )
              .map(
                (person) => _AssignedPerson(
                  displayName: person.fullName,
                  subtitle: '${person.departmentOrBranch} • ${person.campus}',
                  username: person.username,
                  isActive: person.status == 'Active',
                  canToggle: true,
                  extraRoles: person.extraRoles.map(_toUiRole).toList(),
                  canUndo: person.hasRoleHistory,
                ),
              )
              .toList();
        case 'Muhasebeci':
          return _staffRecords
              .where(
                (person) =>
                    person.role == 'Accounting' ||
                    person.extraRoles.contains('Accounting'),
              )
              .map(
                (person) => _AssignedPerson(
                  displayName: person.fullName,
                  subtitle: '${person.departmentOrBranch} • ${person.campus}',
                  username: person.username,
                  isActive: person.status == 'Active',
                  canToggle: true,
                  extraRoles: person.extraRoles.map(_toUiRole).toList(),
                  canUndo: person.hasRoleHistory,
                ),
              )
              .toList();
        case 'İdari Birimler':
          return _staffRecords
              .where(
                (person) =>
                    person.role == 'Administrative' ||
                    person.extraRoles.contains('Administrative'),
              )
              .map(
                (person) => _AssignedPerson(
                  displayName: person.fullName,
                  subtitle: '${person.departmentOrBranch} • ${person.campus}',
                  username: person.username,
                  isActive: person.status == 'Active',
                  canToggle: true,
                  extraRoles: person.extraRoles.map(_toUiRole).toList(),
                  canUndo: person.hasRoleHistory,
                ),
              )
              .toList();
      }
    }
    return const [];
  }

  Future<void> _togglePersonStatus(_AssignedPerson person, bool value) async {
    if (!person.canToggle || person.username.isEmpty) return;
    await AdminDirectoryApiService.instance.updateUserStatus(
      username: person.username,
      isActive: value,
    );
    await _loadDirectoryData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${person.displayName} durumu ${value ? 'Aktif' : 'Pasif'} olarak güncellendi.',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _openAssignUserModal(BuildContext context, _RoleProfile role) {
    final candidates = _assignableCandidatesFor(role);
    final pageNavigator = Navigator.of(context);
    _AssignedPerson? selected = candidates.isNotEmpty ? candidates.first : null;
    bool assignAsExtraRole = false;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${role.title} Rolüne Kullanıcı Ata',
                      style: Theme.of(sheetContext).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Kayıtlı kullanıcılar arasından seçim yaparak bu role atayabilir veya ek yetki profili tanımlayabilirsin.',
                      style: Theme.of(
                        sheetContext,
                      ).textTheme.bodyMedium?.copyWith(height: 1.4),
                    ),
                    if (candidates.isEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          '${role.title} için listede atanabilir kullanıcı yok. Yeni kullanıcı oluşturarak devam edebilirsin.',
                          style: Theme.of(
                            sheetContext,
                          ).textTheme.bodySmall?.copyWith(height: 1.4),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () async {
                          Navigator.of(sheetContext).pop();
                          await pageNavigator.push(
                            MaterialPageRoute(
                              builder: (_) => role.title == 'Muhasebeci'
                                  ? const AdminAccountingRegistrationPage()
                                  : const AdminStaffRegistrationPage(),
                            ),
                          );
                          if (mounted) {
                            setState(() {});
                          }
                        },
                        icon: const Icon(Icons.person_add_alt_1_outlined),
                        label: Text(
                          role.title == 'Muhasebeci'
                              ? 'Listede yok mu? Muhasebe Hesabi Oluştur'
                              : 'Listede yok mu? Yeni Kullanıcı Oluştur',
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (candidates.isNotEmpty) ...[
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: assignAsExtraRole,
                        onChanged: (value) {
                          setSheetState(() => assignAsExtraRole = value);
                        },
                        title: const Text('Ek yetki olarak ekle'),
                        subtitle: const Text(
                          'Ana rolü değiştirmeden bu role ek erişim ver',
                        ),
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<_AssignedPerson>(
                        initialValue: selected,
                        decoration: const InputDecoration(
                          labelText: 'Kullanıcı',
                          border: OutlineInputBorder(),
                        ),
                        items: candidates
                            .map(
                              (person) => DropdownMenuItem<_AssignedPerson>(
                                value: person,
                                child: Text(
                                  '${person.displayName} • ${person.subtitle}',
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          setSheetState(() => selected = value);
                        },
                      ),
                      const SizedBox(height: 16),
                    ],
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: candidates.isEmpty
                            ? null
                            : () async {
                                if (selected == null ||
                                    selected!.username.isEmpty) {
                                  Navigator.pop(sheetContext);
                                  return;
                                }
                                final messenger = ScaffoldMessenger.of(context);
                                final navigator = Navigator.of(sheetContext);
                                if (assignAsExtraRole) {
                                  await AdminDirectoryApiService.instance
                                      .addExtraRole(
                                        username: selected!.username,
                                        roleName: _toApiRole(role.title),
                                      );
                                } else {
                                  await AdminDirectoryApiService.instance
                                      .assignPrimaryRole(
                                        username: selected!.username,
                                        primaryRole: _toApiRole(role.title),
                                        departmentOrBranch: _mappedDepartment(
                                          role,
                                        ),
                                      );
                                }
                                await _loadDirectoryData();
                                if (!mounted) return;
                                navigator.pop();
                                messenger.showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      assignAsExtraRole
                                          ? '${selected!.displayName} için ${role.title} ek yetkisi tanımlandı.'
                                          : '${selected!.displayName} ${role.title} rolüne atandı.',
                                    ),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              },
                        child: const Text('Atamayı Kaydet'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  List<_AssignedPerson> _assignableCandidatesFor(_RoleProfile role) {
    if (role.title == 'Yönetici') return const [];
    return _staffRecords
        .map(
          (person) => _AssignedPerson(
            displayName: person.fullName,
            subtitle: '${person.departmentOrBranch} • ${person.campus}',
            username: person.username,
            isActive: person.status == 'Active',
            extraRoles: person.extraRoles.map(_toUiRole).toList(),
            canUndo: person.hasRoleHistory,
          ),
        )
        .toList();
  }

  String _mappedDepartment(_RoleProfile role) {
    switch (role.title) {
      case 'Muhasebeci':
        return 'Muhasebe';
      case 'İdari Birimler':
        return 'Öğrenci Isleri';
      case 'Öğretmen':
        return 'Genel Öğretmen';
      default:
        return 'Genel';
    }
  }

  Future<void> _undoLastAssignment(_AssignedPerson person) async {
    if (!person.canUndo || person.username.isEmpty) return;
    final success = await AdminDirectoryApiService.instance
        .undoLastRoleAssignment(username: person.username);
    await _loadDirectoryData();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? '${person.displayName} için son rol ataması geri alındı.'
              : '${person.displayName} için geri alınacak atama bulunamadı.',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _toApiRole(String role) {
    switch (role) {
      case 'Yönetici':
        return 'Admin';
      case 'Öğretmen':
        return 'Teacher';
      case 'Muhasebeci':
        return 'Accounting';
      case 'İdari Birimler':
        return 'Administrative';
      case 'Veli':
        return 'Parent';
      case 'Öğrenci':
        return 'Student';
      default:
        return role;
    }
  }

  String _toUiRole(String role) {
    switch (role) {
      case 'Admin':
        return 'Yönetici';
      case 'Teacher':
        return 'Öğretmen';
      case 'Accounting':
        return 'Muhasebeci';
      case 'Administrative':
        return 'İdari Birimler';
      case 'Parent':
        return 'Veli';
      case 'Student':
        return 'Öğrenci';
      default:
        return role;
    }
  }
}

class _RoleProfile {
  final String title;
  final String description;
  final String mainGoal;
  final String riskNote;
  final Color color;
  final IconData icon;
  bool isActive;
  bool requiresApprovalForCriticalActions;
  bool loginEnabled;
  String messagingScope;
  final Map<String, bool> moduleAccess;
  final List<String> criticalPowers;
  final List<String> assignedUsers;

  _RoleProfile({
    required this.title,
    required this.description,
    required this.mainGoal,
    required this.riskNote,
    required this.color,
    required this.icon,
    required this.isActive,
    required this.requiresApprovalForCriticalActions,
    required this.loginEnabled,
    required this.messagingScope,
    required this.moduleAccess,
    required this.criticalPowers,
    required this.assignedUsers,
  });
}

class _AssignedPerson {
  final String displayName;
  final String subtitle;
  final String username;
  final bool isActive;
  final bool canToggle;
  final List<String> extraRoles;
  final bool canUndo;

  const _AssignedPerson({
    required this.displayName,
    required this.subtitle,
    required this.username,
    required this.isActive,
    this.canToggle = true,
    this.extraRoles = const [],
    this.canUndo = false,
  });
}
