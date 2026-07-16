import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, GraduationCap, Plus, Search, UserPlus, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingStudentDetail, fetchDrivingStudents } from '../../lib/api/modules';
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
              <p className="text-sm text-muted-foreground">
                {overview.packageName ? `${overview.packageName} • ` : ''}{overview.licenseClass} • {transmissionLabel(overview.transmissionType)}
                {' • '}<Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[overview.status] || overview.status}</Badge>
              </p>
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

export default function DrivingStudents() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setStudents(await fetchDrivingStudents() || []);
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
    if (!term) return students;
    return students.filter((s) => (s.fullName || '').toLocaleLowerCase('tr-TR').includes(term));
  }, [students, search]);

  const activeCount = useMemo(() => students.filter((s) => !['Graduated', 'Cancelled'].includes(s.status)).length, [students]);
  const graduatedCount = useMemo(() => students.filter((s) => s.status === 'Graduated').length, [students]);

  if (loading) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-students-page">
      <DrivingPageHeader
        title="Öğrenciler"
        description="Kursiyerleri görüntüleyin; bir kursiyere tıklayarak sisteme yüklenen belgelerini inceleyin."
        icon={Users}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={(
          <Button className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={() => navigate('/driving/students/new')}>
            <UserPlus className="mr-2 h-4 w-4" />Yeni Kursiyer
          </Button>
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

      {filtered.length === 0 ? (
        <DrivingNotice
          icon={Users}
          title={search ? 'Eşleşen kursiyer yok.' : 'Henüz kursiyer eklenmedi.'}
          message={search ? 'Aramanızı değiştirin.' : 'Yeni kursiyer ekleyerek başlayın.'}
          action={!search ? <Button onClick={() => navigate('/driving/students/new')}><Plus className="mr-2 h-4 w-4" />Yeni Kursiyer</Button> : null}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => (
            <button
              type="button"
              key={student.id}
              onClick={() => setSelectedId(student.id)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition hover:border-[hsl(var(--brand-accent)/0.5)] hover:bg-foreground/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-lg font-black text-brand-primary">
                  {student.fullName?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{student.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {student.licenseClass} • {transmissionLabel(student.transmissionType)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[student.status] || student.status}</Badge>
                <span className="text-xs text-muted-foreground">{student.remainingDrivingMinutes} dk kaldı</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && <StudentDocumentsModal profileId={selectedId} onClose={() => setSelectedId(null)} />}
    </DrivingPage>
  );
}
