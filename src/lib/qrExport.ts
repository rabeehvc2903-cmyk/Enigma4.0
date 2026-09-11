import QRCode from 'qrcode';
import JSZip from 'jszip';
import { UserProfile, BrandingConfig } from '../types';
import { getEnigmaPrintHeaderHtml, getEnigmaPrintFooterHtml } from '../components/EnigmaPrintTemplate';
import { formatParticipantFullName } from './store';

export interface QrExportOptions {
  includeLabel?: boolean; // Label with Chest No & Name underneath QR in JPG
  qrColor?: string;
  bgColor?: string;
  size?: number; // QR code resolution (e.g. 512px)
  imageFormat?: 'jpg' | 'png'; // Default: 'jpg'
  namingFormat?: 'chestNoOnly' | 'full'; // Default: 'chestNoOnly' (e.g. "101.jpg")
  onProgress?: (current: number, total: number, currentItemName: string) => void;
}

/**
 * Generates a DataURL (JPG or PNG) for a participant's QR code.
 * Optionally draws a clean bottom label with Chest No and Name.
 */
export const generateParticipantQrImageDataUrl = async (
  participant: UserProfile,
  options: QrExportOptions = {}
): Promise<string> => {
  const qrSize = options.size || 512;
  const qrData = String(participant.userId || participant.chestNo || participant.id || 'N/A');
  const imageFormat = options.imageFormat || 'jpg';
  const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
  const quality = 0.95;

  // 1. Generate base QR Code canvas
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrData, {
    width: qrSize,
    margin: 2,
    color: {
      dark: options.qrColor || '#000000',
      light: options.bgColor || '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  if (!options.includeLabel) {
    if (mimeType === 'image/jpeg') {
      const solidCanvas = document.createElement('canvas');
      solidCanvas.width = qrCanvas.width;
      solidCanvas.height = qrCanvas.height;
      const ctx = solidCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = options.bgColor || '#ffffff';
        ctx.fillRect(0, 0, solidCanvas.width, solidCanvas.height);
        ctx.drawImage(qrCanvas, 0, 0);
        return solidCanvas.toDataURL('image/jpeg', quality);
      }
    }
    return qrCanvas.toDataURL(mimeType, quality);
  }

  // 2. Create composite labeled canvas (with card header / footer)
  const labelHeight = Math.round(qrSize * 0.38);
  const totalWidth = qrSize;
  const totalHeight = qrSize + labelHeight;

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = totalWidth;
  compositeCanvas.height = totalHeight;
  const ctx = compositeCanvas.getContext('2d');
  if (!ctx) return qrCanvas.toDataURL(mimeType, quality);

  // Background
  ctx.fillStyle = options.bgColor || '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw QR
  ctx.drawImage(qrCanvas, 0, 0);

  // Divider line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = Math.max(2, Math.round(qrSize * 0.005));
  ctx.beginPath();
  ctx.moveTo(Math.round(totalWidth * 0.04), qrSize);
  ctx.lineTo(Math.round(totalWidth * 0.96), qrSize);
  ctx.stroke();

  // Draw Text Details (Chest No & Full Name - Extra Large & Crisp)
  const rawChest = String(participant.userId || participant.chestNo || 'N/A').trim();
  const chestText = `CHEST NO: ${rawChest}`;
  const nameText = formatParticipantFullName(participant.name, participant.fatherName) || 'Participant';

  // Chest No (Extra Large, Bold & High-Contrast)
  ctx.fillStyle = '#6b21a8'; // Premium purple
  let chestFontSize = Math.round(qrSize * 0.115);
  ctx.font = `bold ${chestFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxChestWidth = totalWidth - Math.round(qrSize * 0.08);
  while (ctx.measureText(chestText).width > maxChestWidth && chestFontSize > Math.round(qrSize * 0.05)) {
    chestFontSize -= 2;
    ctx.font = `bold ${chestFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
  ctx.fillText(chestText, totalWidth / 2, qrSize + Math.round(labelHeight * 0.32));

  // Full Name (Extra Large, Deep Slate 900 with dynamic scaling)
  ctx.fillStyle = '#0f172a'; // Slate 900
  let nameFontSize = Math.round(qrSize * 0.11);
  ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const maxAllowedWidth = totalWidth - Math.round(qrSize * 0.08);
  while (ctx.measureText(nameText).width > maxAllowedWidth && nameFontSize > Math.round(qrSize * 0.05)) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
  ctx.fillText(nameText, totalWidth / 2, qrSize + Math.round(labelHeight * 0.72));

  return compositeCanvas.toDataURL(mimeType, quality);
};

// Backward-compatible alias for existing callers
export const generateParticipantQrPngDataUrl = generateParticipantQrImageDataUrl;

/**
 * Generates and downloads a ZIP archive containing PNG QR codes for all given profiles.
 */
export const downloadBulkQrZip = async (
  profiles: UserProfile[],
  filenamePrefix: string = 'festival_participant_qr_codes',
  options: QrExportOptions = {}
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!profiles || profiles.length === 0) {
    return { success: false, count: 0, error: 'No profiles available to export.' };
  }

  try {
    const zip = new JSZip();
    const qrFolder = zip.folder('QR_Codes') || zip;
    const total = profiles.length;

    const namingFormat = options.namingFormat || 'chestNoOnly';
    const imageFormat = options.imageFormat || 'jpg';
    const fileExt = imageFormat === 'png' ? 'png' : 'jpg';
    const usedFileNames = new Set<string>();

    for (let i = 0; i < total; i++) {
      const p = profiles[i];
      // Clean chest no (userId or chestNo)
      const rawChestNo = String(p.userId || p.chestNo || `ID_${i + 1}`).trim();
      const safeChestNo = rawChestNo.replace(/[^a-zA-Z0-9_-]/g, '_') || `ID_${i + 1}`;
      
      let baseName = safeChestNo;
      if (namingFormat === 'full') {
        const safeName = String(p.name || 'Participant').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeGroup = String(p.groupName || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
        baseName = `${safeChestNo}_${safeName}_${safeGroup}`;
      }

      let fileName = `${baseName}.${fileExt}`;
      if (usedFileNames.has(fileName.toLowerCase())) {
        let duplicateCounter = 2;
        while (usedFileNames.has(`${baseName}_(${duplicateCounter}).${fileExt}`.toLowerCase())) {
          duplicateCounter++;
        }
        fileName = `${baseName}_(${duplicateCounter}).${fileExt}`;
      }
      usedFileNames.add(fileName.toLowerCase());

      if (options.onProgress) {
        options.onProgress(i + 1, total, `${rawChestNo} - ${p.name || 'Participant'}`);
      }

      const dataUrl = await generateParticipantQrImageDataUrl(p, { ...options, imageFormat });
      // Remove data:image/(jpeg|jpg|png);base64,
      const base64Data = dataUrl.replace(/^data:image\/(?:jpeg|jpg|png);base64,/, '');
      qrFolder.file(fileName, base64Data, { base64: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}_${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, count: total };
  } catch (err: unknown) {
    console.error('Bulk QR ZIP generation error:', err);
    return { success: false, count: 0, error: (err as Error)?.message || 'Failed to generate ZIP archive.' };
  }
};

/**
 * Opens a printable multi-badge HTML sheet ready for printing or saving to PDF.
 */
export const openPrintableQrSheet = async (
  profiles: UserProfile[],
  branding?: BrandingConfig
) => {
  if (!profiles || profiles.length === 0) {
    alert('No participants found to print QR badges.');
    return;
  }

  // Pre-generate QR code data URLs for all participants
  const cardsHtmlPromises = profiles.map(async (p) => {
    const qrData = String(p.userId || p.chestNo || p.id || '000');
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 280,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    return `
      <div class="qr-card">
        <div class="card-header">
          <div class="fest-title">${branding?.title || 'FESTIVAL DESK'}</div>
          <div class="chest-badge">${p.userId || p.chestNo || '000'}</div>
        </div>

        <div class="card-body">
          <div class="qr-box">
            <img src="${qrDataUrl}" alt="QR Code" class="qr-img" />
          </div>

          <div class="part-info">
            <div class="part-name">${p.name || 'Participant'}${p.fatherName ? ` <span class="father-name">${p.fatherName}</span>` : ''}</div>
            <div class="part-group">${p.groupName || 'Unassigned Team'}</div>
            <div class="part-meta">
              <span>Level: ${p.department ? p.department.replace(/^Level\s+/i, '') : '1'}</span>
              <span>•</span>
              <span>${p.category || 'General'}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span>OFFICIAL PARTICIPANT BADGE</span>
        </div>
      </div>
    `;
  });

  const cardsHtmlArray = await Promise.all(cardsHtmlPromises);
  const cardsHtml = cardsHtmlArray.join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocked. Please allow pop-ups for this site to print QR badge sheets.');
    return;
  }

  const printDoc = printWindow.document;
  printDoc.open();
  printDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Participant QR Code Badges - ${branding?.title || 'Festival'}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #f8fafc;
          color: #0f172a;
          padding: 16px;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e2e8f0;
        }
        .header-title {
          font-size: 18px;
          font-weight: 800;
          color: #581c87;
        }
        .header-subtitle {
          font-size: 12px;
          color: #64748b;
        }
        .print-btn {
          background: #7c3aed;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: white;
            padding: 0;
          }
          .header-bar {
            display: none !important;
          }
          .grid-container {
            grid-template-columns: repeat(2, 1fr);
            gap: 10mm;
          }
          .qr-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
        .qr-card {
          background: white;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          min-height: 180px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.5px solid #f1f5f9;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .fest-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b21a8;
        }
        .chest-badge {
          background: #f3e8ff;
          color: #6b21a8;
          border: 1.5px solid #d8b4fe;
          padding: 4px 12px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        .card-body {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .qr-box {
          width: 96px;
          height: 96px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 4px;
          background: #ffffff;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qr-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .part-info {
          flex: 1;
          min-width: 0;
        }
        .part-name {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
          margin-bottom: 4px;
        }
        .father-name {
          font-weight: 700;
          color: #64748b;
          font-size: 15px;
        }
        .part-group {
          font-size: 13px;
          font-weight: 700;
          color: #7c3aed;
          margin-bottom: 4px;
        }
        .part-meta {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .card-footer {
          margin-top: 8px;
          padding-top: 4px;
          border-top: 1px dashed #e2e8f0;
          text-align: center;
          font-size: 8px;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 1px;
        }
      </style>
    </head>
    <body>
      <div class="header-bar">
        <div>
          <div class="header-title">${branding?.title || 'Festival Desk'} — Participant QR Badges</div>
          <div class="header-subtitle">Total: ${profiles.length} Participant Badges • Ready for Print / Save as PDF</div>
        </div>
        <button onclick="window.print()" class="print-btn">Print Badges / Save PDF</button>
      </div>

      <div style="max-width: 1000px; margin: 0 auto; min-height: 95vh; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          ${getEnigmaPrintHeaderHtml('ENIGMA ‘26', `<span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">PARTICIPANT ID BADGES</span>`)}
          <div class="grid-container">
            ${cardsHtml}
          </div>
        </div>
        ${getEnigmaPrintFooterHtml('MIASIN ZOR', 'Festival collective', 1)}
      </div>
    </body>
    </html>
  `);
  printDoc.close();
};
