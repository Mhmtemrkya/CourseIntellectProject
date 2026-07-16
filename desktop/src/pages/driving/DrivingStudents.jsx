import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, FolderPlus, GraduationCap, Layers, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  assignDrivingStudentGroup, createDrivingStudentGroup, fetchDrivingStudentDetail,
  fetchDrivingStudentGroups, fetchDrivingStudents,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const STATUS_LABELS = {
  PreRegistered: 'Ön kayıt', DocumentsPending: 'Evrak bekliyor', Active: 'Aktif',
  TheoryOngoing: 'Teorik eğitimde', PracticeOngoing: 'Direksiyonda', ExamPending: 'Sınav bekliyor',
  Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal',
};

// Öğrenci evrakı durum rozetleri (detay ekranıyla aynı ton sözlüğü).
const DOCUMENT_STATUS = {
  Missing: { label: 'Eksik', className: 'bg-red-500/15 text-red-600' },
  PendingApproval: { label: 'Onay bekliyor', className: 'bg-amber-500/15 text-amber-600' },
  Approved: { label: 'Onaylı', className: 'bg-emerald-500/15 text-emerald-600' },
  Rejected: { label: 'Reddedildi', className: 'bg-red-500/15 text-red-600' },
  Expired: { label: 'Süresi doldu', className: 'bg-[hsl(var(--brand-accent)/0.15)] text-[hsl(var(--brand-accent))]' },
};

const transmissionLabel = (value) => (value === 'Manual' ? 'Manuel' : 'Otomatik');
const dateTime = (value) => (value ? new Date(value).toLocaleString('tr-TR') : '—');
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '—');

// Gruplar genelde aylık açılır (ör. "Temmuz 2026") — yeni grup adına bu ayı öner.
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const currentMonthGroupName = () => { const d = new Date(); return `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Fotoğraf karesi — görüntü olarak gösterilir (dosya bağlantısı değil).
function PhotoTile({ url, label, fallback }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {url
        ? <img src={url} alt={label} className="h-24 w-24 rounded-xl border object-cover" />
        : <div className="flex h-24 w-24 items-center justify-center rounded-xl border bg-muted text-2xl font-black text-muted-foreground">{fallback || '?'}</div>}
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function Info({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StudentDocumentsModal({ profileId, onClose }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDrivingStudentDetail(profileId)
      .then((detail) => { if (active) setData(detail); })
      .catch((error) => {
        toast({ title: 'Kursiyer dosyası açılamadı', description: error.message, variant: 'destructive' });
        if (active) onClose();
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId, toast, onClose]);

  const overview = data?.overview;
  const documents = data?.documents;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-[hsl(var(--brand-accent))]" />
            {overview?.fullName || 'Kursiyer'} — Belgeler
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingDots /></div>
        ) : !documents ? (
          <DrivingNotice icon={AlertTriangle} title="Belge bilgisi alınamadı." message="Lütfen tekrar deneyin." />
        ) : (
          <div className="space-y-4">
            {overview && (
              <div className="rounded-2xl border bg-foreground/[0.02] p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex gap-3">
                    <PhotoTile url={overview.photoUrl} label="Biyografik" fallback={overview.fullName?.[0]} />
                    <PhotoTile url={overview.livePhotoUrl} label="Anlık" fallback={overview.fullName?.[0]} />
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-base">{overview.fullName}</b>
                      <Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[overview.status] || overview.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {overview.packageName ? `${overview.packageName} • ` : ''}{overview.licenseClass} • {transmissionLabel(overview.transmissionType)}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                      <Info label="Kimlik no" value={overview.identityNumber || overview.tcNo} />
                      <Info label="Doğum" value={overview.birthDate} />
                      <Info label="Telefon" value={overview.phone} />
                      <Info label="İl / İlçe" value={[overview.city, overview.district].filter(Boolean).join(' / ')} />
                      <Info label="İkametgâh" value={overview.residenceAddress} />
                      {overview.hasExistingLicense && (
                        <Info
                          label="Mevcut ehliyet"
                          value={[overview.existingLicenseClasses, overview.existingLicenseNumber].filter(Boolean).join(' • ')}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${documents.complete ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
              {documents.complete
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Kurs dosyası tamam — tüm zorunlu evraklar onaylı.</span></>
                : <><AlertTriangle className="h-4 w-4 text-amber-600" /><span>{documents.missingCount} zorunlu evrak eksik, {documents.pendingCount} evrak onay bekliyor.</span></>}
            </div>

            <div className="space-y-2">
              {(documents.items || []).map((item) => {
                const tone = DOCUMENT_STATUS[item.status] || { label: item.status, className: 'bg-muted text-foreground' };
                return (
                  <div key={item.documentType} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <b>{item.label}</b>
                        {item.required && <Badge className="ml-2 border-0 bg-red-500/15 text-red-600">Zorunlu</Badge>}
                        <p className="text-xs text-muted-foreground">
                          {item.uploadedAtUtc ? `Yüklendi: ${dateTime(item.uploadedAtUtc)}` : 'Henüz yüklenmedi'}
                          {item.expiresAtUtc ? ` • Geçerlilik: ${dateOnly(item.expiresAtUtc)}` : ''}
                        </p>
                        {item.rejectionReason && <p className="mt-1 text-xs text-red-600">Ret nedeni: {item.rejectionReason}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.fileUrl && <a className="text-xs font-bold text-blue-600 hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">Dosya</a>}
                        <Badge className={`border-0 ${tone.className}`}>{tone.label}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => navigate(`/driving/students/${profileId}`)}>
                <ExternalLink className="mr-2 h-4 w-4" />Tam kursiyer dosyası
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Grup oluşturma modalı — ad + kısa açıklama.
function CreateGroupModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [name, setName] = useState(currentMonthGroupName());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { toast({ title: 'Grup adı en az 2 karakter olmalıdır.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const group = await createDrivingStudentGroup({ name: trimmed, description: description.trim() });
      toast({ title: 'Grup oluşturuldu', description: `"${group.name}" hazır.` });
      onCreated(group);
    } catch (error) {
      toast({ title: 'Grup oluşturulamadı', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-[hsl(var(--brand-accent))]" />Yeni Kursiyer Grubu
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Grup adı</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Temmuz 2026 grubu" maxLength={120} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Açıklama (opsiyonel)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa not" maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={submit} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DrivingStudents() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can } = useDrivingPermissions();
  const canManageGroups = can(DRIVING.studentUpdate);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'ungrouped' | <groupId>
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [studentList, groupData] = await Promise.all([
        fetchDrivingStudents(),
        fetchDrivingStudentGroups().catch(() => null),
      ]);
      setStudents(studentList || []);
      setGroups(groupData?.groups || []);
      setUngroupedCount(groupData?.ungroupedCount ?? 0);
    } catch (error) {
      toast({ title: 'Kursiyerler alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return students.filter((s) => {
      if (groupFilter === 'ungrouped' && s.groupId) return false;
      if (groupFilter !== 'all' && groupFilter !== 'ungrouped' && s.groupId !== groupFilter) return false;
      if (term && !(s.fullName || '').toLocaleLowerCase('tr-TR').includes(term)) return false;
      return true;
    });
  }, [students, search, groupFilter]);

  const activeCount = useMemo(() => students.filter((s) => !['Graduated', 'Cancelled'].includes(s.status)).length, [students]);
  const graduatedCount = useMemo(() => students.filter((s) => s.status === 'Graduated').length, [students]);

  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); setAssignTarget(''); }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const doAssign = useCallback(async (groupId) => {
    const profileIds = [...selectedIds];
    if (profileIds.length === 0) return;
    setAssigning(true);
    try {
      const result = await assignDrivingStudentGroup({ profileIds, groupId: groupId || null });
      toast({
        title: groupId ? 'Kursiyerler gruba atandı' : 'Kursiyerler gruptan çıkarıldı',
        description: `${result.assigned} kursiyer güncellendi.`,
      });
      exitSelectMode();
      await load(true);
    } catch (error) {
      toast({ title: 'Atama başarısız', description: error.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  }, [selectedIds, toast, exitSelectMode, load]);

  const activeGroups = useMemo(() => groups.filter((g) => g.isActive), [groups]);

  if (loading) return <DrivingLoading />;

  const filterPill = (key, label, count) => (
    <button
      key={key}
      type="button"
      onClick={() => setGroupFilter(key)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        groupFilter === key
          ? 'border-brand-primary bg-brand-primary text-white'
          : 'border-foreground/15 bg-foreground/[0.03] text-muted-foreground hover:border-[hsl(var(--brand-accent)/0.5)]'
      }`}
    >
      {label}
      {count != null && <span className={`rounded-full px-1.5 ${groupFilter === key ? 'bg-white/20' : 'bg-foreground/10'}`}>{count}</span>}
    </button>
  );

  return (
    <DrivingPage testId="driving-students-page">
      <DrivingPageHeader
        title="Öğrenciler"
        description="Kursiyerleri görüntüleyin, gruplara (dönemlere) ayırın; bir kursiyere tıklayarak belgelerini inceleyin."
        icon={Users}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={(
          <div className="flex flex-wrap gap-2">
            {canManageGroups && (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />Grup Oluştur
                </Button>
                <Button variant={selectMode ? 'secondary' : 'outline'} onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
                  <Layers className="mr-2 h-4 w-4" />{selectMode ? 'Seçimi Bitir' : 'Gruba Ata'}
                </Button>
              </>
            )}
            <Button className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={() => navigate('/driving/students/new')}>
              <UserPlus className="mr-2 h-4 w-4" />Yeni Kursiyer
            </Button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <DrivingStatCard label="Toplam Kursiyer" value={students.length} caption="Kayıtlı" icon={Users} tone="brand" />
        <DrivingStatCard label="Aktif" value={activeCount} caption="Eğitimi süren" icon={GraduationCap} tone="emerald" />
        <DrivingStatCard label="Mezun" value={graduatedCount} caption="Tamamlayan" icon={CheckCircle2} tone="violet" />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Kursiyer ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Grup (dönem) filtresi */}
      <div className="flex flex-wrap items-center gap-2">
        {filterPill('all', 'Tümü', students.length)}
        {activeGroups.map((g) => filterPill(g.id, g.name, g.studentCount))}
        {ungroupedCount > 0 && filterPill('ungrouped', 'Beklemede', ungroupedCount)}
      </div>

      {filtered.length === 0 ? (
        <DrivingNotice
          icon={Users}
          title={search || groupFilter !== 'all' ? 'Eşleşen kursiyer yok.' : 'Henüz kursiyer eklenmedi.'}
          message={search || groupFilter !== 'all' ? 'Filtreyi veya aramayı değiştirin.' : 'Yeni kursiyer ekleyerek başlayın.'}
          action={!search && groupFilter === 'all' ? <Button onClick={() => navigate('/driving/students/new')}><Plus className="mr-2 h-4 w-4" />Yeni Kursiyer</Button> : null}
        />
      ) : (
        <div className="grid gap-3 pb-24 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => {
            const checked = selectedIds.has(student.id);
            return (
              <button
                type="button"
                key={student.id}
                onClick={() => (selectMode ? toggleSelect(student.id) : setSelectedId(student.id))}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                  selectMode && checked
                    ? 'border-brand-primary bg-brand-primary/[0.06]'
                    : 'border-foreground/10 bg-foreground/[0.035] hover:border-[hsl(var(--brand-accent)/0.5)] hover:bg-foreground/[0.06]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selectMode && <Checkbox checked={checked} className="pointer-events-none" />}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-lg font-black text-brand-primary">
                    {student.fullName?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{student.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {student.licenseClass} • {transmissionLabel(student.transmissionType)}
                    </p>
                    {student.groupName && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-accent)/0.12)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-accent))]">
                        <Layers className="h-3 w-3" />{student.groupName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[student.status] || student.status}</Badge>
                  <span className="text-xs text-muted-foreground">{student.remainingDrivingMinutes} dk kaldı</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Toplu atama çubuğu */}
      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
            <span className="text-sm font-bold">{selectedIds.size} kursiyer seçili</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = filtered.map((s) => s.id);
                setSelectedIds((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
              }}
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? 'Temizle' : `Tümünü seç (${filtered.length})`}
            </Button>
            <select
              value={assignTarget}
              onChange={(e) => setAssignTarget(e.target.value)}
              className="h-9 rounded-lg border border-foreground/15 bg-background px-3 text-sm"
            >
              <option value="">Grup seçin…</option>
              {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Button
              className="bg-brand-primary text-white hover:bg-brand-primary/90"
              disabled={!assignTarget || selectedIds.size === 0 || assigning}
              onClick={() => doAssign(assignTarget)}
            >
              {assigning ? 'Atanıyor…' : 'Gruba Ata'}
            </Button>
            <Button variant="outline" disabled={selectedIds.size === 0 || assigning} onClick={() => doAssign(null)}>
              Gruptan Çıkar
            </Button>
            <Button variant="ghost" className="ml-auto" onClick={exitSelectMode}>
              <X className="mr-1 h-4 w-4" />Vazgeç
            </Button>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => { setCreateOpen(false); setGroups((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name, 'tr'))); }}
        />
      )}

      {selectedId && <StudentDocumentsModal profileId={selectedId} onClose={() => setSelectedId(null)} />}
    </DrivingPage>
  );
}
