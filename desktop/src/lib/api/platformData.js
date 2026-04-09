import {
  fetchAccountingDashboard,
  fetchAnnouncements,
  fetchContents,
  fetchHomework,
  fetchMeetingRequests,
  fetchNotifications,
  fetchPlatformTenants,
  fetchQuestionThreads,
  fetchStaff,
  fetchStudents,
  fetchSupportTickets,
} from './modules';

function parsePlatformMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export async function fetchPlatformData() {
  const [students, staff, dashboard, notifications, announcements, contents, homework, meetingRequests, questionThreads, tenants, supportTickets] = await Promise.all([
    fetchStudents().catch(() => []),
    fetchStaff().catch(() => []),
    fetchAccountingDashboard().catch(() => null),
    fetchNotifications('Admin').catch(() => []),
    fetchAnnouncements().catch(() => []),
    fetchContents(false).catch(() => []),
    fetchHomework().catch(() => []),
    fetchMeetingRequests().catch(() => []),
    fetchQuestionThreads().catch(() => []),
    fetchPlatformTenants().catch(() => []),
    fetchSupportTickets().catch(() => []),
  ]);

  const totalRevenue = (dashboard?.collections || []).reduce((sum, item) => sum + parsePlatformMoney(item.amount), 0);
  const pendingPayments = (dashboard?.invoices || [])
    .filter((invoice) => String(invoice.status || '').toLowerCase() !== 'paid')
    .reduce((sum, item) => sum + parsePlatformMoney(item.amount), 0);
  const overduePayments = (dashboard?.installments || [])
    .filter((installment) => {
      const dueValue = installment.dueDate || installment.due;
      return dueValue && new Date(dueValue).getTime() < Date.now() && String(installment.status || '').toLowerCase() !== 'paid';
    })
    .reduce((sum, item) => sum + parsePlatformMoney(item.amount), 0);

  return {
    students,
    staff,
    dashboard,
    notifications,
    announcements,
    contents,
    homework,
    meetingRequests,
    questionThreads,
    tenants,
    supportTickets,
    stats: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((item) => item.status === 'active').length,
      totalUsers: students.length + staff.length,
      monthlyRevenue: totalRevenue,
      pendingPayments,
      overduePayments,
      storageUsed: `${tenants.reduce((sum, item) => sum + item.storage, 0).toFixed(1)} GB`,
      apiCalls: tenants.reduce((sum, item) => sum + item.api, 0),
    },
  };
}
