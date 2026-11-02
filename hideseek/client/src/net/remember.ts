// 새로고침했을 때 같은 방으로 돌아가기 위한 기억. 다음 수업에는 이어지지 않도록 2시간만 유효하다.
export const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;

export function encodeRoom(code: string, now: number): string {
  return JSON.stringify({ code, at: now });
}

export function decodeRoom(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.code !== 'string' || typeof v?.at !== 'number') return null;
    return now - v.at <= RESUME_WINDOW_MS ? v.code : null;
  } catch {
    return null;
  }
}
