import { CalendarClock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DrivingPage, DrivingPageHeader } from './_shared';
import DrivingTodayAppointments from './DrivingTodayAppointments';
import DrivingCalendar from './DrivingCalendar';
import DrivingScheduling from './DrivingScheduling';
import DrivingLessons from './DrivingLessons';

/**
 * Direksiyon işlemleri tek merkez: takvim, randevu ve dersler tek sayfada
 * sekmelerle toplanır — personel sayfa sayfa dolaşmaz. Çakışma/uygunluk
 * kuralları backend'de zorunlu uygulanır (randevu oluşturma ve takvimde
 * sürükle-bırak taşımada yeniden denetlenir).
 */
export default function DrivingHub() {
  return (
    <DrivingPage testId="driving-hub-page">
      <DrivingPageHeader
        title="Direksiyon Dersleri"
        description="Takvim, randevu ve dersler — tüm direksiyon işlemleri tek yerde."
        icon={CalendarClock}
      />
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="today">Bugün</TabsTrigger>
          <TabsTrigger value="calendar">Takvim</TabsTrigger>
          <TabsTrigger value="scheduling">Randevu &amp; Öğrenci</TabsTrigger>
          <TabsTrigger value="lessons">Dersler</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-5">
          <DrivingTodayAppointments />
        </TabsContent>
        <TabsContent value="calendar" className="mt-5">
          <DrivingCalendar embedded />
        </TabsContent>
        <TabsContent value="scheduling" className="mt-5">
          <DrivingScheduling embedded />
        </TabsContent>
        <TabsContent value="lessons" className="mt-5">
          <DrivingLessons embedded />
        </TabsContent>
      </Tabs>
    </DrivingPage>
  );
}
