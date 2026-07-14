import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, CarFront, Download, FileText, GraduationCap, Lock, Users, XCircle,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import { downloadDrivingReport, fetchDrivingReport } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const REPORTS = [
  ['instructors', 'Eğitmen', Users, 'brand'],
  ['vehicles', 'Araç & Filo', CarFront, 'cyan'],
  ['cancellations', 'İptal & Devamsızlık', XCircle, 'rose'],
  ['students', 'Kursiyer & Sınav', GraduationCap, 'violet'],
];

// Her raporda grafiğe taşınacak sütun: [etiket sütunu, değer sütunu].
const CHART_COLUMN = {
  instructors: [0, 5],
  vehicles: [0, 3],
  cancellations: null,
  students: [0, 3],
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};

export default function DrivingReports() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [active, setActive] = useState('instructors');
  const [range, setRange] = useState({ from: daysAgo(30), to: today() });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const canView = can(DRIVING.reportView);
  const canExport = can(DRIVING.reportExport);

  const params = useMemo(() => {
    const to = new Date(`${range.to}T00:00:00`);
    to.setDate(to.getDate() + 1);
    return { from: new Date(`${range.from}T00:00:00`).toISOString(), to: to.toISOString() };
  }, [range.from, range.to]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      setReport(await fetchDrivingReport(active, params));
    } catch (err) {
      setError(err.message || 'Rapor alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [active, params, canView]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  async function exportAs(format) {
    setExporting(format);
    try {
      const blob = await downloadDrivingReport(active, format, params);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${active}-raporu-${range.from}-${range.to}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: `${format.toUpperCase()} indirildi`, description: `${report?.rows?.length || 0} satır dışa aktarıldı.` });
    } catch (err) {
      toast({ title: 'Dışa aktarılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setExporting('');
    }
  }

  if (permissionsLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  if (!canView) {
    return (
      <DrivingPage>
        <DrivingPageHeader title="Raporlar" description="Sürücü kursu operasyon ve performans raporları" icon={BarChart3} />
        <DrivingNotice icon={Lock} title="Rapor yetkiniz yok" message="Raporları görüntülemek için kurum yöneticinizden yetki isteyin." />
      </DrivingPage>
    );
  }

  const chartSpec = CHART_COLUMN[active];
  const chartData = chartSpec && report?.rows?.length
    ? report.rows
      .map((row) => ({
        name: row[chartSpec[0]],
        value: Number(String(row[chartSpec[1]]).replace(/\./g, '').replace(',', '.')) || 0,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
    : [];

  return (
    <DrivingPage testId="driving-reports-page">
      <DrivingPageHeader
        title="Raporlar"
        description="Eğitmen, filo, iptal ve kursiyer raporları — CSV veya PDF olarak dışa aktarın."
        icon={BarChart3}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <>
            <label className="space-y-1 text-xs font-bold">
              <span>Başlangıç</span>
              <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>Bitiş</span>
              <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} />
            </label>
            {canExport ? (
              <>
                <Button variant="outline" disabled={loading || !!exporting} onClick={() => exportAs('csv')}>
                  <Download className="mr-2 h-4 w-4" />{exporting === 'csv' ? 'Hazırlanıyor…' : 'CSV'}
                </Button>
                <Button variant="outline" disabled={loading || !!exporting} onClick={() => exportAs('pdf')}>
                  <FileText className="mr-2 h-4 w-4" />{exporting === 'pdf' ? 'Hazırlanıyor…' : 'PDF'}
                </Button>
              </>
            ) : null}
          </>
        )}
      />

      {error ? <ErrorBanner title="Rapor alınamadı" message={error} onRetry={load} /> : null}

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex flex-wrap">
          {REPORTS.map(([key, label, Icon]) => (
            <TabsTrigger key={key} value={key}>
              <Icon className="mr-1.5 h-3.5 w-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {REPORTS.map(([key]) => (
          <TabsContent key={key} value={key} className="mt-5 space-y-5">
            {loading ? (
              <div className="flex min-h-[40vh] items-center justify-center"><LoadingDots /></div>
            ) : !report ? null : (
              <>
                {report.summary?.length ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                    {report.summary.map((item, index) => (
                      <DrivingStatCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        icon={REPORTS[index % REPORTS.length][2]}
                        tone={['brand', 'emerald', 'amber', 'blue', 'rose'][index % 5]}
                      />
                    ))}
                  </div>
                ) : null}

                {!report.includesFinance ? (
                  <motion.p variants={itemVariants} className="flex items-center gap-2 rounded-xl border border-dashed border-foreground/15 px-3 py-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Parasal sütunlar gizli — finans raporu yetkiniz yok.
                  </motion.p>
                ) : null}

                {chartData.length ? (
                  <motion.div variants={itemVariants}>
                    <PremiumPanel title={report.title} description={report.description}>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ left: 8, right: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground) / 0.08)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-18} textAnchor="end" height={56} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip
                              contentStyle={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 12,
                                color: 'hsl(var(--foreground))',
                              }}
                            />
                            <Bar dataKey="value" fill="hsl(var(--brand-accent))" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </PremiumPanel>
                  </motion.div>
                ) : null}

                <motion.div variants={itemVariants}>
                  <PremiumPanel title="Döküm" description={`${report.rows?.length || 0} satır`} contentClassName="p-0">
                    {!report.rows?.length ? (
                      <DrivingNotice icon={BarChart3} title="Bu tarih aralığında kayıt yok." message="Tarih aralığını genişletmeyi deneyin." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-foreground/10">
                              {report.columns.map((column) => (
                                <th
                                  key={column.header}
                                  className={`whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ${column.numeric ? 'text-right' : 'text-left'}`}
                                >
                                  {column.header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {report.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-foreground/5 transition-colors hover:bg-[hsl(var(--brand-accent)/0.05)]">
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className={`whitespace-nowrap px-4 py-3 ${report.columns[cellIndex]?.numeric ? 'text-right font-semibold tabular-nums' : ''} ${cellIndex === 0 ? 'font-semibold' : ''}`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PremiumPanel>
                </motion.div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </DrivingPage>
  );
}
