import { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import {
  loginEmailPassword,
  signUpEmailPassword,
  loginGoogle,
  resetPassword,
  sendCurrentUserVerification,
  refreshCurrentUser,
  logout,
} from '@/firebase/auth';
import {
  ACCESS_MESSAGES,
  accessKind,
  checkCurrentUserAccess,
  requestCurrentUserAccess,
} from '@/firebase/access';
import { useAppStore } from '@/stores/appStore';
import { isFirebaseConfigured } from '@/firebase/config';
import { Spinner } from '@/components/common/Spinner';
import { LogIn, UserPlus, AlertCircle, Mail, RefreshCw } from 'lucide-react';

export default function LoginModal({ open, onClose, onSuccess }) {
  const { user, setUser, setMode: setAppMode, setAccess, addToast } = useAppStore();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gate, setGate] = useState(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (open && user) evaluateAccess(user, 'access-request');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.uid]);

  async function evaluateAccess(signedInUser, requestType) {
    setBusy(true);
    setError('');
    setAccess('checking');
    try {
      await refreshCurrentUser();
      const check = await checkCurrentUserAccess();
      const kind = accessKind(check);
      setGate({ ...check, kind, requestType });
      setAccess(kind, check);
      if (kind === 'allowed') {
        setUser(signedInUser);
        setAppMode('online');
        addToast({ type: 'success', message: 'Signed in and access approved.' });
        onSuccess?.(signedInUser);
        onClose?.();
      } else {
        setAppMode('offline');
      }
    } catch (err) {
      setAppMode('offline');
      setAccess('denied');
      setError(humanizeAuthError(err?.code || err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!configured) return setError('Firebase is not configured. Add credentials to .env and restart.');
    setBusy(true);
    setError('');
    try {
      const isSignup = mode === 'signup';
      const signedInUser = isSignup
        ? await signUpEmailPassword(email.trim(), password, name.trim())
        : await loginEmailPassword(email.trim(), password);
      setUser(signedInUser);
      await evaluateAccess(signedInUser, isSignup ? 'new-account' : 'access-request');
    } catch (err) {
      setError(humanizeAuthError(err?.code || err?.message));
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError('');
    try {
      const signedInUser = await loginGoogle();
      setUser(signedInUser);
      await evaluateAccess(signedInUser, 'access-request');
    } catch (err) {
      setError(humanizeAuthError(err?.code || err?.message));
      setBusy(false);
    }
  }

  async function handleRequest() {
    setBusy(true);
    setError('');
    try {
      const result = await requestCurrentUserAccess(gate?.requestType || 'access-request');
      if (result.status === 'already-approved') return evaluateAccess(user, 'access-request');
      const kind = result.status === 'rejected' ? 'rejected' : result.status === 'approved' ? 'inactive' : 'pending';
      setGate((g) => ({ ...g, kind }));
      setAccess(kind, gate);
    } catch (err) {
      if (err?.code === 'functions/failed-precondition') {
        setGate((g) => ({ ...g, kind: 'verification-required' }));
      } else {
        setError(humanizeAuthError(err?.code || err?.message));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerification() {
    setBusy(true);
    try {
      await sendCurrentUserVerification();
      addToast({ type: 'success', message: 'Verification email sent. Verify your address, then select Check Again.' });
    } catch (err) {
      setError(humanizeAuthError(err?.code || err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) return setError('Enter your email address first.');
    setBusy(true);
    try {
      await resetPassword(email.trim());
      addToast({ type: 'success', message: 'Password reset email sent.' });
    } catch (err) {
      setError(humanizeAuthError(err?.code || err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await logout();
    setUser(null);
    setGate(null);
    setAccess('unknown');
    setAppMode('offline');
  }

  const gateMessage = gate?.kind === 'pending' ? ACCESS_MESSAGES.pending
    : gate?.kind === 'rejected' ? ACCESS_MESSAGES.rejected
      : gate?.kind === 'inactive' ? ACCESS_MESSAGES.inactive
        : gate?.kind === 'verification-required' ? ACCESS_MESSAGES.verificationRequired
          : ACCESS_MESSAGES.denied;

  return (
    <Modal open={open} onClose={onClose} title={gate ? 'Application Access' : mode === 'login' ? 'Sign In' : 'Create Account'} size="sm">
      {!configured && <Notice text="Firebase credentials are missing. Add them to .env and restart the app." />}
      {gate ? (
        <div className="space-y-4">
          <Notice text={gateMessage} />
          <p className="text-sm text-ink-500">Signed in as <strong>{user?.email}</strong></p>
          {gate.kind === 'denied' && <button className="btn-primary w-full" disabled={busy} onClick={handleRequest}><UserPlus size={16} /> Request Access</button>}
          {gate.kind === 'verification-required' && <button className="btn-primary w-full" disabled={busy} onClick={handleVerification}><Mail size={16} /> Send Verification Email</button>}
          {(gate.kind === 'pending' || gate.kind === 'rejected' || gate.kind === 'inactive' || gate.kind === 'verification-required') && (
            <button className="btn-secondary w-full" disabled={busy} onClick={() => evaluateAccess(user, gate.requestType)}><RefreshCw size={16} /> Check Again</button>
          )}
          <button className="btn-ghost w-full" disabled={busy} onClick={handleSignOut}>Sign Out</button>
          {busy && <div className="flex justify-center"><Spinner /></div>}
          {error && <p className="text-sm text-danger-600 bg-red-50 rounded-md p-2">{error}</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && <div><label className="label">Display name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>}
          <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" /></div>
          <div><label className="label">Password</label><input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
          {error && <p className="text-sm text-danger-600 bg-red-50 rounded-md p-2">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}{mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          <button type="button" className="btn-secondary w-full" disabled={busy} onClick={handleGoogle}>Continue with Google</button>
          {mode === 'login' && <button type="button" className="btn-ghost w-full" disabled={busy} onClick={handleReset}>Forgot password?</button>}
          <p className="text-center text-sm text-ink-500">{mode === 'login' ? "Don't have an account? " : 'Already have an account? '}<button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up' : 'Sign in'}</button></p>
        </form>
      )}
    </Modal>
  );
}

function Notice({ text }) {
  return <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle size={18} className="shrink-0" /><p>{text}</p></div>;
}

function humanizeAuthError(code) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || code || 'Authentication failed.';
}
