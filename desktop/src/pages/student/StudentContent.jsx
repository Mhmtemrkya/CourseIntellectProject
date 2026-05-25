import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Video, FileText, Play, Pause, Clock, CheckCircle, Search, Download, Eye, Maximize2, Rewind, FastForward,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { fetchContents } from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';
import { setAppFullscreen } from '../../lib/tauri';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function normalizeType(value = '') {
  const text = String(value).toLowerCase();
  if (text.includes('video')) return 'video';
  if (text.includes('pdf')) return 'pdf';
  return 'file';
}

function previewGradient(type) {
  if (type === 'video') return 'from-orange-400 to-red-500';
  if (type === 'pdf') return 'from-blue-500 to-cyan-500';
  return 'from-slate-500 to-slate-700';
}

function buildContentFileUrl(fileName) {
  if (!fileName) return null;
  return new URL(`/uploads/teacher-content/${encodeURIComponent(fileName)}`, desktopApiBaseUrl).toString();
}

export default function StudentContent() {
  const [content, setContent] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tümü');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [playSelectedVideo, setPlaySelectedVideo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoContainerRef = useRef(null);
  const videoRef = useRef(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoImmersiveMode, setVideoImmersiveMode] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchContents(true);
      setContent(payload);
    } catch (err) {
      setError(err.message || 'İçerikler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const openFile = async (fileName, download = false) => {
    const fileUrl = buildContentFileUrl(fileName);
    if (!fileUrl) return;
    if (download) {
      const response = await window.fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Dosya indirilemedi (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'icerik';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      return;
    }
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const openVideoFullscreen = async () => {
    setVideoImmersiveMode(true);
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
      try {
        await requestFullscreen.call(target === container ? container : target);
        return;
      } catch {
        // fall through to Tauri window fullscreen
      }
    }

    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    await setAppFullscreen(true);
  };

  const closeVideoFullscreen = async () => {
    setVideoImmersiveMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // noop
    }
    await setAppFullscreen(false);
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    setPlaySelectedVideo(!video.paused);
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

  const subjects = useMemo(() => ['Tümü', ...new Set(content.map((item) => item.subject).filter(Boolean))], [content]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedItem || normalizeType(selectedItem.fileType) !== 'video') {
      return [];
    }

    const related = content
      .filter((item) => normalizeType(item.fileType) === 'video')
      .filter((item) => (
        selectedItem.playlistKey
          ? item.playlistKey === selectedItem.playlistKey
          : item.fileName === selectedItem.fileName
      ))
      .sort((left, right) => {
        const leftOrder = Number(left.playlistOrder || 9999);
        const rightOrder = Number(right.playlistOrder || 9999);
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return String(left.title || '').localeCompare(String(right.title || ''), 'tr');
      });

    return related.length > 0 ? related : [selectedItem];
  }, [content, selectedItem]);

  const currentPlaylistIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return selectedPlaylist.findIndex((item) => item.id === selectedItem.id || item.fileName === selectedItem.fileName);
  }, [selectedItem, selectedPlaylist]);

  const nextPlaylistItem = currentPlaylistIndex >= 0 && currentPlaylistIndex < selectedPlaylist.length - 1
    ? selectedPlaylist[currentPlaylistIndex + 1]
    : null;

  const openPlaylistItem = useCallback((item) => {
    setSelectedItem(item);
    setPlaySelectedVideo(true);
    setVideoCurrentTime(0);
    setVideoDuration(0);
  }, []);

  const filteredContent = useMemo(() => content.filter((item) => {
    const normalizedType = normalizeType(item.fileType);
    const matchesSearch = `${item.title} ${item.subject} ${item.teacher}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'Tümü' || item.subject === selectedSubject;
    const matchesTab = activeTab === 'all'
      || (activeTab === 'video' && normalizedType === 'video')
      || (activeTab === 'pdf' && normalizedType === 'pdf')
      || (activeTab === 'inprogress' && Number(item.progress) > 0 && Number(item.progress) < 100)
      || (activeTab === 'completed' && Number(item.progress) >= 100);
    return matchesSearch && matchesSubject && matchesTab;
  }), [activeTab, content, search, selectedSubject]);

  const stats = {
    total: content.length,
    completed: content.filter((item) => Number(item.progress) >= 100).length,
    inProgress: content.filter((item) => Number(item.progress) > 0 && Number(item.progress) < 100).length,
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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="student-content-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">İçerikler</h1>
        <p className="text-muted-foreground mt-1">Canlı backend içerikleri ve ders materyalleri</p>
      </div>

      {error ? <ErrorBanner title="İçerikler yüklenemedi" message={error} onRetry={loadContent} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [stats.total, 'Toplam İçerik', BookOpen, 'text-brand-primary'],
          [stats.inProgress, 'Devam Eden', Clock, 'text-yellow-600'],
          [stats.completed, 'Tamamlanan', CheckCircle, 'text-green-600'],
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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="İçerik ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Button
                  key={subject}
                  variant={selectedSubject === subject ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubject(subject)}
                  className={selectedSubject === subject ? 'bg-brand-primary' : ''}
                >
                  {subject}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="video">Videolar</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="inprogress">Devam Eden</TabsTrigger>
          <TabsTrigger value="completed">Tamamlanan</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredContent.length === 0 ? (
            <StudentEmptyState
              variant="content"
              accent="purple"
              title="Henüz içerik bulunmuyor"
              description="Bu derse ait konu anlatımı içerikleri henüz eklenmemiş. Yeni içerikler eklendiğinde burada görebilirsin."
              primaryLabel="İçeriklere Göz At"
              onPrimary={loadContent}
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item) => {
              const normalizedType = normalizeType(item.fileType);
              return (
                <motion.div key={item.id || `${item.title}-${item.subject}`} variants={itemVariants}>
                  <Card className="overflow-hidden hover:shadow-card-hover transition-all cursor-pointer group">
                    <div className={`relative h-40 bg-gradient-to-br ${previewGradient(normalizedType)}`}>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-3">
                        <Button size="lg" className="rounded-full bg-white/20 hover:bg-white/30 text-white" onClick={() => { setSelectedItem(item); setPlaySelectedVideo(normalizeType(item.fileType) === 'video'); setVideoCurrentTime(0); setVideoDuration(0); setVideoSpeed(1); }}>
                          {normalizedType === 'video' ? <Play className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                        </Button>
                        <Button size="lg" variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10" onClick={() => openFile(item.fileName, true).catch(() => {})}>
                          <Download className="h-5 w-5" />
                        </Button>
                      </div>
                      <Badge className="absolute top-2 left-2 bg-white/15 text-white border border-white/20">
                        {normalizedType === 'video' ? <Video className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                        {item.fileType}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="outline" className="mb-2">{item.subject}</Badge>
                      <h3 className="font-semibold line-clamp-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{item.teacher}</p>
                      <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                        <span>{item.size || 'Boyut yok'}</span>
                        <span>{item.grade || 'Sınıf yok'}</span>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-2">
                          <span>İlerleme</span>
                          <span>{Math.round(Number(item.progress) || 0)}%</span>
                        </div>
                        <Progress value={Number(item.progress) || 0} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setVideoImmersiveMode(false); }}>
        <DialogContent className={normalizeType(selectedItem?.fileType) === 'video'
          ? `${videoImmersiveMode ? 'h-screen w-screen max-w-none rounded-none border-0 p-0' : 'max-w-5xl p-2'}`
          : 'max-w-2xl'}
        >
          {normalizeType(selectedItem?.fileType) === 'video' ? null : (
            <DialogHeader>
              <DialogTitle>{selectedItem?.title}</DialogTitle>
            </DialogHeader>
          )}
          {selectedItem ? (
            <div className="space-y-4">
              {normalizeType(selectedItem.fileType) === 'video' && buildContentFileUrl(selectedItem.fileName) ? (
                <div ref={videoContainerRef} className={`relative overflow-hidden bg-black ${videoImmersiveMode ? 'h-screen w-screen rounded-none' : 'rounded-2xl border'}`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      preload="metadata"
                      className="h-auto max-h-[78vh] w-full bg-black object-contain"
                      src={buildContentFileUrl(selectedItem.fileName)}
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
                      onPlay={() => setPlaySelectedVideo(true)}
                      onPause={() => setPlaySelectedVideo(false)}
                      onEnded={() => {
                        if (nextPlaylistItem) {
                          openPlaylistItem(nextPlaylistItem);
                        }
                      }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                    <div className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {selectedItem.fileType}
                    </div>
                    <div className="flex items-center gap-2">
                      {videoImmersiveMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full border-white/20 bg-black/45 text-white hover:bg-black/60"
                          onClick={() => closeVideoFullscreen().catch(() => {})}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-white/20 bg-black/45 text-white hover:bg-black/60"
                        onClick={() => openFile(selectedItem.fileName, true).catch(() => {})}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-white/20 bg-black/45 px-3 text-white hover:bg-black/60"
                        onClick={() => updateVideoSpeed(videoSpeed === 1 ? 1.5 : 1)}
                      >
                        {videoSpeed}x
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-white/20 bg-black/45 text-white hover:bg-black/60"
                        onClick={() => openVideoFullscreen().catch(() => {})}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
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
                    <div className="flex items-center gap-2 text-white">
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={toggleVideoPlayback}>
                        {playSelectedVideo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={() => seekVideoBy(-10)}>
                        <Rewind className="h-5 w-5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={() => seekVideoBy(10)}>
                        <FastForward className="h-5 w-5" />
                      </Button>
                      <div className="ml-2 text-sm font-medium">
                        {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`h-52 rounded-xl bg-gradient-to-br ${previewGradient(normalizeType(selectedItem.fileType))} flex items-center justify-center`}>
                  {normalizeType(selectedItem.fileType) === 'video' ? <Video className="h-14 w-14 text-white" /> : <FileText className="h-14 w-14 text-white" />}
                </div>
              )}
              {normalizeType(selectedItem.fileType) === 'video' ? null : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Ders:</span> {selectedItem.subject}</div>
                    <div><span className="text-muted-foreground">Öğretmen:</span> {selectedItem.teacher}</div>
                    <div><span className="text-muted-foreground">Sınıf:</span> {selectedItem.grade}</div>
                    <div><span className="text-muted-foreground">Dosya:</span> {selectedItem.fileName || selectedItem.fileType}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedItem.description || selectedItem.info || 'İçerik açıklaması bulunmuyor.'}</p>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {normalizeType(selectedItem.fileType) !== 'video' ? (
                  <Button variant="outline" className="rounded-full" onClick={() => openFile(selectedItem.fileName)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Dosyayi Ac
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-full" onClick={() => openFile(selectedItem.fileName, true).catch(() => {})}>
                  <Download className="h-4 w-4 mr-2" />
                  Indir
                </Button>
              </div>
              {normalizeType(selectedItem.fileType) === 'video' && buildContentFileUrl(selectedItem.fileName) ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3 rounded-[28px] border bg-white p-4 shadow-sm">
                    {selectedItem.playlistTitle ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="font-semibold text-foreground">{selectedItem.playlistTitle}</p>
                        <p className="mt-1 text-muted-foreground">
                          {selectedPlaylist.length} videoluk seri
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {selectedPlaylist.length > 1 ? (
                    <div className="rounded-[28px] border bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">Oynatma Listesi</p>
                          <p className="text-xs text-muted-foreground">{selectedItem.playlistTitle || 'Bu ders serisi'}</p>
                        </div>
                        <Badge variant="outline">{selectedPlaylist.length} video</Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedPlaylist.map((item, index) => {
                          const active = item.id === selectedItem.id || item.fileName === selectedItem.fileName;
                          return (
                            <button
                              key={item.id || `${item.fileName}-${index}`}
                              type="button"
                              onClick={() => openPlaylistItem(item)}
                              className={`flex w-full items-start gap-3 rounded-2xl px-2 py-2 text-left transition ${
                                active ? 'bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className={`mt-0.5 overflow-hidden rounded-xl ${active ? 'ring-2 ring-brand-primary/30' : ''}`}>
                                <div className={`flex h-14 w-24 items-center justify-center ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                  Bolum {item.playlistOrder || index + 1} • {item.info || item.subject}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
