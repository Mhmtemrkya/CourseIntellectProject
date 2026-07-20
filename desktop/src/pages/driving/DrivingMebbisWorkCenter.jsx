import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Award, BookOpenCheck, CalendarPlus, CheckCircle2, ClipboardCheck, Clock3, Copy, FileInput, FileSpreadsheet, FileWarning, GitCompareArrows, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { changeDrivingMebbisWorkStatus, fetchDrivingMebbisWorkCenter, syncDrivingMebbisWorkCenter } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const STATUS = {
  Preparing: { label: 'Hazırlanıyor', className: 'bg-amber-500/15 text-amber-700' },
  Ready: { label: 'MEBBİS’e hazır', className: 'bg-sky-500/15 text-sky-700' },
  EntryPending: { label: 'Giriş bekliyor', className: 'bg-violet-500/15 text-violet-700' },
  Entered: { label: 'MEBBİS’e girildi', className: 'bg-blue-500/15 text-blue-700' },
  Verified: { label: 'Doğrulandı', className: 'bg-emerald-500/15 text-emerald-700' },
  Error: { label: 'Hatalı', className: 'bg-red-500/15 text-red-700' },
  CorrectionPending: { label: 'Düzeltme bekliyor', className: 'bg-orange-500/15 text-orange-700' },
};
const TYPES = {
  CandidateRegistration: 'Aday kaydı', DocumentApproval: 'Evrak onayı', TermAssignment: 'Dönem ataması',
  ExamResult: 'Sınav sonucu', CertificateNumber: 'Sertifika numarası', TermDeadline: 'Dönem son tarihi', Reconciliation: 'Mutabakat',
};
const NEXT = {
  Preparing: ['Ready', 'Error'], Ready: ['EntryPending', 'Error'], EntryPending: ['Entered', 'Error'],
  Entered: ['Verified', 'Error'], Verified: ['Error'], Error: ['CorrectionPending'], CorrectionPending: ['Ready', 'Error'],
};
const ACTION = {
  Ready: 'Hazır olarak işaretle', EntryPending: 'Giriş kuyruğuna al', Entered: 'MEBBİS’e girildi', Verified: 'İkinci kontrolü doğrula',
  Error: 'Hata bildir', CorrectionPending: 'Düzeltmeye al',
};

export default function DrivingMebbisWorkCenter() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can } = useDrivingPermissions();
  const canManage = can(DRIVING.mebbisManage);
  const canVerify = can(DRIVING.mebbisVerify);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [filters, setFilters] = useState({ status: '', type: '', search: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (canManage) await syncDrivingMebbisWorkCenter().catch(() => null);
      setData(await fetchDrivingMebbisWorkCenter({ status: filters.status || undefined, type: filters.type || undefined, search: filters.search.trim() || undefined, pageSize: 100 }));
    } catch (error) {
      toast({ title: 'MEBBİS işleri alınamadı', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [canManage, filters, toast]);

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const changeStatus = async (item, target) => {
    let reason = '';
    if (target === 'Error' || target === 'CorrectionPending') {
      reason = window.prompt(target === 'Error' ? 'Hata/uyuşmazlık gerekçesi (en az 10 karakter):' : 'Düzeltme gerekçesi (en az 10 karakter):')?.trim() || '';
      if (reason.length < 10) return;
    }
    const key = `${item.workType}-${item.subjectId}`;
    setSavingKey(key);
    try {
      await changeDrivingMebbisWorkStatus(item.workType, item.subjectId, { status: target, reason, note: '', expectedVersion: item.version });
      toast({ title: 'MEBBİS iş durumu güncellendi' });
      await load();
    } catch (error) {
      toast({ title: 'Durum değiştirilemedi', description: error.message, variant: 'destructive' });
    } finally { setSavingKey(''); }
  };

  const summary = data?.summary || {};
  const items = data?.items || [];
  const activeCount = useMemo(() => (summary.total || 0) - (summary.verified || 0), [summary]);
  if (loading && !data) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-mebbis-work-center-page">
      <DrivingPageHeader title="MEBBİS İş Merkezi" description="Aday, evrak, dönem, sınav ve sertifika işlerini tek, denetlenebilir akışta yönetin." icon={ClipboardCheck} onRefresh={load} />
      <div className="flex flex-wrap justify-end gap-2"><Button onClick={() => navigate('/driving/mebbis/term-opening')}><CalendarPlus className="mr-2 h-4 w-4" />Dönem Açma Sihirbazı</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/errors')}><BookOpenCheck className="mr-2 h-4 w-4" />Hata Kütüphanesi</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/certificate-numbers')}><Award className="mr-2 h-4 w-4" />Sertifika No Aktarımı</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/exam-results')}><FileSpreadsheet className="mr-2 h-4 w-4" />Sınav Mutabakatı</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/reconciliations')}><GitCompareArrows className="mr-2 h-4 w-4" />Mutabakat</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/imports')}><FileInput className="mr-2 h-4 w-4" />Geri Aktarım</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/transfer-packages')}><Archive className="mr-2 h-4 w-4" />Aktarım Paketleri</Button><Button variant="outline" onClick={() => navigate('/driving/mebbis/documents')}><FileWarning className="mr-2 h-4 w-4" />Evrak Onay Kuyruğu</Button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DrivingStatCard label="Açık iş" value={activeCount} caption="Doğrulama bekleyen" icon={Clock3} tone="brand" />
        <DrivingStatCard label="Eksik bilgi" value={summary.missingInformation || 0} caption="Aday kayıtları" icon={FileWarning} tone="amber" />
        <DrivingStatCard label="Evrak onayı" value={summary.documentApproval || 0} caption="Kontrol bekliyor" icon={Users} tone="violet" />
        <DrivingStatCard label="Hatalı" value={(summary.error || 0) + (summary.correctionPending || 0)} caption="Müdahale gerekli" icon={AlertTriangle} tone="amber" />
        <DrivingStatCard label="Doğrulandı" value={summary.verified || 0} caption="İkinci kontrol tamam" icon={ShieldCheck} tone="emerald" />
      </div>

      {(data?.deadlines || []).length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-4">
          <b className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" />Yaklaşan dönem son tarihleri</b>
          <div className="mt-2 flex flex-wrap gap-2">{data.deadlines.map((x) => <Badge key={x.subjectId} variant="outline" className={x.overdue ? 'border-red-400 text-red-600' : ''}>{x.title} • {x.overdue ? `${Math.abs(x.daysRemaining)} gün geçti` : `${x.daysRemaining} gün`}</Badge>)}</div>
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_220px_220px_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" maxLength={100} placeholder="Kursiyer veya referans ara…" value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} /></div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="">Tüm durumlar</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.type} onChange={(e) => setFilters((x) => ({ ...x, type: e.target.value }))}><option value="">Tüm iş türleri</option>{Object.entries(TYPES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        <Button variant="outline" disabled={loading} onClick={load}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Yenile</Button>
      </div>

      {items.length === 0 ? <DrivingNotice icon={CheckCircle2} title="Bu filtrede açık iş yok." message="MEBBİS iş kuyruğu güncel." /> : (
        <div className="space-y-3">{items.map((item) => {
          const tone = STATUS[item.status] || { label: item.status, className: '' };
          const key = `${item.workType}-${item.subjectId}`;
          const actions = item.workType === 'TermDeadline' ? [] : (NEXT[item.status] || []).filter((target) => canManage && (target !== 'Verified' || canVerify));
          return <div key={key} className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b>{item.title}</b><Badge className={`border-0 ${tone.className}`}>{tone.label}</Badge><Badge variant="outline">{TYPES[item.workType] || item.category}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.reference}{item.dueAtUtc ? ` • Son tarih: ${new Date(item.dueAtUtc).toLocaleDateString('tr-TR')}` : ''}</p></div>
              <div className="flex flex-wrap gap-2">
                {canManage && item.workType === 'CandidateRegistration' && item.studentDrivingProfileId && item.status !== 'Verified' && <Button size="sm" onClick={() => navigate(`/driving/mebbis/assistant/${item.studentDrivingProfileId}`)}><Copy className="mr-2 h-4 w-4" />Giriş Asistanı</Button>}
                {actions.map((target) => <Button key={target} size="sm" variant={target === 'Error' ? 'destructive' : target === 'Verified' ? 'default' : 'outline'} disabled={savingKey === key} onClick={() => changeStatus(item, target)}>{ACTION[target]}</Button>)}
              </div>
            </div>
            {item.missing?.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{item.missing.map((x) => <Badge key={x} variant="outline" className="border-amber-400/60 text-amber-700">{x}</Badge>)}</div>}
            {item.errorReason && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700"><b>Hata:</b> {item.errorReason}</p>}
          </div>;
        })}</div>
      )}
    </DrivingPage>
  );
}
