import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
  Leaf,
  LoaderCircle,
  Printer,
  Save,
  Soup,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { fetchCafeteriaWeek, saveCafeteriaWeek } from '../../lib/api/modules';

const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const meals = [
  { type: 'Breakfast', title: 'Kahvaltı', icon: Sun, accent: 'orange', times: ['07:30', '09:30'] },
  { type: 'Lunch', title: 'Öğle Yemeği', icon: Soup, accent: 'emerald', times: ['12:30', '14:00'] },
];

function isoDate(date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = local.getTimezoneOffset() * 60000;
  return new Date(local.getTime() - offset).toISOString().slice(0, 10);
}

function mondayOf(date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function formatDay(dateString) {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
    .format(new Date(`${dateString}T12:00:00`));
}

function blankMeal(date, config) {
  return {
    date,
    mealType: config.type,
    startTime: config.times[0],
    endTime: config.times[1],
    items: [],
    calories: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
    allergens: [],
    description: '',
  };
}

function normalizeWeek(payload, start) {
  const serverMeals = Array.isArray(payload?.meals) ? payload.meals : [];
  const entries = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(start, index);
    meals.forEach((config) => {
      entries.push(
        serverMeals.find((meal) => meal.date === date && meal.mealType === config.type)
        || blankMeal(date, config),
      );
    });
  }
  return { ...payload, weekStart: start, weekEnd: addDays(start, 6), meals: entries, note: payload?.note || '' };
}

function nutritionValue(value) {
  return Number(value || 0);
}

export default function CafeteriaWeeklyMenu({ editable = false }) {
  const [weekStart, setWeekStart] = useState(() => isoDate(mondayOf(new Date())));
  const [week, setWeek] = useState(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchCafeteriaWeek(weekStart)
      .then((payload) => {
        if (active) {
          setWeek(normalizeWeek(payload, weekStart));
          setSelectedKey('');
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Yemek programı yüklenemedi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [weekStart]);

  const selectedMeal = week?.meals.find((meal) => `${meal.date}|${meal.mealType}` === selectedKey);
  const total = useMemo(() => (week?.meals || []).reduce((sum, meal) => ({
    calories: sum.calories + nutritionValue(meal.calories),
    protein: sum.protein + nutritionValue(meal.proteinGrams),
    carbohydrate: sum.carbohydrate + nutritionValue(meal.carbohydrateGrams),
    fat: sum.fat + nutritionValue(meal.fatGrams),
    fiber: sum.fiber + nutritionValue(meal.fiberGrams),
  }), { calories: 0, protein: 0, carbohydrate: 0, fat: 0, fiber: 0 }), [week]);

  const updateSelectedMeal = (patch) => {
    if (!selectedMeal) return;
    setWeek((current) => ({
      ...current,
      meals: current.meals.map((meal) => (
        meal.date === selectedMeal.date && meal.mealType === selectedMeal.mealType
          ? { ...meal, ...patch }
          : meal
      )),
    }));
  };

  const save = async () => {
    if (!week) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveCafeteriaWeek({
        weekStart: week.weekStart,
        note: week.note,
        meals: week.meals,
      });
      setWeek(normalizeWeek(saved, weekStart));
      setMessage('Haftalık yemek programı kurumunuza kaydedildi.');
    } catch (requestError) {
      setError(requestError?.message || 'Yemek programı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-2rem)] rounded-[30px] border border-white/10 bg-[#070e19] p-5 text-slate-100 shadow-2xl shadow-slate-950/30 md:p-7"
    >
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
            {editable ? 'Yemekhaneci Paneli' : 'Yemekhane'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {editable ? 'Haftalık Yemek Programı Düzenle' : 'Haftalık Yemek Programı'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {formatDay(weekStart)} - {formatDay(addDays(weekStart, 6))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Önceki hafta" onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Sonraki hafta" onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            <CalendarDays className="h-4 w-4 text-orange-400" />
            1 Hafta
          </div>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium transition hover:bg-white/10">
            <Printer className="h-4 w-4" /> Yazdır / PDF
          </button>
          {editable && (
            <button type="button" onClick={save} disabled={saving || loading} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:opacity-60">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          )}
        </div>
      </header>

      {error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {message && <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}

      <div className={editable ? 'grid gap-5 xl:grid-cols-[minmax(680px,1fr)_330px]' : ''}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          {loading ? (
            <div className="flex h-80 items-center justify-center gap-3 text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin text-orange-400" /> Yemek programı yükleniyor
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1020px]">
                <div className="grid grid-cols-[112px_repeat(7,minmax(126px,1fr))] border-b border-white/10 bg-white/[0.025]">
                  <div className="p-4 text-sm font-semibold text-slate-400">Öğünler</div>
                  {days.map((day, index) => (
                    <div key={day} className="border-l border-white/5 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-100">{day}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDay(addDays(weekStart, index))}</p>
                    </div>
                  ))}
                </div>
                {meals.map((config) => {
                  const Icon = config.icon;
                  const lunch = config.type === 'Lunch';
                  return (
                    <div key={config.type} className={`grid grid-cols-[112px_repeat(7,minmax(126px,1fr))] ${lunch ? 'bg-emerald-500/[0.045]' : 'bg-orange-500/[0.045]'}`}>
                      <div className="p-4">
                        <div className={`mb-3 inline-flex rounded-xl p-3 ${lunch ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold">{config.title}</p>
                        <p className="mt-2 text-xs text-slate-400">{config.times[0]} - {config.times[1]}</p>
                      </div>
                      {days.map((_, dayIndex) => {
                        const date = addDays(weekStart, dayIndex);
                        const cell = week.meals.find((meal) => meal.date === date && meal.mealType === config.type) || blankMeal(date, config);
                        const active = selectedKey === `${date}|${config.type}`;
                        return (
                          <button
                            key={`${date}-${config.type}`}
                            type="button"
                            disabled={!editable}
                            onClick={() => editable && setSelectedKey(`${date}|${config.type}`)}
                            className={`min-h-[238px] border-l border-white/10 p-4 text-left transition ${editable ? 'hover:bg-white/[0.055]' : 'cursor-default'} ${active ? 'ring-1 ring-inset ring-orange-400 bg-orange-500/[0.09]' : ''}`}
                          >
                            {cell.items.length > 0 ? (
                              <ul className="space-y-2 text-xs text-slate-200">
                                {cell.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`} className={lunch ? 'before:text-emerald-400' : 'before:text-orange-400'}><span className="mr-2 text-current">•</span>{item}</li>)}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">{editable ? 'Menü eklemek için seçin' : 'Menü girilmedi'}</p>
                            )}
                            <span className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${lunch ? 'bg-emerald-500/12 text-emerald-300' : 'bg-orange-500/12 text-orange-300'}`}>
                              {cell.calories || 0} kcal
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {editable && (
          <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Seçili Menü</h2>
            {!selectedMeal ? (
              <div className="mt-12 text-center text-sm text-slate-400">
                <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 text-orange-400" />
                Düzenlemek için tablodan bir öğün seçin.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-semibold">{days[Math.round((new Date(`${selectedMeal.date}T12:00:00`) - new Date(`${weekStart}T12:00:00`)) / 86400000)]} - {meals.find((meal) => meal.type === selectedMeal.mealType)?.title}</p>
                  <p className="text-xs text-slate-400">{formatDay(selectedMeal.date)}</p>
                </div>
                <Field label="Yemekler (satır satır)">
                  <textarea value={selectedMeal.items.join('\n')} onChange={(event) => updateSelectedMeal({ items: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} rows={6} className="cafeteria-input resize-none" placeholder="Mercimek Çorbası&#10;Tavuk Sote&#10;Pirinç Pilavı" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Kalori (kcal)" value={selectedMeal.calories} onChange={(value) => updateSelectedMeal({ calories: value })} />
                  <NumberField label="Protein (g)" value={selectedMeal.proteinGrams} onChange={(value) => updateSelectedMeal({ proteinGrams: value })} />
                  <NumberField label="Karbonhidrat (g)" value={selectedMeal.carbohydrateGrams} onChange={(value) => updateSelectedMeal({ carbohydrateGrams: value })} />
                  <NumberField label="Yağ (g)" value={selectedMeal.fatGrams} onChange={(value) => updateSelectedMeal({ fatGrams: value })} />
                  <NumberField label="Lif (g)" value={selectedMeal.fiberGrams} onChange={(value) => updateSelectedMeal({ fiberGrams: value })} />
                </div>
                <Field label="Alerjen bilgisi">
                  <input value={selectedMeal.allergens.join(', ')} onChange={(event) => updateSelectedMeal({ allergens: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="cafeteria-input" placeholder="Gluten, Süt Ürünleri" />
                </Field>
                <Field label="Açıklama">
                  <textarea value={selectedMeal.description} onChange={(event) => updateSelectedMeal({ description: event.target.value })} rows={3} className="cafeteria-input resize-none" placeholder="Opsiyonel not" />
                </Field>
              </div>
            )}
          </aside>
        )}
      </div>

      {!loading && week && (
        <section className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-4 text-sm font-semibold">Haftalık Besin Değerleri Ortalaması</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Summary icon={Flame} label="Kalori" value={`${Math.round(total.calories / 7)} kcal`} color="orange" />
              <Summary icon={UtensilsCrossed} label="Karbonhidrat" value={`${Math.round(total.carbohydrate / 7)} g`} color="blue" />
              <Summary icon={Soup} label="Protein" value={`${Math.round(total.protein / 7)} g`} color="purple" />
              <Summary icon={Sun} label="Yağ" value={`${Math.round(total.fat / 7)} g`} color="amber" />
              <Summary icon={Leaf} label="Lif" value={`${Math.round(total.fiber / 7)} g`} color="emerald" />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">
            <p className="mb-2 flex items-center gap-2 font-semibold text-slate-100"><Info className="h-4 w-4 text-sky-400" /> Bilgilendirme</p>
            Menüler kurum yemekhanesi tarafından haftalık olarak hazırlanır ve besin değerleri porsiyon bazında gösterilir.
          </div>
        </section>
      )}

      <style>{`.cafeteria-input{width:100%;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.55);padding:.65rem .75rem;font-size:.875rem;color:#e2e8f0;outline:none}.cafeteria-input:focus{border-color:rgba(249,115,22,.7);box-shadow:0 0 0 2px rgba(249,115,22,.12)}@media print{aside,button{display:none!important}main{background:#fff!important;color:#111827!important;border:0!important}.cafeteria-input{color:#111827}}`}</style>
    </motion.main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2 text-xs text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input type="number" min="0" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))} className="cafeteria-input" />
    </Field>
  );
}

function Summary({ icon: Icon, label, value, color }) {
  const tones = {
    orange: 'bg-orange-500/12 text-orange-400',
    blue: 'bg-blue-500/12 text-blue-400',
    purple: 'bg-purple-500/12 text-purple-400',
    amber: 'bg-amber-500/12 text-amber-400',
    emerald: 'bg-emerald-500/12 text-emerald-400',
  };
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/25 p-3">
      <span className={`mb-2 inline-flex rounded-lg p-2 ${tones[color]}`}><Icon className="h-4 w-4" /></span>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
