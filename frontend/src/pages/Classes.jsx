import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Users, 
  GraduationCap,
  Calendar,
  BookOpen,
  School
} from 'lucide-react';
import { mockClasses, mockStudents, mockSchedule, mockContent } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function AddClassDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Sınıf Ekle</DialogTitle>
          <DialogDescription>Sınıf bilgilerini girin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Sınıf</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Sınıf" />
                </SelectTrigger>
                <SelectContent>
                  {[9, 10, 11, 12].map((grade) => (
                    <SelectItem key={grade} value={String(grade)}>{grade}. Sınıf</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Şube</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Şube" />
                </SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D', 'E'].map((section) => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule">Program</Label>
            <Input id="schedule" placeholder="Pazartesi-Cuma 08:30-15:30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Classes() {
  const [selectedClass, setSelectedClass] = useState(mockClasses[0]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const classStudents = mockStudents.filter(s => s.class === selectedClass?.name);
  const classSchedule = mockSchedule.filter(s => s.class === selectedClass?.name);
  const classContent = mockContent.filter(c => c.class === selectedClass?.name);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="classes-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınıflar & Gruplar</h1>
          <p className="text-muted-foreground mt-1">{mockClasses.length} aktif sınıf</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
          data-testid="add-class-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Sınıf
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Class List */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sınıflar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-2">
                  {mockClasses.map((cls) => (
                    <motion.div
                      key={cls.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedClass(cls)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedClass?.id === cls.id 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                      data-testid={`class-item-${cls.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selectedClass?.id === cls.id ? 'bg-white/20' : 'bg-background'}`}>
                          <School className={`h-5 w-5 ${selectedClass?.id === cls.id ? 'text-white' : 'text-brand-primary'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">{cls.name}</p>
                          <p className={`text-xs ${selectedClass?.id === cls.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {cls.studentCount} öğrenci
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Class Details */}
        <motion.div variants={itemVariants} className="lg:col-span-3">
          {selectedClass ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedClass.name} Sınıfı</CardTitle>
                    <p className="text-muted-foreground mt-1">{selectedClass.schedule}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-primary">{selectedClass.studentCount}</p>
                      <p className="text-xs text-muted-foreground">Öğrenci</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-accent">{selectedClass.teacherCount}</p>
                      <p className="text-xs text-muted-foreground">Öğretmen</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="students">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="students" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Öğrenciler
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Program
                    </TabsTrigger>
                    <TabsTrigger value="content" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      İçerikler
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="students">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classStudents.length > 0 ? classStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={student.avatar} alt={student.name} />
                            <AvatarFallback className="bg-brand-primary text-white">
                              {student.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                          <Badge variant="outline">{student.attendance}%</Badge>
                        </div>
                      )) : (
                        <div className="col-span-2 text-center py-8 text-muted-foreground">
                          Bu sınıfta henüz öğrenci bulunmuyor.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="schedule">
                    <div className="space-y-3">
                      {classSchedule.length > 0 ? classSchedule.slice(0, 6).map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                          <div className="text-center min-w-[60px]">
                            <p className="text-sm font-bold text-brand-primary">{lesson.time.split('-')[0]}</p>
                            <p className="text-xs text-muted-foreground">{lesson.day}</p>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{lesson.subject}</p>
                            <p className="text-sm text-muted-foreground">{lesson.teacher} • {lesson.room}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Bu sınıf için program bulunmuyor.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="content">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classContent.length > 0 ? classContent.map((content) => (
                        <Card key={content.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-brand-accent/10">
                                <BookOpen className="h-5 w-5 text-brand-accent" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{content.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{content.uploadedBy}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">{content.type.toUpperCase()}</Badge>
                                  <span className="text-xs text-muted-foreground">{content.size}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )) : (
                        <div className="col-span-2 text-center py-8 text-muted-foreground">
                          Bu sınıf için içerik bulunmuyor.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <School className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Sınıf Seçin</h3>
                <p className="text-muted-foreground">Detayları görmek için sol listeden bir sınıf seçin.</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      <AddClassDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
