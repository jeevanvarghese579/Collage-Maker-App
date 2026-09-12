import { httpsCallable } from 'firebase/functions';
import { getFirebase, getFirebaseAppId } from './config';

export const ACCESS_MESSAGES = {
  denied: 'Your account does not currently have access to this application.',
  pending: 'Your access request is awaiting administrator approval.',
  rejected: 'Your access request was not approved. Contact an administrator if you need this decision reviewed.',
  inactive: 'Access was approved, but this account or application is currently inactive. Contact an administrator.',
  verificationRequired: 'Verify your email address before requesting access to this application.',
};

export async function checkCurrentUserAccess() {
  const { functions } = getFirebase();
  const call = httpsCallable(functions, 'checkMyAccess');
  const result = await call({ appId: getFirebaseAppId() });
  const data = result.data || {};
  return {
    allowed: data.allowed === true,
    requestStatus: data.requestStatus || null,
    requireEmailVerification: data.requireEmailVerification === true,
    emailVerified: data.emailVerified === true,
    role: data.role || null,
  };
}

export async function requestCurrentUserAccess(requestType = 'access-request') {
  const { functions } = getFirebase();
  const call = httpsCallable(functions, 'requestAppAccess');
  const result = await call({ appId: getFirebaseAppId(), requestType });
  return result.data || {};
}

export function accessKind(check) {
  if (check.allowed) return 'allowed';
  if (check.requestStatus === 'pending') return 'pending';
  if (check.requestStatus === 'rejected') return 'rejected';
  if (check.requestStatus === 'approved') return 'inactive';
  return 'denied';
}
