import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileSignature, FileText, Plus, Trash2, Eye, Save, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createConsentTemplate,
  deleteConsentTemplate,
  downloadConsentTemplatePreview,
  fetchConsentCatalog,
  fetchConsentTemplates,
  updateConsentTemplate,
  uploadConsentDocument,
} from '../../lib/api/modules';
import { cn } from '@/lib/utils';

const PLACEHOLDERS = [
  ['{{ogrenci}}', 'Öğrenci / kursiyer adı'],
  ['{{veli}}', 'Veli adı'],
  ['{{tc}}', 'TC / kimlik no'],
  ['{{sinif}}', 'Sınıf veya sertifika sınıfı'],
  ['{{ogrencino}}', 'Okul / kursiyer numarası'],
  ['{{telefon}}', 'İletişim telefonu'],
  ['{{adres}}', 'Adres'],
  ['{{kurum}}', 'Kurum adı'],
  ['{{personel}}', 'Formu hazırlayan personel'],
  ['{{konu}}', 'İşlem / hizmet adı'],
  ['{{tarih}}', 'Bugünün tarihi'],
];

// Boş sayfa vermek yerine doldurulabilir bir iskelet: kurum düzenleyerek başlar.
const STARTER_BODY = `1. GENEL BİLGİLENDİRME
Ben, {{ogrenci}} ({{tc}}), {{kurum}} bünyesinde {{konu}} kapsamında yürütülecek
faaliyetler hakkında bilgilendirildim.

2. SORUMLULUKLAR
• Kurum kurallarına uyacağımı kabul ederim.
• Verdiğim bilgilerin doğru olduğunu beyan ederim.

3. KİŞİSEL VERİLER
Kişisel verilerimin 6698 sayılı KVKK kapsamında, yalnızca eğitim ve yasal
yükümlülüklerin yerine getirilmesi amacıyla işlenmesine rıza gösteriyorum.

Veli / Yasal temsilci: {{veli}}
Tarih: {{tarih}}`;

const STARTER_ITEMS = [
  'Yukarıdaki metnin tamamını okudum ve anladım.',
  'Verdiğim bilgilerin doğru olduğunu beyan ederim.',
  'Kişisel verilerimin işlenmesine rıza gösteriyorum.',
  'Kurum kurallarına uyacağımı kabul ederim.',
];

const SIGNER_ROLES = [
  { value: 'StudentOrParent', label: 'Öğrenci veya veli' },
  { value: 'Student', label: 'Öğrencinin kendisi' },
  { value: 'Parent', label: 'Veli / yasal temsilci' },
];

const MODULE_LABEL = { all: 'Ortak', school: 'Okul', driving: 'Sürücü kursu' };

function emptyDraft(sourceKind = 'Text') {
  return {
    id: null,
    title: '',
    // PDF kaynaklı formda gövde belgenin yerine geçmez; tablette belgenin
    // üstünde görünen kısa açıklamadır, bu yüzden boş başlar.
    body: sourceKind === 'Pdf' ? '' : STARTER_BODY,
    checkItems: [...STARTER_ITEMS],
    requiresSignature: true,
    signerRole: 'StudentOrParent',
    isActive: true,
    sortOrder: 0,
    bindings: [],
    sourceKind,
    documentId: null,
    documentFileName: '',
    documentPageCount: 0,
  };
}

export default function ConsentTemplates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [contextKinds, setContextKinds] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [list, catalog] = await Promise.all([
        fetchConsentTemplates(true),
        fetchConsentCatalog().catch(() => ({ contextKinds: [] })),
      ]);
      setTemplates(list);
      setContextKinds(catalog?.contextKinds || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groupedKinds = useMemo(() => {
    const groups = new Map();
    contextKinds.forEach((kind) => {
      const bucket = groups.get(kind.module) || [];
      bucket.push(kind);
      groups.set(kind.module, bucket);
    });
    return [...groups.entries()];
  }, [contextKinds]);

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const document = await uploadConsentDocument(file);
      setDraft((current) => ({
        ...current,
        sourceKind: 'Pdf',
        documentId: document.id,
        documentFileName: document.fileName,
        documentPageCount: document.pageCount,
        title: current.title.trim() || document.fileName.replace(/\.pdf$/i, ''),
      }));
      toast({ title: 'Belge yüklendi', description: `${document.fileName} · ${document.pageCount} sayfa` });
    } catch (uploadError) {
      toast({ title: 'Belge yüklenemedi', description: uploadError.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast({ title: 'Başlık zorunlu', description: 'Forma bir başlık verin.', variant: 'destructive' });
      return;
    }
    if (draft.sourceKind === 'Pdf' && !draft.documentId) {
      toast({ title: 'PDF seçilmedi', description: 'PDF kaynaklı form için bir belge yükleyin.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        body: draft.body,
        checkItems: draft.checkItems.map((item) => item.trim()).filter(Boolean),
        requiresSignature: draft.requiresSignature,
        signerRole: draft.signerRole,
        isActive: draft.isActive,
        sortOrder: Number(draft.sortOrder) || 0,
        bindings: draft.bindings,
        sourceKind: draft.sourceKind || 'Text',
        documentId: draft.sourceKind === 'Pdf' ? draft.documentId : null,
      };
      if (draft.id) await updateConsentTemplate(draft.id, payload);
      else await createConsentTemplate(payload);

      toast({ title: draft.id ? 'Form güncellendi' : 'Form oluşturuldu' });
      setDraft(null);
      await load();
    } catch (saveError) {
      toast({ title: 'Form kaydedilemedi', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (template) => {
    if (!window.confirm(`"${template.title}" formu silinsin mi?\n\nDaha önce İMZALANMIŞ belgeler silinmez; yalnız şablon ve bağlı olduğu akışlar kaldırılır.`)) return;
    try {
      await deleteConsentTemplate(template.id);
      toast({ title: 'Form silindi', description: 'İmzalanmış belgeler öğrenci dosyalarında duruyor.' });
      await load();
    } catch (removeError) {
      toast({ title: 'Form silinemedi', description: removeError.message, variant: 'destructive' });
    }
  };

  const preview = async (template) => {
    try {
      const blob = await downloadConsentTemplatePreview(template.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (previewError) {
      toast({ title: 'Önizleme açılamadı', description: previewError.message, variant: 'destructive' });
    }
  };

  const toggleBinding = (kind, key = '') => {
    setDraft((current) => {
      const exists = current.bindings.some((item) => item.contextKind === kind && (item.contextKey || '') === key);
      return {
        ...current,
        bindings: exists
          ? current.bindings.filter((item) => !(item.contextKind === kind && (item.contextKey || '') === key))
          : [...current.bindings, { contextKind: kind, contextKey: key }],
      };
    });
  };

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))] text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading">Onam Formları</h1>
              <p className="text-sm text-muted-foreground">
                Öğrenci ve velilerden tablette imza alınacak onam / izin metinleri.
              </p>
            </div>
          </div>
        </div>
        {!draft ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDraft(emptyDraft('Pdf'))}>
              <Upload className="mr-1.5 h-4 w-4" /> PDF yükle
            </Button>
            <Button onClick={() => setDraft(emptyDraft())}>
              <Plus className="mr-1.5 h-4 w-4" /> Yeni form
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? 'Formu düzenle' : 'Yeni onam formu'}</CardTitle>
            <CardDescription>
              Metindeki yer tutucular kayıt açılırken sunucuda doldurulur; karşılığı olmayan alan
              için elle doldurulabilir noktalı boşluk bırakılır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Form başlığı</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Örn. Veli Muvafakatnamesi ve KVKK Açık Rıza Metni"
                />
              </div>
              <div className="space-y-1.5">
                <Label>İmzalayan</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.signerRole}
                  onChange={(event) => setDraft({ ...draft, signerRole: event.target.value })}
                >
                  {SIGNER_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sıra</Label>
                <Input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
                />
              </div>
            </div>

            {draft.sourceKind === 'Pdf' ? (
              <div className="space-y-1.5">
                <Label>Belge (PDF)</Label>
                <Input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={uploadDocument} />
                {draft.documentId ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{draft.documentFileName}</span>
                    <Badge variant="secondary">{draft.documentPageCount} sayfa</Badge>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {uploading ? 'Yükleniyor…' : 'Yüklenen belge olduğu gibi korunur; imza bilgisi sona eklenen tutanak sayfasına basılır.'}
                  </p>
                )}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>{draft.sourceKind === 'Pdf' ? 'Tablette belgenin üstünde görünecek açıklama (isteğe bağlı)' : 'Form metni'}</Label>
              <Textarea
                rows={draft.sourceKind === 'Pdf' ? 4 : 14}
                className="font-mono text-xs leading-relaxed"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PLACEHOLDERS.map(([token, description]) => (
                  <button
                    key={token}
                    type="button"
                    title={description}
                    onClick={() => setDraft({ ...draft, body: `${draft.body}${token}` })}
                    className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Onay maddeleri</Label>
              {draft.checkItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(event) => {
                      const next = [...draft.checkItems];
                      next[index] = event.target.value;
                      setDraft({ ...draft, checkItems: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft({ ...draft, checkItems: draft.checkItems.filter((_, i) => i !== index) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft({ ...draft, checkItems: [...draft.checkItems, ''] })}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Madde ekle
              </Button>
              <p className="text-xs text-muted-foreground">
                Müşteri tablette bu maddelerin TAMAMINI işaretlemeden imza atamaz.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hangi akışlarda zorunlu?</Label>
              {groupedKinds.map(([module, kinds]) => (
                <div key={module} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {MODULE_LABEL[module] || module}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {kinds.map((kind) => {
                      const active = draft.bindings.some(
                        (item) => item.contextKind === kind.kind && !(item.contextKey || ''),
                      );
                      return (
                        <button
                          key={kind.kind}
                          type="button"
                          title={kind.description}
                          onClick={() => toggleBinding(kind.kind)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition',
                            active
                              ? 'border-[hsl(var(--brand-accent)/0.5)] bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]'
                              : 'border-border/60 text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {kind.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.requiresSignature}
                  onCheckedChange={(value) => setDraft({ ...draft, requiresSignature: value })}
                />
                İmza zorunlu
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(value) => setDraft({ ...draft, isActive: value })}
                />
                Aktif
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>Vazgeç</Button>
              <Button onClick={save} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tanımlı formlar</CardTitle>
          <CardDescription>
            Formlar öğrenci kartından, randevudan ve cari hesaptan &ldquo;Onam Merkezi&rdquo; ile tablete gönderilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz form tanımlanmadı. &ldquo;Yeni form&rdquo; ile başlayın.
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{template.title}</p>
                    {template.sourceKind === 'Pdf' ? (
                      <Badge variant="secondary">PDF · {template.documentPageCount} sayfa</Badge>
                    ) : null}
                    {!template.isActive ? <Badge variant="secondary">Pasif</Badge> : null}
                    {!template.requiresSignature ? <Badge variant="outline">İmzasız</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.checkItems.length} onay maddesi ·{' '}
                    {template.bindings.length > 0
                      ? template.bindings
                          .map((binding) => contextKinds.find((k) => k.kind === binding.contextKind)?.label || binding.contextKind)
                          .join(', ')
                      : 'hiçbir akışa bağlı değil'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => preview(template)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> Önizle
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...template, sortOrder: template.sortOrder })}>
                    Düzenle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(template)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
