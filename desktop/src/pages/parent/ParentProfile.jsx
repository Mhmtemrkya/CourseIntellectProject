import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Shield, Bell, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import { useApp } from '../../context/AppContext';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { LegalDocumentsPanel } from '../../components/legal/LegalDocumentsPanel';
import { fetchStudents } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

export default function ParentProfile() {
  const { user } = useApp();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    payments: true,
    attendance: true,
    exams: true,
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const students = await fetchStudents();
      const linked = students.filter((student) => {
        const parentName = normalizeText(student.parentName);
        const profileName = normalizeText(user?.name);
        const parentEmail = normalizeText(student.parentEmail);
        const username = normalizeText(user?.username);
        return parentName === profileName || parentEmail.includes(username);
      });
      setChildren(linked);
    } catch (err) {
      setError(err.message || 'Veli profili alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const profile = useMemo(() => ({
    name: children[0]?.parentName || user?.name || 'Veli',
    email: children[0]?.parentEmail || `${user?.username || 'veli'}@courseintellect.local`,
    phone: children[0]?.parentPhone || 'Telefon yok',
    address: 'Adres bilgisi sistemde tutulmuyor',
  }), [children, user]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parent-profile-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Profilim</h1>
        <p className="text-muted-foreground mt-1">Kişisel bilgilerinizi görüntüleyin</p>
      </div>

      {error ? <ErrorBanner title="Profil alınamadı" message={error} onRetry={loadProfile} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div>
          <Card>
            <CardContent className="p-6 text-center">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarFallback className="bg-brand-primary text-white text-2xl">
                  {profile.name.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold mt-4">{profile.name}</h2>
              <Badge className="mt-2 bg-brand-primary">Veli</Badge>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{profile.email}</span></div>
                <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{profile.phone}</span></div>
                <div className="flex items-start gap-3 text-sm"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><span className="text-muted-foreground">{profile.address}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Çocuklarım</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {children.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{child.fullName.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{child.fullName}</p>
                    <p className="text-sm text-muted-foreground">{child.className}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kişisel Bilgiler</CardTitle>
              <CardDescription>Bu bilgiler yönetim tarafından güncellenir</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Ad Soyad</p><p className="font-medium">{profile.name}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">E-posta</p><p className="font-medium">{profile.email}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Telefon</p><p className="font-medium">{profile.phone}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Çocuk Sayısı</p><p className="font-medium">{children.length}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Bildirim Ayarları</CardTitle>
              <CardDescription>Tercihlerinizi bu cihaz için yönetin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ['email', 'E-posta Bildirimleri'],
                ['sms', 'SMS Bildirimleri'],
                ['payments', 'Ödeme Hatırlatmaları'],
                ['attendance', 'Devamsızlık Bildirimleri'],
                ['exams', 'Sınav Sonuçları'],
                ['push', 'Masaüstü Bildirimleri'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium">{label}</p></div>
                  <Switch checked={notifications[key]} onCheckedChange={(value) => setNotifications((prev) => ({ ...prev, [key]: value }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Hesap Yetkisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span>Profil değişiklikleri yönetim tarafından yapılır.</span></div>
              <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>İletişim bilgileri öğrenci kayıtlarıyla eşleşir.</span></div>
              <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>Eksik bilgi için idari birime başvurun.</span></div>
            </CardContent>
          </Card>

          <LegalDocumentsPanel compact />
        </div>
      </div>
    </motion.div>
  );
}
