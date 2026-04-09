import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, AlertCircle, Bell, Phone, Mail, 
  Calendar, Users, Send, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const mockLatePayments = [
  { id: 1, student: 'Mehmet Kaya', class: '10-B', parent: 'Mustafa Kaya', phone: '0543 333 44 55', amount: 15000, daysLate: 15, lastReminder: '2025-01-02' },
  { id: 2, student: 'Elif Şahin', class: '11-A', parent: 'Emine Şahin', phone: '0546 666 77 88', amount: 12000, daysLate: 10, lastReminder: '2025-01-04' },
  { id: 3, student: 'Burak Çelik', class: '11-B', parent: 'Ahmet Çelik', phone: '0538 777 88 99', amount: 4500, daysLate: 5, lastReminder: null },
  { id: 4, student: 'Selin Koç', class: '12-A', parent: 'Fatma Koç', phone: '0539 888 99 00', amount: 3200, daysLate: 8, lastReminder: '2025-01-03' },
];

export default function LatePayments() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filteredPayments = mockLatePayments.filter((payment) =>
    payment.student.toLowerCase().includes(search.toLowerCase()) ||
    payment.parent.toLowerCase().includes(search.toLowerCase())
  );

  const totalLate = mockLatePayments.reduce((sum, p) => sum + p.amount, 0);

  const toggleSelect = (id) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === filteredPayments.length) {
      setSelected([]);
    } else {
      setSelected(filteredPayments.map(p => p.id));
    }
  };

  const sendReminder = (type) => {
    toast({
      title: `${type === 'sms' ? 'SMS' : 'E-posta'} gönderildi`,
      description: `${selected.length} veliye hatırlatma ${type === 'sms' ? 'SMS\'i' : 'e-postası'} gönderildi.`,
    });
    setSelected([]);
  };

  const getSeverityBadge = (days) => {
    if (days > 10) return <Badge className="bg-red-100 text-red-700">{days} gün</Badge>;
    if (days > 5) return <Badge className="bg-yellow-100 text-yellow-700">{days} gün</Badge>;
    return <Badge className="bg-orange-100 text-orange-700">{days} gün</Badge>;
  };

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
            {mockLatePayments.length} kayıt • Toplam: ₺{totalLate.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Excel İndir
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
        <CardContent className="p-4 flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <p className="font-medium">Dikkat: {mockLatePayments.filter(p => p.daysLate > 10).length} öğrenci 10 günü aşmış gecikmeye sahip</p>
            <p className="text-sm text-muted-foreground">Bu velilere öncelikli hatırlatma gönderilmesi önerilir.</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selected.length > 0 && (
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
      )}

      {/* Filters */}
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

      {/* Late Payments Table */}
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
                <TableHead>Son Hatırlatma</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <motion.tr
                  key={payment.id}
                  variants={itemVariants}
                  className={`hover:bg-muted/50 ${selected.includes(payment.id) ? 'bg-brand-primary/5' : ''}`}
                >
                  <TableCell>
                    <Checkbox 
                      checked={selected.includes(payment.id)}
                      onCheckedChange={() => toggleSelect(payment.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {payment.student.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{payment.student}</p>
                        <p className="text-sm text-muted-foreground">{payment.class}</p>
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
                    ₺{payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{getSeverityBadge(payment.daysLate)}</TableCell>
                  <TableCell>
                    {payment.lastReminder ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(payment.lastReminder).toLocaleDateString('tr-TR')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
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
