import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, CheckCircle2, GraduationCap, Megaphone, PlusCircle, Users, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Checkbox } from '../../components/ui/checkbox';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createAnnouncement, fetchAnnouncements, fetchClasses, fetchStudents } from '../../lib/api/modules';

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function normalizeClassName(value = '') {
  return normalizeText(value).replaceAll('-', '').replaceAll(' ', '');
}

function uniqueParents(students) {
  return Array.from(
    new Map(
      students
        .filter((item) => item.parentName || item.parentEmail)
        .map((item) => {
          const key = `${normalizeText(item.parentEmail || item.parentName)}:${normalizeText(item.className)}`;
          const parentEmail = normalizeText(item.parentEmail);
          const parentUsername = parentEmail.includes('@') ? parentEmail.split('@')[0] : parentEmail;
          return [key, {
            keys: [
              parentEmail ? `parent-email:${parentEmail}` : '',
              parentUsername ? `parent-username:${parentUsername}` : '',
              item.parentName ? `parent-name:${normalizeText(item.parentName)}` : '',
            ].filter(Boolean),
            label: item.parentName ? `${item.parentName} • ${item.className}` : `${item.parentEmail} • ${item.className}`,
            helper: item.parentEmail || 'E-posta kaydı yok',
          }];
        }),
    ).values(),
  );
}

const defaultForm = {
  title: '',
  detail: '',
  audience: 'Veli',
  targetClassName: '',
  targetRecipientType: 'Veliler',
  recipientKeys: [],
  recipientLabels: [],
};

export default function TeacherAnnouncements() {
  const { toast } = useToast();
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [teacherItems, parentItems, studentItems, classItems, studentList] = await Promise.all([
        // Backend audience normalize standardı: Ogrenci / Veli / Ogretmen / Tum Kurum.
        // 'Teacher' alias backend tarafında eşlenmediği için 'Ogretmen' kullanılıyor.
        fetchAnnouncements('Ogretmen').catch(() => []),
        fetchAnnouncements({
          audience: 'Veli',
          includeAll: true,
        }).catch(() => []),
        fetchAnnouncements({
          audience: 'Ogrenci',
          includeAll: true,
        }).catch(() => []),
        fetchClasses().catch(() => []),
        fetchStudents().catch(() => []),
      ]);

      const mergedClasses = [...new Map(
        [...classItems, ...studentList.map((item) => item.className)]
          .filter(Boolean)
          .map((item) => [normalizeClassName(item), item]),
      ).values()];

      setStudents(studentList);
      setClasses(mergedClasses);
      setAnnouncements(
        [...teacherItems, ...parentItems, ...studentItems]
          .filter((item) => !String(item.detail || '').startsWith('LIVE_LESSON'))
          .sort((a, b) => `${b.createdAtUtc || b.createdAt || b.dateLabel}`.localeCompare(`${a.createdAtUtc || a.createdAt || a.dateLabel}`)),
      );
      setForm((prev) => ({
        ...prev,
        targetClassName: prev.targetClassName || mergedClasses[0] || '',
      }));
    } catch (err) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const scopedStudents = useMemo(() => {
    if (!form.targetClassName) return students;
    const normalizedClass = normalizeClassName(form.targetClassName);
    return students.filter((item) => normalizeClassName(item.className) === normalizedClass);
  }, [form.targetClassName, students]);

  const recipientOptions = useMemo(() => {
    if (form.audience === 'Veli') {
      if (form.targetRecipientType === 'Öğrenciler') {
        return scopedStudents.map((item) => ({
          keys: [`student:${normalizeText(item.username || item.fullName)}`],
          label: `${item.fullName} • ${item.className}`,
          helper: item.parentName || item.parentEmail || 'Veli kaydı',
        }));
      }
      return uniqueParents(scopedStudents);
    }

    if (form.audience === 'Ogrenci') {
      return scopedStudents.map((item) => ({
        keys: [`student:${normalizeText(item.username || item.fullName)}`],
        label: `${item.fullName} • ${item.className}`,
        helper: item.username || 'Öğrenci hesabı',
      }));
    }

    return [];
  }, [form.audience, form.targetRecipientType, scopedStudents]);

  const summaryStats = useMemo(() => {
    const parentCount = announcements.filter((item) => item.audience === 'Veli').length;
    const studentCount = announcements.filter((item) => item.audience === 'Ogrenci').length;
    const targetedCount = announcements.filter((item) => (item.recipientCount || 0) > 0).length;
    return { parentCount, studentCount, targetedCount };
  }, [announcements]);

  const toggleRecipient = (option) => {
    setForm((prev) => {
      const primaryKey = option.keys[0];
      const exists = prev.recipientKeys.includes(primaryKey);
      const nextKeys = exists
        ? prev.recipientKeys.filter((key) => !option.keys.includes(key))
        : [...prev.recipientKeys, ...option.keys];
      const nextLabels = exists
        ? prev.recipientLabels.filter((label) => label !== option.label)
        : [...prev.recipientLabels, option.label];
      return {
        ...prev,
        recipientKeys: nextKeys,
        recipientLabels: nextLabels,
      };
    });
  };

  const handleCreate = async () => {
    if ((form.audience === 'Veli' || form.audience === 'Ogrenci') && form.recipientKeys.length === 0) {
      toast({
        title: 'Hedef kişi seçin',
        description: 'Bu duyurunun kimlerde görüneceğini belirlemek için listeden kişi seçmeniz gerekiyor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const created = await createAnnouncement({
        ...form,
        createdByName: user?.name || 'Öğretmen',
        createdByRole: 'Teacher',
        createdByUsername: user?.username || '',
      });
      setAnnouncements((prev) => [created, ...prev]);
      setOpen(false);
      setForm({
        ...defaultForm,
        targetClassName: classes[0] || '',
      });
      toast({ title: 'Duyuru yayınlandı', description: 'Seçtiğiniz kişi listesine özel duyuru gönderildi.' });
    } catch (err) {
      toast({ title: 'Duyuru yayınlanamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-announcements-page">
      <section className="rounded-[32px] border border-brand-primary/10 bg-[linear-gradient(135deg,var(--brand-primary-hex)_0%,var(--brand-accent-hex)_100%)] p-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="bg-white/12 text-white hover:bg-white/12">Öğretmen Duyuru Merkezi</Badge>
            <div>
              <h1 className="text-3xl font-bold font-heading">Sınıf seç, kişiyi belirle, doğrudan hedefe yayınla</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/75">
                Velilere veya öğrencilere toplu ama seçili kişi bazlı duyuru gönder. Her kayıt daha sonra yönetici ekranında tüm detaylarıyla izlenebilir.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Veli Duyurusu', value: summaryStats.parentCount, icon: UsersRound },
              { label: 'Öğrenci Duyurusu', value: summaryStats.studentCount, icon: GraduationCap },
              { label: 'Seçili Kişi', value: summaryStats.targetedCount, icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <item.icon className="h-5 w-5 text-white/85" />
                <p className="mt-3 text-2xl font-bold">{item.value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/65">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading">Yayınlanan Duyurular</h2>
          <p className="text-muted-foreground mt-1">Seçili kişi listesine giden veli ve öğrenci duyuruları burada tutulur.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg"><PlusCircle className="h-4 w-4 mr-2" />Yeni Duyuru</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="bg-[linear-gradient(180deg,var(--brand-primary-hex)_0%,var(--brand-accent-hex)_100%)] px-7 py-8 text-white">
                <Badge className="bg-white/12 text-white hover:bg-white/12">Hedefli yayın</Badge>
                <DialogHeader className="mt-4 space-y-2 text-left">
                  <DialogTitle className="text-3xl font-bold text-white">Kime gideceğini sen belirle</DialogTitle>
                </DialogHeader>
                <p className="mt-3 text-sm leading-7 text-white/78">
                  Özellikle veli duyurularında sınıf seç, sonra öğrenci veya veli listesi üstünden sadece istediğin kişileri işaretle. Bu duyuru sadece o bağlı hesaplarda görünsün.
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    'Önce hedef kitleyi ve sınıfı seç.',
                    'Sonra öğrenci mi veli mi listesiyle çalışacağına karar ver.',
                    'İşaretlediğin kişiler dışında kimse bu duyuruyu görmesin.',
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Başlık</Label>
                    <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Veli bilgilendirmesi başlığı" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Kitle</Label>
                    <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.audience} onChange={(e) => setForm((prev) => ({
                      ...prev,
                      audience: e.target.value,
                      recipientKeys: [],
                      recipientLabels: [],
                    }))}>
                      <option value="Veli">Veliler</option>
                      <option value="Ogrenci">Öğrenciler</option>
                      <option value="Teacher">Öğretmenler</option>
                      <option value="Tum Kurum">Tüm Kurum</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sınıf</Label>
                    <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.targetClassName} onChange={(e) => setForm((prev) => ({
                      ...prev,
                      targetClassName: e.target.value,
                      recipientKeys: [],
                      recipientLabels: [],
                    }))}>
                      {classes.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  {form.audience === 'Veli' ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Liste Kaynağı</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {['Veliler', 'Öğrenciler'].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, targetRecipientType: item, recipientKeys: [], recipientLabels: [] }))}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${form.targetRecipientType === item ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-primary/10 bg-brand-primary/5 text-slate-700'}`}
                          >
                            <p className="font-semibold">{item}</p>
                            <p className={`mt-1 text-xs ${form.targetRecipientType === item ? 'text-white/70' : 'text-slate-500'}`}>
                              {item === 'Veliler' ? 'Sınıftaki velileri doğrudan seç.' : 'Seçtiğin öğrencilerin bağlı velilerine göster.'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2 md:col-span-2">
                    <Label>İçerik</Label>
                    <Textarea value={form.detail} onChange={(e) => setForm((prev) => ({ ...prev, detail: e.target.value }))} rows={5} placeholder="Duyuru içeriğini yazın" />
                  </div>
                  {(form.audience === 'Veli' || form.audience === 'Ogrenci') ? (
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label>Seçili Kişiler</Label>
                        <Badge variant="outline">{form.recipientKeys.length} seçildi</Badge>
                      </div>
                      <div className="rounded-[24px] border border-brand-primary/10 bg-brand-primary/5 p-3">
                        <ScrollArea className="h-64 pr-2">
                          <div className="space-y-2">
                            {recipientOptions.map((option) => {
                              const checked = form.recipientKeys.includes(option.keys[0]);
                              return (
                                <label key={option.keys[0]} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${checked ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-primary/10 bg-white text-slate-800'}`}>
                                  <Checkbox checked={checked} onCheckedChange={() => toggleRecipient(option)} className={checked ? 'border-white data-[state=checked]:bg-white data-[state=checked]:text-brand-primary' : ''} />
                                  <div className="min-w-0">
                                    <p className="font-medium">{option.label}</p>
                                    <p className={`text-xs ${checked ? 'text-white/70' : 'text-slate-500'}`}>{option.helper}</p>
                                  </div>
                                </label>
                              );
                            })}
                            {recipientOptions.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-brand-primary/10 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                Önce sınıf seçin. Bu sınıfta kişi kaydı yoksa liste burada görünür olmayacak.
                              </div>
                            ) : null}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : null}
                </div>
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                  <Button onClick={handleCreate}>Yayınla</Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <ErrorBanner title="Duyurular alınamadı" message={error} onRetry={loadAnnouncements} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {announcements.map((item) => (
          <Card key={item.id || item.title} className="overflow-hidden border-brand-primary/10 shadow-sm">
            <div className="bg-[linear-gradient(135deg,var(--brand-primary-hex)_0%,var(--brand-accent-hex)_100%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/12 text-white hover:bg-white/12">{item.audience || 'Genel'}</Badge>
                    {item.targetClassName ? <Badge className="bg-white/12 text-white hover:bg-white/12">{item.targetClassName}</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold">{item.title}</h3>
                </div>
                <Megaphone className="h-6 w-6 text-white/70" />
              </div>
            </div>
            <CardContent className="space-y-5 p-6">
              <p className="text-sm leading-7 text-slate-600">{item.detail}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-brand-primary/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Kime</p>
                  <p className="mt-2 font-semibold text-slate-900">{item.targetRecipientType || item.audience}</p>
                </div>
                <div className="rounded-2xl bg-brand-primary/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Seçili Kişi</p>
                  <p className="mt-2 font-semibold text-slate-900">{item.recipientCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-brand-primary/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Tarih</p>
                  <p className="mt-2 font-semibold text-slate-900">{item.dateLabel || item.date || 'Bugün'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(item.recipientLabels || []).slice(0, 6).map((label) => (
                  <Badge key={label} variant="outline">{label}</Badge>
                ))}
                {(item.recipientLabels || []).length > 6 ? <Badge variant="outline">+{item.recipientLabels.length - 6} kişi daha</Badge> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
