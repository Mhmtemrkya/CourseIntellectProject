import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchGuidanceClassReport, fetchGuidanceOverview } from '../../lib/api/modules';

const TOPIC_LABELS = {
  motivasyon: 'Motivasyon',
  'sinav-kaygisi': 'Sınav Kaygısı',
  aile: 'Aile',
  arkadas: 'Arkadaş',
  akademik: 'Akademik',
  diger: 'Diğer',
};

// İdareye sunulabilir özet: yalnız SAYILAR — not içerikleri asla yer almaz.
export default function GuidanceReports() {
  const [report, setReport] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (className) => {
    setLoading(true);
    setError('');
    try {
      const [data, overview] = await Promise.all([
        fetchGuidanceClassReport(className === 'all' ? undefined : className),
        fetchGuidanceOverview().catch(() => []),
      ]);
      setReport(data);
      setClasses([...new Set(overview.map((s) => s.className).filter(Boolean))].sort());
    } catch (err) {
      setError(err?.message || 'Rapor alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(classFilter); }, [classFilter, load]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  const topicData = (report?.sessionsByTopic || []).map((item) => ({
    name: TOPIC_LABELS[item.topic] || item.topic,
    Görüşme: item.count,
  }));
  const monthData = (report?.sessionsByMonth || []).map((item) => ({
    name: item.month,
    Görüşme: item.count,
  }));
  const appointmentStats = report?.appointments || {};

  return (
    <div className="space-y-6" data-testid="guidance-reports">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Rehberlik Raporu</h1>
          <p className="text-sm text-muted-foreground">
            İdareyle paylaşılabilir dönem özeti. Görüşme içerikleri bu rapora dahil edilmez.
          </p>
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Sınıflar</SelectItem>
            {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={() => load(classFilter)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Toplam Görüşme', value: report?.totalSessions ?? 0 },
          { label: 'Toplam Randevu', value: appointmentStats.total ?? 0 },
          { label: 'Onaylanan', value: appointmentStats.approved ?? 0 },
          { label: 'Tamamlanan', value: appointmentStats.completed ?? 0 },
          { label: 'Bekleyen', value: appointmentStats.pending ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-3xl font-black">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black"><BarChart3 className="h-4 w-4 text-brand-accent" /> Konu Dağılımı</h2>
          {topicData.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Görüşme kaydı yok.</p>
          ) : (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <ChartTooltip />
                  <Bar dataKey="Görüşme" fill="hsl(var(--brand-accent))" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Aylık Görüşme Trendi</h2>
          {monthData.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Görüşme kaydı yok.</p>
          ) : (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="Görüşme" stroke="hsl(var(--brand-accent))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Görüşme Türleri</h2>
          <div className="mt-4 space-y-2">
            {(report?.sessionsByType || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : report.sessionsByType.map((item) => (
              <div key={item.type} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span className="font-semibold capitalize">{item.type}</span>
                <span className="font-black">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Randevu Özeti</h2>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ['Onaylanan', appointmentStats.approved],
              ['Reddedilen', appointmentStats.rejected],
              ['Tamamlanan', appointmentStats.completed],
              ['Bekleyen', appointmentStats.pending],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border p-3">
                <span className="font-semibold">{label}</span>
                <span className="font-black">{value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
