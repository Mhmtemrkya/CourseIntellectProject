import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { CalendarClock, ExternalLink, Link2, Users, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchAnnouncements, fetchStudents } from '../../lib/api/modules';
import { openExternalUrl } from '../../lib/tauri';

export default function TeacherLiveRoom() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRoom = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [announcementItems, studentItems] = await Promise.all([
        fetchAnnouncements().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      setSessions(announcementItems.filter((item) => /LIVE_LESSON/i.test(item.detail || '') || /canli/i.test(item.title || '')));
      setStudents(studentItems);
    } catch (err) {
      setError(err.message || 'Canlı ders odası alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const sessionsWithParticipants = useMemo(() => sessions.map((item) => {
    const detail = String(item.detail || '');
    const classMatch = detail.match(/class=(.+)/);
    const className = classMatch?.[1]?.trim();
    const participantCount = !className || className === 'Tüm Sınıflar'
      ? students.length
      : students.filter((student) => String(student.className || '').trim() === className).length;
    const linkMatch = detail.match(/link=(.+)/);
    const dateMatch = detail.match(/datetime=(.+)/);
    return {
      ...item,
      className: className || 'Tüm Sınıflar',
      participantCount,
      joinLink: linkMatch?.[1]?.trim() || '',
      startsAt: dateMatch?.[1]?.trim() || '',
    };
  }), [sessions, students]);

  const handleOpenRoom = (session) => {
    if (session.joinLink) {
      openExternalUrl(session.joinLink).then((opened) => {
        if (!opened) {
          toast({
            title: 'Canlı ders açılamadı',
            description: 'Bağlantı açılırken bir hata oluştu. Lütfen tekrar deneyin.',
            variant: 'destructive',
          });
        }
      });
      return;
    }
    toast({
      title: 'Canlı ders linki bulunamadı',
      description: 'Bu ders kaydında doğrudan açılacak bir bağlantı görünmüyor. Plan ekranına yönlendiriyoruz.',
    });
    navigate('/t/live-lessons');
  };

  const handleCopyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Ders linki kopyalandı',
        description: 'Paylaşım için bağlantı panoya alındı.',
      });
    } catch (err) {
      toast({
        title: 'Link kopyalanamadı',
        description: err.message || 'Lütfen bağlantıyı elle kopyalayın.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-live-room-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Canlı Ders Odası</h1>
        <p className="text-muted-foreground mt-1">Canlı ders planları ve olası katılımcı görünümü</p>
      </div>
      {error ? <ErrorBanner title="Canlı ders odası alınamadı" message={error} onRetry={loadRoom} /> : null}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessionsWithParticipants.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4 text-center">
              <Video className="h-10 w-10 text-brand-primary" />
              <div>
                <p className="font-medium">Henüz aktif canlı ders odası görünmüyor</p>
                <p className="text-sm text-muted-foreground">Yeni bir plan oluşturmak veya mevcut dersleri yönetmek için canlı ders merkezine geçebiliriz.</p>
              </div>
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/t/live-lessons')}>
                Canlı Ders Merkezine Git
              </Button>
            </CardContent>
          </Card>
        ) : sessionsWithParticipants.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-red-500" />{item.title}</CardTitle>
              <CardDescription>{item.detail || 'Canlı ders oturumu'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground md:grid-cols-3">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-primary" />Beklenen katılımcı: {item.participantCount}</div>
                <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand-accent" />{item.startsAt ? new Date(item.startsAt).toLocaleString('tr-TR') : 'Tarih belirtilmedi'}</div>
                <div className="flex items-center gap-2"><Badge variant="outline">{item.className}</Badge></div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline"><Users className="h-3 w-3 mr-1" />Hazır</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedSession(item)}>Detay</Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenRoom(item)}>Odayı Aç</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSession?.title || 'Canlı ders detayı'}</DialogTitle>
            <DialogDescription>Canlı ders odası bilgileri, sınıf kapsamı ve bağlantı işlemleri.</DialogDescription>
          </DialogHeader>
          {selectedSession ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Sınıf</span>
                  <Badge variant="outline">{selectedSession.className}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Beklenen katılımcı</span>
                  <span className="font-medium">{selectedSession.participantCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Başlangıç</span>
                  <span className="font-medium">{selectedSession.startsAt ? new Date(selectedSession.startsAt).toLocaleString('tr-TR') : 'Belirtilmedi'}</span>
                </div>
              </div>
              <div className="rounded-xl border p-4 text-sm text-muted-foreground break-all">
                {selectedSession.joinLink || 'Bu kayıt için doğrudan bir ders linki bulunmuyor.'}
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => navigate('/t/live-lessons')}>
              Plan Ekranını Aç
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => selectedSession?.joinLink && handleCopyLink(selectedSession.joinLink)} disabled={!selectedSession?.joinLink}>
                <Link2 className="mr-2 h-4 w-4" />
                Linki Kopyala
              </Button>
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => selectedSession && handleOpenRoom(selectedSession)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Odayı Aç
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
