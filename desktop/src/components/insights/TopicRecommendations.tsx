import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Trophy } from 'lucide-react';
import { fetchStudentInsight } from '../../lib/api/modules';
import { diagnosisOf, formatPct, questionPlan, topicReason } from '../../lib/insights';
import type { StudentInsightDto } from '../../types/api/generated';

/**
 * Rapor sayfalarındaki "konu analizi ve öneriler" paneli. Personel öğrenci kimliğiyle
 * çağırır (veriyi kendisi çeker); öğrenci ve veli sayfaları hazır veriyi verir. Yalnız
 * deterministik teşhis ve sabit öneriler gösterilir. Yetki/modül yoksa sessizce gizlenir.
 */
export function TopicRecommendations({ studentUserId, data: given, title, who, detailHref, maxTopics = 4 }: {
  studentUserId?: string;
  /** Başlığın yanında ayrı gösterilen ad (çeviri katmanı adı çevirmeye çalışmasın diye ayrı). */
  who?: string;
  data?: StudentInsightDto | null;
  title?: string;
  detailHref?: string;
  maxTopics?: number;
}) {
  const [loaded, setLoaded] = useState<StudentInsightDto | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (given !== undefined || !studentUserId) return;
    let cancelled = false;
    setLoaded(null);
    setHidden(false);
    fetchStudentInsight(studentUserId)
      .then((response) => { if (!cancelled) setLoaded(response); })
      .catch(() => { if (!cancelled) setHidden(true); });
    return () => { cancelled = true; };
  }, [given, studentUserId]);

  const data = given !== undefined ? given : loaded;
  if (hidden || (given === undefined && !data)) return null;

  return (
    <section className="rounded-2xl border bg-card p-4" data-testid="topic-recommendations">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 font-bold">
          <Brain className="h-4 w-4 text-cyan-600" />
          <span>{title ?? 'Konu analizi ve öneriler'}</span>
          {who ? <span className="font-normal text-muted-foreground">{who}</span> : null}
        </h3>
        {detailHref ? (
          <Link to={detailHref} className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline">
            Ayrıntılı analiz<ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>

      {!data || data.solved === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Henüz konu bilgisi taşıyan soru çözülmedi. Online sınav, soru bankası ya da optik deneme sonuçları geldikçe öneriler burada görünür.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{`${data.solved} soru • başarı ${formatPct(data.successRate)}`}</p>
          {data.weakTopics.length === 0 ? (
            <p className="mt-3 text-sm">Belirgin bir zayıf konu yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.weakTopics.slice(0, maxTopics).map((topic) => {
                const diagnosis = diagnosisOf(topic.diagnosis);
                const plan = questionPlan(topic.suggestedQuestions);
                return (
                  <li key={`${topic.subject}-${topic.topic}`} className="rounded-xl border p-3" data-testid="weak-topic">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        {topic.priority ? <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary px-1.5 text-[11px] font-bold text-white" title="Öncelik sırası">{topic.priority}</span> : null}
                        <div className="min-w-0">
                          <p className="font-semibold">{topic.topic}</p>
                          <p className="text-xs text-muted-foreground">{topic.subject}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${diagnosis.tone}`}>{diagnosis.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm">{diagnosis.advice}</p>
                    {plan ? <p className="mt-1 text-sm font-medium">{plan}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">{`Neden: ${topicReason(topic)}`}</p>
                  </li>
                );
              })}
              {data.weakTopics.length > maxTopics ? (
                <li className="text-xs text-muted-foreground">{`+${data.weakTopics.length - maxTopics} konu daha`}</li>
              ) : null}
            </ul>
          )}
          {data.strongTopics.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">Güçlü konular:</span>
              {data.strongTopics.slice(0, 5).map((topic) => (
                <span key={`${topic.subject}-${topic.topic}`} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">{topic.topic}</span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
