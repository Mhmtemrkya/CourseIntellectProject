import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Plus, MoreHorizontal, Eye, CreditCard, 
  FileText, Users, TrendingUp, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useApp } from '../../context/AppContext';
import { SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const mockStudentAccounts = [
  { id: 1, name: 'Ali Yılmaz', class: '10-A', parent: 'Ahmet Yılmaz', totalFee: 45000, paid: 38000, balance: -7000, status: 'current' },
  { id: 2, name: 'Ayşe Demir', class: '10-A', parent: 'Fatma Demir', totalFee: 45000, paid: 45000, balance: 0, status: 'paid' },
  { id: 3, name: 'Mehmet Kaya', class: '10-B', parent: 'Mustafa Kaya', totalFee: 45000, paid: 30000, balance: -15000, status: 'overdue' },
  { id: 4, name: 'Zeynep Öztürk', class: '10-B', parent: 'Hatice Öztürk', totalFee: 45000, paid: 42000, balance: -3000, status: 'current' },
  { id: 5, name: 'Can Arslan', class: '11-A', parent: 'İbrahim Arslan', totalFee: 48000, paid: 48000, balance: 0, status: 'paid' },
  { id: 6, name: 'Elif Şahin', class: '11-A', parent: 'Emine Şahin', totalFee: 48000, paid: 36000, balance: -12000, status: 'overdue' },
];

const mockClasses = ['10-A', '10-B', '11-A', '11-B', '12-A'];

function StudentAccountDrawer({ account }) {
  if (!account) return null;

  const transactions = [
    { date: '2025-01-10', type: 'payment', description: 'Ocak Taksit', amount: 5000 },
    { date: '2024-12-15', type: 'payment', description: 'Aralık Taksit', amount: 5000 },
    { date: '2024-11-10', type: 'payment', description: 'Kasım Taksit', amount: 5000 },
    { date: '2024-10-15', type: 'payment', description: 'Ekim Taksit', amount: 5000 },
    { date: '2024-09-01', type: 'fee', description: 'Yıllık Eğitim Ücreti', amount: -45000 },
  ];

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğrenci Cari Hesabı</SheetTitle>
        <SheetDescription>Hesap hareketleri ve bakiye durumu</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {account.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{account.name}</h3>
          <p className="text-sm text-muted-foreground">{account.class} • Veli: {account.parent}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">₺{account.totalFee.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Toplam Ücret</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">₺{account.paid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Ödenen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${account.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₺{Math.abs(account.balance).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{account.balance < 0 ? 'Borç' : 'Bakiye'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Hesap Hareketleri</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((tx, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tx.type === 'payment' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {tx.type === 'payment' ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
              <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.amount > 0 ? '+' : ''}₺{Math.abs(tx.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button className="flex-1 bg-brand-primary hover:bg-brand-primary/90">
          <CreditCard className="h-4 w-4 mr-2" />
          Tahsilat Gir
        </Button>
        <Button variant="outline" className="flex-1">
          <FileText className="h-4 w-4 mr-2" />
          Ekstre
        </Button>
      </div>
    </div>
  );
}

export default function StudentAccounts() {
  const { openDrawer } = useApp();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredAccounts = mockStudentAccounts.filter((account) => {
    const matchesSearch = account.name.toLowerCase().includes(search.toLowerCase()) ||
      account.parent.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || account.class === classFilter;
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      current: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = { paid: 'Ödendi', current: 'Güncel', overdue: 'Gecikmiş' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-accounts-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Öğrenci Cari Hesapları</h1>
          <p className="text-muted-foreground mt-1">{mockStudentAccounts.length} öğrenci hesabı</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Toplu Tahsilat
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öğrenci veya veli ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Sınıf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {mockClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="current">Güncel</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead>Toplam Ücret</TableHead>
                <TableHead>Ödenen</TableHead>
                <TableHead>Bakiye</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <motion.tr
                  key={account.id}
                  variants={itemVariants}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => openDrawer(<StudentAccountDrawer account={account} />)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {account.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">Veli: {account.parent}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.class}</Badge>
                  </TableCell>
                  <TableCell>₺{account.totalFee.toLocaleString()}</TableCell>
                  <TableCell className="text-green-600">₺{account.paid.toLocaleString()}</TableCell>
                  <TableCell className={account.balance < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                    {account.balance < 0 ? '-' : ''}₺{Math.abs(account.balance).toLocaleString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Detay</DropdownMenuItem>
                        <DropdownMenuItem><CreditCard className="h-4 w-4 mr-2" /> Tahsilat Gir</DropdownMenuItem>
                        <DropdownMenuItem><FileText className="h-4 w-4 mr-2" /> Ekstre</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
