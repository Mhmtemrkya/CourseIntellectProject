import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bus, MapPin, Clock3, CheckCircle2, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { getParentChildrenTransportStatus } from '../../lib/api/modules';

const ATT = {
  Boarded: ['Bindi', 'bg-emerald-100 text-emerald-700'],
  Dropped: ['İndi', 'bg-sky-100 text-sky-700'],
  Absent: ['Gelmedi', 'bg-red-100 text-red-700'],
  Pending: ['Bekliyor', 'bg-muted text-muted-foreground'],
};

function tripLabel(s) {
  return { NotStarted: 'Başlamadı', InProgress: 'Yolda', Completed: 'Tamamlandı', ArrivedSchool: 'Okula vardı' }[s] || s || '—';
}

export default function ParentService() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setItems(await getParentChildrenTransportStatus());
    } catch (err) {
      setError(err.message || 'Servis durumu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000); // 30 sn'de bir canlı yenile
    return () => window.clearInterval(t);
  }, [load]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-service-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><Bus className="h-7 w-7 text-brand-primary" />Servis Takip</h1>
        <p className="text-muted-foreground mt-1">Çocuğunuzun servisinin canlı durumu, biniş bilgisi ve tahmini varış (30 sn'de bir güncellenir).</p>
      </div>
      {error ? <ErrorBanner title="Servis durumu alınamadı" message={error} onRetry={load} /> : null}

      {items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Tanımlı servis bilgisi bulunamadı.</CardContent></Card>
      ) : items.map((item, idx) => {
        const [attLabel, attTone] = ATT[item.attendanceStatus] || ATT.Pending;
        const hasVehicle = item.vehicleLatitude != null && item.vehicleLongitude != null;
        const mapUrl = hasVehicle ? `https://www.google.com/maps?q=${item.vehicleLatitude},${item.vehicleLongitude}` : null;
        return (
          <Card key={`${item.studentFullName}-${idx}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{item.studentFullName}</CardTitle>
                <Badge className={attTone}>{attLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Navigation className="h-4 w-4" />Rota</div>
                  <p className="mt-1 font-semibold">{item.routeName} <span className="text-muted-foreground">({item.routeType})</span></p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4" />Durak</div>
                  <p className="mt-1 font-semibold">{item.stopName}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bus className="h-4 w-4" />Sefer</div>
                  <p className="mt-1 font-semibold">{tripLabel(item.tripStatus)}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />Tahmini Varış</div>
                  <p className="mt-1 font-semibold">{item.etaMinutes != null ? `${item.etaMinutes} dk` : '—'}{item.distanceMeters != null ? ` • ${Math.round(item.distanceMeters)} m` : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{item.lastLocationAt ? `Son konum: ${new Date(item.lastLocationAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Servis konumu henüz gelmedi.'}</span>
                {mapUrl ? (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-semibold text-brand-primary hover:bg-brand-primary/10">
                    <MapPin className="h-4 w-4" />Haritada Gör
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}
