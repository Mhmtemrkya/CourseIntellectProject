import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, HelpCircle, Info, MessageSquareWarning, ThumbsDown } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { fetchAssistantUnanswered } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import type { AssistantUnansweredDto } from '../../types/api/generated';

const UNKNOWN_REASON = { label: 'Anlaşılmadı', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' };

const REASONS: Record<string, { label: string; tone: string }> = {
  unknown: UNKNOWN_REASON,
  no_guide: { label: 'Rehber yok', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  negative: { label: 'İşe yaramadı', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  out_of_scope: { label: 'Kapsam dışı', tone: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
};

const PORTALS: Record<string, string> = {
  admin: 'Yönetim',
  administrative: 'İdari',
  accounting: 'Muhasebe',
  teacher: 'Öğretmen',
  parent: 'Veli',
  student: 'Öğrenci',
};

const RANGES = [7, 30, 90];

/**
 * Asistanın cevaplayamadığı, "nasıl yapılır" rehberi olmayan ya da kullanıcının "işe yaramadı"
 * dediği sorular. Eksik kalıpları görmek içindir; soranın adı gösterilmez, yalnız portalı.
 */
export default function AssistantQuestions() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<AssistantUnansweredDto[] | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows((await fetchAssistantUnanswered(days)) ?? []);
    } catch (loadError) {
      setError(errorMessage(loadError));
      setRows([]);
    }
  }, [days]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { unknown: 0, no_guide: 0, negative: 0, out_of_scope: 0 };
    (rows ?? []).forEach((row) => { result[row.reason] = (result[row.reason] ?? 0) + 1; });
    return result;
  }, [rows]);

  const shown = (rows ?? []).filter((row) => !reason || row.reason === reason);

  return (
    <Page testId="assistant-questions-page">
      <PageHeader
        title="Maydi Soruları"
        description="Maydi'nin cevaplayamadığı ya da yetersiz bulunan sorular. Sık tekrar edenler yeni yetenek ve rehber adayıdır."
        icon={MessageSquareWarning}
        onRefresh={() => void load()}
        refreshing={rows === null}
      />

      <section className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <p className="text-muted-foreground">Soranın kimliği gösterilmez; yalnız hangi portaldan sorulduğu görünür. Liste kurumunuzla (şube yöneticisinde kendi şubesiyle) sınırlıdır.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Anlaşılmayan" value={counts.unknown} icon={HelpCircle} />
        <StatCard label="Rehberi olmayan" value={counts.no_guide} icon={Info} />
        <StatCard label="İşe yaramadı" value={counts.negative} icon={ThumbsDown} />
        <StatCard label="Kapsam dışı" value={counts.out_of_scope} icon={Ban} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((range) => (
          <button key={range} type="button" onClick={() => setDays(range)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${days === range ? 'border-brand-primary bg-brand-primary text-white' : 'bg-background hover:border-brand-primary'}`}>
            {`Son ${range} gün`}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" onClick={() => setReason(null)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reason === null ? 'border-brand-primary text-brand-primary' : ''}`}>Tümü</button>
        {Object.entries(REASONS).map(([key, meta]) => (
          <button key={key} type="button" onClick={() => setReason(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reason === key ? 'border-brand-primary text-brand-primary' : ''}`}>{meta.label}</button>
        ))}
      </div>

      {error ? <PageNotice title="Liste yüklenemedi" message={error} /> : null}
      {rows === null ? <PageLoading /> : null}
      {rows !== null && shown.length === 0 && !error ? (
        <PageNotice icon={MessageSquareWarning} title="Kayıt yok" message={rows.length === 0 ? 'Bu dönemde asistanın cevaplayamadığı bir soru yok.' : 'Bu filtreye uyan kayıt yok.'} />
      ) : null}

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((row) => {
            const meta = REASONS[row.reason] ?? UNKNOWN_REASON;
            return (
              <li key={row.messageId} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-semibold">{`“${row.question}”`}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline">{PORTALS[row.portal] ?? row.portal ?? '—'}</Badge>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{row.answer}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(row.createdAtUtc)}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Page>
  );
}
