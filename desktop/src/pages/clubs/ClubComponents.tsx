import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, CalendarPlus, Check, Clock, Crown, MapPin, Pencil, Search, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import {
  addClubMember, createClub, createClubActivity, deleteClubActivity, fetchClubDetail, fetchClubTeacherOptions,
  searchClubStudents, updateClub, updateClubActivity, updateClubMember,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  ClubActivityDto, ClubDetailDto, ClubMemberDto, ClubPersonOptionDto, ClubSummaryDto,
} from '../../types/api/generated';
import {
  ACTIVITY_STATUS_LABEL, CLUB_CATEGORIES, CLUB_ROLES, MEMBER_STATUS_LABEL, academicYearOptions, categoryMeta,
  currentAcademicYear, formatDateTimeTr, roleLabel, toLocalInput,
} from './clubMeta';

/** Kulüp kartı: kategori simgesi, danışman, doluluk, sıradaki etkinlik. */
export function ClubCard({ club, onOpen, action }: { club: ClubSummaryDto; onOpen: () => void; action?: React.ReactNode }) {
  const meta = categoryMeta(club.category);
  const Icon = meta.icon;
  const fill = club.capacity > 0 ? Math.min(100, Math.round((club.memberCount / club.capacity) * 100)) : null;
  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md ${club.status !== 'Active' ? 'opacity-70' : ''}`}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: club.color }} />
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col p-5 text-left">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: club.color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</p>
            <h3 className="truncate text-lg font-bold">{club.name}</h3>
          </div>
          {club.pendingCount > 0 ? <Badge className="bg-amber-500 text-white">{club.pendingCount} istek</Badge> : null}
          {club.status !== 'Active' ? <Badge variant="outline">Arşiv</Badge> : null}
        </div>
        {club.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{club.description}</p> : null}
        <div className="mt-4 space-y-1.5 text-sm">
          <p className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /><span className="text-muted-foreground">Danışman:</span> <b className="truncate">{club.advisorTeacherName || 'Atanmadı'}</b></p>
          {club.meetingSchedule ? <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />{club.meetingSchedule}{club.location ? ` • ${club.location}` : ''}</p> : null}
          {club.nextActivityAtUtc ? <p className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="h-4 w-4" />Sıradaki: {formatDateTimeTr(club.nextActivityAtUtc)}</p> : null}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{club.memberCount} üye</span>
            <span>{club.capacity > 0 ? `Kontenjan ${club.capacity}` : 'Kontenjan sınırsız'}</span>
          </div>
          {fill !== null ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full" style={{ width: `${fill}%`, backgroundColor: club.color }} />
            </div>
          ) : null}
        </div>
      </button>
      {action ? <div className="border-t px-5 py-3">{action}</div> : null}
    </article>
  );
}

const COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04'];

/** Kulüp açma/düzenleme (yönetici). */
export function ClubEditorDialog({ club, year, onClose, onSaved }: {
  club: ClubSummaryDto | null;
  year: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<ClubPersonOptionDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: club?.name ?? '',
    category: club?.category ?? 'Science',
    description: club?.description ?? '',
    academicYear: club?.academicYear ?? year ?? currentAcademicYear(),
    advisorTeacherUserId: club?.advisorTeacherUserId ?? '',
    capacity: club?.capacity ? String(club.capacity) : '',
    meetingSchedule: club?.meetingSchedule ?? '',
    location: club?.location ?? '',
    color: club?.color ?? categoryMeta('Science').color,
    acceptsRequests: club?.acceptsRequests ?? true,
    status: club?.status ?? 'Active',
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    fetchClubTeacherOptions().then((list) => setTeachers(list ?? [])).catch(() => setTeachers([]));
  }, []);

  const save = async () => {
    if (form.name.trim().length < 2) {
      toast({ title: 'Kulüp adını yazın.', variant: 'destructive' });
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      academicYear: form.academicYear,
      advisorTeacherUserId: form.advisorTeacherUserId || null,
      capacity: Number(form.capacity) || 0,
      meetingSchedule: form.meetingSchedule.trim(),
      location: form.location.trim(),
      color: form.color,
      acceptsRequests: form.acceptsRequests,
      status: form.status,
    };
    setSaving(true);
    try {
      if (club) await updateClub(club.id, payload);
      else await createClub(payload);
      toast({ title: club ? 'Kulüp güncellendi' : 'Kulüp oluşturuldu' });
      onSaved();
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
          <DialogTitle>{club ? 'Kulübü Düzenle' : 'Yeni Kulüp'}</DialogTitle>
          <DialogDescription>Danışman öğretmen üyeleri ve etkinlikleri yönetir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="club-name">Kulüp adı *</Label>
            <Input id="club-name" value={form.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} placeholder="Örn: Robotik Kodlama Kulübü" />
          </div>
          <div className="md:col-span-2">
            <Label>Kategori</Label>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CLUB_CATEGORIES.map((item) => {
                const Icon = item.icon;
                const active = form.category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ category: item.key, color: item.color })}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${active ? 'border-transparent text-white' : 'hover:bg-foreground/[0.04]'}`}
                    style={active ? { backgroundColor: item.color } : undefined}
                  >
                    <Icon className="h-4 w-4" />{item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="club-advisor">Danışman öğretmen</Label>
            <select id="club-advisor" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.advisorTeacherUserId} onChange={(event) => set({ advisorTeacherUserId: event.target.value })}>
              <option value="">— Atanmadı —</option>
              {teachers.map((teacher) => <option key={teacher.userId} value={teacher.userId}>{teacher.fullName}{teacher.detail ? ` (${teacher.detail})` : ''}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="club-year">Öğretim yılı</Label>
            <select id="club-year" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.academicYear} onChange={(event) => set({ academicYear: event.target.value })}>
              {academicYearOptions().map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="club-capacity">Kontenjan</Label>
            <Input id="club-capacity" type="number" min={0} max={1000} value={form.capacity} onChange={(event) => set({ capacity: event.target.value })} placeholder="Boş = sınırsız" />
          </div>
          <div>
            <Label htmlFor="club-schedule">Toplantı günü/saati</Label>
            <Input id="club-schedule" value={form.meetingSchedule} maxLength={120} onChange={(event) => set({ meetingSchedule: event.target.value })} placeholder="Örn: Çarşamba 15:30" />
          </div>
          <div>
            <Label htmlFor="club-location">Yer</Label>
            <Input id="club-location" value={form.location} maxLength={120} onChange={(event) => set({ location: event.target.value })} placeholder="Örn: Fen Laboratuvarı" />
          </div>
          <div>
            <Label>Renk</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button key={color} type="button" aria-label={`Renk ${color}`} aria-pressed={form.color === color} onClick={() => set({ color })}
                  className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background ${form.color === color ? 'ring-2 ring-foreground' : ''}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="club-description">Açıklama</Label>
            <Textarea id="club-description" value={form.description} maxLength={2000} onChange={(event) => set({ description: event.target.value })} placeholder="Kulübün amacı, yıl boyu hedefleri..." />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-3 md:col-span-2">
            <span>
              <span className="block text-sm font-semibold">Öğrenciler katılma isteği gönderebilir</span>
              <span className="block text-xs text-muted-foreground">Kapalıysa üyeleri yalnız danışman ve yönetici ekler.</span>
            </span>
            <Switch checked={form.acceptsRequests} onCheckedChange={(value) => set({ acceptsRequests: value })} />
          </label>
          {club ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3 md:col-span-2">
              <span>
                <span className="block text-sm font-semibold">Arşivle</span>
                <span className="block text-xs text-muted-foreground">Arşivdeki kulüp öğrencilere görünmez; kayıtları korunur.</span>
              </span>
              <Switch checked={form.status === 'Archived'} onCheckedChange={(value) => set({ status: value ? 'Archived' : 'Active' })} />
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kulüp detayı: üyeler, istekler ve etkinlikler. Yönetme düğmeleri yalnız canManage ise. */
export function ClubDetailDialog({ clubId, onClose, onChanged, onEdit }: {
  clubId: string;
  onClose: () => void;
  onChanged?: () => void;
  onEdit?: (club: ClubSummaryDto) => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<ClubDetailDto | null>(null);
  const [activityEditor, setActivityEditor] = useState<ClubActivityDto | 'new' | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await fetchClubDetail(clubId));
    } catch (error) {
      toast({ title: 'Kulüp açılamadı', description: errorMessage(error), variant: 'destructive' });
      onClose();
    }
  }, [clubId, onClose, toast]);

  useEffect(() => { void load(); }, [load]);

  const changed = async () => {
    await load();
    onChanged?.();
  };

  const memberAction = async (member: ClubMemberDto, action: string, role?: string) => {
    if (action === 'remove' && !window.confirm(`${member.studentName} kulüpten çıkarılsın mı?`)) return;
    try {
      await updateClubMember(clubId, member.id, { action, role: role ?? member.role, note: null });
      await changed();
    } catch (error) {
      toast({ title: 'İşlem yapılamadı', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const removeActivity = async (activity: ClubActivityDto) => {
    if (!window.confirm(`"${activity.title}" etkinliği silinsin mi?`)) return;
    try {
      await deleteClubActivity(clubId, activity.id);
      await changed();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const club = detail?.club;
  const manage = Boolean(club?.canManage);
  const active = (detail?.members ?? []).filter((member) => member.status === 'Active');
  const pending = (detail?.members ?? []).filter((member) => member.status === 'Pending');
  const meta = categoryMeta(club?.category);
  const Icon = meta.icon;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {!club ? <p className="py-10 text-center text-muted-foreground">Yükleniyor…</p> : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: club.color }}><Icon className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate">{club.name}</DialogTitle>
                  <DialogDescription>{meta.label} • {club.academicYear} • Danışman: {club.advisorTeacherName || 'Atanmadı'}</DialogDescription>
                </div>
                {onEdit && club.canManage ? <Button variant="outline" size="sm" onClick={() => onEdit(club)}><Pencil className="mr-1 h-4 w-4" />Düzenle</Button> : null}
              </div>
            </DialogHeader>
            {club.description ? <p className="text-sm text-muted-foreground">{club.description}</p> : null}
            <div className="flex flex-wrap gap-2 text-xs">
              {club.meetingSchedule ? <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{club.meetingSchedule}</Badge> : null}
              {club.location ? <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{club.location}</Badge> : null}
              <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{club.memberCount}{club.capacity > 0 ? ` / ${club.capacity}` : ''} üye</Badge>
            </div>

            <Tabs defaultValue={manage && pending.length > 0 ? 'requests' : 'members'}>
              <TabsList>
                <TabsTrigger value="members">Üyeler ({active.length})</TabsTrigger>
                {manage ? <TabsTrigger value="requests">İstekler ({pending.length})</TabsTrigger> : null}
                <TabsTrigger value="activities">Etkinlikler ({detail.activities.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-2">
                {manage ? (
                  adding
                    ? <AddMemberPanel clubId={clubId} onDone={async (added) => { setAdding(false); if (added) await changed(); }} />
                    : <Button size="sm" variant="outline" onClick={() => setAdding(true)}><UserPlus className="mr-1 h-4 w-4" />Öğrenci Ekle</Button>
                ) : null}
                {active.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Henüz üye yok.</p> : active.map((member) => (
                  <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.studentName}</p>
                      <p className="text-xs text-muted-foreground">{member.className}</p>
                    </div>
                    {manage ? (
                      <>
                        <select aria-label="Görev" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={member.role} onChange={(event) => void memberAction(member, 'setRole', event.target.value)}>
                          {CLUB_ROLES.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                        </select>
                        <Button size="icon" variant="ghost" aria-label="Kulüpten çıkar" onClick={() => void memberAction(member, 'remove')}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </>
                    ) : (
                      member.role !== 'Member' ? <Badge className="gap-1"><Crown className="h-3 w-3" />{roleLabel(member.role)}</Badge> : null
                    )}
                  </div>
                ))}
              </TabsContent>

              {manage ? (
                <TabsContent value="requests" className="space-y-2">
                  {pending.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Bekleyen istek yok.</p> : pending.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.studentName} <span className="text-xs text-muted-foreground">• {member.className}</span></p>
                        {member.requestNote ? <p className="text-sm text-muted-foreground">“{member.requestNote}”</p> : null}
                        <p className="text-xs text-muted-foreground">{formatDateTimeTr(member.requestedAtUtc)}</p>
                      </div>
                      <Button size="sm" onClick={() => void memberAction(member, 'approve', 'Member')}><Check className="mr-1 h-4 w-4" />Onayla</Button>
                      <Button size="sm" variant="outline" onClick={() => void memberAction(member, 'reject')}><X className="mr-1 h-4 w-4" />Reddet</Button>
                    </div>
                  ))}
                </TabsContent>
              ) : null}

              <TabsContent value="activities" className="space-y-2">
                {manage ? <Button size="sm" variant="outline" onClick={() => setActivityEditor('new')}><CalendarPlus className="mr-1 h-4 w-4" />Etkinlik Planla</Button> : null}
                {detail.activities.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Henüz etkinlik yok.</p> : detail.activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTimeTr(activity.startsAtUtc)}{activity.location ? ` • ${activity.location}` : ''}</p>
                      </div>
                      <Badge variant={activity.status === 'Completed' ? 'default' : 'outline'}>{ACTIVITY_STATUS_LABEL[activity.status] ?? activity.status}</Badge>
                      {manage ? (
                        <>
                          <Button size="icon" variant="ghost" aria-label="Etkinliği düzenle" onClick={() => setActivityEditor(activity)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label="Etkinliği sil" onClick={() => void removeActivity(activity)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                        </>
                      ) : null}
                    </div>
                    {activity.description ? <p className="mt-2 text-sm text-muted-foreground">{activity.description}</p> : null}
                    {activity.status === 'Completed' && (activity.outcome || activity.attendeeCount !== null) ? (
                      <p className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-sm">
                        {activity.attendeeCount !== null ? <b>{activity.attendeeCount} katılımcı. </b> : null}{activity.outcome}
                      </p>
                    ) : null}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
        {activityEditor ? (
          <ActivityEditorDialog
            clubId={clubId}
            activity={activityEditor === 'new' ? null : activityEditor}
            onClose={() => setActivityEditor(null)}
            onSaved={async () => { setActivityEditor(null); await changed(); }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddMemberPanel({ clubId, onDone }: { clubId: string; onDone: (added: boolean) => void | Promise<void> }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ClubPersonOptionDto[]>([]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      searchClubStudents(clubId, search).then((list) => setOptions(list ?? [])).catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [clubId, search]);

  const add = async (option: ClubPersonOptionDto) => {
    try {
      await addClubMember(clubId, { studentUserId: option.userId, role: 'Member' });
      toast({ title: `${option.fullName} eklendi` });
      await onDone(true);
    } catch (error) {
      toast({ title: 'Eklenemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus className="pl-9" placeholder="Öğrenci adı veya sınıf..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button variant="ghost" onClick={() => void onDone(false)}>Kapat</Button>
      </div>
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {options.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Eşleşen öğrenci yok.</p> : options.map((option) => (
          <button key={option.userId} type="button" onClick={() => void add(option)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/[0.04]">
            <span>{option.fullName}</span><span className="text-xs text-muted-foreground">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityEditorDialog({ clubId, activity, onClose, onSaved }: {
  clubId: string;
  activity: ClubActivityDto | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: activity?.title ?? '',
    description: activity?.description ?? '',
    startsAt: toLocalInput(activity?.startsAtUtc),
    location: activity?.location ?? '',
    status: activity?.status ?? 'Planned',
    attendeeCount: activity?.attendeeCount != null ? String(activity.attendeeCount) : '',
    outcome: activity?.outcome ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    if (form.title.trim().length < 2) {
      toast({ title: 'Etkinlik başlığını yazın.', variant: 'destructive' });
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      startsAtUtc: new Date(form.startsAt).toISOString(),
      location: form.location.trim(),
      status: form.status,
      attendeeCount: form.status === 'Completed' && form.attendeeCount ? Number(form.attendeeCount) : null,
      outcome: form.status === 'Completed' ? form.outcome.trim() : '',
    };
    setSaving(true);
    try {
      if (activity) await updateClubActivity(clubId, activity.id, payload);
      else await createClubActivity(clubId, payload);
      toast({ title: activity ? 'Etkinlik güncellendi' : 'Etkinlik planlandı', description: activity ? undefined : 'Kulüp üyelerine bildirim gönderildi.' });
      await onSaved();
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = useMemo(() => Object.entries(ACTIVITY_STATUS_LABEL), []);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{activity ? 'Etkinliği Düzenle' : 'Etkinlik Planla'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="activity-title">Başlık *</Label><Input id="activity-title" value={form.title} maxLength={160} onChange={(event) => set({ title: event.target.value })} placeholder="Örn: Bilim Fuarı hazırlığı" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="activity-start">Tarih ve saat</Label><Input id="activity-start" type="datetime-local" value={form.startsAt} onChange={(event) => set({ startsAt: event.target.value })} /></div>
            <div><Label htmlFor="activity-location">Yer</Label><Input id="activity-location" value={form.location} maxLength={120} onChange={(event) => set({ location: event.target.value })} /></div>
          </div>
          <div><Label htmlFor="activity-description">Açıklama</Label><Textarea id="activity-description" value={form.description} maxLength={2000} onChange={(event) => set({ description: event.target.value })} /></div>
          <div>
            <Label htmlFor="activity-status">Durum</Label>
            <select id="activity-status" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => set({ status: event.target.value })}>
              {statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          {form.status === 'Completed' ? (
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <div><Label htmlFor="activity-attendees">Katılımcı</Label><Input id="activity-attendees" type="number" min={0} value={form.attendeeCount} onChange={(event) => set({ attendeeCount: event.target.value })} /></div>
              <div><Label htmlFor="activity-outcome">Etkinlik raporu</Label><Textarea id="activity-outcome" value={form.outcome} maxLength={2000} onChange={(event) => set({ outcome: event.target.value })} placeholder="Neler yapıldı, sonuç..." /></div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MEMBER_STATUS_LABEL };
