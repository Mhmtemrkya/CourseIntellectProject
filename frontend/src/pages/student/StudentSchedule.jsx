import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, User, Video, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const hours = ['08:30', '09:25', '10:20', '11:15', '13:00', '13:55', '14:50'];

const mockSchedule = {
  'Pazartesi': [
    { hour: '08:30', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', type: 'normal' },
    { hour: '09:25', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1', type: 'lab' },
    { hour: '10:20', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101', type: 'normal' },
    { hour: '11:15', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2', type: 'lab' },
    { hour: '13:00', subject: 'İngilizce', teacher: 'Sarah Johnson', room: 'B-102', type: 'normal' },
  ],
  'Salı': [
    { hour: '08:30', subject: 'Biyoloji', teacher: 'Serpil Aydın', room: 'Lab-3', type: 'lab' },
    { hour: '09:25', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', type: 'normal' },
    { hour: '10:20', subject: 'Tarih', teacher: 'Ahmet Kara', room: 'A-103', type: 'normal' },
    { hour: '11:15', subject: 'Coğrafya', teacher: 'Zeynep Yıldırım', room: 'A-104', type: 'normal' },
    { hour: '13:00', subject: 'Beden Eğitimi', teacher: 'Murat Demir', room: 'Spor Salonu', type: 'sport' },
  ],
  'Çarşamba': [
    { hour: '08:30', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1', type: 'lab' },
    { hour: '09:25', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101', type: 'normal' },
    { hour: '10:20', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', type: 'normal' },
    { hour: '13:00', subject: 'Müzik', teacher: 'Ece Tunç', room: 'Müzik Odası', type: 'art' },
    { hour: '13:55', subject: 'Resim', teacher: 'Can Yılmaz', room: 'Resim Atölyesi', type: 'art' },
  ],
  'Perşembe': [
    { hour: '08:30', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2', type: 'lab' },
    { hour: '09:25', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', type: 'normal' },
    { hour: '10:20', subject: 'İngilizce', teacher: 'Sarah Johnson', room: 'B-102', type: 'normal' },
    { hour: '11:15', subject: 'Felsefe', teacher: 'Prof. Mehmet Öz', room: 'A-105', type: 'normal' },
    { hour: '13:00', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'A-101', type: 'normal' },
  ],
  'Cuma': [
    { hour: '08:30', subject: 'Biyoloji', teacher: 'Serpil Aydın', room: 'Lab-3', type: 'lab' },
    { hour: '09:25', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1', type: 'lab' },
    { hour: '10:20', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101', type: 'normal' },
    { hour: '11:15', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', type: 'normal' },
  ],
};

const typeColors = {
  normal: 'bg-brand-primary/10 border-brand-primary/30 hover:bg-brand-primary/20',
  lab: 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800',
  sport: 'bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800',
  art: 'bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-800',
};

export default function StudentSchedule() {
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long' });
  const todayIndex = days.findIndex(d => d === today);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-schedule-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ders Programım</h1>
          <p className="text-muted-foreground mt-1">Haftalık ders programınız</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-brand-primary border-brand-primary">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Badge>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-primary/30"></div>
          <span className="text-sm">Normal Ders</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-300"></div>
          <span className="text-sm">Laboratuvar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-300"></div>
          <span className="text-sm">Spor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-300"></div>
          <span className="text-sm">Sanat</span>
        </div>
      </div>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-6 border-b">
              <div className="p-4 font-semibold text-center bg-muted">Saat</div>
              {days.map((day, idx) => (
                <div 
                  key={day} 
                  className={`p-4 font-semibold text-center ${idx === todayIndex ? 'bg-brand-primary/10 text-brand-primary' : 'bg-muted'}`}
                >
                  {day}
                  {idx === todayIndex && (
                    <Badge className="ml-2 bg-brand-accent text-xs">Bugün</Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Body */}
            {hours.map((hour) => (
              <motion.div 
                key={hour} 
                variants={itemVariants}
                className="grid grid-cols-6 border-b last:border-0"
              >
                <div className="p-4 text-center font-medium text-muted-foreground border-r flex items-center justify-center">
                  <Clock className="h-4 w-4 mr-2" />
                  {hour}
                </div>
                {days.map((day, idx) => {
                  const lesson = mockSchedule[day]?.find(l => l.hour === hour);
                  return (
                    <div 
                      key={`${day}-${hour}`} 
                      className={`p-2 ${idx === todayIndex ? 'bg-brand-primary/5' : ''}`}
                    >
                      {lesson ? (
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${typeColors[lesson.type]}`}
                        >
                          <p className="font-semibold text-sm">{lesson.subject}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="truncate">{lesson.teacher}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{lesson.room}</span>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="h-full min-h-[80px]"></div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Today's Live Lessons */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-brand-accent" />
              Bugünkü Canlı Dersler
            </CardTitle>
            <CardDescription>Katılabileceğiniz canlı dersler</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockSchedule[days[todayIndex]]?.slice(0, 3).map((lesson, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border hover:border-brand-accent/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">{lesson.hour}</Badge>
                    <Badge className="bg-green-100 text-green-700">Canlı</Badge>
                  </div>
                  <h4 className="font-semibold">{lesson.subject}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{lesson.teacher}</p>
                  <Button className="w-full mt-3 bg-brand-accent hover:bg-brand-accent/90" size="sm">
                    <Video className="h-4 w-4 mr-2" />
                    Derse Katıl
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
