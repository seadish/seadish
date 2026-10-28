// client/src/utils/dateKst.ts
const KST_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayKstKey(now: Date = new Date()): string {
  return KST_FMT.format(now);
}
