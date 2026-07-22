import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileCheck2, FolderPlus, GraduationCap, Layers, Plus, Search, UserPlus, Users, X, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  assignDrivingStudentGroup, createDrivingStudentGroup, downloadDrivingMebbisRoster, downloadDrivingTermReport,
  fetchDrivingMebbisRoster, fetchDrivingStudentDetail, fetchDrivingStudentGroups, fetchDrivingStudents,
  fetchPendingDownPayments, setDrivingMebbisEntered,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';
import { assetUrl } from '../../lib/assetUrl';

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
        ? <img src={assetUrl(url)} alt={label} className="h-24 w-24 rounded-xl border object-cover" />
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
  const now = new Date();
  const [name, setName] = useState(currentMonthGroupName());
  const [description, setDescription] = useState('');
  // MTSK'da her ay resmî bir dönemdir; yıl/no bulunulan aydan önerilir.
  const [termYear, setTermYear] = useState(String(now.getFullYear()));
  const [termNumber, setTermNumber] = useState(String(now.getMonth() + 1));
  const [mebbisTermCode, setMebbisTermCode] = useState('');
  const [quota, setQuota] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { toast({ title: 'Grup adı en az 2 karakter olmalıdır.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const group = await createDrivingStudentGroup({
        name: trimmed,
        description: description.trim(),
        termYear: termYear ? Number(termYear) : null,
        termNumber: termNumber ? Number(termNumber) : null,
        mebbisTermCode: mebbisTermCode.trim(),
        quota: Number(quota) || 0,
        registrationDeadlineUtc: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
      });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-[hsl(var(--brand-accent))]" />Yeni Kursiyer Grubu (Dönem)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Grup adı</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Temmuz 2026 grubu" maxLength={120} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Resmî dönem yılı</label>
              <Input type="number" min="2000" max="2100" value={termYear} onChange={(e) => setTermYear(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Dönem no</label>
              <Input type="number" min="1" max="99" value={termNumber} onChange={(e) => setTermNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">MEBBİS dönem kodu (opsiyonel)</label>
            <Input value={mebbisTermCode} onChange={(e) => setMebbisTermCode(e.target.value)} placeholder="MEBBİS'in verdiği kod" maxLength={40} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Kontenjan (0 = sınırsız)</label>
              <Input type="number" min="0" max="10000" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Teorik sınıf kapasitesi" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Kayıt kesim tarihi</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
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
  const [searchParams] = useSearchParams();
  const { can } = useDrivingPermissions();
  const canManageGroups = can(DRIVING.studentUpdate);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get('groupId') || 'all'); // 'all' | 'ungrouped' | <groupId>
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roster, setRoster] = useState(null); // seçili grubun MEBBİS durum özeti
  const [downloadingRoster, setDownloadingRoster] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false); // MEBBİS giriş asistanı
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [assignTarget, setAssignTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Peşinatı beklenen kursiyerler: liste profileId taşıdığından ada göre eşleştirilir.
  const [pendingNames, setPendingNames] = useState(() => new Set());

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [studentList, groupData, pending] = await Promise.all([
        fetchDrivingStudents(),
        fetchDrivingStudentGroups().catch(() => null),
        fetchPendingDownPayments().catch(() => []),
      ]);
      setStudents(studentList || []);
      setGroups(groupData?.groups || []);
      setUngroupedCount(groupData?.ungroupedCount ?? 0);
      setPendingNames(new Set((pending || []).map((row) => String(row.studentName || '').trim().toLocaleLowerCase('tr-TR'))));
    } catch (error) {
      toast({ title: 'Kursiyerler alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Belirli bir dönem seçilince MEBBİS hazırlık özeti çekilir (kesim tarihi,
  // kontenjan, eksik alanlı aday sayısı) — "Tümü/Beklemede" için anlamsızdır.
  useEffect(() => {
    if (groupFilter === 'all' || groupFilter === 'ungrouped') { setRoster(null); return undefined; }
    let active = true;
    fetchDrivingMebbisRoster(groupFilter)
      .then((data) => { if (active) setRoster(data); })
      .catch(() => { if (active) setRoster(null); });
    return () => { active = false; };
  }, [groupFilter, students]);

  const downloadRoster = async () => {
    setDownloadingRoster(true);
    try {
      const blob = await downloadDrivingMebbisRoster(groupFilter);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mebbis-${roster?.group?.name || 'donem'}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'MEBBİS listesi indirilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setDownloadingRoster(false);
    }
  };

  const downloadTermReport = async () => {
    try {
      const blob = await downloadDrivingTermReport(groupFilter);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `donem-raporu-${roster?.group?.name || 'donem'}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Dönem raporu indirilemedi', description: error.message, variant: 'destructive' });
    }
  };

  const toggleMebbisEntered = async (row, entered) => {
    try {
      await setDrivingMebbisEntered(row.profileId, entered);
      // Asistan açıkken tam yenileme yerine yerel işaret güncellenir.
      setRoster((state) => state && {
        ...state,
        enteredCount: state.enteredCount + (entered ? 1 : -1),
        rows: state.rows.map((x) => (x.profileId === row.profileId ? { ...x, mebbisEnteredAtUtc: entered ? new Date().toISOString() : null } : x)),
      });
    } catch (error) {
      toast({ title: 'İşaret kaydedilemedi', description: error.message, variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return students.filter((s) => {
      if (groupFilter === 'ungrouped' && s.groupId) return false;
      if (groupFilter !== 'all' && groupFilter !== 'ungrouped' && s.groupId !== groupFilter) return false;
      if (term && !(s.fullName || '').toLocaleLowerCase('tr-TR').includes(term)) return false;
      return true;
    });
  }, [students, search, groupFilter]);

  const activeCount = useMemo(() => students.filter((s) => !['Graduated', 'Suspended', 'Cancelled'].includes(s.status)).length, [students]);
  const graduatedCount = useMemo(() => students.filter((s) => s.status === 'Graduated').length, [students]);
  const inactiveCount = useMemo(() => students.filter((s) => ['Suspended', 'Cancelled'].includes(s.status)).length, [students]);

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
        <DrivingStatCard label="Aktif Kursiyer" value={activeCount} caption="Eğitimi süren" icon={GraduationCap} tone="emerald" />
        <DrivingStatCard label="Mezun" value={graduatedCount} caption="Tamamlayan" icon={CheckCircle2} tone="violet" />
        <DrivingStatCard label="Askıda / İptal" value={inactiveCount} caption="Pasif kayıt" icon={Users} tone="brand" />
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

      {/* Dönem durumu: MEBBİS hizalaması, kontenjan, kesim tarihi ve eksikler */}
      {roster && (
        <div className="space-y-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <b className="text-sm">
                {roster.group.name}
                {roster.group.termYear != null && roster.group.termNumber != null && (
                  <span className="ml-2 rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-black text-brand-primary">
                    Resmî dönem {roster.group.termYear}/{roster.group.termNumber}
                  </span>
                )}
                {roster.group.mebbisTermCode && (
                  <span className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    MEBBİS: {roster.group.mebbisTermCode}
                  </span>
                )}
              </b>
              <p className="mt-1 text-xs text-muted-foreground">
                {roster.group.quota > 0 ? `Kontenjan ${roster.studentCount}/${roster.group.quota}` : `${roster.studentCount} kursiyer`}
                {roster.group.daysToDeadline != null && (
                  roster.group.daysToDeadline >= 0
                    ? ` • Dönem kapanışına ${roster.group.daysToDeadline} gün`
                    : ' • Kayıt kesim tarihi geçti'
                )}
                {` • MEBBİS'e girilen ${roster.enteredCount ?? 0}/${roster.studentCount}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={roster.studentCount === 0} onClick={() => setAssistantOpen(true)}>
                <FileCheck2 className="mr-2 h-4 w-4" />Giriş Asistanı
              </Button>
              <Button variant="outline" size="sm" disabled={downloadingRoster || roster.studentCount === 0} onClick={downloadRoster}>
                <Download className="mr-2 h-4 w-4" />{downloadingRoster ? 'Hazırlanıyor…' : 'MEBBİS Listesi (CSV)'}
              </Button>
              <Button variant="outline" size="sm" disabled={roster.studentCount === 0} onClick={downloadTermReport}>
                <Download className="mr-2 h-4 w-4" />Dönem Raporu (PDF)
              </Button>
            </div>
          </div>

          {roster.studentCount > 0 && (
            roster.readyCount === roster.studentCount ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />Tüm adaylar MEBBİS girişine hazır.
              </p>
            ) : (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {roster.studentCount - roster.readyCount} adayın MEBBİS bilgisi eksik
                  {roster.group.daysToDeadline != null && roster.group.daysToDeadline >= 0 && roster.group.daysToDeadline <= 7
                    ? ' — dönem kapanışı yaklaşıyor!'
                    : '.'}
                </p>
                <div className="mt-2 space-y-1">
                  {roster.rows.filter((r) => r.missing.length > 0).slice(0, 6).map((r) => (
                    <p key={r.studentNumber ?? r.tcNo ?? r.firstName} className="text-xs text-muted-foreground">
                      <b>#{r.studentNumber} {r.firstName} {r.lastName}</b>: {r.missing.join(', ')}
                    </p>
                  ))}
                  {roster.rows.filter((r) => r.missing.length > 0).length > 6 && (
                    <p className="text-xs text-muted-foreground">… tamamı CSV çıktısında listelenir.</p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

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
                  {student.displayPhotoUrl || student.livePhotoUrl || student.photoUrl
                    ? <img src={assetUrl(student.displayPhotoUrl || student.livePhotoUrl || student.photoUrl)} alt={student.fullName} className="h-11 w-11 shrink-0 rounded-2xl border object-cover" />
                    : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary"><Users className="h-5 w-5" /></div>}
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {student.studentNumber != null && <span className="mr-1 text-xs font-black text-muted-foreground">#{student.studentNumber}</span>}
                      {student.fullName}
                    </p>
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
                  {pendingNames.has(String(student.fullName || '').trim().toLocaleLowerCase('tr-TR')) ? (
                    <Badge className="border-0 bg-red-500/15 text-red-600"><XCircle className="mr-1 h-3 w-3" />Peşinat bekliyor</Badge>
                  ) : null}
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

      {/* MEBBİS Giriş Asistanı: çift ekranda alan alan kopyala-yapıştır + girildi işareti */}
      {assistantOpen && roster && (
        <Dialog open onOpenChange={(open) => { if (!open) setAssistantOpen(false); }}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>MEBBİS Giriş Asistanı — {roster.group.name} ({roster.enteredCount ?? 0}/{roster.studentCount} girildi)</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              MEBBİS'i ikinci ekranda açın; alanları kopyalayıp yapıştırın, aday bitince "Girildi" işaretleyin.
            </p>
            <div className="space-y-3">
              {roster.rows.map((row) => {
                const entered = !!row.mebbisEnteredAtUtc;
                const fields = [
                  ['TC', row.tcNo], ['Adı', row.firstName], ['Soyadı', row.lastName],
                  ['Baba adı', row.fatherName], ['Anne adı', row.motherName], ['Doğum yeri', row.birthPlace],
                  ['Doğum tarihi', row.birthDate], ['Öğrenim', row.educationLevel], ['Sınıf', row.licenseClass],
                  ['Seri no', row.identitySerialNo], ['Telefon', row.phone],
                  ['Rapor no', row.healthReportNumber], ['Rapor kurumu', row.healthReportIssuedBy],
                ].filter(([, value]) => value);
                return (
                  <div key={row.profileId} className={`rounded-2xl border p-3 ${entered ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-foreground/10'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-sm">#{row.studentNumber} {row.firstName} {row.lastName}</b>
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <Checkbox checked={entered} onCheckedChange={(value) => toggleMebbisEntered(row, value === true)} />
                        MEBBİS'e girildi
                      </label>
                    </div>
                    {row.missing?.length > 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-600">Eksik: {row.missing.join(', ')}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {fields.map(([label, value]) => (
                        <button
                          key={label}
                          type="button"
                          title={`${label} kopyala`}
                          onClick={() => { navigator.clipboard?.writeText(String(value)); toast({ title: `${label} kopyalandı`, description: String(value) }); }}
                          className="rounded-lg border border-foreground/15 bg-foreground/[0.03] px-2 py-1 text-xs hover:border-[hsl(var(--brand-accent)/0.5)]"
                        >
                          <span className="text-muted-foreground">{label}:</span> <b>{String(value)}</b>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DrivingPage>
  );
}
