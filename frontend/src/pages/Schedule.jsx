import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  MapPin,
  User,
  Filter
} from 'lucide-react';
import { mockSchedule, mockClasses } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const timeSlots = [
  '08:30-09:15',
  '09:25-10:10',
  '10:20-11:05',
  '11:15-12:00',
  '13:00-13:45',
  '13:55-14:40',
  '14:50-15:35',
];

const subjectColors = {
  'Matematik': 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
  'Fizik': 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300',
  'Kimya': 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
  'Biyoloji': 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
  'Türkçe': 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
};

function LessonBlock({ lesson }) {
  const colorClass = subjectColors[lesson.subject] || 'bg-muted border-border';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className={`p-2 rounded-lg border cursor-pointer transition-all ${colorClass}`}
          >
            <p className="font-medium text-sm truncate">{lesson.subject}</p>
            <p className="text-xs opacity-70 truncate">{lesson.teacher.split(' ').slice(-1)[0]}</p>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{lesson.subject}</p>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3 w-3" />
              <span>{lesson.teacher}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-3 w-3" />
              <span>{lesson.room}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3 w-3" />
              <span>{lesson.time}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Schedule() {
  const [selectedClass, setSelectedClass] = useState('10-A');
  const [currentWeek, setCurrentWeek] = useState(0);

  const filteredSchedule = mockSchedule.filter(s => s.class === selectedClass);

  const getLesson = (day, time) => {
    return filteredSchedule.find(s => s.day === day && s.time === time);
  };

  const weekDates = days.map((day, index) => {
    const date = new Date();
    const diff = date.getDay() - 1 - index + (currentWeek * 7);
    date.setDate(date.getDate() - diff);
    return date.getDate();
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="schedule-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ders Programı</h1>
          <p className="text-muted-foreground mt-1">Haftalık ders programı görünümü</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          data-testid="add-lesson-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ders Ekle
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentWeek(currentWeek - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="font-semibold">
                  {currentWeek === 0 ? 'Bu Hafta' : currentWeek > 0 ? `${currentWeek} Hafta Sonra` : `${Math.abs(currentWeek)} Hafta Önce`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {weekDates[0]} - {weekDates[4]} Ocak 2025
                </p>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentWeek(currentWeek + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {currentWeek !== 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentWeek(0)}
                >
                  Bugün
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sınıf" />
                </SelectTrigger>
                <SelectContent>
                  {mockClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header Row */}
            <div className="grid grid-cols-6 border-b">
              <div className="p-4 bg-muted/50 border-r">
                <p className="font-semibold text-sm">Saat</p>
              </div>
              {days.map((day, index) => (
                <div key={day} className="p-4 text-center bg-muted/50 border-r last:border-r-0">
                  <p className="font-semibold">{day}</p>
                  <p className="text-sm text-muted-foreground">{weekDates[index]}</p>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-6 border-b last:border-b-0">
                <div className="p-4 bg-muted/30 border-r flex items-center">
                  <div className="text-sm">
                    <p className="font-medium">{time.split('-')[0]}</p>
                    <p className="text-muted-foreground">{time.split('-')[1]}</p>
                  </div>
                </div>
                {days.map((day) => {
                  const lesson = getLesson(day, time);
                  return (
                    <div key={`${day}-${time}`} className="p-2 border-r last:border-r-0 min-h-[80px]">
                      {lesson && <LessonBlock lesson={lesson} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ders Renkleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(subjectColors).map(([subject, colorClass]) => (
              <div key={subject} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${colorClass}`} />
                <span className="text-sm">{subject}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
