import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Video, Clock, Calendar, Users, Play, ExternalLink,
  Mic, MicOff, VideoIcon, VideoOff, MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockOngoingLessons = [
  {
    id: 1,
    subject: 'Matematik',
    teacher: 'Dr. Hasan Yıldız',
    teacherAvatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop',
    startTime: '09:25',
    duration: 45,
    participants: 26,
    status: 'live',
    meetLink: '#',
  },
];

const mockUpcomingLessons = [
  {
    id: 2,
    subject: 'Fizik',
    teacher: 'Aylin Güneş',
    teacherAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop',
    startTime: '10:20',
    duration: 45,
    date: '2025-01-06',
    meetLink: '#',
  },
  {
    id: 3,
    subject: 'Türkçe',
    teacher: 'Kemal Eren',
    teacherAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    startTime: '11:15',
    duration: 45,
    date: '2025-01-06',
    meetLink: '#',
  },
];

const mockPastLessons = [
  {
    id: 4,
    subject: 'Matematik',
    teacher: 'Dr. Hasan Yıldız',
    date: '2025-01-05',
    time: '09:25',
    duration: 45,
    recordingAvailable: true,
  },
  {
    id: 5,
    subject: 'Kimya',
    teacher: 'Osman Akça',
    date: '2025-01-04',
    time: '11:15',
    duration: 45,
    recordingAvailable: true,
  },
  {
    id: 6,
    subject: 'Fizik',
    teacher: 'Aylin Güneş',
    date: '2025-01-03',
    time: '10:20',
    duration: 45,
    recordingAvailable: false,
  },
];

export default function StudentLive() {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-live-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Canlı Dersler</h1>
        <p className="text-muted-foreground mt-1">Online derslere katıl</p>
      </div>

      {/* Live Now */}
      {mockOngoingLessons.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-2 border-green-500 bg-green-50/50 dark:bg-green-900/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                <CardTitle className="text-green-700 dark:text-green-400">Şu An Canlı</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {mockOngoingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-card border">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={lesson.teacherAvatar} />
                      <AvatarFallback>{lesson.teacher.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold">{lesson.subject}</h3>
                      <p className="text-muted-foreground">{lesson.teacher}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {lesson.startTime} - {lesson.duration} dk
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {lesson.participants} katılımcı
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMicOn(!micOn)}
                        className={!micOn ? 'text-red-500' : ''}
                      >
                        {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setVideoOn(!videoOn)}
                        className={!videoOn ? 'text-red-500' : ''}
                      >
                        {videoOn ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Play className="h-4 w-4 mr-2" />
                      Katıl
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-accent" />
                Bugün Yaklaşan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockUpcomingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-accent/30 transition-all">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={lesson.teacherAvatar} />
                      <AvatarFallback>{lesson.teacher.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">{lesson.subject}</h4>
                      <p className="text-sm text-muted-foreground">{lesson.teacher}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{lesson.startTime}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{lesson.duration} dk</p>
                  </div>
                </div>
              ))}
              {mockUpcomingLessons.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Bugün yaklaşan canlı ders yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Past Lessons with Recordings */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-brand-primary" />
                Ders Kayıtları
              </CardTitle>
              <CardDescription>Geçmiş derslerin kayıtları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockPastLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-primary/30 transition-all">
                  <div>
                    <h4 className="font-semibold">{lesson.subject}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.teacher}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(lesson.date).toLocaleDateString('tr-TR')}
                      <Clock className="h-3 w-3 ml-2" />
                      {lesson.time}
                    </div>
                  </div>
                  {lesson.recordingAvailable ? (
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      İzle
                    </Button>
                  ) : (
                    <Badge variant="secondary">Kayıt Yok</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Help Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-brand-primary/5 border-brand-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Canlı Ders Kuralları</h3>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Derse zamanında katılın</li>
                  <li>• Mikrofonunuzu kapalı tutun, söz almak istediğinizde açın</li>
                  <li>• Soru sormak için sohbet bölümünü kullanın</li>
                  <li>• Dersi kaydetmeniz yasaktır</li>
                </ul>
              </div>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Destek
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
