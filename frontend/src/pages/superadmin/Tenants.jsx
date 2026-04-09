import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Plus, Building2, MoreHorizontal, Eye, Edit, 
  Trash2, Users, CreditCard, CheckCircle, XCircle
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const mockTenants = [
  { id: 1, name: 'Özel Yıldız Koleji', email: 'admin@yildiz.edu.tr', plan: 'Enterprise', users: 450, branches: 3, status: 'active', monthlyFee: 4500, createdAt: '2024-01-15' },
  { id: 2, name: 'ABC Eğitim Kurumları', email: 'info@abc.edu.tr', plan: 'Business', users: 280, branches: 2, status: 'active', monthlyFee: 2800, createdAt: '2024-03-20' },
  { id: 3, name: 'Modern Akademi', email: 'contact@modern.edu.tr', plan: 'Starter', users: 85, branches: 1, status: 'trial', monthlyFee: 850, createdAt: '2025-01-02' },
  { id: 4, name: 'Gelecek Nesil Okulu', email: 'admin@gelecek.edu.tr', plan: 'Business', users: 320, branches: 2, status: 'active', monthlyFee: 3200, createdAt: '2024-06-10' },
  { id: 5, name: 'Parlak Zihinler', email: 'bilgi@parlak.edu.tr', plan: 'Enterprise', users: 520, branches: 4, status: 'suspended', monthlyFee: 5200, createdAt: '2023-09-01' },
];

const plans = ['Starter', 'Business', 'Enterprise'];

function AddTenantDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Kurum Ekle</DialogTitle>
          <DialogDescription>Platform'a yeni kurum kaydı oluşturun</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Kurum Adı</Label>
            <Input placeholder="Kurum adını girin" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input type="email" placeholder="admin@kurum.edu.tr" />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input placeholder="0212 xxx xx xx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Plan seçin" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Şube Sayısı</Label>
              <Input type="number" placeholder="1" min="1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Admin Kullanıcı E-postası</Label>
            <Input type="email" placeholder="Kurum yöneticisi e-postası" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Oluştur</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Tenants() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredTenants = mockTenants.filter((tenant) => {
    const matchesSearch = tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      trial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = { active: 'Aktif', trial: 'Deneme', suspended: 'Askıda' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-tenants-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Kurumlar</h1>
          <p className="text-muted-foreground mt-1">{mockTenants.length} kayıtlı kurum</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kurum
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kurum ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Planlar</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="trial">Deneme</SelectItem>
                <SelectItem value="suspended">Askıda</SelectItem>
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
                <TableHead>Kurum</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Şube</TableHead>
                <TableHead>Aylık Ücret</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <motion.tr
                  key={tenant.id}
                  variants={itemVariants}
                  className="group cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-primary/10">
                        <Building2 className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tenant.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{tenant.users}</span>
                    </div>
                  </TableCell>
                  <TableCell>{tenant.branches}</TableCell>
                  <TableCell>
                    <span className="font-medium">₺{tenant.monthlyFee.toLocaleString()}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Görüntüle</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                        <DropdownMenuItem><CreditCard className="h-4 w-4 mr-2" /> Faturalar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {tenant.status === 'active' ? (
                          <DropdownMenuItem className="text-yellow-600">
                            <XCircle className="h-4 w-4 mr-2" /> Askıya Al
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-green-600">
                            <CheckCircle className="h-4 w-4 mr-2" /> Aktifleştir
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddTenantDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
