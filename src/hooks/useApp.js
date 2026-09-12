import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { subscribeAuth } from '@/firebase/auth';
import { db, TABLES } from '@/db/dexie';
import { runMigrations, ensureSeedData } from '@/db/migrations';
import { getBlobUrl } from '@/db/blobs';
import { checkCurrentUserAccess, accessKind } from '@/firebase/access';
import { runSync } from '@/services/syncService';

// Hook that loads a photo object URL for a student's stored blob.
export function useStudentPhoto(student) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!student?.photoBlobId) {
        setUrl(null);
        return;
      }
      const u = await getBlobUrl(student.photoBlobId);
      if (active) setUrl(u);
    }
    load();
    return () => {
      active = false;
    };
  }, [student?.id, student?.photoBlobId]);
  return url;
}

// One-time app bootstrap: migrations, seed data, settings, auth subscription.
export function useBootstrap() {
  const setAuthReady = useAppStore((s) => s.setAuthReady);
  const setUser = useAppStore((s) => s.setUser);
  const setOnline = useAppStore((s) => s.setOnline);
  const setLastSyncedAt = useAppStore((s) => s.setLastSyncedAt);
  const setMode = useAppStore((s) => s.setMode);
  const setAccess = useAppStore((s) => s.setAccess);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const readyTimer = window.setTimeout(() => { if (active) setAuthReady(true); }, 200);

    const onlineHandler = async () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      const currentUser = useAppStore.getState().user;
      if (!isOnline || !currentUser) return;
      setAccess('checking');
      try {
        const check = await checkCurrentUserAccess();
        if (!active) return;
        const kind = accessKind(check);
        setAccess(kind, check);
        setMode(kind === 'allowed' ? 'online' : 'offline');
        if (kind === 'allowed') {
          setSyncStatus('syncing');
          await runSync(currentUser.uid);
          if (!active) return;
          setLastSyncedAt(new Date().toISOString());
          setSyncStatus('success');
        }
      } catch {
        if (!active) return;
        setMode('offline');
        setSyncStatus('error');
      }
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', onlineHandler);

    (async () => {
      try {
        await runMigrations();
        await ensureSeedData();
      } catch (error) {
        console.error('Bootstrap error', error);
      }
      if (!active) return;

      const meta = await db.table(TABLES.syncMeta).get('lastSync');
      if (active && meta) setLastSyncedAt(meta.value);

      unsubscribe = subscribeAuth(async (user) => {
        if (!active) return;
        setUser(user);
        setAuthReady(true);
        if (!user || !navigator.onLine) {
          setMode('offline');
          setAccess('unknown');
          return;
        }
        setAccess('checking');
        try {
          const check = await checkCurrentUserAccess();
          if (!active) return;
          const kind = accessKind(check);
          setAccess(kind, check);
          setMode(kind === 'allowed' ? 'online' : 'offline');
        } catch {
          if (active) {
            setAccess('unknown');
            setMode('offline');
          }
        }
      });
    })();

    return () => {
      active = false;
      window.clearTimeout(readyTimer);
      unsubscribe();
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', onlineHandler);
    };
  }, [setAuthReady, setUser, setOnline, setLastSyncedAt, setMode, setAccess, setSyncStatus]);
}
