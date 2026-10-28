// client/src/firebase/auth.ts
import { auth, isFirebaseConfigured } from './config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
  type AuthError,
} from 'firebase/auth';
import { findUidByUsername, reserveUsername } from './usernames';

export type RequestedRole = 'student' | 'teacher';

function synthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@mumusubject.app`;
}

export interface AuthResult {
  user: User;
  isNewUser: boolean;
}

const TEACHER_CODE: string = (import.meta.env.VITE_TEACHER_CODE ?? '').trim();

export function verifyTeacherCode(input: string): boolean {
  return !!TEACHER_CODE && input.trim() === TEACHER_CODE;
}

export const USERNAME_REGEX = /^[a-z0-9_-]{4,20}$/;

export function validateUsername(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return '아이디를 입력하세요.';
  if (!USERNAME_REGEX.test(v)) return '아이디는 4~20자 영문 소문자/숫자/-/_ 조합으로 만들어주세요.';
  return null;
}

export function validatePassword(input: string): string | null {
  if (!input) return '비밀번호를 입력하세요.';
  if (input.length < 6) return '비밀번호는 6자리 이상이어야 해요.';
  return null;
}

/**
 * 회원가입. 익명 로그인 의존성 없음.
 * createUserWithEmailAndPassword는 미인증 상태에서도 호출 가능.
 */
export async function signupWithId(
  username: string,
  password: string,
  role: RequestedRole,
): Promise<AuthResult> {
  const u = username.trim().toLowerCase();
  if (!isFirebaseConfigured) return offlineUser(`offline-${u}`);

  const email = synthEmail(u);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const reserved = await reserveUsername(u, cred.user.uid, role);
    if (!reserved) {
      throw new Error('아이디 점유에 실패했어요. 다시 시도하세요.');
    }
    return { user: cred.user, isNewUser: true };
  } catch (err) {
    const sc = (err as AuthError).code;
    if (sc === 'auth/email-already-in-use') throw new Error('이미 사용 중인 아이디예요. 다른 아이디로 시도하세요.');
    if (sc === 'auth/weak-password') throw new Error('비밀번호는 6자리 이상이어야 해요.');
    if (sc === 'auth/invalid-email') throw new Error('아이디 형식이 올바르지 않아요.');
    if (err instanceof Error) throw err;
    throw new Error('회원가입에 실패했어요. 잠시 후 다시 시도하세요.');
  }
}

export async function loginWithId(
  username: string,
  password: string,
): Promise<AuthResult> {
  const u = username.trim().toLowerCase();
  if (!isFirebaseConfigured) return offlineUser(`offline-${u}`);

  const email = synthEmail(u);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user, isNewUser: false };
  } catch (err) {
    const code = (err as AuthError).code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      throw new Error('아이디 또는 비밀번호가 달라요.');
    }
    if (code === 'auth/wrong-password') throw new Error('비밀번호가 달라요.');
    if (code === 'auth/invalid-email') throw new Error('아이디 형식이 올바르지 않아요.');
    throw err;
  }
}

export async function lookupUidByUsername(username: string): Promise<string | null> {
  return findUidByUsername(username);
}

function offlineUser(uid: string): AuthResult {
  const user = { uid, isAnonymous: true } as unknown as User;
  return { user, isNewUser: true };
}
