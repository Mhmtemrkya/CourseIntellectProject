import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAttendance } from '../../lib/api/modules';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

function mapStatus(status = '') {
  const value = normalize(status);
  if (value.includes('katildi') || value.includes('present')) return 'Katildi';
  if (value.includes('gec') || value.includes('late')) return 'Gec';
  if (value.includes('izin')) return 'Izinli';
  return 'Devamsiz';
}

export default function StudentAttendance() {
  const { user } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAttendance({ studentName: user?.name || '' });
      setRecords(payload);
    } catch (err) {
      setError(err.message || 'Devamsızlık kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const grouped = useMemo(() => {
    const map = new Map();
    records.forEach((item) => {
      const key = item.lessonDate || item.createdAtUtc || 'Tarih yok';
      const label = new Date(key);
      const title = Number.isNaN(label.getTime())
        ? key
        : new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(label);
      const next = map.get(title) || [];
      next.push({ ...item, uiStatus: mapStatus(item.status) });
      map.set(title, next);
    });
    return Array.from(map.entries());
  }, [records]);

  const stats = useMemo(() => {
    const present = records.filter((item) => mapStatus(item.status) === 'Katildi').length;
    const late = records.filter((item) => mapStatus(item.status) === 'Gec').length;
    const absent = records.filter((item) => mapStatus(item.status) === 'Devamsiz').length;
    return { present, late, absent };
  }, [records]);

  const iconForStatus = (status) => {
    if (status === 'Katildi') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === 'Gec') return <Clock3 className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-rose-600" />;
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-attendance-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Devamsızlığım</h1>
        <p className="text-muted-foreground mt-1">Günlük yoklama hareketlerini canlı backend üzerinden takip et.</p>
      </div>

      {error ? <ErrorBanner title="Devamsızlık alınamadı" message={error} onRetry={loadAttendance} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [records.length, 'Toplam Kayıt'],
          [stats.absent, 'Devamsız'],
          [stats.late, 'Geç'],
        ].map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-3xl font-bold mt-2">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {grouped.map(([dateLabel, items]) => (
        <Card key={dateLabel}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-primary" />
              <h2 className="font-semibold">{dateLabel}</h2>
            </div>
            {items.map((item, index) => (
              <div key={`${item.lesson}-${index}`} className="flex items-center justify-between rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  {iconForStatus(item.uiStatus)}
                  <div>
                    <p className="font-medium">{item.lesson || 'Ders'}</p>
                    <p className="text-sm text-muted-foreground">{item.className || 'Sınıf'}</p>
                  </div>
                </div>
                <Badge variant="outline">{item.uiStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
}
