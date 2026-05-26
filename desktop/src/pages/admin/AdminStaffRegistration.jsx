import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Briefcase, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createStaff, fetchStaff } from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const roles = [
  { value: 'Teacher', label: 'Öğretmen' },
  { value: 'Administrative', label: 'İdari Personel' },
  { value: 'Cafeteria', label: 'Yemekhaneci' },
];

const branchOptions = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
  'Türkçe / Edebiyat', 'Tarih', 'Coğrafya',
  'İngilizce', 'Almanca', 'Fransızca', 'İspanyolca',
  'Felsefe', 'Din Kültürü ve Ahlak Bilgisi',
  'Beden Eğitimi', 'Müzik', 'Görsel Sanatlar',
  'Bilgisayar / Bilişim Teknolojileri',
  'Matematik (İlkokul)', 'Türkçe (İlkokul)',
  'Hayat Bilgisi', 'Fen Bilimleri',
  'Sosyal Bilgiler', 'Rehberlik',
  'Okul Öncesi', 'Özel Eğitim',
  'Diğer',
];

const administrativeBranches = [
  'Öğrenci İşleri', 'İnsan Kaynakları', 'Halkla İlişkiler', 'Kalite', 'Bilgi İşlem', 'Diğer',
];

const cafeteriaBranches = ['Yemekhane'];

const emptyForm = {
  fullName: '',
  role: 'Teacher',
  departmentOrBranch: '',
  tcNo: '',
  phone: '',
  education: 'Lisans',
  startDate: '',
  campus: 'Merkez Kampus',
  homeroomClass: '',
  maritalStatus: 'Bekar',
  childCount: 0,
  note: '',
};

export default function AdminStaffRegistration() {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [recentStaff, setRecentStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);

  const loadRecent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchStaff().catch(() => []);
      setRecentStaff(Array.isArray(data) ? data.slice(-5).reverse() : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'role'
        ? { departmentOrBranch: value === 'Cafeteria' ? 'Yemekhane' : '' }
        : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast({ title: 'Ad soyad zorunludur.', variant: 'destructive' });
      return;
    }
    if (!form.departmentOrBranch.trim()) {
      toast({ title: 'Branş / bölüm seçimi zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const response = await createStaff({
        fullName: form.fullName.trim(),
        role: form.role,
        departmentOrBranch: form.departmentOrBranch,
        tcNo: form.tcNo.trim(),
        phone: form.phone.trim(),
        email: '',
        education: form.education.trim(),
        startDate: form.startDate.trim(),
        campus: form.campus.trim(),
        homeroomClass: form.homeroomClass.trim(),
        assignedClasses: [],
        maritalStatus: form.maritalStatus,
        childCount: Number(form.childCount || 0),
        note: form.note.trim(),
      });
      const roleLabel = form.role === 'Cafeteria'
        ? 'Yemekhaneci'
        : form.role === 'Administrative' ? 'İdari Personel' : 'Öğretmen';
      const fullName = response?.fullName || form.fullName.trim();
      setCredentials({
        fullName,
        username: response?.username,
        password: response?.password,
        roleLabel,
        branch: form.departmentOrBranch,
      });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName,
          role: roleLabel,
          username: response?.username,
          temporaryPassword: response?.password,
          extra: form.departmentOrBranch ? `Brans: ${form.departmentOrBranch}` : undefined,
        });
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      toast({ title: 'Personel başarıyla kaydedildi.', description: 'Bilgiler PDF olarak indirildi.' });
      setForm(emptyForm);
      loadRecent();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Kayıt başarısız.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const text = `Kullanıcı adı: ${credentials.username}\nGeçici Şifre: ${credentials.password}`;
    await navigator.clipboard?.writeText(text);
    toast({ title: 'Giriş bilgileri kopyalandı.' });
  };

  const downloadAgain = async () => {
    if (!credentials) return;
    await downloadCredentialsPdf({
      tenantName,
      fullName: credentials.fullName,
      role: credentials.roleLabel,
      username: credentials.username,
      temporaryPassword: credentials.password,
      extra: credentials.branch ? `Brans: ${credentials.branch}` : undefined,
    });
  };

  const branchList = form.role === 'Cafeteria'
    ? cafeteriaBranches
    : form.role === 'Administrative' ? administrativeBranches : branchOptions;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl text-white">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Personel Kaydı</h1>
          <p className="text-sm text-muted-foreground">
            Öğretmen, idari personel veya yemekhaneci kaydı. Kullanıcı adı ve geçici şifre otomatik üretilir.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personel Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ad Soyad *</Label>
                  <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Örn: Ayşe Demir" />
                </div>
                <div>
                  <Label>Rol *</Label>
                  <Select value={form.role} onValueChange={(v) => handleChange('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{form.role === 'Teacher' ? 'Branş *' : 'Birim *'}</Label>
                  <Select value={form.departmentOrBranch} onValueChange={(v) => handleChange('departmentOrBranch', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={form.role === 'Teacher' ? 'Branş seçin...' : 'Birim seçin...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {branchList.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>TC Kimlik No</Label>
                  <Input maxLength={11} value={form.tcNo} onChange={(e) => handleChange('tcNo', e.target.value.replace(/\D/g, ''))} />
                </div>
                <div>
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="05XX XXX XX XX" />
                </div>
                <div>
                  <Label>Eğitim</Label>
                  <Input value={form.education} onChange={(e) => handleChange('education', e.target.value)} />
                </div>
                <div>
                  <Label>İşe Başlama Tarihi</Label>
                  <Input value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} placeholder="gg.aa.yyyy" />
                </div>
                <div>
                  <Label>Kampüs</Label>
                  <Input value={form.campus} onChange={(e) => handleChange('campus', e.target.value)} />
                </div>
                {form.role === 'Teacher' && (
                  <div>
                    <Label>Sınıf Öğretmenliği (opsiyonel)</Label>
                    <Input value={form.homeroomClass} onChange={(e) => handleChange('homeroomClass', e.target.value)} placeholder="Örn: 9-A" />
                  </div>
                )}
                <div>
                  <Label>Medeni Durum</Label>
                  <Select value={form.maritalStatus} onValueChange={(v) => handleChange('maritalStatus', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bekar">Bekar</SelectItem>
                      <SelectItem value="Evli">Evli</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Çocuk Sayısı</Label>
                  <Input type="number" min="0" value={form.childCount} onChange={(e) => handleChange('childCount', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notlar</Label>
                <Textarea value={form.note} onChange={(e) => handleChange('note', e.target.value)} placeholder="Ek bilgiler..." rows={2} />
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                <strong>Bilgi:</strong> Personel kaydedildiğinde kurum domain'inizi kullanan bir kullanıcı adı
                ve güçlü bir geçici şifre otomatik üretilir. Personel ilk girişinde şifresini değiştirmek zorundadır.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Personeli Kaydet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Son Kayıtlar</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><LoadingDots /></div>
              ) : recentStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz kayıt yok.</p>
              ) : (
                <div className="space-y-3">
                  {recentStaff.map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600">
                        {(s.fullName || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.primaryRole || s.role || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credentials?.roleLabel} Oluşturuldu</DialogTitle>
            <DialogDescription>
              Bilgiler PDF olarak indirildi. Kaybederseniz aşağıdan tekrar indirebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Ad Soyad</p>
              <p className="mt-1 font-medium">{credentials?.fullName || '-'}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Kullanıcı Adı</p>
              <p className="mt-1 font-mono text-base font-bold break-all">{credentials?.username || '-'}</p>
            </div>
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</p>
              <p className="mt-1 font-mono text-base font-bold tracking-wider">{credentials?.password || '-'}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">İlk girişte değiştirilmesi zorunludur.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentials(null)}>Kapat</Button>
            <Button variant="outline" onClick={copyCredentials}>
              <Copy className="mr-2 h-4 w-4" /> Kopyala
            </Button>
            <Button onClick={downloadAgain}>PDF İndir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
