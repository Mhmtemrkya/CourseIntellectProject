import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock3, Video, Building2, Send, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createMeetingRequest, fetchMeetingAdvisors, fetchMeetingRequests, fetchMeetingSlots, fetchStaff, fetchStudents } from '../../lib/api/modules';

function parseSlot(slotValue) {
  const raw = String(slotValue || '').trim();
  const parsed = new Date(raw.replace(' ', 'T'));
  if (!Number.isNaN(parsed.getTime())) {
    return {
      raw,
      dateKey: parsed.toISOString().slice(0, 10),
      dayLabel: parsed.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
      fullLabel: parsed.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeLabel: parsed.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      sortable: parsed.getTime(),
    };
  }
  return { raw, dateKey: raw, dayLabel: raw, fullLabel: raw, timeLabel: raw, sortable: 0 };
}

export default function ParentMeetings() {
  const { toast } = useToast();
  const { user } = useApp();
  const [meetings, setMeetings] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [children, setChildren] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    topic: '',
    meetingType: 'online',
    studentName: '',
    teacherName: '',
    slot: '',
    dayKey: '',
  });

  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [meetingPayload, teacherPayload, advisorPayload, studentPayload] = await Promise.all([
        fetchMeetingRequests().catch(() => []),
        fetchStaff('Teacher').catch(() => []),
        fetchMeetingAdvisors().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      const userName = (user?.name || '').toLowerCase();
      const userUsername = (user?.username || '').toLowerCase();
      const linkedChildren = studentPayload.filter((item) => {
        const parentName = (item.parentName || '').toLowerCase();
        const parentEmail = (item.parentEmail || '').toLowerCase();
        return parentName.includes(userName) || (userUsername && parentEmail.includes(userUsername));
      });
      const backendAdvisors = Array.isArray(advisorPayload) ? advisorPayload.filter(Boolean) : [];
      const mappedTeachers = backendAdvisors.length > 0
        ? backendAdvisors.map((fullName, index) => ({ id: `advisor-${index}`, fullName }))
        : (Array.isArray(teacherPayload) ? teacherPayload : []);
      setMeetings(Array.isArray(meetingPayload) ? meetingPayload : []);
      setTeachers(mappedTeachers);
      setChildren(linkedChildren);
      setForm((prev) => ({
        ...prev,
        teacherName: prev.teacherName || mappedTeachers[0]?.fullName || '',
        studentName: prev.studentName || linkedChildren[0]?.fullName || '',
      }));
    } catch (err) {
      setError(err.message || 'Görüşmeler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.username]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const loadSlots = useCallback(async () => {
    if (!form.teacherName) {
      setSlots([]);
      return;
    }
    try {
      const payload = await fetchMeetingSlots({
        advisor: form.teacherName,
        onlineMeeting: form.meetingType === 'online',
      });
      const normalized = Array.isArray(payload) ? payload.map((item) => ({ ...item, slotInfo: parseSlot(item.slot) })) : [];
      setSlots(normalized);
      const firstDay = normalized[0]?.slotInfo?.dateKey || '';
      setForm((prev) => ({
        ...prev,
        dayKey: firstDay,
        slot: normalized[0]?.slot || '',
      }));
    } catch {
      setSlots([]);
      setForm((prev) => ({ ...prev, dayKey: '', slot: '' }));
    }
  }, [form.teacherName, form.meetingType]);

  useEffect(() => {
    if (open) loadSlots();
  }, [open, loadSlots]);

  const groupedSlots = useMemo(() => {
    const map = new Map();
    slots.forEach((item) => {
      const existing = map.get(item.slotInfo.dateKey) || {
        dateKey: item.slotInfo.dateKey,
        dayLabel: item.slotInfo.dayLabel,
        fullLabel: item.slotInfo.fullLabel,
        slots: [],
      };
      existing.slots.push(item);
      map.set(item.slotInfo.dateKey, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [slots]);

  const visibleTimes = groupedSlots.find((item) => item.dateKey === form.dayKey)?.slots || [];

  const handleCreate = async () => {
    if (!form.topic.trim() || !form.teacherName.trim() || !form.studentName.trim() || !form.slot.trim()) {
      toast({ title: 'Eksik bilgi', description: 'Konu, çocuk, öğretmen, gün ve saat seçimi zorunlu.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const created = await createMeetingRequest({
        topic: form.topic,
        parentName: user?.name || 'Veli',
        studentName: form.studentName,
        advisor: form.teacherName,
        slot: form.slot,
        onlineMeeting: form.meetingType === 'online',
        note: `${form.meetingType === 'online' ? 'Online' : 'Yüz yüze'} veli görüşme talebi`,
      });
      setMeetings((prev) => [created, ...prev]);
      setOpen(false);
      setForm((prev) => ({ ...prev, topic: '', slot: '', dayKey: '' }));
      toast({ title: 'Görüşme talebi gönderildi' });
    } catch (err) {
      toast({ title: 'Görüşme talebi oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#1e293b_0%,#0f766e_58%,#22c55e_100%)] p-7 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="bg-white/12 text-white hover:bg-white/12">Veli Görüşme Merkezi</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Öğretmenin tanımladığı gün ve saatlerden seçerek talep oluştur</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">Sadece öğretmenin uygun açtığı saatleri görür, ilgili günü seçip listedeki saatlerden birini işaretlersin.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-slate-900 hover:bg-white/90">Yeni Görüşme Talebi</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Görüşme Talebi Oluştur</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Konu</Label>
                  <Input value={form.topic} onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))} placeholder="Akademik gelişim görüşmesi" />
                </div>
                <div className="space-y-2">
                  <Label>Çocuk</Label>
                  <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.studentName} onChange={(e) => setForm((prev) => ({ ...prev, studentName: e.target.value }))}>
                    {children.map((child) => <option key={child.id || child.username} value={child.fullName}>{child.fullName}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Öğretmen</Label>
                  <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.teacherName} onChange={(e) => setForm((prev) => ({ ...prev, teacherName: e.target.value }))}>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.fullName}>{teacher.fullName}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Görüşme Tipi</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, meetingType: 'online' }))} className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${form.meetingType === 'online' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Video className="mr-2 inline h-4 w-4" />Online
                    </button>
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, meetingType: 'offline' }))} className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${form.meetingType === 'offline' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Building2 className="mr-2 inline h-4 w-4" />Yüz yüze
                    </button>
                  </div>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <Label>Uygun Günler</Label>
                  <div className="flex flex-wrap gap-2">
                    {groupedSlots.map((group) => (
                      <button key={group.dateKey} type="button" onClick={() => setForm((prev) => ({ ...prev, dayKey: group.dateKey, slot: group.slots[0]?.slot || '' }))} className={`rounded-full px-4 py-2 text-sm font-semibold ${form.dayKey === group.dateKey ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {group.dayLabel}
                      </button>
                    ))}
                  </div>
                  {groupedSlots.length === 0 ? <p className="text-sm text-muted-foreground">Bu öğretmen için tanımlı uygun görüşme saati bulunmuyor.</p> : null}
                </div>
                <div className="space-y-3 md:col-span-2">
                  <Label>Saatler</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {visibleTimes.map((slot) => (
                      <button key={slot.slot} type="button" onClick={() => setForm((prev) => ({ ...prev, slot: slot.slot }))} className={`rounded-2xl border px-4 py-3 text-left transition ${form.slot === slot.slot ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                        <p className="font-semibold">{slot.slotInfo.timeLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">{slot.onlineMeeting ? 'Online' : 'Yüz yüze'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? 'Gönderiliyor...' : 'Talep Oluştur'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {error ? <ErrorBanner title="Görüşmeler alınamadı" message={error} onRetry={loadMeetings} /> : null}

      <div className="grid gap-4">
        {meetings.map((item) => {
          const slotInfo = parseSlot(item.slot || item.requestedDate || item.meetingDate);
          return (
            <Card key={item.id} className="border-slate-200 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.topic || 'Görüşme talebi'}</p>
                      <p className="text-sm text-slate-500">{item.teacherName || item.assignedTeacher || 'Öğretmen'} • {item.studentName || '-'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline"><CalendarDays className="mr-2 h-3 w-3" />{slotInfo.fullLabel}</Badge>
                    <Badge variant="outline"><Clock3 className="mr-2 h-3 w-3" />{slotInfo.timeLabel}</Badge>
                    <Badge variant="outline">{item.onlineMeeting ? 'Online' : 'Yüz yüze'}</Badge>
                  </div>
                </div>
                <Badge variant="outline">{item.status || 'Beklemede'}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
