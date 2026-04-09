import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Search,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchAccountingDashboard, updateApprovalStatus } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function parseMoneyFromTitle(title = '') {
  const match = title.match(/(\d+[.,]?\d*)/);
  return match ? Number(match[1].replace(',', '.')) : 0;
}

function approvalStatus(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('approved') || normalized.includes('onay')) return 'approved';
  if (normalized.includes('rejected') || normalized.includes('red')) return 'rejected';
  return 'pending';
}

function approvalType(category = '') {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('iade')) return { key: 'refund', label: 'İade', className: 'bg-blue-100 text-blue-700' };
  if (normalized.includes('iptal')) return { key: 'cancel', label: 'İptal', className: 'bg-red-100 text-red-700' };
  return { key: 'discount', label: 'Düzeltme', className: 'bg-green-100 text-green-700' };
}

export default function Approvals() {
  const { toast } = useToast();
  const { user } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canApprove = ['admin', 'administrative'].includes(String(user?.backendRole || user?.role || '').toLowerCase());

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAccountingDashboard();
      setDashboard(payload);
    } catch (err) {
      setError(err.message || 'Onay kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const approvals = useMemo(() => dashboard?.approvals || [], [dashboard]);

  const filteredApprovals = useMemo(() => approvals.filter((approval) => {
    const matchesSearch = `${approval.title} ${approval.reason} ${approval.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || approvalStatus(approval.status) === statusFilter;
    return matchesSearch && matchesStatus;
  }), [approvals, search, statusFilter]);

  const stats = useMemo(() => ({
    pending: approvals.filter((a) => approvalStatus(a.status) === 'pending').length,
    approved: approvals.filter((a) => approvalStatus(a.status) === 'approved').length,
    rejected: approvals.filter((a) => approvalStatus(a.status) === 'rejected').length,
    totalAmount: approvals
      .filter((a) => approvalStatus(a.status) === 'pending')
      .reduce((sum, item) => sum + parseMoneyFromTitle(item.title), 0),
  }), [approvals]);

  const getStatusBadge = (status) => {
    const key = approvalStatus(status);
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
    return <Badge className={styles[key]}>{labels[key]}</Badge>;
  };

  const handleApprove = async (approval) => {
    if (!canApprove) {
      toast({
        title: 'Yetki yok',
        description: 'Bu işlem için yönetici hesabı gerekiyor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updated = await updateApprovalStatus(approval.id, 'Approved');
      setDashboard((prev) => ({
        ...prev,
        approvals: (prev?.approvals || []).map((item) => (item.id === updated.id ? updated : item)),
      }));
      toast({
        title: 'Talep onaylandı',
        description: 'Kayıt backend üzerinde güncellendi.',
      });
    } catch (err) {
      toast({
        title: 'Onay işlemi başarısız',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    if (!canApprove) {
      toast({
        title: 'Yetki yok',
        description: 'Bu işlem için yönetici hesabı gerekiyor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updated = await updateApprovalStatus(selectedApproval.id, 'Rejected');
      setDashboard((prev) => ({
        ...prev,
        approvals: (prev?.approvals || []).map((item) => (item.id === updated.id ? updated : item)),
      }));
      toast({
        title: 'Talep reddedildi',
        description: rejectReason || 'Kayıt backend üzerinde reddedildi.',
      });
      setDialogOpen(false);
      setRejectReason('');
    } catch (err) {
      toast({
        title: 'Reddetme işlemi başarısız',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Onay kayıtları yükleniyor...</p>
      </div>
    );
  }

  if (!canApprove) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-approvals-page">
        <div>
          <h1 className="text-3xl font-bold font-heading">Finans Onayları</h1>
          <p className="text-muted-foreground mt-1">Bu ekran yalnızca yönetici ve idari roller için açıktır.</p>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Finans onayları, muhasebe operasyonlarından ayrı olarak yönetim katmanında değerlendirildiği için bu role kapatıldı.
          </CardContent>
        </Card>
      </motion.div>
    );
  }

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
        <p className="text-muted-foreground mt-1">İptal ve iade talepleri</p>
      </div>

      {error ? <ErrorBanner title="Onay kayıtları alınamadı" message={error} onRetry={loadApprovals} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.pending, 'Bekleyen', Clock, 'text-yellow-600'],
          [stats.approved, 'Onaylanan', CheckCircle, 'text-green-600'],
          [stats.rejected, 'Reddedilen', XCircle, 'text-red-600'],
          [`₺${stats.totalAmount.toLocaleString('tr-TR')}`, 'Bekleyen Tutar', AlertTriangle, 'text-brand-primary'],
        ].map(([value, label, Icon, color]) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted/70">
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tür</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Sebep</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-32">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map((approval) => {
                const type = approvalType(approval.category);
                const pending = approvalStatus(approval.status) === 'pending';
                return (
                  <TableRow key={approval.id}>
                    <TableCell><Badge className={type.className}>{type.label}</Badge></TableCell>
                    <TableCell className="font-medium">{approval.title}</TableCell>
                    <TableCell>{approval.sourceType}</TableCell>
                    <TableCell>{approval.reason}</TableCell>
                    <TableCell>{getStatusBadge(approval.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleApprove(approval)} disabled={!pending || !canApprove}>
                          <ThumbsUp className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!pending || !canApprove}
                          onClick={() => {
                            setSelectedApproval(approval);
                            setDialogOpen(true);
                          }}
                        >
                          <ThumbsDown className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Talebi Reddet</DialogTitle>
            <DialogDescription>İstersen not bırak, sistem yine kaydı reddeder.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reddetme nedeni"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button variant="destructive" onClick={handleReject}>Reddet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
