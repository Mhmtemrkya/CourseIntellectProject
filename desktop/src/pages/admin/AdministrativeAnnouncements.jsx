import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Eye, Megaphone, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements } from '../../lib/api/modules';

function roleLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('teacher')) return 'Öğretmen';
  if (normalized.includes('veli') || normalized.includes('parent')) return 'Veli';
  if (normalized.includes('ogrenci') || normalized.includes('student')) return 'Öğrenci';
  if (normalized.includes('admin')) return 'Yönetici';
  if (normalized.includes('administrative')) return 'İdari Birim';
  return value || 'Sistem';
}

function publisherLabel(item) {
  if (item.createdByName) return item.createdByName;
  const role = roleLabel(item.createdByRole);
  return role === 'Sistem' ? 'Sistem Kaydı' : `${role} Hesabı`;
}

export default function AdministrativeAnnouncements() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAnnouncements({ includeAll: true });
      setAnnouncements(
        payload
          .filter((item) => !String(item.detail || '').startsWith('LIVE_LESSON'))
          .sort((a, b) => `${b.createdAtUtc || b.createdAt || b.dateLabel}`.localeCompare(`${a.createdAtUtc || a.createdAt || a.dateLabel}`)),
      );
    } catch (err) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const stats = useMemo(() => ({
    total: announcements.length,
    targeted: announcements.filter((item) => (item.recipientCount || 0) > 0).length,
    teachers: announcements.filter((item) => String(item.createdByRole || '').toLowerCase().includes('teacher')).length,
  }), [announcements]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <section className="rounded-[32px] border border-border p-7 text-white shadow-xl" style={{ background: 'linear-gradient(135deg, var(--brand-p-900, #111827) 0%, var(--brand-p-800, #1d4ed8) 55%, var(--brand-p-700, #06b6d4) 100%)' }}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge className="bg-white/12 text-white hover:bg-white/12">Yönetici Duyuru Denetimi</Badge>
            <div>
              <h1 className="text-3xl font-bold font-heading">Kurumdaki tüm duyurular tek akışta</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/75">
                Hangi rolün hangi duyuruyu oluşturduğunu, hangi sınıfa ve hangi kişilere gittiğini tek ekranda incele. Bu panel öğretmen, idari birim ve diğer tüm yayınları birlikte gösterir.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Toplam Duyuru', value: stats.total, icon: BellRing },
              { label: 'Seçili Kişiye Giden', value: stats.targeted, icon: Users },
              { label: 'Öğretmen Kaynaklı', value: stats.teachers, icon: ShieldCheck },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <item.icon className="h-5 w-5 text-white/85" />
                <p className="mt-3 text-2xl font-bold">{item.value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/65">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="Duyuru kayıtları alınamadı" message={error} onRetry={loadAnnouncements} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {announcements.map((item) => (
          <Card key={item.id || item.title} className="overflow-hidden border-border shadow-sm">
            <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #334155) 100%)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-white/12 text-white hover:bg-white/12">{item.audience || 'Genel'}</Badge>
                    {item.targetClassName ? <Badge className="bg-white/12 text-white hover:bg-white/12">{item.targetClassName}</Badge> : null}
                    {item.targetRecipientType ? <Badge className="bg-white/12 text-white hover:bg-white/12">{item.targetRecipientType}</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold">{item.title}</h3>
                </div>
                <Megaphone className="h-6 w-6 text-white/70" />
              </div>
            </div>
            <CardContent className="space-y-5 p-6">
              <p className="text-sm leading-7 text-muted-foreground">{item.detail}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Yayınlayan</p>
                  <p className="mt-2 font-semibold text-foreground">{publisherLabel(item)}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel(item.createdByRole)}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Kime Gitti</p>
                  <p className="mt-2 font-semibold text-foreground">{item.targetRecipientType || item.audience}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Seçili Kişi</p>
                  <p className="mt-2 font-semibold text-foreground">{item.recipientCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tarih</p>
                  <p className="mt-2 font-semibold text-foreground">{item.dateLabel || item.date || 'Bugün'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(item.recipientLabels || []).slice(0, 4).map((label) => (
                    <Badge key={label} variant="outline">{label}</Badge>
                  ))}
                  {(item.recipientLabels || []).length > 4 ? <Badge variant="outline">+{item.recipientLabels.length - 4} kişi daha</Badge> : null}
                </div>
                <Button variant="outline" onClick={() => setSelectedAnnouncement(item)}>
                  <Eye className="mr-2 h-4 w-4" />
                  İncele
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-3xl overflow-hidden p-0">
          {selectedAnnouncement ? (
            <div>
              <div className="px-8 py-8 text-white" style={{ background: 'linear-gradient(135deg, var(--brand-p-900, #111827) 0%, var(--brand-p-800, #0f766e) 55%, var(--brand-p-700, #14b8a6) 100%)' }}>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedAnnouncement.audience}</Badge>
                  {selectedAnnouncement.targetClassName ? <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedAnnouncement.targetClassName}</Badge> : null}
                  {selectedAnnouncement.targetRecipientType ? <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedAnnouncement.targetRecipientType}</Badge> : null}
                </div>
                <DialogHeader className="mt-4 text-left">
                  <DialogTitle className="text-3xl font-bold text-white">{selectedAnnouncement.title}</DialogTitle>
                  <DialogDescription className="text-white/75">
                    {roleLabel(selectedAnnouncement.createdByRole)} • {publisherLabel(selectedAnnouncement)} • {selectedAnnouncement.dateLabel || selectedAnnouncement.date}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-6 px-8 py-7">
                <div className="rounded-[28px] bg-muted/50 p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Duyuru içeriği</p>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">{selectedAnnouncement.detail}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-border bg-card p-5">
                    <p className="text-sm font-semibold text-foreground">Yayınlayan Hesap</p>
                    <p className="mt-3 text-sm text-muted-foreground">{selectedAnnouncement.createdByUsername || '-'}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-card p-5">
                    <p className="text-sm font-semibold text-foreground">Seçili Kişi Sayısı</p>
                    <p className="mt-3 text-sm text-muted-foreground">{selectedAnnouncement.recipientCount || 0}</p>
                  </div>
                  <div className="rounded-[24px] border border-border bg-card p-5">
                    <p className="text-sm font-semibold text-foreground">Hedef Kanal</p>
                    <p className="mt-3 text-sm text-muted-foreground">{selectedAnnouncement.targetRecipientType || selectedAnnouncement.audience}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gönderilen kişiler</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedAnnouncement.recipientLabels || []).map((label) => (
                      <Badge key={label} variant="outline" className="px-3 py-1">
                        <UserRound className="mr-2 h-3.5 w-3.5" />
                        {label}
                      </Badge>
                    ))}
                    {!selectedAnnouncement.recipientLabels?.length ? (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
                        Bu duyuru genel hedef kitleye açık yayınlanmış.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
