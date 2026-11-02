import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, onValue, type Database } from 'firebase/database';

const env = import.meta.env;
export const useEmulator = env.VITE_USE_EMULATOR === '1';

const config = useEmulator
  ? {
      apiKey: 'demo-key',
      authDomain: 'demo-hideseek.firebaseapp.com',
      projectId: 'demo-hideseek',
      databaseURL: 'http://127.0.0.1:9000?ns=demo-hideseek',
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    };

export interface Client {
  app: FirebaseApp;
  db: Database;
  auth: Auth;
  /** 익명 로그인. 같은 브라우저에서는 같은 uid가 유지된다. db를 쓰기 전에 반드시 먼저 호출한다. */
  ensureUid(): Promise<string>;
  /** Firebase 서버 시간 기준 현재 ms */
  serverNow(): number;
}

export function createClient(name?: string): Client {
  const app = name ? initializeApp(config, name) : initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  let offset = 0;
  let watchingOffset = false;
  return {
    app, db, auth,
    async ensureUid() {
      await auth.authStateReady();
      const uid = auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
      // DB 연결은 로그인 뒤에 처음 열어야 첫 요청부터 인증된 상태로 나간다.
      if (!watchingOffset) {
        watchingOffset = true;
        onValue(ref(db, '.info/serverTimeOffset'), (s) => { offset = Number(s.val()) || 0; });
      }
      return uid;
    },
    serverNow: () => Date.now() + offset,
  };
}

let main: Client | null = null;
export function client(): Client {
  return (main ??= createClient());
}
