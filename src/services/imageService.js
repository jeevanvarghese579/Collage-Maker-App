import { PHOTO_RATIO_W, PHOTO_RATIO_H } from '@/constants';

const TARGET_WIDTH = 900; // long edge after compression; preserves print quality at 300dpi for small cards

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function imageFromFile(file) {
  return fileToImage(file);
}

export function getCroppedImg(imageSrc, pixelCrop, rotation = 0, zoom = 1) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const safeArea = Math.max(image.width, image.height) * zoom;
      canvas.width = safeArea;
      canvas.height = safeArea;
      ctx.save();
      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.translate(-image.width / 2, -image.height / 2);
      ctx.drawImage(image, 0, 0);
      ctx.restore();

      const out = document.createElement('canvas');
      out.width = pixelCrop.width;
      out.height = pixelCrop.height;
      const octx = out.getContext('2d');
      octx.drawImage(
        canvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      out.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

// Crop using react-easy-crop's area ({x,y,width,height} in natural px) + adjustments.
export async function cropToPortraitBlob(imageSrc, croppedAreaPixels, rotation = 0, zoom = 1) {
  const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, zoom);
  return compressPortraitBlob(blob);
}

// Ensure the blob is 3:4 and reasonably compressed.
export function compressPortraitBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = PHOTO_RATIO_W / PHOTO_RATIO_H;
      let w = img.width;
      let h = w / ratio;
      if (h > img.height) {
        h = img.height;
        w = h * ratio;
      }
      // Scale down to target long edge.
      if (w > TARGET_WIDTH) {
        const scale = TARGET_WIDTH / w;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function blobToObjectUrl(blob) {
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export function validateImageFile(file, maxMB = 15) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: 'Unsupported image format. Use JPG, PNG, WEBP, GIF or BMP.' };
  }
  if (file.size > maxMB * 1024 * 1024) {
    return { ok: false, error: `Image too large. Maximum ${maxMB}MB.` };
  }
  return { ok: true };
}

export async function getImageSize(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return { width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Paste from clipboard -> File
export function clipboardEventToImageFile(e) {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}
