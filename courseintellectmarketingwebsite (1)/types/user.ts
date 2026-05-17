// Kullanıcı tipleri - öğrenci, veli, öğretmen, muhasebeci

export type UserRole = "student" | "parent" | "teacher" | "accountant" | "administrative" | "admin" | "editor"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  phone?: string
  schoolId?: string
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
}

export interface LoginAttempt {
  id: string
  userId: string
  email: string
  role: UserRole
  timestamp: string
  success: boolean
  ipAddress?: string
  userAgent?: string
}

export interface UserRegistration {
  id: string
  userId: string
  email: string
  name: string
  role: UserRole
  registeredAt: string
  isVerified: boolean
}

export const roleLabels: Record<UserRole, { tr: string; en: string }> = {
  student: { tr: "Öğrenci", en: "Student" },
  parent: { tr: "Veli", en: "Parent" },
  teacher: { tr: "Öğretmen", en: "Teacher" },
  accountant: { tr: "Muhasebeci", en: "Accountant" },
  administrative: { tr: "Bilgi İşlem", en: "IT Staff" },
  admin: { tr: "Admin", en: "Admin" },
  editor: { tr: "Editör", en: "Editor" },
}

export const roleIcons: Record<UserRole, string> = {
  student: "GraduationCap",
  parent: "Users",
  teacher: "BookOpen",
  accountant: "Calculator",
  administrative: "Building2",
  admin: "Shield",
  editor: "Edit",
}

export const roleColors: Record<UserRole, string> = {
  student: "bg-blue-100 text-blue-700",
  parent: "bg-green-100 text-green-700",
  teacher: "bg-purple-100 text-purple-700",
  accountant: "bg-orange-100 text-orange-700",
  administrative: "bg-slate-100 text-slate-700",
  admin: "bg-red-100 text-red-700",
  editor: "bg-yellow-100 text-yellow-700",
}
