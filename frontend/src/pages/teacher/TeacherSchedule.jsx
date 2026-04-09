import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Video, Plus, ChevronLeft, ChevronRight, 
  MapPin, BookOpen, MoreVertical 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const weekDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const timeSlots = ['08:30', '09:25', '10:20', '11:15', '12:10', '13:30', '14:25', '15:20', '16:15'];

const mockSchedule = {
  'Pazartesi': [
    { time: '08:30', subject: 'Matematik 10-A', room: 'A-101', duration: 45, type: 'lesson' },
    { time: '10:20', subject: 'Matematik 11-B', room: 'A-102', duration: 45, type: 'lesson' },
    { time: '14:25', subject: 'Etüt 10-A', room: 'Lab-1', duration: 45, type: 'study' },
  ],
  'Salı': [
    { time: '09:25', subject: 'Matematik 9-C', room: 'B-201', duration: 45, type: 'lesson' },
    { time: '11:15', subject: 'Canlı Ders', room: 'Online', duration: 45, type: 'online' },
    { time: '15:20', subject: 'Matematik 10-B', room: 'A-101', duration: 45, type: 'lesson' },
  ],
  'Çarşamba': [
    { time: '08:30', subject: 'Matematik 11-A', room: 'A-103', duration: 45, type: 'lesson' },
    { time: '10:20', subject: 'Soru Çözümü', room: 'A-101', duration: 45, type: 'study' },
  ],
  'Perşembe': [
    { time: '08:30', subject: 'Matematik 10-A', room: 'A-101', duration: 45, type: 'lesson' },
    { time: '09:25', subject: 'Matematik 9-B', room: 'B-102', duration: 45, type: 'lesson' },
    { time: '13:30', subject: 'Canlı Ders 11', room: 'Online', duration: 90, type: 'online' },
  ],
  'Cuma': [
    { time: '08:30', subject: 'Deneme Sınavı', room: 'Salon-1', duration: 180, type: 'exam' },
    { time: '14:25', subject: 'Matematik 10-C', room: 'A-101', duration: 45, type: 'lesson' },
  ],
};

const getTypeStyles = (type) => {
  switch (type) {
    case 'lesson':
      return 'bg-brand-primary/90 border-brand-primary';
    case 'online':
      return 'bg-blue-600/90 border-blue-600';
    case 'study':
      return 'bg-green-600/90 border-green-600';
    case 'exam':
      return 'bg-brand-accent/90 border-brand-accent';
    default:
      return 'bg-gray-500/90 border-gray-500';
  }
};

export default function TeacherSchedule() {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const getWeekRange = () => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - start.getDay() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    return `${start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-schedule-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ders Programı</h1>
          <p className="text-muted-foreground mt-1">Haftalık ders programınız</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => {
            const prev = new Date(currentWeek);
            prev.setDate(prev.getDate() - 7);
            setCurrentWeek(prev);
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">{getWeekRange()}</span>
          <Button variant="outline" size="icon" onClick={() => {
            const next = new Date(currentWeek);
            next.setDate(next.getDate() + 7);
            setCurrentWeek(next);
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Today's Summary */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-brand-primary to-brand-primary/80 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Bugün</p>
                <h2 className="text-2xl font-bold mt-1">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold">5</p>
                  <p className="text-white/70 text-sm">Toplam Ders</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">2</p>
                  <p className="text-white/70 text-sm">Online</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">120</p>
                  <p className="text-white/70 text-sm">Öğrenci</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly Calendar Grid */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header Row */}
              <div className="grid grid-cols-7 border-b">
                <div className="p-4 font-medium text-muted-foreground border-r bg-muted/30">Saat</div>
                {weekDays.map((day, idx) => (
                  <div key={day} className={`p-4 font-semibold text-center ${idx < 5 ? 'border-r' : ''} bg-muted/30`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {timeSlots.map((time) => (
                <div key={time} className="grid grid-cols-7 border-b last:border-b-0 min-h-[80px]">
                  <div className="p-3 font-medium text-muted-foreground border-r flex items-center justify-center bg-muted/10">
                    {time}
                  </div>
                  {weekDays.map((day, idx) => {
                    const lesson = mockSchedule[day]?.find(l => l.time === time);
                    return (
                      <div key={`${day}-${time}`} className={`p-2 ${idx < 5 ? 'border-r' : ''} relative`}>
                        {lesson && (
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className={`p-2 rounded-lg text-white ${getTypeStyles(lesson.type)} cursor-pointer h-full`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{lesson.subject}</p>
                                <div className="flex items-center gap-1 mt-1 text-xs text-white/80">
                                  <MapPin className="h-3 w-3" />
                                  {lesson.room}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Yoklama Al</DropdownMenuItem>
                                  <DropdownMenuItem>Canlı Ders Başlat</DropdownMenuItem>
                                  <DropdownMenuItem>Detaylar</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {lesson.type === 'online' && (
                              <Badge className="mt-2 bg-white/20 text-white text-xs">
                                <Video className="h-3 w-3 mr-1" /> Online
                              </Badge>
                            )}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Legend */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-primary"></div>
          <span className="text-sm">Ders</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-600"></div>
          <span className="text-sm">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600"></div>
          <span className="text-sm">Etüt/Çalışma</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-brand-accent"></div>
          <span className="text-sm">Sınav</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
