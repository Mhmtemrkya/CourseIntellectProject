import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { PageLoading } from '../../components/layout/PageKit';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { applyOpticalStudyPlans, fetchOpticalStudyPlans } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { OpticalPlanTaskDto, OpticalStudyPlanPreviewDto, OpticalStudyPlanRowDto } from '../../types/api/generated';
import { localDateKey } from '../../lib/localDate';

/** Öğretmenin düzenlediği öğrenci planı (sunucu önerisinden başlar). */
interface PlanDraft {
  selected: boolean;
  tasks: OpticalPlanTaskDto[];
  sendParent: boolean;
  parentSummary: string;
}

const MAX_TASKS = 10;
const netText = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const dayText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

function draftFor(row: OpticalStudyPlanRowDto): PlanDraft {
  return {
    // Önerisi olan ve daha önce uygulanmamış öğrenciler seçili gelir; aynı adlı öğrenci seçilemez.
    selected: row.tasks.length > 0 && !row.skipReason && !row.alreadyApplied,
    tasks: row.tasks.map((task) => ({ ...task })),
    sendParent: row.hasParent,
    parentSummary: row.parentSummary,
  };
}

const blocked = (row: OpticalStudyPlanRowDto) => Boolean(row.skipReason?.startsWith('Kurumda aynı adlı'));

/**
 * Deneme sonrası çalışma planı: her öğrenci için zayıf konulardan hazırlanan bir haftalık görev önerisi
 * ve veli özeti. Öğretmen görevleri düzenler, öğrencileri seçer ve onaylar; onaylamadan hiçbir şey yazılmaz.
 */
export function OpticalStudyPlanDialog({ examId, examTitle, onClose }: { examId: string | null; examTitle: string; onClose: () => void }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<OpticalStudyPlanPreviewDto | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreview(null);
    setDrafts({});
    setExpanded(null);
    if (!examId) return;
    let alive = true;
    fetchOpticalStudyPlans(examId)
      .then((result) => {
        if (!alive || !result) return;
        setPreview(result);
        setDrafts(Object.fromEntries(result.students.map((row) => [row.studentUserId, draftFor(row)])));
      })
      .catch((error) => {
        if (alive) toast({ title: 'Çalışma planı hazırlanamadı', description: errorMessage(error), variant: 'destructive' });
      });
    return () => { alive = false; };
  }, [examId, toast]);

  const rows = preview?.students ?? [];
  const chosen = useMemo(() => rows.filter((row) => drafts[row.studentUserId]?.selected), [rows, drafts]);
  const taskCount = chosen.reduce((sum, row) => sum + (drafts[row.studentUserId]?.tasks.length ?? 0), 0);
  const parentCount = chosen.filter((row) => row.hasParent && drafts[row.studentUserId]?.sendParent).length;

  const update = (id: string, change: (draft: PlanDraft) => PlanDraft) =>
    setDrafts((current) => {
      const draft = current[id];
      return draft ? { ...current, [id]: change(draft) } : current;
    });
  const setTask = (id: string, index: number, patch: Partial<OpticalPlanTaskDto>) =>
    update(id, (draft) => ({ ...draft, tasks: draft.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)) }));
  const removeTask = (id: string, index: number) => update(id, (draft) => ({ ...draft, tasks: draft.tasks.filter((_, i) => i !== index) }));
  const addTask = (row: OpticalStudyPlanRowDto) => update(row.studentUserId, (draft) => {
    const last = draft.tasks.at(-1);
    const base = new Date();
    base.setDate(base.getDate() + 1);
    return {
      ...draft,
      tasks: [...draft.tasks, {
        title: 'Yeni görev', subject: row.weakTopics[0]?.subject ?? last?.subject ?? '', topic: '',
        date: last?.date ?? localDateKey(base), durationMinutes: 30,
      }],
    };
  });
  const selectAll = (value: boolean) => setDrafts((current) => Object.fromEntries(rows.map((row) => {
    const draft = current[row.studentUserId] ?? draftFor(row);
    return [row.studentUserId, { ...draft, selected: value && !blocked(row) && draft.tasks.length > 0 }];
  })));

  const problems = chosen.flatMap((row) => {
    const draft = drafts[row.studentUserId];
    if (!draft) return [];
    if (draft.tasks.length === 0) return [`${row.studentName}: en az bir görev gerekli.`];
    if (draft.tasks.length > MAX_TASKS) return [`${row.studentName}: en fazla ${MAX_TASKS} görev eklenebilir.`];
    if (draft.tasks.some((task) => !task.title.trim())) return [`${row.studentName}: boş görev başlığı var.`];
    if (draft.tasks.some((task) => task.durationMinutes < 10 || task.durationMinutes > 240)) return [`${row.studentName}: görev süresi 10–240 dakika olmalı.`];
    return [];
  });

  const apply = async () => {
    if (!examId || chosen.length === 0 || problems.length > 0) return;
    setBusy(true);
    try {
      const result = await applyOpticalStudyPlans(examId, {
        students: chosen.map((row) => {
          const draft = drafts[row.studentUserId];
          return {
            studentUserId: row.studentUserId,
            tasks: draft?.tasks ?? [],
            sendParentSummary: Boolean(draft?.sendParent && row.hasParent),
            parentSummary: draft?.parentSummary ?? null,
          };
        }),
      });
      if (!result) return;
      toast({
        title: 'Çalışma planları eklendi',
        description: `${result.applied} öğrenciye ${result.tasksWritten} görev eklendi${result.parentsNotified > 0 ? `, ${result.parentsNotified} veliye özet gönderildi` : ''}.${result.skipped.length > 0 ? ` Atlanan: ${result.skipped.join(' ')}` : ''}`,
      });
      onClose();
    } catch (error) {
      toast({ title: 'Planlar eklenemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(examId)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`${examTitle} — çalışma planı`}</DialogTitle>
          <DialogDescription>
            Her öğrenci için bu denemede zorlandığı konulardan bir haftalık plan önerildi. Görevleri düzenleyin, öğrencileri seçin ve onaylayın; onaylamadan hiçbir şey kaydedilmez.
          </DialogDescription>
        </DialogHeader>

        {!preview ? <PageLoading /> : (
          <div className="space-y-3">
            {preview.message ? (
              <p role="alert" className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{preview.message}
              </p>
            ) : null}
            {!preview.studyPlanEnabled ? (
              <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                Kurumunuzun paketinde Çalışma Programı kapalı: görevler kaydedilir ama öğrenciler programı açamaz.
              </p>
            ) : null}

            {rows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Button size="sm" variant="outline" onClick={() => selectAll(true)}>Planı olanları seç</Button>
                <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>Seçimi kaldır</Button>
                <span>{`${chosen.length} öğrenci • ${taskCount} görev • ${parentCount} veliye özet`}</span>
              </div>
            ) : null}

            <ul className="space-y-2" aria-label="Öğrenci planları">
              {rows.map((row) => {
                const draft = drafts[row.studentUserId];
                if (!draft) return null;
                const open = expanded === row.studentUserId;
                const disabled = blocked(row);
                return (
                  <li key={row.studentUserId} className="rounded-xl border" data-testid="study-plan-row">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <Checkbox checked={draft.selected} disabled={disabled || draft.tasks.length === 0}
                        aria-label={`${row.studentName} planını uygula`}
                        onCheckedChange={(value) => update(row.studentUserId, (current) => ({ ...current, selected: value === true }))} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{row.studentName}<span className="ml-2 text-xs text-muted-foreground">{`${row.className} • ${netText(row.net)} net`}</span></p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.weakTopics.length > 0
                            ? row.weakTopics.map((topic) => `${topic.topic} (${topic.wrong} Y, ${topic.blank} B / ${topic.total})`).join(' • ')
                            : row.skipReason ?? 'Zayıf konu yok'}
                        </p>
                        {row.skipReason && row.weakTopics.length > 0 ? <p className="text-xs text-rose-600">{row.skipReason}</p> : null}
                        {row.alreadyApplied ? <p className="text-xs text-sky-700 dark:text-sky-300">Bu denemenin planı daha önce eklendi; yeniden eklerseniz bekleyen görevler yenisiyle değişir, tamamlananlar kalır.</p> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{`${draft.tasks.length} görev`}</span>
                      <Button size="sm" variant="ghost" aria-expanded={open} disabled={disabled}
                        onClick={() => setExpanded(open ? null : row.studentUserId)}>
                        Düzenle<ChevronDown className={`ml-1 h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>

                    {open ? (
                      <div className="space-y-3 border-t bg-muted/30 px-3 py-3">
                        <div className="space-y-1.5">
                          {draft.tasks.map((task, index) => (
                            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_90px_auto]">
                              <Input value={task.title} maxLength={120} aria-label={`${index + 1}. görev`}
                                onChange={(event) => setTask(row.studentUserId, index, { title: event.target.value })} />
                              <Input type="date" value={task.date} aria-label={`${index + 1}. görev tarihi`} title={dayText(task.date)}
                                onChange={(event) => setTask(row.studentUserId, index, { date: event.target.value })} />
                              <Input type="number" min={10} max={240} step={5} value={task.durationMinutes} aria-label={`${index + 1}. görev süresi (dk)`}
                                onChange={(event) => setTask(row.studentUserId, index, { durationMinutes: Number(event.target.value) || 0 })} />
                              <Button size="icon" variant="ghost" aria-label={`${index + 1}. görevi kaldır`} onClick={() => removeTask(row.studentUserId, index)}>
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="outline" disabled={draft.tasks.length >= MAX_TASKS} onClick={() => addTask(row)}>
                            <Plus className="mr-1 h-4 w-4" />Görev ekle
                          </Button>
                        </div>
                        {row.hasParent ? (
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox checked={draft.sendParent} onCheckedChange={(value) => update(row.studentUserId, (current) => ({ ...current, sendParent: value === true }))} />
                              Veliye özet gönder
                            </label>
                            <Textarea rows={3} maxLength={600} value={draft.parentSummary} disabled={!draft.sendParent} aria-label="Veli özeti"
                              onChange={(event) => update(row.studentUserId, (current) => ({ ...current, parentSummary: event.target.value }))} />
                            <p className="text-[11px] text-muted-foreground">Özet veliye bildirim olarak gider; aynı deneme için bir kez gönderilir.</p>
                          </div>
                        ) : <p className="text-xs text-muted-foreground">Veli hesabı bağlı değil; özet gönderilemez.</p>}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {problems.length > 0 ? (
              <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <ul className="list-disc space-y-0.5 pl-4">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void apply()} disabled={busy || chosen.length === 0 || problems.length > 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
            {`${chosen.length} öğrenciye planı ekle`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
