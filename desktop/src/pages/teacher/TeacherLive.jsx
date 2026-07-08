import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Video, Clock, Plus, Trash2, Play,
  CalendarPlus, PenTool, BarChart3, FolderOpen,
} from 'lucide-react';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PremiumPanel, PremiumDonutChart, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { TeacherEmptyState } from '../../components/teacher/TeacherEmptyState';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  endLiveRoomSession,
  fetchLiveRoomSessions,
  fetchStudents,
  openLiveRoomSession,
} from '../../lib/api/modules';
import { openExternalUrl } from '../../lib/tauri';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fallbackClasses = ['Tüm Sınıflar'];

// Tek doğruluk kaynağı: /api/liveroomsessions. Önceki sürüm announcement
// LIVE_LESSON parse ediyordu; participants/status/duration alanları text
// metaverisinden çıkarılıyordu — artık backend session modelinden geliyor.

function mapSessionToLesson(session) {
  const startedAt = session.startedAtUtc ? new Date(session.startedAtUtc) : null;
  const endedAt = session.endedAtUtc ? new Date(session.endedAtUtc) : null;
  // Status: backend "Active" / "Completed" — frontend ile uyumlu olsun diye
  // küçük harfe map ediyoruz.
  const rawStatus = String(session.status || '').toLowerCase();
  const status = rawStatus === 'active' ? 'live' : rawStatus === 'completed' ? 'completed' : 'scheduled';
  const duration = startedAt && endedAt
    ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
    : 60;
  return {
    id: session.id,
    title: session.lessonTitle || 'Canlı Ders',
    date: startedAt ? startedAt.toISOString().slice(0, 10) : '',
    time: session.timeLabel || (startedAt ? startedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''),
    duration,
    class: session.className || 'Tüm Sınıflar',
    teacher: session.teacherName || 'Öğretmen',
    link: session.meetingLink || '',
    status,
    participants: Array.isArray(session.participants) ? session.participants.length : 0,
  };
}

const statusConfig = {
  scheduled: { label: 'Planlandı', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  live: { label: 'Canlı', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Tamamlandı', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export default function TeacherLive() {
  const { toast } = useToast();
  const { user } = useApp();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [studentCounts, setStudentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lessons, setLessons] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: '14:00',
    duration: '60',
    className: '',
    meetingUrl: '',
  });

  const loadLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Öğretmenin kendi canlı dersleri (backend teacherName filtre uygular).
      const [sessions, students] = await Promise.all([
        fetchLiveRoomSessions({ teacherName: user?.name }).catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      const items = (Array.isArray(sessions) ? sessions : [])
        .map(mapSessionToLesson)
        .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());
      const classes = [...new Set(students.map((item) => item.className).filter(Boolean))];
      const counts = students.reduce((acc, student) => {
        if (student.className) acc[student.className] = (acc[student.className] || 0) + 1;
        return acc;
      }, {});
      setStudentCounts(counts);
      setLessons(items);
      setAvailableClasses(classes);
      setForm((prev) => ({ ...prev, className: prev.className || classes[0] || 'Tüm Sınıflar' }));
    } catch (err) {
      setError(err.message || 'Canlı dersler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const classOptions = useMemo(() => {
    const merged = [
      'Tüm Sınıflar',
      ...availableClasses,
      ...lessons.map((item) => item.class).filter(Boolean),
      ...(Array.isArray(user?.assignedClasses) ? user.assignedClasses : []),
    ];
    const unique = [...new Set(merged.filter(Boolean))];
    return unique.length > 0 ? unique : fallbackClasses;
  }, [availableClasses, lessons, user?.assignedClasses]);

  const handleOpenLesson = async (link) => {
    if (!link) {
      toast({
        title: 'Canlı ders linki bulunamadı',
        description: 'Bu ders için açılabilir bir bağlantı görünmüyor.',
        variant: 'destructive',
      });
      return;
    }

    const opened = await openExternalUrl(link);
    if (!opened) {
      toast({
        title: 'Canlı ders açılamadı',
        description: 'Bağlantı açılırken bir hata oluştu. Linki kopyalayıp tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLesson = async (lesson) => {
    if (!lesson?.id) return;
    // Session modelinde "silme" yerine "bitirme" semantiği var; backend
    // oturum kaydını tutuyor, status='Completed' yapıyor.
    const confirmed = window.confirm(`"${lesson.title}" canli dersi bitirilsin mi?`);
    if (!confirmed) return;

    try {
      await endLiveRoomSession(lesson.id);
      setLessons((prev) => prev.map((item) => (
        item.id === lesson.id ? { ...item, status: 'completed' } : item
      )));
      if (settingsOpen) {
        setSettingsOpen(false);
      }
      toast({
        title: 'Canlı ders sonlandırıldı',
        description: 'Oturum kapatıldı.',
      });
    } catch (err) {
      toast({
        title: 'Canlı ders bitirilemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    }
  };

  const copyLink = (id, link) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Link kopyalandı',
      description: 'Ders linki panoya kopyalandı.',
    });
  };

  const handleCreate = async () => {
    if (!form.title || !form.date || !form.time) {
      toast({
        title: 'Eksik bilgi',
        description: 'Başlık, tarih ve saat zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const created = await openLiveRoomSession({
        lessonTitle: form.title,
        teacherName: user?.name || 'Öğretmen',
        className: form.className || 'Tüm Sınıflar',
        timeLabel: `${form.date} ${form.time}`,
      });
      const mapped = mapSessionToLesson(created);
      setLessons((prev) => [...prev, mapped].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime()));
      toast({
        title: 'Canlı ders oluşturuldu',
        description: 'Oturum açıldı, link öğrenciye otomatik dağıtılacak.',
      });
      setCreateOpen(false);
    } catch (err) {
      toast({
        title: 'Canlı ders oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const liveLesson = lessons.find((lesson) => lesson.status === 'live');
  const upcomingLessons = lessons.filter((lesson) => lesson.status !== 'completed');
  const pastLessons = lessons.filter((lesson) => lesson.status === 'completed');
  const nextLesson = liveLesson || upcomingLessons[0] || null;
  const startableId = nextLesson?.id;
  const attendanceOf = (lesson) => {
    const total = studentCounts[lesson?.class] || lesson?.participants || 0;
    const attended = lesson?.participants || 0;
    return { total, attended, absent: Math.max(0, total - attended), rate: total ? Math.round((attended / total) * 100) : 0 };
  };
  const liveTools = [
    ['Ders Planla', CalendarPlus, () => setCreateOpen(true)],
    ['Toplantı Oluştur', Video, () => setCreateOpen(true)],
    ['Beyaz Tahta', PenTool, () => openExternalUrl('https://excalidraw.com')],
    ['Anket Oluştur', BarChart3, () => toast({ title: 'Anket aracı yakında' })],
    ['Dosya Paylaş', FolderOpen, () => navigate('/t/content')],
  ];
  const openDetail = (lesson) => { setDetailLesson(lesson); setSettingsOpen(true); };
  const activeList = activeTab === 'upcoming' ? upcomingLessons : pastLessons;
  const detailOrLive = detailLesson || liveLesson;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Canlı dersler yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-live-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Canlı Ders</h1>
            <PremiumStatusPill tone="soon">Yaklaşan</PremiumStatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Derslerinizi canlı olarak başlatın, öğrencilerinizle etkileşimde bulunun.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <FeatureGate module="live-lessons" action="schedule">
              <Button className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]">
                <Plus className="h-4 w-4 mr-2" />
                Canlı Ders Oluştur
              </Button>
            </FeatureGate>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Canlı Ders Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Ders Başlığı</Label>
                <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Örn: Matematik 11 - Türev Dersi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Saat</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Süre (dk)</Label>
                  <Select value={form.duration} onValueChange={(value) => setForm((prev) => ({ ...prev, duration: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dakika</SelectItem>
                      <SelectItem value="45">45 dakika</SelectItem>
                      <SelectItem value="60">60 dakika</SelectItem>
                      <SelectItem value="90">90 dakika</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select value={form.className} onValueChange={(value) => setForm((prev) => ({ ...prev, className: value }))}>
                    <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tüm Sınıflar">Tüm Sınıflar</SelectItem>
                      {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Canlı Ders Linki</Label>
                <Input value={form.meetingUrl} onChange={(e) => setForm((prev) => ({ ...prev, meetingUrl: e.target.value }))} placeholder="https://meet.google.com/... veya Zoom linki" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreate}>Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <ErrorBanner title="Canlı dersler alınamadı" message={error} onRetry={loadLessons} /> : null}

      {nextLesson ? (
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Bir Sonraki Canlı Ders" description="Sıradaki oturumun">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><Video className="h-7 w-7" /></span>
                  <div className="min-w-0">
                    <PremiumStatusPill tone={nextLesson.status === 'live' ? 'live' : 'soon'}>{nextLesson.class}</PremiumStatusPill>
                    <h3 className="mt-2 text-xl font-black leading-tight">{nextLesson.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarPlus className="h-4 w-4" />{nextLesson.date ? new Date(nextLesson.date).toLocaleDateString('tr-TR') : 'Bugün'}</span>
                      <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{nextLesson.time} ({nextLesson.duration} dk)</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openDetail(nextLesson)}>Ders Detayları</Button>
                  <Button className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={() => handleOpenLesson(nextLesson.link)}><Play className="mr-1.5 h-4 w-4" />Dersi Başlat</Button>
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Derse Katılım</p>
                {(() => { const a = attendanceOf(nextLesson); return (
                  <PremiumDonutChart
                    segments={[
                      { label: 'Katıldı', value: a.attended, color: '#10B981' },
                      { label: 'Katılmadı', value: a.absent, color: '#F59E0B' },
                    ]}
                    centerValue={`${a.attended}/${a.total}`}
                    centerLabel={`%${a.rate}`}
                  />
                ); })()}
              </div>
            </div>
          </PremiumPanel>
        </motion.div>
      ) : null}

      {/* Sekmeler + ders listesi */}
      <motion.div variants={itemVariants}>
        <PremiumPanel
          title={activeTab === 'upcoming' ? 'Yaklaşan Dersler' : 'Geçmiş Dersler'}
          description={`${upcomingLessons.length} yaklaşan · ${pastLessons.length} geçmiş`}
          action={(
            <div className="flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-0.5">
              {[['upcoming', 'Yaklaşan'], ['past', 'Geçmiş']].map(([value, label]) => (
                <button key={value} onClick={() => setActiveTab(value)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${activeTab === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
              ))}
            </div>
          )}
          contentClassName="space-y-3"
        >
          {lessons.length === 0 ? (
            <TeacherEmptyState
              variant="live"
              accent="red"
              title="Henüz canlı ders oluşturulmamış"
              description="Öğrencilerle buluşmak için ilk canlı dersini oluştur ve etkileşimli bir öğrenme deneyimi başlat."
              primaryLabel="Canlı Ders Oluştur"
              onPrimary={() => setCreateOpen(true)}
            />
          ) : activeList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">{activeTab === 'upcoming' ? 'Yaklaşan ders yok.' : 'Geçmiş ders yok.'}</div>
          ) : activeList.map((lesson) => {
            const att = attendanceOf(lesson);
            const startable = lesson.id === startableId || lesson.status === 'live';
            return (
              <div key={lesson.id} className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:flex-row sm:items-center">
                <div className="w-16 shrink-0 text-center">
                  <p className="text-sm font-bold tabular-nums">{String(lesson.time).split('-')[0] || lesson.time}</p>
                  <p className="text-[11px] text-muted-foreground">{lesson.duration} dk</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-lg bg-[hsl(var(--brand-accent)/0.14)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-accent))]">{lesson.class}</span>
                    <p className="truncate text-sm font-semibold">{lesson.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{lesson.date ? new Date(lesson.date).toLocaleDateString('tr-TR') : ''}</p>
                </div>
                <div className="shrink-0 text-center">
                  <p className="text-sm font-black tabular-nums">{att.attended}/{att.total}</p>
                  <p className="text-[11px] text-muted-foreground">Katılım</p>
                </div>
                {startable ? (
                  <Button className="shrink-0 bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={() => handleOpenLesson(lesson.link)}><Play className="mr-1.5 h-4 w-4" />Dersi Başlat</Button>
                ) : (
                  <Button variant="outline" className="shrink-0" onClick={() => openDetail(lesson)}>Ders Detayları</Button>
                )}
              </div>
            );
          })}
        </PremiumPanel>
      </motion.div>

      {/* Araçlar */}
      <motion.div variants={itemVariants}>
        <PremiumPanel title="Canlı Ders Araçları" description="Hızlı erişim">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {liveTools.map(([label, Icon, onClick]) => (
              <button key={label} onClick={onClick} className="ci-rise flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-center hover:border-[hsl(var(--brand-accent)/0.28)]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><Icon className="h-5 w-5" /></span>
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </PremiumPanel>
      </motion.div>

      <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) setDetailLesson(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ders Detayları</DialogTitle>
            <DialogDescription>
              Ders bağlantısı, tarih ve sınıf bilgisini yönetin.
            </DialogDescription>
          </DialogHeader>
          {detailOrLive ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Sınıf', detailOrLive.class],
                  ['Öğretmen', detailOrLive.teacher],
                  ['Tarih / Saat', `${detailOrLive.date} • ${detailOrLive.time}`],
                  ['Süre', `${detailOrLive.duration} dakika`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Ders Bağlantısı</Label>
                <Input value={detailOrLive.link} readOnly />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Ders bilgisi bulunamadı.
            </div>
          )}
          <DialogFooter>
            {detailOrLive ? (
              <>
                <Button variant="outline" onClick={() => copyLink(detailOrLive.id, detailOrLive.link)}>Bağlantıyı Kopyala</Button>
                <Button className="bg-[hsl(var(--brand-accent))] text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={() => handleOpenLesson(detailOrLive.link)}>Dersi Başlat</Button>
                {detailOrLive.status !== 'completed' ? (
                  <Button variant="outline" className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10" onClick={() => handleDeleteLesson(detailOrLive)}>
                    <Trash2 className="mr-1.5 h-4 w-4" />Bitir
                  </Button>
                ) : null}
              </>
            ) : (
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Kapat</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
