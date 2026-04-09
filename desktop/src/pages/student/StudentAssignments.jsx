import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import {
  FileText, Clock, CheckCircle, AlertCircle, Upload, Calendar, Eye, Download,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { getDesktopApiBaseUrl } from '../../lib/appEnv';
import { fetchHomework, submitHomework, uploadFile } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

function decodeText(value = '') {
  return String(value || '')
    .replaceAll('&#xFC;', 'ü')
    .replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç')
    .replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı')
    .replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö')
    .replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş')
    .replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ')
    .replaceAll('&#x11E;', 'Ğ')
    .replaceAll('&uuml;', 'ü')
    .replaceAll('&Uuml;', 'Ü')
    .replaceAll('&ccedil;', 'ç')
    .replaceAll('&Ccedil;', 'Ç')
    .replaceAll('&ouml;', 'ö')
    .replaceAll('&Ouml;', 'Ö')
    .replaceAll('&scedil;', 'ş')
    .replaceAll('&Scedil;', 'Ş')
    .replaceAll('&nbsp;', ' ');
}

export default function StudentAssignments() {
  const { toast } = useToast();
  const { user } = useApp();
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [detailAssignment, setDetailAssignment] = useState(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const studentName = user?.name || '';

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchHomework();
      setAssignments(payload);
    } catch (err) {
      setError(err.message || 'Ödevler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const enrichedAssignments = useMemo(() => assignments.map((item) => {
    const ownSubmission = (item.submissions || []).find((submission) => normalize(submission.studentName) === normalize(studentName));
    const dueDate = new Date(item.deadline);
    const now = new Date();
    const overdue = dueDate < now && !ownSubmission;
    const status = ownSubmission ? (ownSubmission.grade != null ? 'graded' : 'submitted') : (overdue ? 'overdue' : 'pending');
    return {
      ...item,
      ownSubmission,
      status,
    };
  }), [assignments, studentName]);

  const stats = {
    pending: enrichedAssignments.filter((item) => item.status === 'pending').length,
    overdue: enrichedAssignments.filter((item) => item.status === 'overdue').length,
    submitted: enrichedAssignments.filter((item) => ['submitted', 'graded'].includes(item.status)).length,
  };

  const filteredAssignments = enrichedAssignments.filter((item) => {
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'overdue') return item.status === 'overdue';
    if (activeTab === 'completed') return ['submitted', 'graded'].includes(item.status);
    return true;
  });

  const getStatusBadge = (status) => {
    const config = {
      pending: { class: 'bg-yellow-100 text-yellow-700', label: 'Bekliyor' },
      overdue: { class: 'bg-red-100 text-red-700', label: 'Gecikmiş' },
      submitted: { class: 'bg-blue-100 text-blue-700', label: 'Teslim Edildi' },
      graded: { class: 'bg-green-100 text-green-700', label: 'Notlandırıldı' },
    };
    return <Badge className={config[status]?.class}>{config[status]?.label}</Badge>;
  };

  const normalizeAttachment = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes('::')) {
      const [name, url] = raw.split('::');
      return {
        name: decodeText(name?.trim() || 'Dosya'),
        url: url?.trim() || '',
      };
    }
    return {
      name: decodeText(raw.split('/').pop() || raw),
      url: raw,
    };
  };

  const resolveAssetUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const baseUrl = getDesktopApiBaseUrl();
    if (raw.startsWith('/')) return `${baseUrl}${raw}`;
    return `${baseUrl}/${raw}`;
  };

  const openAttachment = (attachment) => {
    const url = resolveAssetUrl(attachment?.url);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadAttachment = async (attachment) => {
    const url = resolveAssetUrl(attachment?.url);
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = attachment?.name || 'dosya';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleSubmitHomework = async () => {
    if (!selectedAssignment) return;
    try {
      setSubmitting(true);
      const uploadedFiles = [];
      for (const file of submissionFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await uploadFile(formData, 'homework-submissions');
        const fileName = uploaded.fileName || file.name;
        const fileUrl = uploaded.fileUrl || uploaded.fileName || file.name;
        uploadedFiles.push(`${fileName}::${fileUrl}`);
      }
      const updated = await submitHomework(selectedAssignment.id, {
        studentName,
        note: submissionNote.trim(),
        files: uploadedFiles,
      });
      setAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAssignment(null);
      setSubmissionNote('');
      setSubmissionFiles([]);
      toast({
        title: 'Ödev teslim edildi',
        description: `${updated.title} backend üzerinde güncellendi.`,
      });
    } catch (err) {
      toast({
        title: 'Teslim başarısız',
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      setSubmitting(false);
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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="student-assignments-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Ödevlerim</h1>
        <p className="text-muted-foreground mt-1">Ödevlerini backend verisi üzerinden takip et ve teslim et</p>
      </div>

      {error ? <ErrorBanner title="Ödevler alınamadı" message={error} onRetry={loadAssignments} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [stats.pending, 'Bekleyen Ödev', Clock, 'text-yellow-600'],
          [stats.overdue, 'Gecikmiş', AlertCircle, 'text-red-600'],
          [stats.submitted, 'Teslim Edilen', CheckCircle, 'text-green-600'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="pending" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Bekleyen ({stats.pending})</TabsTrigger>
          <TabsTrigger value="overdue">Gecikmiş ({stats.overdue})</TabsTrigger>
          <TabsTrigger value="completed">Tamamlanan ({stats.submitted})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {filteredAssignments.map((assignment) => (
            <motion.div key={assignment.id} variants={itemVariants}>
              <Card className="hover:shadow-card-hover transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{decodeText(assignment.subject)}</Badge>
                      {getStatusBadge(assignment.status)}
                    </div>
                      <h3 className="font-semibold text-lg">{decodeText(assignment.title)}</h3>
                      <p className="text-muted-foreground mt-1">{decodeText(assignment.description)}</p>
                      <p className="text-sm text-muted-foreground mt-2">Öğretmen: {decodeText(assignment.teacher)}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Son Teslim: {assignment.deadline}
                        </span>
                        {assignment.ownSubmission?.grade != null ? (
                          <span className="font-medium text-green-600">Not: {assignment.ownSubmission.grade}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex gap-2">
                        {['pending', 'overdue'].includes(assignment.status) ? (
                          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedAssignment(assignment)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Teslim Et
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={() => setDetailAssignment(assignment)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Görüntüle
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decodeText(selectedAssignment?.title)} ödevini teslim et</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Teslim notu veya dosya açıklaması"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
            />
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.avi"
                onChange={(e) => setSubmissionFiles(Array.from(e.target.files || []))}
              />
              <div className="flex flex-wrap gap-2">
                {submissionFiles.length > 0 ? submissionFiles.map((file) => (
                  <Badge key={`${file.name}-${file.size}`} variant="outline" className="gap-2 px-3 py-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{submissionFileTag(file)}</span>
                    {describeSubmissionFile(file)}
                  </Badge>
                )) : <span className="text-sm text-muted-foreground">PDF, video, resim ve belge ekleyebilirsiniz.</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAssignment(null)}>İptal</Button>
            <Button onClick={handleSubmitHomework} disabled={submitting}>
              {submitting ? 'Teslim ediliyor...' : 'Teslim Et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailAssignment} onOpenChange={() => setDetailAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödev Detayı</DialogTitle>
          </DialogHeader>
          {detailAssignment ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Başlık</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.title)}</p>
              </div>
              <div>
                <p className="font-medium">Açıklama</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.description)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Ders</p>
                  <p className="text-muted-foreground">{decodeText(detailAssignment.subject)}</p>
                </div>
                <div>
                  <p className="font-medium">Son Teslim</p>
                  <p className="text-muted-foreground">{detailAssignment.deadline}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">Teslim Notu</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.ownSubmission?.note || 'Henüz not eklenmemiş.')}</p>
              </div>
              <div>
                <p className="font-medium">Öğretmen Materyalleri</p>
                <div className="mt-2 space-y-2">
                  {(detailAssignment.materials || []).length > 0 ? detailAssignment.materials.map((item, index) => {
                    const attachment = normalizeAttachment(item);
                    if (!attachment) return null;
                    return (
                      <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">Öğretmen tarafından paylaşıldı</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openAttachment(attachment)}>Aç</Button>
                          <Button variant="outline" size="icon" onClick={() => downloadAttachment(attachment)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-muted-foreground">Öğretmen materyal yüklememiş.</p>}
                </div>
              </div>
              <div>
                <p className="font-medium">Teslim Dosyaları</p>
                <div className="mt-2 space-y-2">
                  {((detailAssignment.ownSubmission?.attachments || detailAssignment.ownSubmission?.files || [])).length > 0 ? (detailAssignment.ownSubmission?.attachments || detailAssignment.ownSubmission?.files || []).map((item, index) => {
                    const attachment = normalizeAttachment(item);
                    if (!attachment) return null;
                    return (
                      <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">Yüklediğin dosya</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openAttachment(attachment)}>Aç</Button>
                          <Button variant="outline" size="icon" onClick={() => downloadAttachment(attachment)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-muted-foreground">Henüz teslim dosyası yüklenmemiş.</p>}
                </div>
              </div>
              {detailAssignment.ownSubmission?.grade != null ? (
                <div>
                  <p className="font-medium">Not</p>
                  <p className="text-green-600 font-semibold">{detailAssignment.ownSubmission.grade}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function describeSubmissionFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'Görsel hazır';
  if (name.endsWith('.pdf')) return 'PDF hazır';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'Video hazır';
  return 'Ek dosya hazır';
}

function submissionFileTag(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'IMG';
  if (name.endsWith('.pdf')) return 'PDF';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'VID';
  return 'DOS';
}
