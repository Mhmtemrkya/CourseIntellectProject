import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, FileUp, LayoutTemplate, Pencil, Plus, ScanLine, Search, Trash2, XCircle,
} from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import {
  deleteOpticalExam, deleteOpticalTemplate, fetchOpticalExam, fetchOpticalExams, fetchOpticalResults, fetchOpticalTemplates,
  importOpticalFile, previewOpticalFile, searchOpticalStudents,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  OpticalExamDto, OpticalExamResultsDto, OpticalExamSummaryDto, OpticalPreviewDto, OpticalPreviewRowDto,
  OpticalStudentCandidateDto, OpticalTemplateDto,
} from '../../types/api/generated';
import { OpticalExamEditor, OpticalTemplateEditor } from './OpticalEditors';

const net = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const formatDate = (value: string) => new Date(value).toLocaleDateString('tr-TR');

/**
 * Optik denemeler: optik okuyucu dosyasından deneme sonucu aktarımı. Akış: şablon → deneme
 * (cevap anahtarı + konular) → dosya önizleme (eşleştirme) → içe aktar. Netler sınav
 * sonuçlarına, soru-konu cevapları Öğrenci Konu Analizine gider.
 */
export default function OpticalExamsPage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<OpticalExamSummaryDto[] | null>(null);
  const [templates, setTemplates] = useState<OpticalTemplateDto[]>([]);
  const [templateEditor, setTemplateEditor] = useState<{ open: boolean; template: OpticalTemplateDto | null }>({ open: false, template: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [examEditor, setExamEditor] = useState<{ open: boolean; exam: OpticalExamDto | null }>({ open: false, exam: null });
  const [importExam, setImportExam] = useState<OpticalExamSummaryDto | null>(null);
  const [resultsExam, setResultsExam] = useState<OpticalExamSummaryDto | null>(null);

  const load = useCallback(async () => {
    try {
      const [examList, templateList] = await Promise.all([fetchOpticalExams(), fetchOpticalTemplates()]);
      setExams(examList ?? []);
      setTemplates(templateList ?? []);
    } catch (error) {
      toast({ title: 'Denemeler yüklenemedi', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const editExam = async (id: string) => {
    try {
      setExamEditor({ open: true, exam: await fetchOpticalExam(id) });
    } catch (error) {
      toast({ title: 'Deneme açılamadı', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const removeExam = async (exam: OpticalExamSummaryDto) => {
    if (!window.confirm(`"${exam.title}" ve aktarılmış tüm sonuçları silinsin mi?`)) return;
    try {
      await deleteOpticalExam(exam.id);
      toast({ title: 'Deneme silindi' });
      await load();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  if (!exams) return <PageLoading />;

  return (
    <Page testId="optical-exams-page">
      <PageHeader
        title="Optik Denemeler"
        description="Optik okuyucu dosyasından deneme sonuçlarını aktarın; netler raporlara, soru-konu sonuçları konu analizine gider."
        icon={ScanLine}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}><LayoutTemplate className="mr-2 h-4 w-4" />Optik şablonlar</Button>
            <Button onClick={() => (templates.length === 0 ? setTemplateEditor({ open: true, template: null }) : setExamEditor({ open: true, exam: null }))}>
              <Plus className="mr-2 h-4 w-4" />Yeni deneme
            </Button>
          </div>
        )}
      />

      {templates.length === 0 ? (
        <PageNotice icon={LayoutTemplate} title="Önce optik şablonu tanımlayın" message="Optik okuyucunuzun çıktı dosyasında öğrenci numarası, ad ve cevapların hangi kolonlarda olduğunu bir kez girin; sonraki denemelerde yeniden kullanılır."
          action={<Button onClick={() => setTemplateEditor({ open: true, template: null })}><Plus className="mr-2 h-4 w-4" />Şablon oluştur</Button>} />
      ) : exams.length === 0 ? (
        <PageNotice icon={ScanLine} title="Henüz deneme yok" message="Yeni deneme oluşturup cevap anahtarını girin, ardından optik dosyasını yükleyin." />
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Deneme</th>
                  <th className="px-4 py-2">Tarih</th>
                  <th className="px-4 py-2">Soru</th>
                  <th className="px-4 py-2">Konu girilen</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td className="px-4 py-3"><p className="font-medium">{exam.title}</p><p className="text-xs text-muted-foreground">{exam.templateName}</p></td>
                    <td className="px-4 py-3 tabular-nums">{formatDate(exam.examDateUtc)}</td>
                    <td className="px-4 py-3 tabular-nums">{exam.questionCount}</td>
                    <td className="px-4 py-3">
                      <span className={exam.topicCoverage === 100 ? 'text-emerald-600' : exam.topicCoverage === 0 ? 'text-rose-600' : 'text-amber-600'}>{`%${exam.topicCoverage}`}</span>
                    </td>
                    <td className="px-4 py-3">
                      {exam.status === 'Imported'
                        ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{`${exam.importedStudentCount} öğrenci aktarıldı`}</Badge>
                        : <Badge variant="outline">Dosya bekleniyor</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => setImportExam(exam)}><FileUp className="mr-1 h-4 w-4" />Dosya yükle</Button>
                        {exam.status === 'Imported' ? <Button size="sm" variant="outline" onClick={() => setResultsExam(exam)}><BarChart3 className="mr-1 h-4 w-4" />Sonuçlar</Button> : null}
                        <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => void editExam(exam.id)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => void removeExam(exam)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TemplatesDialog open={templatesOpen} templates={templates} onClose={() => setTemplatesOpen(false)}
        onEdit={(template) => setTemplateEditor({ open: true, template })} onChanged={load} />
      <OpticalTemplateEditor open={templateEditor.open} template={templateEditor.template}
        onClose={() => setTemplateEditor({ open: false, template: null })} onSaved={() => void load()} />
      <OpticalExamEditor open={examEditor.open} exam={examEditor.exam} templates={templates}
        onClose={() => setExamEditor({ open: false, exam: null })} onSaved={() => void load()} />
      <ImportDialog exam={importExam} templates={templates} onClose={() => setImportExam(null)} onImported={() => void load()} />
      <ResultsDialog exam={resultsExam} onClose={() => setResultsExam(null)} />
    </Page>
  );
}

function TemplatesDialog({ open, templates, onClose, onEdit, onChanged }: {
  open: boolean; templates: OpticalTemplateDto[]; onClose: () => void; onEdit: (template: OpticalTemplateDto | null) => void; onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const remove = async (template: OpticalTemplateDto) => {
    if (!window.confirm(`"${template.name}" şablonu silinsin mi?`)) return;
    try {
      await deleteOpticalTemplate(template.id);
      await onChanged();
    } catch (error) {
      toast({ title: 'Silinemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Optik şablonlar</DialogTitle>
          <DialogDescription>Her optik okuyucu çıktısı için kolon düzeni bir kez tanımlanır.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl border">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="font-medium">{template.name}</p>
                <p className="truncate text-xs text-muted-foreground">{template.subjects.map((item) => `${item.name} (${item.count})`).join(' • ')}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => onEdit(template)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => void remove(template)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={() => onEdit(null)}><Plus className="mr-2 h-4 w-4" />Yeni şablon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kolon cetveli: her 10 kolonda numara, arada nokta. */
function Ruler({ length }: { length: number }) {
  const text = useMemo(() => {
    let tens = '';
    let ones = '';
    for (let column = 1; column <= length; column++) {
      tens += column % 10 === 0 ? String(Math.floor(column / 10) % 10) : ' ';
      ones += String(column % 10);
    }
    return `${tens}\n${ones}`;
  }, [length]);
  return <pre className="select-none text-muted-foreground">{text}</pre>;
}

function MatchBadge({ row, chosen }: { row: OpticalPreviewRowDto; chosen: string | null | undefined }) {
  if (chosen === null) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Atlanacak</span>;
  if (row.matchStatus === 'matched' && chosen === undefined) {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{row.matchedBy ?? 'Eşleşti'}</span>;
  }
  if (chosen) return <span className="inline-flex items-center gap-1 text-xs text-blue-600"><CheckCircle2 className="h-3.5 w-3.5" />Elle seçildi</span>;
  return row.matchStatus === 'ambiguous'
    ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Onay gerekiyor</span>
    : <span className="inline-flex items-center gap-1 text-xs text-rose-600"><XCircle className="h-3.5 w-3.5" />Eşleşmedi</span>;
}

function StudentPicker({ row, value, onChange }: { row: OpticalPreviewRowDto; value: string | null | undefined; onChange: (value: string | null | undefined) => void }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<OpticalStudentCandidateDto[]>(row.candidates);
  const lookup = async () => {
    try {
      setOptions((await searchOpticalStudents(search)) ?? []);
    } catch {
      setOptions([]);
    }
  };
  const selectValue = value === null ? '__skip__' : value ?? (row.matchStatus === 'matched' ? row.studentUserId ?? '' : '');
  return (
    <div className="flex min-w-[260px] flex-col gap-1">
      <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={selectValue}
        onChange={(event) => onChange(event.target.value === '__skip__' ? null : event.target.value === '' ? undefined : event.target.value)}>
        {row.matchStatus === 'matched' && row.studentUserId ? <option value={row.studentUserId}>{row.studentName ?? ''}</option> : <option value="">Öğrenci seçin…</option>}
        {options.filter((item) => item.studentUserId !== row.studentUserId).map((item) => (
          <option key={item.studentUserId} value={item.studentUserId}>{`${item.fullName} • ${item.className}${item.schoolNumber ? ` • ${item.schoolNumber}` : ''}`}</option>
        ))}
        <option value="__skip__">Bu satırı atla</option>
      </select>
      {row.matchStatus !== 'matched' ? (
        <div className="flex gap-1">
          <Input className="h-8 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad ya da okul no ara"
            onKeyDown={(event) => { if (event.key === 'Enter') void lookup(); }} />
          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Öğrenci ara" onClick={() => void lookup()}><Search className="h-3.5 w-3.5" /></Button>
        </div>
      ) : null}
    </div>
  );
}

function ImportDialog({ exam, templates, onClose, onImported }: {
  exam: OpticalExamSummaryDto | null; templates: OpticalTemplateDto[]; onClose: () => void; onImported: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState('auto');
  const [preview, setPreview] = useState<OpticalPreviewDto | null>(null);
  const [choices, setChoices] = useState<Record<number, string | null>>({});
  const [busy, setBusy] = useState(false);
  const template = templates.find((item) => item.id === exam?.templateId);

  useEffect(() => {
    setFile(null);
    setPreview(null);
    setChoices({});
    setEncoding('auto');
  }, [exam]);

  const runPreview = async (selected: File, selectedEncoding: string) => {
    if (!exam) return;
    setBusy(true);
    try {
      setPreview(await previewOpticalFile(exam.id, selected, selectedEncoding));
      setChoices({});
    } catch (error) {
      toast({ title: 'Dosya okunamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const willImport = (preview?.rows ?? []).filter((row) => {
    const choice = choices[row.line];
    return choice === undefined ? row.matchStatus === 'matched' : choice !== null;
  }).length;

  const runImport = async () => {
    if (!exam || !file) return;
    setBusy(true);
    try {
      const overrides = Object.entries(choices).map(([line, studentUserId]) => ({ line: Number(line), studentUserId }));
      const result = await importOpticalFile(exam.id, file, preview?.encoding ?? encoding, overrides);
      toast({
        title: 'Deneme aktarıldı',
        description: result ? `${result.importedStudents} öğrenci aktarıldı, ${result.skippedRows} satır atlandı; ${result.topicAnswerCount} cevap konu analizine eklendi.` : undefined,
      });
      onImported();
      onClose();
    } catch (error) {
      toast({ title: 'Aktarılamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const subjects = template?.subjects ?? [];
  return (
    <Dialog open={Boolean(exam)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? `${exam.title} — optik dosyası` : ''}</DialogTitle>
          <DialogDescription>Dosya önce önizlenir; onaylamadan hiçbir şey kaydedilmez. Aynı denemeyi yeniden yüklerseniz eski sonuçların yerine geçer.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="optical-file">Optik okuyucu dosyası (.txt / .dat)</Label>
            <Input id="optical-file" type="file" accept=".txt,.dat,.csv,text/plain"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                if (selected) void runPreview(selected, encoding);
              }} />
          </div>
          <div className="w-56">
            <Label htmlFor="optical-encoding">Kodlama</Label>
            <select id="optical-encoding" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={encoding}
              onChange={(event) => { setEncoding(event.target.value); if (file) void runPreview(file, event.target.value); }}>
              <option value="auto">Otomatik algıla</option>
              <option value="windows-1254">Türkçe Windows (1254)</option>
              <option value="utf-8">UTF-8</option>
            </select>
          </div>
        </div>

        {busy && !preview ? <PageLoading /> : null}
        {preview ? (
          <div className="space-y-4">
            <section className="rounded-xl border bg-foreground/[0.02] p-3">
              <p className="mb-2 text-xs text-muted-foreground">{`İlk satırlar (${preview.encoding}) — Türkçe harfler bozuk görünüyorsa kodlamayı değiştirin; kolonlar kaymışsa şablonu düzeltin.`}</p>
              <div className="overflow-x-auto font-mono text-xs leading-5">
                <Ruler length={Math.max(template?.lineLength ?? 0, ...preview.sampleLines.map((line) => line.length))} />
                {preview.sampleLines.map((line, index) => <pre key={index}>{line}</pre>)}
              </div>
            </section>

            {preview.errors.map((error) => (
              <p key={error} className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-700 dark:text-rose-300"><AlertTriangle className="h-4 w-4" />{error}</p>
            ))}

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{`${preview.rowCount} satır`}</Badge>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{`${preview.matchedCount} eşleşti`}</Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">{`${preview.ambiguousCount} onay gerekiyor`}</Badge>
              <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">{`${preview.unmatchedCount} eşleşmedi`}</Badge>
            </div>

            <section className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-xs">
                  <thead className="bg-foreground/[0.03] text-left uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Satır</th>
                      <th className="px-2 py-2">Optikteki bilgi</th>
                      <th className="px-2 py-2">Kitapçık</th>
                      <th className="px-2 py-2">Eşleşme</th>
                      <th className="px-2 py-2">Öğrenci</th>
                      {subjects.map((subject) => <th key={subject.name} className="px-2 py-2">{`${subject.name} D/Y/B · net`}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row) => (
                      <tr key={row.line} className={row.matchStatus === 'matched' && choices[row.line] === undefined ? '' : 'bg-amber-500/[0.04]'}>
                        <td className="px-2 py-2 tabular-nums">{row.line}</td>
                        <td className="px-2 py-2">
                          <p className="font-medium">{row.name || '—'}</p>
                          <p className="text-muted-foreground">{[row.studentNo, row.className].filter(Boolean).join(' • ')}</p>
                          {row.warnings.map((warning) => <p key={warning} className="text-amber-700 dark:text-amber-300">{warning}</p>)}
                        </td>
                        <td className="px-2 py-2">{row.booklet}</td>
                        <td className="px-2 py-2"><MatchBadge row={row} chosen={choices[row.line]} /></td>
                        <td className="px-2 py-2">
                          <StudentPicker row={row} value={choices[row.line]}
                            onChange={(value) => setChoices((current) => {
                              const next = { ...current };
                              if (value === undefined || (value === row.studentUserId && row.matchStatus === 'matched')) delete next[row.line];
                              else next[row.line] = value;
                              return next;
                            })} />
                        </td>
                        {subjects.map((subject) => {
                          const score = row.scores.find((item) => item.subject === subject.name);
                          return (
                            <td key={subject.name} className="px-2 py-2 tabular-nums">
                              {score ? <><span className="text-emerald-700 dark:text-emerald-400">{score.correct}</span>/<span className="text-rose-700 dark:text-rose-400">{score.wrong}</span>/<span className="text-muted-foreground">{score.blank}</span>{` · ${net(score.net)}`}</> : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void runImport()} disabled={busy || !preview || willImport === 0}>
            <FileUp className="mr-2 h-4 w-4" />{`${willImport} öğrenciyi aktar`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsDialog({ exam, onClose }: { exam: OpticalExamSummaryDto | null; onClose: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<OpticalExamResultsDto | null>(null);
  useEffect(() => {
    setData(null);
    if (!exam) return;
    fetchOpticalResults(exam.id)
      .then(setData)
      .catch((error) => toast({ title: 'Sonuçlar yüklenemedi', description: errorMessage(error), variant: 'destructive' }));
  }, [exam, toast]);

  return (
    <Dialog open={Boolean(exam)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam?.title ?? ''}</DialogTitle>
          <DialogDescription>Öğrenci netleri (D/Y/B). Konu bazlı sonuçlar Öğrenci Konu Analizi sayfasında.</DialogDescription>
        </DialogHeader>
        {!data ? <PageLoading /> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Öğrenci</th>
                  {data.subjects.map((subject) => <th key={subject} className="px-3 py-2">{subject}</th>)}
                  <th className="px-3 py-2">Toplam net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row, index) => (
                  <tr key={row.studentUserId}>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2"><p className="font-medium">{row.fullName}</p><p className="text-xs text-muted-foreground">{`${row.className} • ${row.booklet}`}</p></td>
                    {row.scores.map((score) => (
                      <td key={score.subject} className="px-3 py-2 tabular-nums">
                        <span className="font-semibold">{net(score.net)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{`${score.correct}/${score.wrong}/${score.blank}`}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2 font-bold tabular-nums">{net(row.totalNet)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-foreground/[0.03] text-xs">
                <tr>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-semibold">Ortalama</td>
                  {data.averages.map((score) => <td key={score.subject} className="px-3 py-2 tabular-nums">{net(score.net)}</td>)}
                  <td className="px-3 py-2 font-semibold tabular-nums">{net(data.averages.reduce((sum, item) => sum + item.net, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
