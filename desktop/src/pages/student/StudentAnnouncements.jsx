import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, BellRing } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAnnouncements, fetchStudents } from '../../lib/api/modules';
import { normalizeText, resolveCurrentStudent } from '../../lib/userMatching';

// /s/announcements: öğrencinin kendi duyuru ekranı.
// Kaynak: /api/announcements (admin/teacher tarafından oluşturulan
// duyurular). /api/notifications (sistem bildirimleri) ayrı bir model;
// o /s/notifications altında gösterilir.

function buildSubtitle(item) {
  const parts = [];
  if (item.author) parts.push(item.author);
  if (item.dateLabel) parts.push(item.dateLabel);
  return parts.join(' • ');
}

export default function StudentAnnouncements() {
  const { user } = useApp();
  const [announcements, setAnnouncements] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList] = await Promise.all([
        fetchStudents().catch(() => []),
      ]);
      setStudents(Array.isArray(studentList) ? studentList : []);

      const currentStudent = resolveCurrentStudent(user, Array.isArray(studentList) ? studentList : []);
      const list = await fetchAnnouncements({
        audience: 'Ogrenci',
        viewerRole: 'Student',
        viewerUsername: user?.username,
        viewerName: user?.name || user?.fullName,
        viewerClassName: currentStudent?.className,
      });
      setAnnouncements(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const filtered = useMemo(() => {
    if (!search.trim()) return announcements;
    const key = normalizeText(search);
    return announcements.filter((item) => {
      const haystack = [item.title, item.detail, item.author, item.audience]
        .filter(Boolean)
        .map((value) => normalizeText(value))
        .join(' ');
      return haystack.includes(key);
    });
  }, [announcements, search]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-announcements-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-brand-primary" />
            Duyurular
          </h1>
          <p className="text-muted-foreground mt-1">
            Kurum, sınıf ve öğretmenlerinin sana yönelik duyuruları.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Duyurularda ara..."
          className="sm:max-w-xs"
        />
      </div>

      {error ? <ErrorBanner title="Duyurular alınamadı" message={error} onRetry={loadAnnouncements} /> : null}

      {filtered.length === 0 && !error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {search ? 'Bu aramayla eşleşen duyuru yok.' : 'Henüz duyuru yok.'}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {filtered.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-brand-primary/10 p-3">
                    <BellRing className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">{item.title || 'Duyuru'}</p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {item.detail}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">{buildSubtitle(item)}</p>
                  </div>
                </div>
                {item.audience ? (
                  <Badge variant="outline" className="self-start">{item.audience}</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
