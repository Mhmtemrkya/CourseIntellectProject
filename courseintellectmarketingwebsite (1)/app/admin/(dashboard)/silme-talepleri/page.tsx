"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api-client"

interface Impact {
  userCount: number
  studentCount: number
  fileCount: number
  financeRecordCount: number
  educationRecordCount: number
}
interface InstitutionRequest {
  id: string
  tenantId: string
  tenantName: string
  status: string
  requestedAtUtc: string
  finalizeAtUtc: string | null
  impact: Impact
}
interface AccountRequest {
  id: string
  userDisplayName: string
  requesterRole: string
  status: string
  remainingDays: number
}

export default function SilmeTalepleriPage() {
  const [institutions, setInstitutions] = useState<InstitutionRequest[]>([])
  const [accounts, setAccounts] = useState<AccountRequest[]>([])
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [inst, acc] = await Promise.all([
        apiRequest<InstitutionRequest[]>("/api/platformops/institution-deletions"),
        apiRequest<AccountRequest[]>("/api/platformops/account-deletions"),
      ])
      setInstitutions(Array.isArray(inst) ? inst : [])
      setAccounts(Array.isArray(acc) ? acc : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talepler alınamadı.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const decide = async (id: string, approve: boolean) => {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/platformops/institution-deletions/${id}/decide`, {
        method: "POST",
        body: { approve, rejectReason: approve ? null : rejectReasons[id] ?? null },
      })
      setNotice(approve ? "Talep onaylandı ve zamanlandı." : "Talep reddedildi.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Silme talepleri</h1>
        <p style={{ color: "#64748b", marginTop: 4 }}>
          Kurum silme onayları ve kurum yöneticisi hesap silme talepleri.
        </p>
      </header>

      {error && <div role="alert" style={{ color: "#b91c1c" }}>{error}</div>}
      {notice && <div style={{ color: "#15803d" }}>{notice}</div>}
      {loading && <div>Yükleniyor…</div>}

      {!loading && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Kurum silme (onay gerekli)</h2>
          {institutions.length === 0 && <p style={{ color: "#64748b" }}>Bekleyen kurum silme talebi yok.</p>}
          {institutions.map((item) => (
            <article key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{item.tenantName || item.tenantId}</strong>
                <span style={{ fontSize: 13, color: "#64748b" }}>{item.status}</span>
              </div>
              <ul style={{ display: "flex", gap: 16, listStyle: "none", padding: 0, margin: "12px 0", flexWrap: "wrap", fontSize: 14 }}>
                <li>Kullanıcı: <b>{item.impact.userCount}</b></li>
                <li>Öğrenci: <b>{item.impact.studentCount}</b></li>
                <li>Dosya: <b>{item.impact.fileCount}</b></li>
                <li>Finans: <b>{item.impact.financeRecordCount}</b></li>
                <li>Eğitim: <b>{item.impact.educationRecordCount}</b></li>
              </ul>
              {item.status === "PendingPlatformApproval" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    placeholder="Red gerekçesi"
                    value={rejectReasons[item.id] ?? ""}
                    onChange={(e) => setRejectReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 200, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  />
                  <button disabled={busy || !(rejectReasons[item.id] ?? "").trim()} onClick={() => decide(item.id, false)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
                    Reddet
                  </button>
                  <button disabled={busy} onClick={() => decide(item.id, true)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff" }}>
                    Onayla (zamanla)
                  </button>
                </div>
              )}
            </article>
          ))}

          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>Kurum yöneticisi hesap silme (görüntüleme)</h2>
          {accounts.length === 0 && <p style={{ color: "#64748b" }}>Bekleyen talep yok.</p>}
          {accounts.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span>{item.userDisplayName} · {item.requesterRole}</span>
              <span style={{ color: "#64748b" }}>{item.remainingDays} gün · {item.status}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
