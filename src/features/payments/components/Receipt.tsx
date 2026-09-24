import { useState, useRef } from 'react';
import { ReceiptData } from '@/features/attendance/types/dayPayment';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import html2canvas from 'html2canvas-pro';
import { toast } from 'sonner';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { logActivity } from '@/shared/utils/auditLogger';

type Row = { h: number; draw: (c: CanvasRenderingContext2D, y: number) => void };

const formatSafeDate = (d: unknown, pattern = 'MMM dd, yyyy'): string => {
  if (!d) return format(new Date(), pattern);
  try {
    let dateObj: Date;
    if (typeof d === 'object' && d !== null) {
      if ('toDate' in d && typeof (d as any).toDate === 'function') {
        dateObj = (d as any).toDate();
      } else if ('seconds' in d && typeof (d as any).seconds === 'number') {
        dateObj = new Date((d as any).seconds * 1000);
      } else if ('_seconds' in d && typeof (d as any)._seconds === 'number') {
        dateObj = new Date((d as any)._seconds * 1000);
      } else if (d instanceof Date) {
        dateObj = d;
      } else {
        dateObj = new Date(String(d));
      }
    } else if (typeof d === 'string' || typeof d === 'number') {
      dateObj = new Date(d);
    } else {
      dateObj = new Date();
    }
    if (isNaN(dateObj.getTime())) {
      return format(new Date(), pattern);
    }
    return format(dateObj, pattern);
  } catch {
    return format(new Date(), pattern);
  }
};

function renderReceiptCanvas(receipt: ReceiptData): HTMLCanvasElement {
  const WIDTH = 640;
  const PAD = 40;
  const CONTENT_W = WIDTH - PAD * 2;
  const SCALE = 2;

  const measure = document.createElement('canvas').getContext('2d')!;

  const ink = '#111827';
  const gray = '#4b5563';
  const light = '#6b7280';
  const faint = '#9ca3af';
  const line = '#e5e7eb';
  const bgSoft = '#f9fafb';
  const bgTable = '#f3f4f6';
  const emerald = '#047857';
  const emeraldSoft = '#d1fae5';
  const emeraldBorder = '#a7f3d0';
  const orange = '#c2410c';
  const orangeSoft = '#fff7ed';
  const orangeBorder = '#fed7aa';
  const purpleSoft = '#f3e8ff';
  const purple = '#6d28d9';

  const font = (size: number, weight = '400') =>
    `${weight} ${size}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
  const fmt = (c: CanvasRenderingContext2D, size: number, weight = '400') => {
    c.font = font(size, weight);
  };

  const wrapText = (c: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    fmt(c, 13);
    const words = String(text || '').split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (!word) continue;
      const test = current ? `${current} ${word}` : word;
      if (current && c.measureText(test).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  };

  const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (typeof (c as any).roundRect === 'function') {
      c.beginPath();
      (c as any).roundRect(x, y, w, h, r);
      c.closePath();
      return;
    }
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  const statusLabel = (s?: string) =>
    s === 'paid' ? 'Full' : s === 'partial' ? 'Partial' : s === 'no-class' ? 'No Class' : 'Unpaid';
  const statusColor = (s?: string) =>
    s === 'paid' ? emerald : s === 'partial' ? orange : s === 'no-class' ? purple : gray;
  const statusBg = (s?: string) =>
    s === 'paid' ? emeraldSoft : s === 'partial' ? orangeSoft : s === 'no-class' ? purpleSoft : bgTable;

  const rows: Row[] = [];

  // Header
  rows.push({
    h: 128,
    draw: (c, y) => {
      c.textAlign = 'center';
      fmt(c, 30, '700');
      c.fillStyle = ink;
      c.fillText('Tutor Track', WIDTH / 2, y + 34);
      fmt(c, 14, '500');
      c.fillStyle = gray;
      c.fillText('Payment Receipt', WIDTH / 2, y + 58);
      fmt(c, 12);
      c.fillStyle = faint;
      c.fillText(`Receipt #: ${receipt.receiptNumber || 'N/A'}`, WIDTH / 2, y + 80);
      c.strokeStyle = line;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(PAD, y + 100);
      c.lineTo(WIDTH - PAD, y + 100);
      c.stroke();
    },
  });

  // Student & date
  rows.push({
    h: 62,
    draw: (c, y) => {
      c.textAlign = 'left';
      fmt(c, 11, '600');
      c.fillStyle = light;
      c.fillText('STUDENT NAME', PAD, y + 16);
      fmt(c, 16, '600');
      c.fillStyle = ink;
      c.fillText(receipt.tuteeName || 'Student', PAD, y + 42);
      c.textAlign = 'right';
      fmt(c, 11, '600');
      c.fillStyle = light;
      c.fillText('PAYMENT DATE', WIDTH - PAD, y + 16);
      fmt(c, 16, '600');
      c.fillStyle = ink;
      c.fillText(formatSafeDate(receipt.paymentDate), WIDTH - PAD, y + 42);
    },
  });

  // Payment details box
  const days = receipt.daysPaid && receipt.daysPaid.length > 0 ? receipt.daysPaid : null;
  const boxH = days ? 38 + days.length * 38 : 56;
  rows.push({
    h: 28 + boxH,
    draw: (c, y) => {
      c.textAlign = 'left';
      fmt(c, 11, '600');
      c.fillStyle = light;
      c.fillText('PAYMENT DETAILS', PAD, y + 16);

      const boxTop = y + 30;
      c.fillStyle = bgSoft;
      roundRect(c, PAD, boxTop, CONTENT_W, boxH, 8);
      c.fill();
      c.strokeStyle = line;
      c.lineWidth = 1;
      roundRect(c, PAD, boxTop, CONTENT_W, boxH, 8);
      c.stroke();

      if (!days) {
        fmt(c, 13, '500');
        c.fillStyle = gray;
        c.fillText('Monthly Tuition Payment', PAD + 16, boxTop + 33);
        return;
      }

      // Header row
      c.fillStyle = bgTable;
      roundRect(c, PAD, boxTop, CONTENT_W, 34, 8);
      c.fill();
      c.fillRect(PAD, boxTop + 20, CONTENT_W, 14); // square bottom corners of header
      fmt(c, 10, '600');
      c.fillStyle = gray;
      const dueR = PAD + CONTENT_W * 0.38;
      const paidR = PAD + CONTENT_W * 0.70;
      const statusR = WIDTH - PAD - 14;
      c.textAlign = 'left';
      c.fillText('DATE', PAD + 14, boxTop + 22);
      c.textAlign = 'right';
      c.fillText('AMOUNT DUE', dueR - 10, boxTop + 22);
      c.fillText('AMOUNT PAID', paidR - 10, boxTop + 22);
      c.fillText('STATUS', statusR, boxTop + 22);

      days.forEach((day, i) => {
        const ry = boxTop + 34 + i * 38;
        if (i > 0) {
          c.strokeStyle = line;
          c.beginPath();
          c.moveTo(PAD, ry);
          c.lineTo(WIDTH - PAD, ry);
          c.stroke();
        }
        fmt(c, 13, '500');
        c.fillStyle = ink;
        c.textAlign = 'left';
        c.fillText(formatSafeDate(day.date), PAD + 14, ry + 24);
        fmt(c, 12);
        c.fillStyle = gray;
        c.textAlign = 'right';
        c.fillText(formatCurrency(day.amountDue || 0), dueR - 10, ry + 24);
        fmt(c, 12, '600');
        c.fillStyle = ink;
        c.fillText(formatCurrency(day.amountPaid || 0), paidR - 10, ry + 24);

        // Status badge
        const label = statusLabel(day.status);
        const badgeW = Math.max(c.measureText(label).width + 22, 56);
        c.fillStyle = statusBg(day.status);
        roundRect(c, statusR - badgeW, ry + 7, badgeW, 20, 5);
        c.fill();
        c.fillStyle = statusColor(day.status);
        c.textAlign = 'right';
        fmt(c, 11, '600');
        c.fillText(label, statusR - 11, ry + 21);
      });
    },
  });

  // Total
  rows.push({
    h: 74,
    draw: (c, y) => {
      c.strokeStyle = line;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(PAD, y);
      c.lineTo(WIDTH - PAD, y);
      c.stroke();
      c.textAlign = 'left';
      fmt(c, 18, '600');
      c.fillStyle = ink;
      c.fillText('Total Amount Paid', PAD, y + 40);
      fmt(c, 26, '700');
      c.fillStyle = emerald;
      c.textAlign = 'right';
      c.fillText(formatCurrency(receipt.totalAmount || 0), WIDTH - PAD, y + 42);
    },
  });

  // Method + type
  rows.push({
    h: 66,
    draw: (c, y) => {
      c.textAlign = 'left';
      fmt(c, 11, '600');
      c.fillStyle = light;
      c.fillText('PAYMENT METHOD', PAD, y + 18);
      fmt(c, 15, '600');
      c.fillStyle = ink;
      c.fillText(receipt.paymentMethod || 'Cash', PAD, y + 44);

      const isFull = receipt.coverageType === 'full';
      const label = isFull ? 'Full Payment' : 'Partial Payment';
      fmt(c, 12, '700');
      const badgeW = c.measureText(label).width + 26;
      c.fillStyle = isFull ? emeraldSoft : orangeSoft;
      c.strokeStyle = isFull ? emeraldBorder : orangeBorder;
      c.lineWidth = 1;
      roundRect(c, WIDTH - PAD - badgeW, y + 20, badgeW, 26, 8);
      c.fill();
      c.stroke();
      c.fillStyle = isFull ? emerald : orange;
      c.textAlign = 'center';
      c.fillText(label, WIDTH - PAD - badgeW / 2, y + 38);

      c.textAlign = 'right';
      fmt(c, 11, '600');
      c.fillStyle = light;
      c.fillText('PAYMENT TYPE', WIDTH - PAD, y + 16);
    },
  });

  // Notes
  if (receipt.notes) {
    const noteLines = wrapText(measure, receipt.notes, CONTENT_W - 24);
    const notesH = 26 + noteLines.length * 22 + 14;
    rows.push({
      h: notesH,
      draw: (c, y) => {
        c.textAlign = 'left';
        fmt(c, 11, '600');
        c.fillStyle = light;
        c.fillText('NOTES', PAD, y + 16);
        c.fillStyle = bgSoft;
        roundRect(c, PAD, y + 26, CONTENT_W, notesH - 26, 8);
        c.fill();
        c.strokeStyle = line;
        c.lineWidth = 1;
        roundRect(c, PAD, y + 26, CONTENT_W, notesH - 26, 8);
        c.stroke();
        fmt(c, 13);
        c.fillStyle = gray;
        noteLines.forEach((ln, i) => c.fillText(ln, PAD + 12, y + 26 + 22 + i * 22));
      },
    });
  }

  // Footer
  rows.push({
    h: 74,
    draw: (c, y) => {
      c.strokeStyle = line;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(PAD, y);
      c.lineTo(WIDTH - PAD, y);
      c.stroke();
      c.textAlign = 'center';
      fmt(c, 12);
      c.fillStyle = light;
      c.fillText('Thank you for your payment!', WIDTH / 2, y + 26);
      fmt(c, 11);
      c.fillStyle = faint;
      c.fillText(`Generated on ${formatSafeDate(new Date(), 'MMM dd, yyyy HH:mm')}`, WIDTH / 2, y + 48);
    },
  });

  const totalHeight = PAD + rows.reduce((sum, r) => sum + r.h, 0) + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = totalHeight * SCALE;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  // Outer border card
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 16, 16, WIDTH - 32, totalHeight - 32, 12);
  ctx.stroke();

  let cursor = PAD;
  for (const row of rows) {
    row.draw(ctx, cursor);
    cursor += row.h;
  }

  return canvas;
}

interface ReceiptProps {
  receipt: ReceiptData;
  onClose: () => void;
}

export const Receipt = ({ receipt, onClose }: ReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadReceipt = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const safeNumber = receipt.receiptNumber ? String(receipt.receiptNumber).replace(/[^a-zA-Z0-9_-]/g, '_') : 'receipt';
    const filename = `receipt_${safeNumber}.png`;

    try {
      let blob: Blob | null = null;

      // Method 1: Pixel-perfect high-DPI canvas generator (instant, 0 CORS / CSS stylesheet issues)
      try {
        const canvas = renderReceiptCanvas(receipt);
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png');
        });
      } catch (canvasErr) {
        console.warn('Direct canvas render failed, falling back to html-to-image:', canvasErr);
      }

      // Method 2: html-to-image on the DOM node
      if (!blob && receiptRef.current) {
        try {
          const { toBlob } = await import('html-to-image');
          blob = await toBlob(receiptRef.current, {
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true,
            cacheBust: true,
          });
        } catch (htmlErr) {
          console.warn('html-to-image failed, falling back to html2canvas-pro:', htmlErr);
        }
      }

      // Method 3: html2canvas-pro on the DOM node
      if (!blob && receiptRef.current) {
        try {
          const canvas = await html2canvas(receiptRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
          });
          blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/png');
          });
        } catch (h2cErr) {
          console.warn('html2canvas-pro failed:', h2cErr);
        }
      }

      if (!blob) {
        throw new Error('Failed to generate receipt image');
      }

      // Trigger file download via Blob URL
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast.success('Receipt downloaded successfully!');

      // Audit log in background
      if (user) {
        logActivity(
          user.id,
          user.name,
          user.role,
          'Receipt Generated',
          'Billing',
          `Downloaded receipt #${receipt.receiptNumber || 'N/A'} of ₱${receipt.totalAmount || 0} for student ${receipt.tuteeName || 'Student'}`
        ).catch((err) => console.error('Error logging audit activity:', err));
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
      const reason = error instanceof Error ? error.message : String(error);
      toast.error(`Could not generate the receipt image${reason ? `: ${reason}` : ''}. Please try again.`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Topbar Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-emerald-700" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Payment Receipt</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Receipt #{receipt.receiptNumber || 'N/A'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light p-1 shrink-0 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-3 sm:p-8 bg-white overflow-y-auto flex-1">
          <div ref={receiptRef} className="border border-gray-200 sm:border-2 rounded-xl p-4 sm:p-8 bg-white shadow-xs">
            {/* Brand Header */}
            <div className="text-center mb-5 sm:mb-8 pb-4 sm:pb-6 border-b sm:border-b-2 border-gray-200">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Tutor Track</h1>
              <p className="text-gray-600 text-xs sm:text-sm font-medium">Payment Receipt</p>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 sm:mt-2">Receipt #: {receipt.receiptNumber || 'N/A'}</p>
            </div>

            {/* Student & Payment Info */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-5 sm:mb-8">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Student Name</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900 truncate">{receipt.tuteeName || 'Student'}</p>
              </div>
              <div className="text-right min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Payment Date</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                  {formatSafeDate(receipt.paymentDate)}
                </p>
              </div>
            </div>

            {/* Payment Details */}
            <div className="mb-5 sm:mb-6">
              <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-4">Payment Details</p>
              <div className="bg-gray-50 rounded-lg overflow-x-auto border border-gray-200">
                {receipt.daysPaid && receipt.daysPaid.length > 0 ? (
                  <table className="w-full min-w-[300px] sm:min-w-full text-left">
                    <thead className="bg-gray-100/90 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-2.5 sm:p-3 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Date</th>
                        <th className="py-2 px-2.5 sm:p-3 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider text-right whitespace-nowrap">Amount Due</th>
                        <th className="py-2 px-2.5 sm:p-3 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider text-right whitespace-nowrap">Amount Paid</th>
                        <th className="py-2 px-2.5 sm:p-3 text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider text-right whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {receipt.daysPaid.map((day, index) => (
                        <tr key={index} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-2.5 px-2.5 sm:p-3 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                            {formatSafeDate(day.date)}
                          </td>
                          <td className="py-2.5 px-2.5 sm:p-3 text-xs sm:text-sm text-right text-gray-600 whitespace-nowrap">
                            {formatCurrency(day.amountDue || 0)}
                          </td>
                          <td className="py-2.5 px-2.5 sm:p-3 text-xs sm:text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(day.amountPaid || 0)}
                          </td>
                          <td className="py-2.5 px-2.5 sm:p-3 text-right whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded ${
                              day.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              day.status === 'partial' ? 'bg-orange-100 text-orange-700' :
                              day.status === 'no-class' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {day.status === 'paid' ? 'Full' : day.status === 'partial' ? 'Partial' : day.status === 'no-class' ? 'No Class' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-3 sm:p-4 text-xs sm:text-sm text-gray-700 font-medium">
                    Monthly Tuition Payment
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="border-t sm:border-t-2 border-gray-200 pt-3 sm:pt-4 mb-5 sm:mb-6">
              <div className="flex justify-between items-center gap-2">
                <p className="text-sm sm:text-lg font-semibold text-gray-900">Total Amount Paid</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-700">{formatCurrency(receipt.totalAmount || 0)}</p>
              </div>
            </div>

            {/* Payment Info Grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-5 sm:mb-6">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Payment Method</p>
                <p className="text-xs sm:text-sm text-gray-900 font-semibold">{receipt.paymentMethod || 'Cash'}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Payment Type</p>
                <span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-lg border ${
                  receipt.coverageType === 'full'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-orange-50 border-orange-200 text-orange-700'
                }`}>
                  {receipt.coverageType === 'full' ? 'Full Payment' : 'Partial Payment'}
                </span>
              </div>
            </div>

            {/* Notes */}
            {receipt.notes && (
              <div className="mb-5 sm:mb-6">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Notes</p>
                <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2.5 sm:p-3 rounded-lg break-words border border-gray-100">{receipt.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-4 sm:pt-6 border-t border-gray-200">
              <p className="text-[11px] sm:text-xs text-gray-500">Thank you for your payment!</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                Generated on {formatSafeDate(new Date(), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 sm:p-6 border-t border-gray-200 flex gap-2 sm:gap-3 bg-white shrink-0">
          <button
            onClick={downloadReceipt}
            disabled={isDownloading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-green-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:bg-green-800 disabled:opacity-60 shadow-md sm:shadow-lg shadow-green-700/20 transition-all text-xs sm:text-base font-medium cursor-pointer disabled:cursor-not-allowed"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin sm:w-5 sm:h-5" /> : <Download size={16} className="sm:w-5 sm:h-5" />}
            <span>{isDownloading ? 'Generating...' : 'Download Receipt'}</span>
          </button>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="flex-1 bg-gray-100 text-gray-700 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:bg-gray-200 transition-all text-xs sm:text-base font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

