"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiRequest } from "@/lib/api-client"

interface User {
  id: string
  name: string
  email: string
  role: "admin" | "editor"
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
}

interface AuthResponse {
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

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  extraRoles: string[]
  activeRole: string | null
  switchRole: (role: string) => void
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = "courseintellect_auth"


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [extraRoles, setExtraRoles] = useState<string[]>([])
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const initialize = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          return
        }

        const parsed = JSON.parse(stored) as StoredAuth
        if (!parsed?.accessToken) {
          return
        }

        try {
          const apiUser = await apiRequest<AuthApiUser>("/api/auth/me", {
            token: parsed.accessToken,
          })
          const role = apiUser.primaryRole?.toLowerCase()
          if (role !== "admin" && role !== "editor") {
            throw new Error("Unauthorized role")
          }

          const mappedUser: User = {
            id: apiUser.id,
            name: apiUser.fullName,
            email: apiUser.username,
            role: role as "admin" | "editor",
          }
          setUser(mappedUser)
          localStorage.setItem(
            STORAGE_KEY,
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
          body: {
            refreshToken: parsed.refreshToken,
          },
        })

        const refreshRole = refreshed.user.primaryRole?.toLowerCase()
        if (refreshRole !== "admin" && refreshRole !== "editor") {
          throw new Error("Unauthorized role")
        }

        const refreshedUser: User = {
          id: refreshed.user.id,
          name: refreshed.user.fullName,
          email: refreshed.user.username,
          role: refreshRole as "admin" | "editor",
        }

        setUser(refreshedUser)
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            user: refreshedUser,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAtUtc,
          }),
        )
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initialize()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: {
          username: email,
          password,
        },
      })

      const role = response.user.primaryRole?.toLowerCase()
      if (role !== "admin" && role !== "editor") {
        return false
      }

      const mappedUser: User = {
        id: response.user.id,
        name: response.user.fullName,
        email: response.user.username,
        role: role as "admin" | "editor",
      }

      setUser(mappedUser)
      setExtraRoles(response.user.extraRoles ?? [])
      setActiveRole(role)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: mappedUser,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAtUtc,
        }),
      )

      return true
    } catch (error) {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredAuth
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
    setExtraRoles([])
    setActiveRole(null)
    localStorage.removeItem(STORAGE_KEY)
    router.push("/admin/login")
  }, [router])

  const switchRole = useCallback((role: string) => {
    setActiveRole(role.toLowerCase())
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        extraRoles,
        activeRole,
        switchRole,
        login,
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
