import { jsPDF } from 'jspdf';
import type {
  ConnectedPaymentAccount,
  DateFormatOption,
  Invoice,
  InvoiceFontStyle,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  formatCurrencyForPdf,
  formatDisplayDate,
  resolveEffectiveTaxRate,
} from './calculations';
import { getInvoiceAuthElements } from './authElements';
import { buildDirectPaymentUrl, resolveInvoicePaymentAccounts } from './recurring';

interface RasterizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1D4ED8').replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r || 29, g || 78, b || 216];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }
  return [29, 78, 216];
}

function mapPdfFont(fontStyle: InvoiceFontStyle): 'helvetica' | 'times' | 'courier' {
  if (fontStyle === 'serif') return 'times';
  if (fontStyle === 'mono') return 'courier';
  return 'helvetica';
}

async function rasterizeDataUrlToPng(
  dataUrl: string,
  opacity = 1,
  rotationDeg = 0
): Promise<RasterizedImage | null> {
  if (!dataUrl || typeof document === 'undefined' || typeof Image === 'undefined') return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: RasterizedImage | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 4000);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 240;
        const naturalH = img.naturalHeight || img.height || 120;
        const scale = 2;
        const w = Math.max(40, Math.min(900, naturalW * scale));
        const h = Math.max(40, Math.min(900, naturalH * scale));

        const rad = (rotationDeg * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const outW = Math.ceil(w * cos + h * sin);
        const outH = Math.ceil(w * sin + h * cos);

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.clearRect(0, 0, outW, outH);
        ctx.globalAlpha = Math.max(0.1, Math.min(1, opacity));
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);

        finish({
          dataUrl: canvas.toDataURL('image/png'),
          width: outW,
          height: outH,
        });
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = dataUrl;
  });
}

export interface GeneratedPdfResult {
  blob: Blob;
  filename: string;
}

export interface BuiltPdfDocument {
  doc: jsPDF;
  filename: string;
}

export async function buildInvoicePdfDocument(
  invoice: Invoice,
  dateFormat: DateFormatOption = 'DD MMM YYYY',
  paymentAccounts: ConnectedPaymentAccount[] = []
): Promise<BuiltPdfDocument> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 18;

  const font = mapPdfFont(invoice.design.fontStyle);
  const [ar, ag, ab] = hexToRgb(invoice.design.accentColor);
  const isClassic = invoice.design.template === 'classic';
  const isMinimal = invoice.design.template === 'minimal';
  const [hr, hg, hb] = isMinimal ? [15, 23, 42] : [ar, ag, ab];

  const totals = calculateInvoiceTotals(
    invoice.items,
    invoice.discountType,
    invoice.discountValue,
    {
      currency: invoice.currency,
      taxTreatment: invoice.taxTreatment ?? 'after_discount',
      invoiceTaxRate: invoice.invoiceTaxRate ?? 0,
    }
  );

  let y = 14;

  // Modern top stripe
  if (invoice.design.template === 'modern') {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, pageWidth, 3.5, 'F');
    y = 14;
  }

  // Optional header tinted background
  if (invoice.design.headerStyle === 'tinted') {
    doc.setFillColor(
      Math.min(255, Math.round(ar * 0.08 + 255 * 0.92)),
      Math.min(255, Math.round(ag * 0.08 + 255 * 0.92)),
      Math.min(255, Math.round(ab * 0.08 + 255 * 0.92))
    );
    doc.roundedRect(marginX, y - 4, contentWidth, 42, 2, 2, 'F');
  }

  // Logo rasterization
  const logoImg = invoice.business.logoDataUrl
    ? await rasterizeDataUrlToPng(invoice.business.logoDataUrl)
    : null;

  const logoMaxBox = 14;
  const drawLogo = (boxX: number, boxY: number) => {
    if (!logoImg) return;
    const aspect = logoImg.height / Math.max(1, logoImg.width);
    const drawW = aspect >= 1 ? logoMaxBox / aspect : logoMaxBox;
    const drawH = aspect >= 1 ? logoMaxBox : logoMaxBox * aspect;
    const offsetX = boxX + (logoMaxBox - drawW) / 2;
    const offsetY = boxY + (logoMaxBox - drawH) / 2;
    doc.addImage(logoImg.dataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
  };

  if (isClassic) {
    let logoX = marginX;
    let align: 'left' | 'center' | 'right' = 'left';
    let textX = marginX;

    if (invoice.design.logoPlacement === 'center') {
      logoX = (pageWidth - logoMaxBox) / 2;
      align = 'center';
      textX = pageWidth / 2;
    } else if (invoice.design.logoPlacement === 'right') {
      logoX = pageWidth - marginX - logoMaxBox;
      align = 'right';
      textX = pageWidth - marginX;
    }

    if (logoImg) {
      drawLogo(logoX, y);
      y += logoMaxBox + 4;
    }

    doc.setFont(font, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.business.name || 'Your Business Name', textX, y, { align });
    y += 5;

    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const bizMeta = [
      invoice.business.address.replace(/\n+/g, ', '),
      [invoice.business.email, invoice.business.phone, invoice.business.website]
        .filter(Boolean)
        .join('  |  '),
      invoice.business.taxNumber ? `Tax ID: ${invoice.business.taxNumber}` : '',
    ].filter(Boolean);

    for (const line of bizMeta) {
      const wrapped = doc.splitTextToSize(line, contentWidth - 10);
      doc.text(wrapped, textX, y, { align });
      y += wrapped.length * 4;
    }

    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;

    doc.setFont(font, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(hr, hg, hb);
    doc.text(invoice.title || 'INVOICE', marginX, y);

    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Invoice #: ${invoice.invoiceNumber}   |   Issued: ${formatDisplayDate(
        invoice.issueDate,
        dateFormat
      )}   |   Due: ${formatDisplayDate(invoice.dueDate, dateFormat)}`,
      pageWidth - marginX,
      y,
      { align: 'right' }
    );
    y += 8;
  } else {
    // Modern / Minimal side-by-side header
    const leftBlockX =
      invoice.design.logoPlacement === 'left' && logoImg ? marginX + logoMaxBox + 4 : marginX;
    if (logoImg) {
      const lx =
        invoice.design.logoPlacement === 'right'
          ? pageWidth - marginX - logoMaxBox
          : marginX;
      drawLogo(lx, y);
    }

    let leftY = y + 4;
    doc.setFont(font, 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.business.name || 'Your Business Name', leftBlockX, leftY);
    leftY += 4.8;

    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    if (invoice.business.address) {
      const addrLines = doc.splitTextToSize(invoice.business.address, 85);
      doc.text(addrLines, leftBlockX, leftY);
      leftY += addrLines.length * 3.8;
    }
    const contactStr = [invoice.business.email, invoice.business.phone].filter(Boolean).join(' · ');
    if (contactStr) {
      doc.text(contactStr, leftBlockX, leftY);
      leftY += 3.8;
    }
    if (invoice.business.website) {
      doc.text(invoice.business.website, leftBlockX, leftY);
      leftY += 3.8;
    }
    if (invoice.business.taxNumber) {
      doc.text(`Tax Reg: ${invoice.business.taxNumber}`, leftBlockX, leftY);
      leftY += 3.8;
    }

    // Right side title & invoice meta
    let rightY = y + 6;
    const rightMetaX =
      invoice.design.logoPlacement === 'right' && logoImg
        ? pageWidth - marginX - logoMaxBox - 4
        : pageWidth - marginX;

    doc.setFont(font, 'bold');
    doc.setFontSize(20);
    doc.setTextColor(hr, hg, hb);
    doc.text(invoice.title || 'INVOICE', rightMetaX, rightY, { align: 'right' });
    rightY += 6;

    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Invoice #: ${invoice.invoiceNumber || 'INV-001'}`, rightMetaX, rightY, {
      align: 'right',
    });
    rightY += 4.2;
    doc.text(
      `Issue Date: ${formatDisplayDate(invoice.issueDate, dateFormat)}`,
      rightMetaX,
      rightY,
      { align: 'right' }
    );
    rightY += 4.2;
    doc.text(`Due Date: ${formatDisplayDate(invoice.dueDate, dateFormat)}`, rightMetaX, rightY, {
      align: 'right',
    });
    rightY += 4.2;

    y = Math.max(leftY, rightY, y + 18) + 4;
  }

  // Header bottom rule
  if (invoice.design.headerStyle === 'bordered') {
    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(0.7);
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
  }
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  y += 7;

  // Billed To & Summary strip
  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isMinimal ? 100 : hr, isMinimal ? 116 : hg, isMinimal ? 139 : hb);
  doc.text('BILLED TO', marginX, y);
  doc.text(`AMOUNT DUE (${invoice.currency})`, pageWidth - marginX, y, { align: 'right' });
  y += 4.5;

  let billY = y;
  doc.setFont(font, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customer.name || 'Client Name', marginX, billY);
  billY += 4.5;

  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (invoice.customer.company) {
    doc.text(invoice.customer.company, marginX, billY);
    billY += 4;
  }
  if (invoice.customer.address) {
    const custAddr = doc.splitTextToSize(invoice.customer.address, 95);
    doc.text(custAddr, marginX, billY);
    billY += custAddr.length * 3.8;
  }
  const custContact = [invoice.customer.email, invoice.customer.phone].filter(Boolean).join(' · ');
  if (custContact) {
    doc.text(custContact, marginX, billY);
    billY += 4;
  }

  // Right Amount Due
  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(hr, hg, hb);
  doc.text(formatCurrencyForPdf(totals.grandTotal, invoice.currency), pageWidth - marginX, y + 2, {
    align: 'right',
  });
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - marginX, y + 7.5, {
    align: 'right',
  });

  y = Math.max(billY, y + 12) + 6;

  // Table Header renderer (reused across multi-page overflow)
  const colDescX = marginX + 2;
  const colQtyX = marginX + 104;
  const colUnitX = marginX + 128;
  const colDiscX = marginX + 146;
  const colTaxX = marginX + 161;
  const colTotalX = pageWidth - marginX - 2;

  const drawTableHeader = () => {
    if (!isClassic && !isMinimal) {
      doc.setFillColor(ar, ag, ab);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
    } else if (isClassic) {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, y, pageWidth - marginX, y);
      doc.line(marginX, y + 8, pageWidth - marginX, y + 8);
      doc.setTextColor(51, 65, 85);
    } else {
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, y + 8, pageWidth - marginX, y + 8);
      doc.setTextColor(100, 116, 139);
    }

    doc.setFont(font, 'bold');
    doc.setFontSize(7.5);
    const ty = y + 5.3;
    doc.text('DESCRIPTION', colDescX, ty);
    doc.text('QTY', colQtyX, ty, { align: 'right' });
    doc.text('RATE', colUnitX, ty, { align: 'right' });
    doc.text('DISC', colDiscX, ty, { align: 'right' });
    doc.text('TAX', colTaxX, ty, { align: 'right' });
    doc.text('AMOUNT', colTotalX, ty, { align: 'right' });
    y += 9;
  };

  const ensureSpace = (neededMm: number, repeatTableHeader = false) => {
    if (y + neededMm <= bottomLimit) return;
    doc.addPage();
    y = 16;
    if (repeatTableHeader) {
      drawTableHeader();
    }
  };

  drawTableHeader();

  if (invoice.items.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No line items added.', pageWidth / 2, y + 6, { align: 'center' });
    y += 12;
  } else {
    for (let idx = 0; idx < invoice.items.length; idx++) {
      const item = invoice.items[idx];
      const line = calculateLineItem(
        item,
        invoice.currency,
        invoice.invoiceTaxRate ?? 0,
        invoice.taxTreatment ?? 'after_discount'
      );
      const descLines = doc.splitTextToSize(item.description || 'Untitled Item / Service', 88);
      const rowHeight = Math.max(8, descLines.length * 4 + 3.5);

      ensureSpace(rowHeight + 2, true);

      if (!isMinimal && idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y - 1, contentWidth, rowHeight, 'F');
      }

      doc.setFont(font, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(descLines, colDescX, y + 3.5);

      const valY = y + 3.5;
      doc.text(String(item.quantity), colQtyX, valY, { align: 'right' });
      doc.text(formatCurrencyForPdf(item.unitPrice, invoice.currency), colUnitX, valY, {
        align: 'right',
      });
      const discLabel =
        line.itemDiscountAmount > 0
          ? item.discountType === 'fixed'
            ? `-${formatCurrencyForPdf(line.itemDiscountAmount, invoice.currency)}`
            : `-${item.discountValue ?? 0}%`
          : '-';
      doc.text(discLabel, colDiscX, valY, { align: 'right' });
      const effectiveRate = resolveEffectiveTaxRate(item.taxRate, invoice.invoiceTaxRate ?? 0);
      doc.text(effectiveRate > 0 ? `${effectiveRate}%` : '0%', colTaxX, valY, {
        align: 'right',
      });

      doc.setFont(font, 'bold');
      doc.text(formatCurrencyForPdf(line.lineTotal, invoice.currency), colTotalX, valY, {
        align: 'right',
      });

      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight - 1, pageWidth - marginX, y + rowHeight - 1);
      y += rowHeight;
    }
  }

  y += 6;

  // Totals block
  const summaryRowsNeeded = 28 + totals.taxBreakdown.length * 5;
  ensureSpace(summaryRowsNeeded);

  const summaryLeftX = pageWidth - marginX - 72;
  const summaryRightX = pageWidth - marginX;

  doc.setDrawColor(226, 232, 240);
  doc.line(summaryLeftX, y, summaryRightX, y);
  y += 5;

  const drawSummaryRow = (label: string, value: string, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, summaryLeftX, y);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, summaryRightX, y, { align: 'right' });
    y += 5;
  };

  if (totals.itemDiscountTotal > 0) {
    drawSummaryRow('Item Discounts', `-${formatCurrencyForPdf(totals.itemDiscountTotal, invoice.currency)}`, [4, 120, 87]);
  }
  drawSummaryRow('Subtotal', formatCurrencyForPdf(totals.subtotal, invoice.currency), [15, 23, 42]);

  if (totals.discountAmount > 0) {
    const discTag =
      invoice.discountType === 'percent' ? `Discount (${invoice.discountValue}%)` : 'Discount';
    drawSummaryRow(discTag, `-${formatCurrencyForPdf(totals.discountAmount, invoice.currency)}`, [4, 120, 87]);
  }

  if (totals.taxBreakdown.length > 0) {
    for (const tb of totals.taxBreakdown) {
      const taxLabel =
        totals.taxTreatment === 'tax_inclusive'
          ? `Included Tax (${tb.rate}%)`
          : `Tax (${tb.rate}%)`;
      drawSummaryRow(taxLabel, formatCurrencyForPdf(tb.taxAmount, invoice.currency), [15, 23, 42]);
    }
  } else {
    drawSummaryRow('Tax', formatCurrencyForPdf(totals.taxTotal, invoice.currency), [15, 23, 42]);
  }

  doc.setDrawColor(hr, hg, hb);
  doc.setLineWidth(0.5);
  doc.line(summaryLeftX, y - 1, summaryRightX, y - 1);
  doc.setLineWidth(0.3);
  y += 4;

  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total', summaryLeftX, y);
  doc.setTextColor(hr, hg, hb);
  doc.text(formatCurrencyForPdf(totals.grandTotal, invoice.currency), summaryRightX, y, {
    align: 'right',
  });
  y += 8;

  // Accepted Payment Options
  const acceptedAccounts = resolveInvoicePaymentAccounts(invoice, paymentAccounts);
  if (acceptedAccounts.length > 0) {
    ensureSpace(16 + Math.ceil(acceptedAccounts.length / 2) * 11);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;

    doc.setFont(font, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ACCEPTED PAYMENT METHODS', marginX, y);

    const directUrl =
      invoice.paymentLink || buildDirectPaymentUrl(invoice.invoiceNumber, undefined, invoice.shareToken);
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(hr, hg, hb);
    doc.text(directUrl, pageWidth - marginX, y, { align: 'right', maxWidth: 110 });
    y += 4.5;

    const colW = (contentWidth - 4) / 2;
    for (let i = 0; i < acceptedAccounts.length; i += 2) {
      ensureSpace(12);
      for (let col = 0; col < 2; col++) {
        const acc = acceptedAccounts[i + col];
        if (!acc) continue;
        const bx = marginX + col * (colW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, y, colW, 10, 1.2, 1.2, 'FD');

        doc.setFont(font, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(acc.providerName, bx + 2.5, y + 4.2, { maxWidth: colW - 5 });

        doc.setFont(font, 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        doc.text(acc.accountIdentifier, bx + 2.5, y + 8, { maxWidth: colW - 5 });
      }
      y += 12;
    }
    y += 2;
  }

  // Notes / Instructions / Terms (Note: internalNotes is intentionally NEVER printed in PDF)
  const addBlocks = [
    { label: 'PAYMENT INSTRUCTIONS', text: invoice.additional.paymentInstructions },
    { label: 'BANK DETAILS', text: invoice.additional.bankDetails },
    { label: 'NOTES', text: invoice.additional.notes },
    { label: 'TERMS & CONDITIONS', text: invoice.additional.terms },
  ].filter((b) => Boolean(b.text && b.text.trim()));

  if (addBlocks.length > 0) {
    ensureSpace(18);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;

    for (const block of addBlocks) {
      const lines = doc.splitTextToSize(block.text.trim(), contentWidth);
      ensureSpace(6 + lines.length * 4);
      doc.setFont(font, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(block.label, marginX, y);
      y += 3.8;
      doc.setFont(font, 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, marginX, y);
      y += lines.length * 3.8 + 3;
    }
  }

  // Full-Page Signatures & Stamps Overlay on Final Page
  const authElements = getInvoiceAuthElements(invoice)
    .filter((el) => el.enabled && el.dataUrl)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (authElements.length > 0) {
    // If very close to bottom with no room for bottom-zone seals/signatures, advance to clean final page
    const hasBottomZoneElements = authElements.some((el) => el.y >= 65);
    if (hasBottomZoneElements && y > pageHeight - 54) {
      doc.addPage();
      y = 20;
    }

    const contentFloorY = y + 4;
    for (const el of authElements) {
      const raster = await rasterizeDataUrlToPng(el.dataUrl, el.opacity, el.rotation);
      if (!raster) continue;

      const mmWidth = Math.max(18, Math.min(68, (el.width / 794) * contentWidth));
      const aspect = raster.height / Math.max(1, raster.width);
      const mmHeight =
        el.kind === 'stamp'
          ? Math.min(48, Math.max(16, mmWidth * aspect))
          : Math.max(10, Math.min(34, mmWidth * aspect));

      const targetX = Math.max(
        marginX,
        Math.min(pageWidth - marginX - mmWidth, marginX + (el.x / 100) * contentWidth)
      );

      let desiredY = Math.max(
        22,
        Math.min(pageHeight - 24 - mmHeight, (el.y / 100) * (pageHeight - 36))
      );

      // Prevent bottom-zone default signatures/stamps from overlapping trailing line items/notes
      if (el.y >= 65 && desiredY < contentFloorY && contentFloorY + mmHeight + 8 <= pageHeight - 20) {
        desiredY = contentFloorY;
      }

      doc.addImage(raster.dataUrl, 'PNG', targetX, desiredY, mmWidth, mmHeight);

      if (el.label) {
        doc.setFont(font, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        if (el.kind === 'signature') {
          doc.setDrawColor(148, 163, 184);
          doc.line(targetX, desiredY + mmHeight + 1.2, targetX + mmWidth, desiredY + mmHeight + 1.2);
        }
        doc.text(el.label.toUpperCase(), targetX, desiredY + mmHeight + 4.5, {
          maxWidth: mmWidth + 8,
        });
      }
    }
  }

  // Page Footers across all generated pages
  const totalPages = doc.getNumberOfPages();
  if (invoice.design.footerStyle !== 'hidden') {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const fy = pageHeight - 10;
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, fy - 4, pageWidth - marginX, fy - 4);
      doc.setFont(font, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const footerMsg =
        invoice.additional.footerMessage ||
        `${invoice.business.name || 'Universal Invoice Generator'} · Thank you for your business.`;
      doc.text(footerMsg, marginX, fy, { maxWidth: contentWidth - 40 });
      if (invoice.design.footerStyle === 'detailed') {
        doc.text(
          `${invoice.invoiceNumber || 'INVOICE'} · Page ${p} of ${totalPages}`,
          pageWidth - marginX,
          fy,
          { align: 'right' }
        );
      }
    }
  }

  const safeNum = (invoice.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]+/g, '-');
  return {
    doc,
    filename: `${safeNum}.pdf`,
  };
}

export async function generateInvoicePdfBlob(
  invoice: Invoice,
  dateFormat: DateFormatOption = 'DD MMM YYYY',
  paymentAccounts: ConnectedPaymentAccount[] = []
): Promise<GeneratedPdfResult> {
  const { doc, filename } = await buildInvoicePdfDocument(invoice, dateFormat, paymentAccounts);
  const blob = doc.output('blob');
  return {
    blob,
    filename,
  };
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  dateFormat: DateFormatOption = 'DD MMM YYYY',
  paymentAccounts: ConnectedPaymentAccount[] = []
): Promise<string> {
  const { blob, filename } = await generateInvoicePdfBlob(invoice, dateFormat, paymentAccounts);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return filename;
}
