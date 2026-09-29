import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Sayfa-bazlı hata sınırı. Bir sayfa çalışma zamanında çökerse tüm uygulamayı
 * beyaz ekrana sürüklemek yerine içerik alanında hata kartı gösterir. Route
 * değişince (key=pathname) yeniden monte olup sıfırlanır.
 */
export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Page runtime error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 text-rose-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Bu sayfa yüklenirken bir hata oluştu</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Beyaz ekran yerine hatayı burada gösteriyoruz. Tekrar deneyebilir ya da başka bir sayfaya geçebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--brand-accent))] px-4 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            <RefreshCw className="h-4 w-4" /> Tekrar Dene
          </button>
          {this.state.error ? (
            <pre className="mt-1 max-w-lg overflow-auto rounded-lg bg-black/30 p-3 text-left text-[11px] text-rose-200/90">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export default PageErrorBoundary;
