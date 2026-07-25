import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Lock, Bell, User, Eye, EyeOff, Save, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { changePassword, fetchUserPreferences, saveUserPreferences } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const desktopNotificationKeys = [
  'emailNotifications',
  'pushNotifications',
  'examReminders',
  'homeworkReminders',
  'messageAlerts',
];

function pickDesktopNotificationPrefs(source) {
  return desktopNotificationKeys.reduce((acc, key) => {
    if (typeof source?.[key] === 'boolean') {
      acc[key] = source[key];
    }
    return acc;
  }, {});
}

export default function StudentSettings() {
  const { user } = useApp();
  const { toast } = useToast();
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remotePreferences, setRemotePreferences] = useState({});

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
      toast({ title: 'Lütfen tüm alanları doldurun.', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: 'Yeni şifre en az 8 karakter olmalı.', variant: 'destructive' });
      return;
    }
    if (!/[A-Z]/.test(passwordForm.newPassword) ||
        !/[a-z]/.test(passwordForm.newPassword) ||
        !/[0-9]/.test(passwordForm.newPassword)) {
      toast({ title: 'Şifre büyük harf, küçük harf ve rakam içermeli.', variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'Yeni şifreler eşleşmiyor.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: 'Şifreniz başarıyla değiştirildi.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Şifre değiştirilemedi.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    try {
      setSaving(true);
      const next = await saveUserPreferences({ ...remotePreferences, ...prefs });
      if (next && typeof next === 'object') {
        setRemotePreferences(next);
        setPrefs((current) => ({ ...current, ...pickDesktopNotificationPrefs(next) }));
      }
      toast({ title: 'Tercihleriniz kaydedildi.' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Tercihler kaydedilemedi.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchUserPreferences();
        if (cancelled || !remote || typeof remote !== 'object') return;
        setRemotePreferences(remote);
        setPrefs((current) => ({ ...current, ...pickDesktopNotificationPrefs(remote) }));
      } catch {
        /* sessiz: ilk girişte boş olabilir */
      }
    })();
    return () => { cancelled = true; };
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
          <p className="text-sm text-muted-foreground">{user?.name || 'Öğrenci'} - Hesap ve tercih ayarları</p>
        </div>
      </motion.div>

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password"><Lock className="h-4 w-4 mr-1" /> Şifre Değiştir</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" /> Bildirimler</TabsTrigger>
          <TabsTrigger value="account"><User className="h-4 w-4 mr-1" /> Hesap</TabsTrigger>
        </TabsList>

        {/* Password Tab */}
        <TabsContent value="password">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Şifre Değiştir
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>Mevcut Şifre</Label>
                  <div className="relative">
                    <Input
                      type={showOld ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      placeholder="Mevcut şifrenizi girin"
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
                  <Label>Yeni Şifre</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Yeni şifrenizi girin"
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
                    <p className="text-xs text-red-500 mt-1">En az 6 karakter olmalı</p>
                  )}
                </div>
                <div>
                  <Label>Yeni Şifre (Tekrar)</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Yeni şifrenizi tekrar girin"
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
                    <p className="text-xs text-red-500 mt-1">Şifreler eşleşmiyor</p>
                  )}
                </div>
                <Button onClick={handlePasswordChange} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : 'Şifreyi Değiştir'}
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
                  { key: 'emailNotifications', label: 'E-posta Bildirimleri', desc: 'Önemli güncellemeler için e-posta alın' },
                  { key: 'pushNotifications', label: 'Anlık Bildirimler', desc: 'Anlık bildirimler' },
                  { key: 'examReminders', label: 'Sınav Hatırlatmaları', desc: 'Yaklaşan sınavlar için hatırlatma' },
                  { key: 'homeworkReminders', label: 'Ödev Hatırlatmaları', desc: 'Ödev teslim tarihi yaklaştığında uyarı' },
                  { key: 'messageAlerts', label: 'Mesaj Uyarıları', desc: 'Yeni mesaj geldiğinde bildirim' },
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
                    <p className="text-muted-foreground">Kullanıcı Adı</p>
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
                    <p className="text-muted-foreground">Kampüs</p>
                    <p className="font-medium">{user?.branch || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bölüm</p>
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
