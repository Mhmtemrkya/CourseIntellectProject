import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Clock, CheckCircle, AlertCircle, MessageSquare,
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
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchSupportTickets } from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSupport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setTickets(await fetchSupportTickets());
    } catch (err) {
      setError(err.message || 'Destek görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupport();
  }, [loadSupport]);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const matchesSearch = `${ticket.subject} ${ticket.tenant} ${ticket.ticketNumber}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }), [tickets, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    open: tickets.filter((item) => item.status === 'open').length,
    pending: tickets.filter((item) => item.status === 'pending').length,
    resolved: tickets.filter((item) => item.status === 'resolved').length,
    avgResponseTime: 'Canlı veri',
  }), [tickets]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-yellow-100 text-yellow-700',
      pending: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    const labels = { open: 'Açık', pending: 'Beklemede', resolved: 'Çözüldü', closed: 'Kapalı' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    };
    const labels = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
    return <Badge className={styles[priority]}>{labels[priority]}</Badge>;
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-support-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Destek Talepleri</h1>
        <p className="text-muted-foreground mt-1">Gerçek destek talepleri ve operasyon akışı</p>
      </div>

      {error ? <ErrorBanner title="Destek görünümü alınamadı" message={error} onRetry={loadSupport} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-yellow-100"><AlertCircle className="h-6 w-6 text-yellow-600" /></div><div><p className="text-2xl font-bold">{stats.open}</p><p className="text-sm text-muted-foreground">Açık Talep</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-blue-100"><Clock className="h-6 w-6 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-sm text-muted-foreground">Beklemede</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-green-100"><CheckCircle className="h-6 w-6 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.resolved}</p><p className="text-sm text-muted-foreground">Çözüldü</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-brand-primary/10"><MessageSquare className="h-6 w-6 text-brand-primary" /></div><div><p className="text-2xl font-bold">{stats.avgResponseTime}</p><p className="text-sm text-muted-foreground">Yanıt Akışı</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Talep ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="open">Açık</SelectItem>
                <SelectItem value="resolved">Çözüldü</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Öncelik" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Öncelikler</SelectItem>
                <SelectItem value="high">Yüksek</SelectItem>
                <SelectItem value="medium">Orta</SelectItem>
                <SelectItem value="low">Düşük</SelectItem>
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
                <TableHead>Talep</TableHead>
                <TableHead>Kurum</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Mesaj</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="w-28">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} className="hover:bg-muted/50">
                  <TableCell><div><p className="font-medium">{ticket.subject}</p><p className="text-xs text-muted-foreground">{ticket.ticketNumber}</p></div></TableCell>
                  <TableCell>{ticket.tenant}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>{ticket.messages}</TableCell>
                  <TableCell>{ticket.createdAtUtc ? new Date(ticket.createdAtUtc).toLocaleDateString('tr-TR') : '-'}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate('/admin/notifications')}>Aç</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
