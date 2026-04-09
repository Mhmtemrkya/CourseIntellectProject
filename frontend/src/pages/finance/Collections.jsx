import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Plus, CreditCard, Banknote, Building2, 
  Receipt, Download, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const mockCollections = [
  { id: 1, receiptNo: 'MKB-2025-001', student: 'Ali Yılmaz', amount: 2500, type: 'cash', date: '2025-01-06', collector: 'Ayşe H.', description: 'Ocak Taksit' },
  { id: 2, receiptNo: 'MKB-2025-002', student: 'Zeynep Kaya', amount: 3200, type: 'transfer', date: '2025-01-06', collector: 'Sistem', description: 'Ocak Taksit' },
  { id: 3, receiptNo: 'MKB-2025-003', student: 'Mehmet Demir', amount: 1800, type: 'card', date: '2025-01-05', collector: 'Ayşe H.', description: 'Kısmi Ödeme' },
  { id: 4, receiptNo: 'MKB-2025-004', student: 'Elif Şahin', amount: 2500, type: 'cash', date: '2025-01-05', collector: 'Ayşe H.', description: 'Ocak Taksit' },
  { id: 5, receiptNo: 'MKB-2025-005', student: 'Can Arslan', amount: 5000, type: 'transfer', date: '2025-01-04', collector: 'Sistem', description: 'Ocak + Şubat' },
];

const mockStudents = [
  { id: 1, name: 'Ali Yılmaz', class: '10-A', balance: -7000 },
  { id: 2, name: 'Mehmet Kaya', class: '10-B', balance: -15000 },
  { id: 3, name: 'Zeynep Öztürk', class: '10-B', balance: -3000 },
];

const paymentTypes = [
  { value: 'cash', label: 'Nakit', icon: Banknote },
  { value: 'card', label: 'Kredi Kartı', icon: CreditCard },
  { value: 'transfer', label: 'Havale/EFT', icon: Building2 },
];

function NewCollectionDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const [paymentType, setPaymentType] = useState('cash');

  const handleSave = () => {
    toast({
      title: "Tahsilat kaydedildi",
      description: "Makbuz oluşturuldu ve öğrenci hesabına işlendi.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Tahsilat</DialogTitle>
          <DialogDescription>Ödeme bilgilerini girin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Öğrenci seçin" />
              </SelectTrigger>
              <SelectContent>
                {mockStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{student.name} ({student.class})</span>
                      <Badge variant="outline" className="ml-2 text-red-600">
                        ₺{Math.abs(student.balance).toLocaleString()}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ödeme Yöntemi</Label>
            <Tabs value={paymentType} onValueChange={setPaymentType}>
              <TabsList className="grid grid-cols-3">
                {paymentTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tutar (₺)</Label>
              <Input type="number" placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input placeholder="Ör: Ocak Taksit" />
          </div>

          {paymentType === 'card' && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Kredi kartı ödemeleri için POS cihazını kullanın ve işlem numarasını not alın.
              </p>
            </div>
          )}

          {paymentType === 'transfer' && (
            <div className="space-y-2">
              <Label>Dekont/Referans No</Label>
              <Input placeholder="Banka dekont numarası" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave}>
            <Receipt className="h-4 w-4 mr-2" />
            Kaydet ve Makbuz Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Collections() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredCollections = mockCollections.filter((collection) => {
    const matchesSearch = collection.student.toLowerCase().includes(search.toLowerCase()) ||
      collection.receiptNo.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || collection.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type) => {
    const config = {
      cash: { label: 'Nakit', className: 'bg-green-100 text-green-700' },
      card: { label: 'Kredi Kartı', className: 'bg-blue-100 text-blue-700' },
      transfer: { label: 'Havale', className: 'bg-purple-100 text-purple-700' },
    };
    return <Badge className={config[type].className}>{config[type].label}</Badge>;
  };

  const totalToday = mockCollections
    .filter(c => c.date === '2025-01-06')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="collections-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Tahsilatlar</h1>
          <p className="text-muted-foreground mt-1">Bugün: ₺{totalToday.toLocaleString()}</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Tahsilat
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paymentTypes.map((type) => {
          const Icon = type.icon;
          const total = mockCollections
            .filter(c => c.type === type.value)
            .reduce((sum, c) => sum + c.amount, 0);
          return (
            <Card key={type.value}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₺{total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{type.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tahsilat ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Ödeme Türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                <SelectItem value="cash">Nakit</SelectItem>
                <SelectItem value="card">Kredi Kartı</SelectItem>
                <SelectItem value="transfer">Havale</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Excel İndir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Collections Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Makbuz No</TableHead>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>İşleyen</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCollections.map((collection) => (
                <motion.tr
                  key={collection.id}
                  variants={itemVariants}
                  className="hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-sm">{collection.receiptNo}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{collection.student}</p>
                      <p className="text-xs text-muted-foreground">{collection.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-green-600">₺{collection.amount.toLocaleString()}</TableCell>
                  <TableCell>{getTypeBadge(collection.type)}</TableCell>
                  <TableCell>{new Date(collection.date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>{collection.collector}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewCollectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
