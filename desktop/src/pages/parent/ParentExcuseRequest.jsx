import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Plus, Calendar, CheckCircle, Clock, XCircle, Upload, Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createExcuseRequest, fetchAttendance, fetchMyExcuseRequests, fetchStudents, uploadFile } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function ParentExcuseRequest() {
  const { user } = useApp();
  const { toast } = useToast();
  const [excuses, setExcuses] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [form, setForm] = useState({
    childName: '',
    date: new Date().toISOString().slice(0, 10),
    reason: '',
    type: 'health',
    notes: '',
    attachmentName: '',
    attachmentUrl: '',
    attachmentType: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [attendanceData, studentData, myExcuses] = await Promise.all([
        fetchAttendance().catch(() => []),
        fetchStudents().catch(() => []),
        fetchMyExcuseRequests().catch(() => []),
      ]);
      const att = Array.isArray(attendanceData) ? attendanceData : [];
      const absenceList = att.filter((a) => a.status === 'Absent' || a.status === 'Devamsiz');
      setAbsences(absenceList);

      const kids = Array.isArray(studentData) ? studentData : [];
      setChildren(kids);
      if (kids.length > 0 && !form.childName) {
        setForm((prev) => ({ ...prev, childName: kids[0]?.fullName || '' }));
      }

      const remoteExcuses = Array.isArray(myExcuses) ? myExcuses.map((item) => ({
        id: item.id,
        childName: item.childName,
        date: item.date,
        reason: item.reason,
        status: item.status || 'Beklemede',
        attachmentName: item.attachmentName || '',
      })) : [];
      setExcuses(remoteExcuses);
    } catch (err) {
      setError(err.message || 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [form.childName]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!form.childName || !form.date || !form.reason) {
      toast({ title: 'Lutfen zorunlu alanlari doldurun.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await createExcuseRequest({
        childName: form.childName,
        date: form.date,
        type: form.type,
        reason: form.reason,
        notes: form.notes,
        attachmentName: form.attachmentName,
        attachmentUrl: form.attachmentUrl,
        attachmentType: form.attachmentType,
      });
      setExcuses((prev) => [{
        id: created?.id || Date.now(),
        childName: created?.childName || form.childName,
        date: created?.date || form.date,
        reason: created?.reason || form.reason,
        status: created?.status || 'Beklemede',
        attachmentName: created?.attachmentName || form.attachmentName,
      }, ...prev]);
      toast({ title: 'Mazeret bildirimi gonderildi.' });
      setOpen(false);
      setForm({
        childName: form.childName,
        date: new Date().toISOString().slice(0, 10),
        reason: '',
        type: 'health',
        notes: '',
        attachmentName: '',
        attachmentUrl: '',
        attachmentType: '',
      });
    } catch (err) {
      toast({ title: err?.response?.data?.message || err?.message || 'Gonderilemedi.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const excuseTypes = [
    { value: 'health', label: 'Saglik' },
    { value: 'family', label: 'Aile' },
    { value: 'travel', label: 'Seyahat' },
    { value: 'other', label: 'Diger' },
  ];

  const attachmentLabel = useMemo(() => {
    if (!form.attachmentType) return '';
    switch (form.attachmentType) {
      case 'pdf': return 'PDF eklendi';
      case 'image': return 'Görsel eklendi';
      case 'video': return 'Video eklendi';
      default: return 'Belge eklendi';
    }
  }, [form.attachmentType]);

  const handleAttachmentPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAttachment(true);
      const data = new FormData();
      data.append('file', file);
      const uploaded = await uploadFile(data, 'excuse-documents');
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      const attachmentType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : extension === 'pdf'
            ? 'pdf'
            : 'document';
      setForm((prev) => ({
        ...prev,
        attachmentName: uploaded?.originalFileName || file.name,
        attachmentUrl: uploaded?.fileUrl || uploaded?.url || uploaded?.fileName || '',
        attachmentType,
      }));
      toast({ title: 'Ek dosya hazirlandi.' });
    } catch (err) {
      toast({ title: err.message || 'Ek dosya yuklenemedi.', variant: 'destructive' });
    } finally {
      setUploadingAttachment(false);
      event.target.value = '';
    }
  };

  function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('onay') || s.includes('approved')) return <Badge className="bg-green-100 text-green-700">Onaylandi</Badge>;
    if (s.includes('red') || s.includes('rejected')) return <Badge className="bg-red-100 text-red-700">Reddedildi</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700">Beklemede</Badge>;
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl text-white">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mazeret Bildirimi</h1>
            <p className="text-sm text-muted-foreground">Devamsizlik icin mazeret gonderin</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Yeni Mazeret</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mazeret Bildirimi Olustur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {children.length > 1 && (
                <div>
                  <Label>Ogrenci</Label>
                  <Select value={form.childName} onValueChange={(v) => setForm((p) => ({ ...p, childName: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {children.map((c) => (
                        <SelectItem key={c.id || c.fullName} value={c.fullName}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Devamsizlik Tarihi *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mazeret Turu</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {excuseTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aciklama *</Label>
                <Textarea
                  placeholder="Mazeret nedenini aciklayiniz..."
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <Label>Ek Notlar</Label>
                <Input
                  placeholder="Doktor raporu no, belge bilgisi vb."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Destekleyici Belge</Label>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600">
                      {attachmentLabel || 'PDF, görsel veya video ekleyebilirsiniz.'}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                      <Upload className="h-4 w-4" />
                      {uploadingAttachment ? 'Yükleniyor...' : 'Dosya Seç'}
                      <input type="file" accept=".pdf,image/*,video/*,.doc,.docx" className="hidden" onChange={handleAttachmentPick} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Iptal</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <Send className="h-4 w-4 mr-1" /> {saving ? 'Gonderiliyor...' : 'Gonder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{excuses.filter((e) => String(e.status).toLowerCase().includes('bekle')).length}</p>
              <p className="text-xs text-muted-foreground">Beklemede</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{excuses.filter((e) => String(e.status).toLowerCase().includes('onay')).length}</p>
              <p className="text-xs text-muted-foreground">Onaylanan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{absences.length}</p>
              <p className="text-xs text-muted-foreground">Toplam Devamsizlik</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* History */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Mazeret Gecmisi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ogrenci</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Neden</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Ek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Henuz mazeret bildirimi yapilmamis.
                    </TableCell>
                  </TableRow>
                ) : (
                  excuses.map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="font-medium">{ex.childName || '-'}</TableCell>
                      <TableCell>{ex.date ? new Date(ex.date).toLocaleDateString('tr-TR') : '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{ex.reason || '-'}</TableCell>
                      <TableCell>{statusBadge(ex.status)}</TableCell>
                      <TableCell>{ex.attachmentName || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
