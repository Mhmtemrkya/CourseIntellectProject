/**
 * Oturum tipleri — backend `CurrentUserDto` / `LoginResponse` sözleşmesinin
 * istemci karşılığı. Eski API sürümlerinin taşıdığı alanlar (name, email,
 * role) geriye uyum için opsiyonel tutulur.
 */

/**
 * `superadmin` platform yöneticisi bayrağından türetilir (lib/permissions);
 * istemci tarafında rol değiştirme yoktur — rol yalnız sunucudan gelir.
 */
export type DesktopRole =
  | 'superadmin'
  | 'admin'
  | 'finance'
  | 'teacher'
  | 'counselor'
  | 'student'
  | 'parent'
  | 'administrative'
  | 'cafeteria';

export type InstitutionType = 'School' | 'DrivingSchool' | (string & {});

/** Backend `CurrentUserDto` (camelCase). */
export interface BackendCurrentUser {
  id?: string;
  fullName?: string;
  username?: string;
  primaryRole?: string;
  extraRoles?: string[];
  status?: string;
  campus?: string;
  departmentOrBranch?: string;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantSlug?: string | null;
  institutionType?: InstitutionType | null;
  drivingSchoolModuleEnabled?: boolean;
  isPlatformAdmin?: boolean;
  subscriptionRequired?: boolean;
  mustChangePassword?: boolean;
  modules?: string[];
  permissions?: string[];
  hasRoleManagementPolicy?: boolean;
  // Eski sürüm alanları
  name?: string;
  email?: string;
  role?: string;
}

/** Backend `LoginResponse`. */
export interface LoginPayload {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: BackendCurrentUser;
}

export interface DesktopUser {
  id: string;
  name: string;
  email: string;
  role: DesktopRole;
  backendRole: string;
  isPlatformAdmin: boolean;
  username: string;
  tenantId: string | null;
  tenantSlug: string;
  tenant: string;
  institutionType: InstitutionType | null;
  branch: string;
  department: string;
  extraRoles: string[];
  modules: string[];
  permissions: string[];
  hasRoleManagementPolicy: boolean;
  homePath: string;
  mustChangePassword: boolean;
  subscriptionRequired: boolean;
}

export interface DesktopSession {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
  user: DesktopUser;
}

/** Yardımcıların kabul ettiği kısmi kullanıcı (oturum, form taslağı vb.). */
export type UserLike = Partial<DesktopUser> & { fullName?: string };
