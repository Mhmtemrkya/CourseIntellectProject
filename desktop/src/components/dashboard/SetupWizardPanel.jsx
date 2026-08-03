import { ArrowRight, Check, Rocket } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Yeni kurum kurulum sihirbazı.
 *
 * Boş bir panoyu "sıfır" olarak bırakmak yerine kurumu ilk kuruluma yönlendirir:
 * sınıflar → öğretmenler → ders programı → ilk kayıt & ücret sözleşmesi.
 *
 * Adımların bitip bitmediğini SUNUCU kurumun kendi verisinden hesaplar; burada
 * yerel bir "tamamlandı" işareti tutulmaz. Kurum bir adımı başka ekrandan
 * yaptıysa sihirbaz da bunu görür, hepsi bitince blok hiç çizilmez.
 */
export default function SetupWizardPanel({ status, navigate, testId = 'setup-wizard' }) {
  const steps = status?.steps || [];
  if (!status || status.completed || steps.length === 0) return null;

  const total = status.totalSteps || steps.length;
  const done = status.completedSteps || 0;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  // Sıradaki iş = biten adımlardan sonraki ilk eksik adım.
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <section
      data-testid={testId}
      className="overflow-hidden rounded-3xl border border-[hsl(var(--brand-accent)/0.35)] bg-[hsl(var(--brand-accent)/0.05)]"
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-[hsl(var(--brand-accent)/0.2)] px-5 py-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.15)] text-[hsl(var(--brand-accent))]">
          <Rocket className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">Kurumunuzu kurmaya devam edin</h2>
          <p className="text-sm text-muted-foreground">
            Bu adımlar bitince pano gerçek verilerle dolar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-[hsl(var(--brand-accent))] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums" data-testid={`${testId}-progress`}>
            {done} / {total}
          </span>
        </div>
      </div>

      <ol className="divide-y divide-foreground/[0.07]">
        {steps.map((step, index) => {
          const isNext = index === nextIndex;
          return (
            <li
              key={step.key}
              data-testid={`${testId}-step-${step.key}`}
              data-done={step.done ? 'true' : 'false'}
              className={`flex flex-wrap items-center gap-4 px-5 py-4 ${isNext ? 'bg-[hsl(var(--brand-accent)/0.06)]' : ''}`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  step.done
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'border border-foreground/15 text-muted-foreground'
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {/* Biten adımda ne kadar yapıldığı yazılır: "12 sınıf tanımlı". */}
                  {step.done ? `${step.count} ${step.countLabel}` : step.description}
                </p>
              </div>

              {step.done ? null : (
                <Button
                  size="sm"
                  variant={isNext ? 'default' : 'outline'}
                  onClick={() => step.actionPath && navigate?.(step.actionPath)}
                  className="shrink-0"
                >
                  {step.actionLabel}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
