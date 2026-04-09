import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  X, 
  Clock, 
  FileText,
  Save,
  CheckCheck
} from 'lucide-react';
import { mockStudents, mockClasses, mockTodayLessons } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { useToast } from '../hooks/use-toast';

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

const statusOptions = [
  { value: 'present', label: 'Var', icon: Check, color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'absent', label: 'Yok', icon: X, color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
  { value: 'late', label: 'Geç', icon: Clock, color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'excused', label: 'İzinli', icon: FileText, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
];

export default function Attendance() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState('10-A');
  const [selectedLesson, setSelectedLesson] = useState(mockTodayLessons[0]);
  const [attendance, setAttendance] = useState(() => {
    const initial = {};
    mockStudents.forEach(s => {
      initial[s.id] = 'present';
    });
    return initial;
  });

  const classStudents = mockStudents.filter(s => s.class === selectedClass);

  const setStatus = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const setAllPresent = () => {
    const newAttendance = {};
    classStudents.forEach(s => {
      newAttendance[s.id] = 'present';
    });
    setAttendance(prev => ({
      ...prev,
      ...newAttendance
    }));
    toast({
      title: "Tümü Var olarak işaretlendi",
      description: `${classStudents.length} öğrenci var olarak işaretlendi.`,
    });
  };

  const saveAttendance = () => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0
    };
    classStudents.forEach(s => {
      counts[attendance[s.id]]++;
    });

    toast({
      title: "Yoklama kaydedildi",
      description: `${selectedClass} - ${selectedLesson?.subject || 'Ders'}: ${counts.present} var, ${counts.absent} yok, ${counts.late} geç, ${counts.excused} izinli`,
    });
  };

  const getStatusCounts = () => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    classStudents.forEach(s => {
      counts[attendance[s.id]]++;
    });
    return counts;
  };

  const counts = getStatusCounts();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="attendance-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Yoklama</h1>
          <p className="text-muted-foreground mt-1">Günlük yoklama kayıtları</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={setAllPresent}
            data-testid="mark-all-present"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Hepsini Var İşaretle
          </Button>
          <Button 
            className="bg-brand-primary hover:bg-brand-primary/90"
            onClick={saveAttendance}
            data-testid="save-attendance"
          >
            <Save className="h-4 w-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Sınıf</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Sınıf seçin" />
                </SelectTrigger>
                <SelectContent>
                  {mockClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ders</label>
              <Select 
                value={selectedLesson?.subject} 
                onValueChange={(value) => setSelectedLesson(mockTodayLessons.find(l => l.subject === value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ders seçin" />
                </SelectTrigger>
                <SelectContent>
                  {mockTodayLessons.map((lesson, index) => (
                    <SelectItem key={index} value={lesson.subject}>
                      {lesson.time} - {lesson.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusOptions.map((status) => {
          const Icon = status.icon;
          return (
            <motion.div key={status.value} variants={itemVariants}>
              <Card className={`border-l-4 ${status.color.split(' ')[2]}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${status.color.split(' ').slice(0, 2).join(' ')}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{counts[status.value]}</p>
                    <p className="text-xs text-muted-foreground">{status.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle>{selectedClass} Sınıfı Öğrencileri</CardTitle>
          <CardDescription>{classStudents.length} öğrenci</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {classStudents.map((student) => (
              <motion.div
                key={student.id}
                variants={itemVariants}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                data-testid={`student-attendance-${student.id}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar} alt={student.name} />
                    <AvatarFallback className="bg-brand-primary text-white">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {statusOptions.map((status) => {
                    const Icon = status.icon;
                    const isSelected = attendance[student.id] === status.value;
                    return (
                      <motion.button
                        key={status.value}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setStatus(student.id, status.value)}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? status.color 
                            : 'border-transparent bg-muted hover:bg-muted/80'
                        }`}
                        title={status.label}
                      >
                        <Icon className="h-5 w-5" />
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
