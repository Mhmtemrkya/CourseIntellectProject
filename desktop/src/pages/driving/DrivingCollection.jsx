import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Search, Wallet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  fetchDrivingBranches, fetchDrivingCollectionList, fetchDrivingInstallments, fetchDrivingStudentGroups, recordDrivingPayment,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
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
const METHODS = ['Nakit', 'Kart', 'Havale'];

function CollectModal({ row, branches, onClose, onDone }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(row.overdueAmount > 0 ? String(row.overdueAmount) : (row.remaining > 0 ? String(row.remaining) : ''));
  const [method, setMethod] = useState('Nakit');
  const [branchId, setBranchId] = useState('');
  const [note, setNote] = useState('');
  const [installments, setInstallments] = useState([]);
  const [installmentId, setInstallmentId] = useState(''); // '' = otomatik (en eski vade)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDrivingInstallments(row.profileId)
      .then((list) => { if (active) setInstallments(list || []); })
      .catch(() => { if (active) setInstallments([]); });
    return () => { active = false; };
  }, [row.profileId]);

  const pickInstallment = (id) => {
    setInstallmentId(id);
    const chosen = installments.find((x) => x.id === id);
    if (chosen) setAmount(String(chosen.remaining));
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ödeme Al — {row.fullName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Kalan borç</span><b>{money(row.remaining)}</b></div>
            {row.overdueAmount > 0 && <div className="flex justify-between text-red-600"><span>Gecikmiş</span><b>{money(row.overdueAmount)}</b></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Kayıt şubesi</span><b>{row.registrationBranchName || '—'}</b></div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Taksit</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={installmentId} onChange={(e) => pickInstallment(e.target.value)}>
              <option value="">Otomatik (en eski vadeden mahsup)</option>
              {installments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label || `${i.seqNo}. taksit`} • {new Date(i.dueDateUtc).toLocaleDateString('tr-TR')} • {money(i.remaining)}{i.overdue ? ' (gecikmiş)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Tutar (₺)</label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Yöntem</label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Tahsilat şubesi</label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">{branches.length ? 'Varsayılan (kendi şubem)' : 'Varsayılan'}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Not</label>
            <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Alınıyor…' : 'Tahsilatı Kaydet'}</Button>
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

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    if (!term) return rows;
    return rows.filter((r) => (r.fullName || '').toLocaleLowerCase('tr-TR').includes(term));
  }, [rows, search]);

  const totals = useMemo(() => ({
    remaining: rows.reduce((s, r) => s + (r.remaining || 0), 0),
    overdue: rows.reduce((s, r) => s + (r.overdueAmount || 0), 0),
    overdueCount: rows.filter((r) => r.overdueCount > 0).length,
  }), [rows]);

  if (loading) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-collection-page">
      <DrivingPageHeader
        title="Ödeme Al"
        description="Tüm kursiyerler — önce aktifler, taksidi en önde olan başta. Tahsilatı istediğiniz şubeden alın."
        icon={Wallet}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <DrivingStatCard label="Toplam kalan borç" value={money(totals.remaining)} caption="Listedeki kursiyerler" icon={Banknote} tone="brand" />
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
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kursiyer ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <DrivingNotice icon={CheckCircle2} title="Kayıt yok." message="Bu filtrede kursiyer bulunamadı." />
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
                  {r.nextDueDateUtc ? `Sıradaki vade: ${new Date(r.nextDueDateUtc).toLocaleDateString('tr-TR')}` : 'Vade yok'}
                  {' • '}Kayıt: {r.registrationBranchName || '—'}{r.registrarName ? ` (${r.registrarName})` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-black">{money(r.remaining)}</p>
                  {r.overdueAmount > 0 && <p className="text-xs font-bold text-red-600">{money(r.overdueAmount)} gecikmiş</p>}
                </div>
                {canCollect && r.hasContract && (
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
