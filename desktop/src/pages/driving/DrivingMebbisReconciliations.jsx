import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitCompareArrows, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { createDrivingMebbisReconciliation, fetchDrivingMebbisReconciliation, fetchDrivingMebbisReconciliations } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader } from './_shared';

const CLASSES = { Matched: ['Eşleşiyor', 'bg-emerald-500/15 text-emerald-700'], CourseOnly: ['Bizde var, MEBBİS’te yok', 'bg-amber-500/15 text-amber-700'], MebbisOnly: ['MEBBİS’te var, bizde yok', 'bg-violet-500/15 text-violet-700'], Different: ['Bilgiler farklı', 'bg-red-500/15 text-red-700'] };
const CODES = { GeneralInfo: 'Genel bilgi', LicenseClass: 'Ehliyet sınıfı', Term: 'Dönem', CertificateNo: 'Sertifika no', ExamResult: 'Sınav sonucu', StudentStatus: 'Kursiyer durumu', DuplicateIdentity: 'Mükerrer kimlik', MissingIdentity: 'Kimlik eksik', MissingInMebbis: 'MEBBİS’te yok', MissingInCourseIntellect: 'CourseIntellect’te yok' };
const FIELDS = { fullName: 'Ad soyad', phone: 'Telefon', motherName: 'Anne adı', fatherName: 'Baba adı', birthPlace: 'Doğum yeri', education: 'Öğrenim', serialNo: 'Kimlik seri no', licenseClass: 'Ehliyet sınıfı', termYear: 'Dönem yılı', termNumber: 'Dönem no', termCode: 'Dönem kodu', certificateNo: 'Sertifika no', examResult: 'Sınav sonucu', studentStatus: 'Kursiyer durumu' };
const json = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };

export default function DrivingMebbisReconciliations() {
  const { toast } = useToast(); const { can } = useDrivingPermissions();
  const [data, setData] = useState(null); const [detail, setDetail] = useState(null); const [groupId, setGroupId] = useState(''); const [sourceId, setSourceId] = useState(''); const [filter, setFilter] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const value = await fetchDrivingMebbisReconciliations(); setData(value); setGroupId((old) => old || value.groups?.find((x) => x.isActive)?.id || value.groups?.[0]?.id || ''); } catch (e) { toast({ title: 'Mutabakat verileri alınamadı', description: e.message, variant: 'destructive' }); } finally { setLoading(false); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const sources = useMemo(() => (data?.sources || []).filter((x) => x.studentGroupId === groupId), [data, groupId]);
  useEffect(() => { setSourceId((old) => sources.some((x) => x.id === old) ? old : sources[0]?.id || ''); }, [sources]);
  const open = async (id, selectedFilter = filter) => { setSaving(true); try { setDetail(await fetchDrivingMebbisReconciliation(id, { classification: selectedFilter || undefined, pageSize: 500 })); } catch (e) { toast({ title: 'Mutabakat açılamadı', description: e.message, variant: 'destructive' }); } finally { setSaving(false); } };
  const create = async () => { setSaving(true); try { const value = await createDrivingMebbisReconciliation({ studentGroupId: groupId, candidateImportSessionId: sourceId }); await load(); await open(value.id, ''); toast({ title: 'Mutabakat tamamlandı', description: 'İki sistem hiçbir kayıt değiştirilmeden karşılaştırıldı.' }); } catch (e) { toast({ title: 'Mutabakat oluşturulamadı', description: e.message, variant: 'destructive' }); } finally { setSaving(false); } };
  const changeFilter = async (value) => { setFilter(value); if (detail) await open(detail.reconciliation.id, value); };
  if (loading && !data) return <DrivingLoading />;
  const run = detail?.reconciliation; const rows = detail?.rows || [];
  return <DrivingPage testId="driving-mebbis-reconciliations-page">
    <DrivingPageHeader title="MEBBİS Mutabakatı" description="CourseIntellect dönemini MEBBİS listeleriyle alan bazında ve değişiklik yapmadan karşılaştırın." icon={GitCompareArrows} onRefresh={load} />
    <div className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1fr_1.4fr_auto]">
      <label className="space-y-1 text-sm font-medium"><span>Dönem</span><select className="h-10 w-full rounded-md border bg-background px-3" value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Dönem seçin</option>{(data?.groups || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label className="space-y-1 text-sm font-medium"><span>MEBBİS aday listesi</span><select className="h-10 w-full rounded-md border bg-background px-3" value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">Dosya seçin</option>{sources.map((x) => <option key={x.id} value={x.id}>{x.fileName} · {new Date(x.createdAtUtc).toLocaleString('tr-TR')} · {x.totalRows} satır</option>)}</select></label>
      <Button className="self-end" disabled={!can(DRIVING.mebbisManage) || !groupId || !sourceId || saving} onClick={create}><ShieldCheck className="mr-2 h-4 w-4" />Mutabakatı çalıştır</Button>
    </div>
    {!sourceId && groupId && <DrivingNotice icon={AlertTriangle} title="Bu dönem için aday listesi yok" message="Önce MEBBİS’ten Geri Aktarım ekranında aday listesini güvenli önizlemeye yükleyin." />}
    {run && <section className="space-y-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Mutabakat sonucu</h2><p className="text-xs text-muted-foreground">{new Date(run.createdAtUtc).toLocaleString('tr-TR')} · {run.createdByName}</p></div><select className="h-9 rounded-md border bg-background px-3 text-sm" value={filter} onChange={(e) => changeFilter(e.target.value)}><option value="">Tüm kayıtlar</option>{Object.entries(CLASSES).map(([key, value]) => <option key={key} value={key}>{value[0]}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Mini label="Toplam" value={run.totalRows} /><Mini label="Eşleşen" value={run.matchedRows} ok /><Mini label="Yalnız bizde" value={run.courseOnlyRows} /><Mini label="Yalnız MEBBİS’te" value={run.mebbisOnlyRows} /><Mini label="Farklı" value={run.differentRows} danger /></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Mini label="Ehliyet sınıfı" value={run.licenseClassDifferenceRows} /><Mini label="Dönem" value={run.termDifferenceRows} /><Mini label="Sertifika no" value={run.certificateDifferenceRows} /><Mini label="Sınav sonucu" value={run.examResultDifferenceRows} /><Mini label="Kursiyer durumu" value={run.studentStatusDifferenceRows} /></div>
      <p className="text-xs text-muted-foreground">Filtrede {detail.filteredTotal} kayıt gösteriliyor. Kimlik numaraları güvenlik nedeniyle maskelenmiştir.</p>
      <div className="max-h-[600px] overflow-auto rounded-xl border"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="sticky top-0 bg-background"><tr><th className="p-3">Kursiyer</th><th>Sonuç</th><th>Farklar</th><th>CourseIntellect</th><th>MEBBİS</th></tr></thead><tbody>{rows.map((row) => { const state = CLASSES[row.classification] || [row.classification, '']; const codes = json(row.differenceCodesJson, []); return <tr key={row.id} className="border-t align-top"><td className="p-3"><b>{row.displayName || 'Adsız kayıt'}</b><div className="font-mono text-xs text-muted-foreground">{row.maskedIdentity}</div></td><td className="py-3 pr-3"><Badge className={`border-0 ${state[1]}`}>{state[0]}</Badge></td><td className="py-3 pr-3">{codes.length ? codes.map((x) => <Badge key={x} variant="outline" className="mr-1 mb-1">{CODES[x] || x}</Badge>) : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</td><Snapshot value={row.courseSnapshotJson} /><Snapshot value={row.mebbisSnapshotJson} /></tr>; })}</tbody></table></div>
    </section>}
    <div className="space-y-3"><h2 className="font-bold">Mutabakat geçmişi</h2>{(data?.items || []).map((x) => <button key={x.id} type="button" onClick={() => open(x.id)} className="flex w-full items-center justify-between rounded-2xl border p-4 text-left hover:border-primary/40"><div><b>{(data.groups || []).find((g) => g.id === x.studentGroupId)?.name || 'Dönem'}</b><p className="text-xs text-muted-foreground">{new Date(x.createdAtUtc).toLocaleString('tr-TR')} · {x.totalRows} kayıt</p></div><Badge variant="outline">{x.differentRows + x.courseOnlyRows + x.mebbisOnlyRows} sorun</Badge></button>)}</div>
  </DrivingPage>;
}

function Snapshot({ value }) { const item = json(value, {}); const entries = Object.entries(item).filter(([, x]) => x !== '' && x !== null && x !== undefined); return <td className="py-3 pr-4 text-xs">{entries.length ? entries.map(([key, val]) => <div key={key}><span className="text-muted-foreground">{FIELDS[key] || key}:</span> {String(val)}</div>) : '—'}</td>; }
function Mini({ label, value, danger, ok }) { return <div className={`rounded-xl border p-3 ${danger && value ? 'border-red-300 bg-red-500/5' : ok && value ? 'border-emerald-300 bg-emerald-500/5' : ''}`}><p className="text-xs text-muted-foreground">{label}</p><b className="text-xl">{value || 0}</b></div>; }
