import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, Save, Briefcase, Mail, Phone, BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createStaff, fetchStaff } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const roles = [
  { value: 'Teacher', label: 'Ogretmen' },
  { value: 'Accounting', label: 'Muhasebe' },
  { value: 'Administrative', label: 'Idari Personel' },
  { value: 'Admin', label: 'Yonetici' },
];

const emptyForm = {
  fullName: '',
  username: '',
  password: '',
  email: '',
  phone: '',
  primaryRole: 'Teacher',
  departmentOrBranch: '',
  campus: '',
  notes: '',
};

export default function AdminStaffRegistration() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [recentStaff, setRecentStaff] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.username || !form.password) {
      toast({ title: 'Ad soyad, kullanici adi ve sifre zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await createStaff({
        fullName: form.fullName,
        username: form.username,
        password: form.password,
        email: form.email,
        phone: form.phone,
        primaryRole: form.primaryRole,
        departmentOrBranch: form.departmentOrBranch,
        campus: form.campus,
        notes: form.notes || undefined,
      });
      toast({ title: 'Personel basariyla kaydedildi.' });
      setForm(emptyForm);
      loadRecent();
    } catch (err) {
      toast({ title: err.message || 'Kayit basarisiz.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl text-white">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Personel Kaydi</h1>
          <p className="text-sm text-muted-foreground">Yeni personel kayit formu</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personel Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ad Soyad *</Label>
                  <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Orn: Ayse Demir" />
                </div>
                <div>
                  <Label>Kullanici Adi *</Label>
                  <Input value={form.username} onChange={(e) => handleChange('username', e.target.value)} placeholder="Orn: ayse.demir" />
                </div>
                <div>
                  <Label>Sifre *</Label>
                  <Input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="En az 6 karakter" />
                </div>
                <div>
                  <Label>Rol *</Label>
                  <Select value={form.primaryRole} onValueChange={(v) => handleChange('primaryRole', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>E-posta</Label>
                  <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="ornek@email.com" />
                </div>
                <div>
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="05XX XXX XX XX" />
                </div>
                <div>
                  <Label>Brans / Bolum</Label>
                  <Input value={form.departmentOrBranch} onChange={(e) => handleChange('departmentOrBranch', e.target.value)} placeholder="Orn: Matematik" />
                </div>
                <div>
                  <Label>Kampus</Label>
                  <Input value={form.campus} onChange={(e) => handleChange('campus', e.target.value)} placeholder="Orn: Merkez Kampus" />
                </div>
              </div>
              <div>
                <Label>Notlar</Label>
                <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Ek bilgiler..." rows={2} />
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

        {/* Recent */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Son Kayitlar</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><LoadingDots /></div>
              ) : recentStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henuz kayit yok.</p>
              ) : (
                <div className="space-y-3">
                  {recentStaff.map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600">
                        {(s.fullName || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.primaryRole || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
