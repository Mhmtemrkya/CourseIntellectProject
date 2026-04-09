import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Ticket, Search, Clock, CheckCircle, AlertCircle,
  MessageSquare, User, Building2, ChevronRight, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockTickets = [
  { 
    id: 'TKT-001', 
    subject: 'Ödeme Sistemi Hatası', 
    tenant: 'Özel Yıldız Koleji', 
    user: 'Ahmet Yıldız',
    status: 'open', 
    priority: 'high',
    category: 'billing',
    createdAt: '2025-01-06T10:30:00',
    lastReply: '2025-01-06T14:20:00',
    messages: 5
  },
  { 
    id: 'TKT-002', 
    subject: 'API Entegrasyonu Yardım', 
    tenant: 'ABC Eğitim', 
    user: 'Zeynep Kaya',
    status: 'pending', 
    priority: 'medium',
    category: 'technical',
    createdAt: '2025-01-05T09:15:00',
    lastReply: '2025-01-05T16:45:00',
    messages: 8
  },
  { 
    id: 'TKT-003', 
    subject: 'Kullanıcı Limiti Artırma', 
    tenant: 'Modern Akademi', 
    user: 'Can Demir',
    status: 'open', 
    priority: 'low',
    category: 'account',
    createdAt: '2025-01-04T11:00:00',
    lastReply: '2025-01-04T15:30:00',
    messages: 3
  },
  { 
    id: 'TKT-004', 
    subject: 'SignalR Bağlantı Sorunu', 
    tenant: 'Gelecek Nesil Okulu', 
    user: 'Elif Şahin',
    status: 'resolved', 
    priority: 'high',
    category: 'technical',
    createdAt: '2025-01-03T08:45:00',
    lastReply: '2025-01-04T10:00:00',
    messages: 12
  },
  { 
    id: 'TKT-005', 
    subject: 'Fatura Düzeltme Talebi', 
    tenant: 'Parlak Zihinler', 
    user: 'Mehmet Aksoy',
    status: 'closed', 
    priority: 'medium',
    category: 'billing',
    createdAt: '2025-01-02T14:20:00',
    lastReply: '2025-01-03T09:15:00',
    messages: 6
  },
];

const stats = {
  open: mockTickets.filter(t => t.status === 'open').length,
  pending: mockTickets.filter(t => t.status === 'pending').length,
  resolved: mockTickets.filter(t => t.status === 'resolved').length,
  avgResponseTime: '2.4 saat',
};

export default function Support() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredTickets = mockTickets.filter((ticket) => {
    const matchesSearch = ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
                         ticket.tenant.toLowerCase().includes(search.toLowerCase()) ||
                         ticket.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-support-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Destek Talepleri</h1>
        <p className="text-muted-foreground mt-1">Kurum destek taleplerini yönetin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-sm text-muted-foreground">Açık Talep</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Beklemede</p>
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
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-sm text-muted-foreground">Çözüldü</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <MessageSquare className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgResponseTime}</p>
                <p className="text-sm text-muted-foreground">Ort. Yanıt</p>
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
                placeholder="Talep ara..."
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
                <SelectItem value="open">Açık</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="resolved">Çözüldü</SelectItem>
                <SelectItem value="closed">Kapalı</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
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

      {/* Tickets Table */}
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
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <motion.tr
                  key={ticket.id}
                  variants={itemVariants}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{ticket.tenant}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>{ticket.messages}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
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
