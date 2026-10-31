import { Card, CardContent } from '../ui/card';
import { formatMoney } from '../../lib/format';
import type { FinanceDashboardDto } from '../../types/api/generated';

/**
 * Kurumda birden fazla para biriminde sözleşme varsa her biri ayrı satırda.
 * Para birimleri toplanmaz ve çevrilmez; ana kartlar yalnız birincil para birimidir.
 */
export function CurrencyTotalsCard({ finance }: { finance: FinanceDashboardDto | null }) {
  const totals = finance?.currencyTotals || [];
  if (totals.length <= 1) return null;
  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-sm">
        <p className="font-semibold">Para birimine göre</p>
        <p className="text-xs text-muted-foreground">Ana kartlar {finance?.currency === 'TRY' ? 'TL' : finance?.currency} cinsindendir; diğer para birimleri toplanmaz ve çevrilmez.</p>
        <div className="grid gap-2 md:grid-cols-3">
          {totals.map((item) => (
            <div key={item.currency} className="rounded-xl border p-3">
              <p className="font-semibold">{item.currency === 'TRY' ? 'TL' : item.currency}</p>
              <p className="text-xs text-muted-foreground">Sözleşme {formatMoney(item.netTotal, { currency: item.currency })}</p>
              <p className="text-xs text-muted-foreground">Tahsil edilen {formatMoney(item.collectedTotal, { currency: item.currency })}</p>
              <p className="text-xs text-muted-foreground">Bekleyen {formatMoney(item.outstandingTotal, { currency: item.currency })}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
