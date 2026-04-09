import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, Save, Users, School, Phone, Mail, MapPin, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createStudent, fetchStudents } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const emptyForm = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  className: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  address: '',
  birthDate: '',
  gender: '',
  notes: '',
};

export default function AdminStudentRegistration() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchStudents().catch(() => []);
      setRecentStudents(Array.isArray(data) ? data.slice(-5).reverse() : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.username) {
      toast({ title: 'Ad soyad ve kullanici adi zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await createStudent({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone,
        className: form.className,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        parentEmail: form.parentEmail,
        address: form.address,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        notes: form.notes || undefined,
      });
      toast({ title: 'Ogrenci basariyla kaydedildi.' });
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
        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ogrenci Kaydi</h1>
          <p className="text-sm text-muted-foreground">Yeni ogrenci kayit formu</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ogrenci Bilgileri</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="personal">
                <TabsList className="mb-4">
                  <TabsTrigger value="personal">Kisisel</TabsTrigger>
                  <TabsTrigger value="parent">Veli</TabsTrigger>
                  <TabsTrigger value="other">Diger</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Ad Soyad *</Label>
                      <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Orn: Ahmet Yilmaz" />
                    </div>
                    <div>
                      <Label>Kullanici Adi *</Label>
                      <Input value={form.username} onChange={(e) => handleChange('username', e.target.value)} placeholder="Orn: ahmet.yilmaz" />
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
                      <Label>Sinif</Label>
                      <Input value={form.className} onChange={(e) => handleChange('className', e.target.value)} placeholder="Orn: 10-A" />
                    </div>
                    <div>
                      <Label>Dogum Tarihi</Label>
                      <Input type="date" value={form.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)} />
                    </div>
                    <div>
                      <Label>Cinsiyet</Label>
                      <Select value={form.gender} onValueChange={(v) => handleChange('gender', v)}>
                        <SelectTrigger><SelectValue placeholder="Seciniz" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Erkek</SelectItem>
                          <SelectItem value="female">Kiz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="parent" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Veli Adi</Label>
                      <Input value={form.parentName} onChange={(e) => handleChange('parentName', e.target.value)} placeholder="Veli adi soyadi" />
                    </div>
                    <div>
                      <Label>Veli Telefon</Label>
                      <Input value={form.parentPhone} onChange={(e) => handleChange('parentPhone', e.target.value)} placeholder="05XX XXX XX XX" />
                    </div>
                    <div className="col-span-2">
                      <Label>Veli E-posta</Label>
                      <Input type="email" value={form.parentEmail} onChange={(e) => handleChange('parentEmail', e.target.value)} placeholder="veli@email.com" />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4">
                  <div>
                    <Label>Adres</Label>
                    <Textarea value={form.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Ev adresi" rows={3} />
                  </div>
                  <div>
                    <Label>Notlar</Label>
                    <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Ek bilgiler..." rows={2} />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Ogrenciyi Kaydet'}
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
              ) : recentStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henuz kayit yok.</p>
              ) : (
                <div className="space-y-3">
                  {recentStudents.map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600">
                        {(s.fullName || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.className || '-'}</p>
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
