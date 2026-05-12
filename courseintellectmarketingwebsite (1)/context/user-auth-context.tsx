"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { User, UserRole, LoginAttempt, UserRegistration } from "@/types/user"
import { apiRequest, ApiRequestError } from "@/lib/api-client"

interface UserAuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  loginAttempts: LoginAttempt[]
  registrations: UserRegistration[]
  login: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>
  logout: () => void
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    phone?: string,
  ) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean }>
  addLoginAttempt: (attempt: Omit<LoginAttempt, "id" | "timestamp">) => void
  addRegistration: (registration: Omit<UserRegistration, "id" | "registeredAt">) => void
}

interface AuthApiUser {
  id: string
  fullName: string
  username: string
  primaryRole: string
  extraRoles: string[]
  status: string
  campus: string
  departmentOrBranch: string
  tenantId?: string | null
  isPlatformAdmin?: boolean
}

interface AuthResponse {
  user: AuthApiUser
  accessToken: string
  refreshToken: string
  expiresAtUtc: string
  refreshTokenExpiresAtUtc: string
}

interface StoredUserAuth {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: string
}

const UserAuthContext = createContext<UserAuthContextValue | null>(null)

const USER_AUTH_KEY = "courseintellect_user_auth"
const LOGIN_ATTEMPTS_KEY = "courseintellect_login_attempts"
const REGISTRATIONS_KEY = "courseintellect_registrations"


export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([])
  const [registrations, setRegistrations] = useState<UserRegistration[]>([])
  const router = useRouter()

  useEffect(() => {
    const initialize = async () => {
      try {
        const storedAttempts = localStorage.getItem(LOGIN_ATTEMPTS_KEY)
        if (storedAttempts) {
          setLoginAttempts(JSON.parse(storedAttempts))
        }

        const storedRegistrations = localStorage.getItem(REGISTRATIONS_KEY)
        if (storedRegistrations) {
          setRegistrations(JSON.parse(storedRegistrations))
        }

        const storedUser = localStorage.getItem(USER_AUTH_KEY)
        if (!storedUser) {
          return
        }

        const parsed = JSON.parse(storedUser) as StoredUserAuth
        if (!parsed?.accessToken) {
          return
        }

        try {
          const apiUser = await apiRequest<AuthApiUser>("/api/auth/me", {
            token: parsed.accessToken,
          })

          const role = apiUser.primaryRole?.toLowerCase()
          if (!role || role === "developer" || role === "editor" || (role === "admin" && (apiUser.isPlatformAdmin === true || !apiUser.tenantId))) {
            throw new Error("Unauthorized role")
          }

          const mappedUser: User = {
            id: apiUser.id,
            email: apiUser.username,
            name: apiUser.fullName,
            role: role as UserRole,
            createdAt: parsed.user?.createdAt || new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: apiUser.status?.toLowerCase() === "active",
          }

          setUser(mappedUser)
          localStorage.setItem(
            USER_AUTH_KEY,
            JSON.stringify({
              ...parsed,
              user: mappedUser,
            }),
          )
          return
        } catch (error) {
          if (!parsed?.refreshToken) {
            throw error
          }
        }

        const refreshed = await apiRequest<AuthResponse>("/api/auth/refresh", {
          method: "POST",
          token: null,
          body: {
            refreshToken: parsed.refreshToken,
          },
        })

        const refreshRole = refreshed.user.primaryRole?.toLowerCase()
        if (!refreshRole || refreshRole === "developer" || refreshRole === "editor" || (refreshRole === "admin" && (refreshed.user.isPlatformAdmin === true || !refreshed.user.tenantId))) {
          throw new Error("Unauthorized role")
        }

        const refreshedUser: User = {
          id: refreshed.user.id,
          email: refreshed.user.username,
          name: refreshed.user.fullName,
          role: refreshRole as UserRole,
          createdAt: parsed.user?.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: refreshed.user.status?.toLowerCase() === "active",
        }

        setUser(refreshedUser)
        localStorage.setItem(
          USER_AUTH_KEY,
          JSON.stringify({
            user: refreshedUser,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAtUtc,
          }),
        )
      } catch (error) {
        localStorage.removeItem(USER_AUTH_KEY)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initialize()
  }, [])

  const addLoginAttempt = useCallback(
    (attempt: Omit<LoginAttempt, "id" | "timestamp">) => {
      const newAttempt: LoginAttempt = {
        ...attempt,
        id: `attempt-${Date.now()}`,
        timestamp: new Date().toISOString(),
      }
      const updatedAttempts = [newAttempt, ...loginAttempts].slice(0, 100) // Keep last 100
      setLoginAttempts(updatedAttempts)
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(updatedAttempts))
    },
    [loginAttempts],
  )

  const addRegistration = useCallback(
    (registration: Omit<UserRegistration, "id" | "registeredAt">) => {
      const newRegistration: UserRegistration = {
        ...registration,
        id: `reg-${Date.now()}`,
        registeredAt: new Date().toISOString(),
      }
      const updatedRegistrations = [newRegistration, ...registrations]
      setRegistrations(updatedRegistrations)
      localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(updatedRegistrations))
    },
    [registrations],
  )

  const login = useCallback(
    async (
      email: string,
      password: string,
      role: UserRole,
    ): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
      try {
        const response = await apiRequest<AuthResponse>("/api/auth/login", {
          method: "POST",
          token: null,
          body: {
            username: email.trim(),
            password,
          },
        })

        const normalizedRole = response.user.primaryRole?.toLowerCase()
        if (!normalizedRole ||
            normalizedRole === "developer" ||
            normalizedRole === "editor" ||
            (normalizedRole === "admin" && (response.user.isPlatformAdmin === true || !response.user.tenantId)) ||
            normalizedRole !== role.toLowerCase()) {
          return { success: false, error: "Unauthorized role" }
        }

        const userWithLogin: User = {
          id: response.user.id,
          email: response.user.username,
          name: response.user.fullName,
          role: normalizedRole as UserRole,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: response.user.status?.toLowerCase() === "active",
        }

        setUser(userWithLogin)
        localStorage.setItem(
          USER_AUTH_KEY,
          JSON.stringify({
            user: userWithLogin,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: response.expiresAtUtc,
          }),
        )

        return { success: true }
      } catch (error) {
        if (error instanceof ApiRequestError) {
          if (error.code === "MAINTENANCE_MODE" || error.status === 503) {
            return {
              success: false,
              errorCode: "MAINTENANCE_MODE",
              error: error.message || "Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.",
            }
          }
          if (error.code === "AUTH_APPROVAL_PENDING") {
            return {
              success: false,
              errorCode: error.code,
              error: "Site sahibi onayı bekleniyor.",
            }
          }
          if (error.code === "AUTH_USER_NOT_FOUND") {
            return {
              success: false,
              errorCode: error.code,
              error: "Böyle bir hesap bulunamadı. Lütfen kayıt olunuz.",
            }
          }
          if (error.code === "AUTH_ACCOUNT_DISABLED") {
            return {
              success: false,
              errorCode: error.code,
              error: "Hesabınız pasif durumda.",
            }
          }
        }

        const message = error instanceof Error ? error.message : "Login failed"
        return { success: false, error: message }
      }
    },
    [],
  )

  const register = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      role: UserRole,
      phone?: string,
    ): Promise<{ success: boolean; error?: string; pendingApproval?: boolean }> => {
      try {
        await apiRequest<AuthResponse>("/api/auth/register", {
          method: "POST",
          token: null,
          body: {
            fullName: name,
            username: email,
            password,
            role,
            campus: "",
          },
        })
      } catch (error) {
        if (error instanceof ApiRequestError) {
          return { success: false, error: error.message }
        }
        const message = error instanceof Error ? error.message : "Registration failed"
        return { success: false, error: message }
      }

      return { success: true, pendingApproval: true }
    },
    [],
  )

  const logout = useCallback(() => {
    const stored = localStorage.getItem(USER_AUTH_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredUserAuth
        if (parsed?.refreshToken) {
          void apiRequest("/api/auth/logout", {
            method: "POST",
            body: {
              refreshToken: parsed.refreshToken,
            },
            token: parsed.accessToken,
          })
        }
      } catch (error) {
        console.error("Logout failed:", error)
      }
    }

    setUser(null)
    localStorage.removeItem(USER_AUTH_KEY)
    router.push("/giris")
  }, [router])

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginAttempts,
        registrations,
        login,
        logout,
        register,
        addLoginAttempt,
        addRegistration,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  )
}

export function useUserAuth() {
  const context = useContext(UserAuthContext)
  if (!context) {
    throw new Error("useUserAuth must be used within a UserAuthProvider")
  }
  return context
}
