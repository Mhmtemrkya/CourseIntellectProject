import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpenCheck, Brain, Check, Info, Minus, Pencil, RefreshCw, Sparkles, Target, ThumbsDown, TrendingDown, Trophy, Users, Lightbulb, History,
} from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import {
  fetchClassInsight, fetchInsightOverview, fetchStudentInsight, requestInsightNote, reviewInsightNote,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import { classActionOf, diagnosisOf, followupStatusOf, formatPct, questionPlan, topicReason } from '../../lib/insights';
import type {
  ClassActionDto, ClassInsightDto, FollowupSummaryDto, InsightNoteDto, RecommendationFollowupDto, InsightOverviewDto, StudentInsightDto, TopicInsightDto,
} from '../../types/api/generated';
import { useAssistantFocus } from '../../lib/assistantFocus';

const pct = formatPct;

function successTone(value: number) {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function SuccessBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10">
        <div className={`h-full rounded-full ${successTone(value)}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums">{pct(value)}</span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <ArrowUpRight className="h-4 w-4 text-emerald-600" aria-label="Yükselişte" />;
  if (trend === 'down') return <ArrowDownRight className="h-4 w-4 text-rose-600" aria-label="Düşüşte" />;
  if (trend === 'flat') return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Sabit" />;
  return <span className="text-xs text-muted-foreground">—</span>;
}

/**
 * Öğrenci konu analizi: hangi öğrenci hangi konuda zorlanıyor. Sayılar ve teşhis
 * deterministik; öğretmen notu yapay zekâ açıksa modelden, değilse şablondan gelir ve
 * öğretmen onaylar/düzeltir (düzeltilen notlar kurumun kendi modelinin eğitim verisidir).
 */
export default function StudentInsightsPage() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<InsightOverviewDto | null>(null);
  const [className, setClassName] = useState('');
  const [data, setData] = useState<ClassInsightDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    fetchInsightOverview()
      .then((response) => {
        setOverview(response);
        const first = response?.classes[0]?.className;
        if (first) setClassName(first);
      })
      .catch((error) => toast({ title: 'Analiz yüklenemedi', description: errorMessage(error), variant: 'destructive' }));
  }, [toast]);

  const loadClass = useCallback(async () => {
    if (!className) return;
    setLoading(true);
    try {
      setData(await fetchClassInsight(className));
    } catch (error) {
      toast({ title: 'Sınıf analizi yüklenemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [className, toast]);

  useEffect(() => { void loadClass(); }, [loadClass]);

  if (!overview) return <PageLoading />;
  const struggling = data?.topics.filter((item) => item.strugglingStudentCount > 0) ?? [];

  return (
    <Page testId="student-insights-page">
      <PageHeader
        title="Öğrenci Konu Analizi"
        description="Hangi öğrencinin hangi konuda zorlandığını, nedenini ve ne yapılabileceğini gösterir."
        icon={Brain}
        onRefresh={() => void loadClass()}
        refreshing={loading}
      />

      <section className="flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <p><span className="font-semibold">Veri kaynağı: </span>{overview.sources.join(', ')}</p>
          <p className="text-muted-foreground">Optik denemelerde yalnız cevap anahtarında konusu girilmiş sorular dahildir. Bir konu en az {data?.minSample ?? 5} soru çözülmeden “zayıf” sayılmaz.</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          {overview.aiEnabled ? `Yapay zekâ notu: ${overview.aiModel ?? ''}` : 'Yapay zekâ notu kapalı — şablon not'}
        </Badge>
      </section>

      {overview.classes.length === 0 ? (
        <PageNotice icon={Users} title="Sınıf bulunamadı" message="Öğrenciler sınıflara atanınca analiz burada görünür." />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label htmlFor="insight-class">Sınıf</Label>
              <select id="insight-class" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={className} onChange={(event) => setClassName(event.target.value)}>
                {overview.classes.map((item) => <option key={item.className} value={item.className}>{item.className}</option>)}
              </select>
            </div>
          </div>

          {!data ? <PageLoading /> : data.solved === 0 ? (
            <PageNotice icon={BookOpenCheck} title="Bu sınıfta henüz konu verisi yok" message="Öğrenciler online sınav ya da soru bankası çalışması yaptıkça analiz oluşur." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Aktif öğrenci" value={data.activeStudentCount} caption={`${data.studentCount} öğrenciden`} icon={Users} tone="brand" />
                <StatCard label="Çözülen soru" value={data.solved} caption="Konu bilgili cevap" icon={BookOpenCheck} tone="blue" />
                <StatCard label="Sınıf başarısı" value={Math.round(data.successRate)} caption="yüzde" icon={Trophy} tone="emerald" />
                <StatCard label="Zorlanılan konu" value={struggling.length} caption="En az bir öğrenci zayıf" icon={AlertTriangle} tone="rose" />
              </div>

              <ClassActions actions={data.actions ?? []} />
              {data.followups ? <FollowupSummary summary={data.followups} /> : null}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <section className="overflow-hidden rounded-2xl border bg-card">
                  <header className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="font-bold">Öğrenciler</h2>
                    <span className="text-xs text-muted-foreground">En çok desteğe ihtiyacı olandan başlayarak</span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Öğrenci</th>
                          <th className="px-4 py-2">Çözülen</th>
                          <th className="px-4 py-2">Başarı</th>
                          <th className="px-4 py-2">Zayıf konu</th>
                          <th className="px-4 py-2">Öncelik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.students.map((student) => (
                          <tr key={student.studentUserId} className="cursor-pointer transition hover:bg-foreground/[0.03]" onClick={() => setStudentId(student.studentUserId)}>
                            <td className="px-4 py-2.5 font-medium">{student.fullName}</td>
                            <td className="px-4 py-2.5 tabular-nums">{student.solved}</td>
                            <td className="px-4 py-2.5">{student.solved > 0 ? <SuccessBar value={student.successRate} /> : <span className="text-xs text-muted-foreground">Veri yok</span>}</td>
                            <td className="px-4 py-2.5">
                              {student.weakTopicCount > 0 ? <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">{student.weakTopicCount}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs">{student.topWeakTopic ? `${student.topWeakTopic} (${student.topWeakSubject})` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="h-fit rounded-2xl border bg-card p-4">
                  <h2 className="flex items-center gap-2 font-bold"><Target className="h-4 w-4" />Sınıfın zorlandığı konular</h2>
                  {struggling.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Belirgin bir ortak zorluk yok.</p> : (
                    <ul className="mt-3 space-y-2">
                      {struggling.slice(0, 10).map((topic) => (
                        <li key={`${topic.subject}-${topic.topic}`} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{topic.topic}</p>
                              <p className="text-xs text-muted-foreground">{topic.subject}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">{`${topic.strugglingStudentCount} öğrenci`}</Badge>
                          </div>
                          <div className="mt-2"><SuccessBar value={topic.successRate} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}

      <StudentInsightDialog studentId={studentId} aiEnabled={overview.aiEnabled} onClose={() => setStudentId(null)} />
    </Page>
  );
}

function StudentInsightDialog({ studentId, aiEnabled, onClose }: { studentId: string | null; aiEnabled: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<StudentInsightDto | null>(null);
  useAssistantFocus(data ? { id: data.studentUserId, name: data.fullName } : null);

  const load = useCallback(async () => {
    if (!studentId) return;
    try {
      setData(await fetchStudentInsight(studentId));
    } catch (error) {
      toast({ title: 'Öğrenci analizi yüklenemedi', description: errorMessage(error), variant: 'destructive' });
    }
  }, [studentId, toast]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  // Not hazırlanırken birkaç saniyede bir yenilenir.
  const pending = data?.note.status === 'pending';
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(timer);
  }, [pending, load]);

  return (
    <Dialog open={Boolean(studentId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.fullName ?? 'Öğrenci'}</DialogTitle>
          <DialogDescription>{data ? `${data.className} • ${data.solved} soru • başarı ${pct(data.successRate)}` : 'Yükleniyor…'}</DialogDescription>
        </DialogHeader>
        {!data ? <PageLoading /> : data.solved === 0 ? (
          <PageNotice icon={BookOpenCheck} title="Konu verisi yok" message="Bu öğrenci henüz online sınav ya da soru bankası çalışması yapmamış." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((subject) => (
                <div key={subject.subject} className="rounded-xl border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{subject.subject}</p>
                  <p className="font-semibold tabular-nums">{pct(subject.successRate)} <span className="text-xs font-normal text-muted-foreground">{`(${subject.solved} soru)`}</span></p>
                </div>
              ))}
            </div>

            <NoteCard note={data.note} studentId={data.studentUserId} aiEnabled={aiEnabled} hasWeak={data.weakTopics.length > 0} onChanged={load} />

            <section>
              <h3 className="mb-2 flex items-center gap-2 font-bold"><TrendingDown className="h-4 w-4 text-rose-600" />Öncelikli konular</h3>
              {data.weakTopics.length === 0 ? <p className="text-sm text-muted-foreground">Belirgin bir zayıf konu yok.</p> : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.weakTopics.map((topic) => <WeakTopicCard key={`${topic.subject}-${topic.topic}`} topic={topic} />)}
                </div>
              )}
            </section>

            {data.followups && data.followups.length > 0 ? <FollowupList followups={data.followups} /> : null}

            {data.strongTopics.length > 0 ? (
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-bold"><Trophy className="h-4 w-4 text-emerald-600" />Güçlü konular</h3>
                <div className="flex flex-wrap gap-2">
                  {data.strongTopics.map((topic) => (
                    <Badge key={`${topic.subject}-${topic.topic}`} variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {`${topic.topic} • ${pct(topic.successRate)}`}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Ders / Konu</th>
                      <th className="px-3 py-2">Doğru</th>
                      <th className="px-3 py-2">Yanlış</th>
                      <th className="px-3 py-2">Boş</th>
                      <th className="px-3 py-2">Başarı</th>
                      <th className="px-3 py-2">Sınıf</th>
                      <th className="px-3 py-2">Eğilim</th>
                      <th className="px-3 py-2">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topics.map((topic) => (
                      <tr key={`${topic.subject}-${topic.topic}`}>
                        <td className="px-3 py-2"><p className="font-medium">{topic.topic}</p><p className="text-xs text-muted-foreground">{topic.subject}</p></td>
                        <td className="px-3 py-2 tabular-nums text-emerald-700 dark:text-emerald-400">{topic.correct}</td>
                        <td className="px-3 py-2 tabular-nums text-rose-700 dark:text-rose-400">{topic.wrong}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{topic.blank}</td>
                        <td className="px-3 py-2"><SuccessBar value={topic.successRate} /></td>
                        <td className="px-3 py-2 tabular-nums text-xs">{pct(topic.classSuccessRate)}</td>
                        <td className="px-3 py-2"><TrendIcon trend={topic.trend} /></td>
                        <td className="px-3 py-2 text-xs">
                          {!topic.hasEnoughData ? <span className="text-muted-foreground">Yetersiz veri</span>
                            : topic.isWeak ? <span className="font-semibold text-rose-600">Zayıf</span>
                            : topic.isStrong ? <span className="font-semibold text-emerald-600">Güçlü</span>
                            : <span className="text-muted-foreground">Normal</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WeakTopicCard({ topic }: { topic: TopicInsightDto }) {
  const diagnosis = diagnosisOf(topic.diagnosis);
  const plan = questionPlan(topic.suggestedQuestions);
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {topic.priority ? <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary px-1.5 text-[11px] font-bold text-white" title="Öncelik sırası">{topic.priority}</span> : null}
          <div className="min-w-0">
            <p className="font-semibold">{topic.topic}</p>
            <p className="text-xs text-muted-foreground">{topic.subject}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${diagnosis.tone}`}>{diagnosis.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <SuccessBar value={topic.successRate} />
        {topic.classSuccessRate !== null && topic.classSuccessRate !== undefined ? <span>{`Sınıf ${pct(topic.classSuccessRate)}`}</span> : null}
        {topic.trend === 'down' && topic.previousSuccessRate !== null && topic.recentSuccessRate !== null
          ? <span className="text-rose-600">{`${pct(topic.previousSuccessRate)} → ${pct(topic.recentSuccessRate)}`}</span> : null}
      </div>
      <p className="mt-2 text-sm">{diagnosis.advice}</p>
      {plan ? <p className="mt-1 text-sm font-medium">{plan}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{`Neden: ${topicReason(topic)}`}</p>
    </div>
  );
}

/** Önceki önerilerin sonrası: öneri anındaki başarı → sonraki cevaplar. "İşe yaradı" denmez. */
function FollowupList({ followups }: { followups: RecommendationFollowupDto[] }) {
  return (
    <section data-testid="followups">
      <h3 className="mb-2 flex items-center gap-2 font-bold"><History className="h-4 w-4 text-sky-600" />Önceki öneriler ve sonrası</h3>
      <ul className="space-y-2">
        {followups.map((item) => {
          const status = followupStatusOf(item.status);
          const result = item.afterSuccessRate !== null && item.afterSuccessRate !== undefined
            ? `${formatPct(item.baselineSuccessRate)} → ${formatPct(item.afterSuccessRate)} (${item.afterSolved} yeni soru)`
            : item.status === 'not_practiced' ? 'Öneriden sonra bu konuda soru çözülmedi.'
              : `Ölçüm için en az 5 yeni soru gerekiyor (şu an ${item.afterSolved}).`;
          return (
            <li key={`${item.subject}-${item.topic}-${item.issuedAtUtc}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{item.topic}</p>
                <p className="text-xs text-muted-foreground">{`${item.subject} • öneri: ${new Date(item.issuedAtUtc).toLocaleDateString('tr-TR')} • ${result}`}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Sınıfta son 8 haftanın öneri sonuçları (sayım). */
function FollowupSummary({ summary }: { summary: FollowupSummaryDto }) {
  const measured = summary.improved + summary.steady + summary.declined;
  if (measured + summary.pending + summary.notPracticed === 0) return null;
  return (
    <p className="rounded-xl border bg-card px-4 py-2.5 text-sm" data-testid="followup-summary">
      <span className="font-semibold">Son 8 haftadaki öneriler: </span>
      {`${summary.improved} konuda ilerleme, ${summary.steady} konuda belirgin değişim yok, ${summary.declined} konuda düşüş`}
      <span className="text-muted-foreground">{` • ${summary.pending} ölçülüyor, ${summary.notPracticed} çalışılmadı`}</span>
    </p>
  );
}

/** Öğretmene sınıf düzeyinde öneriler: sınıf tekrarı ve etüt grupları (adlar yalnız personele gelir). */
function ClassActions({ actions }: { actions: ClassActionDto[] }) {
  return (
    <section className="rounded-2xl border bg-card p-4" data-testid="class-actions">
      <h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-4 w-4 text-amber-500" />Sınıf için öneriler</h2>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sınıf düzeyinde öneri için yeterli ortak zorluk yok; öneriler öğrenci bazında aşağıda.</p>
      ) : (
        <ul className="mt-3 grid gap-2 lg:grid-cols-2">
          {actions.map((action) => {
            const meta = classActionOf(action.kind);
            const plan = questionPlan(action.suggestedQuestions);
            return (
              <li key={`${action.kind}-${action.subject}-${action.topic}`} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{action.topic}</p>
                    <p className="text-xs text-muted-foreground">{action.subject}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                </div>
                <p className="mt-1.5 text-sm">{meta.advice}</p>
                {action.studentNames.length > 0 ? <p className="mt-1 text-sm font-medium">{action.studentNames.join(', ')}</p> : null}
                {plan ? <p className="mt-1 text-sm">{plan.replace('Bu hafta', action.kind === 'class_review' ? 'Derste ve ödevde' : 'Etütte')}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{`Neden: konuda soru çözen ${action.studentCount} öğrenciden ${action.strugglingStudentCount} öğrenci zorlanıyor • sınıf başarısı ${formatPct(action.successRate)}`}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NoteCard({ note, studentId, aiEnabled, hasWeak, onChanged }: {
  note: InsightNoteDto; studentId: string; aiEnabled: boolean; hasWeak: boolean; onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const generate = async () => {
    setBusy(true);
    try {
      await requestInsightNote(studentId);
      await onChanged();
    } catch (error) {
      toast({ title: 'Not oluşturulamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const review = async (action: 'approve' | 'edit' | 'reject') => {
    if (!note.id) return;
    setBusy(true);
    try {
      await reviewInsightNote(note.id, { action, editedText: action === 'edit' ? draft : null });
      setEditing(false);
      toast({ title: action === 'reject' ? 'Not reddedildi' : 'Değerlendirme kaydedildi' });
      await onChanged();
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const ready = note.status === 'ready' && note.text;
  return (
    <section className="rounded-2xl border border-brand-primary/30 bg-brand-primary/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-brand-primary" />Öğretmen notu</h3>
        <div className="flex flex-wrap items-center gap-2">
          {ready ? (
            <Badge variant="outline">{note.source === 'llm' ? `Yapay zekâ • ${note.model ?? ''}` : 'Şablon'}</Badge>
          ) : null}
          {note.reviewStatus === 'Approved' ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Onaylandı</Badge> : null}
          {note.reviewStatus === 'Edited' ? <Badge variant="outline" className="border-blue-500/40 text-blue-700 dark:text-blue-300">Öğretmen düzeltti</Badge> : null}
          {note.reviewStatus === 'Rejected' ? <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">Reddedildi</Badge> : null}
          {(!ready || !note.isCurrent) && note.status !== 'pending' ? (
            <Button size="sm" onClick={() => void generate()} disabled={busy}>
              <RefreshCw className={`mr-1 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {ready ? 'Veri değişti — yenile' : 'Not oluştur'}
            </Button>
          ) : null}
        </div>
      </div>

      {note.status === 'pending' ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Not hazırlanıyor…</p>
      ) : ready && !editing ? (
        <>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{note.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void review('approve')} disabled={busy}><Check className="mr-1 h-4 w-4" />Doğru</Button>
            <Button size="sm" variant="outline" onClick={() => { setDraft(note.text ?? ''); setEditing(true); }} disabled={busy}><Pencil className="mr-1 h-4 w-4" />Düzelt</Button>
            <Button size="sm" variant="ghost" onClick={() => void review('reject')} disabled={busy}><ThumbsDown className="mr-1 h-4 w-4" />Yanlış</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Değerlendirmeniz, kurumunuza özel öneri modelini eğitmek için kullanılır.</p>
        </>
      ) : ready && editing ? (
        <div className="mt-3 space-y-2">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} maxLength={2000} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void review('edit')} disabled={busy || draft.trim().length < 20}>Kaydet</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Vazgeç</Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {hasWeak
            ? (aiEnabled ? 'Konu analizinden öğretmen için kısa bir not oluşturulabilir.' : 'Yapay zekâ kapalı; not, konu analizinden şablonla oluşturulur.')
            : 'Belirgin bir zayıf konu yok; not güçlü konuları özetler.'}
        </p>
      )}
    </section>
  );
}
