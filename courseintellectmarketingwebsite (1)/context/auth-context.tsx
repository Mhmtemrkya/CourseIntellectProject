"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiRequest, ApiRequestError } from "@/lib/api-client"

interface User {
  id: string
  name: string
  email: string
  role: "developer" | "admin" | "editor"
  avatar?: string
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

export interface AuthResponse {
  user: AuthApiUser
  accessToken: string
  refreshToken: string
  expiresAtUtc: string
  refreshTokenExpiresAtUtc: string
}

interface StoredAuth {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface AdminChallenge {
  challengeToken: string
  expiresAtUtc: string
  emailHint: string
}
interface LoginResult {
  success: boolean
  error?: string
  challenge?: AdminChallenge
}
interface VerifyResult {
  session?: AuthResponse
  error?: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  extraRoles: string[]
  activeRole: string | null
  switchRole: (role: string) => void
  login: (email: string, password: string) => Promise<LoginResult>
  verifyLogin: (challengeToken: string, code: string) => Promise<VerifyResult>
  finishLogin: (session: AuthResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = "courseintellect_auth"

function clearStoredAuth() {
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem("schoolasist_admin_activity")
}

function readStoredAuth(): { auth: StoredAuth; storage: Storage } | null {
  // Admin sessions never persist in localStorage. Old password-only sessions are discarded.
  window.localStorage.removeItem(STORAGE_KEY)
  const lastActivity = Number(window.sessionStorage.getItem("schoolasist_admin_activity") || 0)
  if (!lastActivity || Date.now() - lastActivity > 15 * 60 * 1000) {
    clearStoredAuth()
    return null
  }
  for (const storage of [window.sessionStorage]) {
    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) continue

    try {
      return { auth: JSON.parse(stored) as StoredAuth, storage }
    } catch {
      storage.removeItem(STORAGE_KEY)
    }
  }

  return null
}

function saveStoredAuth(auth: StoredAuth, storage: Storage) {
  clearStoredAuth()
  storage.setItem(STORAGE_KEY, JSON.stringify(auth))
  window.sessionStorage.setItem("schoolasist_admin_activity", String(Date.now()))
}

function isDeveloperPanelUser(apiUser: AuthApiUser) {
  const role = apiUser.primaryRole?.toLowerCase()
  return role === "developer" && apiUser.isPlatformAdmin === true
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [extraRoles, setExtraRoles] = useState<string[]>([])
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const initialize = async () => {
      try {
        const storedAuth = readStoredAuth()
        if (!storedAuth) {
          return
        }

        const { auth: parsed, storage } = storedAuth
        if (!parsed?.accessToken) {
          storage.removeItem(STORAGE_KEY)
          return
        }

        // Eski demo oturumları platform admin panelinde geçerli sayılmaz.
        if (parsed.accessToken === "demo-token") {
          clearStoredAuth()
          return
        }

        try {
          const apiUser = await apiRequest<AuthApiUser>("/api/auth/me", {
            token: parsed.accessToken,
          })
          const role = apiUser.primaryRole?.toLowerCase()
          if (!isDeveloperPanelUser(apiUser)) {
            throw new Error("Unauthorized role")
          }

          const mappedUser: User = {
            id: apiUser.id,
            name: apiUser.fullName,
            email: apiUser.username,
            role: role as "developer",
          }
          setUser(mappedUser)
          setAccessToken(parsed.accessToken)
          setExtraRoles(apiUser.extraRoles ?? [])
          setActiveRole(role)
          saveStoredAuth(
            {
              ...parsed,
              user: mappedUser,
            },
            storage,
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
        if (!isDeveloperPanelUser(refreshed.user)) {
          throw new Error("Unauthorized role")
        }

        const refreshedUser: User = {
          id: refreshed.user.id,
          name: refreshed.user.fullName,
          email: refreshed.user.username,
          role: refreshRole as "developer",
        }

        setUser(refreshedUser)
        setAccessToken(refreshed.accessToken)
        setExtraRoles(refreshed.user.extraRoles ?? [])
        setActiveRole(refreshRole)
        saveStoredAuth(
          {
            user: refreshedUser,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAtUtc,
          },
          storage,
        )
      } catch {
        clearStoredAuth()
        setUser(null)
        setAccessToken(null)
        setExtraRoles([])
        setActiveRole(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initialize()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const challenge = await apiRequest<AdminChallenge>("/api/admin-auth/start", {
        method: "POST", token: null, body: { username: email.trim(), password },
      })
      return { success: false, challenge }
    } catch (error) {
      return { success: false, error: error instanceof ApiRequestError ? error.message : "Giriş tamamlanamadı." }
    }
  }, [])

  const verifyLogin = useCallback(async (challengeToken: string, code: string): Promise<VerifyResult> => {
    try {
      return await apiRequest<VerifyResult>("/api/admin-auth/verify", {
        method: "POST", token: null, body: { challengeToken, code },
      })
    } catch (error) {
      return { error: error instanceof ApiRequestError ? error.message : "Doğrulama tamamlanamadı." }
    }
  }, [])

  const finishLogin = useCallback((response: AuthResponse) => {
    if (!isDeveloperPanelUser(response.user)) throw new Error("Bu hesabın yönetim erişimi yok.")
    const role = response.user.primaryRole.toLowerCase()
    const mappedUser: User = { id: response.user.id, name: response.user.fullName, email: response.user.username, role: "developer" }
    setUser(mappedUser)
    setAccessToken(response.accessToken)
    setExtraRoles(response.user.extraRoles ?? [])
    setActiveRole(role)
    saveStoredAuth({ user: mappedUser, accessToken: response.accessToken, refreshToken: response.refreshToken, expiresAt: response.expiresAtUtc }, window.sessionStorage)
  }, [])

  const logout = useCallback(() => {
    const storedAuth = readStoredAuth()
    if (storedAuth) {
      try {
        const parsed = storedAuth.auth
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
    setAccessToken(null)
    setExtraRoles([])
    setActiveRole(null)
    clearStoredAuth()
    router.push("/admin/login")
  }, [router])

  useEffect(() => {
    if (!user) return
    let lastSaved = 0
    const activity = () => {
      if (Date.now() - lastSaved < 30_000) return
      lastSaved = Date.now()
      window.sessionStorage.setItem("schoolasist_admin_activity", String(lastSaved))
    }
    const check = () => {
      const last = Number(window.sessionStorage.getItem("schoolasist_admin_activity") || 0)
      if (Date.now() - last >= 15 * 60 * 1000) logout()
    }
    const events = ["pointerdown", "keydown", "touchstart"] as const
    events.forEach(event => window.addEventListener(event, activity, { passive: true }))
    window.addEventListener("focus", check)
    const interval = window.setInterval(check, 15_000)
    return () => {
      events.forEach(event => window.removeEventListener(event, activity))
      window.removeEventListener("focus", check)
      window.clearInterval(interval)
    }
  }, [user, logout])

  useEffect(() => {
    if (!user) return
    let refreshing = false
    let disposed = false
    const refreshIfNeeded = async () => {
      if (refreshing) return
      const stored = readStoredAuth()
      if (!stored || Date.parse(stored.auth.expiresAt) - Date.now() > 60_000) return
      const lastActivity = window.sessionStorage.getItem("schoolasist_admin_activity")
      refreshing = true
      try {
        const response = await apiRequest<AuthResponse>("/api/auth/refresh", {
          method: "POST", token: null, body: { refreshToken: stored.auth.refreshToken },
        })
        if (disposed) return
        finishLogin(response)
        // Background rotation is not user activity and must not extend idle timeout.
        if (lastActivity) window.sessionStorage.setItem("schoolasist_admin_activity", lastActivity)
      } catch {
        if (!disposed) logout()
      } finally { refreshing = false }
    }
    const interval = window.setInterval(() => { void refreshIfNeeded() }, 30_000)
    const focus = () => { void refreshIfNeeded() }
    window.addEventListener("focus", focus)
    return () => { disposed = true; window.clearInterval(interval); window.removeEventListener("focus", focus) }
  }, [user, finishLogin, logout])

  const switchRole = useCallback((role: string) => {
    setActiveRole(role.toLowerCase())
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        accessToken,
        extraRoles,
        activeRole,
        switchRole,
        login,
        verifyLogin,
        finishLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
