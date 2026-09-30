import { isRecord } from './errors';
import type { PlatformConfigurationDto } from '../types/api/generated';

/**
 * `class-management` platform yapılandırmasının (ClassesController) istemci
 * karşılığı.
 *
 * Sunucu yükü seçeneksiz `JsonSerializer.Serialize` ile yazar: üst düzey alanlar
 * anonim nesneden geldiği için camelCase, iç içe kayıtlar (teachers, courses,
 * modules) ise PascalCase (`CourseName`, `TeacherId`, `WeeklyHours`) kaydedilir.
 * Eski kayıtlar camelCase de olabilir; çözümleyici iki biçimi de okur.
 */
export interface ClassConfigTeacher {
  teacherId: string;
  role: string;
}

export interface ClassConfigCourse {
  courseName: string;
  teacherId: string;
  weeklyHours: number;
  isRequired: boolean;
}

export interface ClassConfig {
  name: string;
  code: string;
  institutionUnit: string;
  grade: string;
  section: string;
  academicYear: string;
  advisorTeacherId: string;
  description: string;
  themeColor: string;
  icon: string;
  teachers: ClassConfigTeacher[];
  courses: ClassConfigCourse[];
  studentIds: string[];
}

/** İlk dolu alanı metin olarak döndürür (camelCase / PascalCase / eski adlar). */
function readText(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = Number(source[key]);
    if (source[key] != null && Number.isFinite(value)) return value;
  }
  return 0;
}

function readList(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function parseTeacher(item: unknown): ClassConfigTeacher | null {
  if (typeof item === 'string') return item ? { teacherId: item, role: '' } : null;
  if (!isRecord(item)) return null;
  const teacherId = readText(item, 'teacherId', 'TeacherId');
  return teacherId ? { teacherId, role: readText(item, 'role', 'Role') } : null;
}

function parseCourse(item: unknown): ClassConfigCourse | null {
  if (typeof item === 'string') return item ? { courseName: item, teacherId: '', weeklyHours: 0, isRequired: true } : null;
  if (!isRecord(item)) return null;
  const required = item.isRequired ?? item.IsRequired;
  return {
    courseName: readText(item, 'courseName', 'CourseName', 'name', 'title'),
    teacherId: readText(item, 'teacherId', 'TeacherId'),
    weeklyHours: readNumber(item, 'weeklyHours', 'WeeklyHours'),
    isRequired: required !== false,
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

/** Tek yapılandırma kaydını çözer; bozuk JSON'da null döner. */
export function parseClassConfig(item: Pick<PlatformConfigurationDto, 'payloadJson'> | null | undefined): ClassConfig | null {
  let payload: unknown;
  try {
    payload = JSON.parse(item?.payloadJson || '{}');
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;
  return {
    name: readText(payload, 'name', 'Name'),
    code: readText(payload, 'code', 'Code'),
    institutionUnit: readText(payload, 'institutionUnit', 'InstitutionUnit'),
    grade: readText(payload, 'grade', 'Grade'),
    section: readText(payload, 'section', 'Section'),
    academicYear: readText(payload, 'academicYear', 'AcademicYear'),
    advisorTeacherId: readText(payload, 'advisorTeacherId', 'AdvisorTeacherId'),
    description: readText(payload, 'description', 'Description'),
    themeColor: readText(payload, 'themeColor', 'ThemeColor'),
    icon: readText(payload, 'icon', 'Icon'),
    teachers: readList(payload, 'teachers').map(parseTeacher).filter(isPresent),
    courses: readList(payload, 'courses').map(parseCourse).filter(isPresent),
    studentIds: readList(payload, 'studentIds').filter((value): value is string => typeof value === 'string'),
  };
}

/** Yapılandırma listesini çözer; çözülemeyen kayıtlar atlanır. */
export function parseClassConfigs(items: ReadonlyArray<Pick<PlatformConfigurationDto, 'payloadJson'>> | null | undefined): ClassConfig[] {
  return (items || []).map(parseClassConfig).filter(isPresent);
}
