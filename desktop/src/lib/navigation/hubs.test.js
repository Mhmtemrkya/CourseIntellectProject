// ModernSidebar menü tanımı için import edilir; router/animasyon paketleri
// jest'te ESM alt yolu çözemediği için sahtelenir (test yalnız veriyi okur).
jest.mock('react-router-dom', () => ({
  NavLink: () => null,
  useLocation: () => ({ pathname: '/' }),
}));

import { ADMIN_HUBS, FINANCE_HUBS, collapseMenuHubs, findHubByPath } from './hubs';

const item = (path, label) => ({ path, label, icon: null, color: '#000' });

describe('collapseMenuHubs', () => {
  it('aynı hub üyelerini tek girişe katlar ve ilk üyenin sırasını korur', () => {
    const menu = [
      item('/dashboard', 'Dashboard'),
      item('/students', 'Öğrenciler'),
      item('/teachers', 'Öğretmenler'),
      item('/parents', 'Veliler'),
      item('/admin/staff', 'Personeller'),
      item('/settings', 'Ayarlar'),
    ];

    const result = collapseMenuHubs(menu);

    expect(result.map((entry) => entry.label)).toEqual(['Dashboard', 'Kişiler', 'Ayarlar']);
    const hub = result[1];
    expect(hub.path).toBe('/students');
    expect(hub.covers).toEqual(['/students', '/teachers', '/parents', '/admin/staff']);
  });

  it('role kapalı sekmeleri hub dışında bırakır, hub ilk GÖRÜNÜR sekmeye açılır', () => {
    // Menüye yalnız "Veliler" ve "Personeller" geldiyse (diğerleri filtrelendi)
    // hub bu ikisinden oluşur ve Veliler'e açılır.
    const result = collapseMenuHubs([item('/parents', 'Veliler'), item('/admin/staff', 'Personeller')]);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/parents');
    expect(result[0].covers).toEqual(['/parents', '/admin/staff']);
  });

  it("tek sekmesi kalan hub'u katlamaz — ekran kendi adıyla görünür", () => {
    const result = collapseMenuHubs([item('/admin/staff', 'Personeller'), item('/settings', 'Ayarlar')]);

    expect(result.map((entry) => entry.label)).toEqual(['Personeller', 'Ayarlar']);
  });

  it('hub üyesi olmayan girişleri olduğu gibi bırakır', () => {
    const menu = [item('/reports', 'Raporlar'), item('/chat', 'Mesajlar')];

    expect(collapseMenuHubs(menu)).toEqual(menu);
  });

  it('finans ekranlarını dört konu hub’ına indirir', () => {
    const financePaths = FINANCE_HUBS.flatMap((hub) => hub.tabs.map((tab) => tab.path));
    const menu = [
      item('/finance/dashboard', 'Muhasebe Özet'),
      item('/finance/student-accounts', 'Cari Hesaplar'),
      ...financePaths.map((path) => item(path, path)),
    ];

    const result = collapseMenuHubs(menu);

    // 2 sabit ekran + 4 hub
    expect(result).toHaveLength(6);
    expect(result.slice(2).map((entry) => entry.label)).toEqual([
      'Tahsilat',
      'Belgeler',
      'Gider & Bordro',
      'Rapor & Denetim',
    ]);
  });
});

describe('findHubByPath', () => {
  it('sekme adresinden hub’ı bulur', () => {
    expect(findHubByPath('/finance/installments')?.id).toBe('finance-collections');
    expect(findHubByPath('/admin/passive-records')?.id).toBe('admin-archive');
  });

  it('alt rotalarda da hub’ı korur', () => {
    expect(findHubByPath('/classes/7-a')?.id).toBe('admin-academics');
  });

  it('hub dışındaki adreste null döner', () => {
    expect(findHubByPath('/dashboard')).toBeNull();
    expect(findHubByPath('/finance/dashboard')).toBeNull();
  });
});

describe('hub tanımları', () => {
  it('aynı yol iki hub’a birden ait olamaz', () => {
    const seen = new Set();
    [...FINANCE_HUBS, ...ADMIN_HUBS].forEach((hub) => {
      hub.tabs.forEach((tab) => {
        expect(seen.has(tab.path)).toBe(false);
        seen.add(tab.path);
      });
    });
  });
});

describe('yönetici menüsü boyutu', () => {
  it('kurum yöneticisinin menüsünü belirgin şekilde kısaltır', () => {
    // eslint-disable-next-line global-require
    const { menuConfigs } = require('../../components/layout/ModernSidebar');
    const admin = menuConfigs.admin;
    const collapsed = collapseMenuHubs(admin);

    // Katlama hiçbir ekranı kaybetmemeli: her giriş ya menüde ya bir hub'ın içinde.
    const reachable = new Set(
      collapsed.flatMap((entry) => (entry.covers?.length ? entry.covers : [entry.path])),
    );
    admin.forEach((entry) => expect(reachable.has(entry.path)).toBe(true));

    expect(collapsed.length).toBeLessThan(admin.length * 0.7);
  });
});
