import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, Flag, Inbox, Plus, Search, Sparkles, Users } from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  deleteClub, fetchClubOverview, fetchMyClubs, fetchUpcomingClubActivities, leaveClub, requestClubJoin,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { ClubActivityDto, ClubOverviewDto, ClubSummaryDto } from '../../types/api/generated';
import { ClubCard, ClubDetailDialog, ClubEditorDialog } from './ClubComponents';
import {
  CLUB_CATEGORIES, MEMBER_STATUS_LABEL, academicYearOptions, categoryMeta, currentAcademicYear, formatDateTimeTr, roleLabel,
} from './clubMeta';

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

function useClubOverview(year: string) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<ClubOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await fetchClubOverview(year));
    } catch (error) {
      toast({ title: 'Kulüpler alınamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, year]);
  useEffect(() => { void load(); }, [load]);
  return { overview, loading, load };
}

function CategoryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange('')} className={`rounded-full border px-3 py-1.5 text-sm ${value === '' ? 'border-transparent bg-foreground text-background' : 'hover:bg-foreground/[0.04]'}`}>Tümü</button>
      {CLUB_CATEGORIES.map((item) => {
        const Icon = item.icon;
        const active = value === item.key;
        return (
          <button key={item.key} type="button" onClick={() => onChange(active ? '' : item.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${active ? 'border-transparent text-white' : 'hover:bg-foreground/[0.04]'}`}
            style={active ? { backgroundColor: item.color } : undefined}>
            <Icon className="h-3.5 w-3.5" />{item.label}
          </button>
        );
      })}
    </div>
  );
}

function filterClubs(clubs: ClubSummaryDto[], search: string, category: string) {
  const query = normalize(search);
  return clubs.filter((club) => (!category || club.category === category)
    && (!query || normalize(`${club.name} ${club.advisorTeacherName} ${club.description}`).includes(query)));
}

/** Kurum yöneticisi / şube müdürü / idari personel: tüm kulüpler. */
export function ClubsAdminPage() {
  const { toast } = useToast();
  const { user } = useApp();
  const canEdit = ['admin', 'branchmanager'].includes(String(user?.backendRole || user?.role || '').toLowerCase());
  const [year, setYear] = useState(currentAcademicYear);
  const { overview, loading, load } = useClubOverview(year);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editor, setEditor] = useState<ClubSummaryDto | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const clubs = useMemo(() => filterClubs(overview?.clubs ?? [], search, category), [category, overview, search]);

  const remove = async (club: ClubSummaryDto) => {
    if (!window.confirm(`${club.name} silinsin mi? Üyelik ve etkinlik kayıtları da silinir. Kayıtları korumak için arşivlemeyi tercih edin.`)) return;
    try {
      await deleteClub(club.id);
      toast({ title: 'Kulüp silindi' });
      await load();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  if (loading && !overview) return <PageLoading />;

  return (
    <Page testId="clubs-admin-page">
      <PageHeader
        title="Kulüpler"
        description="Öğrenci kulüplerini açın, danışman atayın; üyelik ve etkinlikleri izleyin."
        icon={Flag}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <>
            <select aria-label="Öğretim yılı" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={(event) => setYear(event.target.value)}>
              {academicYearOptions().map((option) => <option key={option} value={option}>{option} öğretim yılı</option>)}
            </select>
            {canEdit ? <Button onClick={() => setEditor('new')}><Plus className="mr-2 h-4 w-4" />Kulüp Oluştur</Button> : null}
          </>
        )}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Kulüp" value={overview?.clubCount ?? 0} caption={year} icon={Flag} tone="brand" />
        <StatCard label="Kulüplü öğrenci" value={overview?.studentsInClubs ?? 0} caption={`${overview?.activeMemberCount ?? 0} üyelik`} icon={Users} tone="emerald" />
        <StatCard label="Bekleyen istek" value={overview?.pendingRequestCount ?? 0} caption="Danışman onayı" icon={Inbox} tone="amber" />
        <StatCard label="Yaklaşan etkinlik" value={overview?.upcomingActivityCount ?? 0} caption="Planlanmış" icon={CalendarClock} tone="violet" />
      </div>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Kulüp veya danışman ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <CategoryFilter value={category} onChange={setCategory} />
      </div>
      {clubs.length === 0 ? (
        <PageNotice icon={Flag}
          title={(overview?.clubs.length ?? 0) === 0 ? 'Bu yıl için kulüp yok' : 'Sonuç bulunamadı'}
          message={(overview?.clubs.length ?? 0) === 0 ? 'İlk kulübü oluşturup danışman öğretmen atayın.' : 'Filtreleri değiştirin.'}
          action={canEdit && (overview?.clubs.length ?? 0) === 0 ? <Button onClick={() => setEditor('new')}><Plus className="mr-2 h-4 w-4" />Kulüp Oluştur</Button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {clubs.map((club) => (
            <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)}
              action={canEdit ? (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditor(club)}>Düzenle</Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => void remove(club)}>Sil</Button>
                </div>
              ) : undefined} />
          ))}
        </div>
      )}
      {editor ? <ClubEditorDialog club={editor === 'new' ? null : editor} year={year} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void load(); }} /> : null}
      {openId ? <ClubDetailDialog clubId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} onEdit={canEdit ? (club) => { setOpenId(null); setEditor(club); } : undefined} /> : null}
    </Page>
  );
}

/** Öğretmen: danışmanı olduğu kulüpler (yönetir) + kurumdaki diğer kulüpler. */
export function ClubsTeacherPage() {
  const { toast } = useToast();
  const [mine, setMine] = useState<ClubSummaryDto[] | null>(null);
  const [all, setAll] = useState<ClubSummaryDto[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [advised, overview] = await Promise.all([fetchMyClubs(), fetchClubOverview(currentAcademicYear())]);
      setMine(advised ?? []);
      setAll(overview?.clubs ?? []);
    } catch (error) {
      setMine([]);
      toast({ title: 'Kulüpler alınamadı', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (!mine) return <PageLoading />;
  const others = all.filter((club) => !mine.some((item) => item.id === club.id));
  const pending = mine.reduce((sum, club) => sum + club.pendingCount, 0);

  return (
    <Page testId="clubs-teacher-page">
      <PageHeader title="Kulüpler" description="Danışmanı olduğunuz kulüplerin üyelerini ve etkinliklerini yönetin." icon={Flag} onRefresh={load} />
      {pending > 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <Inbox className="h-4 w-4 text-amber-600" /><b>{pending}</b> katılma isteği onayınızı bekliyor.
        </div>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Danışmanı olduğum kulüpler</h2>
        {mine.length === 0 ? (
          <PageNotice icon={Flag} title="Danışmanı olduğunuz kulüp yok" message="Kulüpler ve danışmanlar kurum yöneticisi tarafından atanır." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {mine.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)} />)}
          </div>
        )}
      </section>
      {others.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Kurumdaki diğer kulüpler</h2>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {others.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)} />)}
          </div>
        </section>
      ) : null}
      {openId ? <ClubDetailDialog clubId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} /> : null}
    </Page>
  );
}

function UpcomingActivities({ activities }: { activities: ClubActivityDto[] }) {
  if (activities.length === 0) return null;
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4" />Yaklaşan etkinlikler</h2>
      <div className="mt-3 divide-y">
        {activities.slice(0, 6).map((activity) => (
          <div key={activity.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">{activity.title}</p>
              <p className="text-xs text-muted-foreground">{activity.clubName}{activity.location ? ` • ${activity.location}` : ''}</p>
            </div>
            <Badge variant="outline">{formatDateTimeTr(activity.startsAtUtc)}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Öğrenci: kulüplerim + keşfet (katılma isteği). */
export function ClubsStudentPage() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<ClubOverviewDto | null>(null);
  const [activities, setActivities] = useState<ClubActivityDto[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [joinTarget, setJoinTarget] = useState<ClubSummaryDto | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, upcoming] = await Promise.all([fetchClubOverview(currentAcademicYear()), fetchUpcomingClubActivities()]);
      setOverview(data);
      setActivities(upcoming ?? []);
    } catch (error) {
      toast({ title: 'Kulüpler alınamadı', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const leave = async (club: ClubSummaryDto) => {
    const pending = club.myStatus === 'Pending';
    if (!window.confirm(pending ? 'Katılma isteğiniz geri çekilsin mi?' : `${club.name} kulübünden ayrılmak istiyor musunuz?`)) return;
    try {
      await leaveClub(club.id);
      toast({ title: pending ? 'İstek geri çekildi' : 'Kulüpten ayrıldınız' });
      await load();
    } catch (error) {
      toast({ title: 'İşlem yapılamadı', description: errorMessage(error), variant: 'destructive' });
    }
  };

  if (!overview) return <PageLoading />;
  const mine = overview.clubs.filter((club) => club.myStatus === 'Active' || club.myStatus === 'Pending');
  const explore = filterClubs(overview.clubs.filter((club) => !mine.includes(club)), search, category);

  const footer = (club: ClubSummaryDto) => {
    if (club.myStatus === 'Active') {
      return (
        <div className="flex items-center justify-between gap-2">
          <Badge className="bg-emerald-600 text-white">{roleLabel(club.myRole)}</Badge>
          <Button size="sm" variant="ghost" onClick={() => void leave(club)}>Ayrıl</Button>
        </div>
      );
    }
    if (club.myStatus === 'Pending') {
      return (
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="gap-1"><Clock3 className="h-3 w-3" />{MEMBER_STATUS_LABEL.Pending}</Badge>
          <Button size="sm" variant="ghost" onClick={() => void leave(club)}>İsteği geri çek</Button>
        </div>
      );
    }
    const full = club.capacity > 0 && club.memberCount >= club.capacity;
    if (!club.acceptsRequests) return <p className="text-xs text-muted-foreground">Üyeleri danışman öğretmen belirler.</p>;
    return (
      <div className="flex items-center justify-between gap-2">
        {club.myStatus === 'Rejected' ? <span className="text-xs text-muted-foreground">Önceki istek kabul edilmedi</span> : <span />}
        <Button size="sm" disabled={full} onClick={() => setJoinTarget(club)}>{full ? 'Kontenjan dolu' : 'Katılma İsteği Gönder'}</Button>
      </div>
    );
  };

  return (
    <Page testId="clubs-student-page">
      <PageHeader title="Kulüpler" description="İlgi alanına uygun kulübü keşfet, katılma isteği gönder." icon={Flag} onRefresh={load} />
      <UpcomingActivities activities={activities} />
      <Tabs defaultValue={mine.length > 0 ? 'mine' : 'explore'}>
        <TabsList>
          <TabsTrigger value="mine">Kulüplerim ({mine.length})</TabsTrigger>
          <TabsTrigger value="explore">Keşfet</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          {mine.length === 0 ? (
            <PageNotice icon={Sparkles} title="Henüz bir kulübe katılmadın" message="Keşfet sekmesinden ilgini çeken kulübe istek gönderebilirsin." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {mine.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)} action={footer(club)} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="explore" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Kulüp ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <CategoryFilter value={category} onChange={setCategory} />
          {explore.length === 0 ? <PageNotice icon={Flag} title="Kulüp bulunamadı" message="Filtreleri değiştirin." /> : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {explore.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)} action={footer(club)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {joinTarget ? <JoinDialog club={joinTarget} onClose={() => setJoinTarget(null)} onSent={() => { setJoinTarget(null); void load(); }} /> : null}
      {openId ? <ClubDetailDialog clubId={openId} onClose={() => setOpenId(null)} /> : null}
    </Page>
  );
}

function JoinDialog({ club, onClose, onSent }: { club: ClubSummaryDto; onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const meta = categoryMeta(club.category);
  const send = async () => {
    setSending(true);
    try {
      await requestClubJoin(club.id, note.trim());
      toast({ title: 'İsteğin gönderildi', description: 'Danışman öğretmen onayladığında bildirim alacaksın.' });
      onSent();
    } catch (error) {
      toast({ title: 'İstek gönderilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{club.name}</DialogTitle>
          <DialogDescription>{meta.label} • Danışman: {club.advisorTeacherName || 'Atanmadı'}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="club-join-note">Neden katılmak istiyorsun? (isteğe bağlı)</Label>
          <Textarea id="club-join-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="İlgi alanların, deneyimin..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Vazgeç</Button>
          <Button onClick={() => void send()} disabled={sending}>İstek Gönder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Veli: çocuğunun kulüpleri ve yaklaşan etkinlikleri. */
export function ClubsParentPage() {
  const { toast } = useToast();
  const [clubs, setClubs] = useState<ClubSummaryDto[] | null>(null);
  const [activities, setActivities] = useState<ClubActivityDto[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, upcoming] = await Promise.all([fetchMyClubs(), fetchUpcomingClubActivities()]);
      setClubs(mine ?? []);
      setActivities(upcoming ?? []);
    } catch (error) {
      setClubs([]);
      toast({ title: 'Kulüpler alınamadı', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (!clubs) return <PageLoading />;
  return (
    <Page testId="clubs-parent-page">
      <PageHeader title="Kulüpler" description="Çocuğunuzun üyesi olduğu kulüpler ve yaklaşan etkinlikler." icon={Flag} onRefresh={load} />
      <UpcomingActivities activities={activities} />
      {clubs.length === 0 ? (
        <PageNotice icon={Flag} title="Kulüp üyeliği yok" message="Çocuğunuz bir kulübe katıldığında burada görünür." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {clubs.map((club) => (
            <ClubCard key={club.id} club={club} onOpen={() => setOpenId(club.id)}
              action={<Badge variant="outline">{club.myStatus === 'Pending' ? MEMBER_STATUS_LABEL.Pending : roleLabel(club.myRole)}</Badge>} />
          ))}
        </div>
      )}
      {openId ? <ClubDetailDialog clubId={openId} onClose={() => setOpenId(null)} /> : null}
    </Page>
  );
}
