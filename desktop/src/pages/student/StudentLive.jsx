import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Video, Clock, Calendar, Users, Play,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAnnouncements } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function parseLiveLesson(announcement) {
  const lines = String(announcement.detail || '').split('\n');
  const map = Object.fromEntries(lines.slice(1).map((line) => {
    const [key, ...rest] = line.split('=');
    return [key, rest.join('=')];
  }));
  const startsAt = map.datetime ? new Date(map.datetime) : null;
  const now = new Date();
  const duration = Number(map.duration || 60);
  const endAt = startsAt ? new Date(startsAt.getTime() + duration * 60000) : null;
  let status = 'scheduled';
  if (startsAt && endAt && now >= startsAt && now <= endAt) status = 'live';
  if (endAt && now > endAt) status = 'completed';

  return {
    id: announcement.id,
    subject: announcement.title,
    teacher: map.teacher || 'Öğretmen',
    startTime: startsAt ? startsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '09:00',
    duration,
    participants: 0,
    status,
    meetLink: map.link || '',
    className: map.class || 'Tüm Sınıflar',
    date: startsAt ? startsAt.toISOString().slice(0, 10) : announcement.dateLabel,
  };
}

export default function StudentLive() {
  const { user } = useApp();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const announcements = await fetchAnnouncements('Ogrenci');
      const payload = announcements
        .filter((item) => String(item.detail || '').startsWith('LIVE_LESSON'))
        .map(parseLiveLesson)
        .filter((item) => !user?.className || item.className === 'Tüm Sınıflar' || item.className.includes(user.className));
      setLessons(payload);
    } catch (err) {
      setError(err.message || 'Canlı dersler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const ongoingLessons = useMemo(() => lessons.filter((item) => item.status === 'live'), [lessons]);
  const upcomingLessons = useMemo(() => lessons.filter((item) => item.status === 'scheduled'), [lessons]);
  const pastLessons = useMemo(() => lessons.filter((item) => item.status === 'completed'), [lessons]);

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
      data-testid="student-live-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Canlı Dersler</h1>
        <p className="text-muted-foreground mt-1">Online derslere katıl</p>
      </div>

      {error ? <ErrorBanner title="Canlı dersler alınamadı" message={error} onRetry={loadLessons} /> : null}

      {ongoingLessons.length > 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-2 border-green-500 bg-green-50/50 dark:bg-green-900/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                <CardTitle className="text-green-700 dark:text-green-400">Şu An Canlı</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {ongoingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-card border">
                  <div>
                    <h3 className="text-xl font-bold">{lesson.subject}</h3>
                    <p className="text-muted-foreground">{lesson.teacher}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {lesson.startTime} - {lesson.duration} dk
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {lesson.className}
                      </span>
                    </div>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => window.open(lesson.meetLink, '_blank')}>
                    <Play className="h-4 w-4 mr-2" />
                    Katıl
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-accent" />
                Yaklaşan Dersler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-accent/30 transition-all">
                  <div>
                    <h4 className="font-semibold">{lesson.subject}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.teacher}</p>
                    <p className="text-xs text-muted-foreground mt-1">{lesson.className}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{lesson.startTime}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{lesson.duration} dk</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-brand-primary" />
                Ders Kayıtları
              </CardTitle>
              <CardDescription>Tamamlanan canlı ders oturumları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pastLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-primary/30 transition-all">
                  <div>
                    <h4 className="font-semibold">{lesson.subject}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.teacher}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(lesson.date).toLocaleDateString('tr-TR')}
                      <Clock className="h-3 w-3 ml-2" />
                      {lesson.startTime}
                    </div>
                  </div>
                  {lesson.meetLink ? (
                    <Button variant="outline" size="sm" onClick={() => window.open(lesson.meetLink, '_blank')}>
                      <Play className="h-4 w-4 mr-1" />
                      Aç
                    </Button>
                  ) : (
                    <Badge variant="secondary">Kayıt Yok</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="bg-brand-primary/5 border-brand-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Canlı Ders Kuralları</h3>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Derse zamanında katılın</li>
                  <li>• Soru sormak için sohbet bölümünü kullanın</li>
                  <li>• Canlı ders bağlantısı öğretmen duyuruları üzerinden gelir</li>
                </ul>
              </div>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Destek
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
