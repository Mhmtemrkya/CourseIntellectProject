import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  GraduationCap, 
  School, 
  Calendar, 
  ClipboardCheck, 
  QrCode, 
  HelpCircle, 
  FileQuestion, 
  BarChart3, 
  Settings,
  BookOpen
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command';

const navigationItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', keywords: ['ana sayfa', 'home'] },
  { path: '/students', icon: Users, label: 'Öğrenciler', keywords: ['student', 'öğrenci'] },
  { path: '/parents', icon: UserCheck, label: 'Veliler', keywords: ['parent', 'veli', 'aile'] },
  { path: '/teachers', icon: GraduationCap, label: 'Öğretmenler', keywords: ['teacher', 'öğretmen', 'hoca'] },
  { path: '/classes', icon: School, label: 'Sınıflar & Gruplar', keywords: ['class', 'sınıf', 'grup'] },
  { path: '/schedule', icon: Calendar, label: 'Ders Programı', keywords: ['schedule', 'program', 'takvim'] },
  { path: '/attendance', icon: ClipboardCheck, label: 'Yoklama', keywords: ['attendance', 'yoklama', 'devamsızlık'] },
  { path: '/kiosk-qr', icon: QrCode, label: 'Kiosk QR', keywords: ['qr', 'kiosk', 'tarama'] },
  { path: '/content', icon: BookOpen, label: 'İçerikler', keywords: ['content', 'içerik', 'video', 'pdf'] },
  { path: '/questions', icon: HelpCircle, label: 'Sorular', keywords: ['question', 'soru', 'cevap'] },
  { path: '/exams', icon: FileQuestion, label: 'Sınavlar', keywords: ['exam', 'sınav', 'test', 'quiz'] },
  { path: '/reports', icon: BarChart3, label: 'Raporlar', keywords: ['report', 'rapor', 'analiz'] },
  { path: '/settings', icon: Settings, label: 'Ayarlar', keywords: ['settings', 'ayar', 'config'] },
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setCommandPaletteOpen]);

  const handleSelect = useCallback((path) => {
    setCommandPaletteOpen(false);
    navigate(path);
  }, [navigate, setCommandPaletteOpen]);

  return (
    <CommandDialog 
      open={commandPaletteOpen} 
      onOpenChange={setCommandPaletteOpen}
    >
      <CommandInput placeholder="Sayfa veya işlem ara..." />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        <CommandGroup heading="Sayfalar">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords.join(' ')}`}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Hızlı İşlemler">
          <CommandItem 
            onSelect={() => handleSelect('/students?action=new')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Yeni Öğrenci Ekle</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => handleSelect('/attendance')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <span>Yoklama Al</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => handleSelect('/exams?action=new')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
            <span>Yeni Sınav Oluştur</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
