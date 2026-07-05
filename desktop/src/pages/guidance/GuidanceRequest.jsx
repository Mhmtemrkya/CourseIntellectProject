import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, GraduationCap, HeartHandshake, ListChecks } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';
import { api } from '../../lib/api/client';
import {
  completeGuidanceInventory,
  createGuidanceAppointment,
  fetchGuidanceAppointments,
  fetchGuidanceAvailability,
  fetchGuidanceCounselors,
  fetchGuidanceInventories,
  fetchStudents,
} from '../../lib/api/modules';

const STATUS_STYLES = {
  Bekliyor: 'border-amber-500/30 text-amber-500',
  'Onaylandı': 'border-emerald-500/30 text-emerald-600',
  Reddedildi: 'border-red-500/30 text-red-500',
  'Tamamlandı': 'border-sky-500/30 text-sky-500',
};

// Envanter soruları istemcide tanımlıdır; yanıtlar {"q","a"} olarak saklanır.
const INVENTORY_QUESTIONS = {
  'ogrenme-stili': {
    label: 'Öğrenme Stili',
    questions: [
      'Yeni bir konuyu en kolay nasıl öğrenirsin? (okuyarak / dinleyerek / yaparak)',
      'Ders çalışırken ortamın nasıl olmalı? (sessiz / müzikli / kalabalık)',
      'Not tutar mısın, nasıl?',
      'En verimli çalıştığın saat aralığı hangisi?',
      'Bir konuyu anlamadığında ilk ne yaparsın?',
    ],
  },
  'sinav-kaygisi': {
    label: 'Sınav Kaygısı Ölçeği',
    questions: [
      'Sınavdan önceki gece uykun nasıl olur?',
      'Sınav sırasında bildiğin soruları unuttuğun olur mu? Ne sıklıkla?',
      'Sınav sonuçları açıklanmadan önce neler hissedersin?',
      'Sınav kaygısının derslerini etkilediğini düşünüyor musun? Nasıl?',
      'Kaygını azaltmak için ne yapıyorsun?',
    ],
  },
  'ilgi-envanteri': {
    label: 'İlgi Envanteri',
    questions: [
      'Boş zamanlarında en çok ne yapmaktan hoşlanırsın?',
      'Hangi dersleri seviyorsun, neden?',
      'İleride hangi mesleği yapmak istersin?',
      'Bir problemi çözerken tek başına mı, grupla mı çalışmayı tercih edersin?',
      'Seni en çok ne motive eder?',
    ],
  },
};

// Öğrenci ve veli için rehberlik ekranı: randevu talebi, randevularım,
// (öğrenci) envanter doldurma, (veli) çocuk program uyumu ve hedef özeti.
export default function GuidanceRequest() {
  const { user } = useApp();
  const { toast } = useToast();
  const isParent = user?.role === 'parent';

  const [counselors, setCounselors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [children, setChildren] = useState([]);
  const [childSummary, setChildSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ counselor: '', slot: '', topic: '', note: '', studentName: '' });
  const [saving, setSaving] = useState(false);
  const [activeInventory, setActiveInventory] = useState(null);
  const [inventoryAnswers, setInventoryAnswers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [counselorList, myAppointments] = await Promise.all([
        fetchGuidanceCounselors(),
        fetchGuidanceAppointments(true).catch(() => []),
      ]);
      setCounselors(counselorList);
      setAppointments(myAppointments);
      setForm((prev) => ({ ...prev, counselor: prev.counselor || counselorList[0]?.fullName || '' }));

      if (isParent) {
        const [summary, students] = await Promise.all([
          api.get('/api/guidance/parent/child-summary').catch(() => []),
          fetchStudents().catch(() => []),
        ]);
        setChildSummary(Array.isArray(summary) ? summary : []);
        const userName = (user?.name || '').toLowerCase();
        const username = (user?.username || '').toLowerCase();
        const linked = students.filter((item) => {
          const parentName = (item.parentName || '').toLowerCase();
          const parentEmail = (item.parentEmail || '').toLowerCase();
          return parentName.includes(userName) || (username && parentEmail.includes(username));
        });
        setChildren(linked);
        setForm((prev) => ({ ...prev, studentName: prev.studentName || linked[0]?.fullName || '' }));
      } else {
        const myInventories = await fetchGuidanceInventories().catch(() => []);
        setInventories(myInventories);
      }
    } catch (err) {
      setError(err?.message || 'Rehberlik bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [isParent, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form.counselor) { setSlots([]); return; }
    fetchGuidanceAvailability(form.counselor)
      .then((data) => setSlots((data?.slots || []).filter((s) => s.available)))
      .catch(() => setSlots([]));
  }, [form.counselor]);

  const pendingInventories = useMemo(
    () => inventories.filter((item) => item.status !== 'Tamamlandı'),
    [inventories],
  );

  const submit = async () => {
    if (!form.counselor || !form.slot) {
      toast({ title: 'Rehber ve saat seçin', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createGuidanceAppointment({
        counselorName: form.counselor,
        slot: form.slot,
        topic: form.topic,
        note: form.note,
        studentName: isParent ? form.studentName : undefined,
      });
      toast({ title: 'Randevu talebi gönderildi', description: `${form.counselor} • ${form.slot}` });
      setForm((prev) => ({ ...prev, slot: '', topic: '', note: '' }));
      load();
    } catch (err) {
      toast({ title: 'Talep gönderilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openInventory = (item) => {
    const meta = INVENTORY_QUESTIONS[item.inventoryType];
    setActiveInventory(item);
    setInventoryAnswers((meta?.questions || []).map((q) => ({ q, a: '' })));
  };

  const submitInventory = async () => {
    try {
      await completeGuidanceInventory(activeInventory.id, JSON.stringify(inventoryAnswers));
      toast({ title: 'Envanter tamamlandı', description: 'Yanıtların rehberlik servisine iletildi.' });
      setActiveInventory(null);
      load();
    } catch (err) {
      toast({ title: 'Gönderilemedi', description: err?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="guidance-request">
      <div>
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <HeartHandshake className="h-8 w-8 text-brand-accent" /> Rehberlik
        </h1>
        <p className="text-sm text-muted-foreground">
          {isParent
            ? 'Çocuğunuzun rehberlik takibi ve rehber öğretmenle randevu.'
            : 'Rehber öğretmeninden randevu al, sana atanan envanterleri doldur.'}
        </p>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      {/* Veli: çocuk özeti */}
      {isParent && childSummary.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {childSummary.map((child) => (
            <div key={child.studentName} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-sm font-black text-white">
                  {child.studentName?.slice(0, 2)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold">{child.studentName}</p>
                  <p className="text-xs text-muted-foreground">{child.className}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Çalışma programı uyumu</span>
                  <span className="font-black">{child.compliance?.rate == null ? '—' : `%${child.compliance.rate}`}</span>
                </div>
                <Progress className="mt-2 h-2" value={child.compliance?.rate || 0} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {child.compliance?.done || 0}/{child.compliance?.total || 0} görev tamamlandı
                </p>
              </div>
              {child.goal ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <GraduationCap className="h-4 w-4 shrink-0 text-brand-accent" />
                  <span className="min-w-0 truncate">Hedef: <b>{child.goal.targetSchool || '—'}</b></span>
                  <span className="ml-auto shrink-0 font-black">%{child.goal.progress || 0}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Öğrenci: bekleyen envanterler */}
      {!isParent && pendingInventories.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black">
            <ListChecks className="h-4 w-4 text-amber-500" /> Doldurman Gereken Envanterler
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingInventories.map((item) => (
              <Button key={item.id} variant="outline" className="rounded-xl" onClick={() => openInventory(item)}>
                {INVENTORY_QUESTIONS[item.inventoryType]?.label || item.inventoryType} →
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Randevu talebi */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-black">
            <CalendarPlus className="h-4 w-4 text-brand-accent" /> Randevu Talep Et
          </h2>
          <div className="mt-4 space-y-3">
            {isParent && (
              <div>
                <Label>Öğrenci</Label>
                <Select value={form.studentName || undefined} onValueChange={(v) => setForm((p) => ({ ...p, studentName: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Çocuğunuzu seçin" /></SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id || child.fullName} value={child.fullName}>{child.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Rehber Öğretmen</Label>
              <Select value={form.counselor || undefined} onValueChange={(v) => setForm((p) => ({ ...p, counselor: v, slot: '' }))}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Rehber seçin" /></SelectTrigger>
                <SelectContent>
                  {counselors.map((c) => <SelectItem key={c.fullName} value={c.fullName}>{c.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Uygun Saatler</Label>
              {slots.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  Bu rehber için uygun saat bulunamadı.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, slot: slot.slot }))}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        form.slot === slot.slot
                          ? 'border-brand-accent bg-brand-accent text-white'
                          : 'hover:bg-foreground/[0.05]'
                      }`}
                    >
                      {slot.slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Konu / Not (opsiyonel)</Label>
              <Textarea className="mt-1 rounded-xl" rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Görüşmek istediğiniz konu..." />
            </div>
            <Button className="w-full rounded-xl" onClick={submit} disabled={saving || !form.slot}>
              {saving ? 'Gönderiliyor...' : 'Randevu Talebi Gönder'}
            </Button>
          </div>
        </div>

        {/* Randevularım */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b p-4"><h2 className="font-black">Randevularım</h2></div>
          {appointments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Henüz randevu talebiniz yok.</p>
          ) : appointments.map((appointment) => (
            <div key={appointment.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{appointment.counselorName}</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.slot}
                  {isParent && appointment.studentName ? ` • ${appointment.studentName}` : ''}
                </p>
                {appointment.decisionNote ? <p className="mt-1 text-xs text-muted-foreground">"{appointment.decisionNote}"</p> : null}
              </div>
              <Badge variant="outline" className={`rounded-lg ${STATUS_STYLES[appointment.status] || ''}`}>{appointment.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Envanter doldurma dialogu */}
      <Dialog open={activeInventory != null} onOpenChange={(open) => !open && setActiveInventory(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeInventory ? (INVENTORY_QUESTIONS[activeInventory.inventoryType]?.label || 'Envanter') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {inventoryAnswers.map((answer, index) => (
              <div key={index}>
                <Label className="leading-snug">{index + 1}. {answer.q}</Label>
                <Textarea
                  className="mt-1 rounded-xl"
                  rows={2}
                  value={answer.a}
                  onChange={(e) => setInventoryAnswers((prev) => prev.map((a, i) => (i === index ? { ...a, a: e.target.value } : a)))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setActiveInventory(null)}>Vazgeç</Button>
            <Button
              className="rounded-xl"
              onClick={submitInventory}
              disabled={inventoryAnswers.some((a) => !a.a.trim())}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
