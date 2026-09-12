import { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  LogIn,
  LogOut,
  ChevronDown,
  Cloud,
  CloudOff,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { formatDate } from '@/utils';
import { useClickOutside } from '@/hooks/useUi';
import { logout } from '@/firebase/auth';
import { runSync } from '@/services/syncService';
import { downloadBackup } from '@/services/backupService';
import { checkCurrentUserAccess } from '@/firebase/access';

export default function Header({ onLoginClick }) {
  const {
    mode,
    user,
    online,
    syncStatus,
    lastSyncedAt,
    syncProgress,
    setSyncStatus,
    setSyncProgress,
    setLastSyncedAt,
    setMode,
    setUser,
    setAccess,
    addToast,
  } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useClickOutside(() => setMenuOpen(false));

  async function handleSync() {
    if (mode !== 'online' || !user) {
      addToast({ type: 'info', message: 'Sign in first to sync with the cloud.' });
      return;
    }
    setSyncStatus('syncing');
    setSyncProgress({ step: 0, total: 1, message: 'Starting…' });
    try {
      const access = await checkCurrentUserAccess();
      if (!access.allowed) {
        setAccess(access.requestStatus || 'denied', access);
        setMode('offline');
        throw new Error('Your access is not currently approved. Cloud sync was blocked.');
      }
      // Safety backup before sync.
      await downloadBackup();
      const result = await runSync(user.uid, (p) => setSyncProgress(p));
      setLastSyncedAt(new Date().toISOString());
      setSyncStatus('success');
      addToast({
        type: result.conflicts.length ? 'info' : 'success',
        message: result.conflicts.length
          ? `Synchronization complete. ${result.conflicts.length} newer cloud change(s) were preserved.`
          : 'Synchronization complete.',
      });
    } catch (e) {
      setSyncStatus('error');
      addToast({ type: 'error', message: `Sync failed: ${e.message}` });
    } finally {
      setSyncProgress(null);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setAccess('unknown');
    setMode('offline');
    setMenuOpen(false);
    addToast({ type: 'info', message: 'Signed out. Working offline.' });
  }

  const isOffline = mode === 'offline';
  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-ink-100 flex items-center gap-3 px-4">
      <div className="flex items-center gap-2">
        <span
          className={`chip ${isOffline ? 'chip-warning' : 'chip-success'}`}
          title={isOffline ? 'Offline mode' : 'Online mode'}
        >
          {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
          {isOffline ? 'Offline' : 'Online'}
        </span>
        {mode === 'online' && (
          <span
            className={`chip ${online ? 'chip-success' : 'chip-warning'}`}
            title={online ? 'Connected' : 'No connection'}
          >
            {online ? <Cloud size={14} /> : <CloudOff size={14} />}
            {online ? 'Connected' : 'No connection'}
          </span>
        )}
        {syncStatus === 'syncing' && syncProgress && (
          <span className="chip chip-brand">
            <RefreshCw size={14} className="animate-spin" />
            {syncProgress.message} ({syncProgress.step}/{syncProgress.total})
          </span>
        )}
        {syncStatus === 'error' && (
          <span className="chip chip-danger">Sync error</span>
        )}
      </div>

      <div className="flex-1" />

      <div className="hidden sm:flex items-center text-xs text-ink-500 mr-1">
        <Check size={12} className="mr-1 text-ink-400" />
        Last sync: {formatDate(lastSyncedAt)}
      </div>

      {mode === 'online' && (
        <button
          className="btn-secondary btn-sm"
          onClick={handleSync}
          disabled={syncStatus === 'syncing'}
        >
          {syncStatus === 'syncing' ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Sync
        </button>
      )}

      {isOffline ? (
        <button className="btn-primary btn-sm" onClick={onLoginClick}>
          <LogIn size={14} /> Login & Sync
        </button>
      ) : (
        <div className="relative" ref={ref}>
          <button
            className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-ink-100"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </span>
            <ChevronDown size={16} className="text-ink-500" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 card p-2 shadow-lift animate-scale-in">
              <div className="px-3 py-2 border-b border-ink-100 mb-1">
                <p className="text-sm font-semibold text-ink-900 truncate">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-ink-500 truncate">{user?.email}</p>
              </div>
              <button
                className="btn-ghost w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
