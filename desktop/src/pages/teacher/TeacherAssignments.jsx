import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Plus, Search, Calendar, CheckCircle, AlertCircle, Eye, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createHomework, deleteHomework, fetchHomework, fetchStudents, uploadFile } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fallbackClasses = [];
const defaultSubjects = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce', 'Tarih', 'Coğrafya'];

export default function TeacherAssignments() {
  const { toast } = useToast();
  const { user } = useApp();
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    className: '',
    subject: '',
    deadline: '',
    materialFiles: [],
  });

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [homework, students] = await Promise.all([
        fetchHomework(),
        fetchStudents().catch(() => []),
      ]);
      setAssignments(homework);
      setClasses([...new Set(students.map((item) => item.className).filter(Boolean))]);
    } catch (err) {
      setError(err.message || 'Ödevler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const classOptions = useMemo(() => {
    const merged = [
      ...classes,
      ...assignments.map((item) => item.className).filter(Boolean),
      ...(Array.isArray(user?.assignedClasses) ? user.assignedClasses : []),
    ];
    const unique = [...new Set(merged.filter(Boolean))];
    return unique.length > 0 ? unique : fallbackClasses;
  }, [assignments, classes, user?.assignedClasses]);

  const filteredAssignments = useMemo(() => assignments.filter((item) => (
    `${item.title} ${item.subject} ${item.className}`.toLowerCase().includes(searchQuery.toLowerCase())
  )), [assignments, searchQuery]);

  const subjectOptions = useMemo(() => {
    const merged = [
      ...defaultSubjects,
      ...assignments.map((item) => item.subject).filter(Boolean),
    ];
    return [...new Set(merged.filter(Boolean))];
  }, [assignments]);

  const stats = {
    total: assignments.length,
    active: assignments.filter((item) => (item.submitted || 0) < (item.total || 0)).length,
    pendingGrade: assignments.reduce((sum, item) => sum + Math.max(0, (item.submitted || 0) - ((item.submissions || []).length || 0)), 0),
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      const uploadedMaterials = [];
      for (const file of form.materialFiles) {
        const data = new FormData();
        data.append('file', file);
        const uploaded = await uploadFile(data, 'homework-materials');
        const fileName = uploaded.fileName || file.name;
        const fileUrl = uploaded.fileUrl || uploaded.fileName || file.name;
        uploadedMaterials.push(`${fileName}::${fileUrl}`);
      }
      const created = await createHomework({
        title: form.title.trim(),
        className: form.className,
        subject: form.subject.trim() || 'Genel',
        teacher: user?.name || 'Öğretmen',
        deadline: form.deadline,
        description: form.description.trim(),
        materials: uploadedMaterials,
      });
      setAssignments((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({
        title: '',
        description: '',
        className: '',
        subject: '',
        deadline: '',
        materialFiles: [],
      });
      toast({
        title: 'Ödev oluşturuldu',
        description: `${created.title} backend’e kaydedildi.`,
      });
    } catch (err) {
      toast({
        title: 'Ödev oluşturulamadı',
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteHomework(id);
      setAssignments((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: 'Ödev silindi',
        description: 'Kayıt backend üzerinden kaldırıldı.',
      });
    } catch (err) {
      toast({
        title: 'Ödev silinemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Ödevler yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teacher-assignments-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ödevler</h1>
          <p className="text-muted-foreground mt-1">Backend kayıtlı ödevleri yönetin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Ödev
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Ödev Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Ödev Başlığı</Label>
                <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Örn: Türev Alıştırmaları" />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Ödev hakkında açıklama..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select value={form.className} onValueChange={(value) => setForm((prev) => ({ ...prev, className: value }))}>
                    <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                    <SelectContent>
                      {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Son Tarih</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ders</Label>
                <Select value={form.subject} onValueChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}>
                  <SelectTrigger><SelectValue placeholder="Ders seçin" /></SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ek Materyaller</Label>
                <div className="space-y-3 rounded-xl border border-dashed p-4">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.avi"
                    onChange={(e) => setForm((prev) => ({ ...prev, materialFiles: Array.from(e.target.files || []) }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form.materialFiles.length > 0 ? form.materialFiles.map((file) => (
                      <Badge key={`${file.name}-${file.size}`} variant="outline" className="gap-2 px-3 py-1.5">
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{materialTag(file)}</span>
                        {describeSelectedMaterial(file)}
                      </Badge>
                    )) : <span className="text-sm text-muted-foreground">PDF, video, resim ve belge yükleyebilirsiniz.</span>}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreate} disabled={saving || !form.title || !form.className || !form.deadline}>
                {saving ? 'Kaydediliyor...' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <ErrorBanner title="Ödevler alınamadı" message={error} onRetry={loadAssignments} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [stats.total, 'Toplam Ödev', FileText, 'text-brand-primary'],
          [stats.active, 'Aktif', CheckCircle, 'text-green-600'],
          [stats.pendingGrade, 'Değerlendirme Bekleyen', AlertCircle, 'text-yellow-600'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ödev ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ödevlerim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const submissionRate = assignment.total ? Math.round(((assignment.submitted || 0) / assignment.total) * 100) : 0;
              return (
                <div key={assignment.id} className="p-4 rounded-xl border hover:border-brand-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-brand-primary/10">
                        <FileText className="h-6 w-6 text-brand-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{assignment.subject}</span>
                          <span>•</span>
                          <span>{assignment.className}</span>
                          <span>•</span>
                          <span><Calendar className="inline h-3 w-3 mr-1" />{assignment.deadline}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedAssignment(assignment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(assignment.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Teslim oranı</span>
                      <span>{assignment.submitted || 0}/{assignment.total || 0}</span>
                    </div>
                    <Progress value={submissionRate} className="h-2" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={Boolean(selectedAssignment)} onOpenChange={(open) => { if (!open) setSelectedAssignment(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.title}</DialogTitle>
            <DialogDescription>
              {selectedAssignment?.className} • {selectedAssignment?.subject} • Son tarih {selectedAssignment?.deadline}
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment ? (
            <div className="space-y-5 py-2">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Teslim</p>
                    <p className="mt-1 text-2xl font-bold">{selectedAssignment.submitted || 0}/{selectedAssignment.total || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Öğretmen</p>
                    <p className="mt-1 font-semibold">{selectedAssignment.teacher || user?.name || 'Öğretmen'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">İlerleme</p>
                    <p className="mt-1 text-2xl font-bold">
                      {selectedAssignment.total ? Math.round(((selectedAssignment.submitted || 0) / selectedAssignment.total) * 100) : 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  {selectedAssignment.description || 'Bu ödev için ayrıca girilmiş açıklama bulunmuyor.'}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ek Materyaller</Label>
                <div className="flex flex-wrap gap-2">
                  {(selectedAssignment.materials || []).length > 0 ? (
                    selectedAssignment.materials.map((material) => (
                      <Badge key={material} variant="outline">{material}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Ek materyal yüklenmemiş.</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAssignment(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function describeSelectedMaterial(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'Görsel eklendi';
  if (name.endsWith('.pdf')) return 'PDF eklendi';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'Video eklendi';
  return 'Ek materyal eklendi';
}

function materialTag(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'IMG';
  if (name.endsWith('.pdf')) return 'PDF';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'VID';
  return 'DOS';
}
