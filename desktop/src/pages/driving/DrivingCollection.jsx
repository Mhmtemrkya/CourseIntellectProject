import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Loader2, Receipt, Search, Wallet, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  collectDrivingDownPayment, fetchDrivingBranches, fetchDrivingCollectionList, fetchDrivingPaymentContext,
  fetchDrivingStudentGroups, recordDrivingPayment,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { useApp } from '../../context/AppContext';
import PendingDownPayments from '../../components/finance/PendingDownPayments';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const STATUS_LABELS = {
  PreRegistered: 'Ön kayıt', DocumentsPending: 'Evrak bekliyor', Active: 'Aktif',
  TheoryOngoing: 'Teorik', PracticeOngoing: 'Direksiyon', ExamPending: 'Sınav bekliyor',
  GraduationPending: 'Mezuniyet onayı', Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal',
};
const BUCKETS = [
  { key: 'active', label: 'Aktif' },
  { key: 'graduated', label: 'Mezun' },
  { key: 'passive', label: 'Pasif' },
  { key: 'all', label: 'Tümü' },
];

const money = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
// "2026-09" → "Eylül 2026"
const monthLabel = (value) => {
  const [year, month] = String(value).split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};
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

function CollectModal({ row, branches, onClose, onDone }) {
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

export default function DrivingCollection() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const canCollect = can(DRIVING.financeCollect);
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bucket, setBucket] = useState('active');
  const [groupId, setGroupId] = useState('all');
  const [dueMonth, setDueMonth] = useState('all');
  const [search, setSearch] = useState('');
  const [collectRow, setCollectRow] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (bucket !== 'all') params.bucket = bucket;
      if (groupId === 'ungrouped') params.ungrouped = true;
      else if (groupId !== 'all') params.groupId = groupId;
      const [list, branchList, groupData] = await Promise.all([
        fetchDrivingCollectionList(params),
        fetchDrivingBranches().catch(() => []),
        fetchDrivingStudentGroups().catch(() => null),
      ]);
      setRows(list || []);
      setBranches(branchList || []);
      setGroups(groupData?.groups || []);
    } catch (e) {
      toast({ title: 'Liste alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bucket, groupId, toast]);

  useEffect(() => { load(); }, [load]);

  // Listede geçen tüm vade ayları (ödenmemiş taksitlerden) — filtre seçenekleri.
  const monthOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => (r.unpaidByMonth || []).forEach((m) => {
      const current = map.get(m.month) || { month: m.month, amount: 0, students: 0 };
      current.amount += m.amount || 0;
      current.students += 1;
      map.set(m.month, current);
    }));
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  // Ay seçiliyken yalnız o ayda taksidi olanlar gelir ve vadesi en yakın olan başa
  // alınır; seçim yoksa sunucudan gelen (aktif → mezun → pasif) sıra korunur.
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    let list = rows;
    if (dueMonth !== 'all') {
      list = rows
        .map((r) => {
          const hit = (r.unpaidByMonth || []).find((m) => m.month === dueMonth);
          return hit ? { ...r, monthDue: hit } : null;
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.monthDue.dueDateUtc) - new Date(b.monthDue.dueDateUtc)
          || (b.overdueAmount || 0) - (a.overdueAmount || 0));
    }
    if (!term) return list;
    return list.filter((r) => (r.fullName || '').toLocaleLowerCase('tr-TR').includes(term));
  }, [rows, search, dueMonth]);

  // Özet kartları görünen listeyi yansıtır: ay seçiliyken o ayın rakamları.
  const totals = useMemo(() => {
    if (dueMonth !== 'all') {
      return {
        remaining: filtered.reduce((s, r) => s + (r.monthDue?.amount || 0), 0),
        overdue: filtered.reduce((s, r) => s + (r.overdueAmount || 0), 0),
        overdueCount: filtered.filter((r) => r.overdueCount > 0).length,
        scoped: true,
      };
    }
    return {
      remaining: rows.reduce((s, r) => s + (r.remaining || 0), 0),
      overdue: rows.reduce((s, r) => s + (r.overdueAmount || 0), 0),
      overdueCount: rows.filter((r) => r.overdueCount > 0).length,
      scoped: false,
    };
  }, [rows, filtered, dueMonth]);

  if (loading) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-collection-page">
      <DrivingPageHeader
        title="Ödeme Al"
        description="Ay seçerek o ayın taksitlerini görün — vadesi en yakın kursiyer başta. Tahsilatı istediğiniz şubeden alın."
        icon={Wallet}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <DrivingStatCard
          label={totals.scoped ? 'Seçili ayın tahsilatı' : 'Toplam kalan borç'}
          value={money(totals.remaining)}
          caption={totals.scoped ? `${monthLabel(dueMonth)} • ${filtered.length} kursiyer` : 'Listedeki kursiyerler'}
          icon={Banknote} tone="brand" />
        <DrivingStatCard label="Gecikmiş tutar" value={money(totals.overdue)} caption="Vadesi geçmiş" icon={AlertTriangle} tone="amber" />
        <DrivingStatCard label="Gecikmiş kursiyer" value={totals.overdueCount} caption="En az bir gecikmiş taksit" icon={Clock} tone="violet" />
      </div>

      <PendingDownPayments onCollected={() => load(true)} />

      <div className="flex flex-wrap items-center gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              bucket === b.key ? 'border-brand-primary bg-brand-primary text-white' : 'border-foreground/15 bg-foreground/[0.03] text-muted-foreground hover:border-[hsl(var(--brand-accent)/0.5)]'
            }`}
          >
            {b.label}
          </button>
        ))}
        <select className="h-9 rounded-lg border border-foreground/15 bg-background px-3 text-sm" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="all">Tüm gruplar</option>
          <option value="ungrouped">Beklemede</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          className={`h-9 rounded-lg border px-3 text-sm ${dueMonth === 'all' ? 'border-foreground/15 bg-background' : 'border-brand-primary bg-brand-primary/[0.07] font-semibold'}`}
          value={dueMonth}
          onChange={(e) => setDueMonth(e.target.value)}
        >
          <option value="all">Tüm aylar</option>
          {monthOptions.map((m) => (
            <option key={m.month} value={m.month}>{monthLabel(m.month)} ({m.students})</option>
          ))}
        </select>
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kursiyer ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <DrivingNotice
          icon={CheckCircle2}
          title={dueMonth === 'all' ? 'Kayıt yok.' : `${monthLabel(dueMonth)} için ödenmemiş taksit yok.`}
          message={dueMonth === 'all' ? 'Bu filtrede kursiyer bulunamadı.' : 'Başka bir ay seçebilir veya "Tüm aylar"a dönebilirsiniz.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.profileId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {r.studentNumber != null && <span className="rounded bg-foreground/10 px-1.5 text-[11px] font-black text-muted-foreground">#{r.studentNumber}</span>}
                  <b className="truncate">{r.fullName}</b>
                  <Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[r.status] || r.status}</Badge>
                  {r.groupName && <span className="rounded-full bg-[hsl(var(--brand-accent)/0.12)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-accent))]">{r.groupName}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.monthDue
                    ? `${monthLabel(dueMonth)} vadesi: ${new Date(r.monthDue.dueDateUtc).toLocaleDateString('tr-TR')}${r.monthDue.count > 1 ? ` (${r.monthDue.count} taksit)` : ''}`
                    : r.nextDueDateUtc ? `Sıradaki vade: ${new Date(r.nextDueDateUtc).toLocaleDateString('tr-TR')}` : 'Vade yok'}
                  {' • '}Kayıt: {r.registrationBranchName || '—'}{r.registrarName ? ` (${r.registrarName})` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-black">{money(r.monthDue ? r.monthDue.amount : r.remaining)}</p>
                  {r.monthDue
                    ? <p className="text-[11px] text-muted-foreground">Toplam kalan {money(r.remaining)}</p>
                    : null}
                  {r.overdueAmount > 0 && <p className="text-xs font-bold text-red-600">{money(r.overdueAmount)} gecikmiş</p>}
                </div>
                {canCollect && (
                  <Button size="sm" className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={() => setCollectRow(r)}>
                    <Banknote className="mr-2 h-4 w-4" />Ödeme Al
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {collectRow && (
        <CollectModal
          row={collectRow}
          branches={branches}
          onClose={() => setCollectRow(null)}
          onDone={() => { setCollectRow(null); load(true); }}
        />
      )}
    </DrivingPage>
  );
}
