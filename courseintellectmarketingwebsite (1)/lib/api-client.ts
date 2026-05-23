"use client"

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: ApiError
}

export class ApiRequestError extends Error {
  code?: string
  details?: unknown
  status?: number
}

export type ApiRequestOptions = {
  method?: string
  body?: unknown
  token?: string | null
  language?: string | null
  query?: Record<string, string | number | boolean | null | undefined>
  headers?: Record<string, string>
}

// İki ayrı auth context var: admin paneli ve kurum kullanıcı.
// Token hangi context oturum açtıysa orada — sırayla bak.
const AUTH_STORAGE_KEYS = ["courseintellect_user_auth", "courseintellect_auth"] as const

const DEFAULT_API_URL =
  typeof window !== "undefined"
    ? "https://api.courseintellect.com"
    : "https://api.courseintellect.com"

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, "")

function buildUrl(path: string, query?: ApiRequestOptions["query"]) {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, API_BASE_URL)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  for (const key of AUTH_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { accessToken?: string | null }
      const storedToken = parsed?.accessToken
      if (storedToken && storedToken !== "demo-token") {
        return storedToken
      }
    } catch {
      // try next key
    }
  }
  return null
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, language, query, headers } = options
  const hasExplicitToken = Object.prototype.hasOwnProperty.call(options, "token")
  const effectiveToken = hasExplicitToken ? token : readStoredAccessToken()

  const requestHeaders: Record<string, string> = {
    ...(headers || {}),
  }

  if (language) {
    requestHeaders["Accept-Language"] = language
  }

  if (effectiveToken && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${effectiveToken}`
  }

  const isJsonBody = body !== undefined && !(body instanceof FormData)
  if (isJsonBody) {
    requestHeaders["Content-Type"] = "application/json"
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | null | undefined),
    })
  } catch (cause) {
    const error = new ApiRequestError("Canlı sunucuya bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.")
    error.code = "NETWORK_ERROR"
    error.details = cause
    throw error
  }

  const contentType = response.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")

  if (!response.ok) {
    const errorPayload = isJson ? await response.json() : null
    const error = new ApiRequestError(
      errorPayload?.message || errorPayload?.error?.message || "Request failed."
    )
    error.code = errorPayload?.code || errorPayload?.error?.code
    error.details = errorPayload?.details || errorPayload?.error?.details
    error.status = response.status
    throw error
  }

  if (response.status === 204) return undefined as T
  if (!isJson) return undefined as T

  const payload = await response.json()

  // Support both wrapped { success, data } and raw response formats
  if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
    return payload.data as T
  }

  return payload as T
}
