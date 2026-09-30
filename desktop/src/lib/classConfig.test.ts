import { parseClassConfig, parseClassConfigs } from './classConfig';

// Canlı sunucunun yazdığı biçim (ClassesController, seçeneksiz JsonSerializer):
// üst düzey camelCase, iç içe kayıtlar PascalCase.
const serverPayload = JSON.stringify({
  name: '9-Z',
  code: 'TSPROBE',
  advisorTeacherId: 'teacher-1',
  themeColor: '#2563EB',
  modules: { Attendance: true },
  teachers: [{ TeacherId: 'teacher-1', Role: 'Danışman' }],
  courses: [{ CourseName: 'Matematik', TeacherId: 'teacher-1', WeeklyHours: 4, IsRequired: true }],
  studentIds: ['student-1'],
});

describe('parseClassConfig', () => {
  it('reads PascalCase nested records written by the server', () => {
    const config = parseClassConfig({ payloadJson: serverPayload });
    expect(config?.name).toBe('9-Z');
    expect(config?.advisorTeacherId).toBe('teacher-1');
    expect(config?.teachers).toEqual([{ teacherId: 'teacher-1', role: 'Danışman' }]);
    expect(config?.courses).toEqual([
      { courseName: 'Matematik', teacherId: 'teacher-1', weeklyHours: 4, isRequired: true },
    ]);
    expect(config?.studentIds).toEqual(['student-1']);
  });

  it('still reads legacy camelCase records and bare teacher ids', () => {
    const config = parseClassConfig({
      payloadJson: JSON.stringify({
        name: '10-A',
        teachers: ['teacher-2'],
        courses: [{ courseName: 'Fizik', teacherId: 'teacher-2', weeklyHours: '3', isRequired: false }],
      }),
    });
    expect(config?.teachers).toEqual([{ teacherId: 'teacher-2', role: '' }]);
    expect(config?.courses).toEqual([
      { courseName: 'Fizik', teacherId: 'teacher-2', weeklyHours: 3, isRequired: false },
    ]);
  });

  it('skips broken payloads instead of throwing', () => {
    expect(parseClassConfig({ payloadJson: '{bozuk' })).toBeNull();
    expect(parseClassConfig({ payloadJson: '[1,2]' })).toBeNull();
    expect(parseClassConfigs([{ payloadJson: '{bozuk' }, { payloadJson: serverPayload }])).toHaveLength(1);
    expect(parseClassConfigs(null)).toEqual([]);
  });
});
