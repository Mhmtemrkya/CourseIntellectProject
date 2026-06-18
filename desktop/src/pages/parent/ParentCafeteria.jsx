import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchCafeteriaWeek } from '../../lib/api/modules';

const MEAL_LABEL = { Breakfast: 'Kahvaltı', Lunch: 'Öğle Yemeği', Dinner: 'Akşam Yemeği', Snack: 'İkindi' };
const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function mondayOf(date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}
function iso(d) { return d.toISOString().slice(0, 10); }

export default function ParentCafeteria() {
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())));
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setWeek(await fetchCafeteriaWeek(weekStart));
    } catch (err) {
      setError(err.message || 'Yemek menüsü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const shiftWeek = (days) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    setWeekStart(iso(mondayOf(d)));
  };

  const days = useMemo(() => {
    const meals = week?.meals || [];
    const byDate = {};
    meals.forEach((m) => {
      const key = String(m.date).slice(0, 10);
      (byDate[key] = byDate[key] || []).push(m);
    });
    return Object.keys(byDate).sort().map((date) => ({ date, meals: byDate[date] }));
  }, [week]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-cafeteria-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><UtensilsCrossed className="h-7 w-7 text-brand-primary" />Yemek Menüsü</h1>
          <p className="text-muted-foreground mt-1">Haftalık yemekhane menüsü.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-7)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold">{new Date(weekStart).toLocaleDateString('tr-TR')} haftası</span>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(7)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {error ? <ErrorBanner title="Menü alınamadı" message={error} onRetry={load} /> : null}

      {days.every((d) => d.meals.every((m) => (m.items || []).length === 0)) ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Bu hafta için menü girilmemiş.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => {
            const filledMeals = day.meals.filter((m) => (m.items || []).length > 0 || m.description);
            if (filledMeals.length === 0) return null;
            const d = new Date(day.date);
            return (
              <Card key={day.date}>
                <CardHeader><CardTitle className="text-base">{DAY_NAMES[d.getDay()]} • {d.toLocaleDateString('tr-TR')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {filledMeals.map((m, idx) => (
                    <div key={`${m.mealType}-${idx}`} className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{MEAL_LABEL[m.mealType] || m.mealType}</span>
                        <span className="text-xs text-muted-foreground">{m.startTime}{m.endTime ? `–${m.endTime}` : ''}</span>
                      </div>
                      {(m.items || []).length > 0 ? (
                        <ul className="mt-2 list-disc pl-5 text-sm">
                          {m.items.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                      ) : null}
                      {m.description ? <p className="mt-1 text-xs text-muted-foreground">{m.description}</p> : null}
                      {(m.allergens || []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.allergens.map((a, i) => <Badge key={i} variant="outline" className="text-[10px]">{a}</Badge>)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
