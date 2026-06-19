import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Mail,
  Megaphone,
  MessageSquare,
  NotebookTabs,
  Users,
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
  'rounded-[12px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(7,31,57,0.84),rgba(5,23,43,0.78))] shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-2xl';

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

function scoreLetter(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
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
          <div className="h-11 w-11 rounded-full bg-[#06152A]" />
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

function ChildCard({ child, summary, index }) {
  const score = Number(summary?.lastExam?.score || 0);
  const attendance = Number(summary?.attendance || 0);
  const values = [score - 8, score - 2, score - 10, score + 4, score - 1, score + 7, score + index * 3].map((v) => Math.max(12, Math.min(100, v || 70)));

  return (
    <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-[66px] w-[66px] border border-white/10">
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
      <div className="my-4 h-px bg-white/[0.08]" />
      <p className="text-xs text-slate-400">Ortalama Başarı</p>
      <div className="mt-1 grid grid-cols-[88px_1fr] items-end gap-3">
        <p className="text-[26px] font-black text-white">{score || 0}%</p>
        <MiniLineChart values={values} className="h-9" />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">Devam Durumu</span>
          <span className="font-black text-white">{attendance}%</span>
        </div>
        <Progress value={attendance} className="h-2" />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.035] p-3">
        <IconBox icon={GraduationCap} tone="orange" />
        <div>
          <p className="text-xs text-slate-400">Yaklaşan Sınav</p>
          <p className="text-sm font-bold text-white">1 sınav</p>
        </div>
      </div>
    </div>
  );
}

function ListRow({ icon: Icon, tone = 'blue', title, sub, meta, metaClass = 'text-slate-400' }) {
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-white/[0.06] bg-white/[0.025] p-3">
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
        <div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-[#06152A]">
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
  const firstSummary = data?.selectedChildSummary || { attendance: 0, lastExam: { subject: 'Henüz kayıt yok', score: 0 }, pendingPayment: 0 };
  const secondChild = children[1] || null;
  const childCards = useMemo(() => {
    const base = children.length ? children.slice(0, 2) : (firstChild ? [firstChild] : []);
    return base;
  }, [children, firstChild]);
  const secondSummary = secondChild ? { ...firstSummary, attendance: Math.max(0, firstSummary.attendance - 4), lastExam: { ...firstSummary.lastExam, score: Math.max(0, Number(firstSummary.lastExam?.score || 0) - 7) } } : firstSummary;
  const exams = data?.exams || [];
  const announcements = data?.announcements || [];
  const attendance = data?.attendanceBreakdown || {};

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
          <h1 className="!text-[22px] !normal-case !tracking-[-0.03em] !text-white">Merhaba, {user?.name || 'Ayşe Yılmaz'} 👋</h1>
          <p className="mt-1 text-sm text-slate-400">Çocuğunuzun eğitim sürecini birlikte takip edelim.</p>
        </div>
      </div>

      {error ? <ErrorBanner title="Veli verisi alınamadı" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid gap-3 xl:grid-cols-5">
        <StatCard icon={Users} tone="blue" label="Toplam Çocuğum" value={children.length || 1} sub="Aktif öğrenci" />
        <StatCard icon={CalendarDays} tone="green" label="Bugünkü Ders" value="6" sub="Toplam 5 ders" />
        <StatCard icon={FileText} tone="orange" label="Bekleyen Ödev" value="3" sub="Toplam 3 ödev" />
        <StatCard icon={ClipboardList} tone="purple" label="Yaklaşan Sınav" value={Math.max(1, exams.length || 2)} sub="Önümüzdeki 7 gün" />
        <StatCard label="Ortalama Başarı" value={Number(firstSummary?.lastExam?.score || 0) || 78.6} sub="Genel ortalama" donut />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_0.74fr]">
        <div className="space-y-3">
          <Section title="Çocuklarım" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/children')}>Tüm Çocuklarımın Detayları <ChevronRight className="h-4 w-4" /></Button>}>
            <div className="grid gap-3 md:grid-cols-2">
              {childCards.map((child, index) => (
                <ChildCard key={child.username || child.fullName} child={child} summary={index === 0 ? firstSummary : secondSummary} index={index} />
              ))}
            </div>
          </Section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Section title="Son Sınav Sonuçları" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/exams')}>Tüm Sonuçlar</Button>}>
              <div className="space-y-2">
                {(exams.length ? exams : [
                  { subject: firstSummary?.lastExam?.subject || 'Matematik 2. Dönem 1. Yazılı', score: firstSummary?.lastExam?.score || 85, className: firstChild?.className },
                  { subject: 'Fizik 2. Dönem 1. Yazılı', score: 92, className: firstChild?.className },
                  { subject: 'İngilizce 2. Dönem 1. Yazılı', score: 78, className: firstChild?.className },
                ]).slice(0, 3).map((exam, index) => {
                  const score = Number(exam.score || 0);
                  return (
                    <ListRow key={`${exam.subject}-${index}`} icon={NotebookTabs} tone={index === 0 ? 'purple' : index === 1 ? 'orange' : 'cyan'} title={exam.subject || 'Sınav'} sub={exam.className || firstChild?.className || 'Sınıf'} meta={`${score} ${scoreLetter(score)}`} metaClass={score >= 85 ? 'text-blue-300' : 'text-emerald-300'} />
                  );
                })}
              </div>
            </Section>

            <Section title="Son Ödevler" action={<Button variant="ghost" size="sm">Tüm Ödevler</Button>}>
              <div className="space-y-2">
                {[
                  ['Matematik - Problemler', firstChild?.className, 'Teslim Edildi', 'blue', 'text-emerald-300'],
                  ['Türk Dili - Kompozisyon', firstChild?.className, 'Kontrol Ediliyor', 'orange', 'text-orange-300'],
                  ['Fizik - Laboratuvar Raporu', firstChild?.className, 'Teslim Edildi', 'blue', 'text-emerald-300'],
                ].map(([title, sub, meta, tone, metaClass]) => (
                  <ListRow key={title} icon={ClipboardList} tone={tone} title={title} sub={sub || 'Sınıf'} meta={meta} metaClass={metaClass} />
                ))}
              </div>
            </Section>
          </div>
        </div>

        <div className="space-y-3">
          <Section title="Bugünkü Ders Programı" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/schedule')}>Tüm Program</Button>}>
            <div className="space-y-2">
              {[
                ['08:30 - 09:15', 'Matematik', 'Ahmet K.', 'Devam Ediyor', 'blue'],
                ['09:20 - 10:05', 'Türk Dili ve Edebiyatı', 'Zeynep T.', 'Devam Ediyor', 'orange'],
                ['10:20 - 11:05', 'Fizik', 'Mehmet S.', 'Sıradaki', 'purple'],
                ['11:20 - 12:05', 'İngilizce', 'Canan D.', 'Yaklaşan', 'cyan'],
                ['13:30 - 14:15', 'Kimya', 'Elif B.', 'Yaklaşan', 'green'],
              ].map(([time, lesson, teacher, status, tone]) => (
                <ListRow key={`${time}-${lesson}`} icon={BookOpen} tone={tone} title={lesson} sub={`${time} • ${firstChild?.className || '10-A'}`} meta={status} metaClass={status === 'Devam Ediyor' ? 'text-emerald-300' : status === 'Sıradaki' ? 'text-orange-300' : 'text-slate-400'} />
              ))}
            </div>
          </Section>

          <Section title="Devam Durumu Özeti" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/attendance')}>Tüm Rapor</Button>}>
            <div className="grid grid-cols-2 gap-4">
              <AttendanceCircle name={firstChild?.fullName || 'Öğrenci'} className={firstChild?.className} value={attendance.rate || firstSummary.attendance || 0} />
              <AttendanceCircle name={secondChild?.fullName || 'Öğrenci'} className={secondChild?.className || firstChild?.className} value={Math.max(0, (attendance.rate || firstSummary.attendance || 0) - 4)} />
            </div>
            <div className="mt-4 flex justify-center gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Devam</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> İzinli</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Devamsız</span>
            </div>
          </Section>
        </div>

        <aside className="space-y-3">
          <Section title="Yaklaşan Etkinlikler" action={<Button variant="ghost" size="sm">Tümünü Gör</Button>}>
            <div className="space-y-2">
              {[
                ['Veli Toplantısı', '11 Haziran 2026 - 14:00', '4 gün kaldı', CalendarDays, 'purple'],
                ['Bilim Şenliği', '20 Haziran 2026', '13 gün kaldı', GraduationCap, 'orange'],
                ['Dönem Sonu Gösterisi', '30 Haziran 2026', '23 gün kaldı', Megaphone, 'blue'],
                ['Yaz Tatili Başlangıcı', '15 Temmuz 2026', '38 gün kaldı', Bell, 'orange'],
              ].map(([title, sub, meta, Icon, tone]) => (
                <ListRow key={title} icon={Icon} tone={tone} title={title} sub={sub} meta={meta} metaClass="text-emerald-300" />
              ))}
            </div>
          </Section>

          <Section title="Okul Duyuruları" action={<Button variant="ghost" size="sm" onClick={() => navigate('/p/announcements')}>Tümünü Gör</Button>}>
            <div className="space-y-2">
              {(announcements.length ? announcements : [
                { title: 'Kütüphane Haftası Etkinlikleri', dateLabel: '26 Mayıs 2026' },
                { title: 'Yaz Okulu Kayıtları Başladı', dateLabel: '24 Mayıs 2026' },
                { title: 'Servis Saatlerinde Düzenleme', dateLabel: '22 Mayıs 2026' },
              ]).slice(0, 3).map((item, index) => (
                <ListRow key={item.id || item.title} icon={index === 0 ? Users : index === 1 ? Bell : Megaphone} tone={index === 0 ? 'purple' : index === 1 ? 'purple' : 'orange'} title={item.title} sub={item.dateLabel || item.date || 'Bugün'} />
              ))}
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
                <button key={label} type="button" onClick={() => navigate(path)} className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-3 text-center transition hover:border-[hsl(var(--brand-accent)/0.45)] hover:bg-[hsl(var(--brand-accent)/0.10)]">
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

      <Section title="Son Aktiviteler" action={<Button variant="ghost" size="sm">Tüm Aktiviteler</Button>}>
        <div className="grid gap-3 xl:grid-cols-4">
          {[
            [firstChild?.fullName || 'Öğrenci', 'Matematik ödevini teslim etti.', '26 Mayıs 2026 - 14:30', Users, 'purple'],
            [secondChild?.fullName || firstChild?.fullName || 'Öğrenci', 'Fizik sınavından 92 aldı.', '26 Mayıs 2026 - 11:15', FileText, 'orange'],
            [firstChild?.fullName || 'Öğrenci', 'Devam durumu güncellendi.', '25 Mayıs 2026 - 16:45', ClipboardList, 'green'],
            ['Okul Duyurusu', 'Yaz okulu kayıtları başladı.', '24 Mayıs 2026 - 09:20', Megaphone, 'blue'],
          ].map(([title, sub, date, Icon, tone]) => (
            <ListRow key={`${title}-${sub}`} icon={Icon} tone={tone} title={title} sub={`${sub} ${date}`} />
          ))}
        </div>
      </Section>
    </motion.div>
  );
}
