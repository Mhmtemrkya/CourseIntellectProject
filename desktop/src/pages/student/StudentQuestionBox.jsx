import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, BellRing, Paperclip, Image as ImageIcon, FileText, Film, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { desktopApiBaseUrl } from '../../lib/auth';
import { createQuestionThread, fetchQuestionThreads, fetchStaff, uploadFile } from '../../lib/api/modules';

function resolveFileType(fileName = '', mimeType = '') {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((ext) => lower.endsWith(ext))) return 'image';
  if (mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm'].some((ext) => lower.endsWith(ext))) return 'video';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'file';
}

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

export default function StudentQuestionBox() {
  const { user } = useApp();
  const [threads, setThreads] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subject, setSubject] = useState('Matematik');
  const [teacher, setTeacher] = useState('');
  const [title, setTitle] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [threadPayload, teacherPayload] = await Promise.all([
        fetchQuestionThreads(),
        fetchStaff('Teacher').catch(() => []),
      ]);
      setThreads(threadPayload);
      setTeachers(teacherPayload);
      setTeacher((prev) => prev || teacherPayload[0]?.fullName || '');
    } catch (err) {
      setError(err.message || 'Soru kutusu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const myThreads = useMemo(() => threads.filter((item) => (item.studentName || '').toLowerCase() === (user?.name || '').toLowerCase()), [threads, user?.name]);

  const resolveAttachmentUrl = useCallback((value) => {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `${desktopApiBaseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
  }, []);

  const handleAttachmentPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setUploadingAttachment(true);
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await uploadFile(formData, 'question-threads');
      setAttachments((prev) => [
        ...prev,
        {
          fileName: uploaded.originalFileName || uploaded.fileName || file.name,
          fileUrl: uploaded.fileUrl || uploaded.fileName || '',
          fileType: uploaded.fileType || resolveFileType(file.name, file.type),
        },
      ]);
    } catch (err) {
      setError(err.message || 'Ek yüklenemedi.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !questionText.trim() || !teacher.trim()) return;
    try {
      setSubmitting(true);
      await createQuestionThread({
        title: title.trim(),
        subject,
        teacherName: teacher.trim(),
        studentName: user?.name || 'Ogrenci',
        questionText: questionText.trim(),
        attachments,
      });
      setTitle('');
      setQuestionText('');
      setAttachments([]);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-question-box-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Soru Sor</h1>
        <p className="text-muted-foreground mt-1">Öğretmenine soru gönder ve gelen yanıtları aynı ekrandan takip et.</p>
      </div>

      {error ? <ErrorBanner title="Soru kutusu alınamadı" message={error} onRetry={loadData} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Soru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Konu başlığı" />
            <Select value={teacher} onValueChange={setTeacher}>
              <SelectTrigger><SelectValue placeholder="Öğretmen seç" /></SelectTrigger>
              <SelectContent>
                {teachers.map((item) => (
                  <SelectItem key={item.id} value={item.fullName}>{item.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Matematik', 'Fizik', 'Kimya', 'Türkçe'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="min-h-[140px]" placeholder="Sorunu ayrıntılı yaz..." />
          <div className="rounded-3xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:from-slate-950/40 dark:to-slate-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                <Paperclip className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold">Soru Ekleri</h4>
                <p className="mt-1 text-sm text-muted-foreground">Resim, PDF veya video yükleyerek öğretmenin sorunu daha hızlı anlamasını sağlayabilirsin.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-muted dark:bg-slate-950">
                <Paperclip className="h-4 w-4" />
                Resim / PDF / Video
                <input type="file" accept="image/*,application/pdf,video/*" className="hidden" onChange={handleAttachmentPick} />
              </label>
            </div>
            {uploadingAttachment ? <p className="text-sm text-muted-foreground">Ek yükleniyor...</p> : null}
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
          <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !questionText.trim() || !teacher.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Gönderiliyor...' : 'Soruyu Gönder'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gönderilen Sorular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {myThreads.map((item) => {
            const lastReply = Array.isArray(item.replies) && item.replies.length > 0
              ? item.replies[item.replies.length - 1]
              : null;
            return (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{item.subject}</Badge>
                <Badge>{item.status}</Badge>
              </div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.questionText}</p>
              {Array.isArray(item.attachments) && item.attachments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.attachments.map((attachment, index) => (
                    <a
                      key={`${item.id}-attachment-${index}`}
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
              <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <BellRing className="h-4 w-4 text-brand-primary" />
                  Son yanıt
                </div>
                <p>{item.lastReplyPreview || 'Henüz öğretmen yanıtı yok.'}</p>
                {Array.isArray(lastReply?.attachments) && lastReply.attachments.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lastReply.attachments.map((attachment, index) => (
                      <a
                        key={`${item.id}-reply-attachment-${index}`}
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
              </div>
            </div>
          );})}
        </CardContent>
      </Card>
    </motion.div>
  );
}
