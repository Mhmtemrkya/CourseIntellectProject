import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarX,
  ClipboardList,
  FileSignature,
  FileWarning,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { StatusBadge } from '../ui/status-badge';

/**
 * Panonun EN ÜSTÜNDEKİ eylem bloğu — "bugün neye müdahale etmeliyim?".
 *
 * KPI kartları kurumun DURUMUNU anlatır; bu blok kurum sahibinden İŞ ister.
 * Bu yüzden kartların üstünde durur ve her satır doğrudan işin yapılacağı
 * ekrana gider (sunucu `actionPath` ile söyler).
 *
 * Sıralama sunucudan gelir (SchoolDashboardController: önce kritikler, sonra
 * müdahale önceliği) — burada YENİDEN SIRALANMAZ, yoksa masaüstü ile mobil
 * farklı sırada gösterir.
 */

// Sunucunun uyarı türü → ikon. Bilinmeyen tür genel uyarı ikonunu alır.
const ALERT_ICONS = {
  Finance: Wallet,
  Approval: UserCheck,
  Consent: FileSignature,
  Attendance: CalendarX,
  Task: ClipboardList,
  Leave: CalendarX,
  Document: FileWarning,
  Account: KeyRound,
  Library: BookOpen,
};

function AlertCard({ alert, onOpen }) {
  const Icon = ALERT_ICONS[alert.type] || AlertTriangle;
  const critical = alert.severity === 'Critical';
  const clickable = Boolean(alert.actionPath);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onOpen(alert.actionPath) : undefined}
      data-testid={`action-priority-item-${alert.type}`}
      className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition ${
        critical
          ? 'border-rose-500/30 bg-rose-500/[0.07] hover:border-rose-500/60 hover:bg-rose-500/[0.12]'
          : 'border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-500/60 hover:bg-amber-500/[0.11]'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${critical ? 'bg-rose-500' : 'bg-amber-500'}`}
      />
      <span
        className={`ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
          critical
            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{alert.title}</span>
          {/* Ciddiyet rozeti ortak sözlükten: renk/ton tek kaynakta kalsın. */}
          <StatusBadge
            size="sm"
            tone={critical ? 'danger' : 'warning'}
            label={critical ? 'Kritik' : 'Uyarı'}
            className="uppercase tracking-wide"
          />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{alert.message}</span>
      </span>
      {clickable ? (
        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      ) : null}
    </button>
  );
}

export default function ActionPriorityPanel({
  alerts = [],
  navigate,
  emptyDetail = 'Tüm kontroller güncel.',
  testId = 'action-priority',
}) {
  const criticalCount = alerts.filter((item) => item.severity === 'Critical').length;
  const warningCount = alerts.length - criticalCount;

  // Yapılacak iş yokken blok tek satıra iner: pano boş bir kutuyla açılmasın,
  // KPI kartları ekranın üstünde kalsın.
  if (alerts.length === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm font-bold">Müdahale gerektiren bir durum yok</p>
        <p className="truncate text-sm text-muted-foreground">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <section data-testid={testId} className="space-y-3">
      {/* Sayaçlar ve açıklama AYRI metin düğümleri: çeviri katmanı düğüm düğüm
          eşleştiği için birleşik şablon dizesi İngilizce'ye çevrilemezdi. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-black uppercase tracking-[0.05em]">Öncelikli İşler</h2>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
          {criticalCount > 0 ? (
            <span className="font-semibold text-rose-600 dark:text-rose-400">{criticalCount} kritik</span>
          ) : null}
          {warningCount > 0 ? (
            <span className="font-semibold text-amber-700 dark:text-amber-400">{warningCount} uyarı</span>
          ) : null}
          <span>her satır işin yapılacağı ekrana gider</span>
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert, index) => (
          <AlertCard
            key={`${alert.type}-${alert.title}-${index}`}
            alert={alert}
            onOpen={(path) => navigate?.(path)}
          />
        ))}
      </div>
    </section>
  );
}
