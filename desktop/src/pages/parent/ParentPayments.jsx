import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, CreditCard, Calendar, CheckCircle, Clock, Download,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';
import { useToast } from '../../hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ParentPayments() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [children, setChildren] = useState([]);
  const [selectedChildKey, setSelectedChildKey] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ cardName: '', cardNumber: '', expiry: '', cvv: '' });

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, accounting] = await Promise.all([
        fetchStudents(),
        fetchAccountingDashboard(),
      ]);
      const linkedChildren = students.filter((item) => normalize(item.parentName) === normalize(user?.name) || normalize(item.parentEmail).includes(normalize(user?.username)));
      setChildren(linkedChildren);
      setSelectedChildKey(linkedChildren[0]?.username || linkedChildren[0]?.fullName || '');
      setDashboard(accounting);
    } catch (err) {
      setError(err.message || 'Ödeme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const selectedChild = useMemo(() => children.find((child) => (child.username || child.fullName) === selectedChildKey) || children[0], [children, selectedChildKey]);
  const installments = useMemo(() => (dashboard?.installments || []).filter((item) => normalize(item.student) === normalize(selectedChild?.fullName)), [dashboard, selectedChild]);
  const collections = useMemo(() => (dashboard?.collections || []).filter((item) => normalize(item.name) === normalize(selectedChild?.fullName)), [dashboard, selectedChild]);

  const summary = useMemo(() => {
    const totalAmount = installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidAmount = collections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const nextPending = installments.find((item) => !String(item.status).toLowerCase().includes('odendi'));
    return {
      totalAmount,
      paidAmount,
      remainingAmount,
      nextPaymentDate: nextPending?.due || null,
      nextPaymentAmount: Number(nextPending?.amount || 0),
    };
  }, [collections, installments]);

  const paidPercentage = summary.totalAmount > 0 ? Math.round((summary.paidAmount / summary.totalAmount) * 100) : 0;

  const getStatusBadge = (status) => {
    const text = String(status || '').toLowerCase();
    if (text.includes('odendi')) return <Badge className="bg-green-100 text-green-700">Ödendi</Badge>;
    if (text.includes('gec')) return <Badge className="bg-red-100 text-red-700">Gecikmiş</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700">Bekliyor</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Ödeme verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parent-payments-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ödemeler</h1>
          <p className="text-muted-foreground mt-1">Taksit planı ve ödeme geçmişi</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {children.length > 0 ? (
            <Select value={selectedChildKey} onValueChange={setSelectedChildKey}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Çocuk seçin" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.username || child.fullName} value={child.username || child.fullName}>
                    {child.fullName} ({child.className})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-primary hover:bg-brand-primary/90">Online Ödeme Yap</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Online Ödeme</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Ödenecek Tutar</p>
                  <p className="mt-1 text-2xl font-bold">₺{summary.remainingAmount.toLocaleString('tr-TR')}</p>
                </div>
                <div className="space-y-2">
                  <Label>Kart Sahibi</Label>
                  <Input value={paymentForm.cardName} onChange={(e) => setPaymentForm((prev) => ({ ...prev, cardName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Kart Numarası</Label>
                  <Input value={paymentForm.cardNumber} onChange={(e) => setPaymentForm((prev) => ({ ...prev, cardNumber: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SKT</Label>
                    <Input value={paymentForm.expiry} onChange={(e) => setPaymentForm((prev) => ({ ...prev, expiry: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <Input value={paymentForm.cvv} onChange={(e) => setPaymentForm((prev) => ({ ...prev, cvv: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentOpen(false)}>Vazgeç</Button>
                <Button
                  onClick={() => {
                    setPaymentOpen(false);
                    toast({ title: 'Ödeme akışı başlatıldı', description: 'Makbuz ve ödeme özeti ekranı hazırlanıyor.' });
                    navigate('/p/receipts');
                  }}
                >
                  Ödemeyi Tamamla
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? <ErrorBanner title="Ödeme verileri alınamadı" message={error} onRetry={loadPayments} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [summary.totalAmount, 'Toplam Tutar', Wallet, 'text-brand-primary'],
          [summary.paidAmount, 'Ödenen', CheckCircle, 'text-green-600'],
          [summary.remainingAmount, 'Kalan', Clock, 'text-yellow-600'],
          [summary.nextPaymentAmount, summary.nextPaymentDate ? new Date(summary.nextPaymentDate).toLocaleDateString('tr-TR') : 'Plan yok', Calendar, 'text-brand-accent'],
        ].map(([value, label, Icon, color], index) => (
          <motion.div variants={itemVariants} key={`${label}-${index}`}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{typeof value === 'number' ? `₺${value.toLocaleString('tr-TR')}` : value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Ödeme İlerlemesi</span>
              <span className="text-2xl font-bold text-brand-primary">%{paidPercentage}</span>
            </div>
            <Progress value={paidPercentage} className="h-4" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Ödenen: ₺{summary.paidAmount.toLocaleString('tr-TR')}</span>
              <span>Kalan: ₺{summary.remainingAmount.toLocaleString('tr-TR')}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Taksit Planı</CardTitle>
              <CardDescription>Seçili öğrenci için backend taksit kayıtları</CardDescription>
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
                  {installments.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.due}</TableCell>
                      <TableCell>₺{Number(inst.amount || 0).toLocaleString('tr-TR')}</TableCell>
                      <TableCell>{getStatusBadge(inst.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Ödeme Geçmişi</CardTitle>
              <CardDescription>Gerçek tahsilat kayıtları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {collections.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">₺{Number(payment.amount || 0).toLocaleString('tr-TR')}</p>
                      <p className="text-sm text-muted-foreground">{payment.method} • {payment.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{payment.date || 'Tarih yok'}</p>
                    <Button variant="ghost" size="sm" className="text-brand-accent" onClick={() => navigate('/p/receipts')}>
                      <Download className="h-4 w-4 mr-1" /> Makbuz
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
