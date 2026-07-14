export const DRIVING_EVALUATION_CATEGORIES = [
  { key: 'trafficRules', label: 'Trafik kuralları', scoreKey: 'trafficRulesScore', color: '#2563eb' },
  { key: 'vehicleControl', label: 'Araç hâkimiyeti', scoreKey: 'vehicleControlScore', color: '#0d9488' },
  { key: 'maneuvers', label: 'Manevralar', scoreKey: 'maneuversScore', color: '#7c3aed' },
  { key: 'safety', label: 'Güvenli sürüş', scoreKey: 'safetyScore', color: '#ea580c' },
];

export const DRIVING_EVALUATION_CRITERIA = [
  ['trafficObservation', 'trafficRules', 'Trafik akışını gözlemleme'],
  ['signsAndSignals', 'trafficRules', 'İşaret ve ışıklara uyum'],
  ['laneDiscipline', 'trafficRules', 'Şerit disiplini'],
  ['speedManagement', 'trafficRules', 'Hız yönetimi'],
  ['rightOfWay', 'trafficRules', 'Geçiş hakkı kuralları'],
  ['followingDistance', 'trafficRules', 'Takip mesafesi'],
  ['seatingAndMirrors', 'vehicleControl', 'Koltuk ve ayna ayarı'],
  ['steeringControl', 'vehicleControl', 'Direksiyon hâkimiyeti'],
  ['pedalControl', 'vehicleControl', 'Gaz ve fren kontrolü'],
  ['gearSelection', 'vehicleControl', 'Doğru vites seçimi'],
  ['clutchControl', 'vehicleControl', 'Debriyaj kavrama kontrolü', true],
  ['clutchHillStart', 'vehicleControl', 'Debriyajla yokuş kalkışı', true],
  ['smoothStartStop', 'maneuvers', 'Yumuşak kalkış ve duruş'],
  ['parking', 'maneuvers', 'Park etme'],
  ['reversing', 'maneuvers', 'Geri sürüş'],
  ['turning', 'maneuvers', 'Dönüş ve U dönüşü'],
  ['hillStart', 'maneuvers', 'Yokuşta kalkış'],
  ['laneChange', 'maneuvers', 'Şerit değiştirme'],
  ['seatbeltAndChecks', 'safety', 'Emniyet kemeri ve son kontroller'],
  ['signaling', 'safety', 'Zamanında sinyal kullanımı'],
  ['blindSpot', 'safety', 'Kör nokta kontrolü'],
  ['pedestrianAwareness', 'safety', 'Yaya ve bisikletli farkındalığı'],
  ['hazardAnticipation', 'safety', 'Tehlikeyi önceden sezme'],
  ['calmDecisionMaking', 'safety', 'Sakin ve güvenli karar verme'],
].map(([key, category, label, manualOnly = false]) => ({ key, category, label, manualOnly }));

export function evaluationScores(lesson) {
  const raw = lesson?.evaluationScoresJson;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export function lessonAverage(lesson) {
  const values = DRIVING_EVALUATION_CATEGORIES
    .map((category) => lesson?.[category.scoreKey])
    .filter((value) => value != null)
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadDrivingEvaluationCsv(filename, lessons) {
  const headers = [
    'Tarih', 'Öğrenci', 'Öğretmen', 'Araç', 'Süre (dk)', 'Genel Ortalama',
    ...DRIVING_EVALUATION_CATEGORIES.map((item) => item.label),
    ...DRIVING_EVALUATION_CRITERIA.map((item) => item.label),
    'Öğretmen Notu',
  ];
  const rows = lessons.map((lesson) => {
    const details = evaluationScores(lesson);
    return [
      lesson.startedAtUtc ? new Date(lesson.startedAtUtc).toLocaleString('tr-TR') : '',
      lesson.studentName, lesson.instructorName, lesson.vehiclePlate, lesson.chargedMinutes,
      lessonAverage(lesson)?.toFixed(2),
      ...DRIVING_EVALUATION_CATEGORIES.map((item) => lesson[item.scoreKey]),
      ...DRIVING_EVALUATION_CRITERIA.map((item) => details[item.key]),
      lesson.instructorNote,
    ];
  });
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
