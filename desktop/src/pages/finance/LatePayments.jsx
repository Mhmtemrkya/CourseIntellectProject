import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, AlertCircle, Bell, Phone, Mail,
  Calendar, Send, Download,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createAccountingNotification, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';
import { downloadCsvRows } from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function calculateDaysLate(dueValue) {
  const due = new Date(dueValue);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = Date.now() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function LatePayments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [accounting, studentList] = await Promise.all([
        fetchAccountingDashboard(),
        fetchStudents(),
      ]);
      setDashboard(accounting);
      setStudents(studentList);
    } catch (err) {
      setError(err.message || 'Geciken ödeme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latePayments = useMemo(() => {
    const studentMap = new Map(students.map((student) => [String(student.fullName).toLowerCase(), student]));
    return (dashboard?.installments || [])
      .filter((item) => String(item.status || '').toLowerCase().includes('gec'))
      .map((item) => {
        const student = studentMap.get(String(item.student).toLowerCase());
        return {
          id: item.id,
          student: item.student,
          className: student?.className || 'Belirtilmedi',
          parent: student?.parentName || 'Veli',
          phone: student?.parentPhone || '-',
          amount: parseMoney(item.amount),
          daysLate: calculateDaysLate(item.due),
          due: item.due,
          note: item.note,
        };
      });
  }, [dashboard, students]);

  const filteredPayments = useMemo(() => latePayments.filter((payment) => (
    `${payment.student} ${payment.parent}`.toLowerCase().includes(search.toLowerCase())
  )), [latePayments, search]);

  const totalLate = latePayments.reduce((sum, p) => sum + p.amount, 0);

  const handleExport = () => {
    downloadCsvRows('geciken-odemeler.csv', [
      ['Ogrenci', 'Sinif', 'Veli', 'Telefon', 'Tutar', 'Gecikme Gunu', 'Son Odeme'],
      ...filteredPayments.map((payment) => [
        payment.student,
        payment.className,
        payment.parent,
        payment.phone,
        payment.amount,
        payment.daysLate,
        payment.due,
      ]),
    ]);
    toast({
      title: 'Excel hazır',
      description: `${filteredPayments.length} gecikmiş kayıt indirildi.`,
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const selectAll = () => {
    if (selected.length === filteredPayments.length) {
      setSelected([]);
    } else {
      setSelected(filteredPayments.map((p) => p.id));
    }
  };

  const sendReminder = async (type) => {
    const selectedPayments = filteredPayments.filter((item) => selected.includes(item.id));
    try {
      await Promise.all(selectedPayments.map((payment) => createAccountingNotification({
        title: `${payment.student} - Geciken Odeme`,
        message: `${payment.parent} için ${payment.student} adlı öğrencinin ödemesinde gecikme var. Lutfen iletisime gecin. Kanal: ${type === 'sms' ? 'SMS' : 'E-posta'}`,
      })));
      toast({
        title: `${type === 'sms' ? 'SMS' : 'E-posta'} gönderildi`,
        description: `${selectedPayments.length} veliye hatırlatma gönderildi.`,
      });
      setSelected([]);
    } catch (err) {
      toast({
        title: 'Bildirim gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const getSeverityBadge = (days) => {
    if (days > 10) return <Badge className="bg-red-100 text-red-700">{days} gün</Badge>;
    if (days > 5) return <Badge className="bg-yellow-100 text-yellow-700">{days} gün</Badge>;
    return <Badge className="bg-orange-100 text-orange-700">{days} gün</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Geciken ödemeler yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="late-payments-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Geciken Ödemeler</h1>
          <p className="text-muted-foreground mt-1">
            {latePayments.length} kayıt • Toplam: ₺{totalLate.toLocaleString('tr-TR')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Excel İndir
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Geciken ödemeler alınamadı" message={error} onRetry={loadData} /> : null}

      <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
        <CardContent className="p-4 flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <p className="font-medium">Dikkat: {latePayments.filter((p) => p.daysLate > 10).length} öğrenci 10 günü aşmış gecikmeye sahip</p>
            <p className="text-sm text-muted-foreground">Bu velilere öncelikli hatırlatma gönderilmesi önerilir.</p>
          </div>
        </CardContent>
      </Card>

      {selected.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-brand-primary/5 rounded-lg border border-brand-primary/20"
        >
          <span className="text-sm font-medium">{selected.length} seçili</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => sendReminder('sms')}>
              <Phone className="h-4 w-4 mr-2" />
              SMS Gönder
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendReminder('email')}>
              <Mail className="h-4 w-4 mr-2" />
              E-posta Gönder
            </Button>
          </div>
        </motion.div>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Öğrenci veya veli ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.length === filteredPayments.length && filteredPayments.length > 0}
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Veli / İletişim</TableHead>
                <TableHead>Borç</TableHead>
                <TableHead>Gecikme</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <motion.tr
                  key={payment.id}
                  variants={itemVariants}
                  className={`cursor-pointer hover:bg-muted/50 ${selected.includes(payment.id) ? 'bg-brand-primary/5' : ''}`}
                  onClick={() => navigate('/finance/student-accounts')}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(payment.id)}
                      onCheckedChange={() => toggleSelect(payment.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {payment.student.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{payment.student}</p>
                        <p className="text-sm text-muted-foreground">{payment.className}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{payment.parent}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {payment.phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-red-600">
                    ₺{payment.amount.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell>{getSeverityBadge(payment.daysLate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {payment.due}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected([payment.id]); sendReminder('sms'); }}>
                      <Bell className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
