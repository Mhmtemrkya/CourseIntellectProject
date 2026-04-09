import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, Search,
  Eye, ThumbsUp, ThumbsDown, MoreHorizontal, MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockApprovals = [
  { 
    id: 1, 
    type: 'refund', 
    student: 'Ali Yılmaz', 
    class: '10-A',
    amount: 2500, 
    reason: 'Fazla ödeme - taksit tutarı hatalı hesaplanmış',
    requestedBy: 'Ayşe Hanım',
    requestedAt: '2025-01-06T10:30:00',
    status: 'pending'
  },
  { 
    id: 2, 
    type: 'cancel', 
    student: 'Zeynep Kaya', 
    class: '10-A',
    amount: 4000, 
    reason: 'Öğrenci kaydı iptal - ücret iadesi',
    requestedBy: 'Ayşe Hanım',
    requestedAt: '2025-01-05T14:20:00',
    status: 'pending'
  },
  { 
    id: 3, 
    type: 'discount', 
    student: 'Can Arslan', 
    class: '11-A',
    amount: 3600, 
    reason: 'Ek %15 kardeş indirimi talebi',
    requestedBy: 'Mehmet Bey',
    requestedAt: '2025-01-04T09:15:00',
    status: 'pending'
  },
  { 
    id: 4, 
    type: 'refund', 
    student: 'Elif Şahin', 
    class: '11-B',
    amount: 1800, 
    reason: 'Mükerrer ödeme iadesi',
    requestedBy: 'Ayşe Hanım',
    requestedAt: '2025-01-03T16:45:00',
    status: 'approved',
    approvedBy: 'Admin',
    approvedAt: '2025-01-04T10:00:00'
  },
  { 
    id: 5, 
    type: 'cancel', 
    student: 'Burak Çelik', 
    class: '11-B',
    amount: 8000, 
    reason: 'Kayıt iptali - tam iade talebi',
    requestedBy: 'Mehmet Bey',
    requestedAt: '2025-01-02T11:30:00',
    status: 'rejected',
    rejectedBy: 'Admin',
    rejectedAt: '2025-01-03T09:00:00',
    rejectReason: 'Kayıt sözleşmesi gereği tam iade yapılamaz'
  },
];

export default function Approvals() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const filteredApprovals = mockApprovals.filter((approval) => {
    const matchesSearch = approval.student.toLowerCase().includes(search.toLowerCase()) ||
                         approval.reason.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || approval.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: mockApprovals.filter(a => a.status === 'pending').length,
    approved: mockApprovals.filter(a => a.status === 'approved').length,
    rejected: mockApprovals.filter(a => a.status === 'rejected').length,
    totalAmount: mockApprovals.filter(a => a.status === 'pending').reduce((a, b) => a + b.amount, 0),
  };

  const getTypeBadge = (type) => {
    const styles = {
      refund: 'bg-blue-100 text-blue-700',
      cancel: 'bg-red-100 text-red-700',
      discount: 'bg-green-100 text-green-700',
    };
    const labels = { refund: 'İade', cancel: 'İptal', discount: 'İndirim' };
    return <Badge className={styles[type]}>{labels[type]}</Badge>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const handleApprove = (approval) => {
    toast({
      title: 'Talep Onaylandı',
      description: `${approval.student} için ${approval.type === 'refund' ? 'iade' : approval.type === 'cancel' ? 'iptal' : 'indirim'} talebi onaylandı.`,
    });
  };

  const handleReject = () => {
    toast({
      title: 'Talep Reddedildi',
      description: `${selectedApproval.student} için talep reddedildi.`,
    });
    setDialogOpen(false);
    setRejectReason('');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="finance-approvals-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Onay Bekleyenler</h1>
        <p className="text-muted-foreground mt-1">İptal ve iade talepleri onayı</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className={stats.pending > 0 ? 'border-yellow-200 bg-yellow-50/50' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Bekleyen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-sm text-muted-foreground">Onaylanan</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-sm text-muted-foreground">Reddedilen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <AlertTriangle className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{stats.totalAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Bekleyen Tutar</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ara..."
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
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="pending">Bekleyen</SelectItem>
                <SelectItem value="approved">Onaylanan</SelectItem>
                <SelectItem value="rejected">Reddedilen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tür</TableHead>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Sebep</TableHead>
                <TableHead>Talep Eden</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-24">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell>{getTypeBadge(approval.type)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{approval.student}</p>
                      <p className="text-xs text-muted-foreground">{approval.class}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">₺{approval.amount.toLocaleString()}</TableCell>
                  <TableCell className="max-w-xs truncate">{approval.reason}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{approval.requestedBy}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(approval.requestedAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(approval.status)}</TableCell>
                  <TableCell>
                    {approval.status === 'pending' ? (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-green-600"
                          onClick={() => handleApprove(approval)}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-600"
                          onClick={() => {
                            setSelectedApproval(approval);
                            setDialogOpen(true);
                          }}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Talebi Reddet</DialogTitle>
            <DialogDescription>
              {selectedApproval?.student} için {selectedApproval?.type === 'refund' ? 'iade' : selectedApproval?.type === 'cancel' ? 'iptal' : 'indirim'} talebini reddetmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Red Sebebi</label>
              <Textarea
                placeholder="Red sebebini açıklayın..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleReject}>Reddet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
