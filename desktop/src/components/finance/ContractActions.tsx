import { useState } from 'react';
import { Ban, CalendarClock, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FeatureGate } from '../FeatureGate';
import { useToast } from '../../hooks/use-toast';
import { changeContractStatus, restructureInstallments } from '../../lib/api/modules';
import { formatDate } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import type { EnrollmentContractDto } from '../../types/api/generated';

type Mode = 'freeze' | 'unfreeze' | 'cancel' | 'restructure' | null;

const STATUS_LABEL: Record<string, string> = { Active: 'Aktif', Frozen: 'Donduruldu', Cancelled: 'İptal' };

function money(value: number, currency: string) {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency === 'TRY' ? 'TL' : currency}`;
}

/**
 * Sözleşme satırı + yaşam döngüsü işlemleri:
 *  • Dondur / Devam ettir: borç durur, gecikme ve hatırlatma işlemez.
 *  • İptal: ödenmemiş borç silinir; tahsil edilen para iade ekranından ayrıca iade edilir.
 *  • Yeniden yapılandır: kalan borç yeni taksit planına bölünür.
 */
export function ContractActions({ contract, currency, onChanged }: {
  contract: EnrollmentContractDto;
  currency: string;
  onChanged: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [count, setCount] = useState('6');
  const [firstDue, setFirstDue] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 1, 12).toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);

  const remaining = (contract.installments || []).reduce((sum, item) => sum + Math.max(0, item.remaining), 0);

  const submit = async () => {
    if (!mode) return;
    if (mode !== 'restructure' && !reason.trim()) {
      toast({ title: 'Gerekçe yazın.', variant: 'destructive' });
      return;
    }
    if (mode === 'cancel' && !window.confirm('Kayıt iptal edilsin mi? Ödenmemiş borç silinir; bu işlem geri alınamaz.')) return;
    try {
      setBusy(true);
      if (mode === 'restructure') {
        await restructureInstallments(contract.id, {
          installmentCount: Number(count) || 1,
          firstDueDate: new Date(`${firstDue}T12:00:00`).toISOString(),
          reason: reason.trim() || null,
        });
        toast({ title: 'Taksit planı yeniden yapılandırıldı.' });
      } else {
        await changeContractStatus(contract.id, { action: mode, reason: reason.trim() });
        toast({ title: mode === 'freeze' ? 'Kayıt donduruldu.' : mode === 'unfreeze' ? 'Kayıt devam ettirildi.' : 'Kayıt iptal edildi.' });
      }
      setMode(null);
      setReason('');
      await onChanged();
    } catch (err) {
      toast({ title: 'İşlem yapılamadı', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{contract.className || 'Sözleşme'} {contract.academicYear}</span>
          <span className="ml-2 text-muted-foreground">Net {money(contract.netAmount, currency)} • Kalan taksit {money(remaining, currency)}</span>
          <Badge variant="outline" className="ml-2">{STATUS_LABEL[contract.status] || contract.status}</Badge>
          {contract.status !== 'Active' && contract.statusReason ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {contract.statusChangedAtUtc ? `${formatDate(contract.statusChangedAtUtc)} • ` : ''}{contract.statusReason}
            </p>
          ) : null}
        </div>
        {contract.status !== 'Cancelled' ? (
          <FeatureGate module="installments" action="edit">
            <div className="flex flex-wrap gap-1">
              {contract.status === 'Active' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setMode('restructure')}><CalendarClock className="mr-1 h-4 w-4" />Yeniden Yapılandır</Button>
                  <Button size="sm" variant="outline" onClick={() => setMode('freeze')}><PauseCircle className="mr-1 h-4 w-4" />Dondur</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setMode('unfreeze')}><PlayCircle className="mr-1 h-4 w-4" />Devam Ettir</Button>
              )}
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => setMode('cancel')}><Ban className="mr-1 h-4 w-4" />İptal</Button>
            </div>
          </FeatureGate>
        ) : null}
      </div>

      {mode ? (
        <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3">
          {mode === 'restructure' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`restructure-count-${contract.id}`}>Yeni taksit sayısı</Label>
                <Input id={`restructure-count-${contract.id}`} type="number" min="1" max="60" value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`restructure-first-${contract.id}`}>İlk vade</Label>
                <Input id={`restructure-first-${contract.id}`} type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Kalan {money(remaining, currency)} borç {Number(count) || 1} taksite bölünür; ödenmiş kısımlar korunur.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {mode === 'freeze' && 'Dondurulan kaydın borcu durur; gecikme ve hatırlatma işlemez.'}
              {mode === 'unfreeze' && 'Kayıt yeniden aktif olur; taksitler kaldığı yerden devam eder.'}
              {mode === 'cancel' && `Ödenmemiş ${money(remaining, currency)} borç silinir. Tahsil edilmiş para iade ekranından ayrıca iade edilir.`}
            </p>
          )}
          <div>
            <Label htmlFor={`contract-reason-${contract.id}`}>Gerekçe{mode === 'restructure' ? ' (opsiyonel)' : ' *'}</Label>
            <Input id={`contract-reason-${contract.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Vazgeç</Button>
            <Button size="sm" variant={mode === 'cancel' ? 'destructive' : 'default'} onClick={() => void submit()} disabled={busy}>Onayla</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
