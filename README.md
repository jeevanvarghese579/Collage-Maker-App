# Collage Maker for Schools

Create print-ready school collages with student photos, categories, results and custom frame templates. Works **fully offline** and synchronizes with Firebase when you sign in.

Developed by **Jeevan Varghese** — [itsjeevanvarghese.web.app](https://itsjeevanvarghese.web.app)

---

## Features

- Offline-first with Dexie.js / IndexedDB (photos stored as Blobs, never Base64)
- Firebase Authentication (email/password) + Cloud Firestore + Storage sync
- Students with 3:4 cropped photos (upload, drag-drop, paste)
- Categories & items with drag-to-reorder (5 default categories seeded)
- Participation entry with bulk add/remove and duplicate prevention
- Results entry with inline editing, bulk apply, filters, and smart CSV import
- Create Collage: 210mm A4-width canvas, configurable columns/spacing/fonts/DPI
- High-resolution JPEG export (300 DPI default), PNG, PDF, and sectioned ZIP
- Frame templates (transparent PNG) with scale/offset controls
- Master backup/restore (ZIP with JSON + images), merge or replace
- Demo data button + remove-all-data button
- Toasts, confirmation dialogs, loading skeletons, empty/error states

---

## Tech Stack

React · Vite (JavaScript, no TypeScript) · React Router · Firebase (Auth, Firestore, Storage) · Dexie.js · Papa Parse · Zustand · React Hook Form · Zod · @dnd-kit · react-easy-crop · JSZip · Lucide React

---

## Getting Started

```bash
npm install
npm run dev
```

Open the app and choose **Work Offline** to try it immediately without any configuration.

### Build for production

```bash
npm run build
npm run preview
```

---

## Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a project.
2. Add a **Web app** and copy the config values.
3. Enable **Authentication → Email/Password**.
4. Enable **Cloud Firestore** (production mode).
5. Enable **Storage**.
6. Copy `.env.example` to `.env` and fill in the values:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=yourproject
VITE_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Restart `npm run dev` after editing `.env`.

> Without Firebase credentials the app runs fully in Offline mode. Login & Sync are unavailable until configured.

---

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Each user's data is scoped under `users/{uid}/...`. Firestore and Storage rules also require an active Access Manager approval for this app's fixed Firebase Web App ID.

Authentication supports Google, email/password sign-in and sign-up, password reset, optional email verification, and the existing Access Manager request/pending/approval flow. Authentication alone never enables cloud access.

---

## Offline Mode & Synchronization

- **Work Offline**: all data saved locally via Dexie/IndexedDB. Photos stored as Blob objects.
- **Login & Sync** (from the header when offline): authenticates, uploads local photos/frames to Storage, upserts Firestore records, and pulls cloud records down.
- A **safety backup** is created automatically before every sync.
- Conflict resolution compares timestamps before upload. The newer record wins; newer cloud changes are preserved and recorded in local sync metadata.
- Local data is never deleted after sync — it is marked `synced` and remains available offline.
- Online users keep a local Dexie cache so the app keeps working during connection drops; created/edited records and deletion tombstones survive refreshes and sync automatically after an authorized reconnect (or manually from the header).
- A same-origin-only service worker caches the app shell and static assets for offline startup; Firebase/API responses are not cached by it.

---

## CSV Formats

### Students CSV

Columns: `Name, Gender, Roll Number, Admission Number, Class`

- Name and Class are required.
- Duplicate admission numbers are allowed.
- Photos are never included in CSV.
- "Export Blank CSV" downloads a template with headers only.
- Import shows a preview with valid/invalid rows before confirming.

### Results CSV

Columns: `Student Name, Gender, Roll Number, Admission Number, Class, Category, Item, Grade, Position, Marks, Student ID, Category ID, Item ID, Participation ID`

- The last four columns (Student/Category/Item/Participation ID) are optional internal IDs that make re-import safer. Files without them still work.
- Smart import: missing students, categories, and items are created automatically; participations and results are created or updated.
- A detailed import report lists created, updated, and failed rows.

---

## Backup & Restore

- **Create Backup** downloads a single ZIP containing all records (JSON), photos, frame templates, presets and settings.
- **Restore Backup** shows a preview (date, version, record counts), then offers **Merge** or **Replace**.
- A safety backup is automatically created before any restore.
- Backup schema is versioned for forward compatibility.

---

## Collage Export

- Canvas width is always **210mm** (A4 portrait width).
- Height grows automatically to fit every selected student — no cropping or omissions.
- Default resolution: **300 DPI** (~2480px wide). Selectable: 150 / 200 / 300 / 600 DPI.
- **JPEG** is the primary export (quality ≥ 0.95, white background, no transparency).
- PNG and PDF are also available.
- If the canvas exceeds the browser's max canvas size, use **Sections ZIP** export, lower DPI, or fewer columns.
- Rendering is chunked with `requestAnimationFrame` to avoid freezing on very long collages.
- A cancel button is available during export.

---

## Project Structure

```
src/
  assets/
  components/
    common/      Modal, Toast, ConfirmDialog, Spinner, EmptyState, etc.
    layout/      Sidebar, Header, DashboardLayout
    students/    StudentFormModal
  pages/         WelcomePage, StudentsPage, CategoriesPage, ParticipationPage,
                 ResultsPage, CollagePage, FramesPage, SettingsPage
  db/            dexie.js, schema.js, migrations.js, blobs.js
  firebase/      config.js, auth.js, firestore.js, storage.js
  services/      syncService.js, backupService.js, csvService.js,
                 imageService.js, collageExportService.js
  hooks/         useDb.js, useApp.js, useUi.js
  stores/        appStore.js
  utils/         index.js
  constants/     index.js
  App.jsx
  main.jsx
```

---

## Desktop (Electron) Note

Browser APIs, Firebase services, database access, and UI are kept in separate modules so the app can later be packaged as an Electron desktop application. The Dexie/IndexedDB layer and all services work without changes in an Electron renderer.

---

## License

Built for school use. Developed by Jeevan Varghese.
