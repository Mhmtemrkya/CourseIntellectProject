import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Video, Plus, Search, Eye, Upload, FolderOpen, CheckCircle2, Play, Pause, Download, Maximize2, Rewind, FastForward, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createContent, deleteContent, fetchContents, fetchStudents, updateContent, updateContentStatus, uploadFile } from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fallbackClasses = [];

function contentTypeIcon(type) {
  return String(type).toLowerCase().includes('video') ? Video : FileText;
}

function buildCoverStyle(item) {
  const palette = {
    Matematik: 'from-sky-600 via-blue-600 to-indigo-700',
    Fizik: 'from-violet-600 via-fuchsia-600 to-pink-600',
    Kimya: 'from-emerald-500 via-teal-600 to-cyan-700',
    Biyoloji: 'from-lime-500 via-green-600 to-emerald-700',
    Turkce: 'from-orange-500 via-amber-500 to-yellow-600',
    Tarih: 'from-stone-500 via-orange-600 to-rose-700',
    Cografya: 'from-cyan-500 via-sky-600 to-blue-700',
    İngilizce: 'from-rose-500 via-pink-600 to-fuchsia-700',
  };
  const subject = Object.keys(palette).find((key) => String(item?.subject || '').toLowerCase().includes(key.toLowerCase()));
  return palette[subject || 'Matematik'];
}

function buildContentFileUrl(fileName) {
  if (!fileName) return null;
  return new URL(`/uploads/teacher-content/${encodeURIComponent(fileName)}`, desktopApiBaseUrl).toString();
}

function formatFileSizeLabel(size) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  const megaBytes = bytes / (1024 * 1024);
  if (megaBytes >= 1) {
    return `${megaBytes.toFixed(megaBytes >= 10 ? 0 : 1)} MB`;
  }

  const kiloBytes = bytes / 1024;
  return `${kiloBytes.toFixed(kiloBytes >= 10 ? 0 : 1)} KB`;
}

export default function TeacherContent() {
  const { toast } = useToast();
  const { user } = useApp();
  const [content, setContent] = useState([]);
  const [classes, setClasses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [editingContent, setEditingContent] = useState(false);
  const [playInlineVideo, setPlayInlineVideo] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    grade: '',
    fileType: 'PDF',
    fileName: '',
    size: '',
    playlistMode: 'single',
    playlistKey: '',
    playlistTitle: '',
    playlistOrder: '1',
  });

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [payload, students] = await Promise.all([
        fetchContents(false),
        fetchStudents().catch(() => []),
      ]);
      setContent(payload);
      setClasses([...new Set(students.map((item) => item.className).filter(Boolean))]);
    } catch (err) {
      setError(err.message || 'İçerikler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const classOptions = useMemo(() => {
    const merged = [
      ...classes,
      ...content.map((item) => item.grade).filter(Boolean),
      ...(Array.isArray(user?.assignedClasses) ? user.assignedClasses : []),
    ];
    const unique = [...new Set(merged.filter(Boolean))];
    return unique.length > 0 ? unique : fallbackClasses;
  }, [classes, content, user?.assignedClasses]);

  useEffect(() => {
    if (form.grade || classOptions.length === 0) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      grade: classOptions[0],
    }));
  }, [classOptions, form.grade]);

  const filteredContent = useMemo(() => content.filter((item) => {
    const matchesSearch = `${item.title} ${item.subject} ${item.teacher}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || String(item.fileType).toLowerCase().includes(filterType);
    return matchesSearch && matchesType;
  }), [content, filterType, searchQuery]);

  const stats = {
    total: content.length,
    pdf: content.filter((item) => String(item.fileType).toLowerCase().includes('pdf')).length,
    video: content.filter((item) => String(item.fileType).toLowerCase().includes('video')).length,
    live: content.filter((item) => String(item.publishStatus).toLowerCase().includes('yay')).length,
  };

  const teacherPlaylists = useMemo(() => {
    const teacherName = String(user?.name || '').trim().toLowerCase();
    const playlistMap = new Map();

    content
      .filter((item) => String(item.fileType || '').toLowerCase().includes('video'))
      .filter((item) => !teacherName || String(item.teacher || '').trim().toLowerCase() === teacherName)
      .forEach((item) => {
        if (!item.playlistKey || !item.playlistTitle) return;
        const existing = playlistMap.get(item.playlistKey);
        const nextOrder = Number(item.playlistOrder || 0);
        playlistMap.set(item.playlistKey, {
          key: item.playlistKey,
          title: item.playlistTitle,
          nextOrder: Math.max(existing?.nextOrder || 0, nextOrder) + 1,
          count: (existing?.count || 0) + 1,
        });
      });

    return Array.from(playlistMap.values()).sort((left, right) => left.title.localeCompare(right.title, 'tr'));
  }, [content, user?.name]);

  useEffect(() => {
    if (form.fileType !== 'Video' && form.playlistMode !== 'single') {
      setForm((prev) => ({
        ...prev,
        playlistMode: 'single',
        playlistKey: '',
        playlistTitle: '',
        playlistOrder: '1',
      }));
    }
  }, [form.fileType, form.playlistMode]);

  useEffect(() => {
    setPlayInlineVideo(String(selectedContent?.fileType || '').toLowerCase().includes('video'));
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setVideoSpeed(1);
  }, [selectedContent]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const trimmedPlaylistTitle = form.playlistTitle.trim();
      const selectedPlaylist = teacherPlaylists.find((item) => item.key === form.playlistKey);
      const shouldUsePlaylist = form.fileType === 'Video' && form.playlistMode !== 'single';
      const playlistTitle = shouldUsePlaylist
        ? (form.playlistMode === 'existing' ? selectedPlaylist?.title : trimmedPlaylistTitle)
        : '';
      const playlistKey = shouldUsePlaylist
        ? (form.playlistMode === 'existing' ? selectedPlaylist?.key : (globalThis.crypto?.randomUUID?.() ?? `playlist-${Date.now()}`))
        : '';
      const playlistOrder = shouldUsePlaylist
        ? Math.max(1, Number(form.playlistOrder || selectedPlaylist?.nextOrder || 1))
        : null;

      const uploadPayload = selectedFile ? await (() => {
        const formData = new FormData();
        formData.append('file', selectedFile);
        return uploadFile(formData, 'teacher-content');
      })() : null;
      const created = await createContent({
        subject: form.subject.trim(),
        title: form.title.trim(),
        teacher: user?.name || 'Öğretmen',
        info: form.description.trim(),
        progress: 0,
        fileType: form.fileType,
        grade: form.grade,
        views: '0',
        size: form.size.trim() || formatFileSizeLabel(uploadPayload?.size) || (selectedFile ? `${Math.max(1, Math.round(selectedFile.size / 1024 / 1024))} MB` : 'Dosya seçilmedi'),
        description: form.description.trim(),
        fileName: uploadPayload?.fileName || form.fileName.trim() || selectedFile?.name || null,
        playlistKey: playlistKey || null,
        playlistTitle: playlistTitle || null,
        playlistOrder,
        publishStatus: 'Aktif',
      });
      setContent((prev) => [created, ...prev]);
      setUploadOpen(false);
      setForm({
        title: '',
        description: '',
        subject: '',
        grade: '',
        fileType: 'PDF',
        fileName: '',
        size: '',
        playlistMode: 'single',
        playlistKey: '',
        playlistTitle: '',
        playlistOrder: '1',
      });
      setSelectedFile(null);
      toast({
        title: 'İçerik oluşturuldu',
        description: `${created.title} ogrenci ekraninda gorunecek sekilde kaydedildi.`,
      });
    } catch (err) {
      toast({
        title: 'İçerik kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (item, publishStatus) => {
    try {
      const updated = await updateContentStatus(item.id, publishStatus);
      setContent((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      toast({
        title: 'Durum güncellendi',
        description: `${updated.title} artık ${updated.publishStatus}.`,
      });
    } catch (err) {
      toast({
        title: 'Durum güncellenemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    }
  };

  const handleUpdateSelectedContent = async (payload) => {
    if (!selectedContent?.id) return;
    try {
      setSaving(true);
      const updated = await updateContent(selectedContent.id, payload);
      setContent((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setSelectedContent(updated);
      setEditingContent(false);
      toast({
        title: 'İçerik güncellendi',
        description: `${updated.title} için değişiklikler kaydedildi.`,
      });
    } catch (err) {
      toast({
        title: 'İçerik güncellenemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelectedContent = async () => {
    if (!selectedContent?.id) return;
    const confirmed = window.confirm(`"${selectedContent.title}" icerigi silinsin mi?`);
    if (!confirmed) return;

    try {
      await deleteContent(selectedContent.id);
      setContent((prev) => prev.filter((entry) => entry.id !== selectedContent.id));
      setSelectedContent(null);
      setEditingContent(false);
      toast({
        title: 'İçerik silindi',
        description: 'Kayit ogretmen panelinden kaldirildi.',
      });
    } catch (err) {
      toast({
        title: 'İçerik silinemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    }
  };

  const handleOpenContentFile = (fileName, download = false) => {
    const fileUrl = buildContentFileUrl(fileName);
    if (!fileUrl) {
      toast({
        title: 'Dosya bulunamadı',
        description: 'Bu içerik için indirilebilir dosya kaydı görünmüyor.',
      });
      return;
    }

    if (download) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const normalizeType = (value = '') => {
    const text = String(value).toLowerCase();
    if (text.includes('video')) return 'video';
    if (text.includes('pdf')) return 'pdf';
    return 'file';
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    setPlayInlineVideo(!video.paused);
  };

  const seekVideoBy = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const nextTime = Math.max(0, Math.min(duration, (video.currentTime || 0) + seconds));
    video.currentTime = nextTime;
    setVideoCurrentTime(nextTime);
  };

  const updateVideoSpeed = (speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setVideoSpeed(speed);
  };

  const formatDuration = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const openVideoFullscreen = async () => {
    const video = videoRef.current;
    const container = videoContainerRef.current;
    const target = video || container;
    if (!target) return;

    const requestFullscreen =
      target.requestFullscreen
      || target.webkitRequestFullscreen
      || container?.requestFullscreen
      || container?.webkitRequestFullscreen;

    if (requestFullscreen) {
      await requestFullscreen.call(target === container ? container : target);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">İçerikler yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teacher-content-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">İçerik Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Ders materyallerini canlı backend ile yönetin</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Upload className="h-4 w-4 mr-2" />
              Yeni İçerik
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni İçerik Yükle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Başlık</Label>
                <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="İçerik başlığı" />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="İçerik açıklaması" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ders</Label>
                  <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Matematik" />
                </div>
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  {classOptions.length > 0 ? (
                    <Select value={form.grade} onValueChange={(value) => setForm((prev) => ({ ...prev, grade: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                      <SelectContent>
                        {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.grade}
                      onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                      placeholder="Örn: 10-A"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dosya Türü</Label>
                  <Select value={form.fileType} onValueChange={(value) => setForm((prev) => ({ ...prev, fileType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDF">PDF</SelectItem>
                      <SelectItem value="Video">Video</SelectItem>
                      <SelectItem value="Word">Word</SelectItem>
                      <SelectItem value="PowerPoint">PowerPoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Boyut</Label>
                  <Input value={form.size} onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))} placeholder="Örn: 24 MB" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dosya Adı</Label>
                <Input value={form.fileName} onChange={(e) => setForm((prev) => ({ ...prev, fileName: e.target.value }))} placeholder="ornek.pdf" />
              </div>
              {form.fileType === 'Video' ? (
                <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div>
                    <Label>Oynatma Listesi</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Videoyu tek basina yayinlayabilir ya da mevcut bir seriye ekleyebilirsin.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      ['single', 'Tek Video'],
                      ['new', 'Yeni Liste'],
                      ['existing', 'Mevcut Liste'],
                    ].map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={form.playlistMode === value ? 'default' : 'outline'}
                        className={form.playlistMode === value ? 'bg-brand-primary hover:bg-brand-primary/90' : ''}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            playlistMode: value,
                            playlistKey: value === 'existing' ? (teacherPlaylists[0]?.key || '') : '',
                            playlistTitle: value === 'new' ? prev.playlistTitle : '',
                            playlistOrder: value === 'existing'
                              ? String(teacherPlaylists[0]?.nextOrder || 1)
                              : prev.playlistOrder,
                          }));
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  {form.playlistMode === 'new' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Liste Başlığı</Label>
                        <Input
                          value={form.playlistTitle}
                          onChange={(e) => setForm((prev) => ({ ...prev, playlistTitle: e.target.value }))}
                          placeholder="Orn: Trigonometri Kampi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Video Sırası</Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.playlistOrder}
                          onChange={(e) => setForm((prev) => ({ ...prev, playlistOrder: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : null}
                  {form.playlistMode === 'existing' ? (
                    teacherPlaylists.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Mevcut Liste</Label>
                          <Select
                            value={form.playlistKey || teacherPlaylists[0]?.key}
                            onValueChange={(value) => {
                              const playlist = teacherPlaylists.find((item) => item.key === value);
                              setForm((prev) => ({
                                ...prev,
                                playlistKey: value,
                                playlistTitle: playlist?.title || '',
                                playlistOrder: String(playlist?.nextOrder || 1),
                              }));
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Liste secin" /></SelectTrigger>
                            <SelectContent>
                              {teacherPlaylists.map((item) => (
                                <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Video Sırası</Label>
                          <Input
                            type="number"
                            min="1"
                            value={form.playlistOrder}
                            onChange={(e) => setForm((prev) => ({ ...prev, playlistOrder: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">Henuz olusturdugun bir video listesi yok. Once yeni liste ile bir seri baslat.</p>
                    )
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Dosya Seç</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (file) {
                      setForm((prev) => ({
                        ...prev,
                        fileName: file.name,
                        size: `${Math.max(1, Math.round(file.size / 1024 / 1024))} MB`,
                      }));
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>İptal</Button>
              <Button
                onClick={handleCreate}
                disabled={
                  saving
                  || !form.title
                  || !form.subject
                  || !form.grade
                  || (form.fileType === 'Video' && form.playlistMode === 'new' && !form.playlistTitle.trim())
                  || (form.fileType === 'Video' && form.playlistMode === 'existing' && teacherPlaylists.length === 0)
                }
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </DialogFooter>
            {!form.grade ? (
              <p className="text-xs text-amber-600">Kaydetmek için bir sınıf seçin veya sınıf adı girin.</p>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>

      {error ? <ErrorBanner title="İçerikler alınamadı" message={error} onRetry={loadContent} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          [stats.total, 'Toplam İçerik', FolderOpen, 'text-brand-primary'],
          [stats.pdf, 'PDF', FileText, 'text-red-600'],
          [stats.video, 'Video', Video, 'text-brand-accent'],
          [stats.live, 'Yayında', CheckCircle2, 'text-green-600'],
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

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="İçerik ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tür" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredContent.map((item) => {
          const Icon = contentTypeIcon(item.fileType);
          return (
            <motion.div key={item.id || item.title} variants={itemVariants}>
              <Card className="group hover:shadow-card-hover transition-all">
                <CardContent className="p-6 space-y-4">
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${buildCoverStyle(item)} p-5 text-white`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_38%)]" />
                    <div className="relative flex items-start justify-between">
                      <div className="space-y-3">
                        <Badge className="border-white/20 bg-white/15 text-white backdrop-blur-sm">{item.subject}</Badge>
                        <div>
                          <h3 className="text-lg font-semibold leading-tight">{item.title}</h3>
                          <p className="mt-1 text-sm text-white/80">{item.grade} • {item.teacher}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                      <div>
                        <Badge className={String(item.publishStatus).toLowerCase().includes('yay') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                          {item.publishStatus}
                        </Badge>
                        {item.playlistTitle ? (
                          <Badge variant="outline" className="ml-2">{item.playlistTitle} #{item.playlistOrder || 1}</Badge>
                        ) : null}
                      </div>
                    <Badge variant="outline">{item.fileType}</Badge>
                  </div>
                  <div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.description || item.info || 'Bu içerik için henüz açıklama girilmedi.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <span>Sınıf: {item.grade}</span>
                    <span>Boyut: {item.size}</span>
                    <span>Görüntüleme: {item.views}</span>
                    <span>Dosya: {item.fileName || item.fileType}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedContent(item);
                        setPlayInlineVideo(false);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />Detay
                    </Button>
                    <Button className="flex-1 bg-brand-primary hover:bg-brand-primary/90" onClick={() => handlePublish(item, String(item.publishStatus).toLowerCase().includes('yay') ? 'Taslak' : 'Yayinda')}>
                      {String(item.publishStatus).toLowerCase().includes('yay') ? 'Taslağa Al' : 'Yayınla'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={Boolean(selectedContent)} onOpenChange={(open) => {
        if (!open) {
          setSelectedContent(null);
          setEditingContent(false);
        }
      }}>
        <DialogContent className={normalizeType(selectedContent?.fileType) === 'video'
          ? 'max-h-[94vh] w-[calc(100vw-0.75rem)] max-w-6xl overflow-y-auto p-2 sm:w-[calc(100vw-2rem)] sm:p-4'
          : 'max-h-[94vh] w-[calc(100vw-0.75rem)] max-w-4xl overflow-y-auto p-3 sm:w-[calc(100vw-2rem)] sm:p-5'}
        >
          <DialogHeader>
            <DialogTitle>{selectedContent?.title}</DialogTitle>
            <DialogDescription>
              {selectedContent?.subject} • {selectedContent?.grade} • {selectedContent?.teacher}
            </DialogDescription>
          </DialogHeader>
          {selectedContent ? (
            <div className="space-y-5 py-2">
              {normalizeType(selectedContent.fileType) === 'video' && buildContentFileUrl(selectedContent.fileName) ? (
                <div ref={videoContainerRef} className="relative overflow-hidden rounded-2xl border bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    preload="metadata"
                    className="h-auto max-h-[70vh] min-h-[220px] w-full bg-black object-contain sm:max-h-[76vh]"
                    src={buildContentFileUrl(selectedContent.fileName)}
                    onClick={(event) => {
                      event.preventDefault();
                      toggleVideoPlayback();
                    }}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      setVideoDuration(video.duration || 0);
                      setVideoCurrentTime(video.currentTime || 0);
                      video.playbackRate = videoSpeed;
                    }}
                    onTimeUpdate={(event) => {
                      setVideoCurrentTime(event.currentTarget.currentTime || 0);
                    }}
                    onPlay={() => setPlayInlineVideo(true)}
                    onPause={() => setPlayInlineVideo(false)}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
                  <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
                    <div className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur sm:text-xs">
                      {selectedContent.fileType}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[70%]">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-white/20 bg-black/45 text-white hover:bg-black/60" onClick={() => handleOpenContentFile(selectedContent.fileName, true)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" className="h-9 rounded-full border-white/20 bg-black/45 px-3 text-xs text-white hover:bg-black/60 sm:text-sm" onClick={() => updateVideoSpeed(videoSpeed === 1 ? 1.5 : 1)}>
                        {videoSpeed}x
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-white/20 bg-black/45 text-white hover:bg-black/60" onClick={() => openVideoFullscreen().catch(() => {})}>
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <input
                      type="range"
                      min="0"
                      max={videoDuration || 0}
                      step="0.1"
                      value={Math.min(videoCurrentTime, videoDuration || 0)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (videoRef.current) {
                          videoRef.current.currentTime = value;
                        }
                        setVideoCurrentTime(value);
                      }}
                      className="mb-3 w-full accent-red-500"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-white sm:gap-2">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={toggleVideoPlayback}>
                        {playInlineVideo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => seekVideoBy(-10)}>
                        <Rewind className="h-5 w-5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={() => seekVideoBy(10)}>
                        <FastForward className="h-5 w-5" />
                      </Button>
                      <div className="ml-1 min-w-[96px] text-xs font-medium sm:ml-2 sm:text-sm">
                        {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : normalizeType(selectedContent.fileType) === 'pdf' && buildContentFileUrl(selectedContent.fileName) ? (
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <iframe
                    title={selectedContent.title}
                    src={buildContentFileUrl(selectedContent.fileName)}
                    className="h-[70vh] w-full"
                  />
                </div>
              ) : (
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${buildCoverStyle(selectedContent)} p-6 text-white`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_42%)]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <Badge className="border-white/20 bg-white/15 text-white">{selectedContent.subject}</Badge>
                      <h3 className="mt-4 text-2xl font-semibold">{selectedContent.title}</h3>
                      <p className="mt-2 text-sm text-white/85">{selectedContent.teacher} • {selectedContent.grade}</p>
                    </div>
                    <div className="rounded-2xl bg-white/15 p-3">
                      {(() => {
                        const DetailIcon = contentTypeIcon(selectedContent.fileType);
                        return <DetailIcon className="h-6 w-6 text-white" />;
                      })()}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Dosya</p>
                    <p className="mt-1 font-semibold">{selectedContent.fileName || selectedContent.fileType}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Boyut</p>
                    <p className="mt-1 font-semibold">{selectedContent.size || 'Belirsiz'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Görüntüleme</p>
                    <p className="mt-1 font-semibold">{selectedContent.views || '0'}</p>
                  </CardContent>
                </Card>
              </div>
              {editingContent && selectedContent ? (
                <Card className="border-brand-primary/15 bg-gradient-to-br from-white to-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">İçeriği Düzenle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="grid gap-4 md:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        handleUpdateSelectedContent({
                          subject: String(formData.get('subject') || '').trim(),
                          title: String(formData.get('title') || '').trim(),
                          teacher: String(formData.get('teacher') || '').trim(),
                          info: String(formData.get('info') || '').trim(),
                          progress: Number(selectedContent.progress || 0),
                          fileType: String(formData.get('fileType') || '').trim(),
                          grade: String(formData.get('grade') || '').trim(),
                          views: selectedContent.views || '0',
                          size: selectedContent.size || '',
                          description: String(formData.get('description') || '').trim(),
                          fileName: selectedContent.fileName || null,
                          playlistKey: selectedContent.playlistKey || null,
                          playlistTitle: selectedContent.playlistTitle || null,
                          playlistOrder: selectedContent.playlistOrder || null,
                          publishStatus: selectedContent.publishStatus || 'Aktif',
                        });
                      }}
                    >
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="edit-title">Başlık</Label>
                        <Input id="edit-title" name="title" defaultValue={selectedContent.title} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-subject">Ders</Label>
                        <Input id="edit-subject" name="subject" defaultValue={selectedContent.subject} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-grade">Sınıf</Label>
                        <Input id="edit-grade" name="grade" defaultValue={selectedContent.grade} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-teacher">Öğretmen</Label>
                        <Input id="edit-teacher" name="teacher" defaultValue={selectedContent.teacher} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-fileType">Dosya Türü</Label>
                        <select
                          id="edit-fileType"
                          name="fileType"
                          defaultValue={selectedContent.fileType}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="PDF">PDF</option>
                          <option value="Video">Video</option>
                          <option value="Word">Word</option>
                          <option value="PowerPoint">PowerPoint</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="edit-info">Süre / Sayfa / Slayt</Label>
                        <Input id="edit-info" name="info" defaultValue={selectedContent.info} required />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="edit-description">Açıklama</Label>
                        <Textarea id="edit-description" name="description" defaultValue={selectedContent.description} rows={5} required />
                      </div>
                      <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditingContent(false)}>İptal</Button>
                        <Button type="submit" className="w-full bg-brand-primary hover:bg-brand-primary/90 sm:w-auto" disabled={saving}>
                          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-5 text-sm leading-7 text-muted-foreground shadow-sm">
                  {selectedContent.description || selectedContent.info || 'Bu içerik için açıklama girilmemiş.'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedContent.subject}</Badge>
                <Badge variant="outline">{selectedContent.grade}</Badge>
                <Badge className={String(selectedContent.publishStatus).toLowerCase().includes('yay') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                  {selectedContent.publishStatus}
                </Badge>
                {selectedContent.playlistTitle ? (
                  <Badge variant="outline">{selectedContent.playlistTitle} #{selectedContent.playlistOrder || 1}</Badge>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="rounded-full sm:flex-1"
                  onClick={() => setEditingContent((current) => !current)}
                >
                  Düzenle
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full sm:flex-1"
                  onClick={() => handleOpenContentFile(selectedContent.fileName)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Dosyayi Ac
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full sm:flex-1"
                  onClick={() => handleOpenContentFile(selectedContent.fileName, true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Indir
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:flex-1"
                  onClick={handleDeleteSelectedContent}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Sil
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedContent(null)}>Kapat</Button>
            {selectedContent ? (
              <Button
                className="bg-brand-primary hover:bg-brand-primary/90"
                onClick={() => handlePublish(selectedContent, String(selectedContent.publishStatus).toLowerCase().includes('yay') ? 'Taslak' : 'Yayinda')}
              >
                {String(selectedContent.publishStatus).toLowerCase().includes('yay') ? 'Taslağa Al' : 'Yayınla'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
