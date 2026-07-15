import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Video, Plus, Search, Eye, Upload, FolderOpen, CheckCircle2, Play, Pause, Download, Maximize2, Rewind, FastForward, Trash2,
  CloudUpload, HardDrive, Sparkles, CalendarClock, Settings2, ImageIcon, X, ClipboardCheck, FileUp, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import PremiumResourceCard from '../../components/ui/PremiumResourceCard';
import { AnimatedValue, PremiumPanel } from '../../components/ui/premium-dashboard';
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

function buildContentFileUrl(contentFile) {
  const fileUrl = typeof contentFile === 'object' ? String(contentFile?.fileUrl || '').trim() : '';
  if (fileUrl) {
    if (/^https?:\/\//i.test(fileUrl)) {
      return fileUrl;
    }
    if (!desktopApiBaseUrl) {
      return fileUrl;
    }
    try {
      return new URL(fileUrl, desktopApiBaseUrl).toString();
    } catch {
      return fileUrl;
    }
  }

  const fileName = typeof contentFile === 'object' ? String(contentFile?.fileName || '').trim() : String(contentFile || '').trim();
  if (!fileName) return null;
  if (!desktopApiBaseUrl) {
    return `/uploads/teacher-content/${encodeURIComponent(fileName)}`;
  }
  try {
    return new URL(`/uploads/teacher-content/${encodeURIComponent(fileName)}`, desktopApiBaseUrl).toString();
  } catch {
    return `/uploads/teacher-content/${encodeURIComponent(fileName)}`;
  }
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
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [page, setPage] = useState(1);
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
    const type = String(item.fileType).toLowerCase();
    const matchesSearch = `${item.title} ${item.subject} ${item.teacher}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all'
      || (filterType === 'video' && type.includes('video'))
      || (filterType === 'dokuman' && (type.includes('pdf') || type.includes('doc') || type.includes('word')))
      || (filterType === 'sunum' && (type.includes('sunum') || type.includes('ppt') || type.includes('slayt') || type.includes('presentation')));
    const matchesSubject = subjectFilter === 'all' || item.subject === subjectFilter;
    return matchesSearch && matchesType && matchesSubject;
  }), [content, filterType, searchQuery, subjectFilter]);

  const isSunum = (item) => /sunum|ppt|slayt|presentation/.test(String(item.fileType).toLowerCase());
  const stats = {
    total: content.length,
    pdf: content.filter((item) => String(item.fileType).toLowerCase().includes('pdf')).length,
    video: content.filter((item) => String(item.fileType).toLowerCase().includes('video')).length,
    sunum: content.filter(isSunum).length,
  };
  const subjectOptions = [...new Set(content.map((item) => item.subject).filter(Boolean))];
  const mostViewed = [...content].sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 3);
  const recentAdded = [...content].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
  const PAGE_SIZE = 6;
  const pageCount = Math.max(1, Math.ceil(filteredContent.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedContent = filteredContent.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const handleOpenContentFile = (contentFile, download = false) => {
    const fileUrl = buildContentFileUrl(contentFile);
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
      link.download = (typeof contentFile === 'object' ? contentFile?.fileName || contentFile?.title : contentFile) || 'icerik';
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
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Konu Anlatımı</h1>
          <p className="mt-1 text-sm text-muted-foreground">Derslerinize ait konu anlatımlarınızı oluşturun, düzenleyin ve paylaşın.</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <FeatureGate module="content" action="upload">
            {/* DialogTrigger+asChild, FeatureGate sarmalayıcısına onClick'i
                iletmediği için buton tepkisiz kalıyordu; doğrudan setUploadOpen
                ile açıyoruz (boş-durum butonuyla aynı davranış). */}
            <Button onClick={() => setUploadOpen(true)} className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]">
              <Upload className="h-4 w-4 mr-2" />
              Yeni İçerik Ekle
            </Button>
          </FeatureGate>
          <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto border-foreground/10 bg-[hsl(var(--ci-card))] p-0 text-foreground shadow-2xl sm:w-[calc(100vw-2rem)]">
            <div className="border-b border-foreground/10 bg-gradient-to-r from-[hsl(var(--ci-card))] via-[hsl(var(--ci-card))] to-[#160f08] px-6 py-5">
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
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${index === 0 ? 'bg-orange-500 text-white shadow-[0_0_24px_rgba(249,115,22,0.45)]' : 'bg-foreground/8 text-slate-300 ring-1 ring-foreground/10'}`}>
                        {number}
                      </span>
                      <span>{label}</span>
                      {index < 3 ? <span className="hidden h-px w-14 bg-foreground/10 md:block" /> : null}
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
                  className="group relative flex min-h-[230px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-foreground/18 bg-foreground/[0.035] p-8 text-center transition hover:border-orange-400/60 hover:bg-orange-500/[0.06]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.18),transparent_42%)] opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-foreground/[0.07] text-orange-300 ring-1 ring-foreground/10">
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
                      className="rounded-2xl border border-foreground/10 bg-foreground/[0.045] p-4 text-left transition hover:border-orange-400/40 hover:bg-foreground/[0.075]"
                    >
                      <Icon className="h-6 w-6 text-orange-300" />
                      <p className="mt-3 text-sm font-bold text-white">{title}</p>
                      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-[24px] border border-foreground/10 bg-foreground/[0.035] p-4">
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
                    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-4 md:flex-row md:items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                        {form.fileType === 'Video' ? <Video className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{selectedFile.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{form.fileType} • {formatFileSizeLabel(selectedFile.size)} • Yayına hazır</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10 md:w-56">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300" />
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 text-sm text-slate-400">
                      Henüz dosya seçilmedi. Canlı içerik oluşturmak için bir dosya ekleyin.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-foreground/10 bg-foreground/[0.035] p-4">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
                      <Eye className="h-5 w-5 text-orange-300" />
                      İçerik Önizleme
                    </h3>
                    <div className="relative flex min-h-[210px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--ci-card))] via-[hsl(var(--ci-card))] to-[#261305]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(249,115,22,0.28),transparent_42%)]" />
                      <div className="relative text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/10 text-orange-300 ring-1 ring-foreground/10">
                          {form.fileType === 'Video' ? <Play className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                        </div>
                        <p className="mt-4 max-w-sm px-4 text-sm font-semibold text-white">{form.title || 'İçerik başlığı burada görünecek'}</p>
                        <p className="mt-2 text-xs text-slate-400">{form.subject || 'Ders'} • {form.grade || 'Sınıf'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-foreground/10 bg-foreground/[0.035] p-4">
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
                        <div key={label} className="flex items-center justify-between rounded-2xl bg-[hsl(var(--ci-card))] px-4 py-3">
                          <span className="text-slate-300">{label}</span>
                          <span className={value === 'Tamam' || value === 'Hazır' ? 'text-emerald-300' : 'text-amber-300'}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4 border-t border-foreground/10 bg-foreground/[0.025] p-5 lg:border-l lg:border-t-0 lg:p-6">
                <div className="rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
                  <h3 className="mb-4 text-lg font-bold text-white">İçerik Bilgileri</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">İçerik Adı</Label>
                      <Input className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="7. Sınıf Matematik - Üslü Sayılar" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Açıklama</Label>
                      <Textarea className="min-h-[96px] border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="İçeriğin öğrenciye ne kazandıracağını yaz..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Ders</Label>
                        <Input className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500" value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Matematik" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Sınıf</Label>
                        {classOptions.length > 0 ? (
                          <Select value={form.grade} onValueChange={(value) => setForm((prev) => ({ ...prev, grade: value }))}>
                            <SelectTrigger className="border-foreground/10 bg-foreground/[0.06] text-white"><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                            <SelectContent>
                              {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500" value={form.grade} onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))} placeholder="7. Sınıf" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Dosya Türü</Label>
                        <Select value={form.fileType} onValueChange={(value) => setForm((prev) => ({ ...prev, fileType: value }))}>
                          <SelectTrigger className="border-foreground/10 bg-foreground/[0.06] text-white"><SelectValue /></SelectTrigger>
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
                        <Input className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500" value={form.size} onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))} placeholder="24 MB" />
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
                        className={form.playlistMode === value ? 'bg-orange-500 text-white hover:bg-orange-600' : 'border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:bg-foreground/[0.08]'}
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
                          className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500"
                          value={form.playlistTitle}
                          onChange={(e) => setForm((prev) => ({ ...prev, playlistTitle: e.target.value }))}
                          placeholder="Orn: Trigonometri Kampi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Video Sırası</Label>
                        <Input
                          className="border-foreground/10 bg-foreground/[0.06] text-white"
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
                            <SelectTrigger className="border-foreground/10 bg-foreground/[0.06] text-white"><SelectValue placeholder="Liste seçin" /></SelectTrigger>
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
                            className="border-foreground/10 bg-foreground/[0.06] text-white"
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

                <div className="rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
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
                        className="flex w-full items-center justify-between rounded-2xl bg-foreground/[0.04] px-4 py-3 text-left text-sm"
                      >
                        <span className="text-slate-300">{label}</span>
                        <span className={`h-6 w-11 rounded-full p-1 ${contentSettings[key] ? 'bg-orange-500' : 'bg-slate-700'}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white transition ${contentSettings[key] ? 'translate-x-5' : ''}`} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
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
                    className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/30 via-[hsl(var(--ci-card))] to-orange-500/25 p-4 text-left"
                  >
                    <div className="flex h-24 items-center justify-center rounded-xl border border-foreground/10 bg-black/20">
                      <span className="text-sm font-semibold text-slate-200">{coverFile?.name || form.subject || 'Kapak seç / otomatik kapak'}</span>
                    </div>
                  </button>
                  <p className="mt-3 text-xs text-slate-400">Kapak yüklenirse öğrenci izleme ekranında canlı olarak kullanılır.</p>
                </div>

                <div className="rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
                  <h3 className="mb-4 text-lg font-bold text-white">Alıştırmalar</h3>
                  <div className="space-y-3">
                    {exerciseDrafts.map((exercise, index) => (
                      <div key={exercise.id} className="space-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                        <Input
                          className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500"
                          value={exercise.title}
                          onChange={(event) => setExerciseDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                          placeholder="Alıştırma başlığı"
                        />
                        <Input
                          className="border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500"
                          value={exercise.url}
                          onChange={(event) => setExerciseDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))}
                          placeholder="Bağlantı veya materyal URL"
                        />
                        <Textarea
                          className="min-h-[70px] border-foreground/10 bg-foreground/[0.06] text-white placeholder:text-slate-500"
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
                    className="mt-3 w-full border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:bg-foreground/[0.08]"
                    onClick={() => setExerciseDrafts((prev) => [...prev, { id: `exercise-${Date.now()}`, title: '', description: '', url: '' }])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Alıştırma Ekle
                  </Button>
                </div>
              </aside>
            </div>

            <DialogFooter className="sticky bottom-0 border-t border-foreground/10 bg-[hsl(var(--ci-card)/0.95)] px-6 py-4 backdrop-blur">
              <Button variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:bg-foreground/[0.08]" onClick={() => { resetUploadForm(); setUploadOpen(false); }}>İptal</Button>
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

      {/* 4 stat kartı */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Toplam İçerik', stats.total, 'içerik', FolderOpen, 'from-violet-400 to-fuchsia-600'],
          ['Video İçerikler', stats.video, 'video', Video, 'from-sky-400 to-blue-600'],
          ['PDF İçerikler', stats.pdf, 'doküman', FileText, 'from-rose-400 to-red-600'],
          ['Sunumlar', stats.sunum, 'sunum', FolderOpen, 'from-amber-400 to-orange-600'],
        ].map(([label, value, unit, Icon, gradient]) => (
          <motion.div variants={itemVariants} key={label} className="ci-metric-card flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
              <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white ${gradient}`}><Icon className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight"><AnimatedValue value={value} /></p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{unit}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="flex flex-wrap gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
        {[['all', 'Tüm İçerikler'], ['video', 'Videolar'], ['dokuman', 'Dokümanlar'], ['sunum', 'Sunumlar']].map(([value, label]) => (
          <button key={value} onClick={() => { setFilterType(value); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${filterType === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      {/* Filtre çubuğu */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="İçerik ara..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }} className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-sm outline-none">
          <option value="all">Tüm Dersler</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* İçerik tablosu */}
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
          />
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <PremiumPanel title="İçerikler" description={`${filteredContent.length} içerik`} contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="ci-table w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">İçerik Adı</th>
                    <th className="px-4 py-3 font-semibold">Ders</th>
                    <th className="px-4 py-3 font-semibold">Sınıf</th>
                    <th className="px-4 py-3 font-semibold">Tür</th>
                    <th className="px-4 py-3 font-semibold">Oluşturulma</th>
                    <th className="px-4 py-3 text-right font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedContent.length ? pagedContent.map((item) => {
                    const t = String(item.fileType).toLowerCase();
                    const tone = t.includes('video') ? 'border-sky-500/30 bg-sky-500/12 text-sky-300'
                      : (t.includes('pdf') || t.includes('doc')) ? 'border-rose-500/30 bg-rose-500/12 text-rose-300'
                      : isSunum(item) ? 'border-violet-500/30 bg-violet-500/12 text-violet-300'
                      : 'border-foreground/10 bg-foreground/5 text-muted-foreground';
                    const TypeIcon = t.includes('video') ? Video : FileText;
                    const created = item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toLocaleDateString('tr-TR') : (item.dateLabel || '-');
                    return (
                      <tr key={item.id || item.title} className="border-b border-foreground/[0.06] transition-colors hover:bg-foreground/[0.025]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><TypeIcon className="h-4 w-4" /></div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{item.title}</p>
                              {item.description ? <p className="truncate text-xs text-muted-foreground">{item.description}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.subject || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.grade || '-'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{item.fileType || 'Dosya'}</span></td>
                        <td className="px-4 py-3 text-muted-foreground">{created}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedContent(item); setPlayInlineVideo(false); }}><Eye className="mr-1.5 h-3.5 w-3.5" />Detay</Button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Bu filtrede içerik bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-foreground/10 px-4 py-3">
                <span className="text-xs text-muted-foreground">{(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, filteredContent.length)} / {filteredContent.length} içerik</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-2 text-xs font-semibold tabular-nums">{safePage} / {pageCount}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : null}
          </PremiumPanel>
        </motion.div>
      )}

      {/* En Çok İzlenen + Son Eklenen */}
      {content.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <PremiumPanel title="En Çok İzlenen İçerikler" description="En çok izlenen konular" contentClassName="space-y-2.5">
            {mostViewed.map((item, index) => (
              <button key={item.id || index} onClick={() => { setSelectedContent(item); setPlayInlineVideo(false); }} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.14)] text-xs font-black text-[hsl(var(--brand-accent))]">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.grade || '-'} • {item.views || 0} izlenme</p></div>
                <Eye className="h-4 w-4 shrink-0 text-[hsl(var(--brand-accent))]" />
              </button>
            ))}
          </PremiumPanel>
          <PremiumPanel title="Son Eklenen İçerikler" description="Yeni yüklenen materyaller" contentClassName="space-y-2.5">
            {recentAdded.map((item, index) => (
              <button key={item.id || index} onClick={() => { setSelectedContent(item); setPlayInlineVideo(false); }} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toLocaleDateString('tr-TR') : (item.dateLabel || '')}</p></div>
              </button>
            ))}
          </PremiumPanel>
        </div>
      ) : null}

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
              {normalizeType(selectedContent.fileType) === 'video' && buildContentFileUrl(selectedContent) ? (
                <div ref={videoContainerRef} className="relative overflow-hidden rounded-2xl border bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    preload="metadata"
                    className="h-auto max-h-[70vh] min-h-[220px] w-full bg-black object-contain sm:max-h-[76vh]"
                    src={buildContentFileUrl(selectedContent)}
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
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-foreground/20 bg-black/45 text-white hover:bg-black/60" onClick={() => handleOpenContentFile(selectedContent, true)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" className="h-9 rounded-full border-foreground/20 bg-black/45 px-3 text-xs text-white hover:bg-black/60 sm:text-sm" onClick={() => updateVideoSpeed(videoSpeed === 1 ? 1.5 : 1)}>
                        {videoSpeed}x
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full border-foreground/20 bg-black/45 text-white hover:bg-black/60" onClick={() => openVideoFullscreen().catch(() => {})}>
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
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-foreground/10" onClick={toggleVideoPlayback}>
                        {playInlineVideo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-foreground/10" onClick={() => seekVideoBy(-10)}>
                        <Rewind className="h-5 w-5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-foreground/10" onClick={() => seekVideoBy(10)}>
                        <FastForward className="h-5 w-5" />
                      </Button>
                      <div className="ml-1 min-w-[96px] text-xs font-medium sm:ml-2 sm:text-sm">
                        {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : normalizeType(selectedContent.fileType) === 'pdf' && buildContentFileUrl(selectedContent) ? (
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <iframe
                    title={selectedContent.title}
                    src={buildContentFileUrl(selectedContent)}
                    className="h-[70vh] w-full"
                  />
                </div>
              ) : (
                <div className={`relative overflow-hidden rounded-2xl ${buildCoverStyle(selectedContent)} p-6 text-white ci-hero`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_42%)]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <Badge className="border-foreground/20 bg-foreground/15 text-white">{selectedContent.subject}</Badge>
                      <h3 className="mt-4 text-2xl font-semibold">{selectedContent.title}</h3>
                      <p className="mt-2 text-sm text-foreground/85">{selectedContent.teacher} • {selectedContent.grade}</p>
                    </div>
                    <div className="rounded-2xl bg-foreground/15 p-3">
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
