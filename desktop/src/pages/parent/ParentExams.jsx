import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Eye,
  FileQuestion,
  Filter,
  GraduationCap,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchExamResults, fetchParentAcademic } from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../lib/format';
import {
  EmptyPanel,
  IconTile,
  LineChart,
  PageHeader,
  Panel,
  RadarChart,
  SmallButton,
  StatCard,
  StatusPill,
  decodeText,
  initials,
  itemMotion,
  normalizeText,
  pageMotion,
  safeNumber,
} from './parentPremiumUi';

function examTitle(exam) {
  return decodeText(exam.examTitle || exam.title || 'Sınav');
}

function examDate(exam) {
  if (exam.dateLabel) return decodeText(exam.dateLabel);
  const value = exam.createdAt || exam.date;
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? decodeText(value) : formatDate(parsed);
}

function resultStatus(score) {
  if (score >= 70) return ['Başarılı', 'green'];
  if (score >= 55) return ['Geliştirilmeli', 'orange'];
  return ['Riskli', 'red'];
}

function formatNet(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '0';
}

export default function ParentExams() {
  const { user } = useApp();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [results, setResults] = useState([]);
  const [activeType, setActiveType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadForChild = useCallback(async (childName) => {
    if (!childName) {
      setResults([]);
      return;
    }
    const examList = await fetchExamResults({ studentName: childName });
    setResults(Array.isArray(examList) ? examList : []);
  }, []);

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const academicChildren = await fetchParentAcademic().catch(() => []);
      const linkedChildren = (Array.isArray(academicChildren) ? academicChildren : []).map((child) => ({
        id: child.studentName,
        fullName: child.studentName,
        className: child.className || '',
      }));
      setChildren(linkedChildren);
      const nextChild = selectedChild || linkedChildren[0]?.fullName || '';
      setSelectedChild(nextChild);
      if (nextChild) {
        await loadForChild(nextChild);
      } else {
        const examList = await fetchExamResults();
        setResults(Array.isArray(examList) ? examList : []);
      }
    } catch (err) {
      setError(err.message || 'Sınav sonuçları alınamadı.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [loadForChild, selectedChild, user]);

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.username, user?.email]);

  useEffect(() => {
    if (!selectedChild || loading) return;
    loadForChild(selectedChild).catch(() => setResults([]));
  }, [loadForChild, loading, selectedChild]);

  const selectedChildInfo = useMemo(() => {
    return children.find((child) => child.fullName === selectedChild) || children[0] || null;
  }, [children, selectedChild]);

  const normalizedResults = useMemo(() => results.map((exam, index) => {
    const score = safeNumber(exam.score);
    const subject = decodeText(exam.subject || 'Ders');
    return {
      ...exam,
      _key: exam.id || `${subject}-${examTitle(exam)}-${index}`,
      _title: examTitle(exam),
      _type: decodeText(exam.type || 'Yazılı Sınav'),
      _subject: subject,
      _date: examDate(exam),
      _score: score,
      _net: Number(exam.net || 0),
      _classRank: exam.classRank,
      _overallRank: exam.overallRank,
      _className: decodeText(exam.className || selectedChildInfo?.className || '-'),
      _studentName: decodeText(exam.studentName || selectedChild || '-'),
    };
  }), [results, selectedChild, selectedChildInfo?.className]);

  const stats = useMemo(() => {
    const scores = normalizedResults.map((item) => item._score).filter((value) => value > 0);
    const avgScore = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : 0;
    return {
      avgScore,
      examCount: normalizedResults.length,
      topScore: scores.length ? Math.max(...scores) : 0,
      lowScore: scores.length ? Math.min(...scores) : 0,
    };
  }, [normalizedResults]);

  const subjectStats = useMemo(() => {
    const map = new Map();
    normalizedResults.forEach((item) => {
      if (!map.has(item._subject)) map.set(item._subject, []);
      map.get(item._subject).push(item._score);
    });
    return Array.from(map.entries()).map(([subject, scores]) => {
      const average = scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
      return {
        label: subject,
        value: Math.round(average * 10) / 10,
        reference: Math.max(0, Math.min(100, Math.round((stats.avgScore || average) * 10) / 10)),
      };
    }).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [normalizedResults, stats.avgScore]);

  const typeFiltered = useMemo(() => {
    if (activeType === 'all') return normalizedResults;
    return normalizedResults.filter((item) => normalizeText(item._type).includes(activeType) || normalizeText(item._title).includes(activeType));
  }, [activeType, normalizedResults]);

  const trendValues = normalizedResults.slice().reverse().slice(-6).map((item) => item._score);
  const trendLabels = trendValues.map((_, index) => `${index + 1}. Sınav`);
  const trendDelta = trendValues.length > 1 ? Math.round((trendValues.at(-1) - trendValues[0]) * 10) / 10 : 0;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={pageMotion} initial="hidden" animate="visible" className="space-y-5 text-slate-100" data-testid="parent-exams-page">
      <PageHeader
        userName={user?.name}
        title="Sınav Sonuçları"
        description={`${selectedChild || 'Çocuğunuz'} için sınav sonuçlarını buradan detaylı olarak inceleyebilirsiniz.`}
        icon={<IconTile icon={TrendingUp} tone="purple" className="h-14 w-14" />}
        actions={(
          <>
            <select className="h-11 min-w-[190px] rounded-[10px] border border-foreground/[0.08] bg-[hsl(var(--ci-card))] px-4 text-sm font-semibold text-foreground outline-none" value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>
              {children.length === 0 ? <option value="">Çocuk bulunamadı</option> : null}
              {children.map((child) => (
                <option key={child.id || child.fullName} value={child.fullName}>{decodeText(child.fullName)}</option>
              ))}
            </select>
            <SmallButton><Filter className="mr-2 h-4 w-4" />Filtrele</SmallButton>
          </>
        )}
      />

      {error ? <ErrorBanner title="Sonuçlar alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr_1fr_1fr]">
        <motion.div variants={itemMotion} className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.035] p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--brand-accent))] text-xl font-black text-white">
              {initials(selectedChild)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">{decodeText(selectedChild || 'Öğrenci seçilmedi')}</p>
              <p className="mt-1 text-sm text-slate-400">{decodeText(selectedChildInfo?.className || '-')}</p>
            </div>
          </div>
        </motion.div>
        <StatCard icon={CalendarDays} tone="green" label="Ortalama Puan" value={stats.avgScore} sub="Genel ortalama" />
        <StatCard icon={Trophy} tone="blue" label="En Yüksek Puan" value={stats.topScore} sub={normalizedResults.find((item) => item._score === stats.topScore)?._subject || '-'} />
        <StatCard icon={FileQuestion} tone="orange" label="En Düşük Puan" value={stats.lowScore} sub={normalizedResults.find((item) => item._score === stats.lowScore)?._subject || '-'} />
      </div>

      <Panel title="Derslere Göre Başarı Dağılımı">
        {subjectStats.length ? (
          <>
            <div className="mb-3 flex justify-end gap-5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-purple-400" />Ortalama Puan</span>
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-slate-400" />Genel Ortalama</span>
            </div>
            <RadarChart items={subjectStats} />
          </>
        ) : <EmptyPanel title="Sınav sonucu yok" description="Bu öğrenci için henüz sınav sonucu girilmemiş." />}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Panel title="Sınav Geçmişi">
          <div className="mb-4 flex flex-wrap gap-3 border-b border-foreground/[0.08] pb-3">
            {[
              ['all', 'Tümü'],
              ['yaz', 'Yazılı Sınavlar'],
              ['deneme', 'Deneme Sınavları'],
              ['kisa', 'Kısa Sınavlar'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setActiveType(value)} className={`rounded-[10px] px-4 py-2 text-sm font-bold transition ${activeType === value ? 'bg-purple-500/20 text-purple-200 shadow-[inset_0_-2px_0_#a855f7]' : 'text-slate-400 hover:bg-foreground/[0.04] hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          {typeFiltered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr className="border-b border-foreground/[0.08]">
                    <th className="py-3 font-semibold">Sınav Adı</th>
                    <th className="py-3 font-semibold">Ders</th>
                    <th className="py-3 font-semibold">Tarih</th>
                    <th className="py-3 font-semibold">Puan</th>
                    <th className="py-3 font-semibold">Net</th>
                    <th className="py-3 font-semibold">Sıralama</th>
                    <th className="py-3 font-semibold">Durum</th>
                    <th className="py-3 text-right font-semibold">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {typeFiltered.map((exam) => {
                    const [label, tone] = resultStatus(exam._score);
                    return (
                      <tr key={exam._key} className="border-b border-foreground/[0.06] text-slate-200">
                        <td className="py-4 font-semibold">{exam._title}</td>
                        <td className="py-4">{exam._subject}</td>
                        <td className="py-4">{exam._date}</td>
                        <td className="py-4"><b className="text-white">{exam._score}</b> /100</td>
                        <td className="py-4">{formatNet(exam._net)}</td>
                        <td className="py-4">{exam._classRank ? `${exam._classRank}. sınıf` : '-'}{exam._overallRank ? ` / ${exam._overallRank}. genel` : ''}</td>
                        <td className="py-4"><StatusPill tone={tone}>{label}</StatusPill></td>
                        <td className="py-4 text-right">
                          <Button variant="ghost" size="icon" className="rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.04] text-slate-200">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyPanel />}
        </Panel>

        <Panel title="Başarı Trendi" action={<SmallButton>6 Sınavlık Ortalama</SmallButton>}>
          {trendValues.length ? (
            <>
              <LineChart values={trendValues} labels={trendLabels} className="h-[260px]" />
              <div className="mt-3 flex items-center gap-4">
                <StatusPill tone={trendDelta >= 0 ? 'green' : 'red'}>
                  {trendDelta >= 0 ? '↑' : '↓'} %{Math.abs(trendDelta)}
                </StatusPill>
                <span className="text-sm text-slate-400">İlk sınava göre değişim</span>
              </div>
            </>
          ) : <EmptyPanel title="Trend için veri yok" description="En az bir sınav sonucu geldiğinde grafik oluşacak." />}
        </Panel>
      </div>

      <Panel title="Gelişim Odakları">
        {normalizedResults.filter((item) => item._score < 70).length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {normalizedResults.filter((item) => item._score < 70).slice(0, 6).map((exam) => (
              <div key={`weak-${exam._key}`} className="rounded-[12px] border border-orange-400/15 bg-orange-500/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <IconTile icon={Target} tone="orange" />
                  <div>
                    <p className="font-black text-white">{exam._subject}</p>
                    <p className="text-xs text-slate-400">{exam._title}</p>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-foreground/[0.08]">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, exam._score)}%` }} />
                </div>
                <p className="mt-2 text-sm font-black text-orange-300">{exam._score} puan</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[12px] border border-emerald-400/15 bg-emerald-500/[0.06] p-4">
            <IconTile icon={GraduationCap} tone="green" />
            <div>
              <p className="font-black text-white">Riskli sınav sonucu görünmüyor</p>
              <p className="text-sm text-slate-400">Canlı sonuçlar içinde 70 puan altı kayıt bulunamadı.</p>
            </div>
          </div>
        )}
      </Panel>
    </motion.div>
  );
}
