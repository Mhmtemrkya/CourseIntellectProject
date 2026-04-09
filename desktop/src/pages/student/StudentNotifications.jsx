import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellRing, CheckCircle, Info, AlertTriangle, MessageSquare,
  FileText, Calendar, BookOpen, Filter, CheckCheck,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';
import { fetchNotifications, markNotificationRead } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function notifIcon(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('exam') || t.includes('sinav')) return <FileText className="h-5 w-5 text-purple-500" />;
  if (t.includes('homework') || t.includes('odev')) return <BookOpen className="h-5 w-5 text-blue-500" />;
  if (t.includes('message') || t.includes('mesaj')) return <MessageSquare className="h-5 w-5 text-green-500" />;
  if (t.includes('attendance') || t.includes('devam')) return <Calendar className="h-5 w-5 text-orange-500" />;
  if (t.includes('warning') || t.includes('uyari')) return <AlertTriangle className="h-5 w-5 text-red-500" />;
  return <Info className="h-5 w-5 text-gray-500" />;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Az once';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk once`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat once`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gun once`;
  return date.toLocaleDateString('tr-TR');
}

export default function StudentNotifications() {
  const { user } = useApp();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchNotifications('Student');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Duyurular alinamadi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.isRead);
    if (tab === 'read') return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, tab]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      toast({ title: 'Okundu olarak isaretlendi.' });
    } catch {
      toast({ title: 'Islem basarisiz.', variant: 'destructive' });
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      try { await markNotificationRead(n.id); } catch { /* skip */ }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast({ title: 'Tum duyurular okundu.' });
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadNotifications} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Duyurular</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} okunmamis duyuru` : 'Tum duyurular okundu'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> Tumunu Okundu Yap
          </Button>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">
              Tumu ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Okunmamis ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read">
              Okunmus ({notifications.length - unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BellRing className="h-12 w-12 mb-3 opacity-40" />
              <p>Duyuru bulunamadi.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div className="space-y-2" variants={containerVariants}>
          {filtered.map((notif) => (
            <motion.div key={notif.id} variants={itemVariants}>
              <Card className={`transition-colors ${!notif.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="mt-1">{notifIcon(notif.type || notif.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{notif.title || 'Duyuru'}</span>
                      {!notif.isRead && <Badge variant="secondary" className="text-xs">Yeni</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{notif.message || notif.body || ''}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      {timeAgo(notif.createdAt || notif.date)}
                    </span>
                  </div>
                  {!notif.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notif.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
