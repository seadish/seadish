# mumusubject

초등 수학 학습용 JRPG (Phaser 3 + Vite + TypeScript + Firebase).

## 로컬 실행

```bash
cd client
npm install
npm run dev   # http://localhost:5274
```

Firebase 환경변수가 없으면 오프라인(게스트) 모드로 동작합니다. 환경변수 목록은 `client/.env.example` 참고.

## 배포

- Vercel Framework: Vite, Root Directory: `mumusubject/client`
- Firestore 규칙: `firestore.rules`를 Firebase 콘솔 → Firestore → 규칙 탭에 게시
