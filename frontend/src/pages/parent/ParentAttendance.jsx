import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, Calendar, AlertCircle, CheckCircle, Clock,
  ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockChildren = [
  { id: 1, name: 'Ali Yılmaz', class: '10-A', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { id: 2, name: 'Ayşe Yılmaz', class: '8-B', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
];

const mockAttendance = {
  summary: {
    totalDays: 50,
    present: 46,
    absent: 3,
    excused: 1,
    rate: 92
  },
  monthly: [
    { month: 'Eylül', present: 18, absent: 2, excused: 0 },
    { month: 'Ekim', present: 20, absent: 1, excused: 0 },
    { month: 'Kasım', present: 8, absent: 0, excused: 1 },
  ],
  recentAbsences: [
    { date: '2025-01-03', reason: 'Hastalık', excused: true },
    { date: '2024-12-20', reason: 'İzinsiz', excused: false },
    { date: '2024-12-15', reason: 'İzinsiz', excused: false },
    { date: '2024-11-28', reason: 'Doktor Raporu', excused: true },
  ],
  calendar: {
    '2025-01-02': 'present',
    '2025-01-03': 'absent',
    '2025-01-06': 'present',
    '2025-01-07': 'present',
    '2025-01-08': 'present',
    '2025-01-09': 'present',
    '2025-01-10': 'present',
  }
};

export default function ParentAttendance() {
  const [selectedChild, setSelectedChild] = useState(mockChildren[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay: firstDay === 0 ? 7 : firstDay };
  };

  const { days, firstDay } = getDaysInMonth(currentMonth);
  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700 dark:bg-green-900/30';
      case 'absent': return 'bg-red-100 text-red-700 dark:bg-red-900/30';
      case 'excused': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30';
      default: return 'bg-muted';
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="parent-attendance-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Devamsızlık Takibi</h1>
          <p className="text-muted-foreground mt-1">Çocuğunuzun devam durumu</p>
        </div>
        
        {mockChildren.length > 1 && (
          <Select 
            value={selectedChild.id.toString()} 
            onValueChange={(v) => setSelectedChild(mockChildren.find(c => c.id === parseInt(v)))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockChildren.map((child) => (
                <SelectItem key={child.id} value={child.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={child.avatar} />
                      <AvatarFallback>{child.name[0]}</AvatarFallback>
                    </Avatar>
                    {child.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devam Oranı</p>
                  <p className="text-2xl font-bold text-green-600">{mockAttendance.summary.rate}%</p>
                </div>
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Katılım</p>
                  <p className="text-2xl font-bold">{mockAttendance.summary.present}</p>
                </div>
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <ClipboardCheck className="h-5 w-5 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devamsız</p>
                  <p className="text-2xl font-bold text-red-600">{mockAttendance.summary.absent}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">İzinli</p>
                  <p className="text-2xl font-bold text-yellow-600">{mockAttendance.summary.excused}</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Devam Takvimi</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[120px] text-center">
                  {currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: firstDay - 1 }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const status = mockAttendance.calendar[dateStr];
                  const isWeekend = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).getDay() % 6 === 0;
                  
                  return (
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm ${
                        isWeekend ? 'bg-muted/50 text-muted-foreground' : status ? getStatusColor(status) : 'hover:bg-muted'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100"></div>
                  <span className="text-sm">Katıldı</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100"></div>
                  <span className="text-sm">Devamsız</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-100"></div>
                  <span className="text-sm">İzinli</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Absences */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Son Devamsızlıklar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAttendance.recentAbsences.map((absence, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {new Date(absence.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-xs text-muted-foreground">{absence.reason}</p>
                  </div>
                  <Badge className={absence.excused ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                    {absence.excused ? 'İzinli' : 'İzinsiz'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Progress */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Aylık Devam Durumu</CardTitle>
            <CardDescription>Son 3 ayın devam istatistikleri</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockAttendance.monthly.map((month, idx) => {
                const total = month.present + month.absent + month.excused;
                const rate = Math.round((month.present / total) * 100);
                return (
                  <div key={idx}>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{month.month}</span>
                      <span className="text-sm text-muted-foreground">
                        {month.present} katılım / {total} gün ({rate}%)
                      </span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${(month.present / total) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${(month.absent / total) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-yellow-500" 
                        style={{ width: `${(month.excused / total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
