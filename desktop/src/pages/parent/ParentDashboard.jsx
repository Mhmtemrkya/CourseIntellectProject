import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Coins,
  FileText,
  GraduationCap,
  Mail,
  Megaphone,
  NotebookTabs,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchParentDashboardData } from '../../lib/api/dashboardData';
import { MiniLineChart } from '../../components/ui/premium-dashboard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

const panel =
  'rounded-[12px] border border-foreground/[0.08] bg-[linear-gradient(180deg,rgba(7,31,57,0.84),rgba(5,23,43,0.78))] shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-2xl';

const iconTones = {
  blue: 'from-blue-500/30 to-blue-600/10 text-blue-300 shadow-blue-500/20',
  green: 'from-emerald-500/30 to-emerald-600/10 text-emerald-300 shadow-emerald-500/20',
  orange: 'from-orange-500/30 to-orange-600/10 text-orange-300 shadow-orange-500/20',
  purple: 'from-purple-500/30 to-purple-600/10 text-purple-300 shadow-purple-500/20',
  cyan: 'from-cyan-500/30 to-cyan-600/10 text-cyan-300 shadow-cyan-500/20',
};

function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'Ö';
}

function IconBox({ icon: Icon, tone = 'blue' }) {
  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br shadow-[0_0_28px] ${iconTones[tone] || iconTones.blue}`}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

function StatCard({ icon, tone, label, value, sub, donut }) {
  return (
    <motion.div variants={itemVariants} className={`${panel} flex min-h-[104px] items-center gap-4 p-4`}>
      {donut ? (
        <div className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#a855f7 ${Number(value || 0) * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
          <div className="h-11 w-11 rounded-full bg-[hsl(var(--ci-card))]" />
        </div>
      ) : (
        <IconBox icon={icon} tone={tone} />
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-300">{label}</p>
        <p className="mt-1 text-[28px] font-black leading-none tracking-[-0.04em] text-white">{value}</p>
        <p className="mt-2 text-xs text-slate-400">{sub}</p>
      </div>
    </motion.div>
  );
}

function Section({ title, action, children, className = '' }) {
  return (
    <motion.section variants={itemVariants} className={`${panel} p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-black tracking-[-0.02em] text-white">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function EmptyBlock({ title = 'Kayıt yok', description = 'Bu bölüm için canlı veri bulunamadı.' }) {
  return (
    <div className="rounded-[12px] border border-foreground/[0.06] bg-foreground/[0.025] p-6 text-center">
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function ChildCard({ child, summary, upcomingExamCount = 0 }) {
  const score = Number(summary?.lastExam?.score || 0);
  const attendance = Number(summary?.attendance || 0);
  const trendValues = Array.isArray(summary?.examTrend) ? summary.examTrend : [];

  return (
    <div className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.035] p-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-[66px] w-[66px] border border-foreground/10">
          <AvatarFallback className="bg-[hsl(var(--brand-accent))] text-lg font-black text-white">
            {initials(child.fullName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-black text-white">{child.fullName}</p>
          <p className="text-xs text-slate-400">{child.className || 'Sınıf bilgisi yok'}</p>
          <Badge className="mt-1 bg-emerald-500/15 text-emerald-300">Aktif</Badge>
        </div>
      </div>
      <div className="my-4 h-px bg-foreground/[0.08]" />
      <p className="text-xs text-slate-400">Ortalama Başarı</p>
      <div className="mt-1 grid grid-cols-[88px_1fr] items-end gap-3">
        <p className="text-[26px] font-black text-white">{summary?.lastExam ? `${score}%` : '-'}</p>
        {trendValues.length ? <MiniLineChart values={trendValues} className="h-9" /> : <p className="pb-2 text-xs text-slate-500">Sınav trendi yok</p>}
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">Devam Durumu</span>
          <span className="font-black text-white">{attendance}%</span>
        </div>
        <Progress value={attendance} className="h-2" />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.035] p-3">
        <IconBox icon={GraduationCap} tone="orange" />
        <div>
          <p className="text-xs text-slate-400">Yaklaşan Sınav</p>
          <p className="text-sm font-bold text-white">{upcomingExamCount} sınav</p>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value, currency = 'TRY') {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('tr-TR')} ₺`;
  }
}

function formatDateLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ListRow({ icon: Icon, tone = 'blue', title, sub, meta, metaClass = 'text-slate-400' }) {
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.025] p-3">
      <IconBox icon={Icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>
      </div>
      {meta ? <div className={`shrink-0 text-sm font-black ${metaClass}`}>{meta}</div> : null}
    </div>
  );
}

function AttendanceCircle({ name, className, value }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-white">{name}</p>
      <p className="text-xs text-slate-400">{className || 'Sınıf'}</p>
      <div className="mx-auto mt-3 grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(#4ade80 ${Number(value || 0) * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
        <div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-[hsl(var(--ci-card))]">
          <div>
            <p className="text-2xl font-black text-white">{value}%</p>
            <p className="text-[10px] text-slate-400">Devam Oranı</p>
          </div>
        </div>
      </div>
    </div>
  );
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const children = data?.children || [];
  const firstChild = data?.selectedChild || children[0] || null;
  const firstSummary = data?.selectedChildSummary || null;
  const childCards = useMemo(() => {
    const base = children.length ? children.slice(0, 2) : (firstChild ? [firstChild] : []);
    return base;
  }, [children, firstChild]);
  const announcements = data?.announcements || [];
  const todayLessons = data?.todayLessons || [];
  const pendingHomework = data?.pendingHomework || [];
  const upcomingExams = data?.upcomingExams || [];
  const finance = data?.finance || {};
  const examScores = Array.isArray(firstSummary?.examTrend) ? firstSummary.examTrend : [];
  const averageScore = examScores.length
    ? Math.round((examScores.reduce((sum, value) => sum + Number(value || 0), 0) / examScores.length) * 10) / 10
    : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Veli paneli hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="parent-home-board space-y-4 text-slate-100"
      data-testid="parent-dashboard-page"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="!text-[22px] !normal-case !tracking-[-0.03em] !text-white">Merhaba, {user?.name || 'Veli'} 👋</h1>
          <p className="mt-1 text-sm text-slate-400">Çocuğunuzun eğitim sürecini birlikte takip edelim.</p>
        </div>
      </div>

      {error ? <ErrorBanner title="Veli verisi alınamadı" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid gap-3 xl:grid-cols-5">
        <StatCard icon={Users} tone="blue" label="Toplam Çocuğum" value={children.length} sub="Canlı öğrenci bağlantısı" />
        <StatCard icon={Wallet} tone="green" label="Kalan Borç" value={formatMoney(finance.totalDebt, finance.currency)} sub={finance.overdueCount ? `${finance.overdueCount} geciken taksit` : 'Güncel bakiye'} />
        <StatCard icon={FileText} tone="orange" label="Bekleyen Ödev" value={pendingHomework.length} sub="Teslim edilmemiş ödev" />
        <StatCard icon={CreditCard} tone="purple" label="Kalan Taksitlerim" value={finance.remainingInstallments || 0} sub={finance.nextDue ? `Sıradaki: ${formatDateLabel(finance.nextDue)}` : 'Ödenecek taksit'} />
        <StatCard label="Ortalama Başarı" value={averageScore} sub="Sınav sonuçlarından" donut />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_0.74fr]">
        <div className="space-y-3">
          <Section title="Çocuklarım" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/children')}>Tüm Çocuklarımın Detayları <ChevronRight className="h-4 w-4" /></Button>}>
            <div className="grid gap-3 md:grid-cols-2">
              {childCards.length ? childCards.map((child) => {
                const summary = data?.childSummaries?.[child.fullName] || null;
                const classKey = String(child.className || '').trim().toLowerCase();
                const childUpcomingExamCount = upcomingExams.filter((exam) => !exam.className || String(exam.className).trim().toLowerCase() === classKey).length;
                return <ChildCard key={child.username || child.fullName} child={child} summary={summary} upcomingExamCount={childUpcomingExamCount} />;
              }) : <EmptyBlock title="Bağlı çocuk yok" description="Bu veli hesabına bağlı öğrenci bulunamadı." />}
            </div>
          </Section>

          <Section title="Ödevlerim" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/children')}>Tüm Ödevler</Button>}>
            <div className="space-y-2">
              {pendingHomework.length ? pendingHomework.map((item, index) => (
                <ListRow
                  key={item.id || `${item.subject}-${item.title}`}
                  icon={ClipboardList}
                  tone={index % 2 === 0 ? 'blue' : 'orange'}
                  title={`${item.subject || 'Ödev'} - ${item.title || 'Başlıksız'}`}
                  sub={item.className || firstChild?.className || 'Sınıf bilgisi yok'}
                  meta={item.deadline ? formatDateLabel(item.deadline) : item.status}
                  metaClass="text-orange-300"
                />
              )) : <EmptyBlock title="Bekleyen ödev yok" description="Canlı ödev kayıtlarında bekleyen ödev bulunamadı." />}
            </div>
          </Section>
        </div>

        <div className="space-y-3">
          <Section title="Bugünkü Ders Programı" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/schedule')}>Tüm Program</Button>}>
            <div className="space-y-2">
              {todayLessons.length ? todayLessons.map((lesson, index) => (
                <ListRow
                  key={`${lesson.time}-${lesson.subject}-${index}`}
                  icon={BookOpen}
                  tone={index % 2 === 0 ? 'blue' : 'purple'}
                  title={lesson.subject}
                  sub={`${lesson.time || 'Saat yok'} • ${lesson.teacher || 'Öğretmen yok'}`}
                  meta={lesson.class || firstChild?.className || ''}
                  metaClass="text-slate-300"
                />
              )) : <EmptyBlock title="Bugün ders yok" description="Ders programında bugün için canlı kayıt bulunamadı." />}
            </div>
          </Section>

          <Section title="Devam Durumu Özeti" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/attendance')}>Tüm Rapor</Button>}>
            <div className="grid grid-cols-2 gap-4">
              {childCards.length ? childCards.map((child) => {
                const summary = data?.childSummaries?.[child.fullName] || {};
                return <AttendanceCircle key={child.fullName} name={child.fullName} className={child.className} value={summary.attendance || 0} />;
              }) : <EmptyBlock title="Devam verisi yok" description="Bağlı öğrenci olmadığı için yoklama özeti üretilemedi." />}
            </div>
            <div className="mt-4 flex justify-center gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Devam</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> İzinli</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Devamsız</span>
            </div>
          </Section>
        </div>

        <aside className="space-y-3">
          <Section title="Okul Duyuruları" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/announcements')}>Tümünü Gör</Button>}>
            <div className="space-y-2">
              {announcements.length ? announcements.slice(0, 3).map((item, index) => (
                <ListRow key={item.id || item.title} icon={index === 0 ? Users : index === 1 ? Bell : Megaphone} tone={index === 0 ? 'purple' : index === 1 ? 'purple' : 'orange'} title={item.title} sub={item.dateLabel || item.date || 'Bugün'} />
              )) : <EmptyBlock title="Duyuru yok" description="Veli hedefli canlı duyuru bulunamadı." />}
            </div>
          </Section>

          <Section title="Hızlı İşlemler">
            <div className="grid grid-cols-4 gap-2">
              {[
                ['Ödevleri Görüntüle', ClipboardList, 'orange', '/p/children'],
                ['Notları İncele', NotebookTabs, 'purple', '/p/exams'],
                ['Devam Durumu', CheckCircle2, 'green', '/p/attendance'],
                ['Mesaj Gönder', Mail, 'blue', '/chat'],
              ].map(([label, Icon, tone, path]) => (
                <button key={label} type="button" onClick={() => navigate(path)} className="rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.04] p-3 text-center transition hover:border-[hsl(var(--brand-accent)/0.45)] hover:bg-[hsl(var(--brand-accent)/0.10)]">
                  <div className="mx-auto mb-2">
                    <IconBox icon={Icon} tone={tone} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-200">{label}</span>
                </button>
              ))}
            </div>
          </Section>
        </aside>
      </div>

      <Section title="Finansal Özet" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/payments')}>Ödeme Merkezi <ChevronRight className="h-4 w-4" /></Button>}>
        {(finance.netTotal || finance.paidTotal || finance.totalDebt) ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center gap-3 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.025] p-4">
                <IconBox icon={Wallet} tone="green" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Kalan Borç</p>
                  <p className="mt-1 text-xl font-black text-white">{formatMoney(finance.totalDebt, finance.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.025] p-4">
                <IconBox icon={CheckCircle2} tone="blue" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Ödenen Tutar</p>
                  <p className="mt-1 text-xl font-black text-white">{formatMoney(finance.paidTotal, finance.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.025] p-4">
                <IconBox icon={CreditCard} tone="purple" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Kalan Taksit</p>
                  <p className="mt-1 text-xl font-black text-white">{finance.remainingInstallments || 0} <span className="text-sm font-bold text-slate-400">/ {finance.totalInstallments || 0}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.025] p-4">
                <IconBox icon={Coins} tone={finance.overdueCount ? 'orange' : 'cyan'} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Geciken Taksit</p>
                  <p className="mt-1 text-xl font-black text-white">{finance.overdueCount || 0}</p>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Ödeme İlerlemesi</span>
                <span className="font-black text-white">
                  {finance.netTotal ? Math.round((Number(finance.paidTotal || 0) / Number(finance.netTotal)) * 100) : 0}%
                </span>
              </div>
              <Progress value={finance.netTotal ? Math.min(100, Math.round((Number(finance.paidTotal || 0) / Number(finance.netTotal)) * 100)) : 0} className="h-2" />
              <p className="mt-2 text-xs text-slate-400">
                Toplam tutar {formatMoney(finance.netTotal, finance.currency)}{finance.nextDue ? ` • Sıradaki ödeme: ${formatDateLabel(finance.nextDue)}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <EmptyBlock title="Finansal kayıt yok" description="Çocuğunuza ait kayıt ücreti veya taksit planı bulunamadı." />
        )}
      </Section>
    </motion.div>
  );
}
