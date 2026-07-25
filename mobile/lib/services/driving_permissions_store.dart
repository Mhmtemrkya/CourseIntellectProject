import 'driving_school_api_service.dart';

/// Sürücü kursu ince taneli izin kodları. Backend'in verdiği liste oturum
/// boyunca önbelleğe alınır; sekmeler ve butonlar buna göre gösterilir.
///
/// Bu bir GÜVENLİK sınırı DEĞİLDİR — asıl zorlama backend'deki
/// [RequireDrivingPermission] filtresidir. Buradaki amaç, kullanıcıya
/// backend'in reddedeceği butonu hiç göstermemek.
class DrivingPermissions {
  static const dashboardView = 'driving.dashboard.view';

  static const studentView = 'driving.student.view';
  static const studentCreate = 'driving.student.create';
  static const studentUpdate = 'driving.student.update';
  static const studentDeactivate = 'driving.student.deactivate';
  static const studentDocumentView = 'driving.student.document.view';
  static const studentDocumentUpload = 'driving.student.document.upload';
  static const studentDocumentReview = 'driving.student.document.review';

  static const packageView = 'driving.package.view';
  static const packageCreate = 'driving.package.create';
  static const packageUpdate = 'driving.package.update';
  static const packageDelete = 'driving.package.delete';

  static const vehicleView = 'driving.vehicle.view';
  static const vehicleCreate = 'driving.vehicle.create';
  static const vehicleDocumentView = 'driving.vehicle.document.view';
  static const vehicleDocumentUpload = 'driving.vehicle.document.upload';
  static const vehicleServiceView = 'driving.vehicle.service.view';
  static const vehicleServiceManage = 'driving.vehicle.service.manage';
  static const vehicleServiceReport = 'driving.vehicle.service.report';

  static const instructorView = 'driving.instructor.view';
  static const instructorCreate = 'driving.instructor.create';
  static const instructorUpdate = 'driving.instructor.update';
  static const instructorDeactivate = 'driving.instructor.deactivate';
  static const overrideDocumentExpiry = 'driving.override.document_expiry';
  static const overrideStudentDocuments = 'driving.override.student_documents';

  static const appointmentView = 'driving.appointment.view';
  static const appointmentCreate = 'driving.appointment.create';
  static const appointmentCancel = 'driving.appointment.cancel';

  static const lessonViewAll = 'driving.lesson.view.all';
  static const lessonStart = 'driving.lesson.start';
  static const lessonComplete = 'driving.lesson.complete';
  static const lessonMarkNoShow = 'driving.lesson.noshow';
  static const theoryView = 'driving.theory.view';
  static const theoryManage = 'driving.theory.manage';
  static const theoryAttendance = 'driving.theory.attendance';
  static const examView = 'driving.exam.view';
  static const examManage = 'driving.exam.manage';
  static const examResultEnter = 'driving.exam.result';
  static const graduationView = 'driving.graduation.view';
  static const graduationManage = 'driving.graduation.manage';
  static const certificateIssue = 'driving.certificate.issue';
  static const certificateDeliver = 'driving.certificate.deliver';
  static const certificateRevoke = 'driving.certificate.revoke';
  static const graduationOverrideRequest =
      'driving.graduation.override.request';
  static const graduationOverrideApprove =
      'driving.graduation.override.approve';
  static const graduationRevokeRequest = 'driving.graduation.revoke.request';
  static const settingsManage = 'driving.settings.manage';

  static const financeView = 'driving.finance.view';
  static const financeCollect = 'driving.finance.collect';
  static const financeReportView = 'driving.finance.report.view';

  static const reportView = 'driving.report.view';
  static const reportExport = 'driving.report.export';
  static const mebbisView = 'driving.mebbis.view';
  static const mebbisManage = 'driving.mebbis.manage';
  static const mebbisVerify = 'driving.mebbis.verify';
}

class DrivingPermissionSnapshot {
  const DrivingPermissionSnapshot({
    required this.roleKey,
    required this.permissions,
    required this.isOwner,
    required this.isBranchScoped,
    required this.moduleAvailable,
  });

  final String roleKey;
  final Set<String> permissions;
  final bool isOwner;
  final bool isBranchScoped;
  final bool moduleAvailable;

  static const empty = DrivingPermissionSnapshot(
    roleKey: 'none',
    permissions: <String>{},
    isOwner: false,
    isBranchScoped: false,
    moduleAvailable: false,
  );

  bool can(String permission) => permissions.contains(permission);

  bool canAny(List<String> codes) => codes.any(permissions.contains);
}

class DrivingPermissionsStore {
  DrivingPermissionsStore._();
  static final instance = DrivingPermissionsStore._();

  DrivingPermissionSnapshot? _cached;
  Future<DrivingPermissionSnapshot>? _pending;

  Future<DrivingPermissionSnapshot> load() async {
    final cached = _cached;
    if (cached != null) return cached;
    _pending ??= _fetch();
    final resolved = await _pending!;
    _cached = resolved;
    return resolved;
  }

  Future<DrivingPermissionSnapshot> _fetch() async {
    try {
      final payload = await DrivingSchoolApiService.instance.myPermissions();
      return DrivingPermissionSnapshot(
        roleKey: payload['roleKey']?.toString() ?? 'none',
        permissions: (payload['permissions'] as List? ?? const [])
            .map((e) => e.toString())
            .toSet(),
        isOwner: payload['isOwner'] == true,
        isBranchScoped: payload['isBranchScoped'] == true,
        moduleAvailable: payload['moduleAvailable'] == true,
      );
    } catch (_) {
      // Yetki okunamazsa hiçbir işlem butonu gösterme.
      return DrivingPermissionSnapshot.empty;
    }
  }

  /// Çıkışta ve şube değişiminde çağrılır; yeni oturum yeni izinlerle gelir.
  void reset() {
    _cached = null;
    _pending = null;
  }
}
