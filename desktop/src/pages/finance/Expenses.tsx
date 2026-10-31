import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CarFront, Check, Clock, Plus, Receipt, RefreshCw, Trash2, TrendingDown, Wallet, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  createExpense, decideExpense, deleteExpense, fetchExpenses, updateExpense,
} from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';
import { Page, PageHeader, PageLoading, PageNotice, StatCard } from '../../components/layout/PageKit';
import { formatDate, formatDateTime } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import type { ExpenseItem, ExpenseListResponse, ExpenseQuery } from '../../lib/api/expenses';
import type { ExpenseRequest } from '../../types/api/generated';

/** Gider formu: tutar/tarih metin olarak tutulur, kaydederken çevrilir. */
interface ExpenseForm {
  id?: string;
  category: string;
  title: string;
  amount: string;
  expenseDate: string;
  vendorName: string;
  invoiceNo: string;
  vehicleId: string;
  note: string;
  paymentMethod: string;
}

type Vehicle = ExpenseListResponse['vehicles'][number];

// Backend enum'larıyla birebir; personel maaş/primi kasıtlı olarak YOK.
const CATEGORIES = [
  { value: 'Fuel', label: 'Mazot / Yakıt' },
  { value: 'Maintenance', label: 'Bakım / Onarım' },
  { value: 'Insurance', label: 'Sigorta / Kasko' },
  { value: 'Rent', label: 'Kira' },
  { value: 'Utilities', label: 'Fatura / Abonelik' },
  { value: 'TaxFee', label: 'Vergi / Harç' },
  { value: 'Office', label: 'Kırtasiye / Ofis' },
  { value: 'Marketing', label: 'Reklam / Tanıtım' },
  { value: 'Other', label: 'Diğer' },
];
const CATEGORY_LABEL: Partial<Record<string, string>> = Object.fromEntries(CATEGORIES.map((x) => [x.value, x.label]));
const money = (v: unknown) => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const dateTime = (v: string | null | undefined) => (v ? formatDateTime(v) : '—');
const dateOnly = (v: string | null | undefined) => (v ? formatDate(v) : '—');
const todayInput = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: ExpenseForm = { category: 'Fuel', title: '', amount: '', expenseDate: todayInput(), vendorName: '', invoiceNo: '', vehicleId: '', note: '', paymentMethod: 'Havale' };

/** Onay rozeti: yalnız onaylı gider toplamlara ve kasaya girer. */
function ApprovalBadge({ status }: { status: string }) {
  if (status === 'Bekliyor') return <Badge className="bg-amber-100 text-amber-700"><Clock className="mr-1 h-3 w-3" />Onay bekliyor</Badge>;
  if (status === 'Reddedildi') return <Badge className="bg-red-100 text-red-700"><X className="mr-1 h-3 w-3" />Reddedildi</Badge>;
  return null;
}

interface ExpenseModalProps {
  initial: ExpenseForm;
  vehicles: readonly Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}

function ExpenseModal({ initial, vehicles, onClose, onSaved }: ExpenseModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ExpenseForm>(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ExpenseForm>) => setForm((f) => ({ ...f, ...patch }));
  const editing = Boolean(initial.id);
  const hasVehicles = vehicles.length > 0;

  const submit = async () => {
    const amount = Number(form.amount);
    if (form.title.trim().length < 2) { toast({ title: 'Gider başlığı en az 2 karakter olmalıdır', variant: 'destructive' }); return; }
    if (!amount || amount <= 0) { toast({ title: 'Geçerli bir tutar girin', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload: ExpenseRequest = {
        category: form.category,
        title: form.title.trim(),
        vendorName: form.vendorName.trim(),
        invoiceNo: form.invoiceNo.trim(),
        amount,
        expenseDateUtc: form.expenseDate ? new Date(`${form.expenseDate}T12:00:00Z`).toISOString() : null,
        vehicleId: form.vehicleId || null,
        note: form.note.trim(),
        paymentMethod: form.paymentMethod,
      };
      const saved = initial.id ? await updateExpense(initial.id, payload) : await createExpense(payload);
      toast({
        title: editing ? 'Gider güncellendi' : 'Gider faturası oluşturuldu',
        description: saved?.approvalStatus === 'Bekliyor' ? 'Yönetici onayından sonra gider toplamına girer.' : undefined,
      });
      onSaved();
    } catch (e) {
      toast({ title: 'Gider kaydedilemedi', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-brand-primary" />{editing ? 'Gideri Düzenle' : 'Yeni Gider Faturası'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-muted-foreground">Kategori
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-muted-foreground">Gider tarihi
              <Input type="date" className="mt-1" value={form.expenseDate} onChange={(e) => set({ expenseDate: e.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-bold text-muted-foreground">Başlık / açıklama
            <Input className="mt-1" maxLength={200} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Örn: Kira / elektrik / mazot" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-muted-foreground">Tutar (TL)
              <Input type="number" min="0" step="0.01" className="mt-1 text-lg font-bold" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </label>
            {hasVehicles ? (
              <label className="text-xs font-bold text-muted-foreground">İlgili araç (opsiyonel)
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
                  <option value="">— Yok —</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-xs font-bold text-muted-foreground">Tedarikçi (opsiyonel)
                <Input className="mt-1" maxLength={200} value={form.vendorName} onChange={(e) => set({ vendorName: e.target.value })} placeholder="Örn: Enerjisa / Oto Servis" />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hasVehicles ? (
              <label className="text-xs font-bold text-muted-foreground">Tedarikçi (opsiyonel)
                <Input className="mt-1" maxLength={200} value={form.vendorName} onChange={(e) => set({ vendorName: e.target.value })} placeholder="Örn: Shell / Oto Servis" />
              </label>
            ) : null}
            <label className="text-xs font-bold text-muted-foreground">Fatura no (opsiyonel)
              <Input className="mt-1" maxLength={60} value={form.invoiceNo} onChange={(e) => set({ invoiceNo: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-muted-foreground">Ödeme yöntemi
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
                <option value="Havale">Havale/EFT</option>
                <option value="Nakit">Nakit (kasadan)</option>
                <option value="Kredi Kartı">Kredi Kartı</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-bold text-muted-foreground">Not (opsiyonel)
            <Input className="mt-1" maxLength={1000} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Kaydediliyor…' : editing ? 'Güncelle' : 'Gideri Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Expenses() {
  const { toast } = useToast();
  const [data, setData] = useState<ExpenseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', vehicleId: '', from: '', to: '' });
  const [modal, setModal] = useState<ExpenseForm | null>(null);
  const { user } = useApp();
  // Sunucuda karar ucu yalnız yönetici (şube müdürü yönetici yetkisi taşır).
  const canDecide = ['admin', 'branchmanager'].includes(String(user?.backendRole || user?.role || '').toLowerCase());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: ExpenseQuery = {};
      if (filters.category) params.category = filters.category;
      if (filters.vehicleId) params.vehicleId = filters.vehicleId;
      if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).toISOString();
      if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
      setData(await fetchExpenses(params));
    } catch (e) {
      toast({ title: 'Giderler alınamadı', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (item: ExpenseItem) => {
    if (!window.confirm(`"${item.title}" giderini silmek istiyor musunuz?`)) return;
    try {
      await deleteExpense(item.id);
      toast({ title: 'Gider silindi' });
      await load();
    } catch (e) {
      toast({ title: 'Silinemedi', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const decide = async (item: ExpenseItem, decision: 'approve' | 'reject') => {
    try {
      await decideExpense(item.id, decision);
      toast({ title: decision === 'approve' ? 'Gider onaylandı' : 'Gider reddedildi' });
      await load();
    } catch (e) {
      toast({ title: 'İşlem yapılamadı', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const vehicles = data?.vehicles || [];
  const hasVehicles = vehicles.length > 0;
  const items = data?.items || [];
  const summary = data?.summary || { total: 0, count: 0, byCategory: [], pendingCount: 0, pendingTotal: 0 };
  const topCategory = useMemo(() => (summary.byCategory || [])[0], [summary]);

  if (loading && !data) return <PageLoading />;

  return (
    <Page testId="finance-expenses-page">
      <PageHeader
        title="Giderler"
        description="Kurumun işletme giderleri: kira, fatura, mazot, bakım, sigorta ve diğer gider faturaları. (Personel maaş/primi burada tutulmaz.)"
        icon={TrendingDown}
        onRefresh={load}
        actions={<Button onClick={() => setModal({ ...EMPTY_FORM })}><Plus className="mr-2 h-4 w-4" />Gider Ekle</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Toplam Gider" value={money(summary.total)} caption={`${summary.count} onaylı kayıt`} icon={TrendingDown} tone="rose" />
        <StatCard label="Onay bekleyen" value={summary.pendingCount || 0} caption={money(summary.pendingTotal || 0)} icon={Clock} tone="brand" />
        <StatCard label="En yüksek kalem" value={topCategory ? CATEGORY_LABEL[topCategory.category] || topCategory.category : '—'} caption={topCategory ? money(topCategory.total) : 'Kayıt yok'} icon={Wallet} tone="amber" />
        {hasVehicles ? (
          <StatCard label="Araç gideri" value={money((summary.byCategory || []).filter((x) => x.category === 'Fuel' || x.category === 'Maintenance').reduce((s, x) => s + Number(x.total), 0))} caption="Mazot + bakım" icon={CarFront} tone="violet" />
        ) : (
          <StatCard label="Sabit gider" value={money((summary.byCategory || []).filter((x) => x.category === 'Rent' || x.category === 'Utilities').reduce((s, x) => s + Number(x.total), 0))} caption="Kira + fatura" icon={Wallet} tone="violet" />
        )}
      </div>

      <div className={`grid gap-3 rounded-2xl border p-4 ${hasVehicles ? 'md:grid-cols-[200px_200px_1fr_1fr_auto]' : 'md:grid-cols-[200px_1fr_1fr_auto]'}`}>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
          <option value="">Tüm kategoriler</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {hasVehicles ? (
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.vehicleId} onChange={(e) => setFilters((f) => ({ ...f, vehicleId: e.target.value }))}>
            <option value="">Tüm araçlar</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />Başlangıç<Input type="date" className="h-10" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Bitiş<Input type="date" className="h-10" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Yenile</Button>
      </div>

      {items.length === 0 ? (
        <PageNotice icon={Receipt} title="Gider kaydı yok" message="Bu filtrede gider bulunamadı. Sağ üstten yeni bir gider faturası ekleyebilirsiniz." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <section key={item.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="truncate">{item.title}</b>
                    <Badge variant="outline">{CATEGORY_LABEL[item.category] || item.category}</Badge>
                    {item.vehiclePlate ? <Badge variant="outline" className="border-brand-primary/40 text-brand-primary"><CarFront className="mr-1 h-3 w-3" />{item.vehiclePlate}</Badge> : null}
                    <ApprovalBadge status={item.approvalStatus} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateOnly(item.expenseDateUtc)}
                    {item.vendorName ? ` • ${item.vendorName}` : ''}
                    {item.invoiceNo ? ` • Fatura: ${item.invoiceNo}` : ''}
                    {item.paymentMethod ? ` • ${item.paymentMethod}` : ''}
                  </p>
                  {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
                  {/* Detay: kim oluşturdu, hangi şube, ne zaman. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Oluşturan: <b className="text-foreground">{item.createdByName || '—'}</b>
                    {item.branchName ? ` • Şube: ${item.branchName}` : ''}
                    {` • ${dateTime(item.createdAtUtc)}`}
                    {item.updatedAtUtc ? ' • (düzenlendi)' : ''}
                    {item.approvedByName && item.approvalStatus !== 'Bekliyor' ? ` • ${item.approvalStatus === 'Reddedildi' ? 'Reddeden' : 'Onaylayan'}: ${item.approvedByName}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-lg font-black ${item.approvalStatus === 'Onaylandı' ? 'text-rose-600' : 'text-muted-foreground line-through decoration-transparent'}`}>{money(item.amount)}</span>
                  {canDecide && item.approvalStatus === 'Bekliyor' ? (
                    <>
                      <Button size="sm" onClick={() => decide(item, 'approve')}><Check className="mr-1 h-4 w-4" />Onayla</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(item, 'reject')}><X className="mr-1 h-4 w-4" />Reddet</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setModal({
                    id: item.id, category: item.category, title: item.title, amount: String(item.amount),
                    expenseDate: item.expenseDateUtc ? item.expenseDateUtc.slice(0, 10) : todayInput(),
                    vendorName: item.vendorName || '', invoiceNo: item.invoiceNo || '', vehicleId: item.vehicleId || '', note: item.note || '',
                    paymentMethod: item.paymentMethod || 'Havale',
                  })}>Düzenle</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && <ExpenseModal initial={modal} vehicles={vehicles} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </Page>
  );
}
