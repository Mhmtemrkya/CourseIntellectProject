import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, Users, Save, Calendar, CheckCircle, XCircle, 
  Clock, AlertCircle, Search, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockClasses = [
  { id: '10-a', name: 'Matematik 10-A', time: '08:30', room: 'A-101', studentCount: 28 },
  { id: '11-b', name: 'Matematik 11-B', time: '10:20', room: 'A-102', studentCount: 25 },
  { id: '9-c', name: 'Matematik 9-C', time: '14:25', room: 'B-201', studentCount: 30 },
];

const mockStudents = [
  { id: 1, name: 'Ali Yılmaz', no: '101', avatar: null, status: 'present' },
  { id: 2, name: 'Ayşe Demir', no: '102', avatar: null, status: 'present' },
  { id: 3, name: 'Mehmet Kaya', no: '103', avatar: null, status: 'absent' },
  { id: 4, name: 'Zeynep Öztürk', no: '104', avatar: null, status: 'present' },
  { id: 5, name: 'Mustafa Şahin', no: '105', avatar: null, status: 'late' },
  { id: 6, name: 'Elif Aksoy', no: '106', avatar: null, status: 'present' },
  { id: 7, name: 'Burak Yıldırım', no: '107', avatar: null, status: 'excused' },
  { id: 8, name: 'Selin Arslan', no: '108', avatar: null, status: 'present' },
  { id: 9, name: 'Emre Çelik', no: '109', avatar: null, status: 'present' },
  { id: 10, name: 'Deniz Koç', no: '110', avatar: null, status: 'present' },
];

const statusConfig = {
  present: { label: 'Geldi', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  absent: { label: 'Gelmedi', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  late: { label: 'Geç', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  excused: { label: 'İzinli', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: AlertCircle },
};

export default function TeacherAttendance() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState(mockClasses[0]);
  const [students, setStudents] = useState(mockStudents);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.no.includes(searchQuery)
  );

  const updateStatus = (studentId, newStatus) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, status: newStatus } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    toast({
      title: "Yoklama Kaydedildi",
      description: `${selectedClass.name} için yoklama başarıyla kaydedildi.`,
    });
  };

  const stats = {
    present: students.filter(s => s.status === 'present').length,
    absent: students.filter(s => s.status === 'absent').length,
    late: students.filter(s => s.status === 'late').length,
    excused: students.filter(s => s.status === 'excused').length,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-attendance-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Yoklama</h1>
          <p className="text-muted-foreground mt-1">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {saving ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Kaydet
        </Button>
      </div>

      {/* Class Selection */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ders Seçimi</CardTitle>
            <CardDescription>Yoklama alınacak dersi seçin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mockClasses.map((cls) => (
                <motion.div
                  key={cls.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedClass(cls)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedClass.id === cls.id 
                      ? 'border-brand-primary bg-brand-primary/5' 
                      : 'border-border hover:border-brand-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">{cls.time} • {cls.room}</p>
                    </div>
                    <Badge variant="secondary">{cls.studentCount} öğrenci</Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <motion.div key={key} variants={itemVariants}>
              <Card className="text-center">
                <CardContent className="p-4">
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${config.color.includes('green') ? 'text-green-600' : config.color.includes('red') ? 'text-red-600' : config.color.includes('yellow') ? 'text-yellow-600' : 'text-blue-600'}`} />
                  <p className="text-2xl font-bold">{stats[key]}</p>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Student List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Öğrenci Listesi - {selectedClass.name}</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Öğrenci ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredStudents.map((student, idx) => {
                const StatusIcon = statusConfig[student.status].icon;
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-center font-medium text-muted-foreground">{student.no}</span>
                      <Avatar>
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback className="bg-brand-primary/10 text-brand-primary">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{student.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {Object.entries(statusConfig).map(([key, config]) => {
                        const Icon = config.icon;
                        const isActive = student.status === key;
                        return (
                          <motion.button
                            key={key}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(student.id, key)}
                            className={`p-2 rounded-lg transition-all ${
                              isActive ? config.color : 'bg-muted hover:bg-muted/80'
                            }`}
                            title={config.label}
                          >
                            <Icon className="h-5 w-5" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
