import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Send, Paperclip, MoreVertical, Phone, Video, Check, CheckCheck, Plus, ChevronLeft,
  UserRound,
  Clock3,
  MessageCircleMore,
  Download,
  Trash2,
  ImageIcon,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { desktopApiBaseUrl } from '../../lib/auth';
import { messageRealtimeClient } from '../../lib/messages/messageRealtime';
import {
  createThread,
  deleteThreadMessageForMe,
  fetchStaff,
  fetchStudents,
  fetchThreadMessages,
  fetchThreads,
  sendThreadMessage,
  uploadFile,
} from '../../lib/api/modules';
import { cn } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const messageVariants = {
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

function includesAnyRole(candidate, expectedRoles = []) {
  const normalizedRole = normalize(candidate?.role || candidate?.roleType || '');
  const normalizedExtras = Array.isArray(candidate?.extraRoles)
    ? candidate.extraRoles.map((item) => normalize(item))
    : [];

  return expectedRoles.some((role) => {
    const expected = normalize(role);
    return normalizedRole === expected || normalizedExtras.includes(expected);
  });
}

function buildParentContacts(students = []) {
  const map = new Map();
  students.forEach((student) => {
    if (!student.parentName) return;
    const key = `${normalize(student.parentName)}|${normalize(student.parentEmail)}`;
    if (!map.has(key)) {
      map.set(key, {
        name: student.parentName,
        role: 'Parent',
        contactKey: student.parentEmail?.split('@')[0] || '',
        subtitle: `${student.fullName} • ${student.className || 'Sınıf yok'}`,
      });
    }
  });
  return Array.from(map.values());
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function attachmentDraftLabel(attachment) {
  if (attachment.fileType === 'image') return 'Görsel hazır';
  if (attachment.fileType === 'pdf') return 'PDF hazır';
  if (attachment.fileType === 'video') return 'Video hazır';
  return 'Ek dosya hazır';
}

function attachmentDraftTag(attachment) {
  if (attachment.fileType === 'image') return 'IMG';
  if (attachment.fileType === 'pdf') return 'PDF';
  if (attachment.fileType === 'video') return 'VID';
  return 'DOS';
}

function sameThreadLists(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => (
    item.id === right[index]?.id
    && Number(item.unreadCount || 0) === Number(right[index]?.unreadCount || 0)
    && String(item.lastMessagePreview || '') === String(right[index]?.lastMessagePreview || '')
    && String(item.lastMessageStatus || '') === String(right[index]?.lastMessageStatus || '')
    && String(item.lastMessageAtUtc || item.lastMessageAt || '') === String(right[index]?.lastMessageAtUtc || right[index]?.lastMessageAt || '')
  ));
}

function sameMessageLists(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => (
    item.id === right[index]?.id
    && String(item.status || '') === String(right[index]?.status || '')
    && Boolean(item.isRead) === Boolean(right[index]?.isRead)
    && String(item.text || '') === String(right[index]?.text || '')
    && String(item.readAtUtc || '') === String(right[index]?.readAtUtc || '')
  ));
}

function renderStatusIcon(status) {
  if (status === 'read') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-500" />;
  }
  return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function Chat() {
  const { user } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [isContactOnline, setIsContactOnline] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const threadSilentSyncRef = useRef(null);
  const messageSilentSyncRef = useRef(null);
  const selectedThreadId = selectedThread?.id;
  const selectedThreadName = selectedThread?.contactName;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleHeaderAction = (type) => {
    if (!selectedThread) return;
    if (type === 'call') {
      toast({
        title: 'İletişim yönlendirmesi',
        description: `${selectedThread.contactName} ile planlı görüşme akışına yönlendiriliyorsunuz.`,
      });
      navigate('/p/meetings');
      return;
    }
    if (type === 'video') {
      toast({
        title: 'Canlı görüşme hazırlığı',
        description: 'Görüşme planı için canlı ders/görüşme modülünü açıyoruz.',
      });
      navigate(user?.role === 'teacher' ? '/t/live-lessons' : '/p/meetings');
      return;
    }
    toast({
      title: 'Sohbet detayları',
      description: `${selectedThread.contactName} ile iletişim detayları görüntüleniyor.`,
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    messageRealtimeClient.ensureConnected().catch(() => {});

    const disposeThread = messageRealtimeClient.onThreadUpdated((payload) => {
      if (cancelled || !payload?.id) return;
      setThreads((prev) => {
        const next = [...prev];
        const index = next.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
          next[index] = { ...next[index], ...payload };
        } else {
          next.unshift(payload);
        }

        next.sort((a, b) => new Date(b.lastMessageAtUtc || b.lastMessageAt).getTime() - new Date(a.lastMessageAtUtc || a.lastMessageAt).getTime());
        return next;
      });
      if (selectedThread?.id === payload.id) {
        setSelectedThread((prev) => (prev ? { ...prev, ...payload } : prev));
      }
    });

    const disposeMessage = messageRealtimeClient.onMessageReceived((payload) => {
      if (cancelled || !payload?.threadId) return;
      if (selectedThread?.id === payload.threadId) {
        setMessages((prev) => (
          prev.some((item) => item.id === payload.id) ? prev : [...prev, payload]
        ));
      }
    });

    const disposeMessageStatus = messageRealtimeClient.onMessageStatusChanged((payload) => {
      if (cancelled || !payload?.threadId || selectedThread?.id !== payload.threadId) return;
      setMessages((prev) => prev.map((item) => (
        item.id === payload.messageId
          ? { ...item, status: payload.status, isRead: payload.status === 'read', readAtUtc: payload.readAtUtc || item.readAtUtc }
          : item
      )));
    });

    const disposePresence = messageRealtimeClient.onPresenceChanged((payload) => {
      if (cancelled || !payload?.actorKey || !selectedThread) return;
      if (payload.actorKey === normalize(selectedThread.contactName)) {
        setIsContactOnline(Boolean(payload.isOnline));
      }
    });

    const disposeTyping = messageRealtimeClient.onTypingChanged((payload) => {
      if (cancelled || !payload?.threadId || selectedThread?.id !== payload.threadId) return;
      if (payload.actorKey === normalize(selectedThread.contactName)) {
        setIsContactTyping(Boolean(payload.isTyping));
      }
    });

    return () => {
      cancelled = true;
      disposeThread();
      disposeMessage();
      disposeMessageStatus();
      disposePresence();
      disposeTyping();
    };
  }, [selectedThreadId, selectedThreadName]);

  useEffect(() => {
    if (!selectedThreadId) return undefined;
    messageRealtimeClient.joinThread(selectedThreadId).catch(() => {});
    messageRealtimeClient.subscribePresence(selectedThreadName).catch(() => {});
    setThreads((prev) => prev.map((thread) => (thread.id === selectedThreadId ? { ...thread, unreadCount: 0 } : thread)));
    return () => {
      messageRealtimeClient.leaveThread(selectedThreadId).catch(() => {});
      messageRealtimeClient.unsubscribePresence(selectedThreadName).catch(() => {});
      setIsContactTyping(false);
      setIsContactOnline(false);
    };
  }, [selectedThreadId, selectedThreadName]);

  const refreshThreadsSilently = useCallback(async () => {
    try {
      const latest = await fetchThreads();
      setThreads((prev) => (sameThreadLists(prev, latest) ? prev : latest));
      setSelectedThread((prev) => {
        if (!prev) return prev;
        return latest.find((item) => item.id === prev.id) || prev;
      });
    } catch (_) {}
  }, []);

  const refreshMessagesSilently = useCallback(async (threadId) => {
    if (!threadId || messageLoading) return;
    try {
      const latest = await fetchThreadMessages(threadId);
      setMessages((prev) => (sameMessageLists(prev, latest) ? prev : latest));
    } catch (_) {}
  }, [messageLoading]);

  const loadMessages = useCallback(async (threadId) => {
    try {
      setMessageLoading(true);
      const payload = await fetchThreadMessages(threadId);
      setMessages(payload);
    } catch (err) {
      toast({
        title: 'Mesajlar alınamadı',
        description: err.message || 'Sohbet yüklenemedi.',
      });
    } finally {
      setMessageLoading(false);
    }
  }, [toast]);

  const loadChatData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [threadList, students, staff] = await Promise.all([
        fetchThreads(),
        fetchStudents().catch(() => []),
        fetchStaff().catch(() => []),
      ]);

      setThreads(threadList);

      const role = normalize(user?.backendRole || user?.role);
      const selfName = normalize(user?.name);
      const parentContacts = buildParentContacts(students);
      let nextContacts = [];

      if (role === 'student') {
        nextContacts = staff
          .filter((item) => ['teacher', 'admin', 'administrative'].includes(normalize(item.role)))
          .map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username }));
      } else if (role === 'parent') {
        const children = students
          .filter((item) => normalize(item.parentName) === selfName || normalize(item.parentEmail).includes(normalize(user?.username)));
        const teacherContacts = staff
          .filter((item) => ['teacher', 'admin', 'administrative'].includes(normalize(item.role)))
          .map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username }));
        nextContacts = [
          ...children.map((item) => ({ name: item.fullName, role: 'Student', contactKey: item.username })),
          ...teacherContacts,
        ];
      } else if (role === 'teacher') {
        nextContacts = [
          ...students.map((item) => ({ name: item.fullName, role: 'Student', contactKey: item.username })),
          ...parentContacts,
          ...staff
            .filter((item) => ['admin', 'administrative'].includes(normalize(item.role)))
            .map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username })),
        ];
      } else if (['finance', 'accounting', 'muhasebe'].includes(role)) {
        nextContacts = staff
          .filter((item) => includesAnyRole(item, ['admin', 'administrative']))
          .map((item) => ({
            name: item.fullName,
            role: includesAnyRole(item, ['admin']) ? 'Admin' : 'Administrative',
            contactKey: item.username,
          }));
      } else if (role === 'administrative') {
        nextContacts = [
          ...students.map((item) => ({ name: item.fullName, role: 'Student', contactKey: item.username })),
          ...parentContacts,
          ...staff.map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username })),
        ];
      } else if (role === 'admin') {
        nextContacts = [
          ...students.map((item) => ({ name: item.fullName, role: 'Student', contactKey: item.username })),
          ...parentContacts,
          ...staff.map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username })),
        ];
      } else {
        nextContacts = [
          ...students.map((item) => ({ name: item.fullName, role: 'Student', contactKey: item.username })),
          ...parentContacts,
          ...staff.map((item) => ({ name: item.fullName, role: item.role, contactKey: item.username })),
        ];
      }

      nextContacts = nextContacts.filter((item, index, arr) => (
        normalize(item.name) !== selfName &&
        arr.findIndex((candidate) => (
          (candidate.contactKey && item.contactKey && candidate.contactKey === item.contactKey)
            || (normalize(candidate.name) === normalize(item.name) && normalize(candidate.role) === normalize(item.role))
        )) === index
      ));
      setContacts(nextContacts);

      if (threadList.length > 0) {
        setSelectedThread(threadList[0]);
        await loadMessages(threadList[0].id);
      }
    } catch (err) {
      setError(err.message || 'Mesaj modülü yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, user]);

  useEffect(() => {
    loadChatData();
  }, [loadChatData]);

  useEffect(() => {
    threadSilentSyncRef.current && window.clearInterval(threadSilentSyncRef.current);
    threadSilentSyncRef.current = window.setInterval(() => {
      refreshThreadsSilently();
    }, 5000);
    return () => {
      threadSilentSyncRef.current && window.clearInterval(threadSilentSyncRef.current);
    };
  }, [refreshThreadsSilently]);

  useEffect(() => {
    if (!selectedThreadId) return undefined;
    messageSilentSyncRef.current && window.clearInterval(messageSilentSyncRef.current);
    messageSilentSyncRef.current = window.setInterval(() => {
      refreshMessagesSilently(selectedThreadId);
    }, 3500);
    return () => {
      messageSilentSyncRef.current && window.clearInterval(messageSilentSyncRef.current);
    };
  }, [refreshMessagesSilently, selectedThreadId]);

  const filteredThreads = useMemo(() => (
    threads
      .filter((thread) => thread.contactName.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.lastMessageAtUtc || 0) - new Date(a.lastMessageAtUtc || 0))
  ), [search, threads]);

  const chatStats = useMemo(() => ({
    total: threads.length,
    unread: threads.filter((thread) => Number(thread.unreadCount || 0) > 0).length,
    activeContacts: new Set(threads.map((thread) => thread.contactName)).size,
  }), [threads]);

  const handleSelectConversation = async (thread) => {
    setSelectedThread(thread);
    setShowMobileChat(true);
    await loadMessages(thread.id);
  };

  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || !selectedThread) return;

    const optimistic = {
      id: `temp-${Date.now()}`,
      senderName: user?.name || 'Ben',
      senderRole: user?.backendRole || user?.role || 'User',
      isFromCurrentActor: true,
      text: message.trim(),
      sentAtUtc: new Date().toISOString(),
      isRead: true,
      status: 'sent',
      attachments,
    };
    setMessages((prev) => [...prev, optimistic]);
    const text = message.trim();
    const currentAttachments = attachments;
    setMessage('');
    setAttachments([]);
    setSending(true);

    try {
      const created = await sendThreadMessage(selectedThread.id, { text, attachments: currentAttachments });
      setMessages((prev) => prev.map((item) => (
        item.id === optimistic.id
          ? { ...created, status: created.status || 'delivered' }
          : item
      )));
      setThreads((prev) => prev.map((item) => (
        item.id === selectedThread.id
          ? {
            ...item,
            lastMessagePreview: created.text || (created.attachments?.length ? 'Ek paylaşıldı' : ''),
            lastMessageAtUtc: created.sentAtUtc,
            unreadCount: 0,
            lastMessageFromMe: true,
            lastMessageStatus: created.status || 'delivered',
          }
          : item
      )));
    } catch (err) {
      setMessages((prev) => prev.map((item) => (
        item.id === optimistic.id ? { ...item, status: 'failed' } : item
      )));
      toast({
        title: 'Mesaj gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleTypingChange = (value) => {
    setMessage(value);
    if (!selectedThread) return;
    const actorName = user?.username || user?.name || 'ben';
    messageRealtimeClient.setTyping(selectedThread.id, actorName, value.trim().length > 0).catch(() => {});
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (!value.trim()) return;
    typingTimeoutRef.current = window.setTimeout(() => {
      messageRealtimeClient.setTyping(selectedThread.id, actorName, false).catch(() => {});
    }, 900);
  };

  const handlePickAttachment = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return uploadFile(formData, 'messages');
      }));
      setAttachments((prev) => [...prev, ...uploaded.map((item) => ({
        fileName: item.fileName,
        originalFileName: item.originalFileName || item.fileName,
        fileUrl: item.fileUrl,
        fileType: item.fileType,
        size: item.size,
      }))]);
    } catch (err) {
      toast({
        title: 'Dosya yüklenemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteForMe = async (msg) => {
    if (!selectedThread) return;
    try {
      await deleteThreadMessageForMe(selectedThread.id, msg.id);
      setMessages((prev) => prev.filter((item) => item.id !== msg.id));
    } catch (err) {
      toast({
        title: 'Mesaj kaldırılamadı',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenAttachment = (attachment) => {
    const href = attachment.fileUrl?.startsWith('http')
      ? attachment.fileUrl
      : `${desktopApiBaseUrl}${attachment.fileUrl || ''}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const removeAttachmentDraft = (fileName) => {
    setAttachments((prev) => prev.filter((item) => item.fileName !== fileName));
  };

  const handleCreateThread = async () => {
    if (!selectedContact) return;
    const contact = contacts.find((item) => `${item.contactKey || `${item.name}__${item.role}`}` === selectedContact);
    if (!contact) return;

    try {
      const thread = await createThread({
        contactName: contact.name,
        contactRole: contact.role,
        contactKey: contact.contactKey,
        initialMessage: initialMessage.trim() || undefined,
      });

      setThreads((prev) => [thread, ...prev.filter((item) => item.id !== thread.id)]);
      setSelectedThread(thread);
      setShowMobileChat(true);
      setCreateOpen(false);
      setSelectedContact('');
      setInitialMessage('');
      await loadMessages(thread.id);
      toast({
        title: 'Sohbet başlatıldı',
        description: `${contact.name} ile yeni konuşma oluşturuldu.`,
      });
    } catch (err) {
      toast({
        title: 'Sohbet oluşturulamadı',
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Mesajlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-[calc(100vh-8rem)]"
      data-testid="chat-page"
    >
      {error ? (
        <div className="mb-6">
          <ErrorBanner title="Mesaj modülü yüklenemedi" message={error} onRetry={loadChatData} />
        </div>
      ) : null}

      <div className="flex h-full gap-6">
        <Card className={cn('w-full md:w-80 lg:w-96 flex flex-col', showMobileChat && 'hidden md:flex')}>
          <CardHeader className="pb-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                [chatStats.total, 'Thread', MessageCircleMore],
                [chatStats.unread, 'Yeni', Clock3],
                [chatStats.activeContacts, 'Kişi', UserRound],
              ].map(([value, label, Icon]) => (
                <div key={label} className="rounded-xl border bg-muted/20 p-3 text-center">
                  <Icon className="mx-auto h-4 w-4 text-brand-primary" />
                  <p className="mt-2 text-lg font-semibold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Mesajlar</CardTitle>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90">
                    <Plus className="h-4 w-4 mr-1" />
                    Yeni
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yeni Sohbet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Select value={selectedContact} onValueChange={setSelectedContact}>
                        <SelectTrigger>
                          <SelectValue placeholder="Kişi seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem
                              key={`${contact.contactKey || contact.name}-${contact.role}`}
                              value={`${contact.contactKey || `${contact.name}__${contact.role}`}`}
                            >
                              {contact.name} • {contact.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder="İlk mesajınızı yazın"
                      value={initialMessage}
                      onChange={(event) => setInitialMessage(event.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
                    <Button onClick={handleCreateThread} disabled={!selectedContact}>Sohbet Başlat</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kişi ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {filteredThreads.map((thread) => (
                  <motion.div
                    key={thread.id}
                    whileHover={{ x: 4 }}
                    onClick={() => handleSelectConversation(thread)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                      selectedThread?.id === thread.id ? 'bg-brand-primary/10 border border-brand-primary/30' : 'hover:bg-muted'
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-brand-primary text-white">
                        {thread.contactName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{thread.contactName}</p>
                        <span className="text-xs text-muted-foreground">{formatMessageTime(thread.lastMessageAtUtc)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {thread.lastMessageFromMe ? renderStatusIcon(thread.lastMessageStatus) : null}
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lastMessagePreview || 'Henüz mesaj yok'}
                        </p>
                      </div>
                    </div>
                    {thread.unreadCount > 0 ? (
                      <Badge className="bg-brand-accent">{thread.unreadCount}</Badge>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className={cn('flex-1 flex flex-col', !showMobileChat && 'hidden md:flex')}>
          {selectedThread ? (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowMobileChat(false)}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-brand-primary text-white">
                        {selectedThread.contactName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedThread.contactName}</p>
                      <p className="text-xs text-muted-foreground">
                        {isContactTyping ? 'Yazıyor...' : isContactOnline ? 'Çevrimiçi' : selectedThread.contactRole}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleHeaderAction('call')}><Phone className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleHeaderAction('video')}><Video className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDetailOpen(true)}><MoreVertical className="h-5 w-5" /></Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {messageLoading ? (
                      <div className="py-8 flex justify-center"><LoadingDots /></div>
                    ) : (
                      messages.map((msg) => {
                        const isMine = Boolean(msg.isFromCurrentActor) || normalize(msg.senderName) === normalize(user?.name);
                        return (
                          <motion.div
                            key={msg.id}
                            variants={messageVariants}
                            initial="hidden"
                            animate="visible"
                            className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                          >
                            <div className={cn('max-w-[74%] rounded-2xl px-4 py-2 shadow-sm', isMine ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-muted rounded-bl-sm')}>
                              <p className="text-sm">{msg.text}</p>
                              {Array.isArray(msg.attachments) && msg.attachments.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {msg.attachments.map((attachment) => {
                                    const isImage = attachment.fileType === 'image';
                                    return (
                                      <button
                                        key={`${msg.id}-${attachment.fileName}`}
                                        type="button"
                                        onClick={() => handleOpenAttachment(attachment)}
                                        className={cn(
                                          'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm',
                                          isMine ? 'border-white/20 bg-white/10' : 'border-border bg-background/80'
                                        )}
                                      >
                                        {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                        <span className="flex-1 truncate">{attachment.originalFileName || attachment.fileName}</span>
                                        <Download className="h-4 w-4" />
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                              <div className={cn('flex items-center gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
                                <span className={cn('text-xs', isMine ? 'text-white/70' : 'text-muted-foreground')}>
                                  {formatMessageTime(msg.sentAtUtc)}
                                </span>
                                {isMine ? renderStatusIcon((msg.status === 'read' || msg.isRead) ? 'read' : msg.status) : null}
                                {isMine && !String(msg.id).startsWith('temp-') ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn('h-5 w-5 ml-1', isMine ? 'text-white/70 hover:text-white' : 'text-muted-foreground')}
                                    onClick={() => handleDeleteForMe(msg)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="border-t p-4">
                {attachments.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.fileName} className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs">
                        {attachment.fileType === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-bold">{attachmentDraftTag(attachment)}</span>
                        <span className="max-w-36 truncate">{attachmentDraftLabel(attachment)}</span>
                        <button type="button" onClick={() => removeAttachmentDraft(attachment.fileName)} className="text-muted-foreground hover:text-foreground">x</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handlePickAttachment}
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.mov"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Mesajınızı yazın..."
                    value={message}
                    onChange={(e) => handleTypingChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    className="flex-1"
                  />
                  <Button
                    className="bg-brand-primary hover:bg-brand-primary/90"
                    size="icon"
                    onClick={handleSend}
                    disabled={sending || (!message.trim() && attachments.length === 0)}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Mesajlarınız</h3>
                <p className="text-muted-foreground">Sohbet başlatmak için bir kişi seçin</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedThread?.contactName || 'Sohbet detayı'}</DialogTitle>
          </DialogHeader>
          {selectedThread ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Rol</p>
                    <p className="mt-1 font-semibold">{selectedThread.contactRole}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Son Mesaj</p>
                    <p className="mt-1 font-semibold">{formatMessageTime(selectedThread.lastMessageAtUtc) || 'Yok'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Okunmayan</p>
                    <p className="mt-1 font-semibold">{selectedThread.unreadCount || 0}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedThread.lastMessagePreview || 'Bu sohbet için henüz mesaj önizlemesi yok.'}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetailOpen(false); handleHeaderAction('call'); }}>Görüşme Planla</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDetailOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
