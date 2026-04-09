import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  HelpCircle,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  Plus,
  UserRound,
  ArrowRight,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Film,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { useApp } from '../context/AppContext';
import { desktopApiBaseUrl } from '../lib/auth';
import { createQuestionThread, fetchQuestionThreads, fetchStaff, replyQuestionThread, uploadFile } from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

function attachmentSummaryLabel(attachment) {
  if (attachment.fileType === 'image') return 'Görsel eklendi';
  if (attachment.fileType === 'pdf') return 'PDF eklendi';
  if (attachment.fileType === 'video') return 'Video eklendi';
  return 'Ek dosya eklendi';
}

function attachmentTag(attachment) {
  if (attachment.fileType === 'image') return 'IMG';
  if (attachment.fileType === 'pdf') return 'PDF';
  if (attachment.fileType === 'video') return 'VID';
  return 'DOS';
}

function resolveFileType(fileName = '', mimeType = '') {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((ext) => lower.endsWith(ext))) {
    return 'image';
  }
  if (mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm'].some((ext) => lower.endsWith(ext))) {
    return 'video';
  }
  if (lower.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'file';
}

function NewQuestionDialog({
  open,
  onOpenChange,
  teachers,
  onCreated,
  onUploadAttachment,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subject: '',
    teacherName: '',
    questionText: '',
  });
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleAttachmentPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setUploadingAttachment(true);
      const uploaded = await onUploadAttachment(file);
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      toast({
        title: 'Ek yüklenemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.subject || !form.teacherName || !form.questionText) {
      toast({
        title: 'Eksik bilgi',
        description: 'Başlık, ders, öğretmen ve soru metni zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createQuestionThread({
        ...form,
        attachments,
      });
      onCreated(created);
      onOpenChange(false);
      setForm({
        title: '',
        subject: '',
        teacherName: '',
        questionText: '',
      });
      setAttachments([]);
    } catch (err) {
      toast({
        title: 'Soru gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni Soru Oluştur</DialogTitle>
          <DialogDescription>Öğretmene yönlendirilecek soru kaydı oluşturun.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ders</Label>
              <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Öğretmen</Label>
            <Select value={form.teacherName} onValueChange={(value) => setForm((prev) => ({ ...prev, teacherName: value }))}>
              <SelectTrigger><SelectValue placeholder="Öğretmen seçin" /></SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.fullName}>{teacher.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Soru</Label>
            <Textarea value={form.questionText} onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))} className="min-h-[160px]" />
          </div>
          <div className="rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:from-slate-950/40 dark:to-slate-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                <Paperclip className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Label className="text-sm font-semibold">Ekler</Label>
                <p className="mt-1 text-sm text-muted-foreground">Resim, PDF veya video yükleyerek öğretmenin sorunu daha net görmesini sağlayabilirsin.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-muted dark:bg-slate-950">
                <Paperclip className="h-4 w-4" />
                Resim / PDF / Video
                <input type="file" accept="image/*,application/pdf,video/*" className="hidden" onChange={handleAttachmentPick} />
              </label>
            </div>
            {uploadingAttachment ? <p className="mt-3 text-sm text-muted-foreground">Ek yükleniyor...</p> : null}
            {attachments.length > 0 ? (
              <div className="mt-4 space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.fileName}-${index}`} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-sm dark:bg-slate-950">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      attachment.fileType === 'image'
                        ? 'bg-sky-500/10 text-sky-500'
                        : attachment.fileType === 'pdf'
                          ? 'bg-rose-500/10 text-rose-500'
                          : attachment.fileType === 'video'
                            ? 'bg-violet-500/10 text-violet-500'
                            : 'bg-brand-primary/10 text-brand-primary'
                    }`}>
                      {attachment.fileType === 'image' ? <ImageIcon className="h-4 w-4" /> : null}
                      {attachment.fileType === 'pdf' ? <FileText className="h-4 w-4" /> : null}
                      {attachment.fileType === 'video' ? <Film className="h-4 w-4" /> : null}
                      {!['image', 'pdf', 'video'].includes(attachment.fileType) ? <Paperclip className="h-4 w-4" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{attachmentSummaryLabel(attachment)}</div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{attachmentTag(attachment)}</span>
                        Hazır
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Gönderiliyor...' : 'Soruyu Gönder'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Questions() {
  const { user } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingReplyAttachment, setUploadingReplyAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  const isTeacher = String(user?.role || '').toLowerCase() === 'teacher';
  const normalizedUserName = String(user?.name || '').trim().toLowerCase();

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [threadList, teacherList] = await Promise.all([
        fetchQuestionThreads(),
        fetchStaff('Teacher').catch(() => []),
      ]);
      setThreads(threadList);
      setTeachers(teacherList);
      setSelectedThread((prev) => prev || threadList[0] || null);
    } catch (err) {
      setError(err.message || 'Soru kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    setReplyText('');
    setReplyAttachments([]);
  }, [selectedThread?.id]);

  const visibleThreads = useMemo(() => threads.filter((thread) => {
    const studentName = String(thread.studentName || '').trim().toLowerCase();
    const teacherName = String(thread.teacherName || '').trim().toLowerCase();
    if (isStudent) return studentName === normalizedUserName;
    if (isTeacher) return teacherName === normalizedUserName;
    return true;
  }), [threads, isStudent, isTeacher, normalizedUserName]);

  const filteredQuestions = useMemo(() => {
    return visibleThreads.filter((thread) => {
      const matchesSearch = `${thread.title} ${thread.subject} ${thread.studentName} ${thread.teacherName}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || thread.status?.toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    });
  }, [visibleThreads, search, filter]);

  const pendingCount = useMemo(() => visibleThreads.filter((item) => item.status?.toLowerCase() !== 'answered').length, [visibleThreads]);
  const answeredCount = useMemo(() => visibleThreads.filter((item) => item.status?.toLowerCase() === 'answered').length, [visibleThreads]);

  const handleSendReply = async () => {
    if ((!replyText.trim() && replyAttachments.length === 0) || !selectedThread) return;

    try {
      const updated = await replyQuestionThread(selectedThread.id, {
        messageText: replyText.trim() || (replyAttachments.length > 0 ? 'Ek paylaşıldı.' : ''),
        attachments: replyAttachments,
      });
      setThreads((prev) => prev.map((thread) => (thread.id === updated.id ? updated : thread)));
      setSelectedThread(updated);
      setReplyText('');
      setReplyAttachments([]);
      toast({
        title: 'Yanıt gönderildi',
        description: `${updated.studentName} için soru thread’i güncellendi.`,
      });
    } catch (err) {
      toast({
        title: 'Yanıt gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const resolveAttachmentUrl = useCallback((value) => {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `${desktopApiBaseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
  }, []);

  const handleUploadAttachment = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await uploadFile(formData, 'question-threads');
    return {
      fileName: uploaded.originalFileName || uploaded.fileName || file.name,
      fileUrl: uploaded.fileUrl || uploaded.fileName || '',
      fileType: uploaded.fileType || resolveFileType(file.name, file.type),
    };
  }, []);

  const handleReplyAttachmentPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setUploadingReplyAttachment(true);
      const uploaded = await handleUploadAttachment(file);
      setReplyAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      toast({
        title: 'Ek yüklenemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setUploadingReplyAttachment(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="questions-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sorular</h1>
          <p className="text-muted-foreground mt-1">Soru thread ve yanıt akışı</p>
        </div>
        {isStudent ? (
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Soru
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner title="Sorular alınamadı" message={error} onRetry={loadThreads} /> : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-brand-accent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10"><Clock className="h-5 w-5 text-brand-accent" /></div>
            <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-muted-foreground">Bekleyen</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
            <div><p className="text-2xl font-bold">{answeredCount}</p><p className="text-xs text-muted-foreground">Yanıtlanan</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30"><UserRound className="h-5 w-5 text-sky-600 dark:text-sky-400" /></div>
            <div><p className="text-2xl font-bold">{visibleThreads.length}</p><p className="text-xs text-muted-foreground">Bana Ait Thread</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Gelen Kutusu</CardTitle>
                <div className="flex gap-1">
                  <Button variant={filter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('all')} className={filter === 'all' ? 'bg-brand-primary' : ''}>Tümü</Button>
                  <Button variant={filter === 'pending' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('pending')} className={filter === 'pending' ? 'bg-brand-accent' : ''}>Bekleyen</Button>
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                <div className="p-3 space-y-2">
                  {filteredQuestions.map((thread) => (
                    <motion.div
                      key={thread.id}
                      variants={itemVariants}
                      whileHover={{ x: 4 }}
                      onClick={() => setSelectedThread(thread)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedThread?.id === thread.id ? 'bg-brand-primary/10 border border-brand-primary/30' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-brand-primary text-white text-xs">
                            {thread.studentName.split(' ').map((part) => part[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{thread.studentName}</p>
                            {thread.status?.toLowerCase() !== 'answered' ? <Badge className="bg-brand-accent text-xs">Yeni</Badge> : null}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">{thread.title}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{thread.subject}</Badge>
                            <Badge variant="outline" className="text-xs">{thread.teacherName}</Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedThread ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-brand-primary text-white">
                        {selectedThread.studentName.split(' ').map((part) => part[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedThread.studentName}</p>
                      <p className="text-sm text-muted-foreground">{selectedThread.subject} • {selectedThread.teacherName}</p>
                    </div>
                  </div>
                  <Badge className={selectedThread.status?.toLowerCase() === 'answered' ? 'bg-green-500' : 'bg-brand-accent'}>
                    {selectedThread.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-6 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Öğrenci</p>
                        <p className="mt-1 font-semibold">{selectedThread.studentName}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Öğretmen</p>
                        <p className="mt-1 font-semibold">{selectedThread.teacherName}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Yanıt Sayısı</p>
                        <p className="mt-1 font-semibold">{selectedThread.replies?.length || 0}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">{selectedThread.title}</span>
                    </div>
                    <p>{selectedThread.questionText}</p>
                    {Array.isArray(selectedThread.attachments) && selectedThread.attachments.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedThread.attachments.map((attachment, index) => (
                          <a
                            key={`${selectedThread.id}-attachment-${index}`}
                            href={resolveAttachmentUrl(attachment.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                          >
                            {attachment.fileType === 'image' ? <ImageIcon className="h-3.5 w-3.5 text-sky-500" /> : null}
                            {attachment.fileType === 'pdf' ? <FileText className="h-3.5 w-3.5 text-rose-500" /> : null}
                            {attachment.fileType === 'video' ? <Film className="h-3.5 w-3.5 text-violet-500" /> : null}
                            {!['image', 'pdf', 'video'].includes(attachment.fileType) ? <Paperclip className="h-3.5 w-3.5 text-brand-primary" /> : null}
                            <span className="max-w-[220px] truncate">{attachment.fileName}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(selectedThread.createdAt).toLocaleString('tr-TR')}</p>
                  </div>

                  <div className="space-y-3">
                    {(selectedThread.replies || []).map((reply, index) => (
                      <div key={`${selectedThread.id}-reply-${index}`} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{reply.senderName}</p>
                          <Badge variant="outline">{reply.senderRole}</Badge>
                        </div>
                        <p>{reply.messageText}</p>
                        {Array.isArray(reply.attachments) && reply.attachments.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {reply.attachments.map((attachment, attachmentIndex) => (
                              <a
                                key={`${selectedThread.id}-reply-${index}-attachment-${attachmentIndex}`}
                                href={resolveAttachmentUrl(attachment.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted"
                              >
                                {attachment.fileType === 'image' ? <ImageIcon className="h-3.5 w-3.5 text-sky-500" /> : null}
                                {attachment.fileType === 'pdf' ? <FileText className="h-3.5 w-3.5 text-rose-500" /> : null}
                                {attachment.fileType === 'video' ? <Film className="h-3.5 w-3.5 text-violet-500" /> : null}
                                {!['image', 'pdf', 'video'].includes(attachment.fileType) ? <Paperclip className="h-3.5 w-3.5 text-brand-primary" /> : null}
                                <span className="max-w-[220px] truncate">{attachment.fileName}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground mt-2">{new Date(reply.createdAt).toLocaleString('tr-TR')}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {!isStudent ? (
                  <div className="mt-4 pt-4 border-t">
                    <Textarea placeholder="Yanıtınızı yazın..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="min-h-[120px]" />
                    <div className="mt-4 rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:from-slate-950/40 dark:to-slate-900/40">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                          <Paperclip className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">Yanıt Ekleri</p>
                          <p className="mt-1 text-sm text-muted-foreground">Çözüm görseli, PDF ya da video ekleyerek açıklamayı güçlendirebilirsin.</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-muted dark:bg-slate-950">
                          <Paperclip className="h-4 w-4" />
                          Resim / PDF / Video
                          <input type="file" accept="image/*,application/pdf,video/*" className="hidden" onChange={handleReplyAttachmentPick} />
                        </label>
                        {uploadingReplyAttachment ? <span className="text-sm text-muted-foreground">Ek yükleniyor...</span> : null}
                      </div>
                    </div>
                    {replyAttachments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {replyAttachments.map((attachment, index) => (
                          <div key={`${attachment.fileName}-${index}`} className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-sm dark:bg-slate-950">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                              attachment.fileType === 'image'
                                ? 'bg-sky-500/10 text-sky-500'
                                : attachment.fileType === 'pdf'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : attachment.fileType === 'video'
                                    ? 'bg-violet-500/10 text-violet-500'
                                    : 'bg-brand-primary/10 text-brand-primary'
                            }`}>
                              {attachment.fileType === 'image' ? <ImageIcon className="h-4 w-4" /> : null}
                              {attachment.fileType === 'pdf' ? <FileText className="h-4 w-4" /> : null}
                              {attachment.fileType === 'video' ? <Film className="h-4 w-4" /> : null}
                              {!['image', 'pdf', 'video'].includes(attachment.fileType) ? <Paperclip className="h-4 w-4" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
                              <div className="text-xs text-muted-foreground">
                                {attachment.fileType === 'image' ? 'Görsel çözüm' : attachment.fileType === 'pdf' ? 'PDF çözüm' : attachment.fileType === 'video' ? 'Video çözüm' : 'Ek dosya'}
                              </div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setReplyAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap justify-between gap-3">
                      <Button variant="outline" onClick={() => navigate('/chat')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Mesaja Geç
                      </Button>
                      <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSendReply} disabled={!replyText.trim() && replyAttachments.length === 0}>
                        <Send className="h-4 w-4 mr-2" />
                        Yanıtla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button variant="outline" onClick={() => navigate('/chat')}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Mesajlara Git
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Soru Seçin</h3>
                <p className="text-muted-foreground">Detayları görmek için sol listeden bir soru seçin.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <NewQuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teachers={teachers}
        onUploadAttachment={handleUploadAttachment}
        onCreated={(created) => {
          setThreads((prev) => [created, ...prev]);
          setSelectedThread(created);
          toast({
            title: 'Soru oluşturuldu',
            description: `${created.teacherName} öğretmenine soru gönderildi.`,
          });
        }}
      />
    </motion.div>
  );
}
