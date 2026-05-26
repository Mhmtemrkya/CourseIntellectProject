import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush, Eraser, Grid3X3, Highlighter, Maximize2, PenLine, Redo2, RotateCcw, Trash2, Undo2,
} from 'lucide-react';

const COLORS = ['#fb923c', '#60a5fa', '#34d399', '#a78bfa', '#f8fafc', '#f43f5e'];
const TOOLS = [
  { key: 'pen', label: 'Kalem', icon: PenLine },
  { key: 'highlighter', label: 'Fosfor', icon: Highlighter },
  { key: 'eraser', label: 'Silgi', icon: Eraser },
];

function createPoint(event, rect) {
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure: event.pressure || 0.5,
    pointerType: event.pointerType || 'mouse',
    t: Date.now(),
  };
}

function drawPaper(ctx, width, height, paperMode) {
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#07111f');
  gradient.addColorStop(1, '#0d1728');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (paperMode === 'blank') return;

  const size = paperMode === 'squared' ? 24 : 32;
  ctx.strokeStyle = paperMode === 'squared' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(148, 163, 184, 0.10)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawStroke(ctx, stroke) {
  const points = stroke.points || [];
  if (points.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(255,255,255,1)' : stroke.color;
  ctx.globalAlpha = stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.36 : 1);
  ctx.lineWidth = Math.max(1, stroke.width || 3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const midpointX = (points[index].x + points[index + 1].x) / 2;
    const midpointY = (points[index].y + points[index + 1].y) / 2;
    ctx.quadraticCurveTo(points[index].x, points[index].y, midpointX, midpointY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

export function DrawingCanvas({ questionAttemptId, initialSnapshotUrl, onStrokeComplete, onSnapshot }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const loadedAttemptRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#fb923c');
  const [width, setWidth] = useState(4);
  const [paperMode, setPaperMode] = useState('grid');
  const [strokes, setStrokes] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [baseImage, setBaseImage] = useState(null);

  const activeTool = useMemo(() => TOOLS.find((item) => item.key === tool), [tool]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    drawPaper(ctx, rect.width, rect.height, paperMode);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, rect.width, rect.height);
    }
    strokes.forEach((stroke) => drawStroke(ctx, stroke));
    if (activeStrokeRef.current) {
      drawStroke(ctx, activeStrokeRef.current);
    }
  }, [baseImage, paperMode, strokes]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPaper(ctx, rect.width, rect.height, paperMode);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, rect.width, rect.height);
    }
    strokes.forEach((stroke) => drawStroke(ctx, stroke));
  }, [baseImage, paperMode, strokes]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (loadedAttemptRef.current === questionAttemptId) return undefined;
    loadedAttemptRef.current = questionAttemptId;
    activeStrokeRef.current = null;
    setBaseImage(null);
    if (!initialSnapshotUrl) {
      return undefined;
    }
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      setBaseImage(image);
    };
    image.src = initialSnapshotUrl;
    return () => {
      image.onload = null;
    };
  }, [initialSnapshotUrl, questionAttemptId]);

  const emitSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSnapshot) return;
    window.setTimeout(() => onSnapshot(canvas.toDataURL('image/png')), 50);
  }, [onSnapshot]);

  const beginStroke = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const stroke = {
      id: `${questionAttemptId || 'local'}-${Date.now()}`,
      tool,
      color,
      width: tool === 'highlighter' ? width * 3 : width,
      opacity: tool === 'highlighter' ? 0.34 : 1,
      pressure: event.pressure || 0.5,
      createdAt: new Date().toISOString(),
      points: [createPoint(event, rect)],
    };
    activeStrokeRef.current = stroke;
    setRedoStack([]);
  };

  const appendStroke = (event) => {
    if (!activeStrokeRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    activeStrokeRef.current.points.push(createPoint(event, rect));
    redraw();
  };

  const endStroke = () => {
    if (!activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if ((stroke.points || []).length > 1) {
      setStrokes((items) => [...items, stroke]);
      onStrokeComplete?.(stroke);
      emitSnapshot();
    }
  };

  const undo = () => {
    setStrokes((items) => {
      if (items.length === 0) return items;
      const next = items.slice(0, -1);
      setRedoStack((redoItems) => [items[items.length - 1], ...redoItems]);
      return next;
    });
    emitSnapshot();
  };

  const redo = () => {
    setRedoStack((items) => {
      if (items.length === 0) return items;
      const [first, ...rest] = items;
      setStrokes((strokeItems) => [...strokeItems, first]);
      return rest;
    });
    emitSnapshot();
  };

  const clear = () => {
    setRedoStack((items) => [...strokes, ...items]);
    setBaseImage(null);
    setStrokes([]);
    emitSnapshot();
  };

  useEffect(() => {
    redraw();
  }, [strokes, paperMode, redraw]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-4 z-50 bg-slate-950 p-4' : ''} rounded-[28px] border border-white/10 bg-slate-950/80 shadow-2xl shadow-orange-500/5`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-orange-200/60">Çözüm Kağıdı</p>
          <p className="text-sm text-slate-300">Mouse, trackpad, touch ve stylus destekli</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTool(item.key)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${tool === item.key ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          <button type="button" onClick={undo} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10" title="Geri al">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={redo} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10" title="İleri al">
            <Redo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={clear} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10" title="Temizle">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPaperMode((value) => (value === 'grid' ? 'squared' : value === 'squared' ? 'blank' : 'grid'))} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10" title="Kağıt tipi">
            {paperMode === 'blank' ? <Brush className="h-4 w-4" /> : paperMode === 'squared' ? <Grid3X3 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setIsFullscreen((value) => !value)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 hover:bg-white/10" title="Tam ekran">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-xs font-semibold text-slate-400">{activeTool?.label}</span>
        {COLORS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setColor(item)}
            className={`h-6 w-6 rounded-full border ${color === item ? 'border-white ring-2 ring-orange-400' : 'border-white/20'}`}
            style={{ backgroundColor: item }}
            aria-label={`Renk ${item}`}
          />
        ))}
        <input
          type="range"
          min="1"
          max="16"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          className="accent-orange-500"
        />
        <span className="text-xs text-slate-400">{width}px</span>
        {initialSnapshotUrl ? <span className="ml-auto text-xs text-emerald-300">Son kayıt yüklendi</span> : <span className="ml-auto text-xs text-slate-500">Autosave aktif</span>}
      </div>
      <div ref={wrapperRef} className={`${isFullscreen ? 'h-[calc(100vh-170px)]' : 'h-[520px]'} relative overflow-hidden rounded-b-[28px] border-t border-white/10`}>
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={beginStroke}
          onPointerMove={appendStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>
    </div>
  );
}
