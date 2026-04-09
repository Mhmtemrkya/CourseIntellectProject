import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, QrCode, ScanLine, ShieldCheck, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAttendance, fetchAnnouncements } from '../../lib/api/modules';

function normalize(value = '') {
  return String(value).toLowerCase().trim();
}

export default function StudentAttendanceScan() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [attendance, setAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [attendanceItems, announcementItems] = await Promise.all([
        fetchAttendance().catch(() => []),
        fetchAnnouncements().catch(() => []),
      ]);
      setAttendance(attendanceItems);
      setAnnouncements(announcementItems);
    } catch (err) {
      setError(err.message || 'QR yoklama görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const studentAttendance = useMemo(
    () => attendance.filter((item) => normalize(item.studentName) === normalize(user?.name)),
    [attendance, user?.name],
  );
  const latest = studentAttendance.slice(0, 6);
  const activeSessions = announcements.filter((item) => /LIVE_LESSON|QR|YOKLAMA/i.test(`${item.title} ${item.detail || ''}`)).slice(0, 3);
  const liveSession = activeSessions.find((item) => /LIVE_LESSON/i.test(`${item.title} ${item.detail || ''}`));

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-attendance-scan-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">QR Yoklamaya Katıl</h1>
        <p className="text-muted-foreground mt-1">Öğretmenin açtığı aktif yoklama oturumlarını ve son kayıtlarını görüntüle</p>
      </div>

      {error ? <ErrorBanner title="QR yoklama görünümü alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-brand-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-brand-primary" />Aktif Oturumlar</CardTitle>
            <CardDescription>Desktop sürümünde QR okutma yerine aktif oturum bilgisi gösterilir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Şu an aktif bir QR oturumu görünmüyor.</div>
            ) : activeSessions.map((item, index) => (
              <div key={item.id || index} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail || 'Oturum ayrıntısı yükleniyor'}</p>
                  </div>
                  <Badge>Hazır</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/s/schedule')}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Ders Programı
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(/LIVE_LESSON/i.test(`${item.title} ${item.detail || ''}`) ? '/s/live' : '/s/dashboard')}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    İlgili Akışı Aç
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-green-600" />Son Yoklama Kayıtları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latest.map((item, index) => (
              <div key={`${item.lessonDate}-${index}`} className="rounded-xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.lesson || 'Ders'}</p>
                    <p className="text-sm text-muted-foreground">{item.className || 'Sınıf bilgisi yok'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.status || 'Durum yok'}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(item)}>Detay</Button>
                  </div>
                </div>
              </div>
            ))}
            {latest.length === 0 ? <div className="text-sm text-muted-foreground">Henüz yoklama kaydın görünmüyor.</div> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <ShieldCheck className="h-6 w-6 text-green-600 mt-0.5" />
          <div>
            <p className="font-medium">Desktop uyarlama notu</p>
            <p className="text-sm text-muted-foreground">Gerçek QR okutma mobilde daha doğal çalışır. Masaüstü uygulama bu modülde aktif oturumları, bugünkü ders akışını ve son katılım kayıtlarını takip paneli olarak sunar.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/s/schedule')}>Programı Aç</Button>
              {liveSession ? <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/s/live')}>Canlı Derse Git</Button> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yoklama Kaydı Detayı</DialogTitle>
            <DialogDescription>Seçili ders için işlenen yoklama bilgisi.</DialogDescription>
          </DialogHeader>
          {selectedRecord ? (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Ders</span>
                <span className="font-medium">{selectedRecord.lesson || 'Ders'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Sınıf</span>
                <span className="font-medium">{selectedRecord.className || 'Belirtilmedi'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Tarih</span>
                <span className="font-medium">{selectedRecord.lessonDate ? new Date(selectedRecord.lessonDate).toLocaleString('tr-TR') : 'Belirtilmedi'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Durum</span>
                <Badge variant="outline">{selectedRecord.status || 'Durum yok'}</Badge>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/s/schedule')}>Ders Programını Aç</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedRecord(null)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
