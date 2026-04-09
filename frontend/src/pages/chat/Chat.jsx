import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Send, Paperclip, MoreVertical, Phone, Video,
  Check, CheckCheck, Image, File, Smile, ChevronLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockConversations = [
  { 
    id: 1, 
    name: 'Dr. Hasan Yıldız', 
    role: 'Matematik Öğretmeni',
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop',
    lastMessage: 'Türev konusunu anlayamadım...',
    time: '10:30',
    unread: 2,
    online: true
  },
  { 
    id: 2, 
    name: 'Aylin Güneş', 
    role: 'Fizik Öğretmeni',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop',
    lastMessage: 'Newton kanunları için ek kaynak...',
    time: 'Dün',
    unread: 0,
    online: false
  },
  { 
    id: 3, 
    name: 'Osman Akça', 
    role: 'Kimya Öğretmeni',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop',
    lastMessage: 'Periyodik tablo sorusu için teşekkürler',
    time: 'Dün',
    unread: 0,
    online: true
  },
  { 
    id: 4, 
    name: 'Kurum Yönetimi', 
    role: 'Yönetim',
    avatar: null,
    lastMessage: 'Yarıyıl tatili duyurusu',
    time: '2 gün',
    unread: 1,
    online: false
  },
];

const mockMessages = [
  { id: 1, senderId: 'other', text: 'Merhaba, türev konusunda yardıma ihtiyacım var.', time: '10:15', status: 'read' },
  { id: 2, senderId: 'me', text: 'Tabii ki, hangi konuda takıldın?', time: '10:18', status: 'read' },
  { id: 3, senderId: 'other', text: 'Zincir kuralını uygularken karıştırıyorum. Özellikle iç fonksiyon ve dış fonksiyonu ayırt etmekte zorlanıyorum.', time: '10:20', status: 'read' },
  { id: 4, senderId: 'me', text: 'Anladım. Önce basit bir örnekle başlayalım. f(x) = (2x+1)³ fonksiyonunu ele alalım.', time: '10:22', status: 'read' },
  { id: 5, senderId: 'me', text: 'Burada iç fonksiyon u = 2x+1, dış fonksiyon ise u³. Zincir kuralına göre: f\'(x) = 3u² × u\' = 3(2x+1)² × 2 = 6(2x+1)²', time: '10:24', status: 'read' },
  { id: 6, senderId: 'other', text: 'Şimdi daha iyi anladım! Bir soru daha sorabilir miyim?', time: '10:28', status: 'delivered' },
];

export default function Chat() {
  const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const [search, setSearch] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      senderId: 'me',
      text: message,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    // Simulate typing indicator
    setTimeout(() => setIsTyping(true), 500);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        senderId: 'other',
        text: 'Mesajınız alındı, en kısa sürede yanıtlayacağım.',
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered'
      }]);
    }, 2000);
  };

  const filteredConversations = mockConversations.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-[calc(100vh-8rem)]"
      data-testid="chat-page"
    >
      <div className="flex h-full gap-6">
        {/* Conversations List */}
        <Card className={cn(
          "w-full md:w-80 lg:w-96 flex flex-col",
          showMobileChat && "hidden md:flex"
        )}>
          <CardHeader className="pb-3">
            <CardTitle>Mesajlar</CardTitle>
            <div className="relative mt-2">
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
                {filteredConversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    whileHover={{ x: 4 }}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedConversation?.id === conv.id 
                        ? "bg-brand-primary/10 border border-brand-primary/30" 
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.avatar} alt={conv.name} />
                        <AvatarFallback className="bg-brand-primary text-white">
                          {conv.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {conv.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.name}</p>
                        <span className="text-xs text-muted-foreground">{conv.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.unread > 0 && (
                      <Badge className="bg-brand-accent">{conv.unread}</Badge>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className={cn(
          "flex-1 flex flex-col",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="md:hidden"
                      onClick={() => setShowMobileChat(false)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.name} />
                        <AvatarFallback className="bg-brand-primary text-white">
                          {selectedConversation.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {selectedConversation.online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{selectedConversation.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.online ? 'Çevrimiçi' : 'Son görülme: bugün'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Video className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    <AnimatePresence>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          className={cn(
                            "flex",
                            msg.senderId === 'me' ? "justify-end" : "justify-start"
                          )}
                        >
                          <div className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            msg.senderId === 'me' 
                              ? "bg-brand-primary text-white rounded-br-sm" 
                              : "bg-muted rounded-bl-sm"
                          )}>
                            <p className="text-sm">{msg.text}</p>
                            <div className={cn(
                              "flex items-center gap-1 mt-1",
                              msg.senderId === 'me' ? "justify-end" : "justify-start"
                            )}>
                              <span className={cn(
                                "text-xs",
                                msg.senderId === 'me' ? "text-white/70" : "text-muted-foreground"
                              )}>
                                {msg.time}
                              </span>
                              {msg.senderId === 'me' && (
                                msg.status === 'read' ? (
                                  <CheckCheck className="h-3 w-3 text-white/70" />
                                ) : (
                                  <Check className="h-3 w-3 text-white/70" />
                                )
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Typing Indicator */}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Image className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Mesajınızı yazın..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon">
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button 
                    className="bg-brand-primary hover:bg-brand-primary/90"
                    size="icon"
                    onClick={handleSend}
                    disabled={!message.trim()}
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
    </motion.div>
  );
}
