import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, Plus, Search, UserPlus, Users, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { createDrivingLead, fetchDrivingLeadPackageOptions, fetchDrivingLeads, updateDrivingLead } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { isValidTrPhone, maskTrPhone } from '../../lib/inputMasks';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';
import { formatDate } from '../../lib/format';

const STATUS = {
  New: { label: 'Yeni', className: 'bg-blue-500/15 text-blue-600' },
  Contacted: { label: 'Arandı', className: 'bg-amber-500/15 text-amber-600' },
  Registered: { label: 'Kayıt oldu', className: 'bg-emerald-500/15 text-emerald-600' },
  Lost: { label: 'Kaybedildi', className: 'bg-red-500/15 text-red-600' },
};
const FILTERS = [['all', 'Tümü'], ['New', 'Yeni'], ['Contacted', 'Arandı'], ['Registered', 'Kayıt oldu'], ['Lost', 'Kaybedildi']];

export default function DrivingLeads() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can } = useDrivingPermissions();
  const canManage = can(DRIVING.leadManage);
  const canConvert = can(DRIVING.leadConvert);
  const [leads, setLeads] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ fullName: '', phone: '', packageId: '', source: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRows, packageRows] = await Promise.all([
        fetchDrivingLeads(filter === 'all' ? {} : { status: filter }),
        canManage ? fetchDrivingLeadPackageOptions() : Promise.resolve([]),
      ]);
      setLeads(leadRows || []);
      setPackages(packageRows || []);
      setForm((current) => ({
        ...current,
        packageId: (packageRows || []).some((item) => item.id === current.packageId)
          ? current.packageId
          : '',
      }));
    } catch (error) {
      toast({ title: 'Aday adayları alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [canManage, filter, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    if (!term) return leads;
    return leads.filter((x) => (x.fullName || '').toLocaleLowerCase('tr-TR').includes(term) || (x.phone || '').includes(term));
  }, [leads, search]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidTrPhone(form.phone)) {
      toast({ title: 'Telefon eksik veya geçersiz', description: '+90 5XX XXX XX XX biçiminde bir cep telefonu girin.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createDrivingLead(form);
      toast({ title: 'Aday adayı eklendi' });
      setForm({ fullName: '', phone: '', packageId: '', source: '', note: '' });
      await load();
    } catch (error) {
      toast({ title: 'Eklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (lead, status) => {
    try {
      await updateDrivingLead(lead.id, { status });
      await load();
    } catch (error) {
      toast({ title: 'Güncellenemedi', description: error.message, variant: 'destructive' });
    }
  };

  // Kayda dönüştürme: sihirbaz lead bilgileriyle ön dolu açılır; kayıt
  // tamamlanınca sihirbaz convert ucunu çağırıp lead'i dosyaya bağlar.
  const convert = (lead) => navigate(
    `/driving/students/new?leadId=${lead.id}&name=${encodeURIComponent(lead.fullName)}&phone=${encodeURIComponent(lead.phone || '')}&licenseClass=${encodeURIComponent(lead.licenseClass || '')}`,
  );

  if (loading && leads.length === 0) return <DrivingLoading />;

  const openCount = leads.filter((x) => x.status === 'New' || x.status === 'Contacted').length;

  return (
    <DrivingPage testId="driving-leads-page">
      <DrivingPageHeader
        title="Aday Adayları"
        description="Arayan/soran adayları kaydedin, arandı olarak işaretleyin, kayda dönüştürün — dönem kontenjanını buradan planlayın."
        icon={PhoneCall}
        onRefresh={load}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <DrivingStatCard label="Açık aday" value={openCount} caption="Yeni + arandı" icon={PhoneCall} tone="brand" />
        <DrivingStatCard label="Kayda dönüşen" value={leads.filter((x) => x.status === 'Registered').length} caption="Bu listeden" icon={UserPlus} tone="emerald" />
        <DrivingStatCard label="Kaybedilen" value={leads.filter((x) => x.status === 'Lost').length} caption="Takipten çıkan" icon={XCircle} tone="violet" />
      </div>

      {canManage && (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Input required className="lg:col-span-2" placeholder="Ad soyad" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input required placeholder="+90 5XX XXX XX XX" inputMode="tel" autoComplete="tel" maxLength={17} value={form.phone} onChange={(e) => setForm({ ...form, phone: maskTrPhone(e.target.value) })} />
          <select
            required
            aria-label="Eğitim paketi"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            value={form.packageId}
            disabled={packages.length === 0}
            onChange={(e) => setForm({ ...form, packageId: e.target.value })}
          >
            <option value="">{packages.length === 0 ? 'Önce paket tanımlayın' : 'Paket seçin'}</option>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>{item.name} • {item.licenseClass} • {Number(item.transmissionType) === 1 ? 'Manuel' : 'Otomatik'}</option>
            ))}
          </select>
          <Input placeholder="Kaynak (tabela, sosyal medya…)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <Button disabled={saving || packages.length === 0}><Plus className="mr-2 h-4 w-4" />Ekle</Button>
        </form>
      )}

      {canManage && packages.length === 0 && !loading && (
        <DrivingNotice icon={Users} title="Aktif paket bulunamadı." message="Aday adayı eklemek için önce Paketler sayfasından eğitim paketi tanımlayın." />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === key ? 'border-brand-primary bg-brand-primary text-white' : 'border-foreground/15 bg-foreground/[0.03] text-muted-foreground hover:border-[hsl(var(--brand-accent)/0.5)]'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ad veya telefon ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <DrivingNotice icon={Users} title="Aday adayı yok." message="Arayan/soran adayları buradan takip edin." />
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const tone = STATUS[lead.status] || { label: lead.status, className: 'bg-muted text-foreground' };
            return (
              <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="truncate">{lead.fullName}</b>
                    <Badge className={`border-0 ${tone.className}`}>{tone.label}</Badge>
                    <span className="text-xs text-muted-foreground">{lead.licenseClass}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {maskTrPhone(lead.phone) || 'Telefon yok'}
                    {lead.source ? ` • ${lead.source}` : ''}
                    {' • '}{formatDate(lead.createdAtUtc)}
                    {lead.note ? ` • ${lead.note}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {canManage && lead.status === 'New' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(lead, 'Contacted')}><PhoneCall className="mr-1 h-3 w-3" />Arandı</Button>
                  )}
                  {canConvert && (lead.status === 'New' || lead.status === 'Contacted') && (
                    <Button size="sm" className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={() => convert(lead)}>
                      <UserPlus className="mr-1 h-3 w-3" />Kayda Dönüştür
                    </Button>
                  )}
                  {canManage && (lead.status === 'New' || lead.status === 'Contacted') && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(lead, 'Lost')}>Kaybedildi</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DrivingPage>
  );
}
