import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Banknote, CheckCircle2, Loader2, Receipt, Wallet, XCircle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  collectDownPayment, fetchStudentFinanceAccount, recordFinancePayment,
} from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';

/**
 * Okul tahsilat penceresi — sürücü kursundaki "Ödeme Al" penceresinin okul karşılığı.
 *
 * Bu ekrandan ÖNCE "Tahsilat Gir", hiçbir onay sormadan kalan bakiyenin tamamını
 * kartla tahsil edilmiş sayıyordu. Para hareketinin geri alınması ancak iade
 * kaydıyla olur; bu yüzden tahsilat artık tutar/yöntem/taksit seçilerek ve
 * ne olacağı ekranda yazılarak alınır.
 *
 * Güvenlik kuralları:
 *  • `clientRequestId` pencere açılışında BİR KEZ üretilir. Kullanıcı iki kez
 *    tıklasa ya da istek ağ hatasında yeniden gönderilse bile sunucu ikinci
 *    kaydı oluşturmaz (bkz. StudentFinanceService.RecordPaymentAsync).
 *  • Kalanı aşan tutar sessizce geçmez: "avans" olarak yazılacağı açıkça uyarılır.
 *  • Kaydetme sırasında buton kilitlenir, pencere kapatılamaz.
 */

const METHODS = ['Nakit', 'Kart', 'Havale', 'EFT/IBAN'];

const INSTALLMENT_STATUS = {
  Paid: { label: 'Ödendi', cls: 'bg-emerald-500/15 text-emerald-600' },
  Partial: { label: 'Kısmi', cls: 'bg-amber-500/15 text-amber-600' },
  Overdue: { label: 'Gecikmiş', cls: 'bg-red-500/15 text-red-600' },
  Pending: { label: 'Bekliyor', cls: 'bg-foreground/10 text-muted-foreground' },
};

function SummaryTile({ label, value, tone = 'default' }) {
  const toneCls = tone === 'danger' ? 'text-red-600' : tone === 'ok' ? 'text-emerald-600' : 'text-foreground';
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-2.5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${toneCls}`}>{value}</p>
    </div>
  );
}

export default function SchoolCollectModal({ account, onClose, onDone }) {
  const { toast } = useToast();
  const { user } = useApp();
  const collectorName = user?.name || user?.username || 'Ben';

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Nakit');
  const [note, setNote] = useState('');
  const [installmentId, setInstallmentId] = useState(''); // '' = otomatik (en eski vade)
  const [saving, setSaving] = useState(false);
  const [collectingDownPayment, setCollectingDownPayment] = useState(false);

  // Idempotency anahtarı: pencere başına tek. Kayıt başarılı olduktan sonra
  // pencere kapandığı için yeniden kullanılmaz.
  const clientRequestId = useRef(
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchStudentFinanceAccount(account?.userId
        ? { studentUserId: account.userId }
        : { studentName: account?.name });
      setDetail(data);
    } catch (err) {
      setLoadError(err.message || 'Cari hesap bilgisi alınamadı.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [account?.userId, account?.name]);

  useEffect(() => { load(); }, [load]);

  const installments = useMemo(() => detail?.installments || [], [detail]);
  const unpaid = useMemo(() => installments.filter((item) => item.remaining > 0), [installments]);
  const overdueTotal = useMemo(
    () => unpaid
      .filter((item) => new Date(item.dueDateUtc) < new Date())
      .reduce((sum, item) => sum + Number(item.remaining || 0), 0),
    [unpaid],
  );
  const remaining = Number(detail?.totalPayable ?? detail?.balance ?? 0);
  const pendingDownPayment = detail?.hasPendingDownPayment
    ? Math.max(0, Number(detail.downPaymentTotal || 0) - Number(detail.downPaymentPaidTotal || 0))
    : 0;

  // Öntanımlı tutar: gecikmiş varsa onu kapat, yoksa kalan borç.
  useEffect(() => {
    if (loading || !detail) return;
    setAmount(overdueTotal > 0 ? String(overdueTotal) : (remaining > 0 ? String(remaining) : ''));
  }, [loading, detail, overdueTotal, remaining]);

  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value > 0;
  const overpaying = validAmount && remaining > 0 && value > remaining + 0.005;
  const noDebt = !loading && !loadError && remaining <= 0 && pendingDownPayment <= 0;

  const pickInstallment = (id) => {
    if (installmentId === id) { setInstallmentId(''); return; } // aynına tekrar tıkla → otomatik
    setInstallmentId(id);
    const chosen = unpaid.find((item) => item.id === id);
    if (chosen) setAmount(String(chosen.remaining));
  };

  const handleCollectDownPayment = async () => {
    const contractId = detail?.contracts?.find((item) => item.downPayment > 0 && !item.downPaymentPaid)?.id;
    if (!contractId) return;
    setCollectingDownPayment(true);
    try {
      const payment = await collectDownPayment(contractId, method);
      toast({
        title: 'Peşinat tahsil edildi',
        description: `${formatMoney(pendingDownPayment)} — makbuz ${payment?.receiptNo || '—'}`,
      });
      await load();
      onDone?.({ silent: true });
    } catch (err) {
      toast({ title: 'Peşinat tahsil edilemedi', description: err.message, variant: 'destructive' });
    } finally {
      setCollectingDownPayment(false);
    }
  };

  const submit = async () => {
    if (!validAmount) {
      toast({ title: 'Geçerli bir tutar girin', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payment = await recordFinancePayment({
        studentName: detail?.studentName || account.name,
        studentUserId: detail?.studentUserId || account.userId || undefined,
        enrollmentContractId: detail?.contracts?.[0]?.id || undefined,
        financeInstallmentId: installmentId || undefined,
        amount: value,
        method,
        note: note.trim() || undefined,
        clientRequestId: clientRequestId.current,
      });
      toast({
        title: 'Tahsilat kaydedildi',
        description: `${formatMoney(value)} — makbuz ${payment?.receiptNo || '—'} • ${method}`,
      });
      onDone?.({ payment });
    } catch (err) {
      toast({ title: 'Tahsilat kaydedilemedi', description: err.message, variant: 'destructive' });
      setSaving(false); // pencere açık kalır: kullanıcı düzeltip tekrar dener
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      {/* Cari hesap ÇEKMECESİNDEN de açılır; çekmece z-50'de olduğu için pencere
          ve perdesi bir üst katmana alınır, yoksa arkada kalıp tıklanamıyor. */}
      <DialogContent
        className="z-[70] max-h-[92vh] max-w-lg overflow-y-auto"
        overlayClassName="z-[65]"
        data-testid="school-collect-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-brand-primary" />
            Tahsilat Gir — {account?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cari hesap yükleniyor…
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/[0.07] p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-600">{loadError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={load}>Tekrar dene</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <SummaryTile label="Net Ücret" value={formatMoney(detail?.netTotal)} />
              <SummaryTile label="Tahsil Edilen" value={formatMoney(detail?.paidTotal)} tone="ok" />
              <SummaryTile label="Kalan" value={formatMoney(remaining)} tone={remaining > 0 ? 'danger' : 'ok'} />
              <SummaryTile label="Gecikmiş" value={formatMoney(overdueTotal)} tone={overdueTotal > 0 ? 'danger' : 'default'} />
            </div>

            {noDebt ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Bu öğrencinin açık bakiyesi yok. Yine de tahsilat girerseniz tutar <b>avans</b> olarak kaydedilir.
              </div>
            ) : null}

            {/* Bekleyen peşinat: makbuzlu olarak tek tuşla kapatılır. */}
            {pendingDownPayment > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/[0.07] p-3">
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span>Peşinat bekliyor: <b>{formatMoney(pendingDownPayment)}</b></span>
                </div>
                <Button size="sm" variant="outline" onClick={handleCollectDownPayment} disabled={collectingDownPayment || saving}>
                  {collectingDownPayment
                    ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                  Peşinatı Tahsil Et ({method})
                </Button>
              </div>
            ) : null}

            {/* Taksit planı — tıklayarak mahsup edilecek taksidi seç. */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground">Taksit planı — ödenecek taksidi seçin</label>
                {installmentId ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-primary"
                    onClick={() => { setInstallmentId(''); setAmount(remaining > 0 ? String(remaining) : ''); }}
                  >
                    Otomatik
                  </button>
                ) : null}
              </div>
              {installments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Taksit planı yok — tutarı elle girin, tahsilat açık makbuz olarak kaydedilir.
                </p>
              ) : (
                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
                  {installments.map((item) => {
                    const overdue = item.remaining > 0 && new Date(item.dueDateUtc) < new Date();
                    const status = INSTALLMENT_STATUS[overdue ? 'Overdue' : item.status] || INSTALLMENT_STATUS.Pending;
                    const selectable = item.remaining > 0;
                    const selected = installmentId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!selectable || saving}
                        onClick={() => pickInstallment(item.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left text-sm transition ${
                          selected ? 'border-brand-primary bg-brand-primary/[0.06]' : 'border-foreground/10 hover:border-brand-primary/40'
                        } ${!selectable ? 'opacity-55' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <b>{item.label || `${item.seqNo}. Taksit`}</b>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Vade: {formatDate(item.dueDateUtc)} • Tutar: {formatMoney(item.amount)}
                            {item.paidAmount > 0 ? ` • Ödenen: ${formatMoney(item.paidAmount)}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 font-black ${item.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.remaining > 0 ? formatMoney(item.remaining) : '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!installmentId && unpaid.length > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Seçim yapılmazsa tahsilat en eski vadeden başlayarak mahsup edilir.
                </p>
              ) : null}
            </div>

            {/* Ödeme formu */}
            <div className="rounded-2xl border border-foreground/10 p-3">
              <label className="text-xs font-bold text-muted-foreground" htmlFor="collect-amount">
                Tahsil edilecek tutar (TL)
              </label>
              <Input
                id="collect-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={saving}
                autoFocus
                className="mt-1 text-lg font-bold"
              />
              {overpaying ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold text-amber-600">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    Kalan borç {formatMoney(remaining)}. Aşan {formatMoney(value - remaining)} tutar
                    makbuza <b>avans</b> olarak düşer.
                  </span>
                </p>
              ) : null}

              <div className="mt-3">
                <label className="text-xs font-bold text-muted-foreground">Ödeme yöntemi</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {METHODS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={saving}
                      onClick={() => setMethod(item)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        method === item ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-bold text-muted-foreground" htmlFor="collect-note">Not (opsiyonel)</label>
                <Input
                  id="collect-note"
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={saving}
                  className="mt-1"
                  placeholder="Makbuza düşülecek açıklama"
                />
              </div>

              {/* Makbuzun kime ait olacağı önceden görünür. */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-brand-primary" />
                Tahsilatı alan: <b className="text-foreground">{collectorName}</b>
                {account?.className ? <span>• Sınıf: {account.className}</span> : null}
              </div>
            </div>

            {/* Tahsilat geçmişi: kim, ne zaman, hangi şubeden almış. */}
            {(detail?.payments || []).length > 0 ? (
              <div className="rounded-2xl border border-foreground/10 p-3">
                <label className="text-xs font-bold text-muted-foreground">Son tahsilatlar</label>
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                  {detail.payments.slice(0, 8).map((item) => {
                    const isRefund = item.entryType === 'Refund' || item.amount < 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <b className={isRefund ? 'text-red-600' : ''}>{formatMoney(item.amount)}</b>
                            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {isRefund ? 'İade' : item.method}
                            </span>
                            {item.receiptNo ? <span className="text-[10px] text-muted-foreground">#{item.receiptNo}</span> : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDateTime(item.paidAtUtc)}
                            {item.collectedByName ? ` • Alan: ${item.collectedByName}` : ''}
                            {item.branchName ? ` • Şube: ${item.branchName}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/[0.06] p-3 text-sm">
                <Receipt className="h-4 w-4 shrink-0 text-sky-600" />
                Bu öğrenciden daha önce tahsilat alınmamış — bu ilk makbuz olacak.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || loading || !!loadError || !validAmount}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor…</>
              : <><Banknote className="mr-2 h-4 w-4" />{validAmount ? `${formatMoney(value)} Tahsil Et` : 'Tahsilatı Kaydet'}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
