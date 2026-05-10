import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Lock, Bell, Palette, User, Eye, EyeOff, Save, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { changePassword } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function StudentSettings() {
  const { user } = useApp();
  const { toast } = useToast();
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    examReminders: true,
    homeworkReminders: true,
    messageAlerts: true,
  });

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast({ title: 'Lutfen tum alanlari doldurun.', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: 'Yeni sifre en az 8 karakter olmali.', variant: 'destructive' });
      return;
    }
    if (!/[A-Z]/.test(passwordForm.newPassword) ||
        !/[a-z]/.test(passwordForm.newPassword) ||
        !/[0-9]/.test(passwordForm.newPassword)) {
      toast({ title: 'Sifre buyuk harf, kucuk harf ve rakam icermeli.', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'Yeni sifreler eslesmiyor.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: 'Sifreniz basariyla degistirildi.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Sifre degistirilemedi.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = () => {
    localStorage.setItem('ci-student-prefs', JSON.stringify(prefs));
    toast({ title: 'Tercihleriniz kaydedildi.' });
  };

  useEffect(() => {
    const saved = localStorage.getItem('ci-student-prefs');
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl text-white">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ayarlar</h1>
          <p className="text-sm text-muted-foreground">{user?.name || 'Ogrenci'} - Hesap ve tercih ayarlari</p>
        </div>
      </motion.div>

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password"><Lock className="h-4 w-4 mr-1" /> Sifre Degistir</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" /> Bildirimler</TabsTrigger>
          <TabsTrigger value="account"><User className="h-4 w-4 mr-1" /> Hesap</TabsTrigger>
        </TabsList>

        {/* Password Tab */}
        <TabsContent value="password">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Sifre Degistir
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>Mevcut Sifre</Label>
                  <div className="relative">
                    <Input
                      type={showOld ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      placeholder="Mevcut sifrenizi girin"
                    />
                    <Button
                      variant="ghost" size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowOld(!showOld)}
                    >
                      {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Yeni Sifre</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Yeni sifrenizi girin"
                    />
                    <Button
                      variant="ghost" size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.newPassword && passwordForm.newPassword.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">En az 6 karakter olmali</p>
                  )}
                </div>
                <div>
                  <Label>Yeni Sifre (Tekrar)</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Yeni sifrenizi tekrar girin"
                    />
                    <Button
                      variant="ghost" size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Sifreler eslesmiyor</p>
                  )}
                </div>
                <Button onClick={handlePasswordChange} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Sifreyi Degistir'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" /> Bildirim Tercihleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                {[
                  { key: 'emailNotifications', label: 'E-posta Bildirimleri', desc: 'Onemli guncellemeler icin e-posta alin' },
                  { key: 'pushNotifications', label: 'Push Bildirimleri', desc: 'Anlik bildirimler' },
                  { key: 'examReminders', label: 'Sinav Hatirlatmalari', desc: 'Yaklasan sinavlar icin hatirlatma' },
                  { key: 'homeworkReminders', label: 'Odev Hatirlatmalari', desc: 'Odev teslim tarihi yaklastiginda uyari' },
                  { key: 'messageAlerts', label: 'Mesaj Uyarilari', desc: 'Yeni mesaj geldiginde bildirim' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={prefs[key]}
                      onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [key]: checked }))}
                    />
                  </div>
                ))}
                <Button onClick={handleSavePrefs} className="mt-4">
                  <Save className="h-4 w-4 mr-1" /> Tercihleri Kaydet
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> Hesap Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-w-md">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ad Soyad</p>
                    <p className="font-medium">{user?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kullanici Adi</p>
                    <p className="font-medium">{user?.username || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">E-posta</p>
                    <p className="font-medium">{user?.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rol</p>
                    <p className="font-medium capitalize">{user?.role || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kampus</p>
                    <p className="font-medium">{user?.branch || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bolum</p>
                    <p className="font-medium">{user?.department || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
