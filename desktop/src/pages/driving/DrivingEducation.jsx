import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, CalendarPlus, CheckCircle2, ClipboardCheck, Download, GraduationCap, RefreshCw, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { DrivingLoading, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';
import {
  addDrivingExamCandidates, assignDrivingExamCandidate, createDrivingExamSession, createDrivingTheoryClass,
  createDrivingTheorySession, downloadDrivingClassSchedule, downloadDrivingExamRoster, enrollDrivingTheoryStudents,
  enterDrivingExamResult, fetchDrivingClassCompliance, fetchDrivingEducationOverview, fetchDrivingInstructors,
  fetchDrivingTheoryAttendance, fetchDrivingVehicles, generateDrivingSchedule, importDrivingExamResults,
  saveDrivingTheoryAttendance, scheduleDrivingExamRetry,
} from '../../lib/api/modules';

/**
 * e-Sınav/MEBBİS sonuç listesinden satır ayrıştırır: satırda 11 haneli sayı TC,
 * 0-100 arası küçük sayı puan, "geçti/kaldı" kelimesi açık sonuç kabul edilir.
 * Ayraç fark etmez (noktalı virgül, virgül, sekme, boşluk).
 */
function parseResultLines(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const identity = trimmed.match(/\b\d{11}\b/)?.[0];
    if (!identity) continue;
    const withoutIdentity = trimmed.replace(identity, ' ');
    const scoreMatch = withoutIdentity.match(/\b(100|\d{1,2})(?:[.,]\d+)?\b/);
    const resultMatch = withoutIdentity.match(/geçti|gecti|kaldı|kaldi|başarılı|basarili|başarısız|basarisiz|passed|failed/i);
    rows.push({
      identityNumber: identity,
      result: resultMatch ? resultMatch[0] : null,
      score: scoreMatch ? Number(scoreMatch[1]) : null,
    });
  }
  return rows;
}
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';

const localInput = (value = new Date()) => {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
};
const initialClass = () => ({ name: '', licenseClass: 'B', instructorStaffId: '', capacity: 24, startsAtUtc: localInput(), endsAtUtc: localInput(new Date(Date.now() + 90 * 86400000)), room: '' });
const initialTheory = () => ({ theoryClassId: '', instructorStaffId: '', subject: '', topic: '', startsAtUtc: localInput(), endsAtUtc: localInput(new Date(Date.now() + 60 * 60000)), room: '' });
const initialExam = () => ({ examType: 'TheoryEExam', title: '', startsAtUtc: localInput(), endsAtUtc: localInput(new Date(Date.now() + 60 * 60000)), location: '', capacity: 20, commissionName: '', commissionRole: 'Komisyon Başkanı', commissionOrganization: '' });
const dateTime = (value) => new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const examLabel = (type) => type === 'DrivingPractice' ? 'Direksiyon sınavı' : 'E-sınav';
const statusTone = (status) => status === 'Passed' || status === 'Completed' ? 'bg-emerald-600' : status === 'Failed' || status === 'Cancelled' ? 'bg-red-600' : 'bg-blue-600';
const iso = (value) => new Date(value).toISOString();

function Checks({ items, selected, onChange }) {
  return <div className="max-h-52 space-y-2 overflow-auto rounded-xl border p-3">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} /><span><b>{item.fullName}</b>{item.licenseClass && <span className="ml-2 text-muted-foreground">{item.licenseClass}</span>}</span></label>)}</div>;
}

export default function DrivingEducation() {
  const { toast } = useToast();
  const { can, loading: permissionLoading } = useDrivingPermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [classForm, setClassForm] = useState(initialClass);
  const [theoryForm, setTheoryForm] = useState(initialTheory);
  const [examForm, setExamForm] = useState(initialExam);
  const [classStudents, setClassStudents] = useState({});
  const [examStudents, setExamStudents] = useState({});
  const [examFees, setExamFees] = useState({});
  const [attendance, setAttendance] = useState(null);
  const [compliance, setCompliance] = useState(null); // seçili sınıfın mevzuat uyum raporu
  // Sınav günü eşleşmesi için direksiyon öğretmenleri + araçlar (bir kez yüklenir).
  const [examResources, setExamResources] = useState({ instructors: [], vehicles: [] });
  // Toplu sonuç içe aktarma: { exam, text, rows, summary }
  const [importState, setImportState] = useState(null);
  // Program üreteci: { classId, startDate, days:Set, startHour, lessonsPerDay }
  const [scheduleForm, setScheduleForm] = useState(null);
  // { candidate, passed, score, failureReason } — açıkken not girişi paneli görünür.
  const [resultForm, setResultForm] = useState(null);

  const canTheoryManage = can(DRIVING.theoryManage);
  const canAttendance = can(DRIVING.theoryAttendance);
  const canExamManage = can(DRIVING.examManage);
  const canResult = can(DRIVING.examResultEnter);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchDrivingEducationOverview()); }
    catch (error) { toast({ title: 'Eğitim ve sınav verileri alınamadı', description: error.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { if (!permissionLoading) load(); }, [load, permissionLoading]);
  useEffect(() => {
    if (permissionLoading) return;
    Promise.all([fetchDrivingInstructors().catch(() => []), fetchDrivingVehicles().catch(() => [])])
      .then(([instructorList, vehicleList]) => setExamResources({ instructors: instructorList || [], vehicles: vehicleList || [] }));
  }, [permissionLoading]);

  async function assignCandidate(candidate, patch) {
    try {
      await assignDrivingExamCandidate(candidate.id, {
        vehicleId: patch.vehicleId !== undefined ? (patch.vehicleId || null) : candidate.assignedVehicleId,
        instructorProfileId: patch.instructorProfileId !== undefined ? (patch.instructorProfileId || null) : candidate.assignedInstructorProfileId,
      });
      await load();
    } catch (error) {
      toast({ title: 'Atama kaydedilemedi', description: error.message, variant: 'destructive' });
    }
  }

  async function submitSchedule() {
    const days = [...scheduleForm.days];
    if (!days.length) { toast({ title: 'En az bir gün seçin', variant: 'destructive' }); return; }
    const [hour, minute] = scheduleForm.startTime.split(':').map(Number);
    const ok = await run(() => generateDrivingSchedule(scheduleForm.classId, {
      startDate: new Date(`${scheduleForm.startDate}T00:00:00`).toISOString(),
      daysOfWeek: days,
      startHourLocal: hour,
      startMinuteLocal: minute || 0,
      lessonsPerDay: Number(scheduleForm.lessonsPerDay),
    }), 'Ders programı müfredattan üretildi');
    if (ok) setScheduleForm(null);
  }

  async function downloadSchedule(group) {
    try {
      const blob = await downloadDrivingClassSchedule(group.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ders-programi-${group.name}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Program indirilemedi', description: error.message, variant: 'destructive' });
    }
  }

  async function submitImport() {
    const rows = parseResultLines(importState.text);
    if (!rows.length) { toast({ title: 'Ayrıştırılabilir satır yok', description: 'Her satırda 11 haneli TC bulunmalı.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const summary = await importDrivingExamResults(importState.exam.id, rows);
      setImportState((state) => ({ ...state, summary }));
      toast({ title: 'Sonuçlar işlendi', description: `${summary.processedCount} sonuç (${summary.passedCount} geçti, ${summary.failedCount} kaldı), ${summary.errors.length} satır atlandı.` });
      await load();
    } catch (error) {
      toast({ title: 'İçe aktarma başarısız', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function downloadRoster(exam) {
    try {
      const blob = await downloadDrivingExamRoster(exam.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sinav-listesi-${exam.title}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Sınav listesi indirilemedi', description: error.message, variant: 'destructive' });
    }
  }

  const students = data?.reference?.students || [];
  const instructors = data?.reference?.instructors || [];
  const run = async (action, message) => { setBusy(true); try { await action(); toast({ title: message }); await load(); return true; } catch (error) { toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' }); return false; } finally { setBusy(false); } };
  const candidatesByExam = useMemo(() => (data?.candidates || []).reduce((all, item) => ({ ...all, [item.examSessionId]: [...(all[item.examSessionId] || []), item] }), {}), [data]);

  async function saveClass(event) {
    event.preventDefault();
    const ok = await run(() => createDrivingTheoryClass({ ...classForm, capacity: Number(classForm.capacity), startsAtUtc: iso(classForm.startsAtUtc), endsAtUtc: iso(classForm.endsAtUtc) }), 'Teorik sınıf oluşturuldu');
    if (ok) setClassForm(initialClass());
  }
  async function saveTheory(event) {
    event.preventDefault();
    const ok = await run(() => createDrivingTheorySession({ ...theoryForm, instructorStaffId: theoryForm.instructorStaffId || null, startsAtUtc: iso(theoryForm.startsAtUtc), endsAtUtc: iso(theoryForm.endsAtUtc) }), 'Teorik ders programa eklendi');
    if (ok) setTheoryForm(initialTheory());
  }
  async function saveExam(event) {
    event.preventDefault();
    const payload = { examType: examForm.examType, title: examForm.title, startsAtUtc: iso(examForm.startsAtUtc), endsAtUtc: iso(examForm.endsAtUtc), location: examForm.location, capacity: Number(examForm.capacity), commission: [{ fullName: examForm.commissionName, role: examForm.commissionRole, organization: examForm.commissionOrganization }] };
    const ok = await run(() => createDrivingExamSession(payload), 'Sınav ve komisyon oluşturuldu');
    if (ok) setExamForm(initialExam());
  }
  async function openAttendance(session) {
    try { setAttendance({ session, rows: await fetchDrivingTheoryAttendance(session.id) }); } catch (error) { toast({ title: 'Yoklama açılamadı', description: error.message, variant: 'destructive' }); }
  }
  async function openCompliance(group) {
    try { setCompliance(await fetchDrivingClassCompliance(group.id)); } catch (error) { toast({ title: 'Mevzuat uyumu alınamadı', description: error.message, variant: 'destructive' }); }
  }
  async function saveAttendance() {
    if (!attendance) return;
    const ok = await run(() => saveDrivingTheoryAttendance(attendance.session.id, attendance.rows.map((row) => ({ studentProfileId: row.studentDrivingProfileId, status: row.status, note: row.note || '' }))), 'Yoklama kaydedildi');
    if (ok) setAttendance(null);
  }
  // Sonuç girişi: e-sınav / direksiyon sınavı notu. Eskiden window.prompt ile
  // alınıyordu — puan doğrulaması yapılamıyor ve iptal/geri alma net değildi.
  async function submitResult() {
    const { candidate, passed, score, failureReason } = resultForm;
    const numeric = score === '' ? null : Number(score);
    if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0 || numeric > 100)) {
      toast({ title: 'Puan 0-100 aralığında olmalı', variant: 'destructive' });
      return;
    }
    if (!passed && failureReason.trim().length < 3) {
      toast({ title: 'Başarısızlık nedeni en az 3 karakter olmalı', variant: 'destructive' });
      return;
    }
    await run(
      () => enterDrivingExamResult(candidate.id, {
        passed,
        score: numeric,
        failureReason: passed ? '' : failureReason.trim(),
        note: '',
      }),
      passed ? 'Sınav sonucu geçti olarak işlendi' : 'Sınav sonucu kaldı olarak işlendi',
    );
    setResultForm(null);
  }
  async function retry(candidate, type) {
    const alternatives = (data.exams || []).filter((exam) => exam.examType === type && exam.status === 'Planned' && exam.id !== candidate.examSessionId);
    if (!alternatives.length) return toast({ title: 'Uygun tekrar sınavı yok', description: 'Önce aynı türde yeni bir sınav oturumu oluşturun.', variant: 'destructive' });
    const targetId = window.prompt(`Hedef sınav ID:\n${alternatives.map((x) => `${x.id} — ${dateTime(x.startsAtUtc)} / ${x.title}`).join('\n')}`, alternatives[0].id);
    if (!targetId) return;
    const fee = Number(window.prompt('Tekrar sınav ücreti (ücretsiz için 0):', '0') || 0);
    await run(() => scheduleDrivingExamRetry(candidate.id, { examSessionId: targetId, feeAmount: fee }), 'Tekrar sınavı planlandı');
  }

  if (permissionLoading || loading) return <DrivingLoading />;
  if (!data) return null;
  return <DrivingPage testId="driving-education-page">
    <DrivingPageHeader
      title="Teorik Eğitim ve Sınav Yönetimi"
      description="Sınıftan yoklamaya, komisyondan tekrar sınavı ve ücrete kadar tek akış."
      icon={GraduationCap}
      onRefresh={load}
    />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <DrivingStatCard label="Teorik Sınıf" value={data.classes.length} caption="Açık sınıf" icon={Users} tone="violet" />
      <DrivingStatCard label="Planlı Ders" value={data.sessions.length} caption="Ders programında" icon={CalendarPlus} tone="brand" />
      <DrivingStatCard label="Sınav" value={data.exams.length} caption="Planlanan oturum" icon={GraduationCap} tone="blue" />
      <DrivingStatCard label="Aday" value={data.candidates?.length || 0} caption="Sınava kayıtlı" icon={ClipboardCheck} tone="emerald" />
    </div>
    <Tabs defaultValue="classes"><TabsList className="flex flex-wrap"><TabsTrigger value="classes">Sınıflar</TabsTrigger><TabsTrigger value="sessions">Ders Programı & Yoklama</TabsTrigger><TabsTrigger value="exams">Sınavlar</TabsTrigger></TabsList>
      <TabsContent value="classes" className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        {canTheoryManage && <Card><CardHeader><CardTitle>Yeni teorik sınıf</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={saveClass}><Input required placeholder="Sınıf adı" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} /><div className="grid grid-cols-2 gap-2"><Input required placeholder="Ehliyet sınıfı" value={classForm.licenseClass} onChange={(e) => setClassForm({ ...classForm, licenseClass: e.target.value })} /><Input required type="number" min="1" max="100" value={classForm.capacity} onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })} /></div><select required className="h-10 w-full rounded-md border bg-background px-3" value={classForm.instructorStaffId} onChange={(e) => setClassForm({ ...classForm, instructorStaffId: e.target.value })}><option value="">Öğretmen seçin</option>{instructors.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}</select><Input required type="datetime-local" value={classForm.startsAtUtc} onChange={(e) => setClassForm({ ...classForm, startsAtUtc: e.target.value })} /><Input required type="datetime-local" value={classForm.endsAtUtc} onChange={(e) => setClassForm({ ...classForm, endsAtUtc: e.target.value })} /><Input placeholder="Derslik" value={classForm.room} onChange={(e) => setClassForm({ ...classForm, room: e.target.value })} /><Button disabled={busy} className="w-full">Sınıfı Oluştur</Button></form></CardContent></Card>}
        <div className="space-y-3">
          {scheduleForm && (
            <Card className="border-[hsl(var(--brand-accent)/0.4)]">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>{scheduleForm.className} — Müfredattan Program Üret</span>
                  <Button size="sm" variant="ghost" onClick={() => setScheduleForm(null)}>Kapat</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Resmî müfredat (Trafik 16 / İlk Yardım 8 / Araç Tekniği 6 / Adab 4 = 34 ders saati) seçtiğiniz
                  günlere sırayla dağıtılır. Var olan dersler düşülür — mükerrer oturum üretilmez.
                </p>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="space-y-1 text-xs font-bold"><span>Başlangıç tarihi</span>
                    <Input type="date" value={scheduleForm.startDate} onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-xs font-bold"><span>Başlangıç saati</span>
                    <Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-xs font-bold"><span>Günde ders saati (45 dk)</span>
                    <Input type="number" min="1" max="8" value={scheduleForm.lessonsPerDay} onChange={(e) => setScheduleForm({ ...scheduleForm, lessonsPerDay: e.target.value })} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[[1, 'Pzt'], [2, 'Sal'], [3, 'Çar'], [4, 'Per'], [5, 'Cum'], [6, 'Cmt'], [0, 'Paz']].map(([day, label]) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setScheduleForm((state) => {
                        const days = new Set(state.days);
                        if (days.has(day)) days.delete(day); else days.add(day);
                        return { ...state, days };
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${scheduleForm.days.has(day) ? 'border-brand-primary bg-brand-primary text-white' : 'border-foreground/15 text-muted-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button disabled={busy} onClick={submitSchedule}><CalendarPlus className="mr-2 h-4 w-4" />Programı Üret</Button>
              </CardContent>
            </Card>
          )}
          {compliance && (
            <Card className={compliance.curriculumComplete && compliance.atRiskCount === 0 ? 'border-emerald-500/40' : 'border-amber-500/40'}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{compliance.className} — Mevzuat Uyumu</span>
                  <Button size="sm" variant="ghost" onClick={() => setCompliance(null)}>Kapat</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <b className="text-sm">Resmî müfredat ({compliance.requiredTotalHours} ders saati × {compliance.lessonMinutes} dk)</b>
                  <div className="mt-2 space-y-1.5">
                    {compliance.curriculum.map((subject) => (
                      <div key={subject.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
                        <span>{subject.label}</span>
                        <span className="flex items-center gap-2">
                          <b>{subject.plannedHours}/{subject.requiredHours} saat</b>
                          {subject.complete
                            ? <Badge className="border-0 bg-emerald-500/15 text-emerald-600">Tamam</Badge>
                            : <Badge className="border-0 bg-amber-500/15 text-amber-600">{subject.missingHours} saat eksik</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                  {compliance.unmatchedMinutes > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{compliance.unmatchedMinutes} dk ders resmî konularla eşleşmedi (ek ders sayılır).</p>
                  )}
                </div>
                <div>
                  <b className="text-sm">Devam durumu (asgari %{compliance.minimumAttendancePercent})</b>
                  {compliance.atRiskCount === 0 ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Dönem yanma riski taşıyan kursiyer yok.</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {compliance.students.filter((x) => x.atRisk).map((student) => (
                        <div key={student.profileId} className="flex items-center justify-between rounded-xl border border-red-500/40 bg-red-500/5 p-2.5 text-sm">
                          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /><b>#{student.studentNumber} {student.fullName}</b></span>
                          <span className="font-bold text-red-600">Devam %{student.attendancePercent} — dönem yanma riski</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {data.classes.map((group) => <Card key={group.id}><CardContent className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{group.name} • {group.licenseClass}</h3><p className="text-sm text-muted-foreground">{group.instructorName} • {group.room || 'Derslik belirtilmedi'} • {dateTime(group.startsAtUtc)}</p></div><div className="flex flex-wrap items-start gap-2"><Badge>{group.studentCount}/{group.capacity} öğrenci</Badge><Button size="sm" variant="outline" onClick={() => openCompliance(group)}><ShieldCheck className="mr-1 h-3 w-3" />Mevzuat</Button>{canTheoryManage && <Button size="sm" variant="outline" onClick={() => setScheduleForm({ classId: group.id, className: group.name, startDate: new Date().toISOString().slice(0, 10), days: new Set([1, 3]), startTime: '18:00', lessonsPerDay: 2 })}><CalendarPlus className="mr-1 h-3 w-3" />Program Oluştur</Button>}<Button size="sm" variant="outline" onClick={() => downloadSchedule(group)}><Download className="mr-1 h-3 w-3" />Program (PDF)</Button></div></div>{canTheoryManage && <div className="mt-4 space-y-2"><Checks items={students.filter((x) => x.licenseClass === group.licenseClass)} selected={classStudents[group.id] || []} onChange={(value) => setClassStudents((x) => ({ ...x, [group.id]: value }))} /><Button size="sm" disabled={busy || !(classStudents[group.id]?.length)} onClick={() => run(() => enrollDrivingTheoryStudents(group.id, classStudents[group.id]), 'Öğrenciler sınıfa atandı')}><Users className="mr-2 h-4 w-4" />Seçilenleri Ata</Button></div>}</CardContent></Card>)}
        </div>
      </TabsContent>
      <TabsContent value="sessions" className="mt-5 space-y-5">
        {canTheoryManage && <Card><CardHeader><CardTitle>Ders programına ekle</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-3" onSubmit={saveTheory}><select required className="h-10 rounded-md border bg-background px-3" value={theoryForm.theoryClassId} onChange={(e) => setTheoryForm({ ...theoryForm, theoryClassId: e.target.value })}><option value="">Sınıf seçin</option>{data.classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><Input required placeholder="Ders / konu alanı" list="mtsk-subjects" value={theoryForm.subject} onChange={(e) => setTheoryForm({ ...theoryForm, subject: e.target.value })} /><datalist id="mtsk-subjects"><option value="Trafik ve Çevre Bilgisi" /><option value="İlk Yardım" /><option value="Araç Tekniği" /><option value="Trafik Adabı" /></datalist><Input required placeholder="İşlenecek konu" value={theoryForm.topic} onChange={(e) => setTheoryForm({ ...theoryForm, topic: e.target.value })} /><Input required type="datetime-local" value={theoryForm.startsAtUtc} onChange={(e) => setTheoryForm({ ...theoryForm, startsAtUtc: e.target.value })} /><Input required type="datetime-local" value={theoryForm.endsAtUtc} onChange={(e) => setTheoryForm({ ...theoryForm, endsAtUtc: e.target.value })} /><Input placeholder="Derslik" value={theoryForm.room} onChange={(e) => setTheoryForm({ ...theoryForm, room: e.target.value })} /><Button disabled={busy} className="md:col-span-3"><CalendarPlus className="mr-2 h-4 w-4" />Programa Ekle</Button></form></CardContent></Card>}
        {attendance && <Card className="border-blue-500/40"><CardHeader><CardTitle>{attendance.session.subject} yoklaması</CardTitle></CardHeader><CardContent className="space-y-2">{attendance.rows.map((row, index) => <div key={row.studentDrivingProfileId} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_160px_1fr]"><b>{row.studentName}</b><select className="h-9 rounded-md border bg-background px-2" value={row.status} onChange={(e) => setAttendance((state) => ({ ...state, rows: state.rows.map((item, i) => i === index ? { ...item, status: e.target.value } : item) }))}><option value="Present">Katıldı</option><option value="Late">Geç kaldı</option><option value="Absent">Katılmadı</option><option value="Excused">Mazeretli</option></select><Input placeholder="Not" value={row.note} onChange={(e) => setAttendance((state) => ({ ...state, rows: state.rows.map((item, i) => i === index ? { ...item, note: e.target.value } : item) }))} /></div>)}<div className="flex gap-2 pt-2"><Button disabled={busy} onClick={saveAttendance}>Yoklamayı Kaydet</Button><Button variant="outline" onClick={() => setAttendance(null)}>Kapat</Button></div></CardContent></Card>}
        <div className="grid gap-3 lg:grid-cols-2">{data.sessions.map((session) => <Card key={session.id}><CardContent className="p-5"><div className="flex justify-between"><div><b>{session.subject}</b><p className="text-sm text-muted-foreground">{session.topic}</p></div><Badge className={statusTone(session.status)}>{session.status}</Badge></div><p className="mt-3 text-sm">{dateTime(session.startsAtUtc)} • {session.className} • {session.instructorName} • {session.room}</p>{canAttendance && <Button size="sm" variant="outline" className="mt-3" onClick={() => openAttendance(session)}><ClipboardCheck className="mr-2 h-4 w-4" />Yoklama</Button>}</CardContent></Card>)}</div>
      </TabsContent>
      <TabsContent value="exams" className="mt-5 space-y-5">
        {importState && (
          <Card className="border-blue-500/40">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>{importState.exam.title} — Toplu Sonuç İçe Aktarma</span>
                <Button size="sm" variant="ghost" onClick={() => setImportState(null)}>Kapat</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                e-Sınav/MEBBİS'ten aldığınız listeyi yapıştırın veya dosya seçin. Her satırda <b>11 haneli TC</b> yeterli;
                varsa puan (e-sınavda 70 barajı otomatik uygulanır) ve "geçti/kaldı" metni de tanınır.
                Hak sayacı, dönem düşme ve zorunlu ek ders kuralları otomatik işler.
              </p>
              <Input type="file" accept=".csv,.txt" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImportState((state) => ({ ...state, text: String(reader.result || '') }));
                reader.readAsText(file, 'utf-8');
              }} />
              <textarea
                className="min-h-[140px] w-full rounded-xl border bg-background p-3 font-mono text-xs"
                placeholder={'12345678901;85\n98765432109;kaldı\n11122233344;geçti'}
                value={importState.text}
                onChange={(e) => setImportState((state) => ({ ...state, text: e.target.value }))}
              />
              <div className="flex items-center gap-3">
                <Button disabled={busy || !importState.text.trim()} onClick={submitImport}>
                  {parseResultLines(importState.text).length} satırı işle
                </Button>
                {importState.summary && (
                  <span className="text-sm">
                    <b className="text-emerald-600">{importState.summary.passedCount} geçti</b>{' • '}
                    <b className="text-red-600">{importState.summary.failedCount} kaldı</b>{' • '}
                    {importState.summary.errors.length} atlandı
                  </span>
                )}
              </div>
              {importState.summary?.errors?.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                  <b className="text-amber-700 dark:text-amber-400">Atlanan satırlar:</b>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {importState.summary.errors.map((err, index) => (
                      <li key={index}>{err.identityNumber}{err.name ? ` (${err.name})` : ''}: {err.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {resultForm ? (
          <Card className="border-[hsl(var(--brand-accent)/0.4)]">
            <CardHeader>
              <CardTitle>
                {resultForm.candidate.studentName} — sınav notu
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[160px_1fr_auto_auto]">
              <label className="space-y-1.5 text-sm font-semibold">
                <span>Puan (0-100)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Boş bırakılabilir"
                  value={resultForm.score}
                  onChange={(e) => setResultForm((x) => ({ ...x, score: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold">
                <span>{resultForm.passed ? 'Not (opsiyonel)' : 'Başarısızlık nedeni'}</span>
                <Input
                  disabled={resultForm.passed}
                  placeholder={resultForm.passed ? 'Geçti olarak işlenecek' : 'Nedenini yazın'}
                  value={resultForm.failureReason}
                  onChange={(e) => setResultForm((x) => ({ ...x, failureReason: e.target.value }))}
                />
              </label>
              <Button className="self-end" disabled={busy} onClick={submitResult}>
                {resultForm.passed ? 'Geçti Olarak Kaydet' : 'Kaldı Olarak Kaydet'}
              </Button>
              <Button className="self-end" variant="outline" onClick={() => setResultForm(null)}>Vazgeç</Button>
            </CardContent>
          </Card>
        ) : null}
        {canExamManage && <Card><CardHeader><CardTitle>Yeni sınav ve komisyon</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-3" onSubmit={saveExam}><select className="h-10 rounded-md border bg-background px-3" value={examForm.examType} onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}><option value="TheoryEExam">E-sınav</option><option value="DrivingPractice">Direksiyon sınavı</option></select><Input required placeholder="Sınav adı" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} /><Input required placeholder="Sınav yeri" value={examForm.location} onChange={(e) => setExamForm({ ...examForm, location: e.target.value })} /><Input required type="datetime-local" value={examForm.startsAtUtc} onChange={(e) => setExamForm({ ...examForm, startsAtUtc: e.target.value })} /><Input required type="datetime-local" value={examForm.endsAtUtc} onChange={(e) => setExamForm({ ...examForm, endsAtUtc: e.target.value })} /><Input required type="number" min="1" max="100" value={examForm.capacity} onChange={(e) => setExamForm({ ...examForm, capacity: e.target.value })} /><Input required placeholder="Komisyon üyesi" value={examForm.commissionName} onChange={(e) => setExamForm({ ...examForm, commissionName: e.target.value })} /><Input required placeholder="Komisyon görevi" value={examForm.commissionRole} onChange={(e) => setExamForm({ ...examForm, commissionRole: e.target.value })} /><Input placeholder="Kurum" value={examForm.commissionOrganization} onChange={(e) => setExamForm({ ...examForm, commissionOrganization: e.target.value })} /><Button disabled={busy} className="md:col-span-3"><GraduationCap className="mr-2 h-4 w-4" />Sınavı Oluştur</Button></form></CardContent></Card>}
        {data.exams.map((exam) => <Card key={exam.id}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{exam.title}</span><span className="flex items-center gap-2"><Badge>{examLabel(exam.examType)} • {exam.candidateCount}/{exam.capacity}</Badge>{canResult && <Button size="sm" variant="outline" onClick={() => setImportState({ exam, text: '', summary: null })}><ClipboardCheck className="mr-1 h-3 w-3" />Toplu Sonuç</Button>}<Button size="sm" variant="outline" onClick={() => downloadRoster(exam)}><Download className="mr-1 h-3 w-3" />Sınav Listesi (PDF)</Button></span></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{dateTime(exam.startsAtUtc)} • {exam.location}</p><p className="mt-1 text-xs">Komisyon: {exam.commission.map((x) => `${x.fullName} (${x.role})`).join(', ')}</p>{canExamManage && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"><Checks items={students} selected={examStudents[exam.id] || []} onChange={(value) => setExamStudents((x) => ({ ...x, [exam.id]: value }))} /><Input type="number" min="0" placeholder="Sınav ücreti" value={examFees[exam.id] || ''} onChange={(e) => setExamFees((x) => ({ ...x, [exam.id]: e.target.value }))} /><Button disabled={busy || !(examStudents[exam.id]?.length)} onClick={() => run(() => addDrivingExamCandidates(exam.id, { studentProfileIds: examStudents[exam.id], feeAmount: Number(examFees[exam.id] || 0) }), 'Adaylar sınava eklendi')}>Adayları Ekle</Button></div>}<div className="mt-4 space-y-2">{(candidatesByExam[exam.id] || []).map((candidate) => (
          <div key={candidate.id} className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>{candidate.studentName}</b>
                <p className="text-xs text-muted-foreground">
                  {candidate.attemptNo}/{candidate.maxAttempts || 4}. hak
                  {candidate.attemptNo >= (candidate.maxAttempts || 4) && candidate.status !== 'Passed' && <span className="ml-1 font-bold text-red-600">— SON HAK</span>}
                  {candidate.score != null ? ` • ${candidate.score} puan` : ''} {candidate.failureReason ? `• ${candidate.failureReason}` : ''}
                </p>
              </div>
              <div className="flex gap-2"><Badge className={statusTone(candidate.status)}>{candidate.status}</Badge>{canResult && candidate.status === 'Planned' && <><Button size="sm" className="bg-emerald-600" onClick={() => setResultForm({ candidate, passed: true, score: '70', failureReason: '' })}><CheckCircle2 className="mr-1 h-3 w-3" />Geçti</Button><Button size="sm" variant="destructive" onClick={() => setResultForm({ candidate, passed: false, score: '', failureReason: '' })}>Kaldı</Button></>}{canExamManage && candidate.status === 'Failed' && <Button size="sm" variant="outline" onClick={() => retry(candidate, exam.examType)}><RotateCcw className="mr-1 h-3 w-3" />Tekrar</Button>}</div>
            </div>
            {/* Direksiyon sınavında aday-araç-usta öğretici eşleşmesi (sınav günü listesi için). */}
            {exam.examType === 'DrivingPractice' && canExamManage && candidate.status === 'Planned' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={candidate.assignedVehicleId || ''} onChange={(e) => assignCandidate(candidate, { vehicleId: e.target.value })}>
                  <option value="">Sınav aracı seçin</option>
                  {examResources.vehicles.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}
                </select>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={candidate.assignedInstructorProfileId || ''} onChange={(e) => assignCandidate(candidate, { instructorProfileId: e.target.value })}>
                  <option value="">Usta öğretici seçin</option>
                  {examResources.instructors.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}</div></CardContent></Card>)}
      </TabsContent>
    </Tabs>
  </DrivingPage>;
}
