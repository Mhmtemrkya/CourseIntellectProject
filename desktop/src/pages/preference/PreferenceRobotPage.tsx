import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Calculator, ExternalLink, GraduationCap, Info, ListOrdered, Minus, Plus, Save, School, Search, Target,
  Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import {
  estimatePreferenceScore, fetchPreferenceChoices, fetchPreferenceMeta, savePreferenceChoices, searchPreferencePrograms,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  PreferenceEstimateDto, PreferenceMatchDto, PreferenceMetaDto, PreferenceNetInput, PreferenceSearchResultDto,
} from '../../types/api/generated';

type Exam = 'YKS' | 'LGS';
type NetKey = Exclude<keyof PreferenceNetInput, 'exam' | 'diplomaGrade'>;

interface NetField { key: NetKey; label: string; max: number }

const TYT_FIELDS: NetField[] = [
  { key: 'turkish', label: 'Türkçe', max: 40 },
  { key: 'social', label: 'Sosyal Bilimler', max: 20 },
  { key: 'math', label: 'Temel Matematik', max: 40 },
  { key: 'science', label: 'Fen Bilimleri', max: 20 },
];

const AYT_FIELDS: NetField[] = [
  { key: 'aytMath', label: 'AYT Matematik', max: 40 },
  { key: 'physics', label: 'Fizik', max: 14 },
  { key: 'chemistry', label: 'Kimya', max: 13 },
  { key: 'biology', label: 'Biyoloji', max: 13 },
  { key: 'literature', label: 'Edebiyat', max: 24 },
  { key: 'history1', label: 'Tarih-1', max: 10 },
  { key: 'geography1', label: 'Coğrafya-1', max: 6 },
  { key: 'history2', label: 'Tarih-2', max: 11 },
  { key: 'geography2', label: 'Coğrafya-2', max: 11 },
  { key: 'philosophy', label: 'Felsefe Grubu', max: 12 },
  { key: 'religion', label: 'Din Kültürü', max: 6 },
  { key: 'foreignLanguage', label: 'Yabancı Dil (YDT)', max: 80 },
];

const LGS_FIELDS: NetField[] = [
  { key: 'turkish', label: 'Türkçe', max: 20 },
  { key: 'math', label: 'Matematik', max: 20 },
  { key: 'science', label: 'Fen Bilimleri', max: 20 },
  { key: 'revolution', label: 'T.C. İnkılap Tarihi', max: 10 },
  { key: 'religion', label: 'Din Kültürü', max: 10 },
  { key: 'foreignLanguage', label: 'Yabancı Dil', max: 10 },
];

const SCORE_TYPES = ['SAY', 'EA', 'SÖZ', 'DİL', 'TYT'];

const BANDS: Array<{ key: string; label: string; hint: string; tone: string }> = [
  { key: 'Target', label: 'Hedef', hint: 'Puanın taban puana yakın', tone: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { key: 'Reach', label: 'Zorlayıcı', hint: 'Taban puanın biraz altındasın', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { key: 'Safe', label: 'Rahat', hint: 'Taban puanın belirgin üstündesin', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
];

const fmt = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * LGS/YKS tercih robotu. Öğrenci (canSave) tercih listesini kaydeder; diğer roller
 * robotu öğrenciyle birlikte danışmanlık için kullanır.
 */
export default function PreferenceRobotPage({ canSave = false }: { canSave?: boolean }) {
  const { toast } = useToast();
  const [meta, setMeta] = useState<PreferenceMetaDto | null>(null);
  const [exam, setExam] = useState<Exam>('YKS');
  const [mode, setMode] = useState<'score' | 'nets'>('score');
  const [scoreType, setScoreType] = useState('SAY');
  const [score, setScore] = useState('');
  const [nets, setNets] = useState<Partial<Record<NetKey, string>>>({});
  const [diploma, setDiploma] = useState('');
  const [estimate, setEstimate] = useState<PreferenceEstimateDto | null>(null);
  const [filters, setFilters] = useState({ city: '', institutionType: '', level: '', query: '' });
  const [result, setResult] = useState<PreferenceSearchResultDto | null>(null);
  const [band, setBand] = useState('Target');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<PreferenceMatchDto[]>([]);
  const [choicesDirty, setChoicesDirty] = useState(false);

  const maxChoices = exam === 'LGS' ? 5 : 24;

  useEffect(() => {
    fetchPreferenceMeta(exam).then(setMeta).catch((error) => toast({ title: 'Tercih robotu verisi alınamadı', description: errorMessage(error), variant: 'destructive' }));
  }, [exam, toast]);

  const loadChoices = useCallback(async () => {
    if (!canSave) return;
    try {
      const list = await fetchPreferenceChoices(exam);
      setChoices((list ?? []).map((item) => item.program).filter((item): item is PreferenceMatchDto => Boolean(item)));
      setChoicesDirty(false);
    } catch {
      setChoices([]);
    }
  }, [canSave, exam]);

  useEffect(() => { void loadChoices(); }, [loadChoices]);

  const switchExam = (next: Exam) => {
    setExam(next);
    setResult(null);
    setEstimate(null);
    setNets({});
    setFilters({ city: '', institutionType: '', level: '', query: '' });
    setScoreType(next === 'LGS' ? 'LGS' : 'SAY');
  };

  const fields = exam === 'LGS' ? LGS_FIELDS : [...TYT_FIELDS, ...AYT_FIELDS];

  const calculate = async () => {
    const payload: PreferenceNetInput = { exam, diplomaGrade: diploma ? Number(diploma.replace(',', '.')) : null };
    for (const field of fields) {
      const raw = nets[field.key];
      if (raw) payload[field.key] = Number(raw.replace(',', '.'));
    }
    try {
      const response = await estimatePreferenceScore(payload);
      setEstimate(response);
      const best = response?.scores.find((item) => item.scoreType === scoreType) ?? response?.scores[response.scores.length - 1];
      if (best) {
        setScoreType(best.scoreType);
        setScore(String(best.score));
      }
    } catch (error) {
      toast({ title: 'Puan hesaplanamadı', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const search = async () => {
    const value = Number(score.replace(',', '.'));
    if (!value) {
      toast({ title: 'Puanını gir ya da netlerinden hesapla.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const response = await searchPreferencePrograms({
        exam,
        scoreType: exam === 'LGS' ? 'LGS' : scoreType,
        score: value,
        year: null,
        city: filters.city || null,
        institutionType: filters.institutionType || null,
        level: filters.level || null,
        query: filters.query || null,
        limit: 600,
      });
      setResult(response);
      if (response) setBand(response.targetCount > 0 ? 'Target' : response.reachCount > 0 ? 'Reach' : 'Safe');
    } catch (error) {
      toast({ title: 'Arama yapılamadı', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const addChoice = (item: PreferenceMatchDto) => {
    if (choices.some((choice) => choice.code === item.code)) return;
    if (choices.length >= maxChoices) {
      toast({ title: `En fazla ${maxChoices} tercih yapılabilir.`, variant: 'destructive' });
      return;
    }
    setChoices((current) => [...current, item]);
    setChoicesDirty(true);
  };

  const move = (index: number, delta: number) => {
    setChoices((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
    setChoicesDirty(true);
  };

  const saveChoices = async () => {
    try {
      await savePreferenceChoices({ exam, items: choices.map((item) => ({ programCode: item.code, note: null })) });
      setChoicesDirty(false);
      toast({ title: 'Tercih listen kaydedildi' });
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const visible = useMemo(() => (result?.items ?? []).filter((item) => item.band === band), [band, result]);

  if (!meta) return <PageLoading />;
  const datasets = meta.datasets.filter((item) => item.exam === exam);
  const lgsMissing = exam === 'LGS' && !meta.lgsAvailable;

  return (
    <Page testId="preference-robot-page">
      <PageHeader title="Tercih Robotu" description="Puanına ya da netlerine göre geçmiş yılların resmî taban puanlarıyla uygun okul ve programları bul." icon={Target} />

      <div className="flex w-fit gap-1 rounded-xl border bg-card p-1" role="tablist">
        <Button role="tab" aria-selected={exam === 'YKS'} variant={exam === 'YKS' ? 'default' : 'ghost'} onClick={() => switchExam('YKS')}><GraduationCap className="mr-2 h-4 w-4" />YKS (Üniversite)</Button>
        <Button role="tab" aria-selected={exam === 'LGS'} variant={exam === 'LGS' ? 'default' : 'ghost'} onClick={() => switchExam('LGS')}><School className="mr-2 h-4 w-4" />LGS (Lise)</Button>
      </div>

      <section className="flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">Veri kaynağı</p>
          {datasets.length === 0 ? (
            <p className="text-muted-foreground">{lgsMissing ? 'LGS okul taban puanları henüz yüklenmedi. MEB verisi yüklendiğinde arama açılır; netten puan hesaplama şimdi de kullanılabilir.' : 'Veri yüklenmedi.'}</p>
          ) : datasets.map((item) => (
            <p key={`${item.exam}-${item.year}`} className="text-muted-foreground">
              <span>{`${item.year}: ${item.count.toLocaleString('tr-TR')} program`}</span> • {item.source}{' '}
              <a className="inline-flex items-center gap-1 text-brand-primary hover:underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">kaynak<ExternalLink className="h-3 w-3" /></a>
            </p>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">1. Puanın</h2>
              <div className="flex gap-1 rounded-xl border p-1">
                <Button size="sm" variant={mode === 'score' ? 'default' : 'ghost'} onClick={() => setMode('score')}>Puanımı biliyorum</Button>
                <Button size="sm" variant={mode === 'nets' ? 'default' : 'ghost'} onClick={() => setMode('nets')}><Calculator className="mr-1 h-4 w-4" />Netlerimden hesapla</Button>
              </div>
            </div>

            {mode === 'nets' ? (
              <div className="mt-4 space-y-4">
                {exam === 'YKS' ? <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TYT</p> : null}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(exam === 'LGS' ? LGS_FIELDS : TYT_FIELDS).map((field) => (
                    <NetInput key={field.key} field={field} value={nets[field.key] ?? ''} onChange={(value) => setNets((current) => ({ ...current, [field.key]: value }))} />
                  ))}
                </div>
                {exam === 'YKS' ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AYT (yalnız girdiğin testler)</p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {AYT_FIELDS.map((field) => (
                        <NetInput key={field.key} field={field} value={nets[field.key] ?? ''} onChange={(value) => setNets((current) => ({ ...current, [field.key]: value }))} />
                      ))}
                    </div>
                    <div className="max-w-[200px]">
                      <Label htmlFor="pref-diploma">Diploma notu (50-100)</Label>
                      <Input id="pref-diploma" inputMode="decimal" value={diploma} onChange={(event) => setDiploma(event.target.value)} placeholder="Örn: 87,5" />
                    </div>
                  </>
                ) : null}
                <Button onClick={() => void calculate()}><Calculator className="mr-2 h-4 w-4" />Puanımı Hesapla</Button>
                {estimate ? (
                  <div className="space-y-2 rounded-xl bg-foreground/[0.04] p-3">
                    <div className="flex flex-wrap gap-2">
                      {estimate.scores.map((item) => (
                        <button key={item.scoreType} type="button" onClick={() => { setScoreType(item.scoreType); setScore(String(item.score)); }}
                          className={`rounded-xl border px-3 py-2 text-left transition ${scoreType === item.scoreType ? 'border-brand-primary bg-brand-primary/10' : 'hover:bg-foreground/[0.04]'}`}>
                          <span className="block text-xs text-muted-foreground">{item.scoreType} (tahmini)</span>
                          <span className="block text-lg font-bold">{fmt(item.score, 3)}</span>
                        </button>
                      ))}
                    </div>
                    {estimate.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
                    <p className="text-xs text-muted-foreground">{estimate.method}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              {exam === 'YKS' ? (
                <div>
                  <Label>Puan türü</Label>
                  <div className="mt-1 flex gap-1">
                    {SCORE_TYPES.map((type) => (
                      <Button key={type} size="sm" variant={scoreType === type ? 'default' : 'outline'} onClick={() => setScoreType(type)}>{type}</Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="w-40">
                <Label htmlFor="pref-score">{exam === 'LGS' ? 'LGS puanı' : 'Yerleştirme puanı'}</Label>
                <Input id="pref-score" inputMode="decimal" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Örn: 412,35" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-bold">2. Filtreler</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label htmlFor="pref-query">{exam === 'LGS' ? 'Okul adı' : 'Program / üniversite'}</Label>
                <Input id="pref-query" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={exam === 'LGS' ? 'Örn: Fen Lisesi' : 'Örn: bilgisayar mühendisliği'} />
              </div>
              <div>
                <Label htmlFor="pref-city">İl</Label>
                <select id="pref-city" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}>
                  <option value="">Tümü</option>
                  {meta.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="pref-type">{exam === 'LGS' ? 'Okul türü' : 'Üniversite türü'}</Label>
                <select id="pref-type" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.institutionType} onChange={(event) => setFilters((current) => ({ ...current, institutionType: event.target.value }))}>
                  <option value="">Tümü</option>
                  {meta.institutionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              {exam === 'YKS' ? (
                <div>
                  <Label htmlFor="pref-level">Düzey</Label>
                  <select id="pref-level" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}>
                    <option value="">Tümü</option>
                    <option value="Lisans">Lisans (4 yıllık)</option>
                    <option value="Önlisans">Önlisans (2 yıllık)</option>
                  </select>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">İl bilgisi ÖSYM tablosunda yalnız il adı taşıyan üniversitelerde vardır; diğerlerinde üniversite adında aranır.</p>
            <Button className="mt-4" onClick={() => void search()} disabled={busy || lgsMissing}><Search className="mr-2 h-4 w-4" />{busy ? 'Aranıyor…' : 'Uygun Programları Bul'}</Button>
          </section>

          {result ? (
            <section className="space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {BANDS.map((item) => {
                  const count = item.key === 'Target' ? result.targetCount : item.key === 'Reach' ? result.reachCount : result.safeCount;
                  return (
                    <button key={item.key} type="button" onClick={() => setBand(item.key)}
                      className={`min-w-0 rounded-2xl border p-3 text-left transition ${band === item.key ? item.tone : 'bg-card hover:bg-foreground/[0.03]'}`}>
                      <span className="block text-2xl font-bold leading-tight">{count}</span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="hidden text-xs opacity-80 sm:block">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground"><span>{`${result.year} taban puanlarına göre`}</span> • <span>{`${result.scoreType} ${fmt(result.score, 3)}`}</span>{result.previousYear ? <> • <span>{`Eğilim: ${result.previousYear} → ${result.year}`}</span></> : null}</p>
              {visible.length === 0 ? <PageNotice icon={Target} title="Bu bantta program yok" message="Diğer bantlara bakın ya da filtreleri genişletin." /> : (
                <div className="overflow-hidden rounded-2xl border bg-card">
                  <div className="divide-y">
                    {visible.map((item) => (
                      <ProgramRow key={item.code} item={item} canSave={canSave} added={choices.some((choice) => choice.code === item.code)} onAdd={() => addChoice(item)} />
                    ))}
                  </div>
                </div>
              )}
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">{result.disclaimer}</p>
            </section>
          ) : null}
        </div>

        {canSave ? (
          <aside className="h-fit rounded-2xl border bg-card p-4 xl:sticky xl:top-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><ListOrdered className="h-4 w-4" />Tercih Listem</h2>
              <Badge variant="outline">{choices.length} / {maxChoices}</Badge>
            </div>
            {choices.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sonuçlardan “Listeme ekle” ile tercih ekle.</p> : (
              <ol className="mt-3 space-y-2">
                {choices.map((item, index) => (
                  <li key={item.code} className="rounded-xl border p-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-bold text-white">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.programName}</p>
                        <p className="truncate text-xs text-muted-foreground"><span>{item.institutionName}</span> • <span>{`taban ${fmt(item.minScore)}`}</span></p>
                      </div>
                    </div>
                    <div className="mt-1 flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Yukarı taşı" onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Aşağı taşı" onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Listeden çıkar" onClick={() => { setChoices((current) => current.filter((choice) => choice.code !== item.code)); setChoicesDirty(true); }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Button className="mt-3 w-full" disabled={!choicesDirty} onClick={() => void saveChoices()}><Save className="mr-2 h-4 w-4" />Listeyi Kaydet</Button>
            <p className="mt-2 text-xs text-muted-foreground">Bu liste yalnız planlama içindir; resmî tercih ÖSYM / MEB sisteminden yapılır.</p>
          </aside>
        ) : (
          <aside className="h-fit space-y-3">
            <StatCard label="Yüklü program" value={datasets.reduce((sum, item) => sum + item.count, 0)} caption={datasets.map((item) => item.year).join(', ') || '—'} icon={GraduationCap} tone="brand" />
          </aside>
        )}
      </div>
    </Page>
  );
}

function NetInput({ field, value, onChange }: { field: NetField; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={`net-${field.key}`} className="text-xs">{field.label} <span className="text-muted-foreground">/ {field.max}</span></Label>
      <Input id={`net-${field.key}`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Net" />
    </div>
  );
}

function ProgramRow({ item, canSave, added, onAdd }: { item: PreferenceMatchDto; canSave: boolean; added: boolean; onAdd: () => void }) {
  const trend = item.previousMinScore !== null && item.minScore !== null ? item.minScore - item.previousMinScore : null;
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-[240px] flex-1">
        <p className="font-semibold">{item.programName}</p>
        <p className="text-sm text-muted-foreground">{item.institutionName}{item.unit ? ` • ${item.unit}` : ''}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {item.institutionType ? <Badge variant="outline">{item.institutionType}</Badge> : null}
          {item.level ? <Badge variant="outline">{item.level}</Badge> : null}
          {item.quota !== null ? <Badge variant="outline">{`Kontenjan ${item.quota}`}</Badge> : null}
          {item.percentile !== null ? <Badge variant="outline">{`Yüzdelik %${fmt(item.percentile)}`}</Badge> : null}
          <a className="inline-flex items-center gap-1 text-muted-foreground hover:text-brand-primary" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{`${item.year} kaynak`}<ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{`Taban (${item.year})`}</p>
        <p className="text-lg font-bold">{fmt(item.minScore)}</p>
        {trend !== null ? (
          <p className={`flex items-center justify-end gap-1 text-xs ${trend > 0 ? 'text-rose-600' : trend < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            <span>{`${trend > 0 ? '+' : ''}${fmt(trend)}`}</span> <span>geçen yıla göre</span>
          </p>
        ) : null}
      </div>
      <div className="w-24 text-right">
        <p className="text-xs text-muted-foreground">Farkın</p>
        <p className={`font-bold ${item.gap >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{item.gap >= 0 ? '+' : ''}{fmt(item.gap)}</p>
      </div>
      {canSave ? (
        <Button size="sm" variant={added ? 'secondary' : 'outline'} disabled={added} onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />{added ? 'Listede' : 'Listeme ekle'}
        </Button>
      ) : null}
    </div>
  );
}
