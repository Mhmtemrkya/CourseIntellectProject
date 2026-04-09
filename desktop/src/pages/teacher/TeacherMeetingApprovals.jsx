import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, Plus, Trash2, Video, Building2, UserRound, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  createMeetingAvailability,
  deleteMeetingAvailability,
  fetchMeetingAvailability,
  fetchMeetingRequests,
  updateMeetingRequestStatus,
} from '../../lib/api/modules';

function parseSlot(slotValue) {
  const raw = String(slotValue || '').trim();
  const isoCandidate = raw.replace(' ', 'T');
  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      raw,
      dateKey: parsed.toISOString().slice(0, 10),
      dayLabel: parsed.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeLabel: parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      sortable: parsed.getTime(),
    };
  }

  const [datePart = '', timePart = ''] = raw.split(' ');
  return {
    raw,
    dateKey: datePart,
    dayLabel: datePart || 'Tarih belirtilmedi',
    timeLabel: timePart || raw,
    sortable: 0,
  };
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('onay')) return 'success';
  if (value.includes('red')) return 'danger';
  return 'warning';
}

function statusBadge(status) {
  const tone = statusTone(status);
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return <Badge className={styles[tone]}>{status || 'Bekliyor'}</Badge>;
}

export default function TeacherMeetingApprovals() {
  const { user } = useApp();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [onlineMeeting, setOnlineMeeting] = useState(true);

  const timeOptions = useMemo(() => {
    const values = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      for (let minute = 0; minute < 60; minute += 15) {
        const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        values.push(label);
      }
    }
    return values;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [requestData, availabilityData] = await Promise.all([
        fetchMeetingRequests({ teacherName: user?.name }),
        fetchMeetingAvailability({ teacherName: user?.name }).catch(() => []),
      ]);
      setRequests(Array.isArray(requestData) ? requestData : []);
      setAvailability(Array.isArray(availabilityData) ? availabilityData : []);
    } catch (err) {
      setError(err.message || 'Görüşme talepleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedAvailability = useMemo(() => {
    const map = new Map();
    availability.forEach((item) => {
      const info = parseSlot(item.slot);
      const existing = map.get(info.dateKey) || {
        dateKey: info.dateKey,
        dayLabel: info.dayLabel,
        slots: [],
      };
      existing.slots.push({ ...item, ...info });
      map.set(info.dateKey, existing);
    });
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        slots: group.slots.sort((a, b) => a.sortable - b.sortable),
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [availability]);

  const requestCards = useMemo(() => {
    return [...requests]
      .map((item) => ({ ...item, slotInfo: parseSlot(item.slot || item.requestedDate) }))
      .sort((a, b) => b.slotInfo.sortable - a.slotInfo.sortable);
  }, [requests]);

  const pendingCount = requestCards.filter((item) => statusTone(item.status) === 'warning').length;
  const approvedCount = requestCards.filter((item) => statusTone(item.status) === 'success').length;

  const createSlot = async () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: 'Lütfen tarih ve saat seçin', variant: 'destructive' });
      return;
    }
    try {
      const slot = `${selectedDate} ${selectedTime}`;
      const created = await createMeetingAvailability({
        advisor: user?.name,
        slot,
        onlineMeeting,
      });
      setAvailability((prev) => [...prev, created]);
      setSelectedDate('');
      setSelectedTime('');
      toast({ title: 'Görüşme saati eklendi' });
    } catch (err) {
      toast({ title: err.message || 'Slot eklenemedi', variant: 'destructive' });
    }
  };

  const removeSlot = async (id) => {
    try {
      await deleteMeetingAvailability(id);
      setAvailability((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Saat kaldırıldı' });
    } catch (err) {
      toast({ title: err.message || 'Saat silinemedi', variant: 'destructive' });
    }
  };

  const updateStatus = async (item, status) => {
    try {
      await updateMeetingRequestStatus(item.id, status);
      setRequests((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)));
      toast({ title: status === 'Onaylandı' ? 'Talep onaylandı' : 'Talep reddedildi' });
    } catch (err) {
      toast({ title: err.message || 'Durum güncellenemedi', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#7c3aed_58%,#ec4899_100%)] p-7 text-white shadow-xl">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-3">
            <Badge className="bg-white/12 text-white hover:bg-white/12">Görüşme Onayları</Badge>
            <div>
              <h1 className="text-3xl font-bold font-heading">Takvimini tanımla, veliye sadece uygun saatleri göster</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/75">
                Belirlediğin gün ve saatler veli tarafında liste halinde görünür. Gelen talepleri buradan onaylayabilir, reddedebilir ve tüm akışı düzenli bir görünümde takip edebilirsin.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Bekleyen', value: pendingCount },
              { label: 'Onaylanan', value: approvedCount },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/65">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-violet-600" />Müsaitlik Takvimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto]">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Saat seçin" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createSlot}><Plus className="mr-2 h-4 w-4" />Saat Ekle</Button>
            </div>
            {selectedDate || selectedTime ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Seçilen slot:
                <span className="ml-2 font-semibold text-slate-900">
                  {selectedDate || 'Tarih seçin'} {selectedTime || 'Saat seçin'}
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setOnlineMeeting(true)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${onlineMeeting ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Video className="mr-2 inline h-4 w-4" />Online
              </button>
              <button type="button" onClick={() => setOnlineMeeting(false)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${!onlineMeeting ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Building2 className="mr-2 inline h-4 w-4" />Yüz yüze
              </button>
            </div>
            <div className="space-y-3">
              {groupedAvailability.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Henüz takvime eklenmiş görüşme saati yok.
                </div>
              ) : groupedAvailability.map((group) => (
                <div key={group.dateKey} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{group.dayLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <div key={slot.id || slot.raw} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <Clock3 className="h-4 w-4 text-violet-600" />
                        <span>{slot.timeLabel}</span>
                        <Badge variant="outline" className="border-transparent bg-slate-100">{slot.onlineMeeting ? 'Online' : 'Yüz yüze'}</Badge>
                        {slot.id ? (
                          <button type="button" onClick={() => removeSlot(slot.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Gelen Talepler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Henüz veli görüşme talebi gelmedi.
              </div>
            ) : requestCards.map((item) => (
              <div key={item.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.parentName}</p>
                        <p className="text-sm text-slate-500">{item.studentName} • {item.topic}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{item.slotInfo.dayLabel}</Badge>
                      <Badge variant="outline">{item.slotInfo.timeLabel}</Badge>
                      <Badge variant="outline">{item.onlineMeeting ? 'Online' : 'Yüz yüze'}</Badge>
                      {statusBadge(item.status)}
                    </div>
                    {item.note ? <p className="text-sm leading-6 text-slate-600">{item.note}</p> : null}
                  </div>
                  {statusTone(item.status) === 'warning' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => updateStatus(item, 'Onaylandı')}><CheckCircle2 className="mr-2 h-4 w-4" />Onayla</Button>
                      <Button variant="outline" className="text-rose-600" onClick={() => updateStatus(item, 'Reddedildi')}><XCircle className="mr-2 h-4 w-4" />Reddet</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
