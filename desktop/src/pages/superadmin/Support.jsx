import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  ExternalLink,
  Send,
  Building2,
  User as UserIcon,
  Calendar,
  Tag,
  Flame,
  Loader2,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchSupportTickets,
  updateSupportTicket,
} from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const STATUS_META = {
  open: { label: 'Açık', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: AlertCircle },
  'in-progress': { label: 'İşleniyor', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  pending: { label: 'Beklemede', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  resolved: { label: 'Çözüldü', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  closed: { label: 'Kapalı', cls: 'bg-muted text-muted-foreground', icon: CheckCircle },
  cancelled: { label: 'İptal', cls: 'bg-muted text-muted-foreground', icon: XCircle },
};

const PRIORITY_META = {
  urgent: { label: 'Acil', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' },
  high: { label: 'Yüksek', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: 'bg-orange-500' },
  normal: { label: 'Normal', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  medium: { label: 'Orta', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  low: { label: 'Düşük', cls: 'bg-muted text-muted-foreground', dot: 'bg-gray-400' },
};

function StatusBadge({ status }) {
  const v = String(status || 'open').toLowerCase();
  const meta = STATUS_META[v] || STATUS_META.open;
  const Icon = meta.icon;
  return (
    <Badge className={`${meta.cls} flex items-center gap-1 border-transparent`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const v = String(priority || 'normal').toLowerCase();
  const meta = PRIORITY_META[v] || PRIORITY_META.normal;
  return (
    <Badge className={`${meta.cls} flex items-center gap-1.5 border-transparent`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Support() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const loadSupport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const list = await fetchSupportTickets();
      setTickets(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Destek görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupport();
  }, [loadSupport]);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const haystack = `${ticket.subject || ''} ${ticket.tenant || ''} ${ticket.ticketNumber || ''} ${ticket.user || ''}`.toLowerCase();
        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      }),
    [tickets, search, statusFilter, priorityFilter],
  );

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open' || t.status === 'in-progress').length;
    const pending = tickets.filter((t) => t.status === 'pending').length;
    const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
    const urgent = tickets.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
    return { open, pending, resolved, urgent };
  }, [tickets]);

  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingDots />
      </div>
    );

  const handleTicketUpdate = (updatedTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
    setSelected(updatedTicket);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-support-page"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Destek Talepleri</h1>
          <p className="text-muted-foreground mt-1">
            Kurum yöneticilerinden gelen talepleri görüntüle, durumu güncelle, yanıtla.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSupport}>
          Yenile
        </Button>
      </div>

      {error ? <ErrorBanner title="Destek görünümü alınamadı" message={error} onRetry={loadSupport} /> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.open}</p>
              <p className="text-sm text-muted-foreground">Açık / İşleniyor</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Beklemede</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-sm text-muted-foreground">Çözüldü / Kapalı</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
              <Flame className="h-6 w-6 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.urgent}</p>
              <p className="text-sm text-muted-foreground">Yüksek + Acil</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Konu, kurum, talep no veya kullanıcı ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="open">Açık</SelectItem>
                <SelectItem value="in-progress">İşleniyor</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="resolved">Çözüldü</SelectItem>
                <SelectItem value="closed">Kapalı</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Öncelikler</SelectItem>
                <SelectItem value="urgent">Acil</SelectItem>
                <SelectItem value="high">Yüksek</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
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
                <TableHead className="w-32">Talep No</TableHead>
                <TableHead>Konu / Kurum</TableHead>
                <TableHead className="w-32">Öncelik</TableHead>
                <TableHead className="w-36">Durum</TableHead>
                <TableHead className="w-40">Tarih</TableHead>
                <TableHead className="w-24 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Filtreyle eşleşen talep yok.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(ticket)}
                  >
                    <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium leading-tight">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.tenant} · {ticket.user || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(ticket.createdAtUtc)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(ticket);
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Aç
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TicketDetailDialog
        ticket={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onUpdated={handleTicketUpdate}
        toast={toast}
      />
    </motion.div>
  );
}

/* ============================================================
 * Detay diyaloğu — talep tüm bilgileri + status güncelleme + yanıtlama
 * ============================================================ */

function TicketDetailDialog({ ticket, open, onClose, onUpdated, toast }) {
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('normal');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status || 'open');
      setPriority(ticket.priority || 'normal');
      setReply('');
    }
  }, [ticket]);

  if (!ticket) return null;

  const dirty = status !== ticket.status || priority !== ticket.priority;

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateSupportTicket(ticket.id, {
        status,
        priority,
      });
      toast({
        title: 'Talep güncellendi',
        description: `${ticket.ticketNumber} bilgileri kaydedildi.`,
      });
      onUpdated(updated);
    } catch (err) {
      toast({
        title: 'Güncellenemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    try {
      setReplying(true);
      const updated = await updateSupportTicket(ticket.id, {
        lastMessage: reply.trim(),
        messages: (ticket.messages || 1) + 1,
        // Yanıt yazıldıysa açık olanı işleniyora çek
        status: status === 'open' ? 'in-progress' : status,
      });
      toast({
        title: 'Yanıt eklendi',
        description: 'Talebe son mesaj olarak işlendi.',
      });
      onUpdated(updated);
      setReply('');
      setStatus(updated.status || status);
    } catch (err) {
      toast({
        title: 'Yanıt gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setReplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                <Tag className="h-3 w-3" />
                {ticket.ticketNumber}
                <span className="opacity-50">·</span>
                {ticket.category || 'Genel'}
              </div>
              <DialogTitle className="text-xl">{ticket.subject}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {ticket.tenant}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  {ticket.user || '—'} <span className="opacity-60">({ticket.userRole || '—'})</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> {formatDateTime(ticket.createdAtUtc)}
                </span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {/* Asıl talep metni */}
          <Card className="border-muted">
            <CardContent className="p-5">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Açıklama
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.summary || '—'}</p>
              {ticket.lastMessage && ticket.lastMessage !== ticket.summary && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    Son mesaj
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {ticket.lastMessage}
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{ticket.messages || 1} mesaj</span>
                <span>·</span>
                <span>Güncellendi: {formatDateTime(ticket.updatedAtUtc)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status + Priority düzenleme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Açık</SelectItem>
                  <SelectItem value="in-progress">İşleniyor</SelectItem>
                  <SelectItem value="pending">Beklemede</SelectItem>
                  <SelectItem value="resolved">Çözüldü</SelectItem>
                  <SelectItem value="closed">Kapalı</SelectItem>
                  <SelectItem value="cancelled">İptal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Öncelik</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Acil</SelectItem>
                  <SelectItem value="high">Yüksek</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Düşük</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="bg-brand-primary hover:bg-brand-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...
                </>
              ) : (
                'Değişiklikleri kaydet'
              )}
            </Button>
          </div>

          {/* Yanıt yaz */}
          <div className="border-t pt-5 space-y-3">
            <Label className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Yanıt yaz
            </Label>
            <Textarea
              placeholder="Kuruma iletilecek yanıtı yazın..."
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              disabled={replying}
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Yanıt eklendiğinde "Açık" durumdaki talepler otomatik "İşleniyor"a çekilir.
              </p>
              <Button
                onClick={handleReply}
                disabled={!reply.trim() || replying}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white"
              >
                {replying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Yanıtı gönder
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
