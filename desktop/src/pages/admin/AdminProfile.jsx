import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  FileText,
  LogOut,
  Moon,
  Save,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/use-toast';

export default function AdminProfile() {
  const navigate = useNavigate();
  const { user, logout } = useApp();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    branch: user?.branch || '',
    department: user?.department || '',
  });
  const [preferences, setPreferences] = useState({
    desktop: true,
    finance: true,
    announcements: true,
    meetings: true,
  });

  const initials = useMemo(() => {
    const parts = String(user?.name || 'Yönetici').split(' ').filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [user?.name]);

  const saveLocal = () => {
    toast({ title: 'Profil tercihleri kaydedildi.' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl" data-testid="admin-profile-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-brand-primary text-2xl font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <Badge variant="outline">Kurum yöneticisi</Badge>
              <h1 className="mt-3 text-3xl font-bold font-heading">Profilim</h1>
              <p className="text-muted-foreground">{user?.tenant || 'Kurum'} - {user?.email || 'E-posta yok'}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => {
            logout();
            navigate('/login');
          }}>
            <LogOut className="mr-2 h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-brand-primary" />
              Profil Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kampus</Label>
              <Input value={form.branch} onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Departman</Label>
              <Input value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={saveLocal}>
                <Save className="mr-2 h-4 w-4" />
                Profili Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-brand-primary" />
              Görünüm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['light', 'Açık', Sun],
              ['dark', 'Koyu', Moon],
              ['system', 'Sistem', Settings],
            ].map(([value, label, Icon]) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setTheme(value)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-primary" />
              Bildirim Tercihleri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['desktop', 'Masaüstü bildirimleri'],
              ['finance', 'Finans uyarıları'],
              ['announcements', 'Duyuru geri bildirimleri'],
              ['meetings', 'Görüşme akışı'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">Kurum yöneticisi panelinde görünsün.</p>
                </div>
                <Switch
                  checked={preferences[key]}
                  onCheckedChange={(value) => setPreferences((prev) => ({ ...prev, [key]: value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kurum ve Yasal Alanlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Kurum Ayarları', 'Logo, renk, kampüs ve kurumsal kimlik', Building2, '/settings'],
              ['Yasal Dokümanlar', 'KVKK, sözleşmeler ve izin metinleri', FileText, '/admin/documents'],
              ['Bildirim Merkezi', 'Kurum yöneticisi bildirimleri', Bell, '/admin/notifications'],
            ].map(([title, detail, Icon, path]) => (
              <button
                key={title}
                type="button"
                className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-muted/30"
                onClick={() => navigate(path)}
              >
                <Icon className="h-5 w-5 text-brand-primary" />
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{detail}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
