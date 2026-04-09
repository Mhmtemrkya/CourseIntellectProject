import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Shield, Key, Camera,
  Save, Bell, LogOut, GraduationCap, Calendar, Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockStudentProfile = {
  name: 'Ali Yılmaz',
  email: 'ali.yilmaz@email.com',
  phone: '0532 111 22 33',
  studentNo: '2024-10A-015',
  class: '10-A',
  birthDate: '2009-05-15',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
  attendance: 92,
  avgScore: 82,
  rank: 5,
};

const mockAchievements = [
  { id: 1, title: 'Matematik Şampiyonu', description: 'Aylık en yüksek puan', date: '2025-01', icon: '🏆' },
  { id: 2, title: 'Mükemmel Devam', description: '30 gün kesintisiz', date: '2024-12', icon: '⭐' },
  { id: 3, title: 'Soru Cevaplama', description: '50 soru yanıtlandı', date: '2024-11', icon: '💡' },
];

export default function StudentProfile() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(mockStudentProfile);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    exams: true,
    content: true,
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
      data-testid="student-profile-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Profilim</h1>
        <p className="text-muted-foreground mt-1">Kişisel bilgilerinizi görüntüleyin</p>
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
              <p className="text-muted-foreground">{profile.studentNo}</p>
              <Badge className="mt-2 bg-brand-accent">{profile.class}</Badge>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-brand-primary">%{profile.attendance}</p>
                  <p className="text-xs text-muted-foreground">Devam</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-accent">{profile.avgScore}</p>
                  <p className="text-xs text-muted-foreground">Ortalama</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{profile.rank}.</p>
                  <p className="text-xs text-muted-foreground">Sıralama</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-brand-accent" />
                Başarılarım
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAchievements.map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl">{achievement.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{achievement.title}</p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                  <Badge variant="outline">{achievement.date}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info & Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Kişisel Bilgiler</CardTitle>
                <CardDescription>Bu bilgiler sadece görüntüleme amaçlıdır</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ad Soyad</Label>
                    <Input value={profile.name} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Öğrenci No</Label>
                    <Input value={profile.studentNo} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Sınıf</Label>
                    <Input value={profile.class} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Doğum Tarihi</Label>
                    <Input value={new Date(profile.birthDate).toLocaleDateString('tr-TR')} disabled />
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
                <Button onClick={handleSave} className="bg-brand-primary hover:bg-brand-primary/90">
                  <Save className="h-4 w-4 mr-2" /> Güncelle
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Progress Stats */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Akademik İlerleme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Devam Oranı</span>
                    <span className="font-bold">%{profile.attendance}</span>
                  </div>
                  <Progress value={profile.attendance} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>İçerik Tamamlama</span>
                    <span className="font-bold">%68</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Ödev Teslim</span>
                    <span className="font-bold">%85</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Sınav Performansı</span>
                    <span className="font-bold">%{profile.avgScore}</span>
                  </div>
                  <Progress value={profile.avgScore} className="h-2" />
                </div>
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">E-posta Bildirimleri</p>
                    <p className="text-sm text-muted-foreground">Duyurular ve hatırlatmalar</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sınav Bildirimleri</p>
                    <p className="text-sm text-muted-foreground">Yaklaşan sınavlar</p>
                  </div>
                  <Switch
                    checked={notifications.exams}
                    onCheckedChange={(v) => setNotifications({ ...notifications, exams: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Yeni İçerik</p>
                    <p className="text-sm text-muted-foreground">Yeni ders materyalleri</p>
                  </div>
                  <Switch
                    checked={notifications.content}
                    onCheckedChange={(v) => setNotifications({ ...notifications, content: v })}
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
                  <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
