import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileClock, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { downloadDrivingStudentDocument, fetchDrivingDocumentReviewQueue, reviewDrivingStudentDocument } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const STATUS = {
  PendingApproval: { label: 'Onay bekliyor', tone: 'bg-amber-500/15 text-amber-700' },
  Approved: { label: 'Onaylandı', tone: 'bg-emerald-500/15 text-emerald-700' },
  Rejected: { label: 'Reddedildi', tone: 'bg-red-500/15 text-red-700' },
  ReuploadRequested: { label: 'Yeniden yükleme istendi', tone: 'bg-orange-500/15 text-orange-700' },
  Expired: { label: 'Süresi doldu', tone: 'bg-red-500/15 text-red-700' },
};
const EXPIRING = new Set(['HealthReport', 'CriminalRecord', 'ExistingLicense']);

export default function DrivingDocumentReviewQueue() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const canReview = can(DRIVING.studentDocumentReview);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [drafts, setDrafts] = useState({});
  const [filters, setFilters] = useState({ status: 'ActionRequired', documentType: '', search: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchDrivingDocumentReviewQueue({ ...filters, pageSize: 100 })); }
    catch (error) { toast({ title: 'Evrak kuyruğu alınamadı', description: error.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [filters, toast]);

  useEffect(() => { const timer = setTimeout(load, filters.search ? 300 : 0); return () => clearTimeout(timer); }, [load, filters.search]);

  const draft = (item) => drafts[item.id] || { reason: item.rejectionReason || '', note: item.reviewNote || '', expiresAtUtc: item.expiresAtUtc?.slice(0, 10) || '' };
  const setDraft = (item, patch) => setDrafts((current) => ({ ...current, [item.id]: { ...draft(item), ...patch } }));

  const act = async (item, action) => {
    const values = draft(item);
    if ((action === 'Reject' || action === 'RequestReupload') && values.reason.trim().length < 5) {
      toast({ title: 'Gerekçe en az 5 karakter olmalıdır', variant: 'destructive' }); return;
    }
    if (action === 'Approve' && EXPIRING.has(item.documentType) && !values.expiresAtUtc) {
      toast({ title: 'Bu belge için son geçerlilik tarihi zorunlu', variant: 'destructive' }); return;
    }
    setSaving(item.id);
    try {
      await reviewDrivingStudentDocument(item.id, {
        action, rejectionReason: values.reason, note: values.note,
        expiresAtUtc: values.expiresAtUtc ? new Date(`${values.expiresAtUtc}T12:00:00Z`).toISOString() : null,
        expectedVersion: item.reviewVersion,
      });
      toast({ title: action === 'Approve' ? 'Belge onaylandı' : action === 'Reject' ? 'Belge reddedildi' : action === 'RequestReupload' ? 'Yeniden yükleme istendi' : 'Belge bilgileri güncellendi' });
      await load();
    } catch (error) { toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' }); await load(); }
    finally { setSaving(''); }
  };

  const preview = async (item) => {
    try {
      const blob = await downloadDrivingStudentDocument(item.id); const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { toast({ title: 'Belge açılamadı', description: error.message, variant: 'destructive' }); }
  };

  if (loading && !data) return <DrivingLoading />;
  const summary = data?.summary || {}; const items = data?.items || [];
  return <DrivingPage testId="driving-document-review-queue-page">
    <DrivingPageHeader title="Evrak Onay Kuyruğu" description="MEBBİS’e bağlı kursiyer belgelerini güvenli, sürümlü ve denetlenebilir şekilde inceleyin." icon={FileClock} onRefresh={load} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <DrivingStatCard label="Onay bekleyen" value={summary.pending || 0} caption="İnceleme gerekli" icon={FileClock} tone="amber" />
      <DrivingStatCard label="Yeniden yükleme" value={summary.reuploadRequested || 0} caption="Kursiyer aksiyonu" icon={RotateCcw} tone="brand" />
      <DrivingStatCard label="Reddedilen" value={summary.rejected || 0} caption="Açık retler" icon={XCircle} tone="amber" />
      <DrivingStatCard label="Süresi dolan" value={summary.expired || 0} caption="Yeni belge gerekli" icon={AlertTriangle} tone="amber" />
      <DrivingStatCard label="30 gün içinde" value={summary.expiringSoon || 0} caption="Süresi dolacak" icon={CheckCircle2} tone="emerald" />
    </div>
    <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_230px_230px_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" maxLength={100} placeholder="Kursiyer adı veya numarası…" value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} /></div>
      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="ActionRequired">İşlem gerekenler</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.documentType} onChange={(e) => setFilters((x) => ({ ...x, documentType: e.target.value }))}><option value="">Tüm belge türleri</option>{(data?.documentTypes || []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Yenile</Button>
    </div>
    {items.length === 0 ? <DrivingNotice icon={CheckCircle2} title="Bu filtrede belge yok." message="Evrak kuyruğu güncel." /> : <div className="space-y-3">{items.map((item) => {
      const values = draft(item); const tone = STATUS[item.status] || STATUS.PendingApproval; const busy = saving === item.id;
      return <section key={item.id} className="rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b>{item.studentName}</b><Badge variant="outline">#{item.studentNumber}</Badge><Badge className={`border-0 ${tone.tone}`}>{tone.label}</Badge></div><p className="mt-1 text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">Yüklendi: {new Date(item.uploadedAtUtc).toLocaleString('tr-TR')} • {item.fileName || 'Dosya'}{item.identityKind !== 'TurkishId' ? ' • Yabancı kursiyer' : ''}</p></div><Button variant="outline" onClick={() => preview(item)}><Eye className="mr-2 h-4 w-4" />Belgeyi güvenli aç</Button></div>
        {item.rejectionReason && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-700">Son gerekçe: {item.rejectionReason}</p>}
        <div className="mt-4 grid gap-3 lg:grid-cols-3"><label className="text-xs font-medium">Son geçerlilik tarihi<Input type="date" className="mt-1" value={values.expiresAtUtc} onChange={(e) => setDraft(item, { expiresAtUtc: e.target.value })} /></label><label className="text-xs font-medium lg:col-span-2">Personel iç notu<Input className="mt-1" maxLength={1000} placeholder="Kursiyere gösterilmez" value={values.note} onChange={(e) => setDraft(item, { note: e.target.value })} /></label></div>
        <label className="mt-3 block text-xs font-medium">Ret / yeniden yükleme gerekçesi<Input className="mt-1" maxLength={500} placeholder="Kursiyere bildirim olarak gönderilir" value={values.reason} onChange={(e) => setDraft(item, { reason: e.target.value })} /></label>
        {canReview && <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => act(item, 'Approve')}><CheckCircle2 className="mr-2 h-4 w-4" />Onaylıyorum</Button><Button disabled={busy || values.reason.trim().length < 5} variant="destructive" onClick={() => act(item, 'Reject')}><XCircle className="mr-2 h-4 w-4" />Onaylamıyorum</Button><Button disabled={busy || values.reason.trim().length < 5} variant="outline" onClick={() => act(item, 'RequestReupload')}><RotateCcw className="mr-2 h-4 w-4" />Yeniden yükleme iste</Button><Button disabled={busy} variant="outline" onClick={() => act(item, 'UpdateDetails')}>Tarih/notu kaydet</Button></div>}
      </section>;
    })}</div>}
  </DrivingPage>;
}
