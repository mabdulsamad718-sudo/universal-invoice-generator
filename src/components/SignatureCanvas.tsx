import { useRef, useState, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onApply: (dataUrl: string) => void;
  onSaveToProfile?: (dataUrl: string) => void;
}

const PEN_COLORS = [
  { label: 'Ink Navy', value: '#0F172A' },
  { label: 'Cobalt Blue', value: '#1D4ED8' },
  { label: 'Pure Black', value: '#000000' },
];

export function SignatureCanvas({ onApply, onSaveToProfile }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [penColor, setPenColor] = useState('#0F172A');
  const [strokeWidth, setStrokeWidth] = useState(2.6);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 420;
    const height = rect.height || 140;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const getPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPoint(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const exportTrimmedPng = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return null;
    return canvas.toDataURL('image/png');
  };

  const handleApply = () => {
    const dataUrl = exportTrimmedPng();
    if (dataUrl) onApply(dataUrl);
  };

  const handleSaveProfile = () => {
    const dataUrl = exportTrimmedPng();
    if (dataUrl && onSaveToProfile) {
      onApply(dataUrl);
      onSaveToProfile(dataUrl);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Ink:</span>
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setPenColor(c.value)}
              aria-label={`Select ${c.label} ink`}
              className={`h-6 w-6 rounded border transition-transform ${
                penColor === c.value
                  ? 'scale-105 border-blue-600 ring-2 ring-blue-500/30'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sig-stroke-width" className="text-xs text-slate-600 dark:text-slate-300">
            Stroke
          </label>
          <input
            id="sig-stroke-width"
            type="range"
            min="1.5"
            max="4.5"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-20 accent-blue-700"
          />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600">
        <canvas
          ref={canvasRef}
          data-testid="signature-draw-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="h-36 w-full touch-none cursor-crosshair block"
        />
        {!hasStrokes && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-slate-400">
              Sign here using mouse, trackpad, or touch
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-4 left-6 right-6 border-b border-dashed border-slate-200" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
        >
          <Eraser className="h-3.5 w-3.5" />
          <span>Clear Pad</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onSaveToProfile && (
            <button
              type="button"
              disabled={!hasStrokes}
              onClick={handleSaveProfile}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
            >
              <span>Apply & Save Default</span>
            </button>
          )}
          <button
            type="button"
            disabled={!hasStrokes}
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Use Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
}
