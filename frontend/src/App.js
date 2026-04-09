import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Toaster } from "./components/ui/toaster";

// Auth Pages
import Login from "./pages/Login";

// Admin/Common Pages
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Parents from "./pages/Parents";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Schedule from "./pages/Schedule";
import Attendance from "./pages/Attendance";
import KioskQR from "./pages/KioskQR";
import Content from "./pages/Content";
import Questions from "./pages/Questions";
import Exams from "./pages/Exams";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// Chat
import Chat from "./pages/chat/Chat";

// Finance Pages
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import StudentAccounts from "./pages/finance/StudentAccounts";
import Collections from "./pages/finance/Collections";
import Installments from "./pages/finance/Installments";
import LatePayments from "./pages/finance/LatePayments";
import InvoicesReceipts from "./pages/finance/InvoicesReceipts";
import DiscountsScholarships from "./pages/finance/DiscountsScholarships";
import FinanceExport from "./pages/finance/Export";
import Approvals from "./pages/finance/Approvals";

// Super Admin Pages
import SADashboard from "./pages/superadmin/SADashboard";
import Tenants from "./pages/superadmin/Tenants";
import Plans from "./pages/superadmin/Plans";
import Billing from "./pages/superadmin/Billing";
import SystemSettings from "./pages/superadmin/SystemSettings";
import Limits from "./pages/superadmin/Limits";
import Support from "./pages/superadmin/Support";
import AIManagement from "./pages/superadmin/AIManagement";
import TenantCustomization from "./pages/superadmin/TenantCustomization";

// Teacher Pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherSchedule from "./pages/teacher/TeacherSchedule";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherContent from "./pages/teacher/TeacherContent";
import TeacherQuestions from "./pages/teacher/TeacherQuestions";
import TeacherExams from "./pages/teacher/TeacherExams";
import TeacherAssignments from "./pages/teacher/TeacherAssignments";
import TeacherLive from "./pages/teacher/TeacherLive";
import TeacherReports from "./pages/teacher/TeacherReports";
import TeacherQuestionBank from "./pages/teacher/TeacherQuestionBank";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentSchedule from "./pages/student/StudentSchedule";
import StudentContent from "./pages/student/StudentContent";
import StudentExams from "./pages/student/StudentExams";
import StudentQuestions from "./pages/student/StudentQuestions";
import StudentLive from "./pages/student/StudentLive";
import StudentAssignments from "./pages/student/StudentAssignments";
import StudentProfile from "./pages/student/StudentProfile";
import StudentAI from "./pages/student/StudentAI";

// Parent Pages
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentExams from "./pages/parent/ParentExams";
import ParentPayments from "./pages/parent/ParentPayments";
import ParentAnnouncements from "./pages/parent/ParentAnnouncements";
import ParentProfile from "./pages/parent/ParentProfile";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="courseintellect-theme">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<Login />} />
            
            {/* Main Dashboard Layout */}
            <Route element={<DashboardLayout />}>
              {/* Admin Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/parents" element={<Parents />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/kiosk-qr" element={<KioskQR />} />
              <Route path="/content" element={<Content />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />

              {/* Finance Routes */}
              <Route path="/finance" element={<FinanceDashboard />} />
              <Route path="/finance/dashboard" element={<FinanceDashboard />} />
              <Route path="/finance/student-accounts" element={<StudentAccounts />} />
              <Route path="/finance/collections" element={<Collections />} />
              <Route path="/finance/installments" element={<Installments />} />
              <Route path="/finance/late-payments" element={<LatePayments />} />
              <Route path="/finance/invoices-receipts" element={<InvoicesReceipts />} />
              <Route path="/finance/discounts-scholarships" element={<DiscountsScholarships />} />
              <Route path="/finance/export" element={<FinanceExport />} />
              <Route path="/finance/approvals" element={<Approvals />} />

              {/* Super Admin Routes */}
              <Route path="/sa/dashboard" element={<SADashboard />} />
              <Route path="/sa/tenants" element={<Tenants />} />
              <Route path="/sa/plans" element={<Plans />} />
              <Route path="/sa/billing" element={<Billing />} />
              <Route path="/sa/system" element={<SystemSettings />} />
              <Route path="/sa/limits" element={<Limits />} />
              <Route path="/sa/support" element={<Support />} />
              <Route path="/sa/ai" element={<AIManagement />} />
              <Route path="/sa/customization" element={<TenantCustomization />} />

              {/* Teacher Routes */}
              <Route path="/t/dashboard" element={<TeacherDashboard />} />
              <Route path="/t/schedule" element={<TeacherSchedule />} />
              <Route path="/t/attendance" element={<TeacherAttendance />} />
              <Route path="/t/content" element={<TeacherContent />} />
              <Route path="/t/questions" element={<TeacherQuestions />} />
              <Route path="/t/exams" element={<TeacherExams />} />
              <Route path="/t/assignments" element={<TeacherAssignments />} />
              <Route path="/t/live-lessons" element={<TeacherLive />} />
              <Route path="/t/reports" element={<TeacherReports />} />
              <Route path="/t/question-bank" element={<TeacherQuestionBank />} />
              <Route path="/t/chat" element={<Chat />} />

              {/* Student Routes */}
              <Route path="/s/dashboard" element={<StudentDashboard />} />
              <Route path="/s/schedule" element={<StudentSchedule />} />
              <Route path="/s/content" element={<StudentContent />} />
              <Route path="/s/exams" element={<StudentExams />} />
              <Route path="/s/questions" element={<StudentQuestions />} />
              <Route path="/s/live" element={<StudentLive />} />
              <Route path="/s/assignments" element={<StudentAssignments />} />
              <Route path="/s/profile" element={<StudentProfile />} />
              <Route path="/s/ai" element={<StudentAI />} />
              <Route path="/s/chat" element={<Chat />} />

              {/* Parent Routes */}
              <Route path="/p/dashboard" element={<ParentDashboard />} />
              <Route path="/p/attendance" element={<ParentAttendance />} />
              <Route path="/p/exams" element={<ParentExams />} />
              <Route path="/p/payments" element={<ParentPayments />} />
              <Route path="/p/announcements" element={<ParentAnnouncements />} />
              <Route path="/p/profile" element={<ParentProfile />} />
              <Route path="/p/chat" element={<Chat />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
