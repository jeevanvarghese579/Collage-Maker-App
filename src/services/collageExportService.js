import JSZip from 'jszip';
import { mmToPx, downloadBlob, todayStamp, clamp } from '@/utils';
import {
  A4_WIDTH_MM,
  DEFAULT_DPI,
  PHOTO_RATIO_W,
  PHOTO_RATIO_H,
  MAX_CANVAS_DIMENSION,
  DEFAULT_JPEG_QUALITY,
} from '@/constants';
import { getBlob } from '@/db/blobs';

// Load an image blob/bitmap for canvas drawing.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function loadFontStack(family) {
  return `${family}, Inter, system-ui, sans-serif`;
}

// Compute the per-card layout dimensions in pixels for a given config.
export function computeCardLayout(config, dpi, detailsHeightPx) {
  const canvasWidthPx = mmToPx(A4_WIDTH_MM, dpi);
  const marginPx = mmToPx(config.outerMargin, dpi);
  const hSpacingPx = mmToPx(config.horizontalSpacing, dpi);
  const usableWidth = canvasWidthPx - marginPx * 2;
  const cols = clamp(config.columns, 1, 12);
  const cardWidth = Math.floor(
    (usableWidth - hSpacingPx * (cols - 1)) / cols
  );
  // Photo is 3:4 ratio.
  const photoHeight = Math.floor((cardWidth * PHOTO_RATIO_H) / PHOTO_RATIO_W);

  const photoBorder = mmToPx(config.photoBorderThickness, dpi);
  const detailBorder = mmToPx(config.detailsBorderThickness, dpi);

  // Use measured pixel height when available; otherwise estimate from field count.
  let detailsHeight;
  if (detailsHeightPx != null) {
    detailsHeight = detailsHeightPx;
  } else {
    const lines = config.detailLines || 4;
    const detailLineHeight = Math.max(
      mmToPx(config.detailsFontSize, dpi),
      mmToPx(7, dpi)
    );
    const nameLineHeight = mmToPx(config.nameFontSize, dpi) + mmToPx(2, dpi);
    detailsHeight = nameLineHeight + detailLineHeight * Math.max(1, lines);
  }

  const cardHeight = photoHeight + photoBorder * 2 + detailsHeight + detailBorder * 2;

  return {
    canvasWidthPx,
    marginPx,
    hSpacingPx,
    cols,
    cardWidth,
    photoHeight,
    detailsHeight,
    photoBorder,
    detailBorder,
    cardHeight,
  };
}

export function estimateCollageSize(studentCount, config, dpi) {
  const L = computeCardLayout(config, dpi);
  const vSpacingPx = mmToPx(config.verticalSpacing, dpi);
  const rows = Math.ceil(studentCount / L.cols);
  const titleHeight = config.pageTitle
    ? mmToPx(config.titleFontSize, dpi) + mmToPx(config.titleSpacing, dpi) * 2
    : 0;
  const height =
    L.marginPx * 2 +
    titleHeight +
    L.cardHeight * rows +
    vSpacingPx * (rows - 1);
  return {
    widthPx: L.canvasWidthPx,
    heightPx: Math.ceil(height),
    widthMm: A4_WIDTH_MM,
    heightMm: (height / dpi) * 25.4,
    rows,
  };
}

// Draw a rounded rect.
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTextLines(ctx, lines, x, y, maxWidth, lineGap, align) {
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  let cy = y;
  for (let i = 0; i < lines.length; i++) {
    const { text, size, bold, color } = lines[i];
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${loadFontStack(ctx.__family || 'Inter')}`;
    ctx.fillStyle = color || '#111111';
    const fit = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.ceil(size * 1.2);
    for (const line of fit) {
      let tx = x;
      if (align === 'center') tx = x + maxWidth / 2;
      else if (align === 'right') tx = x + maxWidth;
      ctx.fillText(line, tx, cy);
      cy += lineHeight;
    }
  }
  return cy;
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [''];
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// Render the full collage to an offscreen canvas, chunked to avoid freezing.
export async function renderCollage({
  students,
  config,
  frameImage = null,
  onProgress = () => {},
  shouldCancel = () => false,
}) {
  const dpi = config.dpi || DEFAULT_DPI;
  const quality = config.imageQuality || DEFAULT_JPEG_QUALITY;

  // Measure the actual max details height across all students so the export
  // matches the live preview (which grows to fit content dynamically).
  const widthLayout = computeCardLayout(config, dpi, 0);
  const measuredDetailsHeight = measureMaxDetailsHeight(students, config, dpi, widthLayout.cardWidth);
  const L = computeCardLayout(config, dpi, measuredDetailsHeight);

  const vSpacingPx = mmToPx(config.verticalSpacing, dpi);
  const rows = Math.ceil(students.length / L.cols);
  const titleHeight = config.pageTitle
    ? mmToPx(config.titleFontSize, dpi) + mmToPx(config.titleSpacing, dpi) * 2
    : 0;
  const heightPx = Math.ceil(
    L.marginPx * 2 + titleHeight + L.cardHeight * rows + vSpacingPx * (rows - 1)
  );

  if (heightPx > MAX_CANVAS_DIMENSION) {
    return {
      tooLarge: true,
      estimated: { widthPx: L.canvasWidthPx, heightPx, rows },
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = L.canvasWidthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  ctx.__family = config.fontFamily || 'Inter';

  // Background (white for JPEG).
  ctx.fillStyle = config.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title.
  let cursorY = L.marginPx;
  if (config.pageTitle) {
    ctx.fillStyle = '#111111';
    ctx.textAlign = config.titleAlign || 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${mmToPx(config.titleFontSize, dpi)}px ${loadFontStack(ctx.__family)}`;
    const titleY = cursorY + mmToPx(config.titleSpacing, dpi);
    let tx = L.marginPx;
    if (config.titleAlign === 'center') tx = canvas.width / 2;
    else if (config.titleAlign === 'right') tx = canvas.width - L.marginPx;
    ctx.fillText(config.pageTitle, tx, titleY);
    cursorY = titleY + mmToPx(config.titleFontSize, dpi) + mmToPx(config.titleSpacing, dpi);
  }

  const radiusPx = mmToPx(config.cornerRadius, dpi);
  const lineGap = mmToPx(1, dpi);

  let drawn = 0;
  for (let i = 0; i < students.length; i++) {
    if (shouldCancel()) {
      return { cancelled: true };
    }
    const s = students[i];
    const col = i % L.cols;
    const row = Math.floor(i / L.cols);
    const x = L.marginPx + col * (L.cardWidth + L.hSpacingPx);
    const y = cursorY + row * (L.cardHeight + vSpacingPx);

    // Frame template (behind card) if enabled and present.
    if (frameImage && config.frameEnabled) {
      const fw = L.cardWidth * (config.frameWidthScale || 1);
      const fh = L.cardHeight * (config.frameHeightScale || 1);
      const fx = x + (config.frameOffsetX || 0) - (fw - L.cardWidth) / 2;
      const fy = y + (config.frameOffsetY || 0) - (fh - L.cardHeight) / 2;
      try {
        ctx.drawImage(frameImage, fx, fy, fw, fh);
      } catch {
        /* ignore frame draw errors */
      }
    }

    // Photo area.
    const photoX = x + L.photoBorder;
    const photoY = y + L.photoBorder;
    const photoW = L.cardWidth - L.photoBorder * 2;
    const photoH = L.photoHeight;

    // Photo border (black by default).
    if (L.photoBorder > 0) {
      ctx.fillStyle = '#000000';
      roundRect(ctx, x, y, L.cardWidth, L.photoHeight + L.photoBorder * 2, radiusPx);
      ctx.fill();
    }

    // Draw photo (cover-fit, 3:4).
    const photoSrc = s.__photoUrl;
    if (photoSrc) {
      try {
        const img = await loadImage(photoSrc);
        // cover
        const ir = img.width / img.height;
        const tr = photoW / photoH;
        let sw = img.width;
        let sh = img.height;
        let sx = 0;
        let sy = 0;
        if (ir > tr) {
          sw = img.height * tr;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / tr;
          sy = (img.height - sh) / 2;
        }
        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, Math.max(0, radiusPx - L.photoBorder));
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
        ctx.restore();
      } catch {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(photoX, photoY, photoW, photoH);
      }
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.save();
      roundRect(ctx, photoX, photoY, photoW, photoH, Math.max(0, radiusPx - L.photoBorder));
      ctx.clip();
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.restore();
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${mmToPx(8, dpi)}px ${loadFontStack(ctx.__family)}`;
      ctx.fillText('No Photo', photoX + photoW / 2, photoY + photoH / 2);
    }

    // Details area.
    const detailY = y + L.photoHeight + L.photoBorder * 2;
    const detailH = L.cardHeight - (L.photoHeight + L.photoBorder * 2);
    const detailX = x + L.detailBorder;
    const detailW = L.cardWidth - L.detailBorder * 2;

    if (L.detailBorder > 0) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = L.detailBorder;
      roundRect(ctx, x, detailY, L.cardWidth, detailH, radiusPx);
      ctx.stroke();
    }

    const lines = buildDetailLines(s, config, dpi);
    drawTextLines(
      ctx,
      lines,
      detailX,
      detailY + L.detailBorder + mmToPx(1.5, dpi),
      detailW,
      lineGap,
      config.textAlign || 'center'
    );

    drawn++;
    if (drawn % 4 === 0) {
      onProgress({ done: drawn, total: students.length });
      // Yield to the event loop to keep the UI responsive.
      await new Promise((r) => requestAnimationFrame(r));
    }
  }
  onProgress({ done: students.length, total: students.length });

  return { canvas, dpi, quality, estimated: { widthPx: L.canvasWidthPx, heightPx, rows } };
}

// Shared detail-entries builder used by both the canvas export and the live
// preview so the two always render the same fields in the same order.
export function getDetailEntries(student, config) {
  const v = config.visibleDetails || {};
  const showLabels = config.showDetailLabels !== false;
  const entries = [];
  if (v.name) entries.push({ text: student.name || '', isName: true });
  const add = (label, value) => {
    if (value === '' || value == null) return;
    entries.push({ text: `${showLabels && label ? label + ': ' : ''}${value}`, isName: false });
  };
  if (v.className) add('Class', student.className);
  if (v.gender) add('', student.gender);
  if (v.admissionNumber) add('Adm', student.admissionNumber);
  if (v.rollNumber) add('Roll', student.rollNumber);
  if (v.category) add('Cat', student.__categoryName);
  if (v.item) add('', student.__itemName);
  if (v.position) add('Pos', student.__position);
  if (v.grade) add('Grade', student.__grade);
  if (v.marks) add('Marks', student.__marks);
  return entries;
}

function buildDetailLines(student, config, dpi) {
  const small = mmToPx(config.detailsFontSize, dpi);
  return getDetailEntries(student, config).map((e) => ({
    text: e.text,
    size: e.isName ? mmToPx(config.nameFontSize, dpi) : small,
    bold: e.isName,
    color: e.isName ? '#111111' : '#374151',
  }));
}

// Measure the actual rendered details height for each student (accounting for
// text wrapping) and return the max, so the export matches the live preview
// which grows to fit content.
function measureMaxDetailsHeight(students, config, dpi, cardWidth) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.__family = config.fontFamily || 'Inter';
  const detailBorder = mmToPx(config.detailsBorderThickness, dpi);
  const maxWidth = cardWidth - detailBorder * 2;
  const lineGap = mmToPx(1, dpi);
  const padding = mmToPx(1.5, dpi) * 2;
  let maxHeight = padding;
  for (const s of students) {
    const lines = buildDetailLines(s, config, dpi);
    let h = padding;
    for (const { text, size, bold } of lines) {
      ctx.font = `${bold ? 'bold ' : ''}${size}px ${loadFontStack(ctx.__family)}`;
      const wrapped = wrapText(ctx, text, maxWidth);
      h += wrapped.length * Math.ceil(size * 1.2);
    }
    if (h > maxHeight) maxHeight = h;
  }
  return maxHeight;
}

// Convert rendered canvas to a JPEG blob.
export function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality || DEFAULT_JPEG_QUALITY);
  });
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

export async function exportCollageJpeg(result, filename) {
  const blob = await canvasToJpegBlob(result.canvas, result.quality);
  downloadBlob(blob, filename || `School-Collage-${todayStamp()}.jpg`);
  return blob;
}

export async function exportCollagePng(result, filename) {
  const blob = await canvasToPngBlob(result.canvas);
  downloadBlob(blob, filename || `School-Collage-${todayStamp()}.png`);
  return blob;
}

// If too large, split into vertical sections that fit within max canvas height.
export async function exportCollageAsZipSections({
  students,
  config,
  frameImage,
  onProgress,
  shouldCancel,
}) {
  const dpi = config.dpi || DEFAULT_DPI;
  const widthLayout = computeCardLayout(config, dpi, 0);
  const measuredDetailsHeight = measureMaxDetailsHeight(students, config, dpi, widthLayout.cardWidth);
  const L = computeCardLayout(config, dpi, measuredDetailsHeight);
  const vSpacingPx = mmToPx(config.verticalSpacing, dpi);
  const maxH = MAX_CANVAS_DIMENSION;
  const rowsPerSection = Math.max(1, Math.floor((maxH - L.marginPx * 2) / (L.cardHeight + vSpacingPx)));
  const studentsPerSection = rowsPerSection * L.cols;
  const sections = Math.ceil(students.length / studentsPerSection);

  const zip = new JSZip();
  for (let i = 0; i < sections; i++) {
    if (shouldCancel()) break;
    const slice = students.slice(i * studentsPerSection, (i + 1) * studentsPerSection);
    const res = await renderCollage({
      students: slice,
      config: { ...config, pageTitle: i === 0 ? config.pageTitle : '' },
      frameImage,
      onProgress,
      shouldCancel,
    });
    if (res.tooLarge || res.cancelled) continue;
    const blob = await canvasToJpegBlob(res.canvas, config.imageQuality || DEFAULT_JPEG_QUALITY);
    zip.file(`collage-section-${i + 1}.jpg`, blob);
  }
  const out = await zip.generateAsync({ type: 'blob' });
  downloadBlob(out, `School-Collage-sections-${todayStamp()}.zip`);
}

// PDF export (simple: embed JPEG in a single-page PDF sized to the canvas).
export async function exportCollagePdf(result, filename) {
  const blob = await canvasToJpegBlob(result.canvas, result.quality);
  const imgBytes = new Uint8Array(await blob.arrayBuffer());
  const widthPx = result.canvas.width;
  const heightPx = result.canvas.height;
  // Convert px to points at 72 dpi relative to the chosen dpi.
  const widthPt = (widthPx / result.dpi) * 72;
  const heightPt = (heightPx / result.dpi) * 72;
  const pdf = buildSimplePdf(imgBytes, widthPx, heightPx, widthPt, heightPt);
  downloadBlob(pdf, filename || `School-Collage-${todayStamp()}.pdf`);
}

// Build a single-page PDF with the JPEG embedded as raw DCTDecode bytes.
// The stream data must be binary (not base64) so decoders can read it.
function buildSimplePdf(jpegBytes, w, h, wPt, hPt) {
  const enc = new TextEncoder();
  const pieces = [];
  let pos = 0;
  const objOffsets = [];
  const push = (str) => {
    const b = enc.encode(str);
    pieces.push(b);
    pos += b.length;
  };
  const pushRaw = (b) => {
    pieces.push(b);
    pos += b.length;
  };

  push('%PDF-1.4\n');

  objOffsets[1] = pos;
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  objOffsets[2] = pos;
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  objOffsets[3] = pos;
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`);

  const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im1 Do Q`;
  objOffsets[4] = pos;
  push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  objOffsets[5] = pos;
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  pushRaw(jpegBytes);
  push('\nendstream\nendobj\n');

  const xrefStart = pos;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const out = new Uint8Array(pos);
  let p = 0;
  for (const piece of pieces) {
    out.set(piece, p);
    p += piece.length;
  }
  return new Blob([out], { type: 'application/pdf' });
}
