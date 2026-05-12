import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Save, ShieldCheck, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createStaffAccounting } from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';

const emptyForm = {
  fullName: '',
  tcNo: '',
  phone: '',
  education: '',
  startDate: '',
  campus: 'Merkez Kampüs',
  maritalStatus: 'Bekar',
  childCount: '0',
  note: '',
};

export default function AdminAccountingRegistration() {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.fullName.trim() || !form.tcNo.trim() || !form.phone.trim()) {
      toast({
        title: 'Ad soyad, TC kimlik no ve telefon zorunludur.',
        variant: 'destructive',
      });
      return false;
    }
    if (form.tcNo.trim().length !== 11) {
      toast({ title: 'TC kimlik no 11 haneli olmalıdır.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const response = await createStaffAccounting({
        fullName: form.fullName.trim(),
        tcNo: form.tcNo.trim(),
        phone: form.phone.trim(),
        email: '',
        education: form.education.trim(),
        startDate: form.startDate.trim(),
        campus: form.campus.trim(),
        maritalStatus: form.maritalStatus,
        childCount: Number(form.childCount || 0),
        note: form.note.trim(),
      });
      setCredentials({ ...response, requestedFullName: form.fullName.trim() });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName: response?.fullName || form.fullName.trim(),
          role: 'Muhasebe',
          username: response?.username,
          temporaryPassword: response?.password,
        });
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      setForm(emptyForm);
      toast({ title: 'Muhasebe hesabı oluşturuldu.', description: 'Bilgiler PDF olarak indirildi.' });
    } catch (err) {
      toast({
        title: err.message || 'Muhasebe kaydı oluşturulamadı.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    const text = `Kullanıcı adı: ${credentials?.username || ''}\nŞifre: ${credentials?.password || ''}`;
    await navigator.clipboard?.writeText(text);
    toast({ title: 'Giriş bilgileri kopyalandı.' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-accounting-registration-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-600/10 p-3 text-emerald-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold font-heading">Muhasebe Kaydı</h1>
                <p className="text-muted-foreground">Kurum yöneticisine özel finans kadro hesabı oluşturma akışı.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 px-5 py-4">
            <p className="text-sm text-muted-foreground">Oluşacak rol</p>
            <p className="text-xl font-bold">Muhasebe</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Muhasebe Profil Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>TC Kimlik No *</Label>
                <Input maxLength={11} value={form.tcNo} onChange={(event) => handleChange('tcNo', event.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="space-y-2">
                <Label>Telefon *</Label>
                <Input value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mezuniyet / Üniversite</Label>
                <Input value={form.education} onChange={(event) => handleChange('education', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>İşe Başlama Tarihi</Label>
                <Input value={form.startDate} onChange={(event) => handleChange('startDate', event.target.value)} placeholder="gg.aa.yyyy" />
              </div>
              <div className="space-y-2">
                <Label>Kampüs</Label>
                <Input value={form.campus} onChange={(event) => handleChange('campus', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Medeni Durum</Label>
                <Select value={form.maritalStatus} onValueChange={(value) => handleChange('maritalStatus', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bekar">Bekar</SelectItem>
                    <SelectItem value="Evli">Evli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Çocuk Sayısı</Label>
                <Input type="number" min="0" value={form.childCount} onChange={(event) => handleChange('childCount', event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Finans Notu</Label>
              <Textarea rows={4} value={form.note} onChange={(event) => handleChange('note', event.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Kaydediliyor...' : 'Muhasebe Kaydını Tamamla'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yetki Cevresi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['Panel', 'Muhasebe modülü aktif olur'],
              ['Mesajlaşma', 'Yönetici ve veli ile iletişim kurabilir'],
              ['Onay Yetkisi', 'Onay yetkisi verilmez, finans akışlarını takip eder'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <p className="font-semibold">{title}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Muhasebe hesabı oluşturuldu</DialogTitle>
            <DialogDescription>
              Bilgiler PDF olarak indirildi. Kaybederseniz aşağıdan tekrar indirebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Kullanıcı Adı</p>
              <p className="mt-1 font-mono text-lg font-bold break-all">{credentials?.username || '-'}</p>
            </div>
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider">{credentials?.password || '-'}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">İlk girişte değiştirilmesi zorunludur.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentials(null)}>Kapat</Button>
            <Button variant="outline" onClick={copyCredentials}>
              <Copy className="mr-2 h-4 w-4" />
              Kopyala
            </Button>
            <Button onClick={async () => {
              if (!credentials) return;
              await downloadCredentialsPdf({
                tenantName,
                fullName: credentials.fullName || credentials.requestedFullName,
                role: 'Muhasebe',
                username: credentials.username,
                temporaryPassword: credentials.password,
              });
            }}>PDF İndir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
