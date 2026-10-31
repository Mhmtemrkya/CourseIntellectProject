import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, DoorOpen, IdCard, LogIn, LogOut, Pencil, Printer, Search, ShieldCheck, Trash2, UserRoundCheck, Users,
} from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  checkInVisitor, checkOutVisitor, deleteVisitor, fetchVisitorHosts, fetchVisitors, lookupVisitors, searchVisitorStudents, updateVisitor,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  VisitorDto, VisitorHostOptionDto, VisitorListDto, VisitorLookupDto, VisitorStudentOptionDto,
} from '../../types/api/generated';

/** Sunucudaki VisitorService.VisitorTypes ile birebir. */
const VISITOR_TYPES: Array<{ key: string; label: string }> = [
  { key: 'Parent', label: 'Veli' },
  { key: 'Guest', label: 'Misafir' },
  { key: 'Supplier', label: 'Tedarikçi / Kargo' },
  { key: 'Official', label: 'Resmî Görevli' },
  { key: 'JobCandidate', label: 'İş Görüşmesi' },
  { key: 'Maintenance', label: 'Teknik Servis' },
  { key: 'Other', label: 'Diğer' },
];
const typeLabel = (key: string) => VISITOR_TYPES.find((item) => item.key === key)?.label ?? key;

const QUICK_DEPARTMENTS = ['Müdür', 'Müdür Yardımcısı', 'Rehberlik Servisi', 'Muhasebe', 'Kayıt Birimi', 'Öğretmenler Odası'];

const OVERSTAY_MINUTES = 180;

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}

function time(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function dayRange(day: string): { fromUtc: string; toUtc: string } {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start.getTime() + 86400000);
  return { fromUtc: start.toISOString(), toUtc: end.toISOString() };
}

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Ziyaretçi takibi (danışma/sekreterlik): giriş-çıkış kaydı, ziyaret edilen
 * kişiye bildirim, içeride kalanlar, gün geçmişi. KVKK: kimlik numarasının
 * yalnız son 4 hanesi saklanır, kayıtlar saklama süresi sonunda silinir.
 */
export default function VisitorsPage() {
  const { toast } = useToast();
  const { user } = useApp();
  const isAdmin = ['admin', 'branchmanager'].includes(String(user?.backendRole || user?.role || '').toLowerCase());
  const [tab, setTab] = useState<'inside' | 'day'>('inside');
  const [day, setDay] = useState(localToday);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<VisitorListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<VisitorDto | 'new' | null>(null);
  const [badge, setBadge] = useState<VisitorDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchVisitors(tab === 'inside'
        ? { status: 'inside', search }
        : { ...dayRange(day), search }));
    } catch (error) {
      toast({ title: 'Ziyaretçiler alınamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [day, search, tab, toast]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void load(); }, 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  const checkOut = async (visitor: VisitorDto) => {
    try {
      await checkOutVisitor(visitor.id);
      toast({ title: `${visitor.fullName} çıkış yaptı`, description: visitor.badgeNo ? `${visitor.badgeNo} numaralı kartı teslim alın.` : undefined });
      await load();
    } catch (error) {
      toast({ title: 'Çıkış yapılamadı', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const remove = async (visitor: VisitorDto) => {
    if (!window.confirm(`${visitor.fullName} kaydı kalıcı olarak silinsin mi? (KVKK silme talebi için)`)) return;
    try {
      await deleteVisitor(visitor.id);
      await load();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  if (loading && !data) return <PageLoading />;
  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <Page testId="visitors-page">
      <PageHeader
        title="Ziyaretçi Takibi"
        description="Okula gelen ziyaretçilerin giriş-çıkışını kaydedin; ziyaret edilen kişiye anında haber verin."
        icon={DoorOpen}
        onRefresh={load}
        refreshing={loading}
        actions={<Button onClick={() => setEditor('new')}><LogIn className="mr-2 h-4 w-4" />Ziyaretçi Girişi</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Şu an içeride" value={summary?.insideCount ?? 0} caption="Çıkışı yapılmadı" icon={UserRoundCheck} tone="brand" />
        <StatCard label="Bugünkü ziyaret" value={summary?.todayCount ?? 0} caption="Giriş kaydı" icon={Users} tone="blue" />
        <StatCard label="Ortalama süre" value={summary?.averageMinutes ?? 0} caption="dakika (bugün)" icon={Clock} tone="emerald" />
        <StatCard label="Uzun süredir içeride" value={summary?.overstayCount ?? 0} caption="3 saati aştı" icon={ShieldCheck} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value === 'day' ? 'day' : 'inside')}>
          <TabsList>
            <TabsTrigger value="inside">İçeridekiler</TabsTrigger>
            <TabsTrigger value="day">Gün Geçmişi</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'day' ? <Input type="date" className="w-44" value={day} max={localToday()} onChange={(event) => setDay(event.target.value || localToday())} /> : null}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Ad, telefon, kart no, ziyaret edilen..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {items.length === 0 ? (
        <PageNotice icon={DoorOpen}
          title={tab === 'inside' ? 'Şu an içeride ziyaretçi yok' : 'Bu gün için kayıt yok'}
          message={tab === 'inside' ? 'Yeni ziyaretçi geldiğinde "Ziyaretçi Girişi" ile kaydedin.' : 'Başka bir gün seçin.'} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="divide-y">
            {items.map((visitor) => {
              const inside = !visitor.checkOutAtUtc;
              const overstay = inside && visitor.durationMinutes > OVERSTAY_MINUTES;
              return (
                <div key={visitor.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${inside ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-foreground/[0.06] text-muted-foreground'}`}>
                    {inside ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {visitor.fullName}
                      <Badge variant="outline">{typeLabel(visitor.visitorType)}</Badge>
                      {visitor.badgeNo ? <Badge variant="outline" className="gap-1"><IdCard className="h-3 w-3" />{visitor.badgeNo}</Badge> : null}
                      {visitor.companionCount > 0 ? <Badge variant="outline">+{visitor.companionCount} kişi</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      → <b className="text-foreground">{visitor.hostName}</b> • {visitor.purpose}
                      {visitor.studentName ? ` • Öğrenci: ${visitor.studentName}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Giriş {time(visitor.checkInAtUtc)}{visitor.checkOutAtUtc ? ` • Çıkış ${time(visitor.checkOutAtUtc)}` : ''} • {duration(visitor.durationMinutes)}
                      {visitor.phone ? ` • ${visitor.phone}` : ''}{visitor.vehiclePlate ? ` • ${visitor.vehiclePlate}` : ''}
                      {visitor.createdByName ? ` • Kaydeden: ${visitor.createdByName}` : ''}
                    </p>
                  </div>
                  {overstay ? <Badge className="bg-rose-600 text-white">{duration(visitor.durationMinutes)} içeride</Badge> : null}
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Ziyaretçi kartı yazdır" onClick={() => setBadge(visitor)}><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => setEditor(visitor)}><Pencil className="h-4 w-4" /></Button>
                    {isAdmin ? <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => void remove(visitor)}><Trash2 className="h-4 w-4 text-rose-600" /></Button> : null}
                    {inside ? <Button size="sm" onClick={() => void checkOut(visitor)}><LogOut className="mr-1 h-4 w-4" />Çıkış</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        KVKK: Kimlik numarasının yalnız son 4 hanesi saklanır. Kayıtlar {data?.retentionDays ?? 365} gün sonra otomatik silinir.
      </p>

      {editor ? (
        <VisitorEditor
          visitor={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={(saved) => { setEditor(null); if (editor === 'new' && saved.badgeNo) setBadge(saved); void load(); }}
        />
      ) : null}
      {badge ? <BadgeDialog visitor={badge} onClose={() => setBadge(null)} /> : null}
    </Page>
  );
}

function VisitorEditor({ visitor, onClose, onSaved }: { visitor: VisitorDto | null; onClose: () => void; onSaved: (saved: VisitorDto) => void }) {
  const { toast } = useToast();
  const [hosts, setHosts] = useState<VisitorHostOptionDto[]>([]);
  const [suggestions, setSuggestions] = useState<VisitorLookupDto[]>([]);
  const [students, setStudents] = useState<VisitorStudentOptionDto[]>([]);
  const [studentSearch, setStudentSearch] = useState(visitor?.studentName ?? '');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: visitor?.fullName ?? '',
    phone: visitor?.phone ?? '',
    identity: '',
    visitorType: visitor?.visitorType ?? 'Parent',
    purpose: visitor?.purpose ?? '',
    hostMode: visitor && !visitor.hostUserId ? 'department' : 'person',
    hostUserId: visitor?.hostUserId ?? '',
    hostName: visitor && !visitor.hostUserId ? visitor.hostName : '',
    studentUserId: visitor?.studentUserId ?? '',
    badgeNo: visitor?.badgeNo ?? '',
    vehiclePlate: visitor?.vehiclePlate ?? '',
    companionCount: visitor ? String(visitor.companionCount) : '0',
    note: visitor?.note ?? '',
    privacy: Boolean(visitor),
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    fetchVisitorHosts().then((list) => setHosts(list ?? [])).catch(() => setHosts([]));
  }, []);

  useEffect(() => {
    if (visitor || form.fullName.trim().length < 2) { setSuggestions([]); return undefined; }
    const handle = window.setTimeout(() => {
      lookupVisitors(form.fullName).then((list) => setSuggestions(list ?? [])).catch(() => setSuggestions([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [form.fullName, visitor]);

  useEffect(() => {
    if (form.visitorType !== 'Parent' || studentSearch.trim().length < 2 || form.studentUserId) { setStudents([]); return undefined; }
    const handle = window.setTimeout(() => {
      searchVisitorStudents(studentSearch).then((list) => setStudents(list ?? [])).catch(() => setStudents([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [form.studentUserId, form.visitorType, studentSearch]);

  const hostOptions = useMemo(() => hosts, [hosts]);

  const save = async () => {
    if (!visitor && !form.privacy) {
      toast({ title: 'KVKK aydınlatma metnini ziyaretçiye bildirdiğinizi işaretleyin.', variant: 'destructive' });
      return;
    }
    const common = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || null,
      visitorType: form.visitorType,
      purpose: form.purpose.trim(),
      hostUserId: form.hostMode === 'person' && form.hostUserId ? form.hostUserId : null,
      hostName: form.hostMode === 'department' ? form.hostName.trim() : null,
      studentUserId: form.visitorType === 'Parent' && form.studentUserId ? form.studentUserId : null,
      badgeNo: form.badgeNo.trim() || null,
      vehiclePlate: form.vehiclePlate.trim() || null,
      companionCount: Number(form.companionCount) || 0,
      note: form.note.trim() || null,
    };
    setSaving(true);
    try {
      const saved = visitor
        ? await updateVisitor(visitor.id, common)
        : await checkInVisitor({ ...common, identity: form.identity.trim() || null, privacyNoticeShown: form.privacy });
      if (!saved) throw new Error('Kayıt yanıtı alınamadı.');
      toast({ title: visitor ? 'Kayıt güncellendi' : 'Ziyaretçi girişi kaydedildi', description: !visitor && common.hostUserId ? 'Ziyaret edilen kişiye bildirim gönderildi.' : undefined });
      onSaved(saved);
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visitor ? 'Ziyaretçi Kaydını Düzenle' : 'Ziyaretçi Girişi'}</DialogTitle>
          <DialogDescription>Zorunlu: ad soyad, ziyaret amacı ve ziyaret edilen kişi/birim.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <Label htmlFor="visitor-name">Ad soyad *</Label>
            <Input id="visitor-name" autoFocus value={form.fullName} maxLength={150} onChange={(event) => set({ fullName: event.target.value })} />
            {suggestions.length > 0 ? (
              <div className="mt-1 rounded-xl border bg-card p-1 shadow-sm">
                <p className="px-2 py-1 text-xs text-muted-foreground">Daha önce gelenler</p>
                {suggestions.map((item) => (
                  <button key={`${item.fullName}-${item.phone}`} type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-foreground/[0.04]"
                    onClick={() => { set({ fullName: item.fullName, phone: item.phone, visitorType: item.visitorType, purpose: item.lastPurpose }); setSuggestions([]); }}>
                    <span>{item.fullName}{item.phone ? ` • ${item.phone}` : ''}</span>
                    <span className="text-xs text-muted-foreground">{item.visitCount} ziyaret</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <Label htmlFor="visitor-phone">Telefon</Label>
            <Input id="visitor-phone" value={form.phone} maxLength={30} onChange={(event) => set({ phone: event.target.value })} placeholder="05xx xxx xx xx" />
          </div>
          {!visitor ? (
            <div>
              <Label htmlFor="visitor-identity">Kimlik no (isteğe bağlı)</Label>
              <Input id="visitor-identity" value={form.identity} maxLength={20} onChange={(event) => set({ identity: event.target.value })} placeholder="Yalnız son 4 hanesi saklanır" />
            </div>
          ) : <div />}
          <div className="md:col-span-2">
            <Label>Ziyaretçi türü</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {VISITOR_TYPES.map((type) => (
                <button key={type.key} type="button" aria-pressed={form.visitorType === type.key} onClick={() => set({ visitorType: type.key })}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${form.visitorType === type.key ? 'border-transparent bg-brand-primary text-white' : 'hover:bg-foreground/[0.04]'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="visitor-purpose">Ziyaret amacı *</Label>
            <Input id="visitor-purpose" value={form.purpose} maxLength={300} onChange={(event) => set({ purpose: event.target.value })} placeholder="Örn: Veli görüşmesi, evrak teslimi" />
          </div>
          <div className="md:col-span-2 rounded-xl border p-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={form.hostMode === 'person' ? 'default' : 'outline'} onClick={() => set({ hostMode: 'person' })}>Personel</Button>
              <Button type="button" size="sm" variant={form.hostMode === 'department' ? 'default' : 'outline'} onClick={() => set({ hostMode: 'department' })}>Birim</Button>
            </div>
            {form.hostMode === 'person' ? (
              <select aria-label="Ziyaret edilen personel" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.hostUserId} onChange={(event) => set({ hostUserId: event.target.value })}>
                <option value="">— Ziyaret edilen kişiyi seçin —</option>
                {hostOptions.map((host) => <option key={host.userId} value={host.userId}>{host.fullName} • {host.role}</option>)}
              </select>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DEPARTMENTS.map((item) => (
                    <button key={item} type="button" onClick={() => set({ hostName: item })} className={`rounded-full border px-2.5 py-1 text-xs ${form.hostName === item ? 'border-transparent bg-foreground text-background' : ''}`}>{item}</button>
                  ))}
                </div>
                <Input aria-label="Birim adı" value={form.hostName} maxLength={150} onChange={(event) => set({ hostName: event.target.value })} placeholder="Birim adı" />
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Personel seçilirse gelişinde kendisine bildirim gider.</p>
          </div>
          {form.visitorType === 'Parent' ? (
            <div className="md:col-span-2">
              <Label htmlFor="visitor-student">İlgili öğrenci</Label>
              <Input id="visitor-student" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); set({ studentUserId: '' }); }} placeholder="Öğrenci adı veya sınıf" />
              {students.length > 0 ? (
                <div className="mt-1 rounded-xl border bg-card p-1">
                  {students.map((student) => (
                    <button key={student.userId} type="button" className="flex w-full justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-foreground/[0.04]"
                      onClick={() => { set({ studentUserId: student.userId }); setStudentSearch(`${student.fullName} (${student.className})`); setStudents([]); }}>
                      <span>{student.fullName}</span><span className="text-xs text-muted-foreground">{student.className}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <Label htmlFor="visitor-badge">Ziyaretçi kartı no</Label>
            <Input id="visitor-badge" value={form.badgeNo} maxLength={30} onChange={(event) => set({ badgeNo: event.target.value })} placeholder="Örn: Z-07" />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div>
              <Label htmlFor="visitor-plate">Araç plakası</Label>
              <Input id="visitor-plate" value={form.vehiclePlate} maxLength={20} onChange={(event) => set({ vehiclePlate: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="visitor-companions">Refakatçi</Label>
              <Input id="visitor-companions" type="number" min={0} max={50} value={form.companionCount} onChange={(event) => set({ companionCount: event.target.value })} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="visitor-note">Not</Label>
            <Textarea id="visitor-note" value={form.note} maxLength={1000} onChange={(event) => set({ note: event.target.value })} />
          </div>
          {!visitor ? (
            <label className="flex items-start gap-3 rounded-xl border border-brand-primary/30 bg-brand-primary/[0.04] p-3 md:col-span-2">
              <Checkbox checked={form.privacy} onCheckedChange={(value) => set({ privacy: value === true })} className="mt-0.5" />
              <span className="text-sm">
                <b>KVKK aydınlatması yapıldı.</b>{' '}
                <span className="text-muted-foreground">Ziyaretçiye, bilgilerinin okul güvenliği amacıyla kaydedildiği, yalnız yetkili personelce görüldüğü ve süresi dolunca silineceği bildirildi.</span>
              </span>
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={saving}><LogIn className="mr-2 h-4 w-4" />{visitor ? 'Kaydet' : 'Girişi Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Basılabilir ziyaretçi kartı. */
function BadgeDialog({ visitor, onClose }: { visitor: VisitorDto; onClose: () => void }) {
  const { user } = useApp();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ziyaretçi Kartı</DialogTitle></DialogHeader>
        <div id="visitor-badge-print" className="rounded-2xl border-2 border-dashed p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{user?.tenant || 'SchoolAsist'}</p>
          <p className="mt-2 text-3xl font-black tracking-wider">ZİYARETÇİ</p>
          {visitor.badgeNo ? <p className="mt-1 text-lg font-bold">{visitor.badgeNo}</p> : null}
          <p className="mt-3 text-lg font-semibold">{visitor.fullName}</p>
          <p className="text-sm text-muted-foreground">→ {visitor.hostName}</p>
          <p className="mt-2 text-xs text-muted-foreground">{time(visitor.checkInAtUtc)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Yazdır</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
