import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Loader2, Receipt, Wallet, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  collectDrivingDownPayment, fetchDrivingPaymentContext, recordDrivingPayment,
} from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';

/**
 * Sürücü kursu tahsilat penceresi.
 *
 * Hem "Ödeme Al" listesinden hem de Cari Hesaplar detayından açılır — tahsilat
 * akışı tek yerde durur. Taksit planını gösterir, ödenecek taksit seçtirir,
 * ödenmiş taksitleri pasifleştirir; kayıt makbuz numarası ve tarih-saatiyle düşer.
 *
 * `row`: { profileId, fullName, studentNumber?, registrationBranchName? }
 */
const money = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

const METHODS = ['Nakit', 'Kart', 'Havale'];

const INSTALLMENT_STATUS = {
  Paid: { label: 'Ödendi', cls: 'bg-emerald-500/15 text-emerald-600' },
  Partial: { label: 'Kısmi', cls: 'bg-amber-500/15 text-amber-600' },
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

function CollectModal({ row, branches = [], onClose, onDone }) {
  const { toast } = useToast();
  const { user } = useApp();
  const collectorName = user?.name || user?.username || 'Ben';
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Nakit');
  const [branchId, setBranchId] = useState('');
  const [note, setNote] = useState('');
  const [installmentId, setInstallmentId] = useState(''); // '' = otomatik (en eski vade)
  const [saving, setSaving] = useState(false);
  const [collectingDp, setCollectingDp] = useState(false);

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDrivingPaymentContext(row.profileId);
      setCtx(data);
      // Öntanımlı tutar: gecikmiş varsa o, yoksa kalan borç (sözleşmesizde boş).
      setAmount(data.overdueTotal > 0 ? String(data.overdueTotal) : (data.remaining > 0 ? String(data.remaining) : ''));
    } catch (e) {
      toast({ title: 'Finans bilgisi alınamadı', description: e.message, variant: 'destructive' });
      setCtx({ hasContract: false, installments: [] });
    } finally {
      setLoading(false);
    }
  }, [row.profileId, toast]);

  useEffect(() => { loadContext(); }, [loadContext]);

  const unpaidInstallments = useMemo(() => (ctx?.installments || []).filter((i) => i.remaining > 0), [ctx]);

  const pickInstallment = (id) => {
    if (installmentId === id) { setInstallmentId(''); return; } // aynına tekrar tıkla → otomatik
    setInstallmentId(id);
    const chosen = unpaidInstallments.find((x) => x.id === id);
    if (chosen) setAmount(String(chosen.remaining));
  };

  const collectDownPayment = async () => {
    setCollectingDp(true);
    try {
      const payment = await collectDrivingDownPayment(row.profileId, method);
      toast({ title: 'Peşinat tahsil edildi', description: `${money(ctx.downPayment)} — makbuz ${payment.receiptNo}` });
      await loadContext();
    } catch (e) {
      toast({ title: 'Peşinat tahsil edilemedi', description: e.message, variant: 'destructive' });
    } finally {
      setCollectingDp(false);
    }
  };

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { toast({ title: 'Geçerli bir tutar girin', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payment = await recordDrivingPayment(row.profileId, {
        amount: value,
        method,
        branchId: branchId || null,
        financeInstallmentId: installmentId || null,
        note: note.trim(),
      });
      toast({ title: 'Tahsilat alındı', description: `${money(value)} — makbuz ${payment.receiptNo}` });
      onDone();
    } catch (e) {
      toast({ title: 'Tahsilat başarısız', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasContract = ctx?.hasContract;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-brand-primary" />
            Ödeme Al — {row.fullName}
            {row.studentNumber != null && <span className="rounded bg-foreground/10 px-1.5 text-xs font-black text-muted-foreground">#{row.studentNumber}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finans bilgisi yükleniyor…
          </div>
        ) : (
          <div className="space-y-4">
            {hasContract ? (
              <>
                {/* Sözleşme özeti */}
                <div className="grid grid-cols-4 gap-2">
                  <SummaryTile label="Net" value={money(ctx.netAmount)} />
                  <SummaryTile label="Ödenen" value={money(ctx.paidTotal)} tone="ok" />
                  <SummaryTile label="Kalan" value={money(ctx.remaining)} tone={ctx.remaining > 0 ? 'danger' : 'ok'} />
                  <SummaryTile label="Gecikmiş" value={money(ctx.overdueTotal)} tone={ctx.overdueTotal > 0 ? 'danger' : 'default'} />
                </div>

                {/* Peşinat durumu */}
                {ctx.downPayment > 0 && (
                  ctx.downPaymentPending ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/[0.07] p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-amber-600" />
                        <span>Peşinat bekliyor: <b>{money(ctx.downPayment)}</b></span>
                      </div>
                      <Button size="sm" variant="outline" onClick={collectDownPayment} disabled={collectingDp}>
                        {collectingDp ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                        Peşinatı Tahsil Et ({method})
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-2.5 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Peşinat ödendi ({money(ctx.downPayment)}).
                    </div>
                  )
                )}

                {/* Taksit planı — tıklayarak seç */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground">Taksit planı — ödenecek taksidi seçin</label>
                    {installmentId && <button type="button" className="text-xs font-semibold text-brand-primary" onClick={() => { setInstallmentId(''); setAmount(ctx.remaining > 0 ? String(ctx.remaining) : ''); }}>Otomatik</button>}
                  </div>
                  {ctx.installments.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Taksit kaydı yok — tutarı elle girin.</p>
                  ) : (
                    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
                      {ctx.installments.map((i) => {
                        const st = INSTALLMENT_STATUS[i.status] || INSTALLMENT_STATUS.Pending;
                        const selectable = i.remaining > 0;
                        const selected = installmentId === i.id;
                        return (
                          <button
                            key={i.id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => pickInstallment(i.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left text-sm transition ${
                              selected ? 'border-brand-primary bg-brand-primary/[0.06]' : 'border-foreground/10 hover:border-brand-primary/40'
                            } ${!selectable ? 'opacity-55' : ''}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <b>{i.label || `${i.seqNo}. Taksit`}</b>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${i.overdue ? 'bg-red-500/15 text-red-600' : st.cls}`}>{i.overdue ? 'Gecikmiş' : st.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Vade: {new Date(i.dueDateUtc).toLocaleDateString('tr-TR')} • Tutar: {money(i.amount)}{i.paidAmount > 0 ? ` • Ödenen: ${money(i.paidAmount)}` : ''}</p>
                            </div>
                            <span className={`shrink-0 font-black ${i.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{i.remaining > 0 ? money(i.remaining) : '✓'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!installmentId && unpaidInstallments.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Seçim yapılmazsa tahsilat en eski vadeden mahsup edilir.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/[0.06] p-3 text-sm">
                <Receipt className="h-4 w-4 text-sky-600" />
                <span>Bu kursiyerin finans sözleşmesi yok — <b>açık tahsilat (makbuz)</b> alınıyor.{ctx?.paidTotal > 0 ? ` Bugüne dek: ${money(ctx.paidTotal)}.` : ''}</span>
              </div>
            )}

            {/* Ödeme formu */}
            <div className="rounded-2xl border border-foreground/10 p-3">
              <label className="text-xs font-bold text-muted-foreground">Tahsil edilecek tutar (₺)</label>
              <Input type="number" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); }} autoFocus className="mt-1 text-lg font-bold" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Ödeme yöntemi</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Tahsilat şubesi</label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    <option value="">{branches.length ? 'Varsayılan (kendi şubem)' : 'Varsayılan'}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-bold text-muted-foreground">Not (opsiyonel)</label>
                <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" placeholder="Makbuza düşülecek açıklama" />
              </div>
              {/* Tahsilatı yapan personel otomatik: makbuz bu kişinin adına düşer. */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-brand-primary" />
                Tahsilatı alan: <b className="text-foreground">{collectorName}</b>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Kayıt şubesi: {row.registrationBranchName || '—'}</p>
            </div>

            {/* Tahsilat geçmişi: kim, hangi şubeden tahsil etmiş. */}
            {(ctx?.recentPayments?.length > 0) && (
              <div className="rounded-2xl border border-foreground/10 p-3">
                <label className="text-xs font-bold text-muted-foreground">Tahsilat geçmişi</label>
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
                  {ctx.recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <b>{money(p.amount)}</b>
                          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{p.method}</span>
                          {p.receiptNo ? <span className="text-[10px] text-muted-foreground">#{p.receiptNo}</span> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(p.paidAtUtc).toLocaleString('tr-TR')}
                          {p.collectedByName ? ` • Alan: ${p.collectedByName}` : ''}
                          {p.branchName ? ` • Şube: ${p.branchName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Alınıyor…</> : <><Banknote className="mr-2 h-4 w-4" />Tahsilatı Kaydet</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CollectModal;
