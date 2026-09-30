// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: backend C# DTO/entity/enum tanımları. Yeniden üret: `npm run api:types`.
/* eslint-disable */

// CourseIntellect.Domain/Entities/AccountingApproval.cs
export interface AccountingApproval {
  id: string;
  tenantId: string | null;
  title: string;
  reason: string;
  category: string;
  status: string;
  sourceType: string;
  sourceKey: string;
  updatedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingApprovalDto.cs
export interface AccountingApprovalDto {
  id: string;
  title: string;
  reason: string;
  category: string;
  status: string;
  sourceType: string;
  sourceKey: string;
  updatedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/AccountingAuditLog.cs
export interface AccountingAuditLog {
  id: string;
  tenantId: string | null;
  title: string;
  detail: string;
  time: string;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingAuditLogDto.cs
export interface AccountingAuditLogDto {
  id: string;
  title: string;
  detail: string;
  time: string;
}

// CourseIntellect.Api/Controllers/AccountingController.cs
export interface AccountingBenefitSnapshot {
  id: string;
  studentName: string;
  studentUsername: string;
  className: string;
  benefitType: string;
  title: string;
  rate: string;
  totalAmount: string;
  netAmount: string;
  status: string;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingCollectionDto.cs
export interface AccountingCollectionDto {
  id: string;
  name: string;
  className: string;
  amount: string;
  method: string;
  time: string;
  note: string;
  branchName: string | null;
  collectedByName: string | null;
  entryType: string;
  originalPaymentId: string | null;
  refundReason: string;
  refundChannel: string;
  externalReference: string;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingDashboardDto.cs
export interface AccountingDashboardDto {
  invoices: AccountingInvoiceDto[];
  salaries: AccountingSalaryDto[];
  approvals: AccountingApprovalDto[];
  collections: AccountingCollectionDto[];
  installments: AccountingInstallmentDto[];
  notifications: AccountingNotificationDto[];
  auditLogs: AccountingAuditLogDto[];
}

// CourseIntellect.Application/DTOs/Accounting/AccountingInstallmentDto.cs
export interface AccountingInstallmentDto {
  id: string;
  student: string;
  status: string;
  amount: string;
  due: string;
  note: string;
}

// CourseIntellect.Domain/Entities/AccountingInvoice.cs
export interface AccountingInvoice {
  id: string;
  tenantId: string | null;
  invoiceNumber: string;
  title: string;
  counterparty: string;
  category: string;
  subtitle: string;
  amount: string;
  status: string;
  issueDateUtc: string;
  dueDateUtc: string | null;
  paidAtUtc: string | null;
  paymentMethod: string;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingInvoiceDto.cs
export interface AccountingInvoiceDto {
  id: string;
  invoiceNumber: string;
  title: string;
  counterparty: string;
  category: string;
  subtitle: string;
  amount: string;
  status: string;
  issueDateUtc: string;
  dueDateUtc: string | null;
  paidAtUtc: string | null;
  paymentMethod: string;
  note: string;
}

// CourseIntellect.Domain/Entities/AccountingNotification.cs
export interface AccountingNotification {
  id: string;
  tenantId: string | null;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingNotificationDto.cs
export interface AccountingNotificationDto {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

// CourseIntellect.Domain/Entities/AccountingSalary.cs
export interface AccountingSalary {
  id: string;
  tenantId: string | null;
  employee: string;
  role: string;
  amount: string;
  payDate: string;
  status: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Accounting/AccountingSalaryDto.cs
export interface AccountingSalaryDto {
  id: string;
  employee: string;
  role: string;
  amount: string;
  payDate: string;
  status: string;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface AddContentCommentRequest {
  message: string;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface AddGrantRequest {
  level: string;
  targetId?: string | null;
  accessMode: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface AddRegistrationBlocklistRequest {
  kind: string;
  value: string;
  reason?: string | null;
}

// CourseIntellect.Application/DTOs/StudyPlans/UpdateStudyPlanStateRequest.cs
export interface AddStudyPlanXpRequest {
  amount: number;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface AddTeacherReviewRequest {
  questionAttemptId: string;
  comment: string;
}

// CourseIntellect.Application/DTOs/Analytics/AdminAnalyticsDtos.cs
export interface AdminAnalyticsBucket {
  start: string;
  label: string;
  revenue: number;
  registrations: number;
  expense: number;
}

// CourseIntellect.Application/DTOs/Analytics/AdminAnalyticsDtos.cs
export interface AdminAnalyticsResponse {
  period: string;
  rangeStart: string;
  rangeEnd: string;
  buckets: AdminAnalyticsBucket[];
  totals: AdminAnalyticsTotals;
}

// CourseIntellect.Application/DTOs/Analytics/AdminAnalyticsDtos.cs
export interface AdminAnalyticsTotals {
  revenue: number;
  registrations: number;
  expense: number;
  net: number;
}

// CourseIntellect.Application/DTOs/Users/AdminCreateUserRequest.cs
export interface AdminCreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
}

// CourseIntellect.Domain/Entities/AdminDocument.cs
export interface AdminDocument {
  id: string;
  tenantId: string | null;
  title: string;
  category: string;
  direction: string;
  documentNo: string;
  relatedParty: string;
  fileUrl: string;
  contentType: string;
  status: string;
  note: string;
  uploadedByUserId: string | null;
  uploadedByName: string;
  expiryDateUtc: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Admin/AdminDocumentDtos.cs
export interface AdminDocumentDto {
  id: string;
  title: string;
  category: string;
  direction: string;
  documentNo: string;
  relatedParty: string;
  fileUrl: string;
  contentType: string;
  status: string;
  note: string;
  uploadedByName: string;
  expiryDateUtc: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface AdminServiceLiveTripDto {
  tripId: string;
  routeId: string;
  routeName: string;
  tripType: string;
  status: string;
  driverName: string;
  driverPhone: string;
  plateNumber: string;
  vehicleNumber: string;
  startedAt: string | null;
  studentCount: number;
  boardedCount: number;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  lastLocationAt: string | null;
}

// CourseIntellect.Domain/Entities/AdminTask.cs
export interface AdminTask {
  id: string;
  tenantId: string | null;
  title: string;
  description: string;
  category: string;
  assignedToUserId: string | null;
  assignedToName: string;
  priority: string;
  status: string;
  createdByUserId: string | null;
  createdByName: string;
  dueDateUtc: string | null;
  startDateUtc: string | null;
  endDateUtc: string | null;
  responseStatus: string;
  rejectionReason: string;
  respondedAtUtc: string | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Admin/AdminTaskDtos.cs
export interface AdminTaskDto {
  id: string;
  title: string;
  description: string;
  category: string;
  assignedToName: string;
  priority: string;
  status: string;
  createdByName: string;
  dueDateUtc: string | null;
  startDateUtc: string | null;
  endDateUtc: string | null;
  responseStatus: string;
  rejectionReason: string;
  respondedAtUtc: string | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Users/AdminUpdateUserRequest.cs
export interface AdminUpdateUserRequest {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  isEmailVerified?: boolean | null;
}

// CourseIntellect.Application/DTOs/Users/AdminUserListItemDto.cs
export interface AdminUserListItemDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface AgingBucketDto {
  label: string;
  count: number;
  amount: number;
}

// CourseIntellect.Api/Controllers/SchoolDashboardController.cs
export interface AlertItem {
  type: string;
  severity: string;
  title: string;
  message: string;
  actionPath: string;
}

// CourseIntellect.Application/DTOs/Announcements/AnnouncementDto.cs
export interface AnnouncementDto {
  id: string;
  title: string;
  detail: string;
  audience: string;
  dateLabel: string;
  className: string | null;
  teacherName: string | null;
}

// CourseIntellect.Domain/Entities/AnnouncementItem.cs
export interface AnnouncementItem {
  id: string;
  tenantId: string | null;
  title: string;
  detail: string;
  audience: string;
  dateLabel: string;
  className: string | null;
  teacherName: string | null;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface AnswerSelection {
  id: string;
  tenantId: string | null;
  questionAttemptId: string;
  selectedOptionIndex: number;
  openAnswer: string | null;
  isCorrect: boolean;
  savedAtUtc: string;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface AnswerSelectionResponse {
  id: string;
  selectedOptionIndex: number;
  openAnswer: string | null;
  isCorrect: boolean;
  savedAtUtc: string;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface ApprovalDecisionRequest {
  status: string;
  note?: string | null;
}

// CourseIntellect.Domain/Entities/ApprovalRequest.cs
export interface ApprovalRequest {
  id: string;
  tenantId?: string | null;
  category: string;
  title: string;
  description: string;
  requesterUserId?: string | null;
  requesterName: string;
  unit: string;
  amount?: number | null;
  priority: string;
  status: string;
  decisionNote: string;
  decidedByUserId?: string | null;
  decidedByName: string;
  referenceType: string;
  referenceKey: string;
  createdAtUtc: string;
  decidedAtUtc?: string | null;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface ApprovalRequestDto {
  id: string;
  category: string;
  title: string;
  description: string;
  requesterName: string;
  unit: string;
  amount: number | null;
  priority: string;
  status: string;
  decisionNote: string;
  decidedByName: string;
  referenceType: string;
  referenceKey: string;
  createdAtUtc: string;
  decidedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/AppSetting.cs
export interface AppSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/AppSettings/AppSettingDto.cs
export interface AppSettingDto {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/AppUser.cs
export interface AppUser {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  customRoleId: string | null;
  fullName: string;
  username: string;
  passwordHash: string;
  primaryRole: UserRole;
  status: UserStatus;
  campus: string;
  departmentOrBranch: string;
  phone: string | null;
  tcNo: string;
  photoUrl: string;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAtUtc: string | null;
  createdAtUtc: string;
  lastLoginAtUtc: string | null;
  extraRolesSerialized: string;
  roleHistorySerialized: string;
  extraRoles: UserRole[];
  roleHistory: string[];
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface AssignAssetRequest {
  staffUserId?: string | null;
  staffName: string;
  assetName: string;
  assetCode?: string | null;
  note?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface AssignedStudentResponse {
  assignmentId: string;
  studentId: string;
  studentFullName: string;
  parentId: string;
  parentFullName: string;
  parentPhone: string;
  className: string;
  stopId: string;
  stopName: string;
  routeId: string;
  routeName: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface AssignTenantGroupRequest {
  groupId?: string | null;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantActionDto {
  type: string;
  label: string;
  route: string | null;
  command: string | null;
  parameters: unknown | null;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantActionRequest {
  conversationId: string;
  command: string;
  studentId?: string | null;
}

// CourseIntellect.Domain/Entities/AssistantEntities.cs
export interface AssistantAuditLog {
  id: string;
  tenantId: string | null;
  userId: string;
  conversationId: string;
  intent: AssistantIntent;
  toolName: string;
  targetStudentId: string | null;
  wasAuthorized: boolean;
  failureReasonCode: string;
  correlationId: string;
  ipAddressMasked: string;
  userAgent: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantClientContext {
  currentRoute: string | null;
  selectedStudentId: string | null;
}

// CourseIntellect.Domain/Entities/AssistantEntities.cs
export interface AssistantConversation {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  userId: string;
  title: string;
  selectedStudentId: string | null;
  lastIntent: AssistantIntent | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastMessageAtUtc: string | null;
  isArchived: boolean;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantConversationDto {
  id: string;
  title: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastMessageAtUtc: string | null;
}

// CourseIntellect.Domain/Enums/AssistantEnums.cs
export const AssistantIntent = {
  Unknown: 0,
  Help: 1,
  Greeting: 2,
  SearchStudent: 3,
  GetStudentSummary: 4,
  GetAttendance: 5,
  GetExamResults: 6,
  GetExamAverage: 7,
  GetHomework: 8,
  GetSchedule: 9,
  GetUpcomingExams: 10,
  GetAnnouncements: 11,
  GetUnreadMessages: 12,
  GetPaymentSummary: 13,
  GetTransportStatus: 14,
  ListClassStudents: 15,
  ListAbsentStudents: 16,
  ListLowScoreStudents: 17,
  ListStudentsWithDebt: 18,
  OpenStudentDetail: 19,
  GetDrivingLessons: 20,
  GetDrivingExamStatus: 21,
  GetDrivingProgress: 22,
  GetDrivingDocuments: 23,
  GetDrivingAppointments: 24,
  GetDrivingGraduation: 25,
  GetLibraryLoans: 26,
  SendDocumentReminder: 27,
  NotifyParentAboutAbsence: 28,
  GetFinanceOverview: 29,
  GetInstitutionSummary: 30,
} as const;
export type AssistantIntent = (typeof AssistantIntent)[keyof typeof AssistantIntent];

// CourseIntellect.Domain/Services/AssistantIntentCatalog.cs
export interface AssistantIntentScope {
  institutionTypes: InstitutionType[];
  requiredModule: string | null;
  deniedRoles: string[];
}

// CourseIntellect.Domain/Entities/AssistantEntities.cs
export interface AssistantMessage {
  id: string;
  tenantId: string | null;
  conversationId: string;
  userId: string;
  senderType: AssistantSenderType;
  messageType: AssistantMessageType;
  text: string;
  intent: AssistantIntent;
  structuredPayloadJson: string;
  clientMessageId: string | null;
  processingDurationMs: number | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantMessageDto {
  id: string;
  sender: string;
  type: string;
  text: string;
  intent: AssistantIntent;
  data: unknown | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/AssistantEnums.cs
export const AssistantMessageType = {
  Text: 1,
  Structured: 2,
  Error: 3,
  PermissionDenied: 4,
} as const;
export type AssistantMessageType = (typeof AssistantMessageType)[keyof typeof AssistantMessageType];

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantRequestContext {
  userId: string;
  tenantId: string;
  branchId: string | null;
  primaryRole: string;
  roles: string[];
  principal: unknown;
  correlationId: string;
  ipAddress: string;
  userAgent: string;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantResponseDto {
  conversationId: string;
  messageId: string;
  type: string;
  text: string;
  data: unknown | null;
  actions: AssistantActionDto[];
  suggestions: string[];
  intent: AssistantIntent;
}

// CourseIntellect.Domain/Enums/AssistantEnums.cs
export const AssistantSenderType = {
  User: 1,
  Assistant: 2,
  System: 3,
} as const;
export type AssistantSenderType = (typeof AssistantSenderType)[keyof typeof AssistantSenderType];

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface AssistantSuggestionDto {
  label: string;
  command: string;
  category: string;
}

// CourseIntellect.Domain/Entities/AttendanceEntry.cs
export interface AttendanceEntry {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentName: string;
  className: string;
  lessonDate: string;
  status: string;
  lesson: string;
}

// CourseIntellect.Application/DTOs/Attendance/AttendanceEntryDto.cs
export interface AttendanceEntryDto {
  id: string;
  studentName: string;
  className: string;
  lessonDate: string;
  status: string;
  lesson: string;
}

// CourseIntellect.Api/Controllers/AttendanceQrSessionsController.cs
export interface AttendanceQrCheckInRequest {
  token: string;
  studentName?: string | null;
}

// CourseIntellect.Api/Controllers/AttendanceQrSessionsController.cs
export interface AttendanceQrOpenRequest {
  className: string;
  lessonTitle: string;
  durationMinutes?: number | null;
}

// CourseIntellect.Api/Controllers/AttendanceQrSessionsController.cs
export interface AttendanceQrScanEntry {
  studentName: string;
  scannedAtUtc: string;
}

// CourseIntellect.Api/Controllers/AttendanceQrSessionsController.cs
export interface AttendanceQrSessionSnapshot {
  id: string;
  className: string;
  lessonTitle: string;
  teacherName: string;
  token: string;
  openedAtUtc: string;
  expiresAtUtc: string;
  closedAtUtc: string | null;
  status: string;
  scannedStudents: AttendanceQrScanEntry[];
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface AuditBranchSummaryDto {
  branchId: string | null;
  branchName: string;
  totalCount: number;
  last7DaysCount: number;
  lastActivityUtc: string | null;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface AuditLogDto {
  id: string;
  actorName: string;
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAtUtc: string;
  branchId: string | null;
  branchName: string;
  ipAddress: string | null;
  userAgent: string | null;
  actorRole: string | null;
  source: string;
  success: boolean | null;
}

// CourseIntellect.Domain/Entities/AuditLogEntry.cs
export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  actorUserId: string | null;
  actorName: string;
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  detail: string;
  beforeValue: string | null;
  afterValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  actorRole: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface AuditLogPageDto {
  items: AuditLogDto[];
  totalCount: number;
  skip: number;
  take: number;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface AuditLogQuery {
  category: string | null;
  branchId: string | null;
  search: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  skip: number;
  take: number;
  source: string;
  onlyFailedLogins: boolean;
  actor: string | null;
}

// CourseIntellect.Domain/Entities/AuthorizationCode.cs
export interface AuthorizationCode {
  id: string;
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallengeHash: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  isUsed: boolean;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface BankStatementRow {
  reference: string;
  amount: number;
  date: string;
  description: string | null;
}

// CourseIntellect.Api/Controllers/LibraryController.cs
export interface BulkBooksRequest {
  books: LibraryBook[];
}

// CourseIntellect.Application/DTOs/Translations/BulkUpsertTranslationRequest.cs
export interface BulkUpsertTranslationRequest {
  items: UpsertTranslationRequest[];
}

// CourseIntellect.Api/Controllers/CafeteriaController.cs
export interface CafeteriaMealEntry {
  date: string;
  mealType: string;
  startTime: string;
  endTime: string;
  items: string[];
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  allergens: string[];
  description: string;
}

// CourseIntellect.Api/Controllers/CafeteriaController.cs
export interface CafeteriaMealEntryRequest {
  date: string;
  mealType: string;
  startTime: string;
  endTime: string;
  items: string[];
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  allergens: string[];
  description?: string | null;
}

// CourseIntellect.Api/Controllers/CafeteriaController.cs
export interface CafeteriaWeekRequest {
  weekStart: string;
  note?: string | null;
  meals: CafeteriaMealEntryRequest[];
}

// CourseIntellect.Api/Controllers/CafeteriaController.cs
export interface CafeteriaWeekSnapshot {
  id: string;
  weekStart: string;
  weekEnd: string;
  note: string;
  meals: CafeteriaMealEntry[];
  updatedBy: string;
  updatedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface CanvasSnapshot {
  id: string;
  tenantId: string | null;
  questionAttemptId: string;
  storageKey: string;
  contentType: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/Interfaces/IExamSolvingService.cs
export interface CanvasSnapshotSavedResult {
  id: string;
  url: string;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface CanvasStroke {
  id: string;
  tenantId: string | null;
  questionAttemptId: string;
  tool: string;
  color: string;
  width: number;
  opacity: number;
  pressure: number | null;
  pointsJson: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/Interfaces/ICaptchaVerificationService.cs
export interface CaptchaVerificationResult {
  status: CaptchaVerificationStatus;
  detail: string | null;
  readonly isAllowed?: boolean;
}

// CourseIntellect.Application/Interfaces/ICaptchaVerificationService.cs
export const CaptchaVerificationStatus = {
  Success: 0,
  Failed: 1,
  SkippedNotConfigured: 2,
} as const;
export type CaptchaVerificationStatus = (typeof CaptchaVerificationStatus)[keyof typeof CaptchaVerificationStatus];

// CourseIntellect.Application/DTOs/Auth/ChangePasswordRequest.cs
export interface ChangePasswordRequest {
  currentPassword?: string | null;
  newPassword: string;
}

// CourseIntellect.Api/Controllers/LibraryController.cs
export interface CheckoutRequest {
  bookId: string;
  studentName: string;
  className?: string | null;
}

// CourseIntellect.Api/Controllers/UploadsController.cs
export interface ChunkedFileUploadRequest {
  uploadId: string;
  fileName: string;
  base64Content: string;
  contentType?: string | null;
  folder?: string | null;
  startByte: number;
  totalSize: number;
  chunkIndex: number;
  totalChunks: number;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface ClassCourseAssignmentRequest {
  courseName: string;
  teacherId?: string | null;
  weeklyHours: number;
  isRequired: boolean;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface ClassModuleSettingsRequest {
  attendance: boolean;
  grades: boolean;
  liveLessons: boolean;
  homework: boolean;
  study: boolean;
  messaging: boolean;
}

// CourseIntellect.Api/Controllers/ExamResultsController.cs
export interface ClassRankingDto {
  rank: number;
  totalStudents: number;
  average: number;
  className: string;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface ClassTeacherAssignmentRequest {
  teacherId?: string | null;
  role?: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface CollectDownPaymentRequest {
  method?: string | null;
}

// CourseIntellect.Infrastructure/Services/TenantBackupService.cs
export interface ColumnAccessor {
  name: string;
  info: unknown;
  redacted: boolean;
}

// CourseIntellect.Api/Controllers/GuidanceController.cs
export interface CompleteInventoryRequest {
  answersJson: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface ConfirmPaymentRequest {
  intentId: string;
  token?: string | null;
}

// CourseIntellect.Api/Controllers/ConsentController.cs
export interface ConsentBranding {
  institutionName: string;
  logoBytes: string | null;
  accentColor: string;
  footerNote: string;
}

// CourseIntellect.Domain/Enums/ConsentEnums.cs
export const ConsentContextKind = {
  General: 'General',
  SchoolEnrollment: 'SchoolEnrollment',
  DrivingEnrollment: 'DrivingEnrollment',
  DrivingLesson: 'DrivingLesson',
  DrivingGraduation: 'DrivingGraduation',
  Transport: 'Transport',
  Trip: 'Trip',
  Cafeteria: 'Cafeteria',
  Health: 'Health',
  MediaRelease: 'MediaRelease',
} as const;
export type ConsentContextKind = (typeof ConsentContextKind)[keyof typeof ConsentContextKind];

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentContextKindDto {
  kind: ConsentContextKind;
  label: string;
  description: string;
  module: string;
}

// CourseIntellect.Domain/Entities/ConsentEntities.cs
export interface ConsentDocument {
  id: string;
  tenantId: string | null;
  fileName: string;
  sha256: string;
  byteSize: number;
  pageCount: number;
  content: string;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentDocumentContent {
  fileName: string;
  sha256: string;
  pageCount: number;
  content: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentDocumentDto {
  id: string;
  fileName: string;
  pageCount: number;
  byteSize: number;
  sha256: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/ConsentEnums.cs
export const ConsentDocumentSource = {
  Text: 'Text',
  Pdf: 'Pdf',
} as const;
export type ConsentDocumentSource = (typeof ConsentDocumentSource)[keyof typeof ConsentDocumentSource];

// CourseIntellect.Application/Interfaces/IConsentFormPdfService.cs
export interface ConsentDocumentStamp {
  fileName: string;
  sha256: string;
  pageCount: number;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentFormDto {
  id: string;
  templateId: string | null;
  studentProfileId: string;
  studentName: string;
  contextKind: ConsentContextKind;
  contextKey: string;
  contextRefId: string | null;
  contextLabel: string;
  title: string;
  body: string;
  checkItems: string[];
  checkedItems: number[];
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  staffName: string;
  staffNotes: string;
  status: ConsentFormStatus;
  stationName: string;
  sessionExpiresAtUtc: string | null;
  hasSignature: boolean;
  signedAtUtc: string | null;
  signerName: string;
  signerRelation: string;
  createdAtUtc: string;
  sourceKind: ConsentDocumentSource;
  documentId: string | null;
  documentFileName: string;
  documentPageCount: number;
}

// CourseIntellect.Domain/Entities/ConsentEntities.cs
export interface ConsentFormRecord {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentProfileId: string;
  studentUserId: string | null;
  studentName: string;
  contextKind: ConsentContextKind;
  contextKey: string;
  contextRefId: string | null;
  contextLabel: string;
  templateId: string | null;
  title: string;
  sourceKind: ConsentDocumentSource;
  documentId: string | null;
  body: string;
  checkItemsJson: string;
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  staffUserId: string | null;
  staffName: string;
  staffNotes: string;
  status: ConsentFormStatus;
  sessionToken: string | null;
  stationName: string;
  stationKey: string;
  sessionExpiresAtUtc: string | null;
  checkedItemsJson: string;
  signatureImage: string;
  signedAtUtc: string | null;
  signerName: string;
  signerRelation: string;
  signerDevice: string;
  signerIp: string;
  createdByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/ConsentEntities.cs
export interface ConsentFormRequirement {
  id: string;
  tenantId: string | null;
  templateId: string;
  contextKind: ConsentContextKind;
  contextKey: string;
}

// CourseIntellect.Domain/Enums/ConsentEnums.cs
export const ConsentFormStatus = {
  Draft: 'Draft',
  AwaitingSignature: 'AwaitingSignature',
  Signed: 'Signed',
  Cancelled: 'Cancelled',
} as const;
export type ConsentFormStatus = (typeof ConsentFormStatus)[keyof typeof ConsentFormStatus];

// CourseIntellect.Domain/Entities/ConsentEntities.cs
export interface ConsentFormTemplate {
  id: string;
  tenantId: string | null;
  title: string;
  sourceKind: ConsentDocumentSource;
  documentId: string | null;
  body: string;
  checkItemsJson: string;
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  isActive: boolean;
  sortOrder: number;
  isDeleted: boolean;
  deletedAtUtc: string | null;
  createdByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormPdfService.cs
export interface ConsentPdfInspection {
  valid: boolean;
  message: string;
  pageCount: number;
}

// CourseIntellect.Application/Interfaces/IConsentFormPdfService.cs
export interface ConsentPdfModel {
  institutionName: string;
  title: string;
  body: string;
  checkItems: string[];
  checkedItems: number[];
  studentName: string;
  contextLabel: string;
  staffName: string;
  staffNotes: string;
  signerLabel: string;
  signerName: string;
  signerRelation: string;
  signedAtUtc: string | null;
  signatureImage: string | null;
  logoBytes: string | null;
  accentColor: string;
  footerNote: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentRequirementDto {
  templateId: string;
  title: string;
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  formId: string | null;
  status: ConsentFormStatus | null;
  signedAtUtc: string | null;
  stationName: string;
  contextLabel: string;
  sourceKind: ConsentDocumentSource;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentResult<T> {
  statusCode: number;
  message: string;
  value: T | null;
  readonly ok?: boolean;
}

// CourseIntellect.Domain/Entities/ConsentEntities.cs
export interface ConsentSignatureStation {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  stationKey: string;
  deviceInfo: string;
  lastSeenAtUtc: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/ConsentEnums.cs
export const ConsentSignerRole = {
  Student: 'Student',
  Parent: 'Parent',
  StudentOrParent: 'StudentOrParent',
} as const;
export type ConsentSignerRole = (typeof ConsentSignerRole)[keyof typeof ConsentSignerRole];

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentStationDto {
  id: string;
  name: string;
  online: boolean;
  lastSeenAtUtc: string;
  hasPendingForm: boolean;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentStationFormDto {
  id: string;
  sessionToken: string;
  title: string;
  body: string;
  checkItems: string[];
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  studentName: string;
  contextLabel: string;
  staffName: string;
  staffNotes: string;
  sessionExpiresAtUtc: string | null;
  sourceKind: ConsentDocumentSource;
  documentFileName: string;
  documentPageCount: number;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentStatusDto {
  complete: boolean;
  requiredCount: number;
  signedCount: number;
  requirements: ConsentRequirementDto[];
  otherForms: ConsentFormDto[];
  studentProfileId: string;
  studentName: string;
  contextLabel: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentTemplateBindingDto {
  contextKind: ConsentContextKind;
  contextKey: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface ConsentTemplateDto {
  id: string;
  title: string;
  body: string;
  checkItems: string[];
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  isActive: boolean;
  sortOrder: number;
  bindings: ConsentTemplateBindingDto[];
  updatedAtUtc: string;
  sourceKind: ConsentDocumentSource;
  documentId: string | null;
  documentFileName: string;
  documentPageCount: number;
}

// CourseIntellect.Domain/Entities/ContactMessage.cs
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  isStarred: boolean;
  ipAddress: string;
  createdAtUtc: string;
  readAtUtc: string | null;
  repliedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/ContactMessages/ContactMessageDetailDto.cs
export interface ContactMessageDetailDto {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  isStarred: boolean;
  ipAddress: string;
  createdAtUtc: string;
  readAtUtc: string | null;
  repliedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/ContactMessages/ContactMessageDto.cs
export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  subject: string;
  status: string;
  isStarred: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
  repliedAtUtc: string | null;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface ContentCommentDto {
  id: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Contents/ContentDto.cs
export interface ContentDto {
  id: string;
  subject: string;
  title: string;
  teacher: string;
  info: string;
  progress: number;
  fileType: string;
  grade: string;
  views: string;
  size: string;
  description: string;
  fileName: string | null;
  fileUrl: string | null;
  coverImageUrl: string | null;
  playlistKey: string | null;
  playlistTitle: string | null;
  playlistOrder: number | null;
  allowDownload: boolean;
  allowNotes: boolean;
  completionCertificate: boolean;
  publishStatus: string;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface ContentEngagementResponse {
  coverImageUrl: string | null;
  exercises: ContentExerciseDto[];
  comments: ContentCommentDto[];
  progress: number;
  liked: boolean;
  favorite: boolean;
  note: string;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface ContentExerciseDto {
  id: string;
  title: string;
  description: string;
  url: string;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface ContentExtrasState {
  coverImageUrl: string | null;
  exercises: ContentExerciseDto[];
  comments: ContentCommentDto[];
}

// CourseIntellect.Domain/Entities/ContentItem.cs
export interface ContentItem {
  id: string;
  tenantId: string | null;
  subject: string;
  title: string;
  teacher: string;
  info: string;
  progress: number;
  fileType: string;
  grade: string;
  views: string;
  size: string;
  description: string;
  fileName: string | null;
  fileUrl: string | null;
  coverImageUrl: string | null;
  playlistKey: string | null;
  playlistTitle: string | null;
  playlistOrder: number | null;
  allowDownload: boolean;
  allowNotes: boolean;
  completionCertificate: boolean;
  publishStatus: string;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface ContentUserState {
  progress: number;
  liked: boolean;
  favorite: boolean;
  note: string;
  updatedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Courses/CourseDto.cs
export interface CourseDto {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: string;
  level: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/CourseItem.cs
export interface CourseItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: string;
  level: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Api/Controllers/AccountingController.cs
export interface CreateAccountingBenefitRequest {
  studentName: string;
  studentUsername: string;
  className: string;
  benefitType: string;
  title?: string | null;
  rate: string;
  totalAmount?: string | null;
  note?: string | null;
}

// CourseIntellect.Application/DTOs/Accounting/CreateAccountingNotificationRequest.cs
export interface CreateAccountingNotificationRequest {
  title: string;
  message: string;
}

// CourseIntellect.Application/DTOs/Staff/CreateAccountingStaffRequest.cs
export interface CreateAccountingStaffRequest {
  fullName: string;
  tcNo: string;
  phone: string;
  email: string;
  education: string;
  startDate: string;
  campus: string;
  maritalStatus: string;
  childCount: number;
  note: string;
  photoUrl?: string | null;
}

// CourseIntellect.Application/DTOs/Announcements/CreateAnnouncementRequest.cs
export interface CreateAnnouncementRequest {
  title: string;
  detail: string;
  audience: string;
  className?: string | null;
  teacherName?: string | null;
}

// CourseIntellect.Application/DTOs/Admin/AdminWorkflowDtos.cs
export interface CreateApprovalRequest {
  category: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  priority?: string | null;
  unit?: string | null;
  referenceType?: string | null;
  referenceKey?: string | null;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface CreateAssistantConversationRequest {
  title?: string | null;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface CreateClassRequest {
  name: string;
}

// CourseIntellect.Application/DTOs/Accounting/CreateCollectionRequest.cs
export interface CreateCollectionRequest {
  name: string;
  className: string;
  amount: string;
  method: string;
  note: string;
  studentUserId?: string | null;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface CreateCompleteClassRequest {
  name: string;
  code?: string | null;
  school?: string | null;
  institutionUnit?: string | null;
  grade?: string | null;
  section?: string | null;
  academicYear?: string | null;
  advisorTeacherId?: string | null;
  description?: string | null;
  themeColor?: string | null;
  icon?: string | null;
  teachers: ClassTeacherAssignmentRequest[];
  courses: ClassCourseAssignmentRequest[];
  studentIds: string[];
  modules: ClassModuleSettingsRequest;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface CreateConsentFormRequest {
  templateId: string;
  studentProfileId: string;
  contextKind: ConsentContextKind;
  contextKey?: string | null;
  contextRefId?: string | null;
  contextLabel?: string | null;
  staffNotes?: string | null;
}

// CourseIntellect.Application/DTOs/ContactMessages/CreateContactMessageRequest.cs
export interface CreateContactMessageRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// CourseIntellect.Application/DTOs/Contents/CreateContentRequest.cs
export interface CreateContentRequest {
  subject: string;
  title: string;
  teacher: string;
  info: string;
  progress: number;
  fileType: string;
  grade: string;
  views: string;
  size: string;
  description: string;
  fileName?: string | null;
  fileUrl?: string | null;
  publishStatus: string;
  coverImageUrl?: string | null;
  playlistKey?: string | null;
  playlistTitle?: string | null;
  playlistOrder?: number | null;
  allowDownload?: boolean;
  allowNotes?: boolean;
  completionCertificate?: boolean;
}

// CourseIntellect.Application/DTOs/Courses/CreateCourseRequest.cs
export interface CreateCourseRequest {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: string;
  level: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/Admin/AdminDocumentDtos.cs
export interface CreateDocumentRequest {
  title: string;
  category: string;
  direction: string;
  documentNo?: string | null;
  relatedParty?: string | null;
  fileUrl?: string | null;
  contentType?: string | null;
  expiryDate?: string | null;
  note?: string | null;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface CreateDutyRequest {
  dutyType: string;
  location: string;
  dutyDate: string;
  day: string;
  startTime: string;
  endTime: string;
  description?: string | null;
  teachers: DutyTeacherRef[];
  repeatWeekly?: boolean;
  repeatWeeks?: number;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface CreateDutyResult {
  created: DutyResponse[];
  conflicts: DutyConflictDto[];
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface CreateEnrollmentRequest {
  studentUserId?: string | null;
  studentName: string;
  className: string;
  academicYear: string;
  grossAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  downPayment: number;
  installmentCount: number;
  firstInstallmentDate?: string | null;
  currency?: string | null;
  note?: string | null;
  downPaymentMethod?: string | null;
  downPaymentPaid?: boolean;
  scholarshipPercent?: number;
}

// CourseIntellect.Application/DTOs/ExamResults/CreateExamResultRequest.cs
export interface CreateExamResultRequest {
  examTitle: string;
  type: string;
  subject: string;
  dateLabel: string;
  studentName: string;
  className: string;
  score: number;
  net: number;
  correctCount?: number | null;
  wrongCount?: number | null;
  totalQuestions?: number | null;
}

// CourseIntellect.Application/DTOs/Homework/CreateHomeworkAssignmentRequest.cs
export interface CreateHomeworkAssignmentRequest {
  title: string;
  className: string;
  subject: string;
  teacher: string;
  deadline: string;
  description: string;
  materials?: string[] | null;
}

// CourseIntellect.Application/DTOs/Homework/CreateHomeworkSubmissionRequest.cs
export interface CreateHomeworkSubmissionRequest {
  studentName: string;
  note: string;
  files?: string[] | null;
}

// CourseIntellect.Application/DTOs/Accounting/CreateInstallmentRequest.cs
export interface CreateInstallmentRequest {
  student: string;
  amount: string;
  due: string;
  note: string;
}

// CourseIntellect.Application/DTOs/Accounting/CreateInvoiceRequest.cs
export interface CreateInvoiceRequest {
  title: string;
  category: string;
  amount: string;
  date: string;
  reason: string;
  isPaid?: boolean;
  paymentMethod?: string | null;
  dueDateUtc?: string | null;
  counterparty?: string | null;
  invoiceNumber?: string | null;
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface CreateLeaveRequest {
  staffUserId?: string | null;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

// CourseIntellect.Application/DTOs/LoginAttempts/CreateLoginAttemptRequest.cs
export interface CreateLoginAttemptRequest {
  userId?: string | null;
  email: string;
  role: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  tenantId?: string | null;
}

// CourseIntellect.Application/DTOs/Meetings/CreateMeetingRequestRequest.cs
export interface CreateMeetingRequestRequest {
  parentName: string;
  studentName: string;
  advisor: string;
  topic: string;
  slot: string;
  onlineMeeting: boolean;
  note: string;
}

// CourseIntellect.Application/DTOs/Notifications/CreateNotificationRequest.cs
export interface CreateNotificationRequest {
  title: string;
  message: string;
  timeLabel: string;
  audience: string;
  targetRole: string;
  category: string;
}

// CourseIntellect.Application/DTOs/Admin/OrgUnitDtos.cs
export interface CreateOrgUnitRequest {
  name: string;
  unitType: string;
  parentUnitId?: string | null;
  managerName?: string | null;
  note?: string | null;
  managerUserId?: string | null;
}

// CourseIntellect.Application/DTOs/Parents/CreateParentRequest.cs
export interface CreateParentRequest {
  fullName: string;
  phone: string;
  email: string;
}

// CourseIntellect.Application/DTOs/PlatformSubscriptions/CreatePlatformSubscriptionInvoiceRequest.cs
export interface CreatePlatformSubscriptionInvoiceRequest {
  planId: string;
  planName: string;
  amount: number;
  billingPeriod: string;
  currency?: string | null;
  notes?: string | null;
  tenantId?: string | null;
}

// CourseIntellect.Application/DTOs/QuestionBank/CreateQuestionBankItemRequest.cs
export interface CreateQuestionBankItemRequest {
  subject: string;
  topic: string;
  difficulty: string;
  type: string;
  questionText: string;
  teacher: string;
  imagePath?: string | null;
  imagePlacement: string;
  options?: string[] | null;
  correctOptionIndex?: number | null;
  classTargets?: string[] | null;
  solutionAssetPath?: string | null;
  solutionAssetType?: string | null;
  revealCorrectAnswerToStudent: boolean;
  expectedAnswer?: string | null;
  richTextHtml?: string | null;
  solutionTextHtml?: string | null;
  editorMetadataJson?: string | null;
  publicationStatus?: string | null;
  questionSetKey?: string | null;
  questionSetTitle?: string | null;
  questionOrder?: number | null;
}

// CourseIntellect.Application/DTOs/QuestionThreads/CreateQuestionThreadReplyRequest.cs
export interface CreateQuestionThreadReplyRequest {
  messageText: string;
  attachments?: QuestionThreadAttachmentDto[] | null;
}

// CourseIntellect.Application/DTOs/QuestionThreads/CreateQuestionThreadRequest.cs
export interface CreateQuestionThreadRequest {
  title: string;
  subject: string;
  teacherName: string;
  questionText: string;
  attachments?: QuestionThreadAttachmentDto[] | null;
}

// CourseIntellect.Application/DTOs/Accounting/CreateSalaryRequest.cs
export interface CreateSalaryRequest {
  employee: string;
  role: string;
  amount: string;
  payDate: string;
  reason: string;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface CreateScopeGroupRequest {
  name: string;
  parentGroupId?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateServiceAbsenceRequestRequest {
  studentId: string;
  routeId: string;
  date: string;
  tripType: string;
  reason?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateServiceDriverRequest {
  userId: string;
  phoneNumber: string;
  licenseNumber: string;
  isActive?: boolean;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateServiceRouteRequest {
  name: string;
  routeType: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateServiceRouteStopRequest {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateServiceVehicleRequest {
  plateNumber: string;
  brand: string;
  model: string;
  capacity: number;
  isActive?: boolean;
  vehicleNumber?: string;
}

// CourseIntellect.Application/DTOs/SiteContent/CreateSiteContentRequest.cs
export interface CreateSiteContentRequest {
  sectionKey: string;
  contentJson: string;
  language: string;
  publish: boolean;
}

// CourseIntellect.Application/DTOs/Staff/CreateStaffRequest.cs
export interface CreateStaffRequest {
  fullName: string;
  role: string;
  departmentOrBranch: string;
  tcNo: string;
  phone: string;
  email: string;
  education: string;
  startDate: string;
  campus: string;
  homeroomClass: string;
  assignedClasses: string[];
  maritalStatus: string;
  childCount: number;
  note: string;
  branchId?: string | null;
  customRoleId?: string | null;
  photoUrl?: string | null;
}

// CourseIntellect.Application/DTOs/Students/CreateStudentRequest.cs
export interface CreateStudentRequest {
  fullName: string;
  tcNo: string;
  className: string;
  currentSchool: string;
  schoolNumber: string;
  birthDate: string;
  programType: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  note: string;
  photoUrl?: string | null;
  enrollmentGrossAmount?: number | null;
  enrollmentDiscountAmount?: number | null;
  enrollmentDiscountReason?: string | null;
  enrollmentDownPayment?: number | null;
  enrollmentInstallmentCount?: number | null;
  academicYear?: string | null;
  enrollmentDownPaymentMethod?: string | null;
  enrollmentDownPaymentPaid?: boolean;
  enrollmentScholarshipPercent?: number | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface CreateStudentServiceAssignmentRequest {
  studentId: string;
  parentId?: string | null;
  routeId: string;
  stopId: string;
}

// CourseIntellect.Api/Controllers/SupportTicketsController.cs
export interface CreateSupportTicketBody {
  subject: string;
  summary: string;
  category: string | null;
  priority: string | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/CreateSupportTicketRequest.cs
export interface CreateSupportTicketRequest {
  subject: string;
  tenant: string;
  user: string;
  userRole: string;
  category: string;
  priority: string;
  summary: string;
  lastMessage: string;
}

// CourseIntellect.Application/DTOs/Admin/AdminTaskDtos.cs
export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  category?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

// CourseIntellect.Application/DTOs/Messages/CreateThreadRequest.cs
export interface CreateThreadRequest {
  contactName: string;
  contactRole: string;
  initialMessage?: string | null;
}

// CourseIntellect.Application/DTOs/Auth/CurrentUserDto.cs
export interface CurrentUserDto {
  id: string;
  fullName: string;
  username: string;
  primaryRole: string;
  extraRoles: string[];
  status: string;
  campus: string;
  departmentOrBranch: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  institutionType: string | null;
  drivingSchoolModuleEnabled: boolean;
  isPlatformAdmin: boolean;
  subscriptionRequired: boolean;
  mustChangePassword: boolean;
  modules: string[];
  permissions: string[];
  hasRoleManagementPolicy: boolean;
}

// CourseIntellect.Domain/Entities/CustomRole.cs
export interface CustomRole {
  id: string;
  tenantId: string | null;
  name: string;
  baseRole: UserRole;
  modulesSerialized: string;
  modulesRestricted: boolean;
  permissionsSerialized: string;
  createdAtUtc: string;
  modules: string[];
  permissions: string[];
}

// CourseIntellect.Api/Controllers/CustomRolesController.cs
export interface CustomRoleDto {
  id: string;
  name: string;
  baseRole: string;
  modules: string[];
  permissions: string[];
  userCount: number;
  modulesRestricted: boolean;
}

// CourseIntellect.Infrastructure/Services/EntitlementService.cs
export interface CustomRoleModuleGate {
  modules: string[];
  restricted: boolean;
}

// CourseIntellect.Application/DTOs/Dashboard/DashboardActivityDto.cs
export interface DashboardActivityDto {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  timestamp: string;
}

// CourseIntellect.Application/DTOs/Dashboard/DashboardStatsDto.cs
export interface DashboardStatsDto {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  activeCourses: number;
  totalMessages: number;
  unreadMessages: number;
  totalRegistrations: number;
  pendingRegistrations: number;
  totalLoginAttempts: number;
  failedLoginAttempts: number;
}

// CourseIntellect.Api/Controllers/GuidanceController.cs
export interface DecideAppointmentRequest {
  approved: boolean;
  note?: string | null;
}

// CourseIntellect.Application/Interfaces/IDocumentIntelligenceService.cs
export interface DocumentLayoutResult {
  succeeded: boolean;
  text: string;
  pageCount: number;
  tableCount: number;
  selectionMarkCount: number;
  error: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface DriverRouteStudentDto {
  assignmentId: string;
  studentId: string;
  studentFullName: string;
  parentId: string;
  parentFullName: string;
  parentPhone: string;
  className: string;
  stopId: string;
  stopName: string;
  stopSortOrder: number;
  attendanceStatus: string;
  hasAbsenceRequest: boolean;
  absenceRequestStatus: string | null;
  etaMinutes: number | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface DriverTodayRouteDto {
  routeId: string;
  routeName: string;
  routeType: string;
  startTime: string;
  endTime: string;
  tripId: string | null;
  tripStatus: string | null;
  studentCount: number;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingAppointment {
  id: string;
  tenantId: string | null;
  studentDrivingProfileId: string;
  instructorProfileId: string;
  vehicleId: string;
  branchId: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
  status: DrivingAppointmentStatus;
  notes: string;
  meetingPoint: string;
  checkedInAtUtc: string | null;
  cancellationReason: string;
  cancelledByUserId: string | null;
  cancelledAtUtc: string | null;
  rescheduledFromAppointmentId: string | null;
  rescheduledToAppointmentId: string | null;
  createdByUserId: string | null;
  createdAtUtc: string;
  autoCompleted: boolean;
  attendanceConfirmed: boolean;
  attendanceMarkedByUserId: string | null;
  attendanceMarkedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/DrivingGraduationEntities.cs
export interface DrivingAppointmentRequest {
  id: string;
  tenantId?: string | null;
  branchId?: string | null;
  studentDrivingProfileId: string;
  requestType: DrivingAppointmentRequestType;
  status: DrivingAppointmentRequestStatus;
  sourceAppointmentId?: string | null;
  preferredInstructorProfileId?: string | null;
  preferredVehicleId?: string | null;
  requestedStartsAtUtc: string;
  requestedEndsAtUtc: string;
  meetingPoint: string;
  studentNote: string;
  decisionNote: string;
  decidedByUserId?: string | null;
  decidedAtUtc?: string | null;
  resultAppointmentId?: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingAppointmentRequestStatus = {
  Pending: 1,
  Approved: 2,
  Rejected: 3,
  Cancelled: 4,
} as const;
export type DrivingAppointmentRequestStatus = (typeof DrivingAppointmentRequestStatus)[keyof typeof DrivingAppointmentRequestStatus];

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingAppointmentRequestType = {
  NewAppointment: 1,
  Reschedule: 2,
} as const;
export type DrivingAppointmentRequestType = (typeof DrivingAppointmentRequestType)[keyof typeof DrivingAppointmentRequestType];

// CourseIntellect.Domain/Enums/DrivingSchoolEnums.cs
export const DrivingAppointmentStatus = {
  Planned: 1,
  Approved: 2,
  InProgress: 3,
  Completed: 4,
  Cancelled: 5,
  Draft: 6,
  Requested: 7,
  WaitingApproval: 8,
  CheckedIn: 9,
  CancelledByStudent: 10,
  CancelledByInstructor: 11,
  CancelledByInstitution: 12,
  NoShow: 13,
  Rescheduled: 14,
  Suspended: 15,
} as const;
export type DrivingAppointmentStatus = (typeof DrivingAppointmentStatus)[keyof typeof DrivingAppointmentStatus];

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingAppointmentStatusHistory {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  appointmentId: string;
  fromStatus: DrivingAppointmentStatus | null;
  toStatus: DrivingAppointmentStatus;
  changedByUserId: string | null;
  changedByName: string;
  reason: string;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingGraduationEntities.cs
export interface DrivingCertificate {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  graduationRecordId: string;
  studentDrivingProfileId: string;
  certificateType: DrivingCertificateType;
  documentNumber: string;
  mebbisCertificateNo: string;
  issuedAtUtc: string;
  issuedByUserId: string | null;
  deliveryStatus: DrivingCertificateDeliveryStatus;
  deliveredAtUtc: string | null;
  deliveredTo: string;
  deliveryNote: string;
  status: DrivingCertificateStatus;
  version: number;
  reissuedFromCertificateId: string | null;
  reissueReason: string;
  verificationTokenHash: string;
  pdfFileUrl: string;
  snapshotJson: string;
  revokedByUserId: string | null;
  revokedAtUtc: string | null;
  revocationReason: string;
}

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingCertificateDeliveryStatus = {
  NotDelivered: 1,
  Ready: 2,
  Delivered: 3,
  Returned: 4,
} as const;
export type DrivingCertificateDeliveryStatus = (typeof DrivingCertificateDeliveryStatus)[keyof typeof DrivingCertificateDeliveryStatus];

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingCertificateStatus = {
  Active: 1,
  Superseded: 2,
  Revoked: 3,
} as const;
export type DrivingCertificateStatus = (typeof DrivingCertificateStatus)[keyof typeof DrivingCertificateStatus];

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingCertificateType = {
  Achievement: 1,
  Completion: 2,
} as const;
export type DrivingCertificateType = (typeof DrivingCertificateType)[keyof typeof DrivingCertificateType];

// CourseIntellect.Domain/Entities/DrivingCharge.cs
export interface DrivingCharge {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  chargeType: DrivingChargeType;
  description: string;
  grossAmount: number;
  discountAmount: number;
  discountReason: string;
  netAmount: number;
  minutes: number;
  financeInstallmentId: string | null;
  enrollmentContractId: string | null;
  refundedAmount: number;
  refundReason: string;
  refundedAtUtc: string | null;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingChargeType.cs
export const DrivingChargeType = {
  ExtraLesson: 1,
  ExamFee: 2,
  FileFee: 3,
  ExtraService: 4,
  PackageDifference: 5,
  Other: 6,
} as const;
export type DrivingChargeType = (typeof DrivingChargeType)[keyof typeof DrivingChargeType];

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingExamCandidate {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  examSessionId: string;
  studentDrivingProfileId: string;
  attemptNo: number;
  previousCandidateId: string | null;
  assignedVehicleId: string | null;
  assignedInstructorProfileId: string | null;
  status: DrivingExamCandidateStatus;
  score: number | null;
  failureReason: string;
  resultNote: string;
  resultEnteredAtUtc: string | null;
  resultEnteredByUserId: string | null;
  drivingChargeId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingExamCandidateStatus = {
  Planned: 1,
  Passed: 2,
  Failed: 3,
  Cancelled: 4,
} as const;
export type DrivingExamCandidateStatus = (typeof DrivingExamCandidateStatus)[keyof typeof DrivingExamCandidateStatus];

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingExamCommissionMember {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  examSessionId: string;
  fullName: string;
  role: string;
  organization: string;
}

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingExamSession {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  examType: DrivingExamType;
  title: string;
  startsAtUtc: string;
  endsAtUtc: string;
  location: string;
  capacity: number;
  status: DrivingExamSessionStatus;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingExamSessionStatus = {
  Planned: 1,
  Completed: 2,
  Cancelled: 3,
} as const;
export type DrivingExamSessionStatus = (typeof DrivingExamSessionStatus)[keyof typeof DrivingExamSessionStatus];

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingExamType = {
  TheoryEExam: 1,
  DrivingPractice: 2,
} as const;
export type DrivingExamType = (typeof DrivingExamType)[keyof typeof DrivingExamType];

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingExcusedAbsencePolicy = {
  CountsAsAbsent: 1,
  ExcludeFromCalculation: 2,
  CountsAsPresent: 3,
} as const;
export type DrivingExcusedAbsencePolicy = (typeof DrivingExcusedAbsencePolicy)[keyof typeof DrivingExcusedAbsencePolicy];

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingExpense {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  category: DrivingExpenseCategory;
  title: string;
  vendorName: string;
  invoiceNo: string;
  amount: number;
  currency: string;
  expenseDateUtc: string;
  vehicleId: string | null;
  note: string;
  createdByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

// CourseIntellect.Domain/Enums/DrivingSchoolEnums.cs
export const DrivingExpenseCategory = {
  Fuel: 1,
  Maintenance: 2,
  Insurance: 3,
  Rent: 4,
  Utilities: 5,
  TaxFee: 6,
  Office: 7,
  Marketing: 8,
  Other: 9,
} as const;
export type DrivingExpenseCategory = (typeof DrivingExpenseCategory)[keyof typeof DrivingExpenseCategory];

// CourseIntellect.Domain/Enums/DrivingStudentEnums.cs
export const DrivingExperienceLevel = {
  None: 1,
  Some: 2,
  Experienced: 3,
} as const;
export type DrivingExperienceLevel = (typeof DrivingExperienceLevel)[keyof typeof DrivingExperienceLevel];

// CourseIntellect.Domain/Entities/DrivingGraduationEntities.cs
export interface DrivingGraduationActionRequest {
  id: string;
  tenantId?: string | null;
  branchId?: string | null;
  studentDrivingProfileId: string;
  graduationRecordId?: string | null;
  actionType: DrivingGraduationActionType;
  status: DrivingGraduationActionStatus;
  requestedChecklistKeysJson: string;
  reason: string;
  requestedByUserId: string;
  requestedAtUtc: string;
  firstApprovedByUserId?: string | null;
  firstApprovedAtUtc?: string | null;
  secondApprovedByUserId?: string | null;
  secondApprovedAtUtc?: string | null;
  rejectedByUserId?: string | null;
  rejectedAtUtc?: string | null;
  decisionNote: string;
  appliedAtUtc?: string | null;
}

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingGraduationActionStatus = {
  Pending: 1,
  FirstApproved: 2,
  Approved: 3,
  Rejected: 4,
  Applied: 5,
  Cancelled: 6,
} as const;
export type DrivingGraduationActionStatus = (typeof DrivingGraduationActionStatus)[keyof typeof DrivingGraduationActionStatus];

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingGraduationActionType = {
  EligibilityOverride: 1,
  GraduationRevocation: 2,
} as const;
export type DrivingGraduationActionType = (typeof DrivingGraduationActionType)[keyof typeof DrivingGraduationActionType];

// CourseIntellect.Domain/Entities/DrivingGraduationEntities.cs
export interface DrivingGraduationRecord {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  status: DrivingGraduationStatus;
  checklistJson: string;
  checkedAtUtc: string;
  graduatedByUserId: string | null;
  graduatedAtUtc: string | null;
  note: string;
  revokedByUserId: string | null;
  revokedAtUtc: string | null;
  revocationReason: string;
}

// CourseIntellect.Domain/Enums/DrivingGraduationEnums.cs
export const DrivingGraduationStatus = {
  Pending: 1,
  Graduated: 2,
  Revoked: 3,
} as const;
export type DrivingGraduationStatus = (typeof DrivingGraduationStatus)[keyof typeof DrivingGraduationStatus];

// CourseIntellect.Domain/Entities/DrivingAssignmentEntities.cs
export interface DrivingInstructorLeave {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  instructorProfileId: string;
  startsAtUtc: string;
  endsAtUtc: string;
  leaveType: string;
  reason: string;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingInstructorProfile {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  staffId: string;
  licenseClasses: string;
  canTeachManual: boolean;
  canTeachAutomatic: boolean;
  workingPermitNo: string;
  workingPermitExpiresAtUtc: string | null;
  isActive: boolean;
  automaticStatusEnabled: boolean;
  complianceOverrideActive: boolean;
  complianceOverrideReason: string;
  complianceOverrideByUserId: string | null;
  complianceOverrideAtUtc: string | null;
  statusChangeSource: string;
  statusChangeReason: string;
  statusChangedByUserId: string | null;
  statusChangedAtUtc: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingAssignmentEntities.cs
export interface DrivingInstructorVehicleAssignment {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  instructorProfileId: string;
  vehicleId: string;
  assignmentType: VehicleAssignmentType;
  startsOnUtc: string | null;
  endsOnUtc: string | null;
  daysOfWeekMask: number;
  priority: number;
  isActive: boolean;
  note: string;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingAssignmentEntities.cs
export interface DrivingInstructorWorkingHour {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  instructorProfileId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingLead {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  fullName: string;
  phone: string;
  licenseClass: string;
  source: string;
  note: string;
  status: string;
  contactedAtUtc: string | null;
  convertedStudentProfileId: string | null;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingAppointmentEnums.cs
export const DrivingLedgerEntryType = {
  PackageMinutes: 1,
  PlannedMinutes: 2,
  ReservationReleased: 3,
  LessonUsage: 4,
  ExtraPurchasedMinutes: 5,
  NoShowDeductedMinutes: 6,
  CancelledDeductedMinutes: 7,
  RefundedMinutes: 8,
  ManualAdjustmentMinutes: 9,
} as const;
export type DrivingLedgerEntryType = (typeof DrivingLedgerEntryType)[keyof typeof DrivingLedgerEntryType];

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingLesson {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  appointmentId: string;
  studentDrivingProfileId: string;
  instructorProfileId: string;
  vehicleId: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  startKilometer: number;
  endKilometer: number | null;
  brakesOk: boolean;
  tiresOk: boolean;
  lightsOk: boolean;
  fluidsOk: boolean;
  preCheckNote: string;
  instructorNote: string;
  trafficRulesScore: number | null;
  vehicleControlScore: number | null;
  maneuversScore: number | null;
  safetyScore: number | null;
  evaluationVersion: number;
  evaluationScoresJson: string;
  chargedMinutes: number;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingLessonLedgerEntry {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  drivingLessonId: string | null;
  appointmentId: string | null;
  minutesDelta: number;
  entryType: DrivingLedgerEntryType;
  description: string;
  reason: string;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisErrorLibrary.cs
export interface DrivingMebbisErrorDefinition {
  id: string;
  tenantId: string | null;
  code: string;
  title: string;
  description: string;
  possibleCause: string;
  resolutionStepsJson: string;
  severity: DrivingMebbisErrorSeverity;
  isSystem: boolean;
  isActive: boolean;
  version: number;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisErrorLibrary.cs
export interface DrivingMebbisErrorOccurrence {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  errorDefinitionId: string;
  studentDrivingProfileId: string | null;
  sourceType: string;
  sourceId: string | null;
  note: string;
  occurredAtUtc: string;
  reportedByUserId: string;
  reportedByName: string;
  resolvedAtUtc: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string;
  version: number;
}

// CourseIntellect.Domain/Entities/DrivingMebbisErrorLibrary.cs
export const DrivingMebbisErrorSeverity = {
  Information: 0,
  Warning: 1,
  Blocking: 2,
} as const;
export type DrivingMebbisErrorSeverity = (typeof DrivingMebbisErrorSeverity)[keyof typeof DrivingMebbisErrorSeverity];

// CourseIntellect.Domain/Entities/DrivingMebbisFieldProgress.cs
export interface DrivingMebbisFieldProgress {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  fieldKey: string;
  isCompleted: boolean;
  completedByUserId: string | null;
  completedAtUtc: string | null;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisHistoryEvent.cs
export interface DrivingMebbisHistoryEvent {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  eventType: DrivingMebbisHistoryEventType;
  severity: DrivingMebbisHistorySeverity;
  title: string;
  description: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actorUserId: string | null;
  actorName: string;
  occurredAtUtc: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisHistoryEvent.cs
export const DrivingMebbisHistoryEventType = {
  Preparation: 1,
  DocumentReview: 2,
  CandidateEntry: 3,
  Verification: 4,
  ExamResult: 5,
  CertificateNumber: 6,
  Correction: 7,
  Import: 8,
  StatusChange: 9,
} as const;
export type DrivingMebbisHistoryEventType = (typeof DrivingMebbisHistoryEventType)[keyof typeof DrivingMebbisHistoryEventType];

// CourseIntellect.Domain/Entities/DrivingMebbisHistoryEvent.cs
export const DrivingMebbisHistorySeverity = {
  Info: 1,
  Success: 2,
  Warning: 3,
  Error: 4,
} as const;
export type DrivingMebbisHistorySeverity = (typeof DrivingMebbisHistorySeverity)[keyof typeof DrivingMebbisHistorySeverity];

// CourseIntellect.Domain/Entities/DrivingMebbisImportSession.cs
export interface DrivingMebbisImportRow {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  importSessionId: string;
  rowNumber: number;
  classification: DrivingMebbisImportRowClass;
  matchKey: string;
  matchedStudentProfileId: string | null;
  matchedEntityId: string | null;
  sourceJson: string;
  changesJson: string;
  messagesJson: string;
  selectedForApply: boolean;
}

// CourseIntellect.Domain/Entities/DrivingMebbisImportSession.cs
export const DrivingMebbisImportRowClass = {
  Matched: 1,
  NotFound: 2,
  Conflict: 3,
  Change: 4,
  New: 5,
  Unchanged: 6,
  Invalid: 7,
} as const;
export type DrivingMebbisImportRowClass = (typeof DrivingMebbisImportRowClass)[keyof typeof DrivingMebbisImportRowClass];

// CourseIntellect.Domain/Entities/DrivingMebbisImportSession.cs
export interface DrivingMebbisImportSession {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  importType: DrivingMebbisImportType;
  status: DrivingMebbisImportStatus;
  studentGroupId: string | null;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  previewVersion: number;
  totalRows: number;
  matchedRows: number;
  notFoundRows: number;
  conflictRows: number;
  changeRows: number;
  newRows: number;
  invalidRows: number;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  appliedByUserId: string | null;
  appliedAtUtc: string | null;
  applySummaryJson: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisImportSession.cs
export const DrivingMebbisImportStatus = {
  PreviewReady: 1,
  Applied: 2,
  Rejected: 3,
  Failed: 4,
} as const;
export type DrivingMebbisImportStatus = (typeof DrivingMebbisImportStatus)[keyof typeof DrivingMebbisImportStatus];

// CourseIntellect.Domain/Entities/DrivingMebbisImportSession.cs
export const DrivingMebbisImportType = {
  CandidateList: 1,
  ExamResults: 2,
  CertificateNumbers: 3,
  TermList: 4,
  StudentStatuses: 5,
} as const;
export type DrivingMebbisImportType = (typeof DrivingMebbisImportType)[keyof typeof DrivingMebbisImportType];

// CourseIntellect.Domain/Entities/DrivingMebbisReconciliation.cs
export interface DrivingMebbisReconciliation {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentGroupId: string;
  status: DrivingMebbisReconciliationStatus;
  sourceSessionsJson: string;
  totalRows: number;
  matchedRows: number;
  courseOnlyRows: number;
  mebbisOnlyRows: number;
  differentRows: number;
  licenseClassDifferenceRows: number;
  termDifferenceRows: number;
  certificateDifferenceRows: number;
  examResultDifferenceRows: number;
  studentStatusDifferenceRows: number;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisReconciliation.cs
export interface DrivingMebbisReconciliationRow {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  reconciliationId: string;
  classification: DrivingMebbisReconciliationRowClass;
  maskedIdentity: string;
  displayName: string;
  studentDrivingProfileId: string | null;
  sourceImportRowId: string | null;
  sourceRowNumber: number | null;
  differenceCodesJson: string;
  courseSnapshotJson: string;
  mebbisSnapshotJson: string;
}

// CourseIntellect.Domain/Entities/DrivingMebbisReconciliation.cs
export const DrivingMebbisReconciliationRowClass = {
  Matched: 1,
  CourseOnly: 2,
  MebbisOnly: 3,
  Different: 4,
} as const;
export type DrivingMebbisReconciliationRowClass = (typeof DrivingMebbisReconciliationRowClass)[keyof typeof DrivingMebbisReconciliationRowClass];

// CourseIntellect.Domain/Entities/DrivingMebbisReconciliation.cs
export const DrivingMebbisReconciliationStatus = {
  Completed: 1,
  Superseded: 2,
} as const;
export type DrivingMebbisReconciliationStatus = (typeof DrivingMebbisReconciliationStatus)[keyof typeof DrivingMebbisReconciliationStatus];

// CourseIntellect.Domain/Entities/DrivingMebbisTransferPackage.cs
export interface DrivingMebbisTransferPackage {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  packageType: DrivingMebbisTransferPackageType;
  studentGroupId: string | null;
  termYear: number | null;
  termNumber: number | null;
  mebbisTermCode: string;
  fileVersion: number;
  rowCount: number;
  studentCount: number;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  status: DrivingMebbisTransferStatus;
  errorResult: string;
  statusVersion: number;
  createdByUserId: string | null;
  createdByName: string;
  createdAtUtc: string;
  updatedByUserId: string | null;
  updatedAtUtc: string | null;
  transferredAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/DrivingMebbisTransferPackage.cs
export const DrivingMebbisTransferPackageType = {
  CandidateRegistration: 1,
  TermStudentList: 2,
  TheorySchedule: 3,
  DrivingSchedule: 4,
  ExamCandidateList: 5,
  ExamResultList: 6,
  CertificateList: 7,
  InvoiceList: 8,
  MeisStatistics: 9,
} as const;
export type DrivingMebbisTransferPackageType = (typeof DrivingMebbisTransferPackageType)[keyof typeof DrivingMebbisTransferPackageType];

// CourseIntellect.Domain/Entities/DrivingMebbisTransferPackage.cs
export const DrivingMebbisTransferStatus = {
  Generated: 1,
  Transferred: 2,
  Failed: 3,
  Cancelled: 4,
} as const;
export type DrivingMebbisTransferStatus = (typeof DrivingMebbisTransferStatus)[keyof typeof DrivingMebbisTransferStatus];

// CourseIntellect.Domain/Entities/DrivingMebbisWorkItem.cs
export interface DrivingMebbisWorkItem {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  workType: DrivingMebbisWorkType;
  subjectId: string;
  studentDrivingProfileId: string | null;
  studentGroupId: string | null;
  status: DrivingMebbisWorkStatus;
  note: string;
  errorReason: string;
  assignedToUserId: string | null;
  lastChangedByUserId: string | null;
  enteredAtUtc: string | null;
  verifiedAtUtc: string | null;
  dueAtUtc: string | null;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingMebbisEnums.cs
export const DrivingMebbisWorkStatus = {
  Preparing: 'Preparing',
  Ready: 'Ready',
  EntryPending: 'EntryPending',
  Entered: 'Entered',
  Verified: 'Verified',
  Error: 'Error',
  CorrectionPending: 'CorrectionPending',
} as const;
export type DrivingMebbisWorkStatus = (typeof DrivingMebbisWorkStatus)[keyof typeof DrivingMebbisWorkStatus];

// CourseIntellect.Domain/Enums/DrivingMebbisEnums.cs
export const DrivingMebbisWorkType = {
  CandidateRegistration: 'CandidateRegistration',
  DocumentApproval: 'DocumentApproval',
  TermAssignment: 'TermAssignment',
  ExamResult: 'ExamResult',
  CertificateNumber: 'CertificateNumber',
  TermDeadline: 'TermDeadline',
  Reconciliation: 'Reconciliation',
} as const;
export type DrivingMebbisWorkType = (typeof DrivingMebbisWorkType)[keyof typeof DrivingMebbisWorkType];

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingPackage {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  licenseClass: string;
  transmissionType: TransmissionType;
  drivingLessonMinutes: number;
  theoryLessonMinutes: number;
  price: number;
  isActive: boolean;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingPhotoInspection.cs
export interface DrivingPhotoInspection {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  studentDrivingDocumentId: string;
  sourceSha256: string;
  sourceBytes: number;
  width: number;
  height: number;
  faceCount: number;
  faceConfidence: number | null;
  averageBrightness: number;
  backgroundUniformity: number;
  overall: string;
  checksJson: string;
  mebbisFileUrl: string;
  mebbisBytes: number | null;
  mebbisWidth: number | null;
  mebbisHeight: number | null;
  analyzerVersion: string;
  createdByUserId: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingStudentEntities.cs
export interface DrivingRegistrationDraft {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  createdByUserId: string;
  displayName: string;
  step: number;
  payloadJson: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingSchoolSettings {
  id: string;
  tenantId: string | null;
  lateCancellationHours: number;
  lateCancellationDeductPercent: number;
  noShowDeductPercent: number;
  requireApprovalForStudentRequests: boolean;
  minRescheduleHours: number;
  maxInstructorDailyMinutes: number;
  maxVehicleDailyMinutes: number;
  maxStudentDailyLessons: number;
  maxStudentDailyMinutes: number;
  lessonEarliestHour: number;
  lessonLatestHour: number;
  failedPracticeExtraLessonMinutes: number;
  failedPracticeExtraLessonFee: number;
  maxVehicleAgeYears: number;
  preparationMinutes: number;
  financialHoldEnabled: boolean;
  financialHoldThreshold: number;
  minimumTheoryAttendancePercent: number;
  excusedAbsencePolicy: DrivingExcusedAbsencePolicy;
  certificateDirectorName: string;
  certificateDirectorTitle: string;
  certificateLogoUrl: string;
  certificateSignatureUrl: string;
  certificatePrimaryColor: string;
  formInstitutionName: string;
  formInstitutionCode: string;
  formInstitutionCity: string;
  formInstitutionDistrict: string;
  formInstitutionAddress: string;
  formInstitutionPhone: string;
  formDirectorName: string;
  formBankName: string;
  formBankAccountNo: string;
  formJurisdictionCity: string;
  formTheoryHourlyFee: number;
  formDrivingHourlyFee: number;
  formTheoryExamFee: number;
  formDrivingExamFee: number;
  formTheoryHours: number;
  formDrivingHours: number;
  certificateSettingsRevision: number;
  certificateSettingsApprovedRevision: number | null;
  certificateSettingsApprovedByUserId: string | null;
  certificateSettingsApprovedAtUtc: string | null;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingStudentEntities.cs
export interface DrivingStudentGroup {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  description: string;
  isActive: boolean;
  termYear: number | null;
  termNumber: number | null;
  mebbisTermCode: string;
  quota: number;
  registrationDeadlineUtc: string | null;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingStudentEnums.cs
export const DrivingStudentStatus = {
  PreRegistered: 1,
  DocumentsPending: 2,
  Active: 3,
  TheoryOngoing: 4,
  PracticeOngoing: 5,
  ExamPending: 6,
  Graduated: 7,
  Suspended: 8,
  Cancelled: 9,
  GraduationPending: 10,
} as const;
export type DrivingStudentStatus = (typeof DrivingStudentStatus)[keyof typeof DrivingStudentStatus];

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingTheoryAttendance {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  theorySessionId: string;
  studentDrivingProfileId: string;
  status: DrivingTheoryAttendanceStatus;
  note: string;
  markedByUserId: string | null;
  markedAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingTheoryAttendanceStatus = {
  Present: 1,
  Absent: 2,
  Late: 3,
  Excused: 4,
} as const;
export type DrivingTheoryAttendanceStatus = (typeof DrivingTheoryAttendanceStatus)[keyof typeof DrivingTheoryAttendanceStatus];

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingTheoryClass {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  licenseClass: string;
  instructorStaffId: string;
  capacity: number;
  startsAtUtc: string;
  endsAtUtc: string;
  room: string;
  status: DrivingTheoryClassStatus;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingTheoryClassStatus = {
  Draft: 1,
  Active: 2,
  Completed: 3,
  Cancelled: 4,
} as const;
export type DrivingTheoryClassStatus = (typeof DrivingTheoryClassStatus)[keyof typeof DrivingTheoryClassStatus];

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingTheoryEnrollment {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  theoryClassId: string;
  studentDrivingProfileId: string;
  enrolledAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingEducationEntities.cs
export interface DrivingTheorySession {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  theoryClassId: string;
  instructorStaffId: string;
  subject: string;
  topic: string;
  startsAtUtc: string;
  endsAtUtc: string;
  room: string;
  status: DrivingTheorySessionStatus;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingEducationEnums.cs
export const DrivingTheorySessionStatus = {
  Planned: 1,
  Completed: 2,
  Cancelled: 3,
} as const;
export type DrivingTheorySessionStatus = (typeof DrivingTheorySessionStatus)[keyof typeof DrivingTheorySessionStatus];

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingVehicle {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  plateNumber: string;
  brand: string;
  model: string;
  modelYear: number;
  licenseClass: string;
  transmissionType: TransmissionType;
  currentKilometer: number;
  inspectionExpiresAtUtc: string | null;
  insuranceExpiresAtUtc: string | null;
  isActive: boolean;
  isInMaintenance: boolean;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingVehicleDocument {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  vehicleId: string;
  documentType: string;
  documentNumber: string;
  startsAtUtc: string | null;
  expiresAtUtc: string;
  fileUrl: string;
  reminderDays: number;
  description: string;
  approvedByUserId: string;
  approvedAtUtc: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface DrivingVehicleServiceRecord {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  vehicleId: string;
  recordType: string;
  title: string;
  serviceProvider: string;
  description: string;
  priority: string;
  reportedAtUtc: string;
  kilometer: number;
  vehicleUsable: boolean;
  laborCost: number;
  partsCost: number;
  nextServiceAtUtc: string | null;
  nextServiceKilometer: number | null;
  status: string;
  resolution: string;
  completedAtUtc: string | null;
  reportedByUserId: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface DutyConflictDto {
  teacherName: string;
  dutyDateUtc: string;
  startTime: string;
  endTime: string;
  reason: string;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface DutyResponse {
  id: string;
  groupId: string;
  dutyType: string;
  location: string;
  dutyDateUtc: string;
  day: string;
  startTime: string;
  endTime: string;
  description: string;
  status: string;
  teacherUserId: string | null;
  teacherName: string;
  teacherUsername: string;
  teacherBranch: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface DutyStatsResponse {
  total: number;
  completed: number;
  planned: number;
  cancelled: number;
}

// CourseIntellect.Api/Controllers/DutiesController.cs
export interface DutyStatusRequest {
  status?: string | null;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface DutyTeacherRef {
  teacherUserId: string | null;
  teacherName: string;
  teacherUsername: string | null;
  teacherBranch: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface EInvoiceResultDto {
  provider: string;
  status: string;
  ettn: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  configured: boolean;
  message: string | null;
}

// CourseIntellect.Domain/Entities/EnrollmentContract.cs
export interface EnrollmentContract {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentUserId: string | null;
  studentName: string;
  className: string;
  academicYear: string;
  grossAmount: number;
  discountAmount: number;
  discountReason: string;
  netAmount: number;
  downPayment: number;
  downPaymentPaid: boolean;
  downPaymentPaidAmount: number;
  scholarshipPercent: number;
  scholarshipAmount: number;
  installmentCount: number;
  currency: string;
  status: string;
  note: string;
  createdByUserId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface EnrollmentContractDto {
  id: string;
  studentUserId: string | null;
  studentName: string;
  className: string;
  academicYear: string;
  grossAmount: number;
  discountAmount: number;
  discountReason: string;
  netAmount: number;
  downPayment: number;
  downPaymentPaid: boolean;
  installmentCount: number;
  currency: string;
  status: string;
  createdAtUtc: string;
  installments: FinanceInstallmentDto[];
  downPaymentPaidAmount: number;
  downPaymentStatus: string;
  scholarshipPercent: number;
  scholarshipAmount: number;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface ExamQuestion {
  id: string;
  tenantId: string | null;
  plannedExamId: string | null;
  questionBankItemId: string;
  sortOrder: number;
  point: number;
}

// CourseIntellect.Domain/Entities/ExamResult.cs
export interface ExamResult {
  id: string;
  tenantId: string | null;
  examTitle: string;
  type: ExamType;
  subject: string;
  dateLabel: string;
  studentName: string;
  className: string;
  score: number;
  net: number;
}

// CourseIntellect.Application/DTOs/ExamResults/ExamResultDto.cs
export interface ExamResultDto {
  id: string;
  examTitle: string;
  type: string;
  subject: string;
  dateLabel: string;
  studentName: string;
  className: string;
  score: number;
  net: number;
  scorePercent: number;
  classRank: number | null;
  overallRank: number | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface ExamScoreRow {
  examTitle: string;
  subject: string;
  score: number;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface ExamSession {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  plannedExamId: string | null;
  studentUserId: string | null;
  teacherPreviewUserId: string | null;
  studentName: string;
  studentUsername: string;
  className: string;
  title: string;
  subject: string;
  durationSeconds: number;
  isTeacherPreview: boolean;
  status: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
}

// CourseIntellect.Api/Controllers/ExamSessionsController.cs
export interface ExamSessionAnswerRequest {
  questionId: string;
  selectedOptionIndex: number;
  openAnswer?: string | null;
}

// CourseIntellect.Api/Controllers/ExamSessionsController.cs
export interface ExamSessionAnswerSnapshot {
  selectedOptionIndex: number;
  openAnswer: string | null;
  isCorrect: boolean;
  requiresManualReview: boolean;
  answeredAtUtc: string;
}

// CourseIntellect.Api/Controllers/ExamSessionsController.cs
export interface ExamSessionQuestionSnapshot {
  id: string;
  questionBankItemId: string | null;
  subject: string;
  topic: string;
  questionText: string;
  imagePath: string | null;
  imagePlacement: string | null;
  options: string[];
  correctOptionIndex: number;
  sortOrder: number;
  answer: ExamSessionAnswerSnapshot | null;
}

// CourseIntellect.Api/Controllers/ExamSessionsController.cs
export interface ExamSessionSnapshot {
  id: string;
  plannedExamId: string | null;
  examTitle: string;
  subject: string;
  studentName: string;
  studentUsername: string;
  className: string;
  durationSeconds: number;
  status: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  recordedExamResultId: string | null;
  teacherName: string;
  assessmentLabel: string;
  approvalStatus: string;
  questions: ExamSessionQuestionSnapshot[];
}

// CourseIntellect.Api/Controllers/ExamSessionsController.cs
export interface ExamSessionStartRequest {
  plannedExamId?: string | null;
  examTitle?: string | null;
  subject?: string | null;
  studentUsername: string;
  studentName?: string | null;
  className?: string | null;
  durationSeconds: number;
  questionCount: number;
}

// CourseIntellect.Domain/Enums/ExamType.cs
export const ExamType = {
  Written: 1,
  Oral: 2,
  Quiz: 3,
  MockExam: 4,
} as const;
export type ExamType = (typeof ExamType)[keyof typeof ExamType];

// CourseIntellect.Api/Controllers/ExcuseRequestsController.cs
export interface ExcuseRequestCreateRequest {
  childName: string;
  date: string;
  type: string;
  reason: string;
  notes?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}

// CourseIntellect.Api/Controllers/ExcuseRequestsController.cs
export interface ExcuseRequestDecisionRequest {
  decision: string;
  decisionNote?: string | null;
}

// CourseIntellect.Api/Controllers/ExcuseRequestsController.cs
export interface ExcuseRequestSnapshot {
  id: string;
  childName: string;
  parentName: string;
  parentUsername: string;
  date: string;
  type: string;
  reason: string;
  notes: string;
  attachmentName: string;
  attachmentUrl: string;
  attachmentType: string;
  status: string;
  decisionNote: string;
  decidedByName: string;
  decidedAtUtc: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/ExpensesController.cs
export interface ExpenseRequest {
  category?: string | null;
  title?: string | null;
  vendorName?: string | null;
  invoiceNo?: string | null;
  amount: number;
  expenseDateUtc?: string | null;
  vehicleId?: string | null;
  note?: string | null;
  parsedCategory?: DrivingExpenseCategory | null;
}

// CourseIntellect.Infrastructure/Services/TenantBackupService.cs
export interface FileReference {
  relativePath: string;
  tableName: string;
  rowId: string;
  displayName: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface FinanceDashboardDto {
  currency: string;
  netTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  overdueTotal: number;
  overdueStudentCount: number;
  collectionRatePercent: number;
  averageCollectionDays: number;
  pendingDownPaymentCount: number;
  pendingDownPaymentTotal: number;
  aging: AgingBucketDto[];
  monthlyIncome: MonthlyIncomeDto[];
  topDebtors: StudentFinanceSummaryDto[];
  refundedTotal: number;
}

// CourseIntellect.Domain/Entities/FinanceInstallment.cs
export interface FinanceInstallment {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  enrollmentContractId: string;
  studentUserId: string | null;
  studentName: string;
  seqNo: number;
  label: string;
  dueDateUtc: string;
  amount: number;
  paidAmount: number;
  status: string;
  currency: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface FinanceInstallmentDto {
  id: string;
  enrollmentContractId: string;
  seqNo: number;
  label: string;
  dueDateUtc: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: string;
  currency: string;
}

// CourseIntellect.Domain/Entities/FinancePayment.cs
export interface FinancePayment {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  enrollmentContractId: string | null;
  financeInstallmentId: string | null;
  studentUserId: string | null;
  studentName: string;
  amount: number;
  method: string;
  receiptNo: string;
  currency: string;
  note: string;
  createdByUserId: string | null;
  paidAtUtc: string;
  entryType: string;
  originalPaymentId: string | null;
  refundType: string;
  refundStatus: string;
  refundReason: string;
  refundChannel: string;
  externalReference: string;
  clientRequestId: string | null;
}

// CourseIntellect.Domain/Entities/FinancePaymentAllocation.cs
export interface FinancePaymentAllocation {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  financePaymentId: string;
  financeInstallmentId: string;
  amount: number;
  refundedAmount: number;
  sequence: number;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface FinancePaymentDto {
  id: string;
  enrollmentContractId: string | null;
  financeInstallmentId: string | null;
  amount: number;
  method: string;
  receiptNo: string;
  paidAtUtc: string;
  currency: string;
  note: string;
  entryType: string;
  originalPaymentId: string | null;
  refundedAmount: number;
  refundableAmount: number;
  refundType: string;
  refundStatus: string;
  refundReason: string;
  refundChannel: string;
  externalReference: string;
  allocatedRefundableAmount: number;
  unallocatedRefundableAmount: number;
  isDownPayment: boolean;
  collectedByName: string;
  branchName: string;
}

// CourseIntellect.Application/DTOs/Auth/PasswordResetDtos.cs
export interface ForgotPasswordRequest {
  email: string;
}

// CourseIntellect.Infrastructure/Services/AdminAnalyticsService.cs
export const Granularity = {
  Day: 0,
  Week: 1,
  Month: 2,
  Year: 3,
} as const;
export type Granularity = (typeof Granularity)[keyof typeof Granularity];

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceAppointment {
  id: string;
  tenantId: string | null;
  counselorName: string;
  requesterName: string;
  requesterRole: string;
  studentName: string;
  slot: string;
  topic: string;
  note: string;
  status: string;
  decisionNote: string;
  createdAtUtc: string;
  decidedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceAvailabilitySlot {
  id: string;
  tenantId: string | null;
  counselorName: string;
  slot: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceGoal {
  id: string;
  tenantId: string | null;
  studentName: string;
  counselorName: string;
  targetSchool: string;
  targetField: string;
  targetScore: string;
  progress: number;
  note: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceInventoryAssignment {
  id: string;
  tenantId: string | null;
  counselorName: string;
  studentName: string;
  inventoryType: string;
  status: string;
  answersJson: string;
  assignedAtUtc: string;
  completedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceRiskReview {
  id: string;
  tenantId: string | null;
  counselorName: string;
  studentName: string;
  riskLevel: string;
  note: string;
  reviewedAtUtc: string;
}

// CourseIntellect.Domain/Entities/GuidanceEntities.cs
export interface GuidanceSessionRecord {
  id: string;
  tenantId: string | null;
  counselorName: string;
  studentName: string;
  className: string;
  sessionType: string;
  topic: string;
  note: string;
  visibility: string;
  sessionAtUtc: string;
  followUpAtUtc: string | null;
  followUpDone: boolean;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/HomeworkAssignment.cs
export interface HomeworkAssignment {
  id: string;
  tenantId: string | null;
  title: string;
  className: string;
  subject: string;
  teacher: string;
  deadlineLabel: string;
  description: string;
  materialsSerialized: string;
  totalStudents: number;
  createdAtLabel: string;
}

// CourseIntellect.Application/DTOs/Homework/HomeworkAssignmentDto.cs
export interface HomeworkAssignmentDto {
  id: string;
  title: string;
  className: string;
  subject: string;
  teacher: string;
  deadline: string;
  description: string;
  materials: string[];
  submitted: number;
  total: number;
  status: string;
  createdAt: string;
  submissions: HomeworkSubmissionDto[];
}

// CourseIntellect.Domain/Entities/HomeworkSubmission.cs
export interface HomeworkSubmission {
  id: string;
  tenantId: string | null;
  assignmentId: string;
  studentName: string;
  note: string;
  filesSerialized: string;
  submittedAtLabel: string;
}

// CourseIntellect.Application/DTOs/Homework/HomeworkSubmissionDto.cs
export interface HomeworkSubmissionDto {
  id: string;
  studentName: string;
  note: string;
  files: string[];
  submittedAtLabel: string;
}

// CourseIntellect.Domain/Enums/DrivingStudentEnums.cs
export const IdentityKind = {
  TurkishId: 1,
  ForeignId: 2,
  Passport: 3,
} as const;
export type IdentityKind = (typeof IdentityKind)[keyof typeof IdentityKind];

// CourseIntellect.Application/Interfaces/IIdentityVerificationService.cs
export interface IdentityVerificationResult {
  status: IdentityVerificationStatus;
  detail: string | null;
}

// CourseIntellect.Application/Interfaces/IIdentityVerificationService.cs
export const IdentityVerificationStatus = {
  Verified: 0,
  Mismatch: 1,
  NotConfigured: 2,
  Unavailable: 3,
} as const;
export type IdentityVerificationStatus = (typeof IdentityVerificationStatus)[keyof typeof IdentityVerificationStatus];

// CourseIntellect.Domain/Entities/InstitutionProfile.cs
export interface InstitutionProfile {
  id: string;
  tenantId: string | null;
  name: string;
  address: string;
  district: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxOffice: string;
  taxNumber: string;
  documentFooterNote: string;
  updatedByUserId: string | null;
  updatedAtUtc: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/Interfaces/IInstitutionProfileService.cs
export interface InstitutionProfileDto {
  name: string;
  address: string;
  district: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxOffice: string;
  taxNumber: string;
  documentFooterNote: string;
  isConfigured: boolean;
  updatedAtUtc: string | null;
  readonly location?: string;
}

// CourseIntellect.Domain/Enums/InstitutionType.cs
export const InstitutionType = {
  PrivateSchool: 0,
  CourseCenter: 1,
  DrivingSchool: 2,
  StudyCenter: 3,
  Other: 4,
} as const;
export type InstitutionType = (typeof InstitutionType)[keyof typeof InstitutionType];

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface IssueEInvoiceRequest {
  studentUserId?: string | null;
  studentName: string;
  amount: number;
  vatRate: number;
  description?: string | null;
}

// CourseIntellect.Api/Controllers/UploadsController.cs
export interface JsonFileUploadRequest {
  fileName: string;
  base64Content: string;
  contentType?: string | null;
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface LeaveBalanceDto {
  staffName: string;
  entitlement: number;
  usedDays: number;
  remainingDays: number;
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface LeaveDecisionRequest {
  status: string;
  note?: string | null;
}

// CourseIntellect.Api/Controllers/LegalConsentController.cs
export interface LegalConsentDecisionRequest {
  version?: string | null;
  status?: string | null;
  marketing: boolean;
  push: boolean;
  analytics: boolean;
  platform?: string | null;
  decidedAtUtc?: string | null;
}

// CourseIntellect.Domain/Entities/LegalConsentRecord.cs
export interface LegalConsentRecord {
  id: string;
  tenantId: string | null;
  userId: string;
  consentVersion: string;
  status: string;
  marketing: boolean;
  push: boolean;
  analytics: boolean;
  platform: string;
  ipAddress: string;
  userAgent: string;
  clientDecidedAtUtc: string | null;
  recordedAtUtc: string;
}

// CourseIntellect.Api/Controllers/LegalConsentController.cs
export interface LegalConsentResponse {
  version: string;
  status: string;
  marketing: boolean;
  push: boolean;
  analytics: boolean;
  recordedAtUtc: string;
}

// CourseIntellect.Domain/Entities/LibraryEntities.cs
export interface LibraryBook {
  id: string;
  tenantId: string | null;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  shelf: string;
  totalCopies: number;
  notes: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/LibraryEntities.cs
export interface LibraryLoan {
  id: string;
  tenantId: string | null;
  bookId: string;
  bookTitle: string;
  studentName: string;
  className: string;
  loanedAtUtc: string;
  dueAtUtc: string;
  returnedAtUtc: string | null;
  extensionCount: number;
  issuedBy: string;
  fineAmount: number;
}

// CourseIntellect.Domain/Entities/LibraryEntities.cs
export interface LibraryRecommendation {
  id: string;
  tenantId: string | null;
  bookId: string;
  bookTitle: string;
  teacherName: string;
  studentName: string;
  className: string;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/LibraryEntities.cs
export interface LibraryReservation {
  id: string;
  tenantId: string | null;
  bookId: string;
  bookTitle: string;
  studentName: string;
  status: string;
  createdAtUtc: string;
  readyAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/LibraryEntities.cs
export interface LibrarySettings {
  id: string;
  tenantId: string | null;
  loanDays: number;
  maxActiveLoans: number;
  maxExtensions: number;
  extensionDays: number;
  finePerDay: number;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface LiveExamState {
  id: string;
  tenantId: string | null;
  examSessionId: string;
  activeQuestionAttemptId: string | null;
  remainingSeconds: number;
  statusSummaryJson: string;
  updatedAtUtc: string;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomAssetCreateRequest {
  fileName: string;
  fileUrl?: string | null;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomAssetSnapshot {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomNoteCreateRequest {
  text: string;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomNoteSnapshot {
  id: string;
  text: string;
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomOpenRequest {
  lessonTitle: string;
  teacherName: string;
  className: string;
  timeLabel: string;
  meetingLink?: string | null;
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomSessionSnapshot {
  id: string;
  lessonTitle: string;
  teacherName: string;
  className: string;
  timeLabel: string;
  meetingLink: string;
  micOn: boolean;
  cameraOn: boolean;
  sharingOn: boolean;
  recordingOn: boolean;
  status: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  assets: LiveRoomAssetSnapshot[];
  notes: LiveRoomNoteSnapshot[];
}

// CourseIntellect.Api/Controllers/LiveRoomSessionsController.cs
export interface LiveRoomStateUpdateRequest {
  micOn?: boolean | null;
  cameraOn?: boolean | null;
  sharingOn?: boolean | null;
  recordingOn?: boolean | null;
}

// CourseIntellect.Application/DTOs/LoginAttempts/LoginAttemptDto.cs
export interface LoginAttemptDto {
  id: string;
  userId: string | null;
  email: string;
  role: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  timestamp: string;
}

// CourseIntellect.Domain/Entities/LoginAttemptItem.cs
export interface LoginAttemptItem {
  id: string;
  tenantId: string | null;
  userId: string | null;
  email: string;
  role: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  timestamp: string;
}

// CourseIntellect.Application/DTOs/LoginAttempts/LoginAttemptStatsDto.cs
export interface LoginAttemptStatsDto {
  total: number;
  successCount: number;
  failedCount: number;
  successRate: number;
}

// CourseIntellect.Application/DTOs/Auth/LoginRequest.cs
export interface LoginRequest {
  username: string;
  password: string;
}

// CourseIntellect.Application/DTOs/Auth/LoginResponse.cs
export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: CurrentUserDto;
}

// CourseIntellect.Application/DTOs/Auth/LogoutRequest.cs
export interface LogoutRequest {
  refreshToken: string;
}

// CourseIntellect.Application/DTOs/Admin/OrgUnitDtos.cs
export interface ManagerCandidateDto {
  userId: string;
  fullName: string;
  role: string;
}

// CourseIntellect.Infrastructure/Services/PlatformOperationsService.cs
export interface MappedTable {
  schema: string;
  name: string;
  tenantColumn: string;
  readonly key?: string;
}

// CourseIntellect.Application/DTOs/Accounting/CreateInvoiceRequest.cs
export interface MarkInvoicePaidRequest {
  paymentMethod: string;
  paidAtUtc?: string | null;
  note?: string | null;
}

// CourseIntellect.Application/DTOs/PlatformSubscriptions/MarkPlatformInvoicePaidRequest.cs
export interface MarkPlatformInvoicePaidRequest {
  paidAtUtc?: string | null;
  notes?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface MarkServiceAttendanceRequest {
  tripId: string;
  studentId: string;
  status: string;
  note?: string | null;
}

// CourseIntellect.Api/Controllers/MeetingRequestsController.cs
export interface MeetingAvailabilityCreateRequest {
  advisor: string;
  slot: string;
  onlineMeeting: boolean;
}

// CourseIntellect.Api/Controllers/MeetingRequestsController.cs
export interface MeetingAvailabilitySlotSnapshot {
  id: string;
  advisor: string;
  slot: string;
  onlineMeeting: boolean;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/MeetingRequest.cs
export interface MeetingRequest {
  id: string;
  tenantId?: string | null;
  parentName: string;
  studentName: string;
  advisor: string;
  topic: string;
  slot: string;
  onlineMeeting: boolean;
  note: string;
  status: string;
  meetingLink: string;
}

// CourseIntellect.Application/DTOs/Meetings/MeetingRequestDto.cs
export interface MeetingRequestDto {
  id: string;
  parentName: string;
  studentName: string;
  advisor: string;
  topic: string;
  slot: string;
  onlineMeeting: boolean;
  note: string;
  status: string;
  meetingLink: string;
}

// CourseIntellect.Application/DTOs/Messages/MessageAttachmentDto.cs
export interface MessageAttachmentDto {
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
}

// CourseIntellect.Domain/Entities/MessageItem.cs
export interface MessageItem {
  id: string;
  tenantId: string | null;
  threadId: string;
  senderName: string;
  senderRole: string;
  text: string;
  isRead: boolean;
  sentAtUtc: string;
  attachments: string;
}

// CourseIntellect.Application/DTOs/Messages/MessageItemDto.cs
export interface MessageItemDto {
  id: string;
  threadId: string;
  senderName: string;
  senderRole: string;
  text: string;
  isRead: boolean;
  sentAtUtc: string;
  isFromCurrentActor: boolean;
  status: string;
  readAtUtc: string | null;
  attachments: MessageAttachmentDto[];
}

// CourseIntellect.Application/DTOs/Messages/MessageStatusChangedDto.cs
export interface MessageStatusChangedDto {
  threadId: string;
  messageId: string;
  status: string;
  readAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/MessageThread.cs
export interface MessageThread {
  id: string;
  tenantId: string | null;
  participantOneName: string;
  participantOneRole: string;
  participantTwoName: string;
  participantTwoRole: string;
  lastMessagePreview: string;
  lastMessageAtUtc: string;
}

// CourseIntellect.Application/DTOs/Messages/MessageThreadDto.cs
export interface MessageThreadDto {
  id: string;
  contactName: string;
  contactRole: string;
  lastMessagePreview: string;
  lastMessageAtUtc: string;
  unreadCount: number;
  lastMessageFromMe: boolean;
  lastMessageStatus: string;
}

// CourseIntellect.Api/Controllers/SchoolDashboardController.cs
export interface ModuleAccess {
  attendance: boolean;
  exams: boolean;
  questions: boolean;
  chat: boolean;
  meetings: boolean;
  announcements: boolean;
  staffHr: boolean;
  approvals: boolean;
  tasks: boolean;
  documents: boolean;
  passwordReset: boolean;
  finance: boolean;
  library: boolean;
  guidance: boolean;
  service: boolean;
  consent: boolean;
}

// CourseIntellect.Domain/Permissions/SchoolModuleCatalog.cs
export interface ModuleItem {
  key: string;
  label: string;
  group: string;
  enforced: boolean;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface MonthlyIncomeDto {
  month: string;
  amount: number;
}

// CourseIntellect.Api/Controllers/MyContentEngagementController.cs
export interface MyContentStateDto {
  contentId: string;
  progress: number;
  liked: boolean;
  favorite: boolean;
  note: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/Scope/MyScopeResponse.cs
export interface MyScopeResponse {
  canSwitchTenant: boolean;
  canSwitchBranch: boolean;
  canViewAllBranches: boolean;
  readOnly: boolean;
  canManageScopes: boolean;
  active: ScopeActiveDto;
  tenants: ScopeTenantDto[];
}

// CourseIntellect.Application/DTOs/Notifications/NotificationDto.cs
export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  timeLabel: string;
  audience: string;
  targetRole: string;
  category: string;
  isRead: boolean;
}

// CourseIntellect.Domain/Entities/NotificationItem.cs
export interface NotificationItem {
  id: string;
  tenantId: string | null;
  title: string;
  message: string;
  timeLabel: string;
  audience: string;
  targetRole: string;
  category: string;
  isRead: boolean;
  targetUserId: string | null;
  dedupeKey: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Infrastructure/Services/OllamaIntentClient.cs
export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  format: string;
  stream: boolean;
  options: OllamaOptions;
}

// CourseIntellect.Infrastructure/Services/OllamaIntentClient.cs
export interface OllamaChatResponse {
  message: OllamaMessage | null;
}

// CourseIntellect.Infrastructure/Services/OllamaIntentClient.cs
export interface OllamaMessage {
  role: string;
  content: string;
}

// CourseIntellect.Infrastructure/Services/OllamaIntentClient.cs
export interface OllamaOptions {
  temperature: number;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface OpenConsentSessionRequest {
  stationName?: string | null;
  expiresInMinutes?: number | null;
}

// CourseIntellect.Domain/Entities/OrgUnit.cs
export interface OrgUnit {
  id: string;
  tenantId: string | null;
  name: string;
  unitType: string;
  parentUnitId: string | null;
  managerName: string;
  managerUserId: string | null;
  isActive: boolean;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Admin/OrgUnitDtos.cs
export interface OrgUnitDto {
  id: string;
  name: string;
  unitType: string;
  parentUnitId: string | null;
  managerName: string;
  note: string;
  createdAtUtc: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/Common/PagedResult.cs
export interface PagedResult<T> {
  items: T[];
  pagination: PaginationInfo;
}

// CourseIntellect.Application/DTOs/Common/PagedResult.cs
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// CourseIntellect.Application/DTOs/Parents/ParentAccountDto.cs
export interface ParentAccountDto {
  userId: string;
  fullName: string;
  username: string;
  phone: string;
  status: string;
  lastLoginAtUtc: string | null;
  children: string[];
}

// CourseIntellect.Application/DTOs/Parents/ParentCredentialsDto.cs
export interface ParentCredentialsDto {
  userId: string;
  fullName: string;
  username: string;
  password: string;
}

// CourseIntellect.Api/Controllers/ParentFinanceController.cs
export interface ParentPaymentRequest {
  studentName: string;
  amount: number;
  method?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ParentServiceStatusDto {
  studentId: string;
  studentFullName: string;
  routeId: string;
  routeName: string;
  routeType: string;
  stopId: string;
  stopName: string;
  attendanceStatus: string;
  tripStatus: string | null;
  tripId: string | null;
  vehicleId: string | null;
  etaMinutes: number | null;
  stopLatitude: number;
  stopLongitude: number;
  vehicleLatitude: number | null;
  vehicleLongitude: number | null;
  distanceMeters: number | null;
  lastLocationAt: string | null;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface ParsedAssistantQuery {
  intent: AssistantIntent;
  normalizedMessage: string;
  searchText: string;
  tcNo: string | null;
  studentNumber: string | null;
  gradeLevel: number | null;
  sectionName: string | null;
  scoreThreshold: number | null;
}

// CourseIntellect.Application/DTOs/Common/UserSummaryDto.cs
export interface PassiveAccountDto {
  userId: string;
  fullName: string;
  username: string;
  primaryRole: string;
  extraRoles: string[];
  detail: string;
  lastLoginAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/PasswordResetRequest.cs
export interface PasswordResetRequest {
  id: string;
  tenantId?: string | null;
  userId: string;
  requestedEmail: string;
  fullName: string;
  username: string;
  primaryRole: string;
  status: string;
  reviewNote: string;
  reviewedByUserId?: string | null;
  reviewedByName: string;
  requestedAtUtc: string;
  reviewedAtUtc?: string | null;
  temporaryPasswordCreatedAtUtc?: string | null;
  expiresAtUtc?: string | null;
  usedAtUtc?: string | null;
}

// CourseIntellect.Application/DTOs/Auth/PasswordResetDtos.cs
export interface PasswordResetRequestDto {
  id: string;
  userId: string;
  requestedEmail: string;
  fullName: string;
  username: string;
  primaryRole: string;
  status: string;
  reviewNote: string;
  reviewedByName: string;
  requestedAtUtc: string;
  reviewedAtUtc: string | null;
  expiresAtUtc: string | null;
  usedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Auth/PasswordResetDtos.cs
export interface PasswordResetReviewResponse {
  id: string;
  status: string;
  message: string;
  temporaryPassword: string | null;
  expiresAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface PaymentIntentDto {
  provider: string;
  intentId: string;
  status: string;
  checkoutUrl: string | null;
  configured: boolean;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface PaymentIntentRequest {
  studentUserId?: string | null;
  studentName: string;
  enrollmentContractId?: string | null;
  financeInstallmentId?: string | null;
  amount: number;
  returnUrl?: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface PayrollRequest {
  grossSalary: number;
  employee?: string | null;
  year?: number | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface PayrollResultDto {
  gross: number;
  sgkEmployee: number;
  unemploymentEmployee: number;
  incomeTaxBase: number;
  incomeTax: number;
  stampTax: number;
  net: number;
  sgkEmployer: number;
  totalEmployerCost: number;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface PdfReport {
  id: string;
  tenantId: string | null;
  examSessionId: string;
  status: string;
  storageKey: string | null;
  errorMessage: string | null;
  createdAtUtc: string;
  readyAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface PdfReportResponse {
  id: string;
  examSessionId: string;
  status: string;
  downloadUrl: string | null;
  errorMessage: string | null;
  createdAtUtc: string;
  readyAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface PendingDownPaymentDto {
  contractId: string;
  studentUserId: string | null;
  studentName: string;
  className: string;
  downPayment: number;
  currency: string;
  downPaymentMethod: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Auth/PkceAuthorizeRequest.cs
export interface PkceAuthorizeRequest {
  username: string;
  password: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

// CourseIntellect.Application/DTOs/Auth/PkceAuthorizeResponse.cs
export interface PkceAuthorizeResponse {
  code: string;
  redirectUri: string;
}

// CourseIntellect.Application/DTOs/Auth/PkceTokenRequest.cs
export interface PkceTokenRequest {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamAttendanceEntry {
  studentUserId: string | null;
  studentUsername: string;
  studentName: string;
  className: string;
  joinedLive: boolean;
  cameraReady: boolean;
  checkedInAtUtc: string | null;
  status: string;
  manualOverride: boolean;
  updatedAtUtc: string;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamAttendanceUpdate {
  studentUserId: string | null;
  studentUsername: string | null;
  studentName: string | null;
  className: string | null;
  status: string | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamCheckInRequest {
  studentUsername?: string | null;
  studentName?: string | null;
  className?: string | null;
  joinedLive: boolean;
  cameraReady: boolean;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamCreateRequest {
  title: string;
  type: string;
  className: string;
  subject: string;
  dateLabel: string;
  startTime?: string | null;
  endTime?: string | null;
  duration: string;
  lateEntryLimitMinutes: number;
  liveLinkUrl?: string | null;
  requireCamera: boolean;
  requireFullscreen: boolean;
  blockTabChange: boolean;
  blockCopyPaste: boolean;
  totalPoint: number;
  questionCount: number;
  teacherName?: string | null;
  sourceType?: string | null;
  sources?: PlannedExamSourceRequest[] | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamSnapshot {
  id: string;
  title: string;
  type: string;
  className: string;
  subject: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  duration: string;
  lateEntryLimitMinutes: number;
  liveLinkUrl: string;
  requireCamera: boolean;
  requireFullscreen: boolean;
  blockTabChange: boolean;
  blockCopyPaste: boolean;
  totalPoint: number;
  questionCount: number;
  status: string;
  teacherName: string;
  sourceType: string;
  sources: PlannedExamSourceSnapshot[];
  attendance: PlannedExamAttendanceEntry[];
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamSourceRequest {
  questionId?: string | null;
  title?: string | null;
  type?: string | null;
  subject?: string | null;
  imagePath?: string | null;
  imagePlacement?: string | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamSourceSnapshot {
  questionId: string | null;
  title: string;
  type: string;
  subject: string | null;
  imagePath: string | null;
  imagePlacement: string | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamSummary {
  present: number;
  total: number;
  resultCount: number;
  average: number | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface PlannedExamUpdateRequest {
  title?: string | null;
  type?: string | null;
  className?: string | null;
  subject?: string | null;
  dateLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: string | null;
  status?: string | null;
  questionCount?: number | null;
  totalPoint?: number | null;
  lateEntryLimitMinutes?: number | null;
  liveLinkUrl?: string | null;
  requireCamera?: boolean | null;
  requireFullscreen?: boolean | null;
  blockTabChange?: boolean | null;
  blockCopyPaste?: boolean | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/PlatformAiLogDto.cs
export interface PlatformAiLogDto {
  id: string;
  time: string;
  user: string;
  tenant: string;
  model: string;
  tokens: number;
  duration: string;
  status: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/PlatformAiModelDto.cs
export interface PlatformAiModelDto {
  id: string;
  name: string;
  provider: string;
  status: string;
  usage: number;
  cost: number;
}

// CourseIntellect.Domain/Entities/PlatformConfiguration.cs
export interface PlatformConfiguration {
  id: string;
  tenantId: string | null;
  configurationType: string;
  scopeKey: string;
  displayName: string;
  payloadJson: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/PlatformConfigurations/PlatformConfigurationDto.cs
export interface PlatformConfigurationDto {
  id: string;
  configurationType: string;
  scopeKey: string;
  displayName: string;
  payloadJson: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/PlatformOverviewDto.cs
export interface PlatformOverviewDto {
  stats: PlatformOverviewStatsDto;
  recentTenants: TenantWorkspaceDto[];
  aiModels: PlatformAiModelDto[];
  aiLogs: PlatformAiLogDto[];
}

// CourseIntellect.Application/DTOs/PlatformOperations/PlatformOverviewStatsDto.cs
export interface PlatformOverviewStatsDto {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  monthlyRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  storageUsedGb: number;
  apiCalls: number;
  openTickets: number;
  invoiceCount: number;
  aiRequestCount: number;
  aiSuccessRate: number;
  aiAverageResponseSeconds: number;
  aiEstimatedCost: number;
}

// CourseIntellect.Domain/Entities/PlatformSubscriptionInvoice.cs
export interface PlatformSubscriptionInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantContactEmail: string;
  invoiceNumber: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  periodStartUtc: string;
  periodEndUtc: string;
  status: string;
  issuedAtUtc: string;
  dueAtUtc: string;
  paidAtUtc: string | null;
  notes: string | null;
}

// CourseIntellect.Application/DTOs/PlatformSubscriptions/PlatformSubscriptionInvoiceDto.cs
export interface PlatformSubscriptionInvoiceDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantContactEmail: string;
  invoiceNumber: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  periodStartUtc: string;
  periodEndUtc: string;
  status: string;
  issuedAtUtc: string;
  dueAtUtc: string;
  paidAtUtc: string | null;
  notes: string | null;
}

// CourseIntellect.Application/DTOs/Students/PromoteStudentsRequest.cs
export interface PromoteStudentsRequest {
  studentUserIds: string[];
  targetClassName: string;
}

// CourseIntellect.Application/DTOs/Students/PromoteStudentsRequest.cs
export interface PromoteStudentsResult {
  promoted: number;
  alreadyInClass: string[];
  notFound: string[];
}

// CourseIntellect.Domain/Entities/PushDeviceRegistration.cs
export interface PushDeviceRegistration {
  id: string;
  tenantId: string | null;
  userId: string;
  token: string;
  platform: string;
  username: string;
  fullName: string;
  role: string;
  deviceId: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastSeenAtUtc: string;
}

// CourseIntellect.Api/Controllers/PushController.cs
export interface PushDeviceRegistrationRequest {
  token: string;
  platform?: string | null;
  username?: string | null;
  fullName?: string | null;
  role?: string | null;
  deviceId?: string | null;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface QuestionAttempt {
  id: string;
  tenantId: string | null;
  examSessionId: string;
  questionBankItemId: string;
  sortOrder: number;
  status: string;
  isFlagged: boolean;
  flagType: string;
  timeSpentSeconds: number;
  createdAtUtc: string;
  lastInteractionAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/QuestionBankItem.cs
export interface QuestionBankItem {
  id: string;
  tenantId: string | null;
  subject: string;
  topic: string;
  difficulty: string;
  type: string;
  questionText: string;
  teacher: string;
  createdAtLabel: string;
  usageCount: number;
  imagePath: string | null;
  imagePlacement: string;
  optionsSerialized: string;
  correctOptionIndex: number | null;
  classTargetsSerialized: string;
  solutionAssetPath: string | null;
  solutionAssetType: string | null;
  revealCorrectAnswerToStudent: boolean;
  expectedAnswer: string | null;
  richTextHtml: string | null;
  solutionTextHtml: string | null;
  editorMetadataJson: string | null;
  publicationStatus: string;
  questionSetKey: string | null;
  questionSetTitle: string | null;
  questionOrder: number | null;
}

// CourseIntellect.Application/DTOs/QuestionBank/QuestionBankItemDto.cs
export interface QuestionBankItemDto {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  type: string;
  questionText: string;
  teacher: string;
  createdAt: string;
  usageCount: number;
  imagePath: string | null;
  imagePlacement: string;
  options: string[];
  correctOptionIndex: number | null;
  classTargets: string[];
  solutionAssetPath: string | null;
  solutionAssetType: string | null;
  revealCorrectAnswerToStudent: boolean;
  expectedAnswer: string | null;
  richTextHtml: string | null;
  solutionTextHtml: string | null;
  editorMetadataJson: string | null;
  publicationStatus: string;
  questionSetKey: string | null;
  questionSetTitle: string | null;
  questionOrder: number | null;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportAnalysisResult {
  rawText: string;
  questions: QuestionImportQuestionSnapshot[];
  imageCount: number;
  tableCount: number;
  formulaCount: number;
  usedOcr: boolean;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportBulkUpdateRequest {
  questionIds?: string[] | null;
  subject?: string | null;
  grade?: string | null;
  unit?: string | null;
  topic?: string | null;
  learningOutcome?: string | null;
  difficulty?: string | null;
  type?: string | null;
  points?: number | null;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportCommitRequest {
  questionIds?: string[] | null;
  target?: string | null;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportCommitResponse {
  importId: string;
  status: string;
  importedCount: number;
  failedCount: number;
  items: unknown[];
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportHistoryItem {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAtUtc: string;
  uploadedBy: string;
  status: string;
  totalQuestions: number;
  importedQuestionCount: number;
  failedQuestionCount: number;
  sizeBytes: number;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportJobSnapshot {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  uploadedAtUtc: string;
  updatedAtUtc: string | null;
  completedAtUtc: string | null;
  importedAtUtc: string | null;
  uploadedBy: string;
  uploadedByUsername: string;
  status: string;
  progress: number;
  totalQuestions: number;
  imageCount: number;
  tableCount: number;
  formulaCount: number;
  estimatedSeconds: number;
  importedQuestionCount: number;
  failedQuestionCount: number;
  rawTextPreview: string | null;
  questions: QuestionImportQuestionSnapshot[];
  logs: QuestionImportLogSnapshot[];
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportLogSnapshot {
  createdAtUtc: string;
  type: string;
  message: string;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportOptionSnapshot {
  label: string;
  text: string;
  isCorrect: boolean;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportOptionUpdateRequest {
  label?: string | null;
  text?: string | null;
  isCorrect: boolean;
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportQuestionSnapshot {
  id: string;
  order: number;
  questionText: string;
  subject: string;
  grade: string;
  unit: string;
  topic: string;
  learningOutcome: string;
  difficulty: string;
  type: string;
  points: number;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  importStatus: string;
  importedQuestionBankItemId: string | null;
  importError: string | null;
  options: QuestionImportOptionSnapshot[];
}

// CourseIntellect.Api/Controllers/QuestionImportController.cs
export interface QuestionImportQuestionUpdateRequest {
  questionText?: string | null;
  subject?: string | null;
  grade?: string | null;
  unit?: string | null;
  topic?: string | null;
  learningOutcome?: string | null;
  difficulty?: string | null;
  type?: string | null;
  points?: number | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  imageUrl?: string | null;
  options?: QuestionImportOptionUpdateRequest[] | null;
}

// CourseIntellect.Domain/Entities/QuestionPracticeAttempt.cs
export interface QuestionPracticeAttempt {
  id: string;
  tenantId: string | null;
  questionId: string;
  studentName: string;
  studentUsername: string;
  answerText: string;
  isCorrect: boolean;
  submittedAtUtc: string;
}

// CourseIntellect.Application/DTOs/QuestionBank/QuestionPracticeAttemptDto.cs
export interface QuestionPracticeAttemptDto {
  id: string;
  questionId: string;
  studentName: string;
  studentUsername: string;
  answerText: string;
  isCorrect: boolean;
  submittedAtUtc: string;
  xpAwarded: number;
}

// CourseIntellect.Application/DTOs/QuestionBank/QuestionPracticeStatsDto.cs
export interface QuestionPracticeStatsDto {
  total: number;
  solved: number;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
}

// CourseIntellect.Api/Controllers/QuestionStudioController.cs
export interface QuestionStudioDraftRequest {
  id?: string | null;
  title?: string | null;
  mode?: string | null;
  payloadJson?: string | null;
}

// CourseIntellect.Api/Controllers/QuestionStudioController.cs
export interface QuestionStudioDraftSnapshot {
  id: string;
  ownerUsername: string;
  ownerName: string;
  title: string;
  mode: string;
  payloadJson: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/QuestionThreads/QuestionThreadAttachmentDto.cs
export interface QuestionThreadAttachmentDto {
  fileName: string;
  fileUrl: string;
  fileType: string;
}

// CourseIntellect.Application/DTOs/QuestionThreads/QuestionThreadDto.cs
export interface QuestionThreadDto {
  id: string;
  title: string;
  subject: string;
  studentName: string;
  studentUsername: string;
  teacherName: string;
  questionText: string;
  status: string;
  createdAt: string;
  lastActivity: string;
  attachmentSummary: string;
  attachments: QuestionThreadAttachmentDto[];
  replies: QuestionThreadReplyDto[];
}

// CourseIntellect.Application/DTOs/QuestionThreads/QuestionThreadReplyDto.cs
export interface QuestionThreadReplyDto {
  id: string;
  senderName: string;
  senderRole: string;
  messageText: string;
  createdAt: string;
  attachments: QuestionThreadAttachmentDto[];
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface ReconciliationMatchDto {
  reference: string;
  amount: number;
  date: string;
  paymentId: string | null;
  receiptNo: string | null;
  matchStatus: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface ReconciliationRequest {
  rows: BankStatementRow[];
  dateToleranceDays: number;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface ReconciliationResultDto {
  total: number;
  matched: number;
  unmatched: number;
  matchedAmount: number;
  unmatchedAmount: number;
  items: ReconciliationMatchDto[];
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface RecordPaymentRequest {
  studentUserId?: string | null;
  studentName: string;
  enrollmentContractId?: string | null;
  financeInstallmentId?: string | null;
  amount: number;
  method?: string | null;
  note?: string | null;
  branchId?: string | null;
  clientRequestId?: string | null;
}

// CourseIntellect.Application/DTOs/Auth/RefreshTokenRequest.cs
export interface RefreshTokenRequest {
  refreshToken: string;
}

// CourseIntellect.Domain/Entities/RefreshTokenSession.cs
export interface RefreshTokenSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAtUtc: string;
  createdAtUtc: string;
  revokedAtUtc: string | null;
  readonly isActive?: boolean;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface RefundRequest {
  paymentId: string;
  amount: number;
  refundType: string;
  reason: string;
  refundChannel: string;
  externalReference?: string | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface RegisterTenantRequest {
  institutionName: string;
  contactName: string;
  email: string;
  phone: string;
  plan?: string | null;
  estimatedStudents: number;
  institutionType?: string;
  captchaToken?: string | null;
  kvkkAccepted?: boolean;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface RegisterTenantResult {
  outcome: TenantRegistrationOutcome;
  message: string | null;
}

// CourseIntellect.Domain/Entities/RegistrationBlocklistEntry.cs
export interface RegistrationBlocklistEntry {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  createdByUserId: string | null;
  createdByName: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface RegistrationBlocklistEntryDto {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  createdByName: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Users/RegistrationListItemDto.cs
export interface RegistrationListItemDto {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  registeredAt: string;
  isVerified: boolean;
}

// CourseIntellect.Infrastructure/Services/PlatformOperationsService.cs
export interface RegistrationValidation {
  error: string | null;
  institutionName: string;
  contactName: string;
  email: string;
  phone: string | null;
  plan: string;
  institutionType: InstitutionType;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface ReminderResultDto {
  notified: number;
  upcomingCount: number;
  overdueCount: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ReorderStopItemRequest {
  stopId: string;
  sortOrder: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ReorderStopsRequest {
  stops: ReorderStopItemRequest[];
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface ReportRecipient {
  id: string;
  tenantId: string | null;
  pdfReportId: string;
  userId: string | null;
  role: string;
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/LibraryController.cs
export interface ReserveRequest {
  bookId: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/ResetTenantDataRequest.cs
export interface ResetTenantDataRequest {
  confirmation: string;
  preserveUsername: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/ResetTenantDataResult.cs
export interface ResetTenantDataResult {
  tenantId: string;
  tenantName: string;
  preservedUsername: string;
  preservedContentCount: number;
  preservedQuestionCount: number;
  deletedUserCount: number;
  deletedRecordCount: number;
  deletedByTable: Record<string, number>;
}

// CourseIntellect.Infrastructure/Services/EntitlementService.cs
export interface ResolvedModule {
  enabled: boolean;
  actions: Record<string, boolean>;
}

// CourseIntellect.Infrastructure/Services/EntitlementService.cs
export interface ResolvedPackage {
  unrestricted: boolean;
  roles: Record<string, ResolvedRole>;
}

// CourseIntellect.Infrastructure/Services/EntitlementService.cs
export interface ResolvedRole {
  modules: Record<string, ResolvedModule>;
}

// CourseIntellect.Application/DTOs/Auth/PasswordResetDtos.cs
export interface ReviewPasswordResetRequest {
  approved: boolean;
  note?: string | null;
}

// CourseIntellect.Domain/Entities/RolePolicy.cs
export interface RolePolicy {
  id: string;
  roleName: string;
  isActive: boolean;
  loginEnabled: boolean;
  requiresCriticalApproval: boolean;
  messagingScope: string;
  moduleAccessSerialized: string;
}

// CourseIntellect.Application/DTOs/Common/RolePolicyUpdateRequest.cs
export interface RolePolicyUpdateRequest {
  isActive: boolean;
  loginEnabled: boolean;
  requiresCriticalApproval: boolean;
  messagingScope: string;
  moduleAccess: string[];
}

// CourseIntellect.Application/DTOs/Common/RoleSummaryDto.cs
export interface RoleSummaryDto {
  roleName: string;
  userCount: number;
  isActive: boolean;
  loginEnabled: boolean;
  requiresCriticalApproval: boolean;
  messagingScope: string;
  moduleAccess: string[];
}

// CourseIntellect.Application/DTOs/Attendance/SaveAttendanceRequest.cs
export interface SaveAttendanceRequest {
  className: string;
  lesson: string;
  lessonDate?: string | null;
  students: SaveAttendanceStudentRequest[];
}

// CourseIntellect.Application/DTOs/Attendance/SaveAttendanceStudentRequest.cs
export interface SaveAttendanceStudentRequest {
  name: string;
  status: string;
}

// CourseIntellect.Api/Controllers/GuidanceController.cs
export interface SaveAvailabilityRequest {
  slots: string[];
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SaveCanvasSnapshotRequest {
  questionAttemptId: string;
  dataUrl: string;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SaveCanvasStrokeRequest {
  questionAttemptId: string;
  tool: string;
  color: string;
  width: number;
  opacity: number;
  pressure?: number | null;
  pointsJson: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface SaveConsentTemplateRequest {
  title?: string | null;
  body?: string | null;
  checkItems?: string[] | null;
  requiresSignature: boolean;
  signerRole: ConsentSignerRole;
  isActive: boolean;
  sortOrder: number;
  bindings?: ConsentTemplateBindingDto[] | null;
  sourceKind?: ConsentDocumentSource;
  documentId?: string | null;
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface SaveContentExtrasRequest {
  coverImageUrl?: string | null;
  exercises: ContentExerciseDto[];
}

// CourseIntellect.Api/Controllers/ContentEngagementController.cs
export interface SaveContentUserStateRequest {
  progress: number;
  liked: boolean;
  favorite: boolean;
  note?: string | null;
}

// CourseIntellect.Application/Interfaces/IInstitutionProfileService.cs
export interface SaveInstitutionProfileRequest {
  name?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  documentFooterNote?: string | null;
}

// CourseIntellect.Api/Controllers/PlannedExamsController.cs
export interface SavePlannedExamAttendanceRequest {
  entries?: PlannedExamAttendanceUpdate[] | null;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SaveQuestionFlagRequest {
  questionAttemptId: string;
  isFlagged: boolean;
  flagType?: string | null;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SaveSolutionAnswerRequest {
  questionAttemptId: string;
  selectedOptionIndex: number;
  openAnswer?: string | null;
  timeSpentSeconds: number;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SaveStudentNoteRequest {
  questionAttemptId: string;
  note: string;
}

// CourseIntellect.Api/Controllers/ScheduleController.cs
export interface ScheduleEntryDto {
  id: string;
  className: string;
  day: string;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  isReadOnly: boolean;
}

// CourseIntellect.Domain/Enums/ScopeAccessMode.cs
export const ScopeAccessMode = {
  Manage: 1,
  ReadOnly: 2,
} as const;
export type ScopeAccessMode = (typeof ScopeAccessMode)[keyof typeof ScopeAccessMode];

// CourseIntellect.Application/DTOs/Scope/MyScopeResponse.cs
export interface ScopeActiveDto {
  tenantId: string | null;
  branchId: string | null;
}

// CourseIntellect.Application/DTOs/Scope/MyScopeResponse.cs
export interface ScopeBranchDto {
  id: string;
  name: string;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface ScopeGroupDto {
  id: string;
  name: string;
  parentGroupId: string | null;
  tenantCount: number;
}

// CourseIntellect.Domain/Enums/ScopeLevel.cs
export const ScopeLevel = {
  Platform: 1,
  Group: 2,
  Tenant: 3,
  Branch: 4,
} as const;
export type ScopeLevel = (typeof ScopeLevel)[keyof typeof ScopeLevel];

// CourseIntellect.Application/DTOs/Scope/ScopeRollupResponse.cs
export interface ScopeRollupResponse {
  readOnly: boolean;
  tenantCount: number;
  totals: ScopeRollupTotals;
  tenants: ScopeRollupTenant[];
}

// CourseIntellect.Application/DTOs/Scope/ScopeRollupResponse.cs
export interface ScopeRollupTenant {
  id: string;
  name: string;
  students: number;
  staff: number;
  branches: number;
  collected: number;
  monthlyFee: number;
}

// CourseIntellect.Application/DTOs/Scope/ScopeRollupResponse.cs
export interface ScopeRollupTotals {
  students: number;
  staff: number;
  branches: number;
  collected: number;
  monthlyFee: number;
}

// CourseIntellect.Application/DTOs/Scope/MyScopeResponse.cs
export interface ScopeTenantDto {
  id: string;
  name: string;
  branches: ScopeBranchDto[];
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface ScopeTenantLiteDto {
  id: string;
  name: string;
  groupId: string | null;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface ScopeUserDto {
  id: string;
  fullName: string;
  username: string;
  primaryRole: string;
}

// CourseIntellect.Application/DTOs/Assistant/AssistantDtos.cs
export interface SendAssistantMessageRequest {
  conversationId?: string | null;
  message: string;
  clientMessageId: string;
  context?: AssistantClientContext | null;
}

// CourseIntellect.Application/DTOs/Messages/SendMessageRequest.cs
export interface SendMessageRequest {
  text: string;
  attachments?: MessageAttachmentDto[] | null;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceAbsenceRequest {
  id: string;
  studentId: string;
  parentId: string;
  routeId: string;
  date: string;
  tripType: ServiceTripType;
  reason: string;
  status: ServiceAbsenceRequestStatus;
  createdAt: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceAbsenceRequestDto {
  id: string;
  studentId: string;
  studentFullName: string;
  parentId: string;
  parentFullName: string;
  routeId: string;
  routeName: string;
  date: string;
  tripType: string;
  reason: string;
  status: string;
  createdAt: string;
}

// CourseIntellect.Domain/Enums/ServiceTrackingEnums.cs
export const ServiceAbsenceRequestStatus = {
  Pending: 1,
  Approved: 2,
  Rejected: 3,
  Cancelled: 4,
} as const;
export type ServiceAbsenceRequestStatus = (typeof ServiceAbsenceRequestStatus)[keyof typeof ServiceAbsenceRequestStatus];

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceAttendance {
  id: string;
  tripId: string;
  studentId: string;
  parentId: string;
  status: ServiceAttendanceStatus;
  markedByDriverId: string;
  markedAt: string;
  note: string;
}

// CourseIntellect.Domain/Enums/ServiceTrackingEnums.cs
export const ServiceAttendanceStatus = {
  Pending: 1,
  Boarded: 2,
  NotBoarded: 3,
  ArrivedSchool: 4,
  BoardedFromSchool: 5,
  ArrivedHome: 6,
} as const;
export type ServiceAttendanceStatus = (typeof ServiceAttendanceStatus)[keyof typeof ServiceAttendanceStatus];

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceDriver {
  id: string;
  tenantId: string | null;
  userId: string;
  phoneNumber: string;
  licenseNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceDriverBriefDto {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceDriverDto {
  id: string;
  institutionId: string | null;
  userId: string;
  fullName: string;
  phoneNumber: string;
  licenseNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceDriverSelfDto {
  isDriver: boolean;
  driverId: string | null;
  phoneNumber: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceHistoryItemDto {
  tripId: string;
  tripDate: string;
  tripType: string;
  routeName: string;
  attendanceStatus: string;
  markedAt: string | null;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceRoute {
  id: string;
  tenantId: string | null;
  name: string;
  routeType: ServiceRouteType;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceRouteDetailResponse {
  id: string;
  name: string;
  routeType: string;
  vehicle: ServiceVehicleBriefDto | null;
  driver: ServiceDriverBriefDto | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  totalStudents: number;
  capacity: number;
  availableSeats: number;
  stops: StopWithStudentsResponse[];
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceRouteListDto {
  id: string;
  institutionId: string | null;
  name: string;
  routeType: string;
  vehicle: ServiceVehicleBriefDto | null;
  driver: ServiceDriverBriefDto | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  totalStudents: number;
  capacity: number;
  availableSeats: number;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceRouteStop {
  id: string;
  routeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
  createdAt: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceRouteStopDto {
  id: string;
  routeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
  createdAt: string;
}

// CourseIntellect.Domain/Enums/ServiceTrackingEnums.cs
export const ServiceRouteType = {
  Morning: 1,
  Evening: 2,
} as const;
export type ServiceRouteType = (typeof ServiceRouteType)[keyof typeof ServiceRouteType];

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceStudentSearchResultDto {
  studentId: string;
  studentFullName: string;
  className: string;
  parentId: string | null;
  parentFullName: string;
  parentPhone: string;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceTrip {
  id: string;
  routeId: string;
  driverId: string;
  vehicleId: string;
  tripDate: string;
  tripType: ServiceTripType;
  status: ServiceTripStatus;
  startedAt: string | null;
  arrivedAtSchoolAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceTripDto {
  id: string;
  routeId: string;
  driverId: string;
  vehicleId: string;
  tripDate: string;
  tripType: string;
  status: string;
  startedAt: string | null;
  arrivedAtSchoolAt: string | null;
  completedAt: string | null;
}

// CourseIntellect.Domain/Enums/ServiceTrackingEnums.cs
export const ServiceTripStatus = {
  NotStarted: 1,
  InProgress: 2,
  ArrivedSchool: 3,
  Completed: 4,
  Cancelled: 5,
} as const;
export type ServiceTripStatus = (typeof ServiceTripStatus)[keyof typeof ServiceTripStatus];

// CourseIntellect.Domain/Enums/ServiceTrackingEnums.cs
export const ServiceTripType = {
  Morning: 1,
  Evening: 2,
  Both: 3,
} as const;
export type ServiceTripType = (typeof ServiceTripType)[keyof typeof ServiceTripType];

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceVehicle {
  id: string;
  tenantId: string | null;
  vehicleNumber: string;
  plateNumber: string;
  brand: string;
  model: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceVehicleBriefDto {
  id: string;
  vehicleNumber: string;
  plateNumber: string;
  brand: string;
  model: string;
  capacity: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface ServiceVehicleDto {
  id: string;
  institutionId: string | null;
  vehicleNumber: string;
  plateNumber: string;
  brand: string;
  model: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface ServiceVehicleLocation {
  id: string;
  vehicleId: string;
  driverId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

// CourseIntellect.Application/DTOs/Admin/OrgUnitDtos.cs
export interface SetOrgUnitActiveRequest {
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/StudyPlans/UpdateStudyPlanStateRequest.cs
export interface SetStudyPlanItemDoneRequest {
  done: boolean;
}

// CourseIntellect.Application/DTOs/Timetable/TimetableDtos.cs
export interface SetTimetableRequest {
  teacherUserId?: string | null;
  teacherName: string;
  slots: TimetableSlotRequest[];
}

// CourseIntellect.Application/DTOs/PlatformOperations/TenantWorkspaceDto.cs
export const SetupDocumentOutcome = {
  Ready: 0,
  NotFound: 1,
  AlreadyActivated: 2,
} as const;
export type SetupDocumentOutcome = (typeof SetupDocumentOutcome)[keyof typeof SetupDocumentOutcome];

// CourseIntellect.Application/DTOs/PlatformOperations/TenantWorkspaceDto.cs
export interface SetupDocumentResult {
  outcome: SetupDocumentOutcome;
  tenant: TenantWorkspaceDto | null;
}

// CourseIntellect.Api/Controllers/SchoolDashboardController.cs
export interface SetupStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  count: number;
  countLabel: string;
  actionPath: string;
  actionLabel: string;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface SignConsentFormRequest {
  checkedItems?: number[] | null;
  signatureImage?: string | null;
  signerName?: string | null;
  signerRelation?: string | null;
}

// CourseIntellect.Application/DTOs/SiteContent/SiteContentDto.cs
export interface SiteContentDto {
  id: string;
  section: string;
  content: unknown;
  language: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

// CourseIntellect.Domain/Entities/SiteContentItem.cs
export interface SiteContentItem {
  id: string;
  tenantId: string | null;
  sectionKey: string;
  contentJson: string;
  language: string;
  version: number;
  isPublished: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  updatedBy: string;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SolutionQuestionResponse {
  attemptId: string;
  questionBankItemId: string;
  sortOrder: number;
  subject: string;
  topic: string;
  difficulty: string;
  type: string;
  questionText: string;
  imagePath: string | null;
  imagePlacement: string;
  options: string[];
  correctOptionIndex: number | null;
  expectedAnswer: string | null;
  status: string;
  isFlagged: boolean;
  flagType: string;
  timeSpentSeconds: number;
  answer: AnswerSelectionResponse | null;
  note: string | null;
  snapshotUrl: string | null;
  teacherReviews: TeacherReviewResponse[];
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SolutionSessionResponse {
  id: string;
  title: string;
  subject: string;
  studentName: string;
  studentUsername: string;
  className: string;
  durationSeconds: number;
  isTeacherPreview: boolean;
  status: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  questions: SolutionQuestionResponse[];
  latestReport: PdfReportResponse | null;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface SolutionSummaryResponse {
  sessionId: string;
  total: number;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  successPercent: number;
  report: PdfReportResponse | null;
}

// CourseIntellect.Domain/Entities/StaffAssetAssignment.cs
export interface StaffAssetAssignment {
  id: string;
  tenantId: string | null;
  staffUserId: string | null;
  staffName: string;
  assetName: string;
  assetCode: string;
  status: string;
  note: string;
  assignedAtUtc: string;
  returnedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface StaffAssetDto {
  id: string;
  staffUserId: string | null;
  staffName: string;
  assetName: string;
  assetCode: string;
  status: string;
  note: string;
  assignedAtUtc: string;
  returnedAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/Staff/StaffCredentialsDto.cs
export interface StaffCredentialsDto {
  userId: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
}

// CourseIntellect.Application/DTOs/Admin/StaffHrDtos.cs
export interface StaffLeaveDto {
  id: string;
  staffUserId: string | null;
  staffName: string;
  leaveType: string;
  startDateUtc: string;
  endDateUtc: string;
  days: number;
  reason: string;
  status: string;
  decidedByName: string;
  createdAtUtc: string;
  decidedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/StaffLeaveRequest.cs
export interface StaffLeaveRequest {
  id: string;
  tenantId?: string | null;
  staffUserId?: string | null;
  staffName: string;
  leaveType: string;
  startDateUtc: string;
  endDateUtc: string;
  days: number;
  reason: string;
  status: string;
  approvalRequestId?: string | null;
  decidedByUserId?: string | null;
  decidedByName: string;
  createdAtUtc: string;
  decidedAtUtc?: string | null;
}

// CourseIntellect.Domain/Entities/StaffProfile.cs
export interface StaffProfile {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  userId: string;
  fullName: string;
  tcNo: string;
  phone: string;
  email: string;
  education: string;
  startDate: string;
  campus: string;
  departmentOrBranch: string;
  homeroomClass: string;
  maritalStatus: string;
  childCount: number;
  note: string;
  photoUrl: string;
  role: UserRole;
  assignedClassesSerialized: string;
  assignedClasses: string[];
}

// CourseIntellect.Application/DTOs/Staff/StaffSummaryDto.cs
export interface StaffSummaryDto {
  id: string;
  fullName: string;
  username: string;
  role: string;
  departmentOrBranch: string;
  campus: string;
  status: string;
  extraRoles: string[];
  hasRoleHistory: boolean;
  assignedClasses: string[];
  email: string;
  phone: string;
  homeroomClass: string;
  education: string;
  tcNo: string;
  maritalStatus: string;
  childCount: number;
  note: string;
  startDate: string;
  userId: string;
  photoUrl: string;
  branchId: string | null;
  customRoleId: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface StartServiceTripRequest {
  routeId: string;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface StartSolutionSessionRequest {
  title: string;
  subject: string;
  studentUsername: string;
  studentName?: string | null;
  className?: string | null;
  durationSeconds: number;
  isTeacherPreview: boolean;
  plannedExamId?: string | null;
  questionIds?: string[] | null;
  questionCount?: number;
}

// CourseIntellect.Domain/Services/StatementLedger.cs
export interface StatementLedgerLine {
  dateUtc: string;
  entryType: string;
  description: string;
  documentNo: string;
  debit: number;
  credit: number;
  balance: number;
}

// CourseIntellect.Domain/Services/StatementLedger.cs
export interface StatementLedgerResult {
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  lines: StatementLedgerLine[];
}

// CourseIntellect.Domain/Services/StatementLedger.cs
export interface StatementMovement {
  dateUtc: string;
  entryType: string;
  description: string;
  documentNo: string;
  debit: number;
  credit: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface StopWithStudentsResponse {
  stopId: string;
  stopName: string;
  address: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
  students: AssignedStudentResponse[];
}

// CourseIntellect.Application/Interfaces/IFileStorageService.cs
export interface StoredFilePrefixDto {
  bytes: string;
  length: number;
}

// CourseIntellect.Infrastructure/Services/AssistantService.cs
export interface StoredPayload {
  type: string;
  data: unknown | null;
  actions: AssistantActionDto[];
  suggestions: string[];
}

// CourseIntellect.Api/Controllers/ReportsController.cs
export interface StoredTeacherWeeklyReport {
  id: string;
  teacherUsername: string;
  teacherName: string;
  studentUsername: string;
  studentName: string;
  parentName: string;
  parentEmail: string;
  className: string;
  subject: string;
  title: string;
  summary: string;
  highlights: string;
  supportNotes: string;
  weeklyPeriodLabel: string;
  createdAtUtc: string;
  attachments: StoredTeacherWeeklyReportAttachment[];
}

// CourseIntellect.Api/Controllers/ReportsController.cs
export interface StoredTeacherWeeklyReportAttachment {
  name: string;
  url: string;
  fileType: string;
}

// CourseIntellect.Infrastructure/Services/AssistantService.cs
export interface StudentCandidate {
  id: string;
  userId: string;
  fullName: string;
  className: string;
  schoolNumber: string;
  photoUrl: string;
}

// CourseIntellect.Application/DTOs/Students/StudentCredentialsDto.cs
export interface StudentCredentialsDto {
  userId: string;
  fullName: string;
  username: string;
  password: string;
  className: string;
  parent: ParentCredentialsDto | null;
}

// CourseIntellect.Domain/Enums/DrivingStudentEnums.cs
export const StudentDocumentStatus = {
  Missing: 1,
  PendingApproval: 2,
  Approved: 3,
  Rejected: 4,
  Expired: 5,
  ReuploadRequested: 6,
} as const;
export type StudentDocumentStatus = (typeof StudentDocumentStatus)[keyof typeof StudentDocumentStatus];

// CourseIntellect.Domain/Enums/DrivingStudentEnums.cs
export const StudentDocumentType = {
  Identity: 1,
  Diploma: 2,
  HealthReport: 3,
  BiometricPhoto: 4,
  CriminalRecord: 5,
  BloodTypeCertificate: 6,
  Residence: 7,
  ParentalConsent: 8,
  ExistingLicense: 9,
  Other: 10,
  ForeignStudentDocument: 11,
} as const;
export type StudentDocumentType = (typeof StudentDocumentType)[keyof typeof StudentDocumentType];

// CourseIntellect.Domain/Entities/DrivingStudentEntities.cs
export interface StudentDrivingDocument {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentDrivingProfileId: string;
  documentType: StudentDocumentType;
  status: StudentDocumentStatus;
  fileUrl: string;
  fileName: string;
  documentNumber: string;
  issuedBy: string;
  issuedAtUtc: string | null;
  expiresAtUtc: string | null;
  description: string;
  uploadedByUserId: string | null;
  uploadedAtUtc: string;
  reviewedByUserId: string | null;
  reviewedAtUtc: string | null;
  rejectionReason: string;
  reviewNote: string;
  reuploadRequestedAtUtc: string | null;
  reviewVersion: number;
  isCurrent: boolean;
}

// CourseIntellect.Domain/Entities/DrivingSchoolEntities.cs
export interface StudentDrivingProfile {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  studentId: string;
  packageId: string;
  studentNumber: number;
  studentGroupId: string | null;
  licenseClass: string;
  transmissionType: TransmissionType;
  purchasedDrivingMinutes: number;
  usedDrivingMinutes: number;
  status: DrivingStudentStatus;
  automaticStatusEnabled: boolean;
  trainingOverrideActive: boolean;
  trainingOverrideReason: string;
  trainingOverrideByUserId: string | null;
  trainingOverrideAtUtc: string | null;
  statusBeforeSuspension: DrivingStudentStatus | null;
  statusChangeSource: string;
  statusChangeReason: string;
  statusChangedByUserId: string | null;
  statusChangedAtUtc: string | null;
  registeredAtUtc: string;
  identityKind: IdentityKind;
  identityNumber: string;
  identitySerialNo: string;
  phone: string;
  fatherName: string;
  motherName: string;
  birthPlace: string;
  nationality: string;
  gender: string;
  bloodType: string;
  occupation: string;
  educationLevel: string;
  city: string;
  district: string;
  residenceAddress: string;
  whatsAppPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  photoUrl: string;
  livePhotoUrl: string;
  registrationCity: string;
  registrationDistrict: string;
  registrationNeighborhood: string;
  registrationStreet: string;
  registrationVolumeNo: string;
  registrationFamilyOrderNo: string;
  registrationOrderNo: string;
  identityIssueDate: string | null;
  identityIssuePlace: string;
  hasExistingLicense: boolean;
  existingLicenseNumber: string;
  existingLicenseClasses: string;
  licenseIssueDate: string | null;
  licenseExpiryDate: string | null;
  licenseIssuePlace: string;
  theoryExamFee: number;
  drivingExamFee: number;
  theoryExamFeePaid: boolean;
  drivingExamFeePaid: boolean;
  drivingExamDate: string | null;
  courseStartsAtUtc: string | null;
  preferredInstructorProfileId: string | null;
  preferredVehicleId: string | null;
  drivingExperience: DrivingExperienceLevel;
  availableWeekdays: boolean;
  availableWeekend: boolean;
  prefersMorning: boolean;
  prefersMidday: boolean;
  prefersEvening: boolean;
  accessibilityNotes: string;
  enrollmentContractId: string | null;
  kvkkConsentAtUtc: string | null;
  communicationConsent: boolean;
  contractSignedAtUtc: string | null;
  signatureUrl: string;
  registeredByUserId: string | null;
  approvedByUserId: string | null;
  approvedAtUtc: string | null;
  mebbisEnteredAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface StudentExamPaperResponse {
  sessionId: string;
  reportId: string;
  title: string;
  subject: string;
  className: string;
  status: string;
  downloadUrl: string | null;
  completedAtUtc: string | null;
  readyAtUtc: string | null;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface StudentFinanceAccountDto {
  studentUserId: string | null;
  studentName: string;
  currency: string;
  netTotal: number;
  paidTotal: number;
  balance: number;
  overdueCount: number;
  nextDueDateUtc: string | null;
  contracts: EnrollmentContractDto[];
  installments: FinanceInstallmentDto[];
  payments: FinancePaymentDto[];
  grossCollectedTotal: number;
  refundedTotal: number;
  grossTotal: number;
  discountTotal: number;
  downPaymentTotal: number;
  downPaymentPaidTotal: number;
  hasPendingDownPayment: boolean;
  drivingStudentProfileId: string | null;
  drivingExamFee: number;
  drivingExamFeePaid: boolean;
  drivingExamAttemptNo: number;
  drivingExamDate: string | null;
  courseRemaining: number;
  additionalChargeRemaining: number;
  standaloneExamFeeRemaining: number;
  totalPayable: number;
  scholarshipPercent: number;
  scholarshipAmount: number;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentFinanceDtos.cs
export interface StudentFinanceSummaryDto {
  studentUserId: string | null;
  studentName: string;
  className: string;
  currency: string;
  netTotal: number;
  paidTotal: number;
  balance: number;
  overdueCount: number;
  nextDueDateUtc: string | null;
  status: string;
  grossTotal: number;
  discountTotal: number;
  downPaymentTotal: number;
  downPaymentPaidTotal: number;
  hasPendingDownPayment: boolean;
  drivingStudentProfileId: string | null;
  drivingExamFee: number;
  drivingExamFeePaid: boolean;
  drivingExamAttemptNo: number;
  drivingExamDate: string | null;
  courseRemaining: number;
  additionalChargeRemaining: number;
  standaloneExamFeeRemaining: number;
  totalPayable: number;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface StudentNote {
  id: string;
  tenantId: string | null;
  questionAttemptId: string;
  note: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/StudentProfile.cs
export interface StudentProfile {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  userId: string;
  fullName: string;
  tcNo: string;
  className: string;
  currentSchool: string;
  schoolNumber: string;
  birthDate: string;
  programType: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  parentUserId: string | null;
  address: string;
  note: string;
  photoUrl: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/StudentQuestionReply.cs
export interface StudentQuestionReply {
  id: string;
  tenantId: string | null;
  threadId: string;
  senderName: string;
  senderRole: string;
  messageText: string;
  createdAtLabel: string;
  attachmentsSerialized: string;
}

// CourseIntellect.Domain/Entities/StudentQuestionThread.cs
export interface StudentQuestionThread {
  id: string;
  tenantId: string | null;
  title: string;
  subject: string;
  studentName: string;
  studentUsername: string;
  teacherName: string;
  questionText: string;
  status: string;
  createdAtLabel: string;
  lastActivityLabel: string;
  attachmentSummary: string;
  attachmentsSerialized: string;
}

// CourseIntellect.Infrastructure/Services/AssistantService.cs
export interface StudentSelection {
  candidates: StudentCandidate[];
  denied: boolean;
  message: string;
  failureCode: string;
}

// CourseIntellect.Domain/Entities/ServiceTrackingEntities.cs
export interface StudentServiceAssignment {
  id: string;
  studentId: string;
  parentId: string;
  routeId: string;
  stopId: string;
  isActive: boolean;
  createdAt: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentStatementDtos.cs
export interface StudentStatementDto {
  institutionName: string;
  institutionAddress: string;
  institutionLocation: string;
  institutionPhone: string;
  institutionEmail: string;
  institutionWebsite: string;
  institutionTaxInfo: string;
  accountCode: string;
  studentName: string;
  studentPhone: string;
  studentAddress: string;
  parentName: string;
  className: string;
  currency: string;
  fromUtc: string;
  toUtc: string;
  generatedAtUtc: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  closingBalanceInWords: string;
  lines: StudentStatementLineDto[];
  note: string;
}

// CourseIntellect.Application/DTOs/StudentFinance/StudentStatementDtos.cs
export interface StudentStatementLineDto {
  dateUtc: string;
  entryType: string;
  description: string;
  documentNo: string;
  debit: number;
  credit: number;
  balance: number;
}

// CourseIntellect.Application/Interfaces/IStudentStatementPdfService.cs
export interface StudentStatementPdfModel {
  statement: StudentStatementDto;
  brandName: string;
  logoBytes: string | null;
  accentColor: string;
}

// CourseIntellect.Application/DTOs/Students/StudentSummaryDto.cs
export interface StudentSummaryDto {
  id: string;
  userId: string;
  fullName: string;
  tcNo: string;
  className: string;
  currentSchool: string;
  schoolNumber: string;
  birthDate: string;
  programType: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  note: string;
  photoUrl: string;
  username: string;
  status: string;
  lastLoginAtUtc: string | null;
  extraRoles: string[];
}

// CourseIntellect.Application/DTOs/StudyPlans/UpdateStudyPlanStateRequest.cs
export interface StudyPlanItemRequest {
  item: unknown;
}

// CourseIntellect.Domain/Entities/StudyPlanState.cs
export interface StudyPlanState {
  id: string;
  tenantId: string | null;
  studentName: string;
  planItemsSerialized: string;
  streakCount: number;
  xpPoints: number;
  lastCompletedAt: string | null;
}

// CourseIntellect.Application/DTOs/StudyPlans/StudyPlanStateDto.cs
export interface StudyPlanStateDto {
  id: string;
  studentName: string;
  planItemsSerialized: string;
  streakCount: number;
  xpPoints: number;
  lastCompletedAt: string | null;
}

// CourseIntellect.Application/DTOs/QuestionBank/SubmitQuestionPracticeAttemptRequest.cs
export interface SubmitQuestionPracticeAttemptRequest {
  studentName: string;
  studentUsername: string;
  answerText: string;
}

// CourseIntellect.Domain/Entities/SupportTicket.cs
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  tenantName: string;
  requestedBy: string;
  requestedRole: string;
  category: string;
  priority: string;
  status: string;
  summary: string;
  lastMessage: string;
  messageCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/SupportTicketDto.cs
export interface SupportTicketDto {
  id: string;
  ticketNumber: string;
  subject: string;
  tenant: string;
  user: string;
  userRole: string;
  category: string;
  priority: string;
  status: string;
  summary: string;
  lastMessage: string;
  messages: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

// CourseIntellect.Application/DTOs/System/SystemStatusDto.cs
export interface SystemStatusDto {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  maintenanceSinceUtc: string | null;
  serverTimeUtc: string;
  pushNotificationsConfigured: boolean;
}

// CourseIntellect.Infrastructure/Services/TenantBackupService.cs
export interface TableSummary {
  tableName: string;
  rowCount: number;
}

// CourseIntellect.Application/DTOs/Admin/AdminTaskDtos.cs
export interface TaskStatusRequest {
  status: string;
  reason?: string | null;
}

// CourseIntellect.Domain/Entities/TeacherDuty.cs
export interface TeacherDuty {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  groupId: string;
  dutyType: string;
  location: string;
  dutyDateUtc: string;
  day: string;
  startTime: string;
  endTime: string;
  description: string;
  status: string;
  teacherUserId: string | null;
  teacherName: string;
  teacherUsername: string;
  teacherBranch: string;
  createdByUserId: string | null;
  createdByName: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface TeacherDutyLoadDto {
  teacherUserId: string | null;
  teacherName: string;
  count: number;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface TeacherExamPaperReportResponse {
  id: string;
  examSessionId: string;
  status: string;
  downloadUrl: string | null;
  createdAtUtc: string;
  readyAtUtc: string | null;
  studentName: string;
  className: string;
  title: string;
  subject: string;
  total: number;
  correct: number;
  scorePercent: number;
  completedAtUtc: string | null;
}

// CourseIntellect.Domain/Entities/ExamSolvingEntities.cs
export interface TeacherReviewComment {
  id: string;
  tenantId: string | null;
  questionAttemptId: string;
  teacherUserId: string | null;
  teacherName: string;
  comment: string;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/ExamSolving/ExamSolvingDtos.cs
export interface TeacherReviewResponse {
  id: string;
  teacherName: string;
  comment: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/TeacherTimetableSlot.cs
export interface TeacherTimetableSlot {
  id: string;
  tenantId: string | null;
  teacherUserId: string | null;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  lesson: string;
  createdAtUtc: string;
}

// CourseIntellect.Api/Controllers/ReportsController.cs
export interface TeacherWeeklyReportAttachmentRequest {
  name?: string | null;
  url?: string | null;
  fileType?: string | null;
}

// CourseIntellect.Api/Controllers/ReportsController.cs
export interface TeacherWeeklyReportCreateRequest {
  teacherUsername?: string | null;
  teacherName: string;
  studentUsername?: string | null;
  studentName: string;
  className: string;
  subject: string;
  title?: string | null;
  summary: string;
  highlights?: string | null;
  supportNotes?: string | null;
  weeklyPeriodLabel?: string | null;
  attachments?: TeacherWeeklyReportAttachmentRequest[] | null;
}

// CourseIntellect.Application/Interfaces/ITenantBackupService.cs
export interface TenantBackupResult {
  tableCount: number;
  rowCount: number;
  fileCount: number;
  fileBytes: number;
}

// CourseIntellect.Api/Controllers/PlatformConfigurationsController.cs
export interface TenantBrandingUpdateRequest {
  logoUrl?: string | null;
}

// CourseIntellect.Api/Controllers/TenantFeaturesController.cs
export interface TenantFeatureDefinition {
  key: string;
  label: string;
  description: string;
}

// CourseIntellect.Domain/Entities/TenantGroup.cs
export interface TenantGroup {
  id: string;
  name: string;
  slug: string;
  parentGroupId: string | null;
  ownerUserId: string | null;
  note: string;
  createdAtUtc: string;
}

// CourseIntellect.Domain/Entities/TenantRegistrationApplication.cs
export interface TenantRegistrationApplication {
  id: string;
  institutionName: string;
  contactName: string;
  contactEmail: string;
  contactEmailNormalized: string;
  contactPhone: string | null;
  plan: string;
  institutionType: InstitutionType;
  estimatedStudents: number;
  status: string;
  registrationIp: string | null;
  registrationUserAgent: string | null;
  registrationReferer: string | null;
  kvkkConsentVersion: string | null;
  kvkkConsentAtUtc: string | null;
  createdAtUtc: string;
  approvedAtUtc: string | null;
  rejectedAtUtc: string | null;
  rejectionReason: string | null;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  createdTenantId: string | null;
  verificationTokenHash: string | null;
  verificationExpiresAtUtc: string | null;
  verificationSentAtUtc: string | null;
  verifiedAtUtc: string | null;
  readonly verificationState?: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface TenantRegistrationContext {
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export const TenantRegistrationOutcome = {
  Accepted: 0,
  Duplicate: 1,
  Invalid: 2,
  CaptchaFailed: 3,
  Throttled: 4,
  Blocked: 5,
} as const;
export type TenantRegistrationOutcome = (typeof TenantRegistrationOutcome)[keyof typeof TenantRegistrationOutcome];

// CourseIntellect.Application/Interfaces/ITenantSetupDocumentService.cs
export interface TenantSetupDocumentModel {
  institutionName: string;
  plan: string;
  institutionType: string;
  loginUrl: string;
  username: string;
  temporaryPassword: string;
  passwordExpiresAtUtc: string | null;
  issuedByName: string;
  issuedAtUtc: string;
}

// CourseIntellect.Domain/Entities/TenantWorkspace.cs
export interface TenantWorkspace {
  id: string;
  groupId: string | null;
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string | null;
  pendingAdminPasswordHash: string | null;
  plan: string;
  status: string;
  institutionType: InstitutionType;
  drivingSchoolModuleEnabled: boolean;
  adminUserId: string | null;
  userCount: number;
  branchCount: number;
  studentCount: number;
  staffCount: number;
  monthlyFee: number;
  collectedAmount: number;
  storageUsedGb: number;
  apiUsage: number;
  registrationIp: string | null;
  registrationUserAgent: string | null;
  registrationReferer: string | null;
  registrationEstimatedStudents: number | null;
  kvkkConsentVersion: string | null;
  kvkkConsentAtUtc: string | null;
  approvedAtUtc: string | null;
  rejectedAtUtc: string | null;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/TenantWorkspaceDto.cs
export interface TenantWorkspaceDto {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  users: number;
  branches: number;
  studentCount: number;
  staffCount: number;
  monthlyFee: number;
  collected: number;
  storage: number;
  api: number;
  createdAtUtc: string;
  slug: string;
  contactName: string;
  contactPhone: string;
  adminUserId: string | null;
  adminUsername: string | null;
  temporaryPassword: string | null;
  approvedAtUtc: string | null;
  institutionType: string;
  drivingSchoolModuleEnabled: boolean;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  verificationState: string;
  temporaryPasswordExpiresAtUtc: string | null;
  setupDocumentBase64: string | null;
  setupDocumentFileName: string | null;
}

// CourseIntellect.Application/DTOs/Timetable/TimetableDtos.cs
export interface TimetableSlotRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className?: string | null;
  lesson?: string | null;
}

// CourseIntellect.Application/DTOs/Timetable/TimetableDtos.cs
export interface TimetableSlotResponse {
  id: string;
  teacherUserId: string | null;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  lesson: string;
}

// CourseIntellect.Api/Controllers/ContactMessagesController.cs
export interface ToggleStarRequest {
  isStarred: boolean;
}

// CourseIntellect.Application/DTOs/Translations/TranslationDto.cs
export interface TranslationDto {
  id: string;
  key: string;
  language: string;
  value: string;
  category: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Entities/TranslationItem.cs
export interface TranslationItem {
  id: string;
  key: string;
  language: string;
  value: string;
  category: string;
  updatedAtUtc: string;
}

// CourseIntellect.Domain/Enums/DrivingSchoolEnums.cs
export const TransmissionType = {
  Manual: 1,
  Automatic: 2,
} as const;
export type TransmissionType = (typeof TransmissionType)[keyof typeof TransmissionType];

// CourseIntellect.Application/DTOs/Accounting/UpdateApprovalStatusRequest.cs
export interface UpdateApprovalStatusRequest {
  status: string;
}

// CourseIntellect.Api/Controllers/ClassesController.cs
export interface UpdateClassAssignmentsRequest {
  studentIds?: string[] | null;
  advisorTeacherId?: string | null;
}

// CourseIntellect.Application/Interfaces/IConsentFormService.cs
export interface UpdateConsentFormRequest {
  staffNotes?: string | null;
}

// CourseIntellect.Application/DTOs/ContactMessages/UpdateContactMessageStatusRequest.cs
export interface UpdateContactMessageStatusRequest {
  status: string;
  isStarred: boolean;
}

// CourseIntellect.Application/DTOs/Contents/UpdateContentStatusRequest.cs
export interface UpdateContentStatusRequest {
  publishStatus: string;
}

// CourseIntellect.Application/DTOs/Courses/UpdateCourseRequest.cs
export interface UpdateCourseRequest {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: string;
  level: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/Duty/DutyDtos.cs
export interface UpdateDutyRequest {
  dutyType: string;
  location: string;
  dutyDate: string;
  day: string;
  startTime: string;
  endTime: string;
  description?: string | null;
}

// CourseIntellect.Application/DTOs/ExamResults/UpdateExamResultRequest.cs
export interface UpdateExamResultRequest {
  examTitle: string;
  type: string;
  subject: string;
  dateLabel: string;
  className: string;
  score: number;
  net: number;
  correctCount?: number | null;
  wrongCount?: number | null;
  totalQuestions?: number | null;
}

// CourseIntellect.Application/DTOs/Accounting/UpdateInstallmentRequest.cs
export interface UpdateInstallmentRequest {
  amount: string;
  due: string;
  status: string;
  note: string;
}

// CourseIntellect.Application/DTOs/System/UpdateMaintenanceRequest.cs
export interface UpdateMaintenanceRequest {
  enabled: boolean;
  message?: string | null;
}

// CourseIntellect.Application/DTOs/Meetings/UpdateMeetingRequestStatusRequest.cs
export interface UpdateMeetingRequestStatusRequest {
  status: string;
  meetingLink?: string | null;
}

// CourseIntellect.Application/DTOs/Admin/OrgUnitDtos.cs
export interface UpdateOrgUnitRequest {
  name: string;
  unitType: string;
  parentUnitId?: string | null;
  managerName?: string | null;
  note?: string | null;
}

// CourseIntellect.Application/DTOs/Auth/UpdateProfileRequest.cs
export interface UpdateProfileRequest {
  fullName: string;
  campus: string;
  departmentOrBranch: string;
}

// CourseIntellect.Application/DTOs/Accounting/UpdateSalaryRequest.cs
export interface UpdateSalaryRequest {
  employee: string;
  role: string;
  amount: string;
  payDate: string;
  status: string;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateServiceDriverRequest {
  userId: string;
  phoneNumber: string;
  licenseNumber: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateServiceRouteRequest {
  name: string;
  routeType: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateServiceRouteStopRequest {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateServiceVehicleRequest {
  plateNumber: string;
  brand: string;
  model: string;
  capacity: number;
  isActive: boolean;
  vehicleNumber?: string;
}

// CourseIntellect.Application/DTOs/SiteContent/UpdateSiteContentRequest.cs
export interface UpdateSiteContentRequest {
  content: unknown;
  language: string;
  publish: boolean;
}

// CourseIntellect.Application/DTOs/Staff/CreateStaffRequest.cs
export interface UpdateStaffAssignmentRequest {
  role?: string | null;
  branchId?: string | null;
  customRoleId?: string | null;
  clearCustomRole?: boolean;
  clearBranch?: boolean;
}

// CourseIntellect.Application/DTOs/Staff/UpdateStaffRequest.cs
export interface UpdateStaffRequest {
  fullName: string;
  departmentOrBranch: string;
  phone: string;
  email: string;
  education: string;
  campus: string;
  homeroomClass: string;
  assignedClasses: string[];
  maritalStatus: string;
  childCount: number;
  note: string;
  photoUrl?: string | null;
}

// CourseIntellect.Application/DTOs/Students/UpdateStudentRequest.cs
export interface UpdateStudentRequest {
  fullName: string;
  tcNo: string;
  className: string;
  currentSchool: string;
  schoolNumber: string;
  birthDate: string;
  programType: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  note: string;
  photoUrl?: string | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateStudentServiceAssignmentRequest {
  routeId: string;
  stopId: string;
  isActive: boolean;
}

// CourseIntellect.Application/DTOs/StudyPlans/UpdateStudyPlanStateRequest.cs
export interface UpdateStudyPlanStateRequest {
  studentName: string;
  planItemsSerialized: string;
  streakCount: number;
  xpPoints: number;
  lastCompletedAt?: string | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/UpdateSupportTicketRequest.cs
export interface UpdateSupportTicketRequest {
  status?: string | null;
  priority?: string | null;
  lastMessage?: string | null;
  messages?: number | null;
}

// CourseIntellect.Api/Controllers/TenantFeaturesController.cs
export interface UpdateTenantFeaturesRequest {
  features?: Record<string, boolean> | null;
}

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface UpdateVehicleLocationRequest {
  tripId: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
}

// CourseIntellect.Application/DTOs/Contents/UploadedAssetDto.cs
export interface UploadedAssetDto {
  fileName: string;
  fileUrl: string;
  contentType: string;
  size: number;
}

// CourseIntellect.Application/DTOs/AppSettings/UpsertAppSettingRequest.cs
export interface UpsertAppSettingRequest {
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
}

// CourseIntellect.Api/Controllers/CustomRolesController.cs
export interface UpsertCustomRoleRequest {
  name: string;
  baseRole?: string | null;
  modules?: string[] | null;
  permissions?: string[] | null;
  modulesRestricted?: boolean;
}

// CourseIntellect.Application/DTOs/PlatformConfigurations/UpsertPlatformConfigurationRequest.cs
export interface UpsertPlatformConfigurationRequest {
  configurationType: string;
  scopeKey: string;
  displayName: string;
  payloadJson: string;
}

// CourseIntellect.Api/Controllers/PlatformPackagesController.cs
export interface UpsertPlatformPackageRequest {
  name: string;
  roles: unknown;
}

// CourseIntellect.Api/Controllers/ScheduleController.cs
export interface UpsertScheduleEntryRequest {
  className: string;
  day: string;
  time: string;
  subject: string;
  teacher: string;
  room?: string | null;
}

// CourseIntellect.Application/DTOs/PlatformOperations/UpsertTenantWorkspaceRequest.cs
export interface UpsertTenantWorkspaceRequest {
  name: string;
  email: string;
  plan: string;
  status: string;
  users: number;
  branches: number;
  studentCount: number;
  staffCount: number;
  monthlyFee: number;
  collected: number;
  storage: number;
  api: number;
  institutionType?: string;
  drivingSchoolModuleEnabled?: boolean;
}

// CourseIntellect.Application/DTOs/Translations/UpsertTranslationRequest.cs
export interface UpsertTranslationRequest {
  key: string;
  language: string;
  value: string;
  category: string;
}

// CourseIntellect.Infrastructure/Services/PlatformOperationsService.cs
export interface UserDependency {
  schema: string;
  name: string;
  userColumn: string;
  readonly key?: string;
}

// CourseIntellect.Application/DTOs/Common/UserExtraRoleRequest.cs
export interface UserExtraRoleRequest {
  roleName: string;
}

// CourseIntellect.Application/DTOs/Scope/ScopeAdminDtos.cs
export interface UserGrantDto {
  id: string;
  level: string;
  targetId: string | null;
  targetName: string;
  accessMode: string;
  isHome: boolean;
}

// CourseIntellect.Infrastructure/Auth/UsernameGenerator.cs
export interface UsernameContext {
  role: string;
  className: string | null;
  branch: string | null;
  studentClassName: string | null;
}

// CourseIntellect.Domain/Enums/UserRole.cs
export const UserRole = {
  Admin: 1,
  Teacher: 2,
  Accounting: 3,
  Administrative: 4,
  Parent: 5,
  Student: 6,
  Developer: 7,
  Cafeteria: 8,
  BranchManager: 9,
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// CourseIntellect.Application/DTOs/Common/UserRoleAssignmentRequest.cs
export interface UserRoleAssignmentRequest {
  primaryRole: string;
  departmentOrBranch: string;
}

// CourseIntellect.Domain/Entities/UserScopeGrant.cs
export interface UserScopeGrant {
  id: string;
  userId: string;
  level: ScopeLevel;
  targetId: string | null;
  accessMode: ScopeAccessMode;
  isHome: boolean;
  createdAtUtc: string;
}

// CourseIntellect.Application/DTOs/Scope/MyScopeResponse.cs
export interface UserScopeOptions {
  readOnly: boolean;
  tenants: ScopeTenantDto[];
}

// CourseIntellect.Domain/Enums/UserStatus.cs
export const UserStatus = {
  Active: 1,
  Passive: 2,
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// CourseIntellect.Application/DTOs/Common/UserStatusUpdateRequest.cs
export interface UserStatusUpdateRequest {
  status: string;
}

// CourseIntellect.Application/DTOs/Common/UserSummaryDto.cs
export interface UserSummaryDto {
  id: string;
  fullName: string;
  username: string;
  primaryRole: string;
  extraRoles: string[];
  status: string;
  campus: string;
  departmentOrBranch: string;
}

// CourseIntellect.Domain/Enums/DrivingAppointmentEnums.cs
export const VehicleAssignmentType = {
  Primary: 1,
  Secondary: 2,
  Temporary: 3,
  SpecificDays: 4,
  Backup: 5,
} as const;
export type VehicleAssignmentType = (typeof VehicleAssignmentType)[keyof typeof VehicleAssignmentType];

// CourseIntellect.Application/DTOs/ServiceTracking/ServiceTrackingDtos.cs
export interface VehicleLocationDto {
  id: string;
  vehicleId: string;
  driverId: string;
  tripId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

// CourseIntellect.Application/DTOs/PlatformOperations/RegisterTenantRequest.cs
export interface VerifyRegistrationRequest {
  token?: string | null;
}
