import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Video, Calendar, Clock, Users, ExternalLink, Plus,
  Copy, CheckCircle, Settings, Monitor, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const weeklyCount = lessons.filter((lesson) => lesson.status !== 'completed').length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0);

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
          <h1 className="text-3xl font-bold font-heading">Canlı Dersler</h1>
          <p className="text-muted-foreground mt-1">Online ders planlarınızı yönetin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Canlı Ders
            </Button>
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

      {liveLesson ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-green-600 to-green-500 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="p-4 rounded-xl bg-white/20">
                      <Video className="h-8 w-8" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                    </span>
                  </div>
                  <div>
                    <Badge className="bg-white/20 text-white mb-2">CANLI</Badge>
                    <h2 className="text-2xl font-bold">{liveLesson.title}</h2>
                    <p className="text-white/80">{liveLesson.class} • {liveLesson.teacher}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    className="bg-white text-green-600 hover:bg-white/90"
                    onClick={() => handleOpenLesson(liveLesson.link)}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Derse Git
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Ayarlar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [weeklyCount, 'Planlanan Ders', Calendar, 'text-brand-primary'],
          [totalDuration, 'Toplam Süre', Clock, 'text-brand-accent'],
          [lessons.filter((lesson) => lesson.status === 'completed').length, 'Tamamlanan', CheckCircle, 'text-green-600'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/70">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ders Takvimi</CardTitle>
            <CardDescription>Planlanmış ve tamamlanmış canlı dersler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lessons.map((lesson) => (
              <motion.div
                key={lesson.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${lesson.status === 'completed' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-brand-primary/10'}`}>
                    <Video className={`h-6 w-6 ${lesson.status === 'completed' ? 'text-gray-500' : 'text-brand-primary'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{lesson.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(lesson.date).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lesson.time} • {lesson.duration} dk
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {lesson.class}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusConfig[lesson.status].color}>
                    {statusConfig[lesson.status].label}
                  </Badge>
                  {lesson.link ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(lesson.id, lesson.link)}
                      >
                        {copiedId === lesson.id ? <CheckCircle className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copiedId === lesson.id ? 'Kopyalandı' : 'Link Kopyala'}
                      </Button>
                      <Button
                        variant={lesson.status === 'live' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOpenLesson(lesson.link)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Aç
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDeleteLesson(lesson)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Sil
                      </Button>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Canlı Ders Ayarları</DialogTitle>
            <DialogDescription>
              Aktif ders bağlantısı, tarih ve sınıf bilgisini yönetin.
            </DialogDescription>
          </DialogHeader>
          {liveLesson ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Sınıf</p>
                    <p className="mt-1 font-semibold">{liveLesson.class}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Öğretmen</p>
                    <p className="mt-1 font-semibold">{liveLesson.teacher}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Tarih / Saat</p>
                    <p className="mt-1 font-semibold">{liveLesson.date} • {liveLesson.time}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Süre</p>
                    <p className="mt-1 font-semibold">{liveLesson.duration} dakika</p>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>Ders Bağlantısı</Label>
                <Input value={liveLesson.link} readOnly />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Şu anda aktif canlı ders bulunmuyor. Yeni planlanan bir ders canlıya geçtiğinde ayarlar burada görünür.
            </div>
          )}
          <DialogFooter>
            {liveLesson ? (
              <>
                <Button variant="outline" onClick={() => copyLink(liveLesson.id, liveLesson.link)}>Bağlantıyı Kopyala</Button>
                <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => handleOpenLesson(liveLesson.link)}>Derse Git</Button>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDeleteLesson(liveLesson)}>
                  Sil
                </Button>
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
