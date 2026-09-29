import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, MessageSquare, Receipt, ExternalLink, ShieldCheck, Megaphone, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import RoleDashboardColumns from '../../components/dashboard/RoleDashboardColumns';
import { fetchAdminDashboardData } from '../../lib/api/dashboardData';
import { fetchAccountingDashboard, fetchAdminAnalytics } from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';
import { getUserRoles } from '../../lib/permissions';

const PERIOD_OPTIONS = [
  ['day', 'Günlük'],
  ['week', 'Haftalık'],
  ['month', 'Aylık'],
  ['year', 'Yıllık'],
];

const moneyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0);
}

// Kart metrikleri (kayıt/kazanç/gider) seçilen dönemin kayan penceresine göre
// gelsin — giriş kartıyla ("bugün / son 7 gün / son 30 gün / son 1 yıl") aynı
// mantık. Aksi halde analytics.totals tüm grafik penceresini toplar ve dönemler
// arası değişmez. UTC gün başlangıcı kullanılır (backend DateTime.UtcNow.Date ile hizalı).
function periodRange(period) {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  if (period === 'week') from.setUTCDate(from.getUTCDate() - 6);
  else if (period === 'month') from.setUTCDate(from.getUTCDate() - 29);
  else if (period === 'year') from.setUTCDate(from.getUTCDate() - 364);
  // 'day' → from === to (yalnızca bugün)
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export default function AdminOperations() {
  const navigate = useNavigate();
  const { user } = useApp();
  // İdari personel (yalnızca administrative rolü) finans/ziyaretçi metriklerini görmez;
  // bu metrikler kurum yöneticisine (admin) özeldir.
  const isAdministrativeOnly = useMemo(() => {
    const roles = getUserRoles(user);
    return roles.includes('administrative') && !roles.includes('admin') && !roles.includes('superadmin');
  }, [user]);
  const [dashboard, setDashboard] = useState(null);
  const [finance, setFinance] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [period, setPeriod] = useState('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, financeData] = await Promise.all([
        fetchAdminDashboardData(),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setDashboard(dashboardData);
      setFinance(financeData);
    } catch (err) {
      setError(err.message || 'Operasyon görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const { from, to } = periodRange(period);
      const result = await fetchAdminAnalytics({ period, from, to });
      setAnalytics(result);
    } catch {
      setAnalytics(null);
    }
  }, [period]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const activeStudents = dashboard?.activeStudentStats?.[period] || { uniqueCount: 0, totalStudents: dashboard?.stats?.totalStudents || 0 };
  const totals = analytics?.totals || { revenue: 0, registrations: 0, expense: 0, net: 0 };

  const operationGroups = [
    {
      key: 'students', title: 'Öğrenci İşlemleri', description: 'Seçilen dönemde öğrenci hareketleri',
      cards: [
        { key: 'registrations', label: 'Yeni Kayıt', value: totals.registrations || 0, caption: 'Seçilen dönemde kaydedilen', icon: CalendarDays, tone: 'emerald', path: '/admin/student-registration' },
        { key: 'active', label: 'Aktif Öğrenci', value: activeStudents.uniqueCount, caption: `${activeStudents.totalStudents} toplam öğrenci`, icon: MessageSquare, tone: 'blue', path: '/students' },
      ],
    },
    {
      key: 'communication', title: 'İletişim', description: 'Duyuru ve görüşme hareketleri',
      cards: [
        { key: 'announcements', label: 'Duyuru', value: dashboard?.activities?.length || 0, caption: 'Kurum geneli bilgilendirme', icon: Megaphone, tone: 'violet', path: '/admin/announcements' },
        { key: 'meetings', label: 'Görüşme Akışı', value: dashboard?.activities?.length || 0, caption: 'Veli ve öğretmen görüşmeleri', icon: CalendarDays, tone: 'amber', path: '/admin/meetings' },
      ],
    },
    {
      key: 'pending', title: 'Bekleyen İşler', description: 'Operasyon ekibinin ele alması gereken kayıtlar',
      cards: [
        { key: 'pendingItems', label: 'Bekleyen İşlem', value: dashboard?.pendingItems?.length || 0, caption: 'Geri dönüş veya işlem bekliyor', icon: Activity, tone: 'rose', path: '/admin/task-center' },
        ...(!isAdministrativeOnly ? [{ key: 'approvals', label: 'Finans Onayı', value: finance?.approvals?.length || 0, caption: 'Karar bekleyen finans kaydı', icon: Receipt, tone: 'amber', path: '/admin/finance-approvals' }] : []),
      ],
    },
    ...(!isAdministrativeOnly ? [{
      key: 'finance', title: 'Finans Özeti', description: 'Seçilen dönemin temel finans hareketleri',
      cards: [
        { key: 'revenue', label: 'Dönem Kazancı', value: formatMoney(totals.revenue), caption: 'Tahsilat toplamı', icon: Receipt, tone: 'emerald', path: '/finance/collections' },
        { key: 'expense', label: 'Dönem Gideri', value: formatMoney(totals.expense), caption: 'Maaş ve fatura gideri', icon: Receipt, tone: 'rose', path: '/finance/expenses' },
      ],
    }] : []),
  ];

  const operationalFeed = useMemo(() => (
    [
      ...(dashboard?.pendingItems || []).map((item) => ({
        id: `pending-${item.id}`,
        title: item.studentName,
        detail: item.question,
        subject: item.subject,
        route: '/admin/task-center',
      })),
      ...(isAdministrativeOnly ? [] : (finance?.approvals || []).slice(0, 4).map((item) => ({
        id: `finance-${item.id}`,
        title: item.referenceNumber || 'Finans onayı',
        detail: `${item.status || 'Bekliyor'} • ${item.type || 'Islem'}`,
        subject: 'Finans',
        route: '/admin/finance-approvals',
      }))),
    ].slice(0, 8)
  ), [dashboard, finance, isAdministrativeOnly]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-operations-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Operasyon Merkezi</h1>
          <p className="text-muted-foreground mt-1">Yönetici için birleşik operasyon görünümü — tüm metrikler seçilen döneme göre</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1">
          {PERIOD_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${period === value ? 'bg-brand-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error ? <ErrorBanner title="Operasyon verisi alınamadı" message={error} onRetry={loadOperations} /> : null}
      <RoleDashboardColumns groups={operationGroups} navigate={navigate} testId="administrative-dashboard-columns" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-green-600" />Canlı görev akışı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {operationalFeed.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.subject}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>Detay</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(item.route)}>Aç</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem?.title || 'Operasyon detayı'}</DialogTitle>
            <DialogDescription>Operasyon akışındaki seçili kaydın ayrıntısı.</DialogDescription>
          </DialogHeader>
          {selectedItem ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedItem.subject}</Badge>
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedItem.detail}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Kapat</Button>
            {selectedItem ? (
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate(selectedItem.route)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                İlgili Akışı Aç
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
