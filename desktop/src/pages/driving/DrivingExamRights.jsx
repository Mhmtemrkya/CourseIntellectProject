import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ClipboardCheck, Pencil, Search } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingExamRights, saveDrivingExamRight } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';
import { DrivingLoading, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const emptyForm = {
  candidateId: null,
  studentProfileId: '',
  examType: 'TheoryEExam',
  attemptNo: 1,
  score: '',
  passed: true,
  examDate: new Date().toISOString().slice(0, 10),
};

const typeLabel = (type) => (type === 'DrivingPractice' ? 'Direksiyon' : 'Teorik');
const dateLabel = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '—');

export default function DrivingExamRights() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [data, setData] = useState({ students: [], attempts: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);

  const canEnter = can(DRIVING.examResultEnter);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      setData(await fetchDrivingExamRights());
    } catch (loadError) {
      setError(loadError.message || 'Sınav hakları alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoading) load();
  }, [load, permissionsLoading]);

  const students = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    if (!query) return data.students || [];
    return (data.students || []).filter((student) =>
      `${student.fullName} ${student.studentNumber} ${student.licenseClass}`
        .toLocaleLowerCase('tr-TR')
        .includes(query));
  }, [data.students, search]);

  const openNew = (student, examType) => {
    const rights = examType === 'TheoryEExam' ? student.theory : student.practice;
    setForm({
      ...emptyForm,
      studentProfileId: student.profileId,
      examType,
      attemptNo: Math.min((rights?.used || 0) + 1, rights?.max || 4),
    });
  };

  const openEdit = (attempt) => setForm({
    candidateId: attempt.id,
    studentProfileId: attempt.studentDrivingProfileId,
    examType: attempt.examType,
    attemptNo: attempt.attemptNo,
    score: attempt.score ?? '',
    passed: attempt.status === 'Passed',
    examDate: attempt.examDateUtc?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  });

  const submit = async (event) => {
    event.preventDefault();
    const score = Number(form.score);
    if (!form.studentProfileId || !form.examDate || !Number.isFinite(score) || score < 0 || score > 100) {
      toast({ title: 'Eksik veya geçersiz bilgi', description: 'Kursiyer, sınav tarihi ve 0-100 arası puan zorunludur.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveDrivingExamRight({
        candidateId: form.candidateId,
        studentProfileId: form.studentProfileId,
        examType: form.examType,
        attemptNo: Number(form.attemptNo),
        score,
        passed: Boolean(form.passed),
        examDateUtc: new Date(`${form.examDate}T12:00:00`).toISOString(),
      });
      toast({ title: form.candidateId ? 'Sınav kaydı güncellendi' : 'Sınav sonucu kaydedildi' });
      setForm(null);
      await load(true);
    } catch (saveError) {
      toast({ title: 'Sınav kaydı kaydedilemedi', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (permissionsLoading || loading) return <DrivingLoading />;

  const attempts = data.attempts || [];
  const scored = attempts.filter((attempt) => attempt.score != null);
  const average = scored.length
    ? (scored.reduce((sum, attempt) => sum + Number(attempt.score), 0) / scored.length).toFixed(1)
    : '—';

  return (
    <DrivingPage testId="driving-exam-rights-page">
      <DrivingPageHeader
        title="Sınav Hakları"
        description="Kursiyerlerin teorik ve direksiyon sınav girişlerini, puanlarını ve tarihlerini yönetin."
        icon={ClipboardCheck}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {error ? <ErrorBanner title="Sınav hakları alınamadı" message={error} onRetry={() => load()} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrivingStatCard label="Kursiyer" value={data.students?.length || 0} caption="Sistemde kayıtlı" icon={ClipboardCheck} tone="brand" />
        <DrivingStatCard label="Sınav Kaydı" value={attempts.length} caption="Teorik + direksiyon" icon={CalendarDays} tone="violet" />
        <DrivingStatCard label="Ortalama Puan" value={average} caption="Puan girilen sınavlar" icon={ClipboardCheck} tone="amber" />
        <DrivingStatCard label="Başarılı" value={attempts.filter((x) => x.status === 'Passed').length} caption="Geçilen sınav" icon={ClipboardCheck} tone="emerald" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kursiyer adı, numarası veya ehliyet sınıfı ara..." className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {students.map((student) => (
          <motion.div key={student.profileId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-3">{student.photoUrl ? <img src={assetUrl(student.photoUrl)} alt={student.fullName} className="h-11 w-11 rounded-xl border object-cover" /> : null}{student.fullName}</span>
                  <span className="flex items-center gap-2"><Badge variant="outline">#{student.studentNumber}</Badge><Badge>{student.licenseClass}</Badge></span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  ['TheoryEExam', 'Teorik', student.theory],
                  ['DrivingPractice', 'Direksiyon', student.practice],
                ].map(([examType, label, rights]) => (
                  <div key={examType} className="rounded-xl border bg-muted/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <b>{label}</b>
                      <Badge className={rights?.remaining === 0 ? 'bg-red-600 text-white' : ''}>{rights?.used || 0}/{rights?.max || 4} hak</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Kalan</span><b className="text-right">{rights?.remaining ?? 4}</b>
                      <span className="text-muted-foreground">Son puan</span><b className="text-right">{rights?.lastScore ?? '—'}</b>
                      <span className="text-muted-foreground">Son tarih</span><b className="text-right">{dateLabel(rights?.lastExamDateUtc)}</b>
                    </div>
                    {canEnter && <Button className="mt-3 w-full" size="sm" onClick={() => openNew(student, examType)} disabled={(rights?.used || 0) >= (rights?.max || 4)}>Sonuç Gir</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Sınav Geçmişi</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {attempts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Henüz sınav sonucu girilmedi.</p>}
          {attempts.map((attempt) => {
            const student = data.students?.find((item) => item.profileId === attempt.studentDrivingProfileId);
            return (
              <div key={attempt.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {student?.photoUrl ? <img src={assetUrl(student.photoUrl)} alt={student.fullName} className="h-10 w-10 rounded-xl border object-cover" /> : null}<div><b>{student?.fullName || 'Kursiyer'}</b>
                  <p className="text-sm text-muted-foreground">{typeLabel(attempt.examType)} • {attempt.attemptNo}. giriş • {dateLabel(attempt.examDateUtc)}</p>
                </div></div>
                <div className="flex items-center gap-2">
                  <Badge className={attempt.status === 'Passed' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}>{attempt.score ?? '—'} puan</Badge>
                  {canEnter && <Button size="sm" variant="outline" onClick={() => openEdit(attempt)}><Pencil className="mr-1 h-3.5 w-3.5" />Düzenle</Button>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.candidateId ? 'Sınav Kaydını Düzenle' : 'Sınav Sonucu Gir'}</DialogTitle>
            <DialogDescription>Tür, kaçıncı giriş olduğu, puan ve sınav tarihi sistemde kalıcı olarak saklanır.</DialogDescription>
          </DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-1.5 text-sm font-semibold">Kursiyer
                <select className="h-10 w-full rounded-md border bg-background px-3" value={form.studentProfileId} onChange={(event) => setForm({ ...form, studentProfileId: event.target.value })} disabled={Boolean(form.candidateId)}>
                  {(data.students || []).map((student) => <option key={student.profileId} value={student.profileId}>{student.fullName} — #{student.studentNumber}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-semibold">Sınav türü
                  <select className="h-10 w-full rounded-md border bg-background px-3" value={form.examType} onChange={(event) => setForm({ ...form, examType: event.target.value })}>
                    <option value="TheoryEExam">Teorik</option>
                    <option value="DrivingPractice">Direksiyon</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-semibold">Kaçıncı giriş
                  <Input type="number" min="1" max="4" value={form.attemptNo} onChange={(event) => setForm({ ...form, attemptNo: event.target.value })} />
                </label>
                <label className="space-y-1.5 text-sm font-semibold">Sınav puanı
                  <Input type="number" min="0" max="100" step="0.01" value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} required />
                </label>
                <label className="space-y-1.5 text-sm font-semibold">Sınav sonucu
                  <select className="h-10 w-full rounded-md border bg-background px-3" value={form.passed ? 'passed' : 'failed'} onChange={(event) => setForm({ ...form, passed: event.target.value === 'passed' })}>
                    <option value="passed">Geçti</option>
                    <option value="failed">Kaldı</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-semibold">Sınav tarihi
                  <Input type="date" value={form.examDate} onChange={(event) => setForm({ ...form, examDate: event.target.value })} required />
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Vazgeç</Button>
                <Button disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DrivingPage>
  );
}
