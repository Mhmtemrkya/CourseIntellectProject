import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, GraduationCap, Wallet, Landmark, ChevronRight, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchMyScopeRollup } from '../../lib/api/modules';
import { setActiveTenantContext } from '../../lib/api/client';

const trNumber = (value) => new Intl.NumberFormat('tr-TR').format(Number(value || 0));
const trMoney = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(value || 0));

const TILES = [
  { key: 'students', label: 'Toplam Öğrenci', icon: GraduationCap, fmt: trNumber },
  { key: 'staff', label: 'Toplam Personel', icon: Users, fmt: trNumber },
  { key: 'branches', label: 'Toplam Şube', icon: Building2, fmt: trNumber },
  { key: 'collected', label: 'Toplam Tahsilat', icon: Wallet, fmt: trMoney },
  { key: 'monthlyFee', label: 'Aylık Ücret', icon: Landmark, fmt: trMoney },
];

export default function ConsolidatedOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyScopeRollup()
      .then((res) => setData(res || null))
      .catch(() => setError('Konsolide veriler alınamadı.'))
      .finally(() => setLoading(false));
  }, []);

  const openTenant = (tenantId) => {
    // Seçilen kuruma drill-down: bağlamı ayarla, şubeyi sıfırla (client), panele git.
    setActiveTenantContext(tenantId);
    navigate('/dashboard');
    window.location.reload();
  };

  if (loading) {
    return <div className="flex justify-center py-24"><LoadingDots /></div>;
  }
  if (error) {
    return <div className="py-24 text-center text-sm text-muted-foreground">{error}</div>;
  }

  const totals = data?.totals || {};
  const tenants = Array.isArray(data?.tenants) ? data.tenants : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2 text-white">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Konsolide Görünüm
            {data?.readOnly ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.06] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" /> Salt-okunur
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            Erişebildiğiniz {trNumber(data?.tenantCount)} kurumun toplamı. Kuruma tıklayarak detayına inin.
          </p>
        </div>
      </div>

      {/* Genel toplam kartları */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ key, label, icon: Icon, fmt }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totals[key])}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kurum karşılaştırma tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kurum Karşılaştırması</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.08] text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Kurum</th>
                <th className="px-4 py-2 text-right font-semibold">Öğrenci</th>
                <th className="px-4 py-2 text-right font-semibold">Personel</th>
                <th className="px-4 py-2 text-right font-semibold">Şube</th>
                <th className="px-4 py-2 text-right font-semibold">Tahsilat</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openTenant(t.id)}
                  className="cursor-pointer border-b border-foreground/[0.05] transition-colors hover:bg-foreground/[0.03]"
                >
                  <td className="px-4 py-3 font-semibold">{t.name}</td>
                  <td className="px-4 py-3 text-right">{trNumber(t.students)}</td>
                  <td className="px-4 py-3 text-right">{trNumber(t.staff)}</td>
                  <td className="px-4 py-3 text-right">{trNumber(t.branches)}</td>
                  <td className="px-4 py-3 text-right">{trMoney(t.collected)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </td>
                </tr>
              ))}
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Görüntülenecek kurum yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
