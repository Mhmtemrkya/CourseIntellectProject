import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users, GraduationCap, CalendarCheck, ClipboardList, CalendarClock, Megaphone, Wallet, CreditCard, AlertCircle, ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import RoleDashboardColumns from '../../components/dashboard/RoleDashboardColumns';
import { PremiumPanel, PremiumProgressRow, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useApp } from '../../context/AppContext';
import { fetchParentDashboardData } from '../../lib/api/dashboardData';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

function formatMoney(value, currency = 'TRY') {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY', maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch {
    return `${Math.round(Number(value) || 0).toLocaleString('tr-TR')} TL`;
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

export default function ParentDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchParentDashboardData(user));
    } catch (err) {
      setError(err.message || 'Veli paneli alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const children = data?.children || [];
  const selectedChild = data?.selectedChild || children[0] || null;
  const selectedSummary = data?.selectedChildSummary || null;
  const finance = data?.finance || {};
  const pendingHomework = data?.pendingHomework || [];
  const upcomingExams = data?.upcomingExams || [];
  const announcements = data?.announcements || [];

  const childSummaries = useMemo(() => children.map((child) => ({
    child,
    summary: data?.childSummaries?.[child.fullName] || (child.fullName === selectedChild?.fullName ? selectedSummary : null) || {},
  })), [children, data?.childSummaries, selectedChild?.fullName, selectedSummary]);

  const averageAttendance = childSummaries.length
    ? Math.round(childSummaries.reduce((sum, item) => sum + Number(item.summary.attendance || 0), 0) / childSummaries.length)
    : 0;
  const examTrend = Array.isArray(selectedSummary?.examTrend) ? selectedSummary.examTrend : [];
  const averageScore = examTrend.length
    ? Math.round(examTrend.reduce((sum, value) => sum + Number(value || 0), 0) / examTrend.length)
    : Number(selectedSummary?.lastExam?.score || 0);

  if (loading) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Veli paneli hazırlanıyor...</p></div>;
  }

  const groups = [
    {
      key: 'children', title: 'Çocuklar ve Akademik', description: 'Bağlı öğrencilerin başarı ve devam özeti',
      cards: [
        { key: 'children', label: 'Bağlı Öğrenci', value: children.length, caption: 'Takip ettiğiniz çocuk', icon: Users, tone: 'blue', path: '/p/children' },
        { key: 'score', label: 'Ortalama Başarı', value: averageScore ? `%${averageScore}` : '—', caption: selectedChild?.className || 'Son sınav sonuçları', icon: GraduationCap, tone: 'brand', path: '/p/exams' },
        { key: 'attendance', label: 'Devam Oranı', value: `%${averageAttendance}`, caption: 'Çocukların ortalama devamı', icon: CalendarCheck, tone: 'emerald', path: '/p/attendance' },
      ],
    },
    {
      key: 'followup', title: 'Takip Edilecekler', description: 'Yakın tarihte aile aksiyonu gerektiren bilgiler',
      cards: [
        { key: 'homework', label: 'Bekleyen Ödev', value: pendingHomework.length, caption: 'Teslim edilmemiş çalışma', icon: ClipboardList, tone: 'amber', path: '/p/children' },
        { key: 'exams', label: 'Yaklaşan Sınav', value: upcomingExams.length, caption: 'Hazırlık gerektiren sınav', icon: CalendarClock, tone: 'violet', path: '/p/exams' },
        { key: 'announcements', label: 'Duyuru', value: announcements.length, caption: 'Okuldan önemli bilgilendirme', icon: Megaphone, tone: 'cyan', path: '/p/announcements' },
      ],
    },
    {
      key: 'finance', title: 'Ödemeler', description: 'Yalnız takip edilmesi gereken güncel finans bilgileri',
      cards: [
        { key: 'debt', label: 'Kalan Borç', value: formatMoney(finance.totalDebt, finance.currency), caption: 'Güncel toplam bakiye', icon: Wallet, tone: 'rose', path: '/p/payments' },
        { key: 'installments', label: 'Kalan Taksit', value: finance.remainingInstallments || 0, caption: finance.nextDue ? `Sıradaki: ${formatDate(finance.nextDue)}` : 'Ödenecek taksit', icon: CreditCard, tone: 'amber', path: '/p/payments' },
        { key: 'overdue', label: 'Geciken Taksit', value: finance.overdueCount || 0, caption: 'Kontrol edilmesi gereken', icon: AlertCircle, tone: 'rose', path: '/p/payments' },
      ],
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parent-dashboard-page">
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold font-heading">Veli Takip Merkezi</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.name || 'Veli'} · çocuklarınız için önemli akademik ve ödeme bilgileri</p>
      </motion.div>

      {error ? <ErrorBanner title="Veli paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}
      <RoleDashboardColumns groups={groups} navigate={navigate} testId="parent-dashboard-columns" />

      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Çocuklarım" description="Her çocuk için güncel durum" action={<Button size="sm" variant="ghost" onClick={() => navigate('/p/children')}>Detaylar <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-3">
            {childSummaries.length ? childSummaries.slice(0, 4).map(({ child, summary }) => <button key={child.username || child.fullName} type="button" onClick={() => navigate('/p/children')} className="w-full rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{child.fullName}</p><p className="text-xs text-muted-foreground">{child.className || 'Sınıf bilgisi yok'}</p></div><PremiumStatusPill tone="done">Aktif</PremiumStatusPill></div><div className="mt-3"><PremiumProgressRow title="Devam" subtitle="Güncel oran" value={summary.attendance || 0} valueLabel={`%${summary.attendance || 0}`} progress={summary.attendance || 0} tone="emerald" /></div></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bu hesaba bağlı öğrenci bulunmuyor.</p>}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Yaklaşan Akademik İşler" description="Ödev ve sınav hazırlıkları" contentClassName="space-y-2.5">
            {[...pendingHomework.slice(0, 3).map((item) => ({ title: item.title || item.subject || 'Ödev', detail: item.subject || selectedChild?.className, meta: item.deadline ? formatDate(item.deadline) : item.status, path: '/p/children' })), ...upcomingExams.slice(0, 2).map((item) => ({ title: item.title || item.subject || 'Sınav', detail: item.className || selectedChild?.className, meta: item.date ? formatDate(item.date) : 'Yakında', path: '/p/exams' }))].map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => navigate(item.path)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="text-xs text-muted-foreground">{item.detail}</span></span><span className="text-xs font-bold text-amber-500">{item.meta}</span></button>)}
            {!pendingHomework.length && !upcomingExams.length ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Yaklaşan akademik işlem yok.</p> : null}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Önemli Duyurular" description="Okuldan gelen son bilgilendirmeler" action={<Button size="sm" variant="ghost" onClick={() => navigate('/p/announcements')}>Tümü <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {announcements.length ? announcements.slice(0, 5).map((item, index) => <button key={item.id || `${item.title}-${index}`} type="button" onClick={() => navigate('/p/announcements')} className="w-full rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail || item.dateLabel || item.date}</p></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Yeni duyuru yok.</p>}
          </PremiumPanel>
        </motion.div>
      </div>
    </motion.div>
  );
}
