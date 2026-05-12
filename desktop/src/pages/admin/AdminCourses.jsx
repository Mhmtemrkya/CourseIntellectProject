import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Edit, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
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
  createCourse,
  deleteCourse,
  fetchCourses,
  updateCourse,
} from '../../lib/api/modules';

const emptyForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  duration: '',
  level: '',
  isActive: true,
};

function moneyLabel(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? `TL ${parsed.toLocaleString('tr-TR')}` : String(value || '-');
}

export default function AdminCourses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchCourses({ search: search.trim() || undefined });
      setCourses(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Kurslar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const stats = useMemo(() => ({
    total: courses.length,
    active: courses.filter((item) => item.isActive).length,
    passive: courses.filter((item) => !item.isActive).length,
  }), [courses]);

  const openCreate = () => {
    setEditingCourse(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setForm({
      name: course.name || '',
      description: course.description || '',
      category: course.category || '',
      price: String(course.price ?? ''),
      duration: course.duration || '',
      level: course.level || '',
      isActive: course.isActive !== false,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Kurs adı zorunludur.', variant: 'destructive' });
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      price: Number(String(form.price || '0').replace(',', '.')) || 0,
      duration: form.duration.trim(),
      level: form.level.trim(),
      isActive: Boolean(form.isActive),
    };

    try {
      setSaving(true);
      if (editingCourse?.id) {
        await updateCourse(editingCourse.id, payload);
        toast({ title: 'Kurs güncellendi.' });
      } else {
        await createCourse(payload);
        toast({ title: 'Kurs oluşturuldu.' });
      }
      setFormOpen(false);
      setEditingCourse(null);
      setForm(emptyForm);
      await loadCourses();
    } catch (err) {
      toast({ title: err.message || 'Kurs kaydedilemedi.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course) => {
    const confirmed = window.confirm(`${course.name} kursu silinsin mi?`);
    if (!confirmed) return;

    try {
      await deleteCourse(course.id);
      toast({ title: 'Kurs silindi.' });
      await loadCourses();
    } catch (err) {
      toast({ title: err.message || 'Kurs silinemedi.', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-courses-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline">Kurs katalogu</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Kurs Yönetimi</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Kurumdaki kurs ve programları ekle, düzenle, pasife al veya sil.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Toplam', stats.total],
              ['Aktif', stats.active],
              ['Pasif', stats.passive],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-muted/30 px-5 py-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="Kurslar yüklenemedi" message={error} onRetry={loadCourses} /> : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Kurs ara..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadCourses}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Yenile
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Kurs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {courses.map((course) => (
          <Card key={course.id} className="overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-brand-primary" />
                    {course.name}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {course.category || 'Kategori yok'} - {course.level || 'Seviye yok'} - {course.duration || 'Süre yok'}
                  </p>
                </div>
                <Badge className={course.isActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                  {course.isActive ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                {course.description || 'Bu kurs için açıklama girilmemiş.'}
              </p>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Ücret</p>
                <p className="mt-1 text-xl font-bold">{moneyLabel(course.price)}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => openEdit(course)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(course)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sil
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Kayıtlı kurs bulunamadı.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Kursu Düzenle' : 'Yeni Kurs'}</DialogTitle>
            <DialogDescription>Kurs katalog kaydı canlı backend üzerinde saklanır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Kurs Adı</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ücret</Label>
              <Input value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Süre</Label>
              <Input value={form.duration} onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Seviye</Label>
              <Input value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Açıklama</Label>
              <Textarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2">
              <div>
                <Label>Aktif</Label>
                <p className="text-sm text-muted-foreground">Kurs katalogda görünsün.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
