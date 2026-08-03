import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CarFront, Plus, Receipt, RefreshCw, Trash2, TrendingDown, Wallet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import {
  createExpense, deleteExpense, fetchExpenses, updateExpense,
} from '../../lib/api/modules';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from '../driving/_shared';
import { formatDate, formatDateTime } from '../../lib/format';

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
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((x) => [x.value, x.label]));
const money = (v) => `${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const dateTime = (v) => (v ? formatDateTime(v) : '—');
const dateOnly = (v) => (v ? formatDate(v) : '—');
const todayInput = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { category: 'Fuel', title: '', amount: '', expenseDate: todayInput(), vendorName: '', invoiceNo: '', vehicleId: '', note: '' };

function ExpenseModal({ initial, vehicles, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const editing = Boolean(initial.id);
  const hasVehicles = vehicles.length > 0;

  const submit = async () => {
    const amount = Number(form.amount);
    if (form.title.trim().length < 2) { toast({ title: 'Gider başlığı en az 2 karakter olmalıdır', variant: 'destructive' }); return; }
    if (!amount || amount <= 0) { toast({ title: 'Geçerli bir tutar girin', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        title: form.title.trim(),
        vendorName: form.vendorName.trim(),
        invoiceNo: form.invoiceNo.trim(),
        amount,
        expenseDateUtc: form.expenseDate ? new Date(`${form.expenseDate}T12:00:00Z`).toISOString() : null,
        vehicleId: form.vehicleId || null,
        note: form.note.trim(),
      };
      if (editing) await updateExpense(initial.id, payload);
      else await createExpense(payload);
      toast({ title: editing ? 'Gider güncellendi' : 'Gider faturası oluşturuldu' });
      onSaved();
    } catch (e) {
      toast({ title: 'Gider kaydedilemedi', description: e.message, variant: 'destructive' });
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', vehicleId: '', from: '', to: '' });
  const [modal, setModal] = useState(null); // null | form-object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.vehicleId) params.vehicleId = filters.vehicleId;
      if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).toISOString();
      if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
      setData(await fetchExpenses(params));
    } catch (e) {
      toast({ title: 'Giderler alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    if (!window.confirm(`"${item.title}" giderini silmek istiyor musunuz?`)) return;
    try {
      await deleteExpense(item.id);
      toast({ title: 'Gider silindi' });
      await load();
    } catch (e) {
      toast({ title: 'Silinemedi', description: e.message, variant: 'destructive' });
    }
  };

  const vehicles = data?.vehicles || [];
  const hasVehicles = vehicles.length > 0;
  const items = data?.items || [];
  const summary = data?.summary || { total: 0, count: 0, byCategory: [] };
  const topCategory = useMemo(() => (summary.byCategory || [])[0], [summary]);

  if (loading && !data) return <DrivingLoading />;

  return (
    <DrivingPage testId="finance-expenses-page">
      <DrivingPageHeader
        title="Giderler"
        description="Kurumun işletme giderleri: kira, fatura, mazot, bakım, sigorta ve diğer gider faturaları. (Personel maaş/primi burada tutulmaz.)"
        icon={TrendingDown}
        onRefresh={load}
        actions={<Button onClick={() => setModal({ ...EMPTY_FORM })}><Plus className="mr-2 h-4 w-4" />Gider Ekle</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Toplam Gider" value={money(summary.total)} caption="Seçili filtrede" icon={TrendingDown} tone="rose" />
        <DrivingStatCard label="Kayıt" value={summary.count} caption="Gider faturası" icon={Receipt} tone="brand" />
        <DrivingStatCard label="En yüksek kalem" value={topCategory ? CATEGORY_LABEL[topCategory.category] || topCategory.category : '—'} caption={topCategory ? money(topCategory.total) : 'Kayıt yok'} icon={Wallet} tone="amber" />
        {hasVehicles ? (
          <DrivingStatCard label="Araç gideri" value={money((summary.byCategory || []).filter((x) => x.category === 'Fuel' || x.category === 'Maintenance').reduce((s, x) => s + Number(x.total), 0))} caption="Mazot + bakım" icon={CarFront} tone="violet" />
        ) : (
          <DrivingStatCard label="Sabit gider" value={money((summary.byCategory || []).filter((x) => x.category === 'Rent' || x.category === 'Utilities').reduce((s, x) => s + Number(x.total), 0))} caption="Kira + fatura" icon={Wallet} tone="violet" />
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
        <DrivingNotice icon={Receipt} title="Gider kaydı yok" message="Bu filtrede gider bulunamadı. Sağ üstten yeni bir gider faturası ekleyebilirsiniz." />
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
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateOnly(item.expenseDateUtc)}
                    {item.vendorName ? ` • ${item.vendorName}` : ''}
                    {item.invoiceNo ? ` • Fatura: ${item.invoiceNo}` : ''}
                  </p>
                  {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
                  {/* Detay: kim oluşturdu, hangi şube, ne zaman. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Oluşturan: <b className="text-foreground">{item.createdByName || '—'}</b>
                    {item.branchName ? ` • Şube: ${item.branchName}` : ''}
                    {` • ${dateTime(item.createdAtUtc)}`}
                    {item.updatedAtUtc ? ' • (düzenlendi)' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-lg font-black text-rose-600">{money(item.amount)}</span>
                  <Button size="sm" variant="outline" onClick={() => setModal({
                    id: item.id, category: item.category, title: item.title, amount: String(item.amount),
                    expenseDate: item.expenseDateUtc ? item.expenseDateUtc.slice(0, 10) : todayInput(),
                    vendorName: item.vendorName || '', invoiceNo: item.invoiceNo || '', vehicleId: item.vehicleId || '', note: item.note || '',
                  })}>Düzenle</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && <ExpenseModal initial={modal} vehicles={vehicles} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </DrivingPage>
  );
}
