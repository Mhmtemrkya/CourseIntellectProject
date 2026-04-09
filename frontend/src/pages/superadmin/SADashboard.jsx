import { motion } from 'framer-motion';
import { 
  Building2, Users, CreditCard, Server, AlertTriangle, 
  TrendingUp, Activity, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockPlatformStats = {
  totalTenants: 48,
  activeTenants: 45,
  totalUsers: 12540,
  monthlyRevenue: 156000,
  storageUsed: '2.4 TB',
  apiCalls: '45M',
};

const recentTenants = [
  { id: 1, name: 'Özel Yıldız Koleji', plan: 'Enterprise', users: 450, status: 'active' },
  { id: 2, name: 'ABC Eğitim Kurumları', plan: 'Business', users: 280, status: 'active' },
  { id: 3, name: 'Modern Akademi', plan: 'Starter', users: 85, status: 'trial' },
  { id: 4, name: 'Gelecek Nesil Okulu', plan: 'Business', users: 320, status: 'active' },
];

export default function SADashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="sa-dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Platform Yönetimi</h1>
        <p className="text-muted-foreground mt-1">SaaS platform genel durumu</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kurum</p>
                  <p className="text-3xl font-bold mt-2">{mockPlatformStats.totalTenants}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">+5 bu ay</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Building2 className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-accent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kullanıcı</p>
                  <p className="text-3xl font-bold mt-2">{mockPlatformStats.totalUsers.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">+12%</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <Users className="h-6 w-6 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aylık Gelir</p>
                  <p className="text-3xl font-bold mt-2">₺{mockPlatformStats.monthlyRevenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">+8%</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">API Çağrısı</p>
                  <p className="text-3xl font-bold mt-2">{mockPlatformStats.apiCalls}</p>
                  <p className="text-xs text-muted-foreground mt-2">Bu ay</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tenants */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Son Eklenen Kurumlar</CardTitle>
              <CardDescription>Platform'a yeni katılan kurumlar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-primary/10">
                        <Building2 className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.users} kullanıcı</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{tenant.plan}</Badge>
                      <Badge className={tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {tenant.status === 'active' ? 'Aktif' : 'Deneme'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Status */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Sistem Durumu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>API Sunucusu</span>
                  <Badge className="bg-green-100 text-green-700">Çalışıyor</Badge>
                </div>
                <Progress value={98} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">%98 uptime (30 gün)</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Veritabanı</span>
                  <Badge className="bg-green-100 text-green-700">Sağlıklı</Badge>
                </div>
                <Progress value={65} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">%65 kapasite kullanımı</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Depolama</span>
                  <Badge className="bg-yellow-100 text-yellow-700">%75</Badge>
                </div>
                <Progress value={75} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{mockPlatformStats.storageUsed} / 3.2 TB</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>SignalR Hub</span>
                  <Badge className="bg-green-100 text-green-700">Çalışıyor</Badge>
                </div>
                <p className="text-xs text-muted-foreground">2,450 aktif bağlantı</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alerts */}
      <motion.div variants={itemVariants}>
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="font-medium">Dikkat: 3 kurum ödeme gecikmesi yaşıyor</p>
              <p className="text-sm text-muted-foreground">Son 7 gün içinde ödeme yapılmayan kurumlar mevcut.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
