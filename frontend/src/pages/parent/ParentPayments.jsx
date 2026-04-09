import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, CreditCard, Calendar, CheckCircle, AlertCircle,
  Clock, Download, ChevronRight, Receipt
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockChildren = [
  { id: '1', name: 'Ali Yılmaz', class: '10-A' },
  { id: '2', name: 'Zeynep Yılmaz', class: '8-B' },
];

const mockPaymentSummary = {
  totalAmount: 48000,
  paidAmount: 32000,
  remainingAmount: 16000,
  nextPaymentDate: '2025-02-01',
  nextPaymentAmount: 4000,
};

const mockInstallments = [
  { id: 1, month: 'Eylül 2024', amount: 4000, status: 'paid', paidDate: '2024-09-05', paymentType: 'Havale' },
  { id: 2, month: 'Ekim 2024', amount: 4000, status: 'paid', paidDate: '2024-10-03', paymentType: 'Kredi Kartı' },
  { id: 3, month: 'Kasım 2024', amount: 4000, status: 'paid', paidDate: '2024-11-02', paymentType: 'Nakit' },
  { id: 4, month: 'Aralık 2024', amount: 4000, status: 'paid', paidDate: '2024-12-04', paymentType: 'Havale' },
  { id: 5, month: 'Ocak 2025', amount: 4000, status: 'paid', paidDate: '2025-01-05', paymentType: 'Kredi Kartı' },
  { id: 6, month: 'Şubat 2025', amount: 4000, status: 'pending', dueDate: '2025-02-01' },
  { id: 7, month: 'Mart 2025', amount: 4000, status: 'upcoming', dueDate: '2025-03-01' },
  { id: 8, month: 'Nisan 2025', amount: 4000, status: 'upcoming', dueDate: '2025-04-01' },
];

const mockPaymentHistory = [
  { id: 1, date: '2025-01-05', amount: 4000, type: 'Kredi Kartı', receipt: 'MKB-2025-0105' },
  { id: 2, date: '2024-12-04', amount: 4000, type: 'Havale', receipt: 'MKB-2024-1204' },
  { id: 3, date: '2024-11-02', amount: 4000, type: 'Nakit', receipt: 'MKB-2024-1102' },
];

export default function ParentPayments() {
  const [selectedChild, setSelectedChild] = useState(mockChildren[0].id);
  
  const paidPercentage = Math.round((mockPaymentSummary.paidAmount / mockPaymentSummary.totalAmount) * 100);

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      upcoming: 'bg-muted text-muted-foreground',
    };
    const labels = { paid: 'Ödendi', pending: 'Bekliyor', overdue: 'Gecikmiş', upcoming: 'Yaklaşan' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="parent-payments-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ödemeler</h1>
          <p className="text-muted-foreground mt-1">Taksit planı ve ödeme geçmişi</p>
        </div>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mockChildren.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name} ({child.class})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <Wallet className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{mockPaymentSummary.totalAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Toplam Tutar</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{mockPaymentSummary.paidAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Ödenen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{mockPaymentSummary.remainingAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Kalan</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-brand-accent">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-accent/10">
                <Calendar className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{mockPaymentSummary.nextPaymentAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(mockPaymentSummary.nextPaymentDate).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Ödeme İlerlemesi</span>
              <span className="text-2xl font-bold text-brand-primary">%{paidPercentage}</span>
            </div>
            <Progress value={paidPercentage} className="h-4" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Ödenen: ₺{mockPaymentSummary.paidAmount.toLocaleString()}</span>
              <span>Kalan: ₺{mockPaymentSummary.remainingAmount.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Installment Plan */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Taksit Planı</CardTitle>
              <CardDescription>2024-2025 Eğitim Dönemi</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dönem</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInstallments.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.month}</TableCell>
                      <TableCell>₺{inst.amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(inst.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment History */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Ödeme Geçmişi</CardTitle>
              <CardDescription>Son ödemeleriniz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockPaymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">₺{payment.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{payment.type} • {payment.receipt}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{new Date(payment.date).toLocaleDateString('tr-TR')}</p>
                    <Button variant="ghost" size="sm" className="text-brand-accent">
                      <Download className="h-4 w-4 mr-1" /> Makbuz
                    </Button>
                  </div>
                </div>
              ))}
              <Button className="w-full bg-brand-primary hover:bg-brand-primary/90">
                <CreditCard className="h-4 w-4 mr-2" /> Online Ödeme Yap
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
