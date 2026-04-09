// CourseIntellect Mock Data - Tauri Ready

export const mockStudents = [
  { id: '1', name: 'Ali Yılmaz', email: 'ali.yilmaz@email.com', phone: '0532 111 22 33', class: '10-A', status: 'active', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', parentId: '1', attendance: 92, lastExamScore: 85 },
  { id: '2', name: 'Ayşe Demir', email: 'ayse.demir@email.com', phone: '0533 222 33 44', class: '10-A', status: 'active', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', parentId: '2', attendance: 98, lastExamScore: 92 },
  { id: '3', name: 'Mehmet Kaya', email: 'mehmet.kaya@email.com', phone: '0534 333 44 55', class: '10-B', status: 'active', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', parentId: '3', attendance: 85, lastExamScore: 78 },
  { id: '4', name: 'Zeynep Öztürk', email: 'zeynep.ozturk@email.com', phone: '0535 444 55 66', class: '10-B', status: 'passive', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', parentId: '4', attendance: 45, lastExamScore: 0 },
  { id: '5', name: 'Can Arslan', email: 'can.arslan@email.com', phone: '0536 555 66 77', class: '11-A', status: 'active', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', parentId: '5', attendance: 88, lastExamScore: 90 },
  { id: '6', name: 'Elif Şahin', email: 'elif.sahin@email.com', phone: '0537 666 77 88', class: '11-A', status: 'active', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop', parentId: '6', attendance: 95, lastExamScore: 88 },
  { id: '7', name: 'Burak Çelik', email: 'burak.celik@email.com', phone: '0538 777 88 99', class: '11-B', status: 'active', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop', parentId: '7', attendance: 82, lastExamScore: 75 },
  { id: '8', name: 'Selin Koç', email: 'selin.koc@email.com', phone: '0539 888 99 00', class: '12-A', status: 'active', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', parentId: '8', attendance: 97, lastExamScore: 95 },
];

export const mockParents = [
  { id: '1', name: 'Ahmet Yılmaz', email: 'ahmet.yilmaz@email.com', phone: '0541 111 22 33', students: ['1'], avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop' },
  { id: '2', name: 'Fatma Demir', email: 'fatma.demir@email.com', phone: '0542 222 33 44', students: ['2'], avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop' },
  { id: '3', name: 'Mustafa Kaya', email: 'mustafa.kaya@email.com', phone: '0543 333 44 55', students: ['3'], avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
  { id: '4', name: 'Hatice Öztürk', email: 'hatice.ozturk@email.com', phone: '0544 444 55 66', students: ['4'], avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop' },
  { id: '5', name: 'İbrahim Arslan', email: 'ibrahim.arslan@email.com', phone: '0545 555 66 77', students: ['5'], avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { id: '6', name: 'Emine Şahin', email: 'emine.sahin@email.com', phone: '0546 666 77 88', students: ['6'], avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
];

export const mockTeachers = [
  { id: '1', name: 'Dr. Hasan Yıldız', email: 'hasan.yildiz@school.edu', phone: '0551 111 22 33', branch: 'Matematik', classes: ['10-A', '10-B', '11-A'], pendingQuestions: 5, avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop' },
  { id: '2', name: 'Aylin Güneş', email: 'aylin.gunes@school.edu', phone: '0552 222 33 44', branch: 'Fizik', classes: ['10-A', '11-B', '12-A'], pendingQuestions: 3, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop' },
  { id: '3', name: 'Osman Akça', email: 'osman.akca@school.edu', phone: '0553 333 44 55', branch: 'Kimya', classes: ['10-B', '11-A', '11-B'], pendingQuestions: 8, avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop' },
  { id: '4', name: 'Serpil Aydın', email: 'serpil.aydin@school.edu', phone: '0554 444 55 66', branch: 'Biyoloji', classes: ['11-A', '12-A'], pendingQuestions: 2, avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop' },
  { id: '5', name: 'Kemal Eren', email: 'kemal.eren@school.edu', phone: '0555 555 66 77', branch: 'Türkçe', classes: ['10-A', '10-B', '11-A', '11-B'], pendingQuestions: 12, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
];

export const mockClasses = [
  { id: '1', name: '10-A', grade: 10, section: 'A', studentCount: 28, teacherCount: 8, schedule: 'Pazartesi-Cuma 08:30-15:30' },
  { id: '2', name: '10-B', grade: 10, section: 'B', studentCount: 26, teacherCount: 8, schedule: 'Pazartesi-Cuma 08:30-15:30' },
  { id: '3', name: '11-A', grade: 11, section: 'A', studentCount: 30, teacherCount: 9, schedule: 'Pazartesi-Cuma 08:30-16:00' },
  { id: '4', name: '11-B', grade: 11, section: 'B', studentCount: 27, teacherCount: 9, schedule: 'Pazartesi-Cuma 08:30-16:00' },
  { id: '5', name: '12-A', grade: 12, section: 'A', studentCount: 25, teacherCount: 10, schedule: 'Pazartesi-Cuma 08:00-17:00' },
];

export const mockSchedule = [
  { id: '1', day: 'Pazartesi', time: '08:30-09:15', class: '10-A', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101' },
  { id: '2', day: 'Pazartesi', time: '09:25-10:10', class: '10-A', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1' },
  { id: '3', day: 'Pazartesi', time: '10:20-11:05', class: '10-A', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101' },
  { id: '4', day: 'Pazartesi', time: '11:15-12:00', class: '10-A', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2' },
  { id: '5', day: 'Salı', time: '08:30-09:15', class: '10-A', subject: 'Biyoloji', teacher: 'Serpil Aydın', room: 'Lab-3' },
  { id: '6', day: 'Salı', time: '09:25-10:10', class: '10-A', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101' },
  { id: '7', day: 'Çarşamba', time: '08:30-09:15', class: '10-A', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1' },
  { id: '8', day: 'Çarşamba', time: '09:25-10:10', class: '10-A', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101' },
  { id: '9', day: 'Perşembe', time: '08:30-09:15', class: '10-A', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2' },
  { id: '10', day: 'Perşembe', time: '09:25-10:10', class: '10-A', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101' },
  { id: '11', day: 'Cuma', time: '08:30-09:15', class: '10-A', subject: 'Biyoloji', teacher: 'Serpil Aydın', room: 'Lab-3' },
  { id: '12', day: 'Cuma', time: '09:25-10:10', class: '10-A', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1' },
];

export const mockContent = [
  { id: '1', title: 'Matematik - Türev Ders Notları', type: 'pdf', subject: 'Matematik', grade: 11, class: '11-A', uploadedBy: 'Dr. Hasan Yıldız', uploadedAt: '2025-01-05', size: '2.4 MB', downloads: 45 },
  { id: '2', title: 'Fizik - Newton Kanunları Video', type: 'video', subject: 'Fizik', grade: 10, class: '10-A', uploadedBy: 'Aylin Güneş', uploadedAt: '2025-01-04', size: '156 MB', views: 128 },
  { id: '3', title: 'Kimya - Periyodik Tablo', type: 'pdf', subject: 'Kimya', grade: 10, class: '10-B', uploadedBy: 'Osman Akça', uploadedAt: '2025-01-03', size: '1.2 MB', downloads: 67 },
  { id: '4', title: 'Biyoloji - Hücre Yapısı Sunumu', type: 'pdf', subject: 'Biyoloji', grade: 11, class: '11-A', uploadedBy: 'Serpil Aydın', uploadedAt: '2025-01-02', size: '5.8 MB', downloads: 34 },
  { id: '5', title: 'Türkçe - Edebiyat Akımları', type: 'video', subject: 'Türkçe', grade: 12, class: '12-A', uploadedBy: 'Kemal Eren', uploadedAt: '2025-01-01', size: '234 MB', views: 89 },
];

export const mockQuestions = [
  { id: '1', studentId: '1', studentName: 'Ali Yılmaz', teacherId: '1', teacherName: 'Dr. Hasan Yıldız', subject: 'Matematik', question: 'Türev alma kurallarını anlayamadım. Özellikle zincir kuralı konusunda yardımcı olur musunuz?', status: 'pending', createdAt: '2025-01-06T10:30:00', answer: null },
  { id: '2', studentId: '2', studentName: 'Ayşe Demir', teacherId: '2', teacherName: 'Aylin Güneş', subject: 'Fizik', question: 'Newton\'un 3. yasası için gerçek hayattan örnekler verebilir misiniz?', status: 'answered', createdAt: '2025-01-05T14:20:00', answer: 'Tabii ki! Örneğin yürürken ayağınız yeri iter, yer de sizi ileri iter...' },
  { id: '3', studentId: '3', studentName: 'Mehmet Kaya', teacherId: '3', teacherName: 'Osman Akça', subject: 'Kimya', question: 'Periyodik tabloda elementlerin yerleşimi neye göre belirleniyor?', status: 'pending', createdAt: '2025-01-06T09:15:00', answer: null },
  { id: '4', studentId: '5', studentName: 'Can Arslan', teacherId: '1', teacherName: 'Dr. Hasan Yıldız', subject: 'Matematik', question: 'İntegral hesaplamasında hangi yöntemleri kullanmalıyım?', status: 'pending', createdAt: '2025-01-06T08:45:00', answer: null },
];

export const mockExams = [
  { id: '1', name: 'Matematik Ara Sınav', subject: 'Matematik', class: '10-A', date: '2025-01-15', duration: 90, questionCount: 25, status: 'scheduled', teacherId: '1' },
  { id: '2', name: 'Fizik Quiz 1', subject: 'Fizik', class: '10-A', date: '2025-01-12', duration: 30, questionCount: 10, status: 'completed', teacherId: '2', avgScore: 78 },
  { id: '3', name: 'Kimya Deneme', subject: 'Kimya', class: '11-A', date: '2025-01-20', duration: 120, questionCount: 40, status: 'draft', teacherId: '3' },
];

export const mockQuestionBank = [
  { id: '1', subject: 'Matematik', topic: 'Türev', difficulty: 'Orta', question: 'f(x) = x² + 3x fonksiyonunun türevini bulunuz.', options: ['2x + 3', 'x + 3', '2x', 'x² + 3'], correctAnswer: 0 },
  { id: '2', subject: 'Matematik', topic: 'İntegral', difficulty: 'Zor', question: '∫(2x + 1)dx integralini hesaplayınız.', options: ['x² + x + C', '2x² + x + C', 'x² + C', '2x + C'], correctAnswer: 0 },
  { id: '3', subject: 'Fizik', topic: 'Hareket', difficulty: 'Kolay', question: 'Bir cisim 10 m/s hızla 5 saniye hareket ederse kaç metre yol alır?', options: ['50 m', '15 m', '2 m', '100 m'], correctAnswer: 0 },
  { id: '4', subject: 'Kimya', topic: 'Periyodik Tablo', difficulty: 'Orta', question: 'Sodyum (Na) elementi hangi grupta yer alır?', options: ['1A (Alkali Metaller)', '2A', '7A', '8A'], correctAnswer: 0 },
];

export const mockActivities = [
  { id: '1', type: 'attendance', message: '10-A sınıfı Matematik dersi yoklaması alındı', time: '5 dakika önce', icon: 'check' },
  { id: '2', type: 'question', message: 'Ali Yılmaz yeni bir soru sordu', time: '10 dakika önce', icon: 'help' },
  { id: '3', type: 'content', message: 'Fizik ders videosu yüklendi', time: '30 dakika önce', icon: 'upload' },
  { id: '4', type: 'exam', message: 'Kimya deneme sınavı oluşturuldu', time: '1 saat önce', icon: 'file' },
  { id: '5', type: 'student', message: 'Yeni öğrenci kaydı: Selin Koç', time: '2 saat önce', icon: 'user' },
];

export const mockDashboardStats = {
  totalStudents: 136,
  totalTeachers: 18,
  totalClasses: 12,
  todayAttendance: 94,
  pendingQuestions: 30,
  upcomingExams: 5,
};

export const mockTodayLessons = [
  { time: '08:30', class: '10-A', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', status: 'completed' },
  { time: '09:25', class: '10-A', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1', status: 'ongoing' },
  { time: '10:20', class: '10-A', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101', status: 'upcoming' },
  { time: '11:15', class: '10-A', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2', status: 'upcoming' },
];

export const mockNotifications = [
  { id: '1', title: 'Yeni Soru', message: 'Ali Yılmaz size bir soru sordu', time: '5 dk', read: false, type: 'question' },
  { id: '2', title: 'Devamsızlık Uyarısı', message: 'Zeynep Öztürk 3 gündür devamsız', time: '1 saat', read: false, type: 'warning' },
  { id: '3', title: 'Sınav Hatırlatma', message: 'Matematik ara sınavı 3 gün sonra', time: '2 saat', read: true, type: 'reminder' },
  { id: '4', title: 'İçerik Yüklendi', message: 'Fizik ders videosu hazır', time: '3 saat', read: true, type: 'content' },
];

export const currentUser = {
  id: '1',
  name: 'Yönetici',
  email: 'admin@courseintellect.com',
  role: 'admin',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
  tenant: 'Özel Yıldız Koleji',
  branch: 'Merkez Kampüs',
};
