import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { fetchAssistantReportExcel, fetchAssistantReportPdf } from '../../lib/api/modules';
import { errorMessage, isRecord } from '../../lib/errors';
import { downloadFileBlob } from '../../lib/financeDocuments';

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);
const str = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const SERIES_COLORS = ['hsl(var(--brand-accent))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-5))'];
const TONE_TEXT: Record<string, string> = { warn: 'text-amber-600 dark:text-amber-400', good: 'text-emerald-600 dark:text-emerald-400' };

function cell(value: unknown, english: boolean): string {
  if (typeof value === 'number') return value.toLocaleString(english ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 });
  if (value === null || value === undefined || value === '') return '–';
  return str(value);
}

/**
 * Asistanın analiz/rapor kartı: metrikler, grafik, tablo, bölümler ve notlar. Bütün değerler
 * sunucuda hesaplanır; kart yalnız gösterir. PDF ve Excel aynı veriden sunucuda üretilir.
 */
export default function AssistantReportCard({ messageId, data, english }: { messageId: string; data: unknown; english: boolean }) {
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');
  const t = (tr: string, en: string) => (english ? en : tr);

  const metrics = list(field(data, 'metrics'));
  const columns = list(field(data, 'columns'));
  const rows = list(field(data, 'rows'));
  const sections = list(field(data, 'sections'));
  const notes = list(field(data, 'notes'));
  const chart = field(data, 'chart');
  const chartX = str(field(chart, 'x'));
  const series = list(field(chart, 'series'));
  const chartRows = rows.map((row) => {
    const point: Record<string, string | number | null> = { name: str(field(row, chartX)) };
    series.forEach((item) => {
      const key = str(field(item, 'key'));
      const value = field(row, key);
      point[key] = typeof value === 'number' ? value : null;
    });
    return point;
  });
  const showChart = isRecord(chart) && series.length > 0 && chartRows.length > 1;

  const download = async (kind: 'pdf' | 'xlsx') => {
    setDownloading(kind);
    setError('');
    try {
      const blob = kind === 'pdf' ? await fetchAssistantReportPdf(messageId) : await fetchAssistantReportExcel(messageId);
      if (blob) downloadFileBlob(`${str(field(data, 'title')) || 'rapor'}.${kind}`, blob);
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-2.5 rounded-xl border p-3" data-testid="assistant-report">
      <div>
        <p className="text-sm font-semibold">{str(field(data, 'title'))}</p>
        {str(field(data, 'subtitle')) ? <p className="text-[11px] text-muted-foreground">{str(field(data, 'subtitle'))}</p> : null}
      </div>

      {metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {metrics.map((metric) => (
            <div key={str(field(metric, 'label'))} className="rounded-lg bg-foreground/[0.05] px-2.5 py-1.5">
              <p className="truncate text-[10px] text-muted-foreground">{str(field(metric, 'label'))}</p>
              <p className={`text-sm font-bold tabular-nums ${TONE_TEXT[str(field(metric, 'tone'))] ?? ''}`}>{str(field(metric, 'value'))}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showChart ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            {str(field(chart, 'kind')) === 'line' ? (
              <LineChart data={chartRows} margin={{ left: -18, right: 6, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <ChartTooltip />
                {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 10 }} /> : null}
                {series.map((item, index) => (
                  <Line key={str(field(item, 'key'))} type="monotone" dataKey={str(field(item, 'key'))} name={str(field(item, 'label'))}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartRows} margin={{ left: -18, right: 6, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                <ChartTooltip />
                {series.map((item, index) => (
                  <Bar key={str(field(item, 'key'))} dataKey={str(field(item, 'key'))} name={str(field(item, 'label'))}
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : null}

      {columns.length > 0 && rows.length > 0 ? (
        <div className="max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {columns.map((column) => (
                  <th key={str(field(column, 'key'))} className={`px-2 py-1.5 font-semibold ${str(field(column, 'align')) === 'right' ? 'text-right' : 'text-left'}`}>{str(field(column, 'label'))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${str(field(row, columns.length > 1 ? str(field(columns[1], 'key')) : 'rank'))}-${index}`} className="border-t">
                  {columns.map((column) => {
                    const key = str(field(column, 'key'));
                    return <td key={key} className={`px-2 py-1 ${str(field(column, 'align')) === 'right' ? 'text-right tabular-nums' : ''}`}>{cell(field(row, key), english)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {sections.map((section) => (
        <div key={str(field(section, 'title'))}>
          <p className="text-xs font-semibold text-brand-primary">{str(field(section, 'title'))}</p>
          <ul className="mt-0.5 space-y-0.5 text-xs">
            {list(field(section, 'lines')).map((line) => <li key={str(line)} className="text-muted-foreground">• {str(line)}</li>)}
          </ul>
        </div>
      ))}

      {notes.map((note) => <p key={str(note)} className="text-[10px] text-muted-foreground">{str(note)}</p>)}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void download('pdf')} disabled={downloading !== null}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-brand-primary hover:text-brand-primary disabled:opacity-60">
          {downloading === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {t('PDF indir', 'Download PDF')}
        </button>
        {rows.length > 0 ? (
          <button type="button" onClick={() => void download('xlsx')} disabled={downloading !== null}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-brand-primary hover:text-brand-primary disabled:opacity-60">
            {downloading === 'xlsx' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
            {t('Excel indir', 'Download Excel')}
          </button>
        ) : null}
        {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
