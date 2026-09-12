import { v4 as uuidv4 } from 'uuid';
import { SYNC_STATUS } from '@/constants';
import { nowISO } from '@/utils';

export function baseRecord(syncStatus = SYNC_STATUS.PENDING) {
  return {
    id: uuidv4(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    syncStatus,
  };
}

export function makeStudent(partial) {
  return {
    ...baseRecord(),
    name: '',
    gender: '',
    rollNumber: '',
    admissionNumber: '',
    className: '',
    photoBlobId: null,
    photoLocalUrl: null,
    photoStorageUrl: null,
    photoCrop: { x: 0, y: 0 },
    photoZoom: 1,
    photoRotation: 0,
    ...partial,
  };
}

export function makeCategory(partial) {
  return {
    ...baseRecord(),
    name: '',
    order: 0,
    isDefault: false,
    ...partial,
  };
}

export function makeItem(partial) {
  return {
    ...baseRecord(),
    categoryId: null,
    name: '',
    order: 0,
    ...partial,
  };
}

export function makeParticipation(partial) {
  return {
    ...baseRecord(),
    studentId: null,
    categoryId: null,
    itemId: null,
    ...partial,
  };
}

export function makeResult(partial) {
  return {
    ...baseRecord(),
    participationId: null,
    studentId: null,
    categoryId: null,
    itemId: null,
    grade: '',
    position: '',
    marks: '',
    ...partial,
  };
}

export function makeFrameTemplate(partial) {
  return {
    ...baseRecord(),
    name: '',
    imageBlobId: null,
    imageStorageUrl: null,
    widthScale: 1,
    heightScale: 1,
    offsetX: 0,
    offsetY: 0,
    padding: 0,
    enabled: false,
    ...partial,
  };
}

export function makeBlob(partial) {
  return {
    id: partial.id || uuidv4(),
    kind: 'photo',
    refId: null,
    blob: null,
    mimeType: 'image/jpeg',
    createdAt: nowISO(),
    ...partial,
  };
}
