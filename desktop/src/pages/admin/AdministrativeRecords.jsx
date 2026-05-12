import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban, Search, Users, BriefcaseBusiness, Eye, Download, Mail, Phone, School, Sparkles, Building2, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchStudents, fetchStaff } from '../../lib/api/modules';

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function groupParents(students) {
  const map = new Map();
  students.forEach((student) => {
    if (!student.parentName) return;
    const key = `${normalizeText(student.parentName)}|${normalizeText(student.parentEmail)}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        fullName: student.parentName,
        parentName: student.parentName,
        parentEmail: student.parentEmail,
        phone: student.parentPhone,
        childNames: [],
        type: 'Veli',
      });
    }
    map.get(key).childNames.push(student.fullName);
  });
  return Array.from(map.values());
}

function buildRecordSummary(record) {
  const payload = record.payload || {};
  const rows = [
    ['Kayıt Türü', record.type],
    ['Ad Soyad', record.title],
    ['Özet', record.detail],
    ['Kimlik', payload.id || '-'],
    ['Kullanıcı', payload.username || '-'],
    ['Rol', payload.role || record.type],
    ['Sınıf / Birim', payload.className || payload.departmentOrBranch || payload.campus || '-'],
    ['Program', payload.programType || '-'],
    ['E-posta', payload.email || payload.parentEmail || '-'],
    ['Telefon', payload.phone || payload.parentPhone || '-'],
    ['Veli', payload.parentName || '-'],
  ];

  return [
    'CourseIntellect İdari Kayıt Özeti',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Oluşturulma Tarihi: ' + new Date().toLocaleString('tr-TR'),
  ].join('\n');
}

function downloadRecord(name, record) {
  const blob = new Blob([buildRecordSummary(record)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdministrativeRecords() {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentItems, staffItems] = await Promise.all([fetchStudents().catch(() => []), fetchStaff().catch(() => [])]);
      setStudents(studentItems);
      setStaff(staffItems);
    } catch (err) {
      setError(err.message || 'İdari kayıtlar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const records = useMemo(() => {
    const parents = groupParents(students);
    return [
      ...students.map((item) => ({
      id: `student-${item.id}`,
      title: item.fullName,
      detail: `${item.className || 'Sınıf yok'} • ${item.programType || 'Program yok'}`,
      type: 'Öğrenci',
      payload: item,
      })),
      ...parents.map((item) => ({
        id: `parent-${item.id}`,
        title: item.fullName,
        detail: `${item.childNames.join(', ')} • ${item.parentEmail || 'E-posta yok'}`,
        type: 'Veli',
        payload: item,
      })),
      ...staff.map((item) => ({
        id: `staff-${item.id}`,
        title: item.fullName,
        detail: `${item.role || 'Rol yok'} • ${item.departmentOrBranch || item.campus || 'Birim yok'}`,
        type: 'Personel',
        payload: item,
      })),
    ];
  }, [students, staff]);

  const filteredRecords = useMemo(() => records.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase())), [records, search]);
  const selectedPayload = selectedRecord?.payload || null;

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="administrative-records-page">
      <div className="rounded-[28px] border border-border p-7 text-white shadow-xl" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(14,165,233,0.16)), transparent 36%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #12324a) 55%, var(--brand-p-700, #1d4d63) 100%)' }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white">İdari Operasyon</Badge>
            <h1 className="mt-4 text-3xl font-bold font-heading">İdari Kayıtlar</h1>
            <p className="mt-2 text-sm text-white/80">
              Öğrenci, veli ve personel kayıtlarını daha okunur kartlar, sade detay görünümü ve gerçek dosya çıktısıyla yönetin.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [students.length, 'Öğrenci'],
              [groupParents(students).length, 'Veli'],
              [staff.length, 'Personel'],
              [records.length, 'Toplam'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {error ? <ErrorBanner title="İdari kayıtlar alınamadı" message={error} onRetry={loadRecords} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [students.length, 'Öğrenci Kayıtları', Users],
          [groupParents(students).length, 'Veli Kayıtları', Users],
          [staff.length, 'Personel Kayıtları', BriefcaseBusiness],
          [records.length, 'Toplam Dosya', FolderKanban],
        ].map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-brand-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Ad, sınıf, rol veya birim ara..." />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {filteredRecords.slice(0, 20).map((item) => (
          <Card key={item.id} className="overflow-hidden border-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="p-0">
              <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-brand-primary p-3 text-white shadow">
                    {item.type === 'Öğrenci' ? <School className="h-5 w-5" /> : item.type === 'Personel' ? <BriefcaseBusiness className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <Badge className="bg-muted text-muted-foreground">{item.type}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-3 py-1">Kayıt aktif</span>
                      <span className="rounded-full bg-muted px-3 py-1">{item.payload.username || item.payload.email || item.payload.parentEmail || 'Hesap bilgisi yok'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedRecord(item)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Detay
                  </Button>
                  <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => downloadRecord(`${item.title.replaceAll(' ', '_')}_kayit_ozeti.txt`, item)}>
                    <Download className="mr-2 h-4 w-4" />
                    İndir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecord?.title || 'Kayıt detayı'}</DialogTitle>
            <DialogDescription>İdari kayıt için detay görünümü.</DialogDescription>
          </DialogHeader>
          {selectedRecord && selectedPayload ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border p-6 text-white" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(251,191,36,0.18)), transparent 34%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #12324a) 45%, var(--brand-p-700, #115e59) 100%)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Badge className="border-white/10 bg-white/15 text-white">{selectedRecord.type}</Badge>
                    <h3 className="mt-4 text-2xl font-semibold">{selectedRecord.title}</h3>
                    <p className="mt-2 text-sm text-white/80">{selectedRecord.detail}</p>
                  </div>
                  <div className="grid gap-2 text-right">
                    <div className="rounded-2xl bg-white/10 p-4">
                      {selectedRecord.type === 'Öğrenci' ? <School className="h-6 w-6" /> : selectedRecord.type === 'Personel' ? <BriefcaseBusiness className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-white/65">Detay Dosyası</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Kimlik</p>
                    <p className="mt-1 font-semibold">{selectedPayload.id || '-'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Durum</p>
                    <p className="mt-1 font-semibold">Aktif Kayıt</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Kaynak</p>
                    <p className="mt-1 font-semibold">{selectedRecord.type}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-primary" />Temel Bilgiler</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Ad Soyad</span><span className="font-medium">{selectedPayload.fullName || '-'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Rol / Tür</span><span className="font-medium">{selectedPayload.role || selectedRecord.type}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Sınıf / Birim</span><span className="font-medium">{selectedPayload.className || selectedPayload.departmentOrBranch || selectedPayload.campus || '-'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Program</span><span className="font-medium">{selectedPayload.programType || '-'}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-primary" />İletişim ve Erişim</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selectedPayload.email || selectedPayload.parentEmail || 'E-posta yok'}</span></div>
                    <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedPayload.phone || selectedPayload.parentPhone || 'Telefon yok'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Veli</span><span className="font-medium">{selectedPayload.parentName || '-'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Kullanıcı</span><span className="font-medium">{selectedPayload.username || '-'}</span></div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Durum', 'Aktif ve doğrulanmış kayıt', ShieldCheck],
                  ['Kayıt Özeti', selectedRecord.detail, FolderKanban],
                  ['İşlem', 'Detay özeti indirilebilir', Download],
                ].map(([title, value, Icon]) => (
                  <Card key={title}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">{title}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                        </div>
                        <Icon className="h-4 w-4 text-brand-primary" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecord(null)}>Kapat</Button>
            {selectedRecord ? (
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => downloadRecord(`${selectedRecord.title.replaceAll(' ', '_')}_kayit_ozeti.txt`, selectedRecord)}>
                <Download className="mr-2 h-4 w-4" />
                Özeti İndir
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
