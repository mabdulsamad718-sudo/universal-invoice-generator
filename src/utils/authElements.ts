import type { AuthPlacementElement, Invoice, SignatureConfig, StampConfig } from '../types/invoice';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
]);

export const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateUploadedAssetFile(file: File): string | null {
  const type = (file.type || '').toLowerCase();
  const extOk = /\.(png|jpe?g|svg|webp)$/i.test(file.name || '');
  if (!ALLOWED_IMAGE_MIME_TYPES.has(type) && !extOk) {
    return 'Unsupported file format. Please upload PNG, JPEG, SVG, or WebP.';
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return `File exceeds the 2 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`;
  }
  return null;
}

/**
 * Converts legacy single `signature` + `stamp` fields into full-page `authElements[]`
 * if `authElements` is not yet populated on an invoice.
 */
export function getInvoiceAuthElements(invoice: Pick<Invoice, 'signature' | 'stamp' | 'authElements'>): AuthPlacementElement[] {
  if (invoice.authElements && invoice.authElements.length > 0) {
    return invoice.authElements;
  }

  const elements: AuthPlacementElement[] = [];
  if (invoice.signature) {
    // Migrate older bottom-zone y (0-50 inside old bottom box) smoothly into dedicated lower breathing space (82-86%)
    const legacyY = invoice.signature.y;
    const pageY = legacyY <= 50 ? Math.min(86, 82 + Math.round(legacyY * 0.1)) : legacyY;
    elements.push({
      id: 'sig-primary',
      kind: 'signature',
      enabled: invoice.signature.enabled,
      dataUrl: invoice.signature.dataUrl,
      label: invoice.signature.label || 'Authorized Signature',
      x: Math.max(4, Math.min(78, invoice.signature.x ?? 8)),
      y: pageY,
      width: invoice.signature.width || 156,
      rotation: invoice.signature.rotation ?? 0,
      opacity: 1,
      zIndex: 1,
    });
  }

  if (invoice.stamp) {
    const legacyY = invoice.stamp.y;
    const pageY = legacyY <= 50 ? Math.min(84, 79 + Math.round(legacyY * 0.1)) : legacyY;
    elements.push({
      id: 'stamp-primary',
      kind: 'stamp',
      enabled: invoice.stamp.enabled,
      dataUrl: invoice.stamp.dataUrl,
      label: invoice.stamp.label || 'Company Stamp',
      x: Math.max(4, Math.min(82, invoice.stamp.x ?? 72)),
      y: pageY,
      width: invoice.stamp.size || 96,
      rotation: invoice.stamp.rotation ?? 0,
      opacity: invoice.stamp.opacity ?? 0.85,
      zIndex: 2,
    });
  }

  return elements;
}

/**
 * Keeps legacy `signature` and `stamp` fields synced from primary elements in `authElements[]`
 * so any downstream consumer still reading `.signature` or `.stamp` stays consistent.
 */
export function syncAuthElementsToInvoice(
  invoice: Invoice,
  nextElements: AuthPlacementElement[]
): Invoice {
  const firstSig = nextElements.find((el) => el.kind === 'signature');
  const firstStamp = nextElements.find((el) => el.kind === 'stamp');

  const signature: SignatureConfig = firstSig
    ? {
        enabled: firstSig.enabled,
        dataUrl: firstSig.dataUrl,
        label: firstSig.label,
        x: firstSig.x,
        y: firstSig.y,
        width: firstSig.width,
        rotation: firstSig.rotation,
      }
    : { ...invoice.signature, enabled: false };

  const stamp: StampConfig = firstStamp
    ? {
        enabled: firstStamp.enabled,
        dataUrl: firstStamp.dataUrl,
        label: firstStamp.label,
        x: firstStamp.x,
        y: firstStamp.y,
        size: firstStamp.width,
        opacity: firstStamp.opacity,
        rotation: firstStamp.rotation,
      }
    : { ...invoice.stamp, enabled: false };

  return {
    ...invoice,
    authElements: nextElements,
    signature,
    stamp,
  };
}
