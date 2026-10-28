// client/src/firebase/usernames.ts
import { db, isFirebaseConfigured } from './config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * usernames/{username}: { uid, role, createdAt }
 * 신규 가입 시 username → uid 매핑을 점유한다.
 * username 자체는 lowercase + [a-z0-9_-]{4,20} 형식.
 */

export async function findUidByUsername(username: string): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const u = username.trim().toLowerCase();
  if (!u) return null;
  const snap = await getDoc(doc(db, 'usernames', u));
  if (!snap.exists()) return null;
  const data = snap.data() as { uid?: string };
  return data.uid ?? null;
}

export async function reserveUsername(
  username: string,
  uid: string,
  role: 'student' | 'teacher',
): Promise<boolean> {
  if (!isFirebaseConfigured) return true;
  const u = username.trim().toLowerCase();
  const ref = doc(db, 'usernames', u);
  try {
    await setDoc(ref, { uid, role, createdAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
