import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookMarked, Crown, Pencil, Plus, Search, Sparkles, Trash2, UserMinus, Users, UserX,
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
import { useToast } from '../../hooks/use-toast';
import {
  createSubjectGroup, deleteSubjectGroup, fetchSubjectGroupOverview, fetchSubjectGroupTeachers, updateSubjectGroup,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  SubjectGroupDto, SubjectGroupOverviewDto, SubjectGroupTeacherOptionDto,
} from '../../types/api/generated';

/** Kart vurgu renkleri: hem açık hem koyu temada okunur orta tonlar. */
const COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04'];

function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function yearOptions(): string[] {
  const start = Number(currentAcademicYear().slice(0, 4));
  return [start + 1, start, start - 1, start - 2].map((year) => `${year}-${year + 1}`);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '').join('');
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

interface EditorState {
  id?: string;
  subject: string;
  name: string;
  color: string;
  description: string;
  headTeacherUserId: string;
  memberIds: string[];
}

const EMPTY_EDITOR: EditorState = { subject: '', name: '', color: COLORS[0] ?? '#2563EB', description: '', headTeacherUserId: '', memberIds: [] };

/**
 * Zümreler: ders zümreleri, zümre başkanları ve üyeleri. Kurum yöneticisi ve
 * şube müdürü yönetir (şube müdürü yalnız kendi şubesini görür — sunucu kuralı).
 */
export default function SubjectGroups() {
  const { toast } = useToast();
  const [year, setYear] = useState(currentAcademicYear);
  const [overview, setOverview] = useState<SubjectGroupOverviewDto | null>(null);
  const [teachers, setTeachers] = useState<SubjectGroupTeacherOptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, options] = await Promise.all([
        fetchSubjectGroupOverview(year),
        fetchSubjectGroupTeachers(year),
      ]);
      setOverview(data);
      setTeachers(options ?? []);
    } catch (error) {
      toast({ title: 'Zümreler alınamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, year]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const query = normalize(search);
    const list = overview?.groups ?? [];
    if (!query) return list;
    return list.filter((group) => normalize(`${group.name} ${group.subject} ${group.headTeacherName} ${group.members.map((m) => m.teacherName).join(' ')}`).includes(query));
  }, [overview, search]);

  const openNew = (subject = '') => {
    const usedColors = new Set((overview?.groups ?? []).map((group) => group.color));
    const color = COLORS.find((item) => !usedColors.has(item)) ?? COLORS[0] ?? '#2563EB';
    // Öneriden açılırsa o branştaki öğretmenler hazır seçili gelir.
    const memberIds = subject
      ? teachers.filter((teacher) => normalize(teacher.branch) === normalize(subject)).map((teacher) => teacher.userId)
      : [];
    setEditor({ ...EMPTY_EDITOR, subject, color, memberIds });
  };

  const openEdit = (group: SubjectGroupDto) => setEditor({
    id: group.id,
    subject: group.subject,
    name: group.name,
    color: group.color,
    description: group.description,
    headTeacherUserId: group.headTeacherUserId ?? '',
    memberIds: group.members.map((member) => member.teacherUserId),
  });

  const remove = async (group: SubjectGroupDto) => {
    if (!window.confirm(`${group.name} silinsin mi? Üyelik kayıtları da silinir.`)) return;
    try {
      await deleteSubjectGroup(group.id);
      toast({ title: 'Zümre silindi' });
      await load();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  if (loading && !overview) return <PageLoading />;

  const missing = (overview?.suggestions ?? []).filter((item) => !item.hasGroup);

  return (
    <Page testId="subject-groups-page">
      <PageHeader
        title="Zümreler"
        description="Ders zümrelerini, zümre başkanlarını ve üye öğretmenleri yönetin."
        icon={BookMarked}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <>
            <select
              aria-label="Öğretim yılı"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {yearOptions().map((option) => <option key={option} value={option}>{option} öğretim yılı</option>)}
            </select>
            <Button onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Zümre Oluştur</Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Zümre" value={overview?.groupCount ?? 0} caption={year} icon={BookMarked} tone="brand" />
        <StatCard label="Öğretmen" value={overview?.teacherCount ?? 0} caption="Aktif öğretmen" icon={Users} tone="blue" />
        <StatCard label="Zümresiz öğretmen" value={overview?.teachersWithoutGroup ?? 0} caption="Hiçbir zümrede değil" icon={UserX} tone="amber" />
        <StatCard label="Başkansız zümre" value={overview?.groupsWithoutHead ?? 0} caption="Başkan atanmadı" icon={Crown} tone="rose" />
      </div>

      {missing.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/[0.04] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-primary" />Personel branşlarına göre önerilen zümreler</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.slice(0, 12).map((item) => (
              <button
                key={item.subject}
                type="button"
                onClick={() => openNew(item.subject)}
                className="rounded-full border bg-card px-3 py-1.5 text-sm transition hover:border-brand-primary hover:text-brand-primary"
              >
                {item.subject} <span className="text-muted-foreground">· {item.teacherCount} öğretmen</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Zümre, ders veya öğretmen ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {groups.length === 0 ? (
        <PageNotice
          icon={BookMarked}
          title={(overview?.groups.length ?? 0) === 0 ? 'Bu yıl için zümre yok' : 'Sonuç bulunamadı'}
          message={(overview?.groups.length ?? 0) === 0 ? 'Yukarıdaki önerilerden ya da "Zümre Oluştur" ile başlayın.' : 'Aramayı değiştirin.'}
          action={(overview?.groups.length ?? 0) === 0 ? <Button onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Zümre Oluştur</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((group) => (
            <motion.section
              key={group.id}
              layout
              className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: group.color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.subject}</p>
                  <h3 className="mt-1 truncate text-lg font-bold">{group.name}</h3>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => openEdit(group)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => void remove(group)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl bg-foreground/[0.04] p-3">
                {group.headTeacherUserId ? (
                  <>
                    <div className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: group.color }}>
                      {initials(group.headTeacherName)}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><Crown className="h-3.5 w-3.5" />Zümre Başkanı</p>
                      <p className="truncate font-semibold">{group.headTeacherName}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Zümre başkanı atanmadı.</p>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{group.members.length} üye</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((member) => (
                    <Badge key={member.teacherUserId} variant="outline" className="gap-1 font-normal">
                      {member.isHead ? <Crown className="h-3 w-3 text-amber-500" /> : null}{member.teacherName}
                    </Badge>
                  ))}
                  {group.members.length === 0 ? <span className="text-sm text-muted-foreground">Üye yok.</span> : null}
                </div>
              </div>
              {group.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{group.description}</p> : null}
            </motion.section>
          ))}
        </div>
      )}

      {editor ? (
        <SubjectGroupEditor
          initial={editor}
          year={year}
          teachers={teachers}
          suggestions={(overview?.suggestions ?? []).map((item) => item.subject)}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void load(); }}
        />
      ) : null}
    </Page>
  );
}

interface EditorProps {
  initial: EditorState;
  year: string;
  teachers: SubjectGroupTeacherOptionDto[];
  suggestions: string[];
  onClose: () => void;
  onSaved: () => void;
}

function SubjectGroupEditor({ initial, year, teachers, suggestions, onClose, onSaved }: EditorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<EditorState>(initial);
  const [filter, setFilter] = useState('');
  const [onlyBranch, setOnlyBranch] = useState(Boolean(initial.subject));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EditorState>) => setForm((current) => ({ ...current, ...patch }));

  const visibleTeachers = useMemo(() => {
    const query = normalize(filter);
    const subject = normalize(form.subject);
    return teachers.filter((teacher) => {
      if (onlyBranch && subject && normalize(teacher.branch) !== subject && !form.memberIds.includes(teacher.userId)) return false;
      return !query || normalize(`${teacher.fullName} ${teacher.branch}`).includes(query);
    });
  }, [filter, form.memberIds, form.subject, onlyBranch, teachers]);

  const members = teachers.filter((teacher) => form.memberIds.includes(teacher.userId));

  const toggle = (userId: string) => {
    const selected = form.memberIds.includes(userId);
    set({
      memberIds: selected ? form.memberIds.filter((id) => id !== userId) : [...form.memberIds, userId],
      // Üyelikten çıkan başkan, başkanlıktan da çıkar.
      headTeacherUserId: selected && form.headTeacherUserId === userId ? '' : form.headTeacherUserId,
    });
  };

  const save = async () => {
    if (form.subject.trim().length < 2) {
      toast({ title: 'Ders adını yazın.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      subject: form.subject.trim(),
      name: form.name.trim() || null,
      academicYear: year,
      headTeacherUserId: form.headTeacherUserId || null,
      memberUserIds: form.memberIds,
      description: form.description.trim(),
      color: form.color,
    };
    try {
      if (form.id) await updateSubjectGroup(form.id, payload);
      else await createSubjectGroup(payload);
      toast({ title: form.id ? 'Zümre güncellendi' : 'Zümre oluşturuldu' });
      onSaved();
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Zümreyi Düzenle' : 'Yeni Zümre'}</DialogTitle>
          <DialogDescription>{year} öğretim yılı</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="subject-group-subject">Ders *</Label>
            <Input
              id="subject-group-subject"
              list="subject-group-suggestions"
              value={form.subject}
              onChange={(event) => set({ subject: event.target.value })}
              placeholder="Örn: Matematik"
              maxLength={120}
            />
            <datalist id="subject-group-suggestions">
              {suggestions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>
          <div>
            <Label htmlFor="subject-group-name">Zümre adı</Label>
            <Input
              id="subject-group-name"
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder={form.subject.trim() ? `${form.subject.trim()} Zümresi` : 'Boş bırakılırsa ders adından üretilir'}
              maxLength={160}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Renk</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Renk ${color}`}
                  aria-pressed={form.color === color}
                  onClick={() => set({ color })}
                  className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition ${form.color === color ? 'ring-2 ring-foreground' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="subject-group-description">Açıklama</Label>
            <Textarea
              id="subject-group-description"
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="Toplantı günü, ortak sınav planı, notlar..."
              maxLength={1000}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-9 pl-9" placeholder="Öğretmen ara..." value={filter} onChange={(event) => setFilter(event.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={onlyBranch} onCheckedChange={(value) => setOnlyBranch(value === true)} />
                Yalnız bu branş
              </label>
            </div>
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
              {visibleTeachers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Eşleşen öğretmen yok.</p>
              ) : visibleTeachers.map((teacher) => {
                const selected = form.memberIds.includes(teacher.userId);
                const otherGroups = teacher.currentGroups.filter((item) => normalize(item) !== normalize(form.subject));
                return (
                  <label key={teacher.userId} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-foreground/[0.04] ${selected ? 'bg-brand-primary/[0.06]' : ''}`}>
                    <Checkbox checked={selected} onCheckedChange={() => toggle(teacher.userId)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{teacher.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {teacher.branch || 'Branş girilmemiş'}
                        {otherGroups.length > 0 ? ` • ${otherGroups.join(', ')}` : ''}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <p className="text-sm font-semibold">Seçilen üyeler ({members.length})</p>
            <p className="mt-1 text-xs text-muted-foreground">Başkanı taç simgesiyle seçin.</p>
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {members.length === 0 ? <p className="text-sm text-muted-foreground">Henüz üye seçilmedi.</p> : members.map((member) => {
                const isHead = form.headTeacherUserId === member.userId;
                return (
                  <div key={member.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]">
                    <button
                      type="button"
                      aria-label={isHead ? 'Başkanlıktan çıkar' : 'Zümre başkanı yap'}
                      aria-pressed={isHead}
                      onClick={() => set({ headTeacherUserId: isHead ? '' : member.userId })}
                      className={`grid h-7 w-7 place-items-center rounded-full transition ${isHead ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-amber-500'}`}
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm">{member.fullName}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Üyelikten çıkar" onClick={() => toggle(member.userId)}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
