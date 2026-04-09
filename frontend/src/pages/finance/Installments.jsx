import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Plus, Calendar, CheckCircle, Clock, 
  AlertCircle, Edit, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Progress } from '../../components/ui/progress';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const mockInstallmentPlans = [
  { 
    id: 1, 
    student: 'Ali Yılmaz', 
    class: '10-A',
    totalAmount: 45000,
    installmentCount: 10,
    paidCount: 8,
    nextDue: '2025-01-15',
    nextAmount: 4500,
    status: 'current'
  },
  { 
    id: 2, 
    student: 'Mehmet Kaya', 
    class: '10-B',
    totalAmount: 45000,
    installmentCount: 10,
    paidCount: 6,
    nextDue: '2025-01-10',
    nextAmount: 4500,
    status: 'overdue'
  },
  { 
    id: 3, 
    student: 'Zeynep Öztürk', 
    class: '10-B',
    totalAmount: 45000,
    installmentCount: 10,
    paidCount: 9,
    nextDue: '2025-01-20',
    nextAmount: 4500,
    status: 'current'
  },
  { 
    id: 4, 
    student: 'Can Arslan', 
    class: '11-A',
    totalAmount: 48000,
    installmentCount: 12,
    paidCount: 12,
    nextDue: null,
    nextAmount: 0,
    status: 'completed'
  },
];

function CreatePlanDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Taksit Planı</DialogTitle>
          <DialogDescription>Öğrenci için taksit planı oluşturun</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Öğrenci seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Ali Yılmaz (10-A)</SelectItem>
                <SelectItem value="2">Mehmet Kaya (10-B)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Toplam Tutar (₺)</Label>
              <Input type="number" placeholder="45000" />
            </div>
            <div className="space-y-2">
              <Label>Taksit Sayısı</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {[3, 6, 9, 10, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} Taksit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlangıç Tarihi</Label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <Label>Ödeme Günü</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Gün" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 5, 10, 15, 20, 25].map((d) => (
                    <SelectItem key={d} value={d.toString()}>Her ayın {d}. günü</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Taksit Tutarı:</span>
              <span className="font-bold">₺4,500</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Plan Oluştur</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Installments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredPlans = mockInstallmentPlans.filter((plan) => {
    const matchesSearch = plan.student.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const config = {
      current: { label: 'Güncel', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
      overdue: { label: 'Gecikmiş', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
      completed: { label: 'Tamamlandı', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
    };
    const { label, icon: Icon, className } = config[status];
    return (
      <Badge className={`${className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="installments-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Taksit Planları</h1>
          <p className="text-muted-foreground mt-1">{mockInstallmentPlans.length} aktif plan</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInstallmentPlans.filter(p => p.status === 'completed').length}</p>
              <p className="text-xs text-muted-foreground">Tamamlanan Plan</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInstallmentPlans.filter(p => p.status === 'current').length}</p>
              <p className="text-xs text-muted-foreground">Devam Eden</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInstallmentPlans.filter(p => p.status === 'overdue').length}</p>
              <p className="text-xs text-muted-foreground">Gecikmiş</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öğrenci ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="current">Güncel</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
                <SelectItem value="completed">Tamamlanan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Plans Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Toplam</TableHead>
                <TableHead>İlerleme</TableHead>
                <TableHead>Sonraki Taksit</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => {
                const progress = (plan.paidCount / plan.installmentCount) * 100;
                return (
                  <motion.tr
                    key={plan.id}
                    variants={itemVariants}
                    className="hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-brand-primary text-white">
                            {plan.student.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{plan.student}</p>
                          <p className="text-sm text-muted-foreground">{plan.class}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>₺{plan.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="w-20 h-2" />
                          <span className="text-sm">{plan.paidCount}/{plan.installmentCount}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.nextDue ? (
                        <div>
                          <p className="font-medium">₺{plan.nextAmount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(plan.nextDue).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(plan.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Calendar className="h-4 w-4 mr-2" /> Detay</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreatePlanDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
