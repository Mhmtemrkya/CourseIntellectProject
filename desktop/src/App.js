import "@/App.css";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Toaster } from "./components/ui/toaster";

// Auth Pages
import Login from "./pages/Login";
import ForcePasswordChange from "./pages/ForcePasswordChange";

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
import StudentStudyPlan from "./pages/student/StudentStudyPlan";
import StudentAttendanceScan from "./pages/student/StudentAttendanceScan";
import StudentWrongAnswers from "./pages/student/StudentWrongAnswers";
import StudentContentDetail from "./pages/student/StudentContentDetail";
import StudentQuestionPractice from "./pages/student/StudentQuestionPractice";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentExamResults from "./pages/student/StudentExamResults";
import StudentQuestionBox from "./pages/student/StudentQuestionBox";

// Parent Pages
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentAttendance from "./pages/parent/ParentAttendance";
import ParentExams from "./pages/parent/ParentExams";
import ParentPayments from "./pages/parent/ParentPayments";
import ParentAnnouncements from "./pages/parent/ParentAnnouncements";
import ParentProfile from "./pages/parent/ParentProfile";
import ParentChildren from "./pages/parent/ParentChildren";
import ParentWeeklyReport from "./pages/parent/ParentWeeklyReport";
import ParentFeedback from "./pages/parent/ParentFeedback";
import ParentMeetings from "./pages/parent/ParentMeetings";
import ParentReceipts from "./pages/parent/ParentReceipts";
import TeacherSubmissionCenter from "./pages/teacher/TeacherSubmissionCenter";
import TeacherLiveRoom from "./pages/teacher/TeacherLiveRoom";
import TeacherContentStudio from "./pages/teacher/TeacherContentStudio";
import TeacherQuestionWorkflow from "./pages/teacher/TeacherQuestionWorkflow";
import TeacherExamWorkbench from "./pages/teacher/TeacherExamWorkbench";
import AuditLog from "./pages/finance/AuditLog";
import CollectionCalendar from "./pages/finance/CollectionCalendar";
import Reconciliation from "./pages/finance/Reconciliation";
import BulkActions from "./pages/finance/BulkActions";
import FinanceDetailHub from "./pages/finance/FinanceDetailHub";
import AdminAcademics from "./pages/admin/AdminAcademics";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminOperations from "./pages/admin/AdminOperations";
import AdminTaskCenter from "./pages/admin/AdminTaskCenter";
import AdminKpiDashboard from "./pages/admin/AdminKpiDashboard";
import AdminGlobalSearch from "./pages/admin/AdminGlobalSearch";
import Destek from "./pages/admin/Destek";
import AdminPersonnelApprovals from "./pages/admin/AdminPersonnelApprovals";
import AdminRoleManagement from "./pages/admin/AdminRoleManagement";
import AdministrativeRecords from "./pages/admin/AdministrativeRecords";
import AdministrativeNotifications from "./pages/admin/AdministrativeNotifications";
import AdministrativeDocuments from "./pages/admin/AdministrativeDocuments";
import AdministrativeAnnouncements from "./pages/admin/AdministrativeAnnouncements";
import AdminStudentRegistration from "./pages/admin/AdminStudentRegistration";
import AdminParentRegistration from "./pages/admin/AdminParentRegistration";
import AdminStaffRegistration from "./pages/admin/AdminStaffRegistration";
import AdminBranchComparison from "./pages/admin/AdminBranchComparison";
import AdminMeetings from "./pages/admin/AdminMeetings";
import AdminAdministrativeUnits from "./pages/admin/AdminAdministrativeUnits";
import AdminAccountingRegistration from "./pages/admin/AdminAccountingRegistration";

// New Student Pages
import StudentNotifications from "./pages/student/StudentNotifications";
import StudentAnnouncements from "./pages/student/StudentAnnouncements";
import StudentSettings from "./pages/student/StudentSettings";

// New Teacher Pages
import TeacherMeetingApprovals from "./pages/teacher/TeacherMeetingApprovals";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import TeacherAnnouncements from "./pages/teacher/TeacherAnnouncements";

// New Parent Pages
import ParentExcuseRequest from "./pages/parent/ParentExcuseRequest";

// New Finance Pages
import Salary from "./pages/finance/Salary";
import CashReport from "./pages/finance/CashReport";
import OverdueRules from "./pages/finance/OverdueRules";
import Ledger from "./pages/finance/Ledger";

import { useApp } from "./context/AppContext";
import { getUserHomePath } from "./lib/auth";
import { MaintenanceGate } from "./components/system/MaintenanceGate";
import { LegalConsentGate } from "./components/legal/LegalConsentGate";

function RootRedirect() {
  const { isAuthenticated, isAuthLoading, user } = useApp();

  if (isAuthLoading) {
    return null;
  }

  if (!isAuthenticated || !user?.role) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password-required" replace />;
  }

  return <Navigate to={getUserHomePath(user)} replace />;
}

function App() {
  const RouterComponent = typeof window !== "undefined" &&
    (window.location.protocol === "file:" || window.location.protocol.startsWith("tauri"))
    ? HashRouter
    : BrowserRouter;

  return (
    <ThemeProvider defaultTheme="system" storageKey="courseintellect-theme">
      <AppProvider>
        <MaintenanceGate>
        <LegalConsentGate>
        <RouterComponent>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/change-password-required" element={<ForcePasswordChange />} />
            
            {/* Main Dashboard Layout */}
            <Route element={<DashboardLayout />}>
              {/* Admin Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/parents" element={<Parents />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/s/classes" element={<Classes />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/admin/schedule" element={<Schedule />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/kiosk-qr" element={<KioskQR />} />
              <Route path="/content" element={<Content />} />
              <Route path="/questions" element={<Questions />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/admin/academics" element={<AdminAcademics />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/admin/operations" element={<AdminOperations />} />
              <Route path="/admin/task-center" element={<AdminTaskCenter />} />
              <Route path="/admin/kpi" element={<AdminKpiDashboard />} />
              <Route path="/admin/global-search" element={<AdminGlobalSearch />} />
              <Route path="/admin/personnel-approvals" element={<AdminPersonnelApprovals />} />
              <Route path="/admin/finance-approvals" element={<Approvals />} />
              <Route path="/admin/role-management" element={<AdminRoleManagement />} />
              <Route path="/admin/records" element={<AdministrativeRecords />} />
              <Route path="/admin/administrative-units" element={<AdminAdministrativeUnits />} />
              <Route path="/admin/announcements" element={<AdministrativeAnnouncements />} />
              <Route path="/admin/notifications" element={<AdministrativeNotifications />} />
              <Route path="/admin/documents" element={<AdministrativeDocuments />} />
              <Route path="/admin/student-registration" element={<AdminStudentRegistration />} />
              <Route path="/admin/parent-registration" element={<AdminParentRegistration />} />
              <Route path="/admin/staff-registration" element={<AdminStaffRegistration />} />
              <Route path="/admin/accounting-registration" element={<AdminAccountingRegistration />} />
              <Route path="/admin/branch-comparison" element={<AdminBranchComparison />} />
              <Route path="/admin/meetings" element={<AdminMeetings />} />
              <Route path="/admin/destek" element={<Destek />} />

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
              <Route path="/finance/audit-log" element={<AuditLog />} />
              <Route path="/finance/collection-calendar" element={<CollectionCalendar />} />
              <Route path="/finance/reconciliation" element={<Reconciliation />} />
              <Route path="/finance/bulk-actions" element={<BulkActions />} />
              <Route path="/finance/detail-hub" element={<FinanceDetailHub />} />
              <Route path="/finance/salary" element={<Salary />} />
              <Route path="/finance/cash-report" element={<CashReport />} />
              <Route path="/finance/overdue-rules" element={<OverdueRules />} />
              <Route path="/finance/ledger" element={<Ledger />} />

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
              <Route path="/t/submissions" element={<TeacherSubmissionCenter />} />
              <Route path="/t/live-lessons" element={<TeacherLive />} />
              <Route path="/t/live-room" element={<TeacherLiveRoom />} />
              <Route path="/t/reports" element={<TeacherReports />} />
              <Route path="/t/question-bank" element={<TeacherQuestionBank />} />
              <Route path="/t/content-studio" element={<TeacherContentStudio />} />
              <Route path="/t/question-workflow" element={<TeacherQuestionWorkflow />} />
              <Route path="/t/exam-workbench" element={<TeacherExamWorkbench />} />
              <Route path="/t/meeting-approvals" element={<TeacherMeetingApprovals />} />
              <Route path="/t/announcements" element={<TeacherAnnouncements />} />
              <Route path="/t/profile" element={<TeacherProfile />} />
              <Route path="/t/chat" element={<Chat />} />

              {/* Student Routes */}
              <Route path="/s/dashboard" element={<StudentDashboard />} />
              <Route path="/s/schedule" element={<StudentSchedule />} />
              <Route path="/s/content" element={<StudentContent />} />
              <Route path="/s/exams" element={<StudentExams />} />
              <Route path="/s/questions" element={<StudentQuestions />} />
              <Route path="/s/live" element={<StudentLive />} />
              <Route path="/s/attendance" element={<StudentAttendance />} />
              <Route path="/s/assignments" element={<StudentAssignments />} />
              <Route path="/s/study-plan" element={<StudentStudyPlan />} />
              <Route path="/s/attendance-qr" element={<StudentAttendanceScan />} />
              <Route path="/s/exam-results" element={<StudentExamResults />} />
              <Route path="/s/wrong-answers" element={<StudentWrongAnswers />} />
              <Route path="/s/content-detail" element={<StudentContentDetail />} />
              <Route path="/s/question-practice" element={<StudentQuestionPractice />} />
              <Route path="/s/question-box" element={<StudentQuestionBox />} />
              <Route path="/s/profile" element={<StudentProfile />} />
              <Route path="/s/ai" element={<StudentAI />} />
              <Route path="/s/notifications" element={<StudentNotifications />} />
              <Route path="/s/announcements" element={<StudentAnnouncements />} />
              <Route path="/s/settings" element={<StudentSettings />} />
              <Route path="/s/chat" element={<Chat />} />

              {/* Parent Routes */}
              <Route path="/p/dashboard" element={<ParentDashboard />} />
              <Route path="/p/attendance" element={<ParentAttendance />} />
              <Route path="/p/exams" element={<ParentExams />} />
              <Route path="/p/payments" element={<ParentPayments />} />
              <Route path="/p/children" element={<ParentChildren />} />
              <Route path="/p/weekly-report" element={<ParentWeeklyReport />} />
              <Route path="/p/feedback" element={<ParentFeedback />} />
              <Route path="/p/meetings" element={<ParentMeetings />} />
              <Route path="/p/receipts" element={<ParentReceipts />} />
              <Route path="/p/announcements" element={<ParentAnnouncements />} />
              <Route path="/p/excuse-request" element={<ParentExcuseRequest />} />
              <Route path="/p/profile" element={<ParentProfile />} />
              <Route path="/p/chat" element={<Chat />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </RouterComponent>
        </LegalConsentGate>
        <Toaster />
        </MaintenanceGate>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
