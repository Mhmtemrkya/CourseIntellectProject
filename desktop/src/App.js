import "@/App.css";
import { Suspense } from "react";
import { lazyWithReload } from "./lib/lazyWithReload";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./lib/i18n/LanguageContext";
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
const FinanceDashboard = lazyWithReload(() => import("./pages/finance/FinanceDashboard"));
const StudentAccounts = lazyWithReload(() => import("./pages/finance/StudentAccounts"));
const Collections = lazyWithReload(() => import("./pages/finance/Collections"));
const Installments = lazyWithReload(() => import("./pages/finance/Installments"));
const LatePayments = lazyWithReload(() => import("./pages/finance/LatePayments"));
const InvoicesReceipts = lazyWithReload(() => import("./pages/finance/InvoicesReceipts"));
const DiscountsScholarships = lazyWithReload(() => import("./pages/finance/DiscountsScholarships"));
const FinanceExport = lazyWithReload(() => import("./pages/finance/Export"));
const Approvals = lazyWithReload(() => import("./pages/finance/Approvals"));

// Super Admin Pages
const SADashboard = lazyWithReload(() => import("./pages/superadmin/SADashboard"));
const Tenants = lazyWithReload(() => import("./pages/superadmin/Tenants"));
const Plans = lazyWithReload(() => import("./pages/superadmin/Plans"));
const Billing = lazyWithReload(() => import("./pages/superadmin/Billing"));
const SystemSettings = lazyWithReload(() => import("./pages/superadmin/SystemSettings"));
const Limits = lazyWithReload(() => import("./pages/superadmin/Limits"));
const Support = lazyWithReload(() => import("./pages/superadmin/Support"));
const AIManagement = lazyWithReload(() => import("./pages/superadmin/AIManagement"));
const TenantCustomization = lazyWithReload(() => import("./pages/superadmin/TenantCustomization"));
const PlatformLogs = lazyWithReload(() => import("./pages/superadmin/PlatformLogs"));

// Teacher Pages
import GuidanceDashboard from "./pages/guidance/GuidanceDashboard";
import GuidanceStudentFile from "./pages/guidance/GuidanceStudentFile";
import GuidanceSessions from "./pages/guidance/GuidanceSessions";
import GuidancePlanner from "./pages/guidance/GuidancePlanner";
import GuidanceAppointments from "./pages/guidance/GuidanceAppointments";
import GuidanceInventories from "./pages/guidance/GuidanceInventories";
import GuidanceReports from "./pages/guidance/GuidanceReports";
import GuidanceRequest from "./pages/guidance/GuidanceRequest";
import LibraryPage from "./pages/library/LibraryPage";
import LibraryUserPage from "./pages/library/LibraryUserPage";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherSchedule from "./pages/teacher/TeacherSchedule";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherContent from "./pages/teacher/TeacherContent";
import TeacherQuestions from "./pages/teacher/TeacherQuestions";
import TeacherExams from "./pages/teacher/TeacherExams";
import TeacherAssignments from "./pages/teacher/TeacherAssignments";
import TeacherLive from "./pages/teacher/TeacherLive";
import TeacherReports from "./pages/teacher/TeacherReports";
const TeacherDuties = lazyWithReload(() => import("./pages/teacher/TeacherDuties"));
const DutyCreate = lazyWithReload(() => import("./pages/admin/DutyCreate"));
const DutiesBoard = lazyWithReload(() => import("./pages/admin/DutiesBoard"));
const TeacherTimetable = lazyWithReload(() => import("./pages/admin/TeacherTimetable"));
import TeacherQuestionBank from "./pages/teacher/TeacherQuestionBank";
import TeacherBulkQuestionUpload from "./pages/teacher/TeacherBulkQuestionUpload";
import ExamSolvingPage from "./pages/solving/ExamSolvingPage";
import TeacherQuestionStudio from "./pages/teacher/TeacherQuestionStudio";
import TeacherMockExams from "./pages/teacher/TeacherMockExams";
import TeacherGradeEntry from "./pages/teacher/TeacherGradeEntry";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentSchedule from "./pages/student/StudentSchedule";
import StudentContent from "./pages/student/StudentContent";
import StudentExams from "./pages/student/StudentExams";
import StudentMockExams from "./pages/student/StudentMockExams";
import StudentQuestions from "./pages/student/StudentQuestions";
import StudentLive from "./pages/student/StudentLive";
import StudentAssignments from "./pages/student/StudentAssignments";
import StudentProfile from "./pages/student/StudentProfile";
import StudentAI from "./pages/student/StudentAI";
import StudentStudyPlan from "./pages/student/StudentStudyPlan";
import StudentAttendanceScan from "./pages/student/StudentAttendanceScan";
import StudentWrongAnswers from "./pages/student/StudentWrongAnswers";
import StudentContentDetail from "./pages/student/StudentContentDetail";
import StudentFavorites from "./pages/student/StudentFavorites";
import StudentNotes from "./pages/student/StudentNotes";
import StudentQuestionPractice from "./pages/student/StudentQuestionPractice";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentExamResults from "./pages/student/StudentExamResults";
import StudentQuestionBox from "./pages/student/StudentQuestionBox";
import StudentBadges from "./pages/student/StudentBadges";
import TeacherStudentExams from "./pages/teacher/TeacherStudentExams";
import DriverPanel from "./pages/DriverPanel";
const DrivingSchoolDashboard = lazyWithReload(() => import("./pages/driving/DrivingSchoolDashboard"));
const DrivingOperations = lazyWithReload(() => import("./pages/driving/DrivingOperations"));
const DrivingHub = lazyWithReload(() => import("./pages/driving/DrivingHub"));
const DrivingScheduling = lazyWithReload(() => import("./pages/driving/DrivingScheduling"));
const DrivingLessons = lazyWithReload(() => import("./pages/driving/DrivingLessons"));
const DrivingFleetCompliance = lazyWithReload(() => import("./pages/driving/DrivingFleetCompliance"));
const DrivingStudentWizard = lazyWithReload(() => import("./pages/driving/DrivingStudentWizard"));
const DrivingStudents = lazyWithReload(() => import("./pages/driving/DrivingStudents"));
const DrivingVehicles = lazyWithReload(() => import("./pages/driving/DrivingVehicles"));
const DrivingAssignments = lazyWithReload(() => import("./pages/driving/DrivingAssignments"));
const DrivingCalendar = lazyWithReload(() => import("./pages/driving/DrivingCalendar"));
const DrivingStudentDetail = lazyWithReload(() => import("./pages/driving/DrivingStudentDetail"));
const DrivingEducation = lazyWithReload(() => import("./pages/driving/DrivingEducation"));
const DrivingGraduation = lazyWithReload(() => import("./pages/driving/DrivingGraduation"));
const DrivingReports = lazyWithReload(() => import("./pages/driving/DrivingReports"));

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
const AuditLog = lazyWithReload(() => import("./pages/finance/AuditLog"));
const CollectionCalendar = lazyWithReload(() => import("./pages/finance/CollectionCalendar"));
const Reconciliation = lazyWithReload(() => import("./pages/finance/Reconciliation"));
const BulkActions = lazyWithReload(() => import("./pages/finance/BulkActions"));
const FinanceDetailHub = lazyWithReload(() => import("./pages/finance/FinanceDetailHub"));
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
import AdminStaffHr from "./pages/admin/AdminStaffHr";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminOrgUnits from "./pages/admin/AdminOrgUnits";
import AdminRbacMatrix from "./pages/admin/AdminRbacMatrix";
import AdminRoleManagement from "./pages/admin/AdminRoleManagement";
import AdministrativeRecords from "./pages/admin/AdministrativeRecords";
import AdministrativeNotifications from "./pages/admin/AdministrativeNotifications";
import AdministrativeDocuments from "./pages/admin/AdministrativeDocuments";
import AdministrativeAnnouncements from "./pages/admin/AdministrativeAnnouncements";
import AdminStudentRegistration from "./pages/admin/AdminStudentRegistration";
import AdminStaffRegistration from "./pages/admin/AdminStaffRegistration";
import ConsolidatedOverview from "./pages/admin/ConsolidatedOverview";
import ScopeManagement from "./pages/admin/ScopeManagement";
import AdminBranchRegistration from "./pages/admin/AdminBranchRegistration";
import SelectBranch from "./pages/SelectBranch";
import AdminBranchComparison from "./pages/admin/AdminBranchComparison";
import AdminMeetings from "./pages/admin/AdminMeetings";
import AdminAdministrativeUnits from "./pages/admin/AdminAdministrativeUnits";
import AdminAccountingRegistration from "./pages/admin/AdminAccountingRegistration";
import ServiceTrackingPage from "./pages/admin/ServiceTrackingPage";
import CafeteriaWeeklyMenu from "./pages/cafeteria/CafeteriaWeeklyMenu";
import PasswordResetRequests from "./pages/admin/PasswordResetRequests";

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
import ParentRequests from "./pages/parent/ParentRequests";
import ParentAcademic from "./pages/parent/ParentAcademic";
import ParentService from "./pages/parent/ParentService";
import ParentCafeteria from "./pages/parent/ParentCafeteria";

// New Finance Pages
const Salary = lazyWithReload(() => import("./pages/finance/Salary"));
const CashReport = lazyWithReload(() => import("./pages/finance/CashReport"));
const OverdueRules = lazyWithReload(() => import("./pages/finance/OverdueRules"));
const Ledger = lazyWithReload(() => import("./pages/finance/Ledger"));

import { useApp } from "./context/AppContext";
import { getUserHomePath } from "./lib/auth";
import { getUserRoles } from "./lib/permissions";
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

// Kurum yöneticisi ilk girişte şube seçmeden ana ekranlara giremez. Tek/sıfır
// şubeli kurumlarda SelectBranch otomatik devam eder. Seçim bayrağı
// 'ci-branch-selected' ile bir kez işaretlenir (çıkışta temizlenir).
function BranchGate() {
  const { user } = useApp();
  const isOwner = (user?.role || "").toLowerCase() === "admin";
  const branchSelected = typeof localStorage !== "undefined" && localStorage.getItem("ci-branch-selected") === "1";
  if (isOwner && !branchSelected && !user?.mustChangePassword) {
    return <Navigate to="/select-branch" replace />;
  }
  return <DashboardLayout />;
}

// Personel onayları, finans onayları, rol yönetimi, denetim kayıtları ve yetki
// matrisi yalnız kurum yöneticisine (admin) ve platform admine açıktır; idari
// personel doğrudan URL ile de erişemez.
function AdminOnlyRoute({ children }) {
  const { user } = useApp();
  const roles = getUserRoles(user);
  if (!roles.includes("admin") && !roles.includes("superadmin")) {
    return <Navigate to={getUserHomePath(user)} replace />;
  }
  return children;
}

function App() {
  const RouterComponent = typeof window !== "undefined" &&
    (window.location.protocol === "file:" || window.location.protocol.startsWith("tauri"))
    ? HashRouter
    : BrowserRouter;

  return (
    <LanguageProvider>
    <ThemeProvider defaultTheme="system" storageKey="courseintellect-theme">
      <AppProvider>
        <MaintenanceGate>
        <LegalConsentGate>
        <RouterComponent>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
                Yükleniyor...
              </div>
            }
          >
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/driver" element={<DriverPanel />} />
            <Route path="/change-password-required" element={<ForcePasswordChange />} />
            <Route path="/select-branch" element={<SelectBranch />} />
            
            {/* Main Dashboard Layout */}
            <Route element={<BranchGate />}>
              {/* Admin Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/parents" element={<Parents />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/admin/schedule" element={<Schedule />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/kiosk-qr" element={<KioskQR />} />
              <Route path="/content" element={<Content />} />
              <Route path="/questions" element={<Questions />} />
              {/* Toplu soru yükleme (Excel/PDF) öğretmen ekranıyla AYNI bileşen —
                  kopyalanmadı; backend zaten Teacher,Admin'e açık. */}
              <Route path="/questions/import" element={<TeacherBulkQuestionUpload />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/admin/academics" element={<AdminAcademics />} />
              <Route path="/admin/exam-papers" element={<TeacherReports />} />
              <Route path="/admin/duty-create" element={<DutyCreate />} />
              <Route path="/admin/duties" element={<DutiesBoard />} />
              <Route path="/admin/timetable" element={<TeacherTimetable />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/admin/operations" element={<AdminOperations />} />
              <Route path="/admin/task-center" element={<AdminTaskCenter />} />
              <Route path="/admin/kpi" element={<AdminKpiDashboard />} />
              <Route path="/admin/global-search" element={<AdminGlobalSearch />} />
              <Route path="/admin/personnel-approvals" element={<AdminOnlyRoute><AdminPersonnelApprovals /></AdminOnlyRoute>} />
              <Route path="/admin/staff-hr" element={<AdminStaffHr />} />
              <Route path="/admin/audit-log" element={<AdminOnlyRoute><AdminAuditLog /></AdminOnlyRoute>} />
              <Route path="/admin/org-units" element={<AdminOrgUnits />} />
              <Route path="/admin/rbac" element={<AdminOnlyRoute><AdminRbacMatrix /></AdminOnlyRoute>} />
              <Route path="/admin/finance-approvals" element={<AdminOnlyRoute><Approvals /></AdminOnlyRoute>} />
              <Route path="/admin/role-management" element={<AdminOnlyRoute><AdminRoleManagement /></AdminOnlyRoute>} />
              <Route path="/admin/records" element={<AdministrativeRecords />} />
              <Route path="/admin/administrative-units" element={<AdminAdministrativeUnits />} />
              <Route path="/admin/announcements" element={<AdministrativeAnnouncements />} />
              <Route path="/admin/notifications" element={<AdministrativeNotifications />} />
              <Route path="/admin/documents" element={<AdministrativeDocuments />} />
              <Route path="/admin/student-registration" element={<AdminStudentRegistration />} />
              <Route path="/admin/branch-registration" element={<AdminBranchRegistration />} />
              <Route path="/admin/staff-registration" element={<AdminStaffRegistration />} />
              <Route path="/consolidated" element={<ConsolidatedOverview />} />
              <Route path="/scope-management" element={<ScopeManagement />} />
              <Route path="/admin/accounting-registration" element={<AdminAccountingRegistration />} />
              <Route path="/admin/branch-comparison" element={<AdminBranchComparison />} />
              <Route path="/admin/meetings" element={<AdminMeetings />} />
              <Route path="/admin/service-tracking" element={<ServiceTrackingPage />} />
              <Route path="/driving/dashboard" element={<DrivingSchoolDashboard />} />
              <Route path="/driving/operations" element={<DrivingOperations />} />
              <Route path="/driving/hub" element={<DrivingHub />} />
              <Route path="/driving/scheduling" element={<DrivingScheduling />} />
              <Route path="/driving/lessons" element={<DrivingLessons />} />
              <Route path="/driving/fleet-compliance" element={<DrivingFleetCompliance />} />
              <Route path="/driving/calendar" element={<DrivingCalendar />} />
              <Route path="/driving/assignments" element={<DrivingAssignments />} />
              <Route path="/driving/students" element={<DrivingStudents />} />
              <Route path="/driving/vehicles" element={<DrivingVehicles />} />
              <Route path="/driving/students/new" element={<DrivingStudentWizard />} />
              <Route path="/driving/students/:profileId" element={<DrivingStudentDetail />} />
              <Route path="/driving/education" element={<DrivingEducation />} />
              <Route path="/driving/graduation" element={<DrivingGraduation />} />
              <Route path="/driving/reports" element={<DrivingReports />} />
              <Route path="/admin/password-reset-requests" element={<PasswordResetRequests />} />
              <Route path="/cafeteria/menu" element={<CafeteriaWeeklyMenu editable />} />
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
              <Route path="/sa/logs" element={<PlatformLogs />} />

              {/* Guidance (Rehberlik) Routes */}
              <Route path="/g/dashboard" element={<GuidanceDashboard />} />
              <Route path="/g/student/:studentName" element={<GuidanceStudentFile />} />
              <Route path="/g/sessions" element={<GuidanceSessions />} />
              <Route path="/g/planner" element={<GuidancePlanner />} />
              <Route path="/g/appointments" element={<GuidanceAppointments />} />
              <Route path="/g/inventories" element={<GuidanceInventories />} />
              <Route path="/g/reports" element={<GuidanceReports />} />
              <Route path="/s/guidance" element={<GuidanceRequest />} />
              <Route path="/p/guidance" element={<GuidanceRequest />} />

              {/* Kütüphane */}
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/s/library" element={<LibraryUserPage />} />
              <Route path="/p/library" element={<LibraryUserPage />} />
              <Route path="/t/library" element={<LibraryUserPage />} />
              <Route path="/g/library" element={<LibraryUserPage />} />

              {/* Teacher Routes */}
              <Route path="/t/dashboard" element={<TeacherDashboard />} />
              <Route path="/t/schedule" element={<TeacherSchedule />} />
              <Route path="/t/attendance" element={<TeacherAttendance />} />
              <Route path="/t/content" element={<TeacherContent />} />
              <Route path="/t/questions" element={<TeacherQuestions />} />
              <Route path="/t/exams" element={<TeacherExams />} />
              <Route path="/t/grade-entry" element={<TeacherGradeEntry />} />
              <Route path="/t/assignments" element={<TeacherAssignments />} />
              <Route path="/t/submissions" element={<TeacherSubmissionCenter />} />
              <Route path="/t/live-lessons" element={<TeacherLive />} />
              <Route path="/t/live-room" element={<TeacherLiveRoom />} />
              <Route path="/t/reports" element={<TeacherReports />} />
              <Route path="/t/duties" element={<TeacherDuties />} />
              <Route path="/t/question-bank" element={<TeacherQuestionBank />} />
              <Route path="/t/question-bank/import" element={<TeacherBulkQuestionUpload />} />
              <Route path="/t/question-studio" element={<TeacherQuestionStudio />} />
              <Route path="/t/exams/create" element={<TeacherQuestionStudio />} />
              <Route path="/t/mock-exams" element={<TeacherMockExams />} />
              <Route path="/t/mock-exams/create" element={<TeacherQuestionStudio />} />
              <Route path="/t/solve-preview" element={<ExamSolvingPage />} />
              <Route path="/t/content-studio" element={<TeacherContentStudio />} />
              <Route path="/t/question-workflow" element={<TeacherQuestionWorkflow />} />
              <Route path="/t/exam-workbench" element={<TeacherExamWorkbench />} />
              <Route path="/t/student-exams" element={<TeacherStudentExams />} />
              <Route path="/t/meeting-approvals" element={<TeacherMeetingApprovals />} />
              <Route path="/t/announcements" element={<TeacherAnnouncements />} />
              <Route path="/t/profile" element={<TeacherProfile />} />
              <Route path="/t/chat" element={<Chat />} />

              {/* Student Routes */}
              <Route path="/s/dashboard" element={<StudentDashboard />} />
              <Route path="/s/schedule" element={<StudentSchedule />} />
              <Route path="/s/content" element={<StudentContent />} />
              <Route path="/s/exams" element={<StudentExams />} />
              <Route path="/s/mock-exams" element={<StudentMockExams />} />
              <Route path="/s/solve" element={<ExamSolvingPage />} />
              <Route path="/s/questions" element={<StudentQuestions />} />
              <Route path="/s/live" element={<StudentLive />} />
              <Route path="/s/attendance" element={<StudentAttendance />} />
              <Route path="/s/assignments" element={<StudentAssignments />} />
              <Route path="/s/study-plan" element={<StudentStudyPlan />} />
              <Route path="/s/attendance-qr" element={<StudentAttendanceScan />} />
              <Route path="/s/exam-results" element={<StudentExamResults />} />
              <Route path="/s/wrong-answers" element={<StudentWrongAnswers />} />
              <Route path="/s/content-detail" element={<StudentContentDetail />} />
              <Route path="/s/favorites" element={<StudentFavorites />} />
              <Route path="/s/notes" element={<StudentNotes />} />
              <Route path="/s/question-practice" element={<StudentQuestionPractice />} />
              <Route path="/s/question-box" element={<StudentQuestionBox />} />
              <Route path="/s/badges" element={<StudentBadges />} />
              <Route path="/s/profile" element={<StudentProfile />} />
              <Route path="/s/ai" element={<StudentAI />} />
              <Route path="/s/notifications" element={<StudentNotifications />} />
              <Route path="/s/announcements" element={<StudentAnnouncements />} />
              <Route path="/s/settings" element={<StudentSettings />} />
              <Route path="/s/chat" element={<Chat />} />
              <Route path="/s/cafeteria" element={<CafeteriaWeeklyMenu />} />

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
              <Route path="/p/requests" element={<ParentRequests />} />
              <Route path="/p/academic" element={<ParentAcademic />} />
              <Route path="/p/service" element={<ParentService />} />
              <Route path="/p/cafeteria" element={<ParentCafeteria />} />
              <Route path="/p/profile" element={<ParentProfile />} />
              <Route path="/p/chat" element={<Chat />} />
              <Route path="/p/cafeteria" element={<CafeteriaWeeklyMenu />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
        </RouterComponent>
        </LegalConsentGate>
        <Toaster />
        </MaintenanceGate>
      </AppProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
