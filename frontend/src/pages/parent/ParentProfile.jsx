import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Shield, Key, Camera,
  Save, Bell, LogOut, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockParentProfile = {
  name: 'Ahmet Yılmaz',
  email: 'ahmet.yilmaz@email.com',
  phone: '0541 111 22 33',
  address: 'Atatürk Mah. Cumhuriyet Cad. No:45 Kadıköy/İstanbul',
  avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop',
};

const mockChildren = [
  { id: '1', name: 'Ali Yılmaz', class: '10-A', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { id: '2', name: 'Zeynep Yılmaz', class: '8-B', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
];

export default function ParentProfile() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(mockParentProfile);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: true,
    payments: true,
    attendance: true,
    exams: true,
  });

  const handleSave = () => {
    toast({
      title: 'Profil Güncellendi',
      description: 'Bilgileriniz başarıyla kaydedildi.',
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="parent-profile-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Profilim</h1>
        <p className="text-muted-foreground mt-1">Kişisel bilgilerinizi yönetin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative inline-block">
                <Avatar className="h-24 w-24 mx-auto">
                  <AvatarImage src={profile.avatar} />
                  <AvatarFallback className="bg-brand-primary text-white text-2xl">
                    {profile.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-xl font-bold mt-4">{profile.name}</h2>
              <Badge className="mt-2 bg-brand-primary">Veli</Badge>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{profile.phone}</span>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{profile.address}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Children */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Çocuklarım
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockChildren.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={child.avatar} />
                    <AvatarFallback>{child.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-sm text-muted-foreground">{child.class}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Profile & Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Kişisel Bilgiler</CardTitle>
                <CardDescription>Profil bilgilerinizi güncelleyin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ad Soyad</Label>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-posta</Label>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Adres</Label>
                  <Input
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
                <Button onClick={handleSave} className="bg-brand-primary hover:bg-brand-primary/90">
                  <Save className="h-4 w-4 mr-2" /> Kaydet
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notification Settings */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Bildirim Ayarları
                </CardTitle>
                <CardDescription>Hangi bildirimleri almak istediğinizi seçin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">E-posta Bildirimleri</p>
                    <p className="text-sm text-muted-foreground">Duyuru ve hatırlatmalar</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS Bildirimleri</p>
                    <p className="text-sm text-muted-foreground">Acil duyurular</p>
                  </div>
                  <Switch
                    checked={notifications.sms}
                    onCheckedChange={(v) => setNotifications({ ...notifications, sms: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Ödeme Hatırlatmaları</p>
                    <p className="text-sm text-muted-foreground">Taksit yaklaştığında</p>
                  </div>
                  <Switch
                    checked={notifications.payments}
                    onCheckedChange={(v) => setNotifications({ ...notifications, payments: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Devamsızlık Bildirimleri</p>
                    <p className="text-sm text-muted-foreground">Çocuğunuz devamsız olduğunda</p>
                  </div>
                  <Switch
                    checked={notifications.attendance}
                    onCheckedChange={(v) => setNotifications({ ...notifications, attendance: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sınav Sonuçları</p>
                    <p className="text-sm text-muted-foreground">Yeni sonuç açıklandığında</p>
                  </div>
                  <Switch
                    checked={notifications.exams}
                    onCheckedChange={(v) => setNotifications({ ...notifications, exams: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Güvenlik
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Key className="h-4 w-4 mr-2" /> Şifre Değiştir
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                  <LogOut className="h-4 w-4 mr-2" /> Tüm Cihazlardan Çıkış Yap
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
