import { v4 as uuidv4 } from 'uuid';
import { SYNC_STATUS } from '@/constants';

export { SYNC_STATUS };

export const uuid = () => uuidv4();

export const nowISO = () => new Date().toISOString();

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(iso) {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Never';
  }
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function mmToPx(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

export function pxToMm(px, dpi) {
  return (px / dpi) * 25.4;
}

export function debounce(fn, wait = 250) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nilIfEmpty(v) {
  return v === '' || v === null || v === undefined ? 'NIL' : v;
}

export function isNil(v) {
  return v === 'NIL' || v === '' || v === null || v === undefined;
}

export function truncate(str, n = 24) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export function sortByName(a, b) {
  return (a.name || '').localeCompare(b.name || '', undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
