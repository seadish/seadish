// 교사 탭이 오래 뒤에 있으면 크롬이 setInterval을 1분에 한 번으로 줄인다.
// 전용 Worker의 타이머는 그렇게 줄이지 않으므로, 가능하면 Worker가 박자를 보낸다.
export function startTicker(fn: () => void, ms: number): () => void {
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL?.createObjectURL === 'function') {
    try {
      const src = `setInterval(() => postMessage(0), ${ms});`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => fn();
      return () => { worker.terminate(); URL.revokeObjectURL(url); };
    } catch { /* Worker를 못 쓰면 아래로 */ }
  }
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}
