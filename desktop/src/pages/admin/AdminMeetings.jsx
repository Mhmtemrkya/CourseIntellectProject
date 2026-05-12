import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarFold, CheckCircle2, Clock3, UserRound, Video, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchMeetingRequests } from '../../lib/api/modules';

function parseSlot(slotValue) {
  const raw = String(slotValue || '').trim();
  const parsed = new Date(raw.replace(' ', 'T'));
  if (!Number.isNaN(parsed.getTime())) {
    return {
      fullLabel: parsed.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeLabel: parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      sortable: parsed.getTime(),
    };
  }
  return { fullLabel: raw, timeLabel: raw, sortable: 0 };
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('onay')) return 'success';
  if (value.includes('red')) return 'danger';
  return 'warning';
}

function badge(status) {
  const tone = statusTone(status);
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return <Badge className={styles[tone]}>{status || 'Bekliyor'}</Badge>;
}

export default function AdminMeetings() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMeetingRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Görüşme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const items = useMemo(() => [...requests]
    .map((item) => ({ ...item, slotInfo: parseSlot(item.slot || item.requestedDate) }))
    .filter((item) => {
      if (filter === 'approved') return statusTone(item.status) === 'success';
      if (filter === 'pending') return statusTone(item.status) === 'warning';
      if (filter === 'rejected') return statusTone(item.status) === 'danger';
      return true;
    })
    .sort((a, b) => b.slotInfo.sortable - a.slotInfo.sortable), [requests, filter]);

  const stats = {
    total: requests.length,
    pending: requests.filter((item) => statusTone(item.status) === 'warning').length,
    approved: requests.filter((item) => statusTone(item.status) === 'success').length,
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <section className="rounded-[32px] border border-border p-7 text-white shadow-xl" style={{ background: 'linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #334155) 48%, var(--brand-p-700, #0f766e) 100%)' }}>
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <Badge className="bg-white/12 text-white hover:bg-white/12">Yönetici Görüşme Denetimi</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Kim talep gönderdi, hangi öğretmen ne yaptı tek ekranda gör</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">Veli taleplerini, öğretmen onay durumlarını ve görüşme formatlarını kurumsal düzeyde izle.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Toplam', value: stats.total },
              { label: 'Bekleyen', value: stats.pending },
              { label: 'Onaylanan', value: stats.approved },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/65">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'Tümü'],
          ['pending', 'Bekleyen'],
          ['approved', 'Onaylanan'],
          ['rejected', 'Reddedilen'],
        ].map(([value, label]) => (
          <Button key={value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>
        ))}
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarFold className="h-5 w-5 text-emerald-600" />Görüşme Akışı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
              Bu filtrede görüşme kaydı yok.
            </div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.parentName}</p>
                      <p className="text-sm text-muted-foreground">{item.studentName} • {item.topic}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.advisor || item.teacherName || 'Öğretmen'}</Badge>
                    <Badge variant="outline"><Clock3 className="mr-2 h-3 w-3" />{item.slotInfo.fullLabel}</Badge>
                    <Badge variant="outline">{item.slotInfo.timeLabel}</Badge>
                    <Badge variant="outline">{item.onlineMeeting ? <><Video className="mr-2 h-3 w-3" />Online</> : <><Building2 className="mr-2 h-3 w-3" />Yüz yüze</>}</Badge>
                  </div>
                  {item.note ? <p className="text-sm leading-6 text-muted-foreground">{item.note}</p> : null}
                </div>
                {badge(item.status)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
