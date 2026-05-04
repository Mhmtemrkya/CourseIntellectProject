import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LifeBuoy,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import {
  fetchMySupportTickets,
  createMySupportTicket,
} from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const CATEGORIES = [
  { value: 'Genel', label: 'Genel' },
  { value: 'Teknik', label: 'Teknik destek' },
  { value: 'Faturalama', label: 'Faturalama' },
  { value: 'Hesap', label: 'Hesap & Erişim' },
  { value: 'Öneri', label: 'Öneri / Geri bildirim' },
];

const PRIORITIES = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
];

function StatusBadge({ status }) {
  const v = String(status || '').toLowerCase();
  if (v === 'resolved' || v === 'closed') {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Çözüldü
      </Badge>
    );
  }
  if (v === 'in-progress' || v === 'pending') {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
        <Clock className="h-3 w-3" /> İşleniyor
      </Badge>
    );
  }
  if (v === 'cancelled') {
    return (
      <Badge className="bg-muted text-muted-foreground flex items-center gap-1">
        <XCircle className="h-3 w-3" /> İptal
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> Açık
    </Badge>
  );
}

function PriorityChip({ priority }) {
  const map = {
    urgent: { label: 'Acil', cls: 'text-red-500' },
    high: { label: 'Yüksek', cls: 'text-amber-500' },
    normal: { label: 'Normal', cls: 'text-muted-foreground' },
    low: { label: 'Düşük', cls: 'text-muted-foreground/70' },
  };
  const c = map[String(priority || '').toLowerCase()] || map.normal;
  return (
    <span className={`text-[10px] uppercase tracking-[0.18em] font-mono ${c.cls}`}>
      {c.label}
    </span>
  );
}

export default function Destek() {
  const { toast } = useToast();
  const { user } = useApp();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Genel');
  const [priority, setPriority] = useState('normal');
  const [summary, setSummary] = useState('');

  const isTenantAdmin = user?.role === 'admin' && !user?.isPlatformAdmin;

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const list = await fetchMySupportTickets();
      setTickets(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Talepler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isTenantAdmin) loadTickets();
    else setLoading(false);
  }, [isTenantAdmin, loadTickets]);

  // Sadece kurum yöneticisi
  if (!isTenantAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <ShieldCheck className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold">Sadece kurum yöneticisi</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Destek talebi yalnızca kurum yöneticisi tarafından oluşturulabilir.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingDots />
      </div>
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !summary.trim()) {
      toast({
        title: 'Eksik alan',
        description: 'Konu ve mesaj zorunludur.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      const created = await createMySupportTicket({
        subject: subject.trim(),
        summary: summary.trim(),
        category,
        priority,
      });
      toast({
        title: 'Talep oluşturuldu',
        description: `${created.ticketNumber} numaralı talebiniz alındı.`,
      });
      setSubject('');
      setSummary('');
      setCategory('Genel');
      setPriority('normal');
      await loadTickets();
    } catch (err) {
      toast({
        title: 'Talep gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="admin-destek-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Destek</h1>
        <p className="text-muted-foreground mt-1">
          Bir sorun ya da talebiniz mi var? CourseIntellect ekibine ulaşın.
        </p>
      </div>

      {error ? (
        <ErrorBanner title="Talepler alınamadı" message={error} onRetry={loadTickets} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5" />
                Yeni talep
              </CardTitle>
              <CardDescription>
                Kurum: <span className="font-medium text-foreground">{user?.tenant || user?.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Konu</Label>
                  <Input
                    id="subject"
                    placeholder="Kısa konu başlığı"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={120}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={category} onValueChange={setCategory} disabled={submitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Öncelik</Label>
                    <Select value={priority} onValueChange={setPriority} disabled={submitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Açıklama</Label>
                  <Textarea
                    id="summary"
                    placeholder="Sorunu / talebi mümkün olduğunca açık şekilde anlatın..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={6}
                    maxLength={1800}
                    disabled={submitting}
                    required
                  />
                  <div className="text-right text-[11px] text-muted-foreground">
                    {summary.length} / 1800
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Talebi gönder
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* My tickets */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Açtığım talepler</CardTitle>
              <CardDescription>{tickets.length} talep</CardDescription>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <LifeBuoy className="mx-auto mb-3 h-8 w-8 opacity-30" />
                  Henüz talep oluşturmadınız.
                </div>
              ) : (
                <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                  {tickets.map((t) => {
                    const hasReply =
                      Boolean(t.lastMessage) &&
                      String(t.lastMessage).trim() !== String(t.summary || '').trim();
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                              <span>{t.ticketNumber}</span>
                              <span>·</span>
                              <span>{t.category}</span>
                            </div>
                            <div className="mt-1 truncate font-medium">{t.subject}</div>
                            <div className="mt-1 text-[13px] text-muted-foreground line-clamp-2">
                              {t.summary}
                            </div>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>

                        {hasReply ? (
                          <div className="mt-3 rounded-lg border border-brand-accent/25 bg-brand-accent/[0.06] p-3">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-brand-accent font-mono">
                              <ShieldCheck className="h-3 w-3" />
                              CourseIntellect Yanıtı
                            </div>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90 line-clamp-3">
                              {t.lastMessage}
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{new Date(t.createdAtUtc).toLocaleString('tr-TR')}</span>
                          <div className="flex items-center gap-2">
                            {t.messages ? <span className="font-mono">{t.messages} mesaj</span> : null}
                            <PriorityChip priority={t.priority} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
