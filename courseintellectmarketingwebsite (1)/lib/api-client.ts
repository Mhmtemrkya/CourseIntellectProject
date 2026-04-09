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

const DEFAULT_API_URL =
  typeof window !== "undefined"
    ? window.location.hostname === "localhost" && (window.location.port === "3000" || window.location.port === "3001")
      ? "http://localhost:5199"
      : window.location.origin
    : "http://localhost:5199"

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

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, language, query, headers } = options

  const requestHeaders: Record<string, string> = {
    ...(headers || {}),
  }

  if (language) {
    requestHeaders["Accept-Language"] = language
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`
  }

  const isJsonBody = body !== undefined && !(body instanceof FormData)
  if (isJsonBody) {
    requestHeaders["Content-Type"] = "application/json"
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: requestHeaders,
    body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | null | undefined),
  })

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
