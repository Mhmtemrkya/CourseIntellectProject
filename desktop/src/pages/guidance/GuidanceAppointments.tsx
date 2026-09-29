import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Clock, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  completeGuidanceAppointment,
  decideGuidanceAppointment,
  fetchGuidanceAppointments,
  fetchGuidanceAvailability,
  saveGuidanceAvailability,
} from '../../lib/api/modules';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const STATUS_STYLES = {
  Bekliyor: 'border-amber-500/30 text-amber-500',
  'Onaylandı': 'border-emerald-500/30 text-emerald-600',
  Reddedildi: 'border-red-500/30 text-red-500',
  'Tamamlandı': 'border-sky-500/30 text-sky-500',
};

export default function GuidanceAppointments() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSlotDay, setNewSlotDay] = useState('Pazartesi');
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [savingSlots, setSavingSlots] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [appointmentList, availability] = await Promise.all([
        fetchGuidanceAppointments(),
        fetchGuidanceAvailability().catch(() => ({ slots: [] })),
      ]);
      setAppointments(appointmentList);
      setSlots((availability?.slots || []).map((s) => s.slot));
    } catch (err) {
      setError(err?.message || 'Randevular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistSlots = async (next) => {
    setSavingSlots(true);
    try {
      await saveGuidanceAvailability(next);
      setSlots(next);
      toast({ title: 'Müsaitlik güncellendi' });
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingSlots(false);
    }
  };

  const addSlot = () => {
    const slot = `${newSlotDay} ${newSlotTime}`;
    if (slots.includes(slot)) {
      toast({ title: 'Bu slot zaten var', variant: 'destructive' });
      return;
    }
    persistSlots([...slots, slot].sort());
  };

  const decide = async (appointment, approved) => {
    try {
      await decideGuidanceAppointment(appointment.id, { approved });
      toast({
        title: approved ? 'Randevu onaylandı' : 'Randevu reddedildi',
        description: `${appointment.requesterName} • ${appointment.slot} — talep sahibine bildirim gönderildi.`,
      });
      load();
    } catch (err) {
      toast({ title: 'İşlem yapılamadı', description: err?.message, variant: 'destructive' });
    }
  };

  const complete = async (appointment) => {
    try {
      await completeGuidanceAppointment(appointment.id);
      load();
    } catch (err) {
      toast({ title: 'İşlem yapılamadı', description: err?.message, variant: 'destructive' });
    }
  };

  const pending = useMemo(() => appointments.filter((a) => a.status === 'Bekliyor'), [appointments]);
  const others = useMemo(() => appointments.filter((a) => a.status !== 'Bekliyor'), [appointments]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="guidance-appointments">
      <div>
        <h1 className="font-heading text-3xl font-bold">Randevular</h1>
        <p className="text-sm text-muted-foreground">
          Haftalık müsaitliğinizi tanımlayın; öğrenci ve veliler uygun saatlerden randevu ister.
        </p>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Müsaitlik */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black"><Clock className="h-4 w-4 text-brand-accent" /> Haftalık Müsaitlik</h2>
          <div className="mt-4 flex gap-2">
            <select
              value={newSlotDay}
              onChange={(e) => setNewSlotDay(e.target.value)}
              className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm"
            >
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Input type="time" className="w-28 rounded-xl" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} />
            <Button className="rounded-xl" onClick={addSlot} disabled={savingSlots}>
              <CalendarPlus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz slot eklenmedi. Slot eklemeden randevu alınamaz.</p>
            ) : slots.map((slot) => (
              <div key={slot} className="flex items-center justify-between rounded-xl border p-2.5 text-sm">
                <span className="font-semibold">{slot}</span>
                <button type="button" onClick={() => persistSlots(slots.filter((s) => s !== slot))} disabled={savingSlots}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Randevu listesi */}
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4"><h2 className="font-black">Bekleyen Talepler ({pending.length})</h2></div>
            {pending.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Bekleyen randevu talebi yok.</p>
            ) : pending.map((appointment) => (
              <div key={appointment.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{appointment.requesterName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {appointment.requesterRole === 'parent' ? `Veli${appointment.studentName ? ` (${appointment.studentName})` : ''}` : 'Öğrenci'}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{appointment.slot}{appointment.topic ? ` • ${appointment.topic}` : ''}</p>
                  {appointment.note ? <p className="mt-1 text-xs text-muted-foreground">"{appointment.note}"</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decide(appointment, true)}>
                    <Check className="mr-1 h-4 w-4" /> Onayla
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-red-500" onClick={() => decide(appointment, false)}>
                    <X className="mr-1 h-4 w-4" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4"><h2 className="font-black">Geçmiş & Onaylılar</h2></div>
            {others.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Kayıt yok.</p>
            ) : others.map((appointment) => (
              <div key={appointment.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{appointment.requesterName}</p>
                  <p className="text-sm text-muted-foreground">{appointment.slot}{appointment.topic ? ` • ${appointment.topic}` : ''}</p>
                </div>
                <Badge variant="outline" className={`rounded-lg ${STATUS_STYLES[appointment.status] || ''}`}>{appointment.status}</Badge>
                {appointment.status === 'Onaylandı' && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => complete(appointment)}>
                    Görüşme Yapıldı
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
