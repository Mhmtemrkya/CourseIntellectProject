import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

/**
 * Dokunmatik imza alanı.
 *
 * Neden bu şekilde:
 *  • Pointer Events kullanılır — fare, parmak ve kalem tek API ile gelir; ayrı
 *    touch/mouse dinleyicileri tutulursa tablette çift olay üretip çizgi kırılır.
 *  • Çizim yüzeyi devicePixelRatio ile ölçeklenir, yoksa retina tablette imza
 *    bulanık çıkar. Ölçek 3 ile sınırlanır (yüksek DPR'de bellek boşa gitmesin).
 *  • Dışa aktarırken BEYAZ ZEMİN basılır: şeffaf PNG bazı PDF görüntüleyicilerde
 *    siyah kutu olarak görünür.
 *  • Tek dokunuş da nokta bırakır (çok kısa imzalar kaybolmasın).
 *  • Yeniden boyutlanmada mevcut çizim korunur.
 */
export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  /** Beyaz zeminli PNG data URL; imza yoksa null. */
  toDataUrl: () => string | null;
}

export interface SignaturePadProps {
  height?: number;
  disabled?: boolean;
  onChange?: (hasInk: boolean) => void;
  className?: string;
  hint?: string;
}

interface Point {
  x: number;
  y: number;
}

type CanvasPointerEvent = ReactPointerEvent<HTMLCanvasElement>;

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { height = 200, disabled = false, onChange, className, hint = 'Parmağınızla buraya imzalayın' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const configureContext = useCallback((context: CanvasRenderingContext2D, ratio: number) => {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.4;
    context.strokeStyle = '#101828';
    context.fillStyle = '#101828';
  }, []);

  // Yüzeyi CSS boyutuna göre yeniden ölçekler. Mevcut çizim önce kopyalanır,
  // ölçek değişince geri basılır — pencere yeniden boyutlanınca imza silinmesin.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const nextWidth = Math.round(rect.width * ratio);
    const nextHeight = Math.round(rect.height * ratio);
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;

    const previous = canvas.width > 0 && canvas.height > 0 ? document.createElement('canvas') : null;
    if (previous) {
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = nextWidth;
    canvas.height = nextHeight;

    const context = canvas.getContext('2d');
    if (!context) return;
    configureContext(context, ratio);
    if (previous) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(previous, 0, 0, nextWidth, nextHeight);
      context.restore();
      configureContext(context, ratio);
    }
  }, [configureContext]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [resize]);

  const pointOf = (canvas: HTMLCanvasElement, event: CanvasPointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const markInk = () => {
    setHasInk((current) => {
      if (!current) onChange?.(true);
      return true;
    });
  };

  const handlePointerDown = (event: CanvasPointerEvent) => {
    const canvas = canvasRef.current;
    if (disabled || !canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;

    const point = pointOf(canvas, event);
    lastPointRef.current = point;

    // Tek dokunuş = nokta. Basıp bırakan kısa imzalar boş kalmasın.
    const context = canvas.getContext('2d');
    if (!context) return;
    context.beginPath();
    context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    markInk();
  };

  const handlePointerMove = (event: CanvasPointerEvent) => {
    const canvas = canvasRef.current;
    if (!drawingRef.current || disabled || !canvas) return;
    event.preventDefault();

    const point = pointOf(canvas, event);
    const previous = lastPointRef.current ?? point;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    markInk();
  };

  const endStroke = (event: CanvasPointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* yakalanmamış pointer — yoksay */
    }
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setHasInk(false);
    onChange?.(false);
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInk,
    clear,
    /**
     * Beyaz zeminli PNG data URL. İmza yoksa null döner ki çağıran taraf
     * "boş imza" göndermesin.
     */
    toDataUrl: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasInk) return null;

      const flattened = document.createElement('canvas');
      flattened.width = canvas.width;
      flattened.height = canvas.height;
      const context = flattened.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(canvas, 0, 0);
      return flattened.toDataURL('image/png');
    },
  }), [clear, hasInk]);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-white"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
        {!hasInk ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="text-sm font-medium text-slate-400">{hint}</span>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk || disabled}>
          Temizle
        </Button>
      </div>
    </div>
  );
});

export default SignaturePad;
