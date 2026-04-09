import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Save, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { createStudent, fetchStudents } from '../../lib/api/modules';

const emptyForm = {
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  studentName: '',
  className: '',
  currentSchool: '',
  note: '',
  programType: 'Genel Takip',
};

export default function AdminParentRegistration() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [classOptions, setClassOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    const students = await fetchStudents().catch(() => []);
    const classes = Array.from(new Set((students || []).map((item) => item.className).filter(Boolean))).sort();
    setClassOptions(classes);
    setForm((prev) => ({ ...prev, className: prev.className || classes[0] || '' }));
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const canSubmit = useMemo(() => form.parentName.trim() && form.studentName.trim(), [form.parentName, form.studentName]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({ title: 'Veli adı ve öğrenci adı zorunlu.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const created = await createStudent({
        fullName: form.studentName.trim(),
        tcNo: '',
        className: form.className,
        currentSchool: form.currentSchool,
        schoolNumber: '',
        birthDate: '',
        programType: form.programType,
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        address: '',
        note: form.note.trim(),
      });
      toast({
        title: 'Veli kaydı oluşturuldu',
        description: `Öğrenci hesabı: ${created.username}`,
      });
      setForm({ ...emptyForm, className: classOptions[0] || '' });
    } catch (err) {
      toast({
        title: 'Veli kaydı oluşturulamadı',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 p-3 text-white">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-heading">Veli Kaydı</h1>
          <p className="text-muted-foreground mt-1">Veli odaklı kayıt formu ile öğrenci-veli bağlantısını tek akışta oluşturun</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Veli ve Öğrenci Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Veli Ad Soyad</Label>
                <Input value={form.parentName} onChange={(e) => handleChange('parentName', e.target.value)} placeholder="Örn: Ayşe Yılmaz" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.parentPhone} onChange={(e) => handleChange('parentPhone', e.target.value)} placeholder="05XX XXX XX XX" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>E-posta</Label>
                <Input type="email" value={form.parentEmail} onChange={(e) => handleChange('parentEmail', e.target.value)} placeholder="veli@email.com" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Öğrenci Ad Soyad</Label>
                <Input value={form.studentName} onChange={(e) => handleChange('studentName', e.target.value)} placeholder="Örn: Ece Yılmaz" />
              </div>
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Select value={form.className} onValueChange={(value) => handleChange('className', value)}>
                  <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                  <SelectContent>
                    {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    {form.className && !classOptions.includes(form.className) ? <SelectItem value={form.className}>{form.className}</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Okul</Label>
                <Input value={form.currentSchool} onChange={(e) => handleChange('currentSchool', e.target.value)} placeholder="Okul adı" />
              </div>
              <div className="space-y-2">
                <Label>Takip Türü</Label>
                <Select value={form.programType} onValueChange={(value) => handleChange('programType', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Genel Takip">Genel Takip</SelectItem>
                    <SelectItem value="LGS Takip">LGS Takip</SelectItem>
                    <SelectItem value="YKS Sayısal">YKS Sayısal</SelectItem>
                    <SelectItem value="YKS Eşit Ağırlık">YKS Eşit Ağırlık</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kayıt Notu</Label>
              <Textarea value={form.note} onChange={(e) => handleChange('note', e.target.value)} rows={4} placeholder="Veli görüşmesi, hedef sınıf, notlar..." />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setForm({ ...emptyForm, className: classOptions[0] || '' })}>Temizle</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Kaydediliyor...' : 'Veli Kaydını Oluştur'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akış Özeti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Bu ekran ayrı bir veli kayıt akışı sunar ama mevcut öğrenci-veli veri modeline yazar.</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="font-medium">Kayıt sonrası</p>
                  <p className="text-sm text-muted-foreground">Öğrenci hesabı oluşur, veli bilgisi kayıtla eşleşir ve idari listelerde görünür.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
