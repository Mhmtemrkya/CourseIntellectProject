import { useState } from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Save, Copy, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createParent } from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
};

export default function AdminParentRegistration() {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast({ title: 'Veli ad-soyad zorunlu.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const response = await createParent({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      setCredentials({
        fullName: response?.fullName || form.fullName.trim(),
        username: response?.username,
        password: response?.password,
      });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName: response?.fullName || form.fullName.trim(),
          role: 'Veli',
          username: response?.username,
          temporaryPassword: response?.password,
        });
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      setForm(emptyForm);
      toast({
        title: 'Veli kaydı oluşturuldu',
        description: 'Bilgiler PDF olarak indirildi.',
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Veli kaydı oluşturulamadı.';
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
      role: 'Veli',
      username: credentials.username,
      temporaryPassword: credentials.password,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 p-3 text-white">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-heading">Bağımsız Veli Kaydı</h1>
          <p className="text-muted-foreground mt-1">
            Birden fazla öğrencisi olan veya öğrencisi henüz sistemde olmayan veliler için.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-900 dark:text-blue-200">
          <p className="font-semibold">Yeni öğrenci kaydı yapacaksanız bu sayfayı kullanmayın.</p>
          <p className="mt-1">
            <strong>Öğrenciler</strong> sayfasından öğrenci eklerken veli bilgisi de doldurulursa veli hesabı
            otomatik oluşur. Bu sayfa yalnızca öğrenciden bağımsız veli kaydı içindir.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Veli Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Ad Soyad *</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Örn: Ayşe Yılmaz"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label>E-posta</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="veli@email.com"
                />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong>Bilgi:</strong> Veli kaydedildiğinde kurum domain'inizi kullanan bir kullanıcı adı
              ve güçlü bir geçici şifre otomatik üretilir. Veli ilk girişinde şifresini değiştirmek zorundadır.
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
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
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <p className="font-medium">1. Otomatik kullanıcı adı</p>
              <p className="text-sm text-muted-foreground">
                Kurum domain'inizden <code>{`<adsoyad>veli@${tenantName ? '...' : 'kurum.com'}`}</code> formatında üretilir.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <p className="font-medium">2. Güçlü geçici şifre</p>
              <p className="text-sm text-muted-foreground">8 karakter rastgele şifre üretilir, hash'lenerek saklanır.</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <p className="font-medium">3. PDF + ilk girişte zorunlu değişim</p>
              <p className="text-sm text-muted-foreground">
                Bilgiler logolu PDF olarak iner; veli ilk girişinde kendi şifresini belirler.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Veli hesabı oluşturuldu</DialogTitle>
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
