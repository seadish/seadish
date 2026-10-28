// client/src/firebase/userStore.ts
import { db, isFirebaseConfigured } from './config';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs,
  serverTimestamp, increment,
  type FieldValue,
} from 'firebase/firestore';
import { todayKstKey } from '../utils/dateKst';

export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  uid: string;
  name: string;
  classCode: string;
  coins: number;
  level: number;
  exp: number;               // 다음 레벨까지 누적된 경험치 (PR 18부터 누적 저장)
  bestLevel: number;
  cleared: boolean;
  role: UserRole;
  totalCorrect: number;
  totalWrong: number;
  // 학교 정보 (PR 2부터). 기존 사용자는 누락 가능.
  schoolCode?: string;
  schoolName?: string;
  grade?: number;
  classNumber?: number;
  // 로그인 ID (PR 12부터). usernames/{username} 매핑.
  username?: string;
  // 평문 비번 (PR 15부터). 교사 대시보드 표시용. 보안 트레이드오프 — 학교 단순 비번 환경 가정.
  displayPassword?: string;
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
}

export interface UserExtras {
  schoolCode?: string;
  schoolName?: string;
  grade?: number;
  classNumber?: number;
  username?: string;
  displayPassword?: string;
}

/** 로그인 직후 호출. 프로필 없으면 생성, 있으면 로드. role은 신규 생성 시에만 적용. */
export async function ensureUserProfile(
  uid: string,
  name: string,
  classCode: string,
  role: UserRole = 'student',
  extras: UserExtras = {},
): Promise<UserProfile> {
  if (!isFirebaseConfigured) {
    return {
      uid, name: name.trim(), classCode: classCode.trim(),
      coins: 0, level: 1, exp: 0, bestLevel: 1, cleared: false,
      role, totalCorrect: 0, totalWrong: 0,
      ...extras,
    };
  }
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    const next: Partial<UserProfile> = {};
    if (data.name !== name.trim()) next.name = name.trim();
    if (data.classCode !== classCode.trim()) next.classCode = classCode.trim();
    if (extras.schoolCode && !data.schoolCode) next.schoolCode = extras.schoolCode;
    if (extras.schoolName && !data.schoolName) next.schoolName = extras.schoolName;
    if (extras.grade && !data.grade) next.grade = extras.grade;
    if (extras.classNumber && !data.classNumber) next.classNumber = extras.classNumber;
    if (extras.username && !data.username) next.username = extras.username;
    if (extras.displayPassword && !data.displayPassword) next.displayPassword = extras.displayPassword;
    if (Object.keys(next).length) {
      await updateDoc(ref, { ...next, updatedAt: serverTimestamp() });
    }
    return {
      ...data,
      ...next,
      role: data.role ?? 'student',
      totalCorrect: data.totalCorrect ?? 0,
      totalWrong: data.totalWrong ?? 0,
      exp: data.exp ?? 0,
    };
  }

  const profile: UserProfile = {
    uid,
    name: name.trim(),
    classCode: classCode.trim(),
    coins: 0,
    level: 1,
    exp: 0,
    bestLevel: 1,
    cleared: false,
    role,
    totalCorrect: 0,
    totalWrong: 0,
    ...extras,
  };
  await setDoc(ref, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return profile;
}

/** 로그인 후 user doc만 가져오기 (수정 X). 신규 생성 안 함. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfile;
  return {
    ...data,
    role: data.role ?? 'student',
    totalCorrect: data.totalCorrect ?? 0,
    totalWrong: data.totalWrong ?? 0,
    exp: data.exp ?? 0,
  };
}

/**
 * 레벨·경험치·clear 진행 정보 저장.
 * 코인은 commitChapterCoins로만 적립한다 (보스 락인).
 */
export async function saveProgress(
  uid: string,
  patch: { level?: number; exp?: number; cleared?: boolean },
): Promise<void> {
  if (!isFirebaseConfigured) return;
  const ref = doc(db, 'users', uid);
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.level !== undefined) update.level = patch.level;
  if (patch.exp !== undefined) update.exp = patch.exp;
  if (patch.cleared !== undefined) update.cleared = patch.cleared;
  if (Object.keys(update).length === 1) return; // updatedAt만 있으면 스킵
  await updateDoc(ref, update);

  if (patch.level !== undefined) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const cur = snap.data() as UserProfile;
      if (patch.level > (cur.bestLevel ?? 1)) {
        await updateDoc(ref, { bestLevel: patch.level });
      }
    }
  }
}

/** 정답/오답 1건 기록. 코인은 별도(보스 락인). */
export async function recordAnswer(
  uid: string,
  isCorrect: boolean,
): Promise<void> {
  if (!isFirebaseConfigured) return;
  const userRef = doc(db, 'users', uid);
  const dailyKey = todayKstKey();
  const dailyRef = doc(db, 'users', uid, 'daily', dailyKey);

  await Promise.all([
    updateDoc(userRef, {
      [isCorrect ? 'totalCorrect' : 'totalWrong']: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {}),
    setDoc(
      dailyRef,
      {
        date: dailyKey,
        [isCorrect ? 'correct' : 'wrong']: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {}),
  ]);
}

/**
 * 챕터 보스 처치 시 호출: 임시로 모은 코인을 누적에 락인.
 * users.coins, users/{uid}/daily/{today}.coins 모두 increment.
 */
export async function commitChapterCoins(
  uid: string,
  coins: number,
): Promise<void> {
  if (!isFirebaseConfigured) return;
  if (coins <= 0) return;
  const rounded = Math.round(coins * 10) / 10;
  const userRef = doc(db, 'users', uid);
  const dailyKey = todayKstKey();
  const dailyRef = doc(db, 'users', uid, 'daily', dailyKey);

  await Promise.all([
    updateDoc(userRef, {
      coins: increment(rounded),
      updatedAt: serverTimestamp(),
    }).catch(() => {}),
    setDoc(
      dailyRef,
      {
        date: dailyKey,
        coins: increment(rounded),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {}),
  ]);
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  classCode: string;
  coins: number;
  bestLevel: number;
  cleared: boolean;
}

export async function getLeaderboard(
  classCode: string,
  topN: number = 20,
): Promise<LeaderboardEntry[]> {
  if (!isFirebaseConfigured) return [];
  // 복합 인덱스 회피: classCode만 서버 필터, role 필터 + coins 정렬은 클라이언트에서.
  const q = query(
    collection(db, 'users'),
    where('classCode', '==', classCode.trim()),
    limit(200),
  );
  const snap = await getDocs(q);
  const rows: LeaderboardEntry[] = snap.docs
    .map((d) => d.data() as UserProfile)
    .filter((data) => (data.role ?? 'student') === 'student')
    .map((data) => ({
      uid: data.uid,
      name: data.name,
      classCode: data.classCode,
      coins: data.coins ?? 0,
      bestLevel: data.bestLevel ?? data.level ?? 1,
      cleared: data.cleared ?? false,
    }));
  rows.sort((a, b) => b.coins - a.coins);
  return rows.slice(0, topN);
}

export interface StudentSummary {
  uid: string;
  name: string;
  username: string;          // 로그인 아이디 (없으면 빈 문자열)
  displayPassword: string;   // 평문 비번 (없으면 빈 문자열)
  totalCoins: number;
  todayCoins: number;
  totalCorrect: number;
  totalWrong: number;
  todayCorrect: number;
  todayWrong: number;
  errorRate: number; // 0~1
}

/** 교사 대시보드: 같은 학급 학생 목록 + 오늘 통계까지 한 번에. */
export async function getClassStudentsWithToday(
  classCode: string,
): Promise<StudentSummary[]> {
  if (!isFirebaseConfigured) return [];
  const q = query(
    collection(db, 'users'),
    where('classCode', '==', classCode.trim()),
    limit(200),
  );
  const snap = await getDocs(q);
  const dailyKey = todayKstKey();

  const studentDocs = snap.docs
    .map((d) => d.data() as UserProfile)
    .filter((data) => (data.role ?? 'student') === 'student');

  const rows = await Promise.all(studentDocs.map(async (data) => {
    let todayCoins = 0, todayCorrect = 0, todayWrong = 0;
    try {
      const dailySnap = await getDoc(doc(db, 'users', data.uid, 'daily', dailyKey));
      if (dailySnap.exists()) {
        const dd = dailySnap.data() as { coins?: number; correct?: number; wrong?: number };
        todayCoins = dd.coins ?? 0;
        todayCorrect = dd.correct ?? 0;
        todayWrong = dd.wrong ?? 0;
      }
    } catch {}
    const tc = data.totalCorrect ?? 0;
    const tw = data.totalWrong ?? 0;
    const attempts = tc + tw;
    return {
      uid: data.uid,
      name: data.name,
      username: data.username ?? '',
      displayPassword: data.displayPassword ?? '',
      totalCoins: data.coins ?? 0,
      todayCoins,
      totalCorrect: tc,
      totalWrong: tw,
      todayCorrect,
      todayWrong,
      errorRate: attempts > 0 ? tw / attempts : 0,
    } satisfies StudentSummary;
  }));

  // 누적 디스코인 내림차순
  rows.sort((a, b) => b.totalCoins - a.totalCoins);
  return rows;
}

/**
 * 교사가 학생 user doc 삭제 (잘못 배정된 학생 정리용).
 * Firestore rules에서 같은 학급 교사만 가능.
 * - Firebase Auth 계정과 username/{username} doc은 그대로 남음
 *   (같은 username 재사용 막기 + Auth 계정 leftover는 정책상 무해)
 */
export async function deleteStudentUser(uid: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  await deleteDoc(doc(db, 'users', uid));
}
