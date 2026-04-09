import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BellRing, ExternalLink, MessageSquareWarning, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchNotifications } from '../../lib/api/modules';

export default function AdministrativeNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setNotifications(await fetchNotifications('Administrative').catch(() => []));
    } catch (err) {
      setError(err.message || 'İdari bildirimler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const resolveNotificationRoute = (item) => {
    const text = `${item?.title || ''} ${item?.detail || ''}`.toLowerCase();
    if (/finans|tahsilat|odeme|fatura/.test(text)) return '/finance/dashboard';
    if (/mesaj|gorusme|talep|iletisim/.test(text)) return '/chat';
    if (/evrak|belge|duyuru/.test(text)) return '/admin/documents';
    return '/admin/task-center';
  };

  const filteredNotifications = useMemo(() => notifications.filter((item) => `${item?.title || ''} ${item?.detail || ''}`.toLowerCase().includes(search.toLowerCase())), [notifications, search]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="administrative-notifications-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">İdari Bildirimler</h1>
        <p className="text-muted-foreground mt-1">İdari role hedeflenen bildirim akışı</p>
      </div>
      {error ? <ErrorBanner title="İdari bildirimler alınamadı" message={error} onRetry={loadNotifications} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [notifications.length, 'Toplam Bildirim'],
          [notifications.filter((item) => !item.isRead).length, 'Yeni'],
          [notifications.filter((item) => /finans|odeme|fatura/i.test(`${item.title} ${item.detail}`)).length, 'Finans'],
          [notifications.filter((item) => /mesaj|gorusme|talep/i.test(`${item.title} ${item.detail}`)).length, 'Etkileşim'],
        ].map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Bildirim ara..." />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <MessageSquareWarning className="h-10 w-10 text-brand-primary" />
              <div>
                <p className="font-medium text-foreground">Şu an bekleyen idari bildirim görünmüyor</p>
                <p className="text-sm">Yeni kayıtlar oluştuğunda bu ekran idari operasyon merkezinin hızlı giriş noktası gibi çalışacak.</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/admin/task-center')}>Görev Merkezine Git</Button>
            </CardContent>
          </Card>
        ) : filteredNotifications.map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BellRing className="h-5 w-5 text-brand-primary" />{item.title}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{item.detail || 'Detay yok'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.isRead ? 'Okundu' : 'Yeni'}</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedNotification(item)}>Detay</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(resolveNotificationRoute(item))}>Akışı Aç</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title || 'Bildirim detayı'}</DialogTitle>
            <DialogDescription>İdari bildirim kaydının ayrıntısı ve önerilen aksiyon.</DialogDescription>
          </DialogHeader>
          {selectedNotification ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedNotification.detail || 'Bu bildirim için ek açıklama bulunmuyor.'}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm">
                <span className="text-muted-foreground">Durum</span>
                <Badge variant="outline">{selectedNotification.isRead ? 'Okundu' : 'Yeni'}</Badge>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate(resolveNotificationRoute(selectedNotification))}>
              <ExternalLink className="mr-2 h-4 w-4" />
              İlgili Akışı Aç
            </Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedNotification(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
