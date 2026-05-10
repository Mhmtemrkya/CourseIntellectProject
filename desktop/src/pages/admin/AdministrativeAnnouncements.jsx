import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellRing,
  Eye,
  Megaphone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  fetchClasses,
  fetchStudents,
} from '../../lib/api/modules';

const emptyForm = {
  title: '',
  detail: '',
  audience: 'Tum Kurum',
  targetClassName: '',
  targetRecipientType: 'Veliler',
  recipientKeys: [],
  recipientLabels: [],
};

function roleLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('teacher') || normalized.includes('ogretmen') || normalized.includes('öğretmen')) return 'Öğretmen';
  if (normalized.includes('veli') || normalized.includes('parent')) return 'Veli';
  if (normalized.includes('ogrenci') || normalized.includes('öğrenci') || normalized.includes('student')) return 'Öğrenci';
  if (normalized.includes('admin')) return 'Yönetici';
  if (normalized.includes('administrative')) return 'İdari Birim';
  return value || 'Sistem';
}

function publisherLabel(item) {
  if (item.createdByName) return item.createdByName;
  const role = roleLabel(item.createdByRole);
  return role === 'Sistem' ? 'Sistem Kaydı' : `${role} Hesabı`;
}

function audienceLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('tum') || normalized.includes('tüm')) return 'Tüm Kurum';
  if (normalized.includes('ogrenci') || normalized.includes('öğrenci')) return 'Öğrenci';
  if (normalized.includes('ogretmen') || normalized.includes('öğretmen') || normalized.includes('teacher')) return 'Öğretmen';
  if (normalized.includes('veli')) return 'Veli';
  return value || 'Genel';
}

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll(' ', '')
    .replaceAll('-', '');
}

function classNameOf(value) {
  if (typeof value === 'string') return value;
  return value?.name || value?.className || '';
}

export default function AdministrativeAnnouncements() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [announcementPayload, studentPayload, classPayload] = await Promise.all([
        fetchAnnouncements({ includeAll: true }),
        fetchStudents().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      const safeAnnouncements = Array.isArray(announcementPayload) ? announcementPayload : [];
      const safeStudents = Array.isArray(studentPayload) ? studentPayload : [];
      const classNames = new Set([
        ...safeStudents.map((item) => item.className).filter(Boolean),
        ...(Array.isArray(classPayload) ? classPayload.map(classNameOf).filter(Boolean) : []),
      ]);

      setAnnouncements(
        safeAnnouncements
          .filter((item) => !String(item.detail || '').startsWith('LIVE_LESSON'))
          .sort((a, b) => `${b.createdAtUtc || b.createdAt || b.dateLabel}`.localeCompare(`${a.createdAtUtc || a.createdAt || a.dateLabel}`)),
      );
      setStudents(safeStudents);
      setClasses([...classNames].sort((a, b) => a.localeCompare(b, 'tr')));
    } catch (err) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (form.targetClassName || classes.length === 0) return;
    setForm((prev) => ({ ...prev, targetClassName: classes[0] }));
  }, [classes, form.targetClassName]);

  const recipientOptions = useMemo(() => {
    const needsRecipients = form.audience === 'Ogrenci' || form.audience === 'Veli';
    if (!needsRecipients) return [];

    const filteredStudents = students.filter((student) => {
      if (!form.targetClassName) return true;
      return normalizeText(student.className) === normalizeText(form.targetClassName);
    });

    if (form.audience === 'Veli' && form.targetRecipientType === 'Veliler') {
      const map = new Map();
      filteredStudents.forEach((student) => {
        const key = student.parentEmail || student.parentName || `${student.fullName}-parent`;
        if (!map.has(key)) {
          map.set(key, {
            key: `parent:${key}`,
            label: student.parentName ? `${student.parentName} - ${student.className}` : `${student.fullName} velisi`,
            helper: student.parentEmail || student.parentPhone || student.fullName,
          });
        }
      });
      return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
    }

    return filteredStudents
      .map((student) => ({
        key: `student:${student.username || student.fullName}`,
        label: `${student.fullName} - ${student.className}`,
        helper: student.username || student.parentName || 'Öğrenci hesabı',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [form.audience, form.targetClassName, form.targetRecipientType, students]);

  const stats = useMemo(() => ({
    total: announcements.length,
    targeted: announcements.filter((item) => (item.recipientCount || 0) > 0 || item.targetClassName).length,
    teachers: announcements.filter((item) => String(item.createdByRole || '').toLowerCase().includes('teacher')).length,
  }), [announcements]);

  const toggleRecipient = (option) => {
    setForm((prev) => {
      const selected = prev.recipientKeys.includes(option.key);
      return {
        ...prev,
        recipientKeys: selected
          ? prev.recipientKeys.filter((item) => item !== option.key)
          : [...prev.recipientKeys, option.key],
        recipientLabels: selected
          ? prev.recipientLabels.filter((item) => item !== option.label)
          : [...prev.recipientLabels, option.label],
      };
    });
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.detail.trim()) {
      toast({ title: 'Başlık ve içerik zorunludur.', variant: 'destructive' });
      return;
    }
    if ((form.audience === 'Ogrenci' || form.audience === 'Veli') && form.recipientKeys.length === 0) {
      toast({ title: 'Lütfen en az bir kişi seçin.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const created = await createAnnouncement({
        title: form.title.trim(),
        detail: form.detail.trim(),
        audience: form.audience,
        targetClassName: form.targetClassName,
        targetRecipientType: form.targetRecipientType,
        recipientKeys: form.recipientKeys,
        recipientLabels: form.recipientLabels,
      });
      setAnnouncements((prev) => [{
        ...created,
        targetClassName: form.targetClassName,
        targetRecipientType: form.targetRecipientType,
        recipientLabels: form.recipientLabels,
        recipientCount: form.recipientLabels.length,
      }, ...prev]);
      setForm(emptyForm);
      setCreateOpen(false);
      toast({ title: 'Duyuru oluşturuldu.' });
    } catch (err) {
      toast({ title: err.message || 'Duyuru oluşturulamadı.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`${item.title} duyurusu silinsin mi?`);
    if (!confirmed) return;
    try {
      await deleteAnnouncement(item.id);
      setAnnouncements((prev) => prev.filter((entry) => entry.id !== item.id));
      toast({ title: 'Duyuru silindi.' });
    } catch (err) {
      toast({ title: err.message || 'Duyuru silinemedi.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-announcements-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline">Yönetici duyuru denetimi</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Duyuru Merkezi</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Kurum genelindeki duyuruları oluştur, hedef kitleye göre yönet ve yayın akışını izle.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Toplam', stats.total, BellRing],
                ['Hedefli', stats.targeted, Users],
                ['Öğretmen', stats.teachers, ShieldCheck],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-2xl border bg-muted/30 px-5 py-4">
                  <Icon className="h-4 w-4 text-brand-primary" />
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Duyuru
            </Button>
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="Duyuru kayıtları alınamadı" message={error} onRetry={loadAnnouncements} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {announcements.map((item) => (
          <Card key={item.id || item.title} className="overflow-hidden border-border shadow-sm">
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{audienceLabel(item.audience)}</Badge>
                    {item.targetClassName ? <Badge variant="outline">{item.targetClassName}</Badge> : null}
                    {item.targetRecipientType ? <Badge variant="outline">{item.targetRecipientType}</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold">{item.title}</h3>
                </div>
                <Megaphone className="h-6 w-6 text-brand-primary" />
              </div>
            </div>
            <CardContent className="space-y-5 p-6 pt-0">
              <p className="text-sm leading-7 text-muted-foreground">{item.detail}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Yayınlayan</p>
                  <p className="mt-2 font-semibold text-foreground">{publisherLabel(item)}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel(item.createdByRole)}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Kime Gitti</p>
                  <p className="mt-2 font-semibold text-foreground">{item.targetRecipientType || item.audience}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Seçili Kişi</p>
                  <p className="mt-2 font-semibold text-foreground">{item.recipientCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tarih</p>
                  <p className="mt-2 font-semibold text-foreground">{item.dateLabel || item.date || 'Bugün'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(item.recipientLabels || []).slice(0, 4).map((label) => (
                    <Badge key={label} variant="outline">{label}</Badge>
                  ))}
                  {(item.recipientLabels || []).length > 4 ? <Badge variant="outline">+{item.recipientLabels.length - 4} kişi daha</Badge> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedAnnouncement(item)}>
                    <Eye className="mr-2 h-4 w-4" />
                    İncele
                  </Button>
                  <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(item)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Sil
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedAnnouncement?.title || 'Duyuru detayı'}</DialogTitle>
            <DialogDescription>
              {selectedAnnouncement ? `${roleLabel(selectedAnnouncement.createdByRole)} - ${publisherLabel(selectedAnnouncement)} - ${selectedAnnouncement.dateLabel || selectedAnnouncement.date || ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedAnnouncement ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-muted/50 p-6">
                <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Duyuru içeriği</p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">{selectedAnnouncement.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedAnnouncement.recipientLabels || []).map((label) => (
                  <Badge key={label} variant="outline" className="px-3 py-1">
                    <UserRound className="mr-2 h-3.5 w-3.5" />
                    {label}
                  </Badge>
                ))}
                {!selectedAnnouncement.recipientLabels?.length ? (
                  <p className="text-sm text-muted-foreground">Bu duyuru genel hedef kitleye yayınlanmış.</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setSelectedAnnouncement(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni Duyuru</DialogTitle>
            <DialogDescription>Hedef kitleyi, sınıfı ve gerekirse seçili kişi listesini belirle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Duyuru Başlığı</Label>
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hedef Kitle</Label>
                <Select
                  value={form.audience}
                  onValueChange={(value) => setForm((prev) => ({
                    ...prev,
                    audience: value,
                    recipientKeys: [],
                    recipientLabels: [],
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tum Kurum">Tüm Kurum</SelectItem>
                    <SelectItem value="Ogrenci">Öğrenciler</SelectItem>
                    <SelectItem value="Veli">Veliler</SelectItem>
                    <SelectItem value="Ogretmen">Öğretmenler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.audience === 'Ogrenci' || form.audience === 'Veli') ? (
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select
                    value={form.targetClassName || (classes[0] || '')}
                    onValueChange={(value) => setForm((prev) => ({
                      ...prev,
                      targetClassName: value,
                      recipientKeys: [],
                      recipientLabels: [],
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {form.audience === 'Veli' ? (
              <div className="space-y-2">
                <Label>Liste Kaynağı</Label>
                <Select
                  value={form.targetRecipientType}
                  onValueChange={(value) => setForm((prev) => ({
                    ...prev,
                    targetRecipientType: value,
                    recipientKeys: [],
                    recipientLabels: [],
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Veliler">Veliler</SelectItem>
                    <SelectItem value="Ogrenciler">Öğrenciler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Duyuru İçeriği</Label>
              <Textarea rows={5} value={form.detail} onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))} />
            </div>
            {recipientOptions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Seçili Kişiler</Label>
                  <Badge variant="outline">{form.recipientLabels.length} seçildi</Badge>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {recipientOptions.map((option) => {
                    const checked = form.recipientKeys.includes(option.key);
                    return (
                      <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/20 p-3">
                        <Checkbox checked={checked} onCheckedChange={() => toggleRecipient(option)} />
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="text-sm text-muted-foreground">{option.helper}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Yayınlanıyor...' : 'Duyuruyu Yayınla'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
