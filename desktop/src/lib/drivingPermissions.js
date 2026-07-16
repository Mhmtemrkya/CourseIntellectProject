import { useEffect, useMemo, useState } from 'react';
import { fetchDrivingPermissions } from './api/modules';

// Sürücü kursu ince taneli yetkileri. Backend'in verdiği izin listesi oturum
// boyunca önbelleğe alınır; menüler ve butonlar buna göre gösterilir.
//
// Bu bir GÜVENLİK sınırı DEĞİLDİR — yalnızca kullanıcıya yapamayacağı işlemi
// göstermemek içindir. Asıl zorlama backend'deki [RequireDrivingPermission].

export const DRIVING = {
  dashboardView: 'driving.dashboard.view',

  studentView: 'driving.student.view',
  studentCreate: 'driving.student.create',
  studentUpdate: 'driving.student.update',
  studentDocumentView: 'driving.student.document.view',
  studentDocumentUpload: 'driving.student.document.upload',
  studentDocumentReview: 'driving.student.document.review',

  packageView: 'driving.package.view',
  packageCreate: 'driving.package.create',
  packageUpdate: 'driving.package.update',
  packageChange: 'driving.package.change',

  vehicleView: 'driving.vehicle.view',
  vehicleCreate: 'driving.vehicle.create',
  vehicleUpdate: 'driving.vehicle.update',
  vehicleDocumentView: 'driving.vehicle.document.view',
  vehicleDocumentUpload: 'driving.vehicle.document.upload',
  vehicleDocumentReview: 'driving.vehicle.document.review',
  vehicleServiceView: 'driving.vehicle.service.view',
  vehicleServiceManage: 'driving.vehicle.service.manage',
  vehicleServiceReport: 'driving.vehicle.service.report',

  instructorView: 'driving.instructor.view',
  instructorCreate: 'driving.instructor.create',
  instructorUpdate: 'driving.instructor.update',
  instructorAssignmentManage: 'driving.instructor.assignment.manage',

  appointmentView: 'driving.appointment.view',
  appointmentCreate: 'driving.appointment.create',
  appointmentCancel: 'driving.appointment.cancel',
  appointmentReschedule: 'driving.appointment.reschedule',
  appointmentApprove: 'driving.appointment.approve',

  lessonViewAll: 'driving.lesson.view.all',
  lessonMarkNoShow: 'driving.lesson.noshow',
  lessonBalanceAdjust: 'driving.lessonbalance.adjust',
  theoryView: 'driving.theory.view',
  theoryManage: 'driving.theory.manage',
  theoryAttendance: 'driving.theory.attendance',
  examView: 'driving.exam.view',
  examManage: 'driving.exam.manage',
  examResultEnter: 'driving.exam.result',
  graduationView: 'driving.graduation.view',
  graduationManage: 'driving.graduation.manage',
  certificateIssue: 'driving.certificate.issue',
  certificateDeliver: 'driving.certificate.deliver',
  certificateRevoke: 'driving.certificate.revoke',
  graduationOverrideRequest: 'driving.graduation.override.request',
  graduationOverrideApprove: 'driving.graduation.override.approve',
  graduationRevokeRequest: 'driving.graduation.revoke.request',
  settingsManage: 'driving.settings.manage',

  financeView: 'driving.finance.view',
  financeCollect: 'driving.finance.collect',
  financeDiscount: 'driving.finance.discount',
  financeRefund: 'driving.finance.refund',
  financeReportView: 'driving.finance.report.view',

  reportView: 'driving.report.view',
  reportExport: 'driving.report.export',
  permissionManage: 'driving.permission.manage',

  overrideVehicleCompliance: 'driving.override.vehicle_compliance',
  overrideAppointmentRule: 'driving.override.appointment_rule',
  overrideTransmission: 'driving.override.transmission',
};

export const OVERRIDE_LABELS = {
  [DRIVING.overrideVehicleCompliance]: 'Uygunsuz araç (bakım/evrak)',
  [DRIVING.overrideAppointmentRule]: 'Randevu çakışması',
  [DRIVING.overrideTransmission]: 'Vites uyumsuzluğu',
};

let cached = null;
let pending = null;

const EMPTY = { roleKey: 'none', permissions: new Set(), isOwner: false, isBranchScoped: false, moduleAvailable: false };

export async function getDrivingPermissions() {
  if (cached) return cached;
  if (!pending) {
    pending = fetchDrivingPermissions()
      .then((payload) => ({
        roleKey: payload?.roleKey ?? 'none',
        permissions: new Set(Array.isArray(payload?.permissions) ? payload.permissions : []),
        isOwner: payload?.isOwner === true,
        isBranchScoped: payload?.isBranchScoped === true,
        moduleAvailable: payload?.moduleAvailable === true,
      }))
      // Yetki okunamazsa hiçbir şey gösterme: aksi hâlde kullanıcıya
      // backend'in reddedeceği butonlar açılır.
      .catch(() => EMPTY);
  }
  cached = await pending;
  return cached;
}

export function resetDrivingPermissionCache() {
  cached = null;
  pending = null;
}

/// Menü yolu → o sayfayı açabilmek için gereken izinlerden en az biri.
const PATH_PERMISSIONS = {
  '/driving/dashboard': [DRIVING.dashboardView],
  '/driving/students/new': [DRIVING.studentCreate],
  '/driving/assignments': [DRIVING.instructorAssignmentManage, DRIVING.instructorUpdate, DRIVING.settingsManage],
  '/driving/operations': [DRIVING.packageView, DRIVING.vehicleView],
  '/driving/hub': [DRIVING.appointmentView, DRIVING.studentView, DRIVING.lessonViewAll],
  '/driving/scheduling': [DRIVING.appointmentView, DRIVING.studentView],
  '/driving/calendar': [DRIVING.appointmentView],
  '/driving/lessons': [DRIVING.lessonViewAll],
  '/driving/fleet-compliance': [DRIVING.vehicleDocumentView, DRIVING.vehicleServiceView],
  '/driving/education': [DRIVING.theoryView, DRIVING.examView],
  '/driving/graduation': [DRIVING.graduationView],
  '/driving/reports': [DRIVING.reportView],
};

export function isDrivingPathAllowed(path, state) {
  const required = PATH_PERMISSIONS[path];
  if (!required) return true; // sürücü kursu sayfası değil
  if (!state) return false;
  return required.some((code) => state.permissions.has(code));
}

/// React kancası: `can('driving.vehicle.create')` ile buton/menü gizlenir.
export function useDrivingPermissions() {
  const [state, setState] = useState(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    if (cached) { setState(cached); setLoading(false); return undefined; }
    getDrivingPermissions().then((resolved) => {
      if (!active) return;
      setState(resolved);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // `can` kimliği sabit kalmalı: sayfaların veri yükleyen useCallback'leri buna
  // bağımlı ve her render'da yeni bir fonksiyon dönseydik sonsuz döngüye girerdi.
  return useMemo(() => ({
    loading,
    roleKey: state?.roleKey ?? 'none',
    isOwner: state?.isOwner ?? false,
    isBranchScoped: state?.isBranchScoped ?? false,
    permissions: state?.permissions ?? new Set(),
    can: (code) => state?.permissions.has(code) ?? false,
    canAny: (...codes) => codes.some((code) => state?.permissions.has(code) ?? false),
  }), [state, loading]);
}
