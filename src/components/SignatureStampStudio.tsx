import { useState, type ChangeEvent } from 'react';
import {
  Eye,
  EyeOff,
  Upload,
  PenTool,
  BookmarkCheck,
  Stamp,
  Info,
  Plus,
  Trash2,
  RotateCcw,
  Undo2,
  Redo2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { AuthPlacementElement, SavedBusinessProfile } from '../types/invoice';
import { SAMPLE_SIGNATURE_DATA_URL, SAMPLE_STAMP_DATA_URL } from '../data/seedData';
import { validateUploadedAssetFile } from '../utils/authElements';
import { SignatureCanvas } from './SignatureCanvas';

interface SignatureStampStudioProps {
  elements: AuthPlacementElement[];
  selectedElementId: string | null;
  onSelectElementId: (id: string | null) => void;
  businessProfile: SavedBusinessProfile;
  onElementsChange: (elements: AuthPlacementElement[]) => void;
  onSaveSignatureToProfile: (dataUrl: string, label: string) => void;
  onSaveStampToProfile: (dataUrl: string, label: string) => void;
  onRemoveSavedAsset?: (kind: 'signature' | 'stamp', assetId: string) => void;
}

const SIGNATURE_LABELS = [
  'Authorized Signature',
  'Approved By',
  'Prepared By',
  'Authorized Representative',
  'Managing Director',
];

const STAMP_LABELS = ['Company Stamp', 'Official Seal', 'Approved Seal', 'Paid Stamp', ''];

export function SignatureStampStudio({
  elements,
  selectedElementId,
  onSelectElementId,
  businessProfile,
  onElementsChange,
  onSaveSignatureToProfile,
  onSaveStampToProfile,
  onRemoveSavedAsset,
}: SignatureStampStudioProps) {
  const [assetTab, setAssetTab] = useState<'draw' | 'upload' | 'saved'>('draw');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [undoStack, setUndoStack] = useState<AuthPlacementElement[][]>([]);
  const [redoStack, setRedoStack] = useState<AuthPlacementElement[][]>([]);
  const [confirmDeleteAssetId, setConfirmDeleteAssetId] = useState<string | null>(null);

  const activeElement =
    elements.find((e) => e.id === selectedElementId) ?? elements[0] ?? null;

  const flash = (text: string, type: 'ok' | 'err' = 'ok') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 3200);
  };

  const commitWithHistory = (next: AuthPlacementElement[]) => {
    setUndoStack((prev) => [...prev.slice(-19), elements]);
    setRedoStack([]);
    onElementsChange(next);
  };

  const snapshotHistoryOnce = () => {
    setUndoStack((prev) => [...prev.slice(-19), elements]);
    setRedoStack([]);
  };

  const updateSelectedLive = (patch: Partial<AuthPlacementElement>) => {
    if (!activeElement) return;
    onElementsChange(
      elements.map((el) => (el.id === activeElement.id ? { ...el, ...patch } : el))
    );
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, elements]);
    onElementsChange(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, elements]);
    onElementsChange(next);
  };

  const updateSelected = (patch: Partial<AuthPlacementElement>) => {
    if (!activeElement) return;
    commitWithHistory(
      elements.map((el) => (el.id === activeElement.id ? { ...el, ...patch } : el))
    );
  };

  const addElement = (kind: 'signature' | 'stamp') => {
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const maxZ = elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const created: AuthPlacementElement = {
      id,
      kind,
      enabled: true,
      dataUrl:
        kind === 'signature'
          ? businessProfile.savedSignatureDataUrl || SAMPLE_SIGNATURE_DATA_URL
          : businessProfile.savedStampDataUrl || SAMPLE_STAMP_DATA_URL,
      label: kind === 'signature' ? 'Authorized Signature' : 'Company Stamp',
      x: kind === 'signature' ? 8 : 68,
      y: kind === 'signature' ? 78 : 74,
      width: kind === 'signature' ? 156 : 96,
      rotation: 0,
      opacity: kind === 'signature' ? 1 : 0.85,
      zIndex: maxZ + 1,
    };
    commitWithHistory([...elements, created]);
    onSelectElementId(id);
    flash(kind === 'signature' ? 'Added signature layer.' : 'Added stamp/seal layer.');
  };

  const deleteElement = (id: string) => {
    const remaining = elements.filter((e) => e.id !== id);
    commitWithHistory(remaining);
    if (activeElement?.id === id) {
      onSelectElementId(remaining[0]?.id ?? null);
    }
    flash('Removed authorization element.');
  };

  const shiftLayer = (direction: 'up' | 'down') => {
    if (!activeElement) return;
    const delta = direction === 'up' ? 1 : -1;
    updateSelected({ zIndex: Math.max(1, activeElement.zIndex + delta) });
  };

  const quickAlign = (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!activeElement) return;
    if (axis === 'left') updateSelected({ x: 6 });
    if (axis === 'center') updateSelected({ x: 40 });
    if (axis === 'right') updateSelected({ x: 72 });
    if (axis === 'top') updateSelected({ y: 12 });
    if (axis === 'middle') updateSelected({ y: 48 });
    if (axis === 'bottom') updateSelected({ y: 78 });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUploadedAssetFile(file);
    if (err) {
      flash(err, 'err');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (!activeElement) {
          addElement('signature');
        } else {
          updateSelected({ dataUrl: reader.result, enabled: true });
        }
        flash(`Uploaded "${file.name}" (${Math.round(file.size / 1024)} KB).`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const savedSigLibrary =
    businessProfile.savedSignatures && businessProfile.savedSignatures.length > 0
      ? businessProfile.savedSignatures
      : businessProfile.savedSignatureDataUrl
        ? [
            {
              id: 'default-sig',
              kind: 'signature' as const,
              label: businessProfile.savedSignatureLabel || 'Authorized Signature',
              dataUrl: businessProfile.savedSignatureDataUrl,
              createdAt: '',
            },
          ]
        : [];

  const savedStampLibrary =
    businessProfile.savedStamps && businessProfile.savedStamps.length > 0
      ? businessProfile.savedStamps
      : businessProfile.savedStampDataUrl
        ? [
            {
              id: 'default-stamp',
              kind: 'stamp' as const,
              label: businessProfile.savedStampLabel || 'Company Stamp',
              dataUrl: businessProfile.savedStampDataUrl,
              createdAt: '',
            },
          ]
        : [];

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role={notice.type === 'err' ? 'alert' : 'status'}
          className={`rounded-md border px-3 py-2 text-xs font-medium ${
            notice.type === 'err'
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Element Layer Bar + Undo / Redo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addElement('signature')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5 text-blue-700" />
            <span>Add Signature</span>
          </button>
          <button
            type="button"
            onClick={() => addElement('stamp')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Stamp className="h-3.5 w-3.5 text-blue-700" />
            <span>Add Stamp / Seal</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo placement change"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo placement change"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Element Selector List */}
      {elements.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {elements.map((el, idx) => {
            const selected = activeElement?.id === el.id;
            return (
              <div
                key={el.id}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  selected
                    ? 'border-blue-700 bg-blue-50/80 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectElementId(el.id)}
                  className="font-medium truncate max-w-[140px]"
                >
                  {el.label || (el.kind === 'signature' ? `Signature #${idx + 1}` : `Stamp #${idx + 1}`)}
                </button>
                <button
                  type="button"
                  aria-label={`Toggle visibility for ${el.label || el.kind}`}
                  onClick={() =>
                    commitWithHistory(
                      elements.map((item) =>
                        item.id === el.id ? { ...item, enabled: !item.enabled } : item
                      )
                    )
                  }
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {el.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${el.label || el.kind}`}
                  onClick={() => deleteElement(el.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Element Editor */}
      {activeElement ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4 dark:border-slate-700 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Editing:{' '}
              <span className="text-blue-700 dark:text-blue-400">
                {activeElement.label || activeElement.kind}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftLayer('down')}
                title="Send Backward"
                aria-label="Send backward"
                className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => shiftLayer('up')}
                title="Bring Forward"
                aria-label="Bring forward"
                className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSelected({
                    x: activeElement.kind === 'signature' ? 8 : 72,
                    y: activeElement.kind === 'signature' ? 78 : 74,
                    rotation: 0,
                  })
                }
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Pos</span>
              </button>
            </div>
          </div>

          {/* Asset Source Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setAssetTab('draw')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                assetTab === 'draw'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              onClick={() => setAssetTab('upload')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                assetTab === 'upload'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setAssetTab('saved')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                assetTab === 'saved'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              <span>Saved Library</span>
            </button>
          </div>

          {assetTab === 'draw' && (
            <SignatureCanvas
              onApply={(dataUrl) => {
                updateSelected({ dataUrl, enabled: true });
                flash('Drawn graphic applied to selected element.');
              }}
              onSaveToProfile={(dataUrl) => {
                if (activeElement.kind === 'stamp') {
                  onSaveStampToProfile(dataUrl, activeElement.label);
                } else {
                  onSaveSignatureToProfile(dataUrl, activeElement.label);
                }
                flash('Graphic saved to Business Profile library.');
              }}
            />
          )}

          {assetTab === 'upload' && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <Upload className="h-3.5 w-3.5 text-blue-700" />
                <span>Upload PNG, JPEG, SVG, or WebP (Max 2 MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={handleImageUpload}
                />
              </label>
              <p className="mt-2 text-[11px] text-slate-500">
                Transparent PNG or crisp SVG seals overlay cleanly across any invoice section.
              </p>
            </div>
          )}

          {assetTab === 'saved' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Saved {activeElement.kind === 'signature' ? 'Signatures' : 'Company Seals'}
                </span>
                <div className="flex items-center gap-2">
                  {activeElement.dataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeElement.kind === 'stamp') {
                          onSaveStampToProfile(activeElement.dataUrl, activeElement.label);
                        } else {
                          onSaveSignatureToProfile(activeElement.dataUrl, activeElement.label);
                        }
                        flash('Saved current asset to library.');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      + Save Current to Library
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      updateSelected({
                        dataUrl:
                          activeElement.kind === 'stamp'
                            ? SAMPLE_STAMP_DATA_URL
                            : SAMPLE_SIGNATURE_DATA_URL,
                        enabled: true,
                      });
                      flash('Sample asset applied.');
                    }}
                    className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
                  >
                    Load Sample
                  </button>
                </div>
              </div>

              {(activeElement.kind === 'signature' ? savedSigLibrary : savedStampLibrary).length ===
              0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  No saved assets in library yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(activeElement.kind === 'signature' ? savedSigLibrary : savedStampLibrary).map(
                    (asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={asset.dataUrl}
                            alt={asset.label}
                            className="h-9 w-12 rounded border border-slate-100 bg-white object-contain p-0.5 shrink-0"
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                            {asset.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              updateSelected({
                                dataUrl: asset.dataUrl,
                                label: asset.label,
                                enabled: true,
                              });
                              flash('Applied saved asset.');
                            }}
                            className="rounded bg-blue-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-800"
                          >
                            Apply
                          </button>
                          {onRemoveSavedAsset && asset.id !== 'default-sig' && asset.id !== 'default-stamp' && (
                            confirmDeleteAssetId === asset.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onRemoveSavedAsset(asset.kind, asset.id);
                                    setConfirmDeleteAssetId(null);
                                    flash('Saved asset deleted.');
                                  }}
                                  className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAssetId(null)}
                                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Delete saved ${asset.label}`}
                                onClick={() => setConfirmDeleteAssetId(asset.id)}
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Label, Position, Size, Rotation, Opacity & Quick Alignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="auth-label-preset"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Caption Preset
              </label>
              <select
                id="auth-label-preset"
                value={
                  (activeElement.kind === 'signature' ? SIGNATURE_LABELS : STAMP_LABELS).includes(
                    activeElement.label
                  )
                    ? activeElement.label
                    : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    updateSelected({ label: e.target.value });
                  }
                }}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {(activeElement.kind === 'signature' ? SIGNATURE_LABELS : STAMP_LABELS).map(
                  (lbl) => (
                    <option key={lbl || 'none'} value={lbl}>
                      {lbl || 'No Caption'}
                    </option>
                  )
                )}
                <option value="__custom__">Custom Caption...</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="auth-custom-label"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Custom Label Text
              </label>
              <input
                id="auth-custom-label"
                type="text"
                value={activeElement.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                placeholder="Authorized Signature / Approved By"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="auth-width-range"
                className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <span>Size</span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {activeElement.width}px
                </span>
              </label>
              <input
                id="auth-width-range"
                type="range"
                min={activeElement.kind === 'stamp' ? 56 : 84}
                max={activeElement.kind === 'stamp' ? 200 : 280}
                value={activeElement.width}
                onPointerDown={snapshotHistoryOnce}
                onChange={(e) => updateSelectedLive({ width: Number(e.target.value) })}
                className="mt-2 w-full accent-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="auth-rotation-range"
                className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <span>Rotation</span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {activeElement.rotation}&deg;
                </span>
              </label>
              <input
                id="auth-rotation-range"
                type="range"
                min="-45"
                max="45"
                value={activeElement.rotation}
                onPointerDown={snapshotHistoryOnce}
                onChange={(e) => updateSelectedLive({ rotation: Number(e.target.value) })}
                className="mt-2 w-full accent-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="auth-pos-x"
                className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
              >
                <span>Horizontal X</span>
                <span className="font-mono text-[11px] tabular-nums">{activeElement.x}%</span>
              </label>
              <input
                id="auth-pos-x"
                type="range"
                min="2"
                max="86"
                value={activeElement.x}
                onPointerDown={snapshotHistoryOnce}
                onChange={(e) => updateSelectedLive({ x: Number(e.target.value) })}
                className="mt-1.5 w-full accent-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="auth-pos-y"
                className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
              >
                <span>Vertical Y (Full Page)</span>
                <span className="font-mono text-[11px] tabular-nums">{activeElement.y}%</span>
              </label>
              <input
                id="auth-pos-y"
                type="range"
                min="2"
                max="90"
                value={activeElement.y}
                onPointerDown={snapshotHistoryOnce}
                onChange={(e) => updateSelectedLive({ y: Number(e.target.value) })}
                className="mt-1.5 w-full accent-blue-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="auth-opacity"
                className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
              >
                <span>Ink Opacity</span>
                <span className="font-mono text-[11px] tabular-nums">
                  {Math.round(activeElement.opacity * 100)}%
                </span>
              </label>
              <input
                id="auth-opacity"
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={activeElement.opacity}
                onPointerDown={snapshotHistoryOnce}
                onChange={(e) => updateSelectedLive({ opacity: Number(e.target.value) })}
                className="mt-1.5 w-full accent-blue-700"
              />
            </div>
          </div>

          {/* Quick Alignment Controls */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Quick Page Alignment
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'left', label: 'Left' },
                  { id: 'center', label: 'Center' },
                  { id: 'right', label: 'Right' },
                  { id: 'top', label: 'Top' },
                  { id: 'middle', label: 'Middle' },
                  { id: 'bottom', label: 'Bottom' },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => quickAlign(pos.id)}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
          No signature or company stamp layers added. Click &ldquo;Add Signature&rdquo; or
          &ldquo;Add Stamp / Seal&rdquo; above.
        </div>
      )}

      {/* Legal Clarity Notice */}
      <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" />
        <span>
          Signature and company seal images customize the visual appearance of your invoice and PDF
          export; they do not by themselves constitute a cryptographically verified digital
          signature.
        </span>
      </div>
    </div>
  );
}
