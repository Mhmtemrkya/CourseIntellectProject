import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Search, Wallet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import {
  fetchDrivingBranches, fetchDrivingCollectionList, fetchDrivingStudentGroups,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import PendingDownPayments from '../../components/finance/PendingDownPayments';
// Tahsilat penceresi Cari Hesaplar ekranıyla ortaktır; akış tek yerde durur.
import CollectModal from '../../components/finance/DrivingCollectModal';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';
import { formatDate, formatMoney as money } from '../../lib/format';

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

// "2026-09" → "Eylül 2026"
const monthLabel = (value) => {
  const [year, month] = String(value).split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

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
                    ? `${monthLabel(dueMonth)} vadesi: ${formatDate(r.monthDue.dueDateUtc)}${r.monthDue.count > 1 ? ` (${r.monthDue.count} taksit)` : ''}`
                    : r.nextDueDateUtc ? `Sıradaki vade: ${formatDate(r.nextDueDateUtc)}` : 'Vade yok'}
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
