import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Video, Plus, Search, Eye, Upload, FolderOpen, CheckCircle2, Play, Pause, Download, Maximize2, Rewind, FastForward, Trash2,
  CloudUpload, HardDrive, Sparkles, CalendarClock, Settings2, ImageIcon, X, ClipboardCheck, FileUp,
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
import { TeacherEmptyState } from '../../components/teacher/TeacherEmptyState';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createContent, deleteContent, fetchContents, fetchStudents, saveContentExtras, updateContent, updateContentStatus, uploadFile } from '../../lib/api/modules';
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

function inferContentTypeFromFile(fileName = '') {
  const extension = String(fileName).split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'm4v', 'webm'].includes(extension)) return 'Video';
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension)) return 'Word';
  if (['ppt', 'pptx'].includes(extension)) return 'PowerPoint';
  return 'Dosya';
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
  const [coverFile, setCoverFile] = useState(null);
  const [exerciseDrafts, setExerciseDrafts] = useState([{ id: 'exercise-1', title: '', description: '', url: '' }]);
  const [contentSettings, setContentSettings] = useState({
    allowDownload: true,
    allowNotes: true,
    completionCertificate: false,
  });
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
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
      if (!selectedFile) {
        toast({
          title: 'Dosya seçilmedi',
          description: 'Canlı yayına alınacak içerik için bir dosya seçmelisin.',
        });
        return;
      }
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
      const coverPayload = coverFile ? await (() => {
        const formData = new FormData();
        formData.append('file', coverFile);
        return uploadFile(formData, 'teacher-content-covers');
      })() : null;
      const coverImageUrl = coverPayload?.fileUrl || null;
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
        fileUrl: uploadPayload?.fileUrl || null,
        coverImageUrl,
        playlistKey: playlistKey || null,
        playlistTitle: playlistTitle || null,
        playlistOrder,
        allowDownload: contentSettings.allowDownload,
        allowNotes: contentSettings.allowNotes,
        completionCertificate: contentSettings.completionCertificate,
        publishStatus: 'Aktif',
      });
      await saveContentExtras(created.id, {
        coverImageUrl,
        exercises: exerciseDrafts
          .filter((item) => item.title.trim())
          .map((item) => ({
            id: item.id,
            title: item.title.trim(),
            description: item.description.trim(),
            url: item.url.trim(),
          })),
      }).catch(() => {});
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
      setCoverFile(null);
      setExerciseDrafts([{ id: 'exercise-1', title: '', description: '', url: '' }]);
      setContentSettings({
        allowDownload: true,
        allowNotes: true,
        completionCertificate: false,
      });
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

  const handleUploadFileSelected = useCallback((file) => {
    if (!file) return;
    const detectedType = inferContentTypeFromFile(file.name);
    const nameWithoutExtension = file.name.includes('.')
      ? file.name.slice(0, file.name.lastIndexOf('.'))
      : file.name;

    setSelectedFile(file);
    setForm((prev) => ({
      ...prev,
      fileType: detectedType,
      fileName: file.name,
      size: formatFileSizeLabel(file.size),
      title: prev.title || nameWithoutExtension.replace(/[_-]/g, ' '),
      info: prev.info || formatFileSizeLabel(file.size),
    }));
  }, []);

  const resetUploadForm = useCallback(() => {
    setForm({
      title: '',
      description: '',
      subject: '',
      grade: classOptions[0] || '',
      fileType: 'PDF',
      fileName: '',
      size: '',
      playlistMode: 'single',
      playlistKey: '',
      playlistTitle: '',
      playlistOrder: '1',
    });
    setSelectedFile(null);
    setCoverFile(null);
    setExerciseDrafts([{ id: 'exercise-1', title: '', description: '', url: '' }]);
    setContentSettings({
      allowDownload: true,
      allowNotes: true,
      completionCertificate: false,
    });
  }, [classOptions]);

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
          <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto border-white/10 bg-[#07111f] p-0 text-white shadow-2xl sm:w-[calc(100vw-2rem)]">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#091424] via-[#0d1628] to-[#160f08] px-6 py-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl text-white">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30">
                    <CloudUpload className="h-6 w-6" />
                  </span>
                  İçerik Yükleme
                </DialogTitle>
                <DialogDescription className="text-slate-300">
                  Eğitici içeriklerini canlı backend'e yükle, sınıf ve ders bilgileriyle öğrencilerin panelinde yayınla.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
              <div className="space-y-5 p-5 lg:p-6">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300">
                  {[
                    ['1', 'İçerik Yükleme'],
                    ['2', 'İçerik Bilgileri'],
                    ['3', 'İçerik Ayarları'],
                    ['4', 'Önizleme & Yayınla'],
                  ].map(([number, label], index) => (
                    <div key={number} className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${index === 0 ? 'bg-orange-500 text-white shadow-[0_0_24px_rgba(249,115,22,0.45)]' : 'bg-white/8 text-slate-300 ring-1 ring-white/10'}`}>
                        {number}
                      </span>
                      <span>{label}</span>
                      {index < 3 ? <span className="hidden h-px w-14 bg-white/10 md:block" /> : null}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleUploadFileSelected(event.dataTransfer.files?.[0]);
                  }}
                  className="group relative flex min-h-[230px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-white/18 bg-white/[0.035] p-8 text-center transition hover:border-orange-400/60 hover:bg-orange-500/[0.06]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.18),transparent_42%)] opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/[0.07] text-orange-300 ring-1 ring-white/10">
                    <FileUp className="h-10 w-10" />
                  </div>
                  <h3 className="relative mt-5 text-xl font-bold text-white">Dosyanızı buraya sürükleyip bırakın</h3>
                  <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-300">
                    veya dosya seçmek için tıklayın. Desteklenen formatlar: MP4, MOV, PDF, DOCX, PPTX. Maksimum dosya boyutu backend limitine göre kontrol edilir.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.m4v,.webm"
                    onChange={(event) => handleUploadFileSelected(event.target.files?.[0])}
                  />
                </button>

                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    [FolderOpen, 'Dosya Seç', 'Bilgisayarından dosya seç'],
                    [HardDrive, 'Google Drive', 'Harici kaynak hazır alanı'],
                    [CloudUpload, 'OneDrive', 'Dosya aktarım alanı'],
                    [Sparkles, 'Akıllı Önizleme', 'Seçilen dosyayı kontrol et'],
                  ].map(([Icon, title, subtitle]) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => title === 'Dosya Seç' && fileInputRef.current?.click()}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-orange-400/40 hover:bg-white/[0.075]"
                    >
                      <Icon className="h-6 w-6 text-orange-300" />
                      <p className="mt-3 text-sm font-bold text-white">{title}</p>
                      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-white">Yüklenen Dosya</h3>
                    {selectedFile ? (
                      <Button type="button" variant="ghost" size="sm" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setSelectedFile(null)}>
                        <X className="mr-2 h-4 w-4" />
                        Temizle
                      </Button>
                    ) : null}
                  </div>
                  {selectedFile ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b1626] p-4 md:flex-row md:items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                        {form.fileType === 'Video' ? <Video className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{selectedFile.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{form.fileType} • {formatFileSizeLabel(selectedFile.size)} • Yayına hazır</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 md:w-56">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300" />
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-[#0b1626] p-5 text-sm text-slate-400">
                      Henüz dosya seçilmedi. Canlı içerik oluşturmak için bir dosya ekleyin.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
                      <Eye className="h-5 w-5 text-orange-300" />
                      İçerik Önizleme
                    </h3>
                    <div className="relative flex min-h-[210px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#151f32] via-[#0b1424] to-[#261305]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(249,115,22,0.28),transparent_42%)]" />
                      <div className="relative text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-orange-300 ring-1 ring-white/10">
                          {form.fileType === 'Video' ? <Play className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                        </div>
                        <p className="mt-4 max-w-sm px-4 text-sm font-semibold text-white">{form.title || 'İçerik başlığı burada görünecek'}</p>
                        <p className="mt-2 text-xs text-slate-400">{form.subject || 'Ders'} • {form.grade || 'Sınıf'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
                      <ClipboardCheck className="h-5 w-5 text-purple-300" />
                      İçerik Kontrolü
                    </h3>
                    <div className="space-y-3 text-sm">
                      {[
                        ['Dosya', selectedFile ? 'Hazır' : 'Bekleniyor'],
                        ['Başlık', form.title ? 'Tamam' : 'Zorunlu'],
                        ['Ders / Sınıf', form.subject && form.grade ? 'Tamam' : 'Zorunlu'],
                        ['Açıklama', form.description ? 'Tamam' : 'Zorunlu'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl bg-[#0b1626] px-4 py-3">
                          <span className="text-slate-300">{label}</span>
                          <span className={value === 'Tamam' || value === 'Hazır' ? 'text-emerald-300' : 'text-amber-300'}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4 border-t border-white/10 bg-white/[0.025] p-5 lg:border-l lg:border-t-0 lg:p-6">
                <div className="rounded-[24px] border border-white/10 bg-[#0b1626] p-5">
                  <h3 className="mb-4 text-lg font-bold text-white">İçerik Bilgileri</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">İçerik Adı</Label>
                      <Input className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="7. Sınıf Matematik - Üslü Sayılar" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Açıklama</Label>
                      <Textarea className="min-h-[96px] border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="İçeriğin öğrenciye ne kazandıracağını yaz..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Ders</Label>
                        <Input className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Matematik" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Sınıf</Label>
                        {classOptions.length > 0 ? (
                          <Select value={form.grade} onValueChange={(value) => setForm((prev) => ({ ...prev, grade: value }))}>
                            <SelectTrigger className="border-white/10 bg-white/[0.06] text-white"><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                            <SelectContent>
                              {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" value={form.grade} onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))} placeholder="7. Sınıf" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Dosya Türü</Label>
                        <Select value={form.fileType} onValueChange={(value) => setForm((prev) => ({ ...prev, fileType: value }))}>
                          <SelectTrigger className="border-white/10 bg-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PDF">PDF</SelectItem>
                            <SelectItem value="Video">Video</SelectItem>
                            <SelectItem value="Word">Word</SelectItem>
                            <SelectItem value="PowerPoint">PowerPoint</SelectItem>
                            <SelectItem value="Dosya">Dosya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Boyut</Label>
                        <Input className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" value={form.size} onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))} placeholder="24 MB" />
                      </div>
                    </div>
                  </div>
                </div>

              {form.fileType === 'Video' ? (
                <div className="space-y-4 rounded-[24px] border border-orange-400/20 bg-orange-500/[0.06] p-5">
                  <div>
                    <Label className="text-slate-200">Oynatma Listesi</Label>
                    <p className="mt-1 text-xs text-slate-400">Videoyu tek başına yayınlayabilir veya mevcut bir seriye ekleyebilirsin.</p>
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
                        className={form.playlistMode === value ? 'bg-orange-500 text-white hover:bg-orange-600' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}
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
                        <Label className="text-slate-300">Liste Başlığı</Label>
                        <Input
                          className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500"
                          value={form.playlistTitle}
                          onChange={(e) => setForm((prev) => ({ ...prev, playlistTitle: e.target.value }))}
                          placeholder="Orn: Trigonometri Kampi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Video Sırası</Label>
                        <Input
                          className="border-white/10 bg-white/[0.06] text-white"
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
                            <SelectTrigger className="border-white/10 bg-white/[0.06] text-white"><SelectValue placeholder="Liste seçin" /></SelectTrigger>
                            <SelectContent>
                              {teacherPlaylists.map((item) => (
                                <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Video Sırası</Label>
                          <Input
                            className="border-white/10 bg-white/[0.06] text-white"
                            type="number"
                            min="1"
                            value={form.playlistOrder}
                            onChange={(e) => setForm((prev) => ({ ...prev, playlistOrder: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-200">Henüz oluşturduğun bir video listesi yok. Önce yeni liste ile bir seri başlat.</p>
                    )
                  ) : null}
                </div>
              ) : null}

                <div className="rounded-[24px] border border-white/10 bg-[#0b1626] p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                    <Settings2 className="h-5 w-5 text-orange-300" />
                    İçerik Ayarları
                  </h3>
                  <div className="space-y-3">
                    {[
                      ['İndirmeye izin ver', 'allowDownload'],
                      ['Öğrenci notu alabilir', 'allowNotes'],
                      ['Tamamlanma sertifikası', 'completionCertificate'],
                    ].map(([label, key]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setContentSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className="flex w-full items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-sm"
                      >
                        <span className="text-slate-300">{label}</span>
                        <span className={`h-6 w-11 rounded-full p-1 ${contentSettings[key] ? 'bg-orange-500' : 'bg-slate-700'}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white transition ${contentSettings[key] ? 'translate-x-5' : ''}`} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#0b1626] p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                    <ImageIcon className="h-5 w-5 text-purple-300" />
                    Kapak Görseli
                  </h3>
                  <input
                    ref={coverInputRef}
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/30 via-[#101b2c] to-orange-500/25 p-4 text-left"
                  >
                    <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                      <span className="text-sm font-semibold text-slate-200">{coverFile?.name || form.subject || 'Kapak seç / otomatik kapak'}</span>
                    </div>
                  </button>
                  <p className="mt-3 text-xs text-slate-400">Kapak yüklenirse öğrenci izleme ekranında canlı olarak kullanılır.</p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#0b1626] p-5">
                  <h3 className="mb-4 text-lg font-bold text-white">Alıştırmalar</h3>
                  <div className="space-y-3">
                    {exerciseDrafts.map((exercise, index) => (
                      <div key={exercise.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                        <Input
                          className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500"
                          value={exercise.title}
                          onChange={(event) => setExerciseDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                          placeholder="Alıştırma başlığı"
                        />
                        <Input
                          className="border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500"
                          value={exercise.url}
                          onChange={(event) => setExerciseDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}
                          placeholder="Bağlantı veya materyal URL"
                        />
                        <Textarea
                          className="min-h-[70px] border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500"
                          value={exercise.description}
                          onChange={(event) => setExerciseDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                          placeholder="Kısa açıklama"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                    onClick={() => setExerciseDrafts((prev) => [...prev, { id: `exercise-${Date.now()}`, title: '', description: '', url: '' }])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Alıştırma Ekle
                  </Button>
                </div>
              </aside>
            </div>

            <DialogFooter className="sticky bottom-0 border-t border-white/10 bg-[#07111f]/95 px-6 py-4 backdrop-blur">
              <Button variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]" onClick={() => { resetUploadForm(); setUploadOpen(false); }}>İptal</Button>
              <Button
                onClick={handleCreate}
                className="bg-orange-500 text-white hover:bg-orange-600"
                disabled={
                  saving
                  || !selectedFile
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
              <p className="px-6 pb-4 text-xs text-amber-200">Kaydetmek için bir sınıf seçin veya sınıf adı girin.</p>
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

      {content.length === 0 ? (
        <motion.div variants={itemVariants}>
          <TeacherEmptyState
            variant="content"
            accent="orange"
            large
            title="Henüz içerik yüklenmemiş"
            description="Bu derse ait henüz bir konu anlatımı içeriği bulunmuyor. Hemen içerik ekleyerek öğrencilerinize sunabilirsiniz."
            primaryLabel="Yeni İçerik Ekle"
            onPrimary={() => setUploadOpen(true)}
            secondaryLabel="İçerik Yükle"
            onSecondary={() => setUploadOpen(true)}
            tipTitle="Desteklenen İçerik Türleri"
            tipDescription="PDF, DOCX, PPTX, video, ses ve görsel dosyalarını yükleyebilirsiniz."
          />
        </motion.div>
      ) : filteredContent.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Bu filtrelere uygun içerik bulunamadı.
          </CardContent>
        </Card>
      ) : (
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
      )}

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
