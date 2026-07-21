import 'dart:convert';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import 'branch_scope_store.dart';

class DrivingSchoolApiService {
  DrivingSchoolApiService._();
  static final instance = DrivingSchoolApiService._();

  Future<Map<String, dynamic>> _get(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        response.statusCode == 403
            ? 'Bu modüle erişim yetkiniz yok.'
            : 'İstek başarısız (${response.statusCode}).',
      );
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message = 'İşlem başarısız (${response.statusCode}).';
      try {
        message =
            (jsonDecode(response.body) as Map)['message']?.toString() ??
            message;
      } catch (_) {}
      throw StateError(message);
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
        ...ScopeHeaders.merged,
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message = 'İşlem başarısız (${response.statusCode}).';
      try {
        message =
            (jsonDecode(response.body) as Map)['message']?.toString() ??
            message;
      } catch (_) {}
      throw StateError(message);
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<bool> isAvailable() async =>
      (await _get('/api/driving-school/status'))['available'] == true;
  Future<Map<String, dynamic>> me() => _get('/api/driving-school/me');
  Future<Map<String, dynamic>> myPermissions() =>
      _get('/api/driving-school/permissions/me');
  Future<Map<String, dynamic>> dashboard() =>
      _get('/api/driving-school/dashboard');
  Future<Map<String, dynamic>> termAlerts() =>
      _get('/api/driving-school/term-alerts');
  Future<Map<String, dynamic>> mebbisWorkCenter({
    String? status,
    String? type,
    String? search,
  }) {
    final query = <String, String>{'pageSize': '100'};
    if (status != null && status.isNotEmpty) query['status'] = status;
    if (type != null && type.isNotEmpty) query['type'] = type;
    if (search != null && search.trim().isNotEmpty) {
      query['search'] = search.trim();
    }
    final uri = Uri(
      path: '/api/driving-school/mebbis/work-center',
      queryParameters: query,
    );
    return _get(uri.toString());
  }

  Future<Map<String, dynamic>> syncMebbisWorkCenter() =>
      _post('/api/driving-school/mebbis/work-center/sync', const {});

  Future<Map<String, dynamic>> mebbisErrorLibrary({String search = ''}) => _get(
    Uri(
      path: '/api/driving-school/mebbis/errors',
      queryParameters: search.trim().isEmpty ? null : {'search': search.trim()},
    ).toString(),
  );
  Future<Map<String, dynamic>> mebbisErrorDetail(String id) =>
      _get('/api/driving-school/mebbis/errors/$id');
  Future<Map<String, dynamic>> syncMebbisErrorDefaults() =>
      _post('/api/driving-school/mebbis/errors/sync-defaults', const {});
  Future<Map<String, dynamic>> reportMebbisError(String id, String note) =>
      _post('/api/driving-school/mebbis/errors/$id/occurrences', {
        'note': note,
        'sourceType': 'MobileManual',
      });
  Future<Map<String, dynamic>> resolveMebbisError(
    String id,
    String note,
    int version,
  ) => _put('/api/driving-school/mebbis/errors/occurrences/$id/resolve', {
    'resolutionNote': note,
    'expectedVersion': version,
  });

  Future<Map<String, dynamic>> termOpeningWizardOptions() =>
      _get('/api/driving-school/term-opening-wizard/options');

  Future<Map<String, dynamic>> validateTermOpeningWizard(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/term-opening-wizard/validate', body);

  Future<Map<String, dynamic>> openTermOpeningWizard(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/term-opening-wizard/open', body);

  Future<Map<String, dynamic>> transferPackages() =>
      _get('/api/driving-school/mebbis/transfer-packages');
  Future<Map<String, dynamic>> createTransferPackage(
    String packageType,
    String studentGroupId,
  ) => _post('/api/driving-school/mebbis/transfer-packages', {
    'packageType': packageType,
    'studentGroupId': studentGroupId,
  });
  Future<Map<String, dynamic>> updateTransferPackageStatus(
    String id,
    String status,
    int expectedVersion, {
    String errorResult = '',
  }) => _put('/api/driving-school/mebbis/transfer-packages/$id/status', {
    'status': status,
    'errorResult': errorResult,
    'expectedVersion': expectedVersion,
  });

  Future<Map<String, dynamic>> mebbisImports() =>
      _get('/api/driving-school/mebbis/imports');
  Future<Map<String, dynamic>> mebbisImportDetail(String id) =>
      _get('/api/driving-school/mebbis/imports/$id?pageSize=200');
  Future<Map<String, dynamic>> applyMebbisImport(
    String id,
    int expectedPreviewVersion,
    List<String> excludedRowIds, {
    bool createRetryFees = false,
  }) => _post('/api/driving-school/mebbis/imports/$id/apply', {
    'expectedPreviewVersion': expectedPreviewVersion,
    'excludedRowIds': excludedRowIds,
    'createRetryFees': createRetryFees,
  });
  Future<Map<String, dynamic>> rejectMebbisImport(
    String id,
    int expectedPreviewVersion,
    String reason,
  ) => _post('/api/driving-school/mebbis/imports/$id/reject', {
    'expectedPreviewVersion': expectedPreviewVersion,
    'reason': reason,
  });

  Future<Map<String, dynamic>> mebbisReconciliations() =>
      _get('/api/driving-school/mebbis/reconciliations');
  Future<Map<String, dynamic>> mebbisReconciliationDetail(
    String id, {
    String classification = '',
  }) => _get(
    '/api/driving-school/mebbis/reconciliations/$id?pageSize=500${classification.isEmpty ? '' : '&classification=$classification'}',
  );
  Future<Map<String, dynamic>> createMebbisReconciliation(
    String studentGroupId,
    String candidateImportSessionId,
  ) => _post('/api/driving-school/mebbis/reconciliations', {
    'studentGroupId': studentGroupId,
    'candidateImportSessionId': candidateImportSessionId,
  });
  Future<Map<String, dynamic>> mebbisExamResults() =>
      _get('/api/driving-school/mebbis/exam-results');
  Future<Map<String, dynamic>> mebbisExamResultDetail(String id) =>
      _get('/api/driving-school/mebbis/exam-results/$id?pageSize=500');
  Future<Map<String, dynamic>> mebbisCertificateNumbers() =>
      _get('/api/driving-school/mebbis/certificate-numbers');
  Future<Map<String, dynamic>> mebbisCertificateNumberDetail(String id) =>
      _get('/api/driving-school/mebbis/certificate-numbers/$id?pageSize=500');

  Future<Map<String, dynamic>> previewMebbisImport(
    PlatformFile file,
    String importType,
    String? studentGroupId,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '${ApiConfig.baseUrl}/api/driving-school/mebbis/imports/preview',
      ),
    );
    request.headers.addAll({
      'Authorization': 'Bearer ${session.accessToken}',
      ...ScopeHeaders.merged,
    });
    request.fields['importType'] = importType;
    if (studentGroupId != null && studentGroupId.isNotEmpty) {
      request.fields['studentGroupId'] = studentGroupId;
    }
    if (file.bytes != null) {
      request.files.add(
        http.MultipartFile.fromBytes('file', file.bytes!, filename: file.name),
      );
    } else if (file.path != null) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          file.path!,
          filename: file.name,
        ),
      );
    } else {
      throw StateError('Dosya içeriği okunamadı.');
    }
    final response = await http.Response.fromStream(await request.send());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message = 'Önizleme oluşturulamadı (${response.statusCode}).';
      try {
        message =
            (jsonDecode(response.body) as Map)['message']?.toString() ??
            message;
      } catch (_) {}
      throw StateError(message);
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Uint8List> downloadAuthenticated(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('Dosya indirilemedi (${response.statusCode}).');
    }
    return response.bodyBytes;
  }

  Future<Map<String, dynamic>> changeMebbisWorkStatus(
    String workType,
    String subjectId,
    String status,
    int expectedVersion, {
    String reason = '',
    String note = '',
  }) => _put(
    '/api/driving-school/mebbis/work-center/items/${Uri.encodeComponent(workType)}/$subjectId/status',
    {
      'status': status,
      'reason': reason,
      'note': note,
      'expectedVersion': expectedVersion,
    },
  );

  Future<Map<String, dynamic>> mebbisEntryAssistant(String profileId) =>
      _get('/api/driving-school/mebbis/entry-assistant/students/$profileId');

  Future<Map<String, dynamic>> updateMebbisEntryField(
    String profileId,
    String fieldKey,
    bool completed,
    int expectedVersion,
  ) => _put(
    '/api/driving-school/mebbis/entry-assistant/students/$profileId/fields/${Uri.encodeComponent(fieldKey)}',
    {'completed': completed, 'expectedVersion': expectedVersion},
  );

  Future<Map<String, dynamic>> completeMebbisEntryAssistant(
    String profileId,
    int expectedWorkItemVersion,
  ) => _post(
    '/api/driving-school/mebbis/entry-assistant/students/$profileId/complete',
    {'expectedWorkItemVersion': expectedWorkItemVersion},
  );

  Future<Map<String, dynamic>> mebbisQuality(String profileId) =>
      _get('/api/driving-school/mebbis/quality/students/$profileId');

  Future<Map<String, dynamic>> documentReviewQueue({
    String status = 'ActionRequired',
    String documentType = '',
    String search = '',
  }) {
    final query = <String, String>{'status': status, 'pageSize': '100'};
    if (documentType.isNotEmpty) query['documentType'] = documentType;
    if (search.trim().isNotEmpty) query['search'] = search.trim();
    return _get(
      Uri(
        path: '/api/driving-school/student-documents/review-queue',
        queryParameters: query,
      ).toString(),
    );
  }

  Future<Map<String, dynamic>> reviewStudentDocument(
    String id,
    Map<String, dynamic> payload,
  ) => _post('/api/driving-school/student-documents/$id/review', payload);

  Future<Uint8List> downloadStudentDocument(String id) =>
      _downloadBytes('/api/driving-school/student-documents/$id/file');

  Future<Map<String, dynamic>> inspectMebbisPhoto(String profileId) => _post(
    '/api/driving-school/mebbis/photo-inspections/students/$profileId',
    const {},
  );

  Future<Uint8List> downloadMebbisPhoto(String inspectionId) => _downloadBytes(
    '/api/driving-school/mebbis/photo-inspections/$inspectionId/mebbis-file',
  );
  Future<List<Map<String, dynamic>>> packages() async => ((await _getList(
    '/api/driving-school/packages',
  )).cast<Map<String, dynamic>>());
  Future<List<Map<String, dynamic>>> vehicles() async => ((await _getList(
    '/api/driving-school/vehicles',
  )).cast<Map<String, dynamic>>());

  // Kursiyer kaydı (sihirbaz) — masaüstündeki /students/wizard ile aynı uç.
  Future<Map<String, dynamic>> registerDrivingStudent(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/students/wizard', body);

  // Peşinatı beklenen (tahsil edilmemiş) sözleşmeler — student-finance ucundan.
  Future<List<Map<String, dynamic>>> pendingDownPayments() async =>
      (await _getList('/api/student-finance/pending-down-payments'))
          .cast<Map<String, dynamic>>();

  // Bekleyen peşinatı makbuzlu tahsil eder ve sözleşmeyi "ödendi" işaretler.
  Future<Map<String, dynamic>> collectDownPayment(
    String contractId,
    String method,
  ) => _post(
    '/api/student-finance/contracts/$contractId/collect-down-payment',
    {'method': method},
  );
  Future<List<dynamic>> _getList(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('İstek başarısız (${response.statusCode}).');
    }
    return (jsonDecode(response.body) as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> createPackage(Map<String, dynamic> body) async {
    await _post('/api/driving-school/packages', body);
  }

  Future<void> createVehicle(Map<String, dynamic> body) async {
    await _post('/api/driving-school/vehicles', body);
  }

  Future<List<Map<String, dynamic>>> instructorAppointments() async =>
      (await _getList(
        '/api/driving-school/instructor/my-appointments',
      )).cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> studentOverview() =>
      _get('/api/driving-school/student/my-overview');
  Future<Map<String, dynamic>> startLesson(
    String appointmentId,
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/lessons/$appointmentId/start', body);
  Future<Map<String, dynamic>> completeLesson(
    String appointmentId,
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/lessons/$appointmentId/complete', body);

  Future<Map<String, dynamic>> educationOverview() =>
      _get('/api/driving-school/education/overview');
  Future<Map<String, dynamic>> createTheoryClass(Map<String, dynamic> body) =>
      _post('/api/driving-school/theory/classes', body);
  Future<Map<String, dynamic>> enrollTheoryStudents(
    String id,
    List<String> studentIds,
  ) => _post('/api/driving-school/theory/classes/$id/students', {
    'studentProfileIds': studentIds,
  });
  Future<Map<String, dynamic>> createTheorySession(Map<String, dynamic> body) =>
      _post('/api/driving-school/theory/sessions', body);
  Future<List<Map<String, dynamic>>> theoryAttendance(String id) async =>
      (await _getList(
        '/api/driving-school/theory/sessions/$id/attendance',
      )).cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> saveTheoryAttendance(
    String id,
    List<Map<String, dynamic>> items,
  ) => _put('/api/driving-school/theory/sessions/$id/attendance', {
    'items': items,
  });
  Future<Map<String, dynamic>> createExamSession(Map<String, dynamic> body) =>
      _post('/api/driving-school/exams/sessions', body);
  Future<Map<String, dynamic>> addExamCandidates(
    String id,
    List<String> studentIds,
    double feeAmount,
  ) => _post('/api/driving-school/exams/sessions/$id/candidates', {
    'studentProfileIds': studentIds,
    'feeAmount': feeAmount,
  });
  Future<Map<String, dynamic>> enterExamResult(
    String id,
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/exams/candidates/$id/result', body);
  Future<Map<String, dynamic>> scheduleExamRetry(
    String id,
    String examSessionId,
    double feeAmount,
  ) => _post('/api/driving-school/exams/candidates/$id/retry', {
    'examSessionId': examSessionId,
    'feeAmount': feeAmount,
  });

  Future<Map<String, dynamic>> graduationOverview() =>
      _get('/api/driving-school/graduation/overview');
  Future<Map<String, dynamic>> drivingSettings() =>
      _get('/api/driving-school/settings');
  Future<Map<String, dynamic>> updateDrivingSettings(
    Map<String, dynamic> body,
  ) => _put('/api/driving-school/settings', body);
  Future<Map<String, dynamic>> updateCertificateSettings(
    Map<String, dynamic> body,
  ) => _put('/api/driving-school/graduation/certificate-settings', body);
  Future<Map<String, dynamic>> certificateSettings() =>
      _get('/api/driving-school/graduation/certificate-settings');
  Future<Map<String, dynamic>> approveCertificateSettings() =>
      _post('/api/driving-school/graduation/certificate-settings/approve', {
        'confirmed': true,
        'note': 'Kurum yöneticisi mobil PDF önizlemesini kontrol etti.',
      });
  Future<Uint8List> certificatePreview() => _downloadBytes(
    '/api/driving-school/graduation/certificate-settings/preview',
  );
  Future<Map<String, dynamic>> graduationChecklist(String profileId) =>
      _get('/api/driving-school/graduation/students/$profileId/checklist');
  Future<Map<String, dynamic>> graduateStudent(String profileId, String note) =>
      _post('/api/driving-school/graduation/students/$profileId/graduate', {
        'note': note,
      });
  Future<Map<String, dynamic>> issueCertificate(
    String profileId,
    String type,
  ) => _post(
    '/api/driving-school/graduation/students/$profileId/certificates',
    {'type': type},
  );
  Future<Map<String, dynamic>> deliverCertificate(
    String id,
    String deliveredTo,
    String note,
  ) => _put('/api/driving-school/graduation/certificates/$id/delivery', {
    'status': 'Delivered',
    'deliveredTo': deliveredTo,
    'note': note,
  });
  Future<Uint8List> downloadCertificate(String id) => _downloadBytes(
    '/api/driving-school/graduation/certificates/$id/download',
  );

  Future<Uint8List> _downloadBytes(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...ScopeHeaders.merged,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('Belge indirilemedi (${response.statusCode}).');
    }
    return response.bodyBytes;
  }

  Future<Map<String, dynamic>> requestGraduationOverride(
    String profileId,
    String reason,
    List<String> keys,
  ) => _post(
    '/api/driving-school/graduation/students/$profileId/override-requests',
    {'reason': reason, 'checklistKeys': keys},
  );
  Future<Map<String, dynamic>> requestGraduationRevocation(
    String profileId,
    String reason,
  ) => _post(
    '/api/driving-school/graduation/students/$profileId/revocation-requests',
    {'reason': reason, 'checklistKeys': const []},
  );
  Future<Map<String, dynamic>> decideGraduationAction(
    String id,
    bool approve,
    String note,
  ) => _post(
    '/api/driving-school/graduation/action-requests/$id/${approve ? 'approve' : 'reject'}',
    {'note': note},
  );
  Future<Map<String, dynamic>> reissueCertificate(String id, String reason) =>
      _post('/api/driving-school/graduation/certificates/$id/reissue', {
        'reason': reason,
      });
  Future<Map<String, dynamic>> revokeCertificate(String id, String reason) =>
      _post('/api/driving-school/graduation/certificates/$id/revoke', {
        'reason': reason,
      });

  Future<Map<String, dynamic>> appointmentOptions({int duration = 60}) => _get(
    '/api/driving-school/student/appointment-options?durationMinutes=$duration',
  );
  Future<List<Map<String, dynamic>>> myAppointmentRequests() async =>
      (await _getList(
        '/api/driving-school/student/appointment-requests',
      )).cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> createAppointmentRequest(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/student/appointment-requests', body);
  Future<Map<String, dynamic>> cancelAppointmentRequest(String id) => _post(
    '/api/driving-school/student/appointment-requests/$id/cancel',
    const {},
  );
  Future<List<Map<String, dynamic>>> appointmentRequests() async =>
      (await _getList(
        '/api/driving-school/appointment-requests',
      )).cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> decideAppointmentRequest(
    String id,
    Map<String, dynamic> body,
  ) => _put('/api/driving-school/appointment-requests/$id/decision', body);
  Future<Map<String, dynamic>> mobilePlanningReference() =>
      _get('/api/driving-school/mobile/planning-reference');
  Future<List<Map<String, dynamic>>> drivingCalendar() async {
    final now = DateTime.now().toUtc();
    final to = now.add(const Duration(days: 45));
    return (await _getList(
      '/api/driving-school/calendar?from=${Uri.encodeComponent(now.toIso8601String())}&to=${Uri.encodeComponent(to.toIso8601String())}',
    )).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createDetailedAppointment(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/appointments', body);
  Future<Map<String, dynamic>> createStudentProfile(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/students', body);
  Future<Map<String, dynamic>> createInstructorProfile(
    Map<String, dynamic> body,
  ) => _post('/api/driving-school/instructors', body);

  Future<List<Map<String, dynamic>>> vehicleDocuments() async =>
      (await _getList(
        '/api/driving-school/vehicle-documents',
      )).cast<Map<String, dynamic>>();

  Future<List<Map<String, dynamic>>> vehicleServiceRecords() async =>
      (await _getList(
        '/api/driving-school/vehicle-service-records',
      )).cast<Map<String, dynamic>>();

  // Kursiyer listesi (Öğrenciler sayfası).
  Future<List<Map<String, dynamic>>> students() async => (await _getList(
    '/api/driving-school/students',
  )).cast<Map<String, dynamic>>();

  // Kursiyer grupları (dönemler): liste + kursiyer sayıları.
  Future<Map<String, dynamic>> studentGroups() =>
      _get('/api/driving-school/student-groups');

  Future<Map<String, dynamic>> createStudentGroup(
    String name, {
    String description = '',
    int? termYear,
    int? termNumber,
  }) => _post('/api/driving-school/student-groups', {
    'name': name,
    'description': description,
    // MTSK'da her ay resmî dönemdir; mobilde yıl/ay otomatik geçilir.
    'termYear': termYear,
    'termNumber': termNumber,
  });

  // profileIds → gruba atar; groupId null ise gruptan çıkarır.
  Future<Map<String, dynamic>> assignStudentGroup(
    List<String> profileIds,
    String? groupId,
  ) => _post('/api/driving-school/students/assign-group', {
    'profileIds': profileIds,
    'groupId': groupId,
  });

  // Sınav ücretleri + ödendi + direksiyon sınav tarihini günceller (kayıt sonrası da).
  Future<Map<String, dynamic>> updateExamFees(
    String profileId, {
    required num theoryExamFee,
    required num drivingExamFee,
    required bool theoryExamFeePaid,
    required bool drivingExamFeePaid,
    String? drivingExamDate,
  }) => _put('/api/driving-school/students/$profileId/exam-fees', {
    'theoryExamFee': theoryExamFee,
    'drivingExamFee': drivingExamFee,
    'theoryExamFeePaid': theoryExamFeePaid,
    'drivingExamFeePaid': drivingExamFeePaid,
    'drivingExamDate': drivingExamDate,
  });

  // Ödeme Al: kurumun şubeleri + tahsilat listesi + şube seçimli tahsilat.
  Future<List<Map<String, dynamic>>> branches() async => (await _getList(
    '/api/driving-school/branches',
  )).cast<Map<String, dynamic>>();

  Future<List<Map<String, dynamic>>> collectionList({
    String? bucket,
    String? groupId,
    bool? ungrouped,
  }) async {
    final q = <String, String>{};
    if (bucket != null) q['bucket'] = bucket;
    if (ungrouped == true) {
      q['ungrouped'] = 'true';
    } else if (groupId != null) {
      q['groupId'] = groupId;
    }
    final query = q.isEmpty
        ? ''
        : '?${q.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
    return (await _getList(
      '/api/driving-school/collection-list$query',
    )).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> installments(String profileId) async =>
      (await _getList(
        '/api/driving-school/students/$profileId/installments',
      )).cast<Map<String, dynamic>>();

  Future<Map<String, dynamic>> recordPayment(
    String profileId, {
    required num amount,
    required String method,
    String? branchId,
    String? financeInstallmentId,
    String? note,
  }) => _post('/api/driving-school/students/$profileId/payments', {
    'amount': amount,
    'method': method,
    'branchId': branchId,
    'financeInstallmentId': financeInstallmentId,
    'note': note,
  });

  // Kursiyer dosyası (belge modalı overview + documents alanlarını kullanır).
  Future<Map<String, dynamic>> studentDetail(String profileId) =>
      _get('/api/driving-school/students/$profileId/detail');
  Future<Map<String, dynamic>> mebbisHistory(String profileId) => _get(
    '/api/driving-school/mebbis/history/students/$profileId?pageSize=100',
  );

  // Öğretmen-araç atamaları (araç modalında "kime atanmış").
  Future<List<Map<String, dynamic>>>
  instructorVehicleAssignments() async => (await _getList(
    '/api/driving-school/instructor-vehicle-assignments?includeInactive=true',
  )).cast<Map<String, dynamic>>();

  Future<void> createVehicleDocument(Map<String, dynamic> body) async {
    await _post('/api/driving-school/vehicle-documents', body);
  }

  Future<void> createVehicleServiceRecord(Map<String, dynamic> body) async {
    await _post('/api/driving-school/vehicle-service-records', body);
  }

  Future<void> completeVehicleServiceRecord(
    String id,
    String resolution,
  ) async {
    await _post('/api/driving-school/vehicle-service-records/$id/complete', {
      'resolution': resolution,
    });
  }

  // ─── Randevu durum makinesi ─────────────────────────────────────────────────
  Future<Map<String, dynamic>> cancelAppointment(String id, String reason) =>
      _post('/api/driving-school/appointments/$id/cancel', {'reason': reason});

  Future<Map<String, dynamic>> markNoShow(String id, String note) =>
      _post('/api/driving-school/appointments/$id/no-show', {'note': note});

  Future<Map<String, dynamic>> checkInAppointment(String id) =>
      _post('/api/driving-school/appointments/$id/check-in', const {});

  /// Öğrencinin kendi ödeme planı: taksitler, makbuzlar, ücret kalemleri.
  Future<Map<String, dynamic>> myPayments() =>
      _get('/api/driving-school/student/my-payments');

  /// Öğrencinin kendi kurs dosyası (eksik/onay bekleyen/reddedilen belgeler dahil).
  Future<Map<String, dynamic>> myDocuments() =>
      _get('/api/driving-school/student/my-documents');

  Future<void> uploadMyDocument(Map<String, dynamic> body) async {
    await _post('/api/driving-school/student/my-documents', body);
  }

  Future<String> uploadVehicleDocument(
    PlatformFile file, {
    String folder = 'driving-vehicle-documents',
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw StateError('Oturum bulunamadı.');
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/api/uploads'),
    );
    request.headers.addAll({
      'Authorization': 'Bearer ${session.accessToken}',
      ...ScopeHeaders.merged,
    });
    request.fields['folder'] = folder;
    if (file.bytes != null) {
      request.files.add(
        http.MultipartFile.fromBytes('file', file.bytes!, filename: file.name),
      );
    } else if (file.path != null) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          file.path!,
          filename: file.name,
        ),
      );
    } else {
      throw StateError('Dosya içeriği okunamadı.');
    }
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('Dosya yüklenemedi (${response.statusCode}).');
    }
    final data = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    final url = data['fileUrl']?.toString();
    if (url == null || url.isEmpty) throw StateError('Dosya adresi alınamadı.');
    return url;
  }
}
