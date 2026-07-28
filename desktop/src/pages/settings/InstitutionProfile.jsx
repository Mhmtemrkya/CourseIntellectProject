import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, FileText, Info, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchInstitutionProfile, saveInstitutionProfile } from '../../lib/api/modules';

// Belgeye basılan alanlar; sıra ekstrenin sağ üst köşesindeki sırayla aynıdır.
const FIELDS = [
  { key: 'name', label: 'Kurum adı', placeholder: 'Erzurum Koleji', required: true, span: 2 },
  { key: 'address', label: 'Adres', placeholder: 'Ömer Nasuhi Bilmen Mah. No:45', span: 2 },
  { key: 'district', label: 'İlçe', placeholder: 'Yakutiye' },
  { key: 'city', label: 'İl', placeholder: 'Erzurum' },
  { key: 'phone', label: 'Telefon', placeholder: '(0442) 123 45 67' },
  { key: 'email', label: 'E-posta', placeholder: 'info@kurumunuz.k12.tr' },
  { key: 'website', label: 'Web sitesi', placeholder: 'www.kurumunuz.k12.tr' },
  { key: 'taxOffice', label: 'Vergi dairesi', placeholder: 'Yakutiye' },
  { key: 'taxNumber', label: 'Vergi / TC kimlik no', placeholder: '1234567890' },
  {
    key: 'documentFooterNote',
    label: 'Belge alt notu',
    placeholder: 'Bu belge bilgilendirme amaçlıdır.',
    span: 2,
    hint: 'Boş bırakılırsa varsayılan bilgilendirme notu basılır.',
  },
];

const EMPTY = FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {});

export default function InstitutionProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState({ isConfigured: false, updatedAtUtc: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Künyeyi yalnız kurum yöneticisi değiştirebilir; diğer roller görüntüler.
  const canEdit = String(user?.role || '').toLowerCase() === 'admin';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchInstitutionProfile();
      setForm(FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: data?.[field.key] || '' }), {}));
      setMeta({ isConfigured: Boolean(data?.isConfigured), updatedAtUtc: data?.updatedAtUtc || null });
    } catch (err) {
      setError(err.message || 'Kurum künyesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const preview = useMemo(() => [
    form.name,
    form.address,
    [form.district, form.city ? form.city.toLocaleUpperCase('tr-TR') : ''].filter(Boolean).join(' / '),
    [form.taxOffice ? `Vergi D.: ${form.taxOffice}` : '', form.taxNumber ? `VKN: ${form.taxNumber}` : ''].filter(Boolean).join(' • '),
    form.phone ? `Tel: ${form.phone}` : '',
    form.email,
    form.website,
  ].filter(Boolean), [form]);

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Kurum adı zorunlu', description: 'Belge başlığında görünecek adı girin.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const saved = await saveInstitutionProfile(form);
      setMeta({ isConfigured: true, updatedAtUtc: saved?.updatedAtUtc || new Date().toISOString() });
      toast({
        title: 'Kurum künyesi kaydedildi',
        description: 'Bundan sonra üretilen ekstre ve belgelerde bu bilgiler görünecek.',
      });
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Kurum künyesi yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl"
      data-testid="institution-profile-page"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Ayarlar
          </Button>
          <h1 className="text-3xl font-bold font-heading">Kurum Künyesi</h1>
          <p className="text-muted-foreground mt-1">
            Ekstre, makbuz ve resmî belgelerin başlığında görünen kurum bilgileri
          </p>
        </div>
        <Badge variant={meta.isConfigured ? 'default' : 'outline'} className={meta.isConfigured ? 'bg-brand-primary text-white' : ''}>
          {meta.isConfigured ? 'Kaydedildi' : 'Henüz kaydedilmedi'}
        </Badge>
      </div>

      {error ? <ErrorBanner title="Kurum künyesi alınamadı" message={error} onRetry={load} /> : null}

      {!meta.isConfigured ? (
        <div className="flex gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Alanlar kurum kaydınızdaki mevcut bilgilerle dolduruldu. Kontrol edip kaydettiğinizde
            belgelerde bu künye kullanılır.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Kurum Bilgileri
          </CardTitle>
          <CardDescription>Belgelerin sağ üst köşesinde bu bilgiler yer alır</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className={`space-y-2 ${field.span === 2 ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor={`institution-${field.key}`}>
                {field.label}{field.required ? ' *' : ''}
              </Label>
              <Input
                id={`institution-${field.key}`}
                value={form[field.key]}
                placeholder={field.placeholder}
                disabled={!canEdit}
                onChange={(event) => set(field.key, event.target.value)}
              />
              {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Belge Başlığı Önizleme
          </CardTitle>
          <CardDescription>Ekstrenin sağ üst köşesi bu şekilde basılır</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-muted/40 p-5 text-right">
            {preview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bilgi girildikçe önizleme oluşur.</p>
            ) : preview.map((line, index) => (
              <p key={line} className={index === 0 ? 'font-bold' : 'text-sm text-muted-foreground'}>
                {index === 0 ? line.toLocaleUpperCase('tr-TR') : line}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex justify-end">
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Kaydediliyor…' : 'Künyeyi Kaydet'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Kurum künyesini yalnızca kurum yöneticisi değiştirebilir.</p>
      )}
    </motion.div>
  );
}
