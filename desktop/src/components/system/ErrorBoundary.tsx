import React, { type ErrorInfo, type ReactNode } from "react";
import { isRecord } from "@/lib/errors";

interface BoundaryProps {
  children?: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  error: unknown;
}

/** Hata yığını, yoksa mesajı, yoksa değerin kendisi (düz nesne atılmış olabilir). */
function describeError(error: unknown): unknown {
  return isRecord(error) ? (error.stack || error.message || error) : error;
}

export class ErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Desktop runtime error:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            color: "#fff",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "720px",
              background: "rgba(15, 23, 42, 0.88)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            <h1 style={{ margin: 0, marginBottom: "12px", fontSize: "24px" }}>
              Masaustu uygulamasi baslatilirken bir hata olustu
            </h1>
            <p style={{ marginTop: 0, color: "#cbd5e1" }}>
              Beyaz ekran yerine hatayi burada gosteriyoruz ki hizli ilerleyelim.
            </p>
            <pre
              style={{
                margin: 0,
                marginTop: "16px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#020617",
                borderRadius: "12px",
                padding: "16px",
                color: "#f8fafc",
                border: "1px solid rgba(148, 163, 184, 0.15)",
              }}
            >
              {String(describeError(this.state.error) || "Bilinmeyen hata")}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
