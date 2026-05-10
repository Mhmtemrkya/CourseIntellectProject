import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Save, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createStudent, fetchClasses, fetchStudents } from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';

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
  tcNo: '',
  className: '',
  schoolNumber: '',
  birthDate: '',
  programType: 'Sayisal',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  address: '',
  note: '',
};

export default function AdminStudentRegistration() {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [classNames, setClassNames] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [students, classList] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      setRecentStudents(Array.isArray(students) ? students.slice(-5).reverse() : []);
      setClassNames(Array.isArray(classList) ? classList : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast({ title: 'Ad soyad zorunludur.', variant: 'destructive' });
      return;
    }
    if (!form.className) {
      toast({ title: 'Sınıf seçimi zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await createStudent({
        fullName: form.fullName.trim(),
        tcNo: form.tcNo.trim(),
        className: form.className,
        currentSchool: tenantName,
        schoolNumber: form.schoolNumber.trim(),
        birthDate: form.birthDate || '',
        programType: form.programType,
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
      });
      const studentInfo = {
        fullName: created.fullName || form.fullName.trim(),
        username: created.username,
        password: created.password,
        className: created.className || form.className,
      };
      const parentInfo = created.parent
        ? {
          fullName: created.parent.fullName || form.parentName.trim(),
          username: created.parent.username,
          password: created.parent.password,
        }
        : null;
      setCredentials({ student: studentInfo, parent: parentInfo });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName: studentInfo.fullName,
          role: 'Öğrenci',
          username: studentInfo.username,
          temporaryPassword: studentInfo.password,
          className: studentInfo.className,
        });
        if (parentInfo) {
          await downloadCredentialsPdf({
            tenantName,
            fullName: parentInfo.fullName,
            role: 'Veli',
            username: parentInfo.username,
            temporaryPassword: parentInfo.password,
            extra: `Velisi olduğu öğrenci: ${studentInfo.fullName} (${studentInfo.className})`,
          });
        }
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      toast({
        title: 'Öğrenci kaydedildi',
        description: parentInfo
          ? 'Öğrenci ve veli bilgileri PDF olarak indirildi.'
          : 'Bilgiler PDF olarak indirildi.',
      });
      setForm(emptyForm);
      loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Kayıt başarısız.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const downloadStudentPdf = async () => {
    if (!credentials?.student) return;
    const s = credentials.student;
    await downloadCredentialsPdf({
      tenantName,
      fullName: s.fullName,
      role: 'Öğrenci',
      username: s.username,
      temporaryPassword: s.password,
      className: s.className,
    });
  };

  const downloadParentPdf = async () => {
    if (!credentials?.parent || !credentials?.student) return;
    const p = credentials.parent;
    const s = credentials.student;
    await downloadCredentialsPdf({
      tenantName,
      fullName: p.fullName,
      role: 'Veli',
      username: p.username,
      temporaryPassword: p.password,
      extra: `Velisi olduğu öğrenci: ${s.fullName} (${s.className})`,
    });
  };

  const copyAll = async () => {
    if (!credentials) return;
    const s = credentials.student;
    let text = `Öğrenci\nKullanıcı Adı: ${s.username}\nGeçici Şifre: ${s.password}`;
    if (credentials.parent) {
      const p = credentials.parent;
      text += `\n\nVeli\nKullanıcı Adı: ${p.username}\nGeçici Şifre: ${p.password}`;
    }
    await navigator.clipboard?.writeText(text);
    toast({ title: 'Tüm bilgiler kopyalandı.' });
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Öğrenci Kaydı</h1>
          <p className="text-sm text-muted-foreground">
            Öğrenci ve velisi tek seferde otomatik kullanıcı + şifre ile oluşturulur. Her ikisi için PDF üretilir.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Öğrenci Bilgileri</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="personal">
                <TabsList className="mb-4">
                  <TabsTrigger value="personal">Kişisel</TabsTrigger>
                  <TabsTrigger value="parent">Veli</TabsTrigger>
                  <TabsTrigger value="other">Diğer</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Ad Soyad *</Label>
                      <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Örn: Ahmet Yılmaz" />
                    </div>
                    <div>
                      <Label>TC No</Label>
                      <Input value={form.tcNo} maxLength={11} onChange={(e) => handleChange('tcNo', e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div>
                      <Label>Sınıf *</Label>
                      <Select value={form.className} onValueChange={(v) => handleChange('className', v)}>
                        <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                        <SelectContent>
                          {classNames.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Mevcut Okul</Label>
                      <Input value={tenantName} readOnly className="bg-muted cursor-not-allowed" />
                    </div>
                    <div>
                      <Label>Okul No</Label>
                      <Input value={form.schoolNumber} onChange={(e) => handleChange('schoolNumber', e.target.value)} />
                    </div>
                    <div>
                      <Label>Doğum Tarihi</Label>
                      <Input type="date" value={form.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)} />
                    </div>
                    <div>
                      <Label>Program</Label>
                      <Select value={form.programType} onValueChange={(v) => handleChange('programType', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sayisal">Sayısal</SelectItem>
                          <SelectItem value="Sozel">Sözel</SelectItem>
                          <SelectItem value="EA">Eşit Ağırlık</SelectItem>
                          <SelectItem value="Dil">Dil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="parent" className="space-y-4">
                  <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-200">
                    Veli adı doldurulursa <strong>otomatik olarak veli kullanıcısı da oluşturulur</strong> ve ayrı bir PDF iner.
                    Veli ilk girişinde kendi şifresini değiştirmek zorundadır.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Veli Adı</Label>
                      <Input value={form.parentName} onChange={(e) => handleChange('parentName', e.target.value)} placeholder="Veli adı soyadı" />
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
                    <Textarea value={form.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label>Notlar</Label>
                    <Textarea value={form.note} onChange={(e) => handleChange('note', e.target.value)} rows={2} />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground mt-4">
                <strong>Bilgi:</strong> Öğrenci kaydedildiğinde kurum domain'inizi kullanan bir kullanıcı adı
                ve güçlü bir geçici şifre otomatik üretilir. Öğrenci ilk girişinde şifresini değiştirmek zorundadır.
              </div>

              <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Öğrenciyi Kaydet'}
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
              ) : recentStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz kayıt yok.</p>
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

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kayıt Tamamlandı</DialogTitle>
            <DialogDescription>
              {credentials?.parent
                ? 'Öğrenci ve veli bilgileri PDF olarak indirildi.'
                : 'Öğrenci bilgileri PDF olarak indirildi.'}
              {' '}İlk girişte şifre değişimi zorunludur.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">Öğrenci</span>
                  {credentials.student.fullName} {credentials.student.className ? `• ${credentials.student.className}` : ''}
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Kullanıcı Adı</div>
                  <div className="font-mono text-sm break-all">{credentials.student.username}</div>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</div>
                  <div className="font-mono text-base font-bold tracking-wider">{credentials.student.password}</div>
                </div>
                <Button variant="outline" size="sm" onClick={downloadStudentPdf} className="w-full">
                  Öğrenci PDF'ini Tekrar İndir
                </Button>
              </div>

              {credentials.parent && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs">Veli</span>
                    {credentials.parent.fullName}
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="text-xs text-muted-foreground">Kullanıcı Adı</div>
                    <div className="font-mono text-sm break-all">{credentials.parent.username}</div>
                  </div>
                  <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</div>
                    <div className="font-mono text-base font-bold tracking-wider">{credentials.parent.password}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadParentPdf} className="w-full">
                    Veli PDF'ini Tekrar İndir
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyAll}>
              <Copy className="mr-2 h-4 w-4" /> Tümünü Kopyala
            </Button>
            <Button onClick={() => setCredentials(null)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
