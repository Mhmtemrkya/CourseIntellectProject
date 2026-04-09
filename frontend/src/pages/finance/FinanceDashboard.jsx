import { motion } from 'framer-motion';
import { 
  Wallet, TrendingUp, TrendingDown, CreditCard, 
  AlertCircle, Calendar, Users, ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockFinanceStats = {
  totalReceivable: 485000,
  totalCollected: 412000,
  pendingPayments: 73000,
  overduePayments: 28500,
  thisMonthCollection: 48000,
  collectionRate: 85,
};

const recentCollections = [
  { id: 1, student: 'Ali Yılmaz', amount: 2500, type: 'Nakit', date: '2025-01-06', collector: 'Ayşe H.' },
  { id: 2, student: 'Zeynep Kaya', amount: 3200, type: 'Havale', date: '2025-01-06', collector: 'Sistem' },
  { id: 3, student: 'Mehmet Demir', amount: 1800, type: 'Kredi Kartı', date: '2025-01-05', collector: 'Ayşe H.' },
  { id: 4, student: 'Elif Şahin', amount: 2500, type: 'Nakit', date: '2025-01-05', collector: 'Ayşe H.' },
];

const overdueStudents = [
  { id: 1, name: 'Burak Çelik', class: '11-B', amount: 4500, days: 15 },
  { id: 2, name: 'Selin Koç', class: '12-A', amount: 3200, days: 8 },
  { id: 3, name: 'Can Arslan', class: '11-A', amount: 2800, days: 5 },
];

export default function FinanceDashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="finance-dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Muhasebe</h1>
        <p className="text-muted-foreground mt-1">Finansal genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Alacak</p>
                  <p className="text-3xl font-bold mt-2">₺{mockFinanceStats.totalReceivable.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Wallet className="h-6 w-6 text-brand-primary" />
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
                  <p className="text-sm text-muted-foreground">Tahsil Edilen</p>
                  <p className="text-3xl font-bold mt-2">₺{mockFinanceStats.totalCollected.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">%{mockFinanceStats.collectionRate} oran</span>
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
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen</p>
                  <p className="text-3xl font-bold mt-2">₺{mockFinanceStats.pendingPayments.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gecikmiş</p>
                  <p className="text-3xl font-bold mt-2">₺{mockFinanceStats.overduePayments.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{overdueStudents.length} öğrenci</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collections */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Son Tahsilatlar</CardTitle>
                <CardDescription>Bugün: ₺{mockFinanceStats.thisMonthCollection.toLocaleString()}</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Tümünü Gör
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCollections.map((collection) => (
                  <div key={collection.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">{collection.student}</p>
                        <p className="text-sm text-muted-foreground">{collection.type} • {collection.collector}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+₺{collection.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(collection.date).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Overdue Payments */}
        <motion.div variants={itemVariants}>
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Geciken Ödemeler
                </CardTitle>
                <CardDescription>Takip gerektiren öğrenciler</CardDescription>
              </div>
              <Badge className="bg-red-100 text-red-700">{overdueStudents.length} Kayıt</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overdueStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.class} • {student.days} gün gecikme</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">₺{student.amount.toLocaleString()}</p>
                      <Button variant="outline" size="sm" className="mt-1 text-xs h-7">
                        Hatırlat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Collection Progress */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Aylık Tahsilat Hedefi</CardTitle>
            <CardDescription>Ocak 2025 tahsilat durumu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Tahsil Edilen</span>
                <span className="font-bold">₺{mockFinanceStats.totalCollected.toLocaleString()} / ₺{mockFinanceStats.totalReceivable.toLocaleString()}</span>
              </div>
              <Progress value={mockFinanceStats.collectionRate} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>%{mockFinanceStats.collectionRate} tamamlandı</span>
                <span>Kalan: ₺{(mockFinanceStats.totalReceivable - mockFinanceStats.totalCollected).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
