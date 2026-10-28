// client/src/ui/Leaderboard.ts
import type { LeaderboardEntry } from '../firebase/userStore';

const STYLE = `
  #mumu-lb-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    font-family: 'Malgun Gothic', monospace, sans-serif;
  }
  #mumu-lb-overlay .card {
    background: linear-gradient(160deg, #1a1a2e 0%, #16213e 100%);
    padding: 24px;
    border-radius: 14px;
    border: 2px solid #FFD700;
    width: 420px; max-width: 92vw; max-height: 80vh;
    display: flex; flex-direction: column;
  }
  #mumu-lb-overlay h2 {
    color: #FFD700; margin: 0 0 4px;
    font-size: 22px; text-align: center;
  }
  #mumu-lb-overlay .sub {
    color: #aaccff; font-size: 13px; text-align: center; margin-bottom: 14px;
  }
  #mumu-lb-overlay .list {
    overflow-y: auto; flex: 1; min-height: 200px;
    border: 1px solid #333; border-radius: 8px;
    background: rgba(0,0,0,0.3);
  }
  #mumu-lb-overlay .row {
    display: flex; align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid #2a2a3a;
    color: #fff; font-size: 14px;
  }
  #mumu-lb-overlay .row:last-child { border-bottom: none; }
  #mumu-lb-overlay .row.me { background: rgba(255, 215, 0, 0.12); }
  #mumu-lb-overlay .rank {
    width: 36px; font-weight: bold; color: #FFD700;
  }
  #mumu-lb-overlay .name { flex: 1; }
  #mumu-lb-overlay .lvl { color: #aaccff; font-size: 12px; margin-right: 10px; }
  #mumu-lb-overlay .coins { color: #ffec5c; font-weight: bold; }
  #mumu-lb-overlay .empty {
    padding: 30px; text-align: center; color: #888; font-size: 13px;
  }
  #mumu-lb-overlay .close {
    margin-top: 14px; padding: 10px;
    background: #444; color: #fff; border: none; border-radius: 6px;
    cursor: pointer; font-family: inherit; font-size: 14px; font-weight: bold;
  }
  #mumu-lb-overlay .close:hover { background: #666; }
  #mumu-lb-overlay .loading {
    padding: 40px; text-align: center; color: #aaa; font-size: 13px;
  }
`;

export function showLeaderboard(
  classCode: string,
  entriesPromise: Promise<LeaderboardEntry[]>,
  myUid: string | null,
): Promise<void> {
  return new Promise((resolve) => {
    const styleTag = document.createElement('style');
    styleTag.textContent = STYLE;
    document.head.appendChild(styleTag);

    const overlay = document.createElement('div');
    overlay.id = 'mumu-lb-overlay';
    overlay.innerHTML = `
      <div class="card">
        <h2>🏆 학급 랭킹</h2>
        <div class="sub">${escapeHtml(classCode)}</div>
        <div class="list" id="mumu-lb-list">
          <div class="loading">불러오는 중…</div>
        </div>
        <button class="close" id="mumu-lb-close">닫기</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('#mumu-lb-list') as HTMLDivElement;
    const close = overlay.querySelector('#mumu-lb-close') as HTMLButtonElement;

    const cleanup = () => {
      document.body.removeChild(overlay);
      document.head.removeChild(styleTag);
      resolve();
    };

    close.addEventListener('click', cleanup);

    entriesPromise
      .then((entries) => {
        if (entries.length === 0) {
          list.innerHTML = `<div class="empty">아직 친구들의 기록이 없어요.<br/>1등이 되어보세요!</div>`;
          return;
        }
        list.innerHTML = entries.map((e, i) => {
          const isMe = e.uid === myUid;
          const dc = (Math.round(e.coins * 10) / 10).toFixed(1);
          const crown = e.cleared ? ' 👑' : '';
          return `
            <div class="row ${isMe ? 'me' : ''}">
              <div class="rank">${i + 1}.</div>
              <div class="name">${escapeHtml(e.name)}${crown}</div>
              <div class="lvl">Lv.${e.bestLevel}</div>
              <div class="coins">${dc} DC</div>
            </div>
          `;
        }).join('');
      })
      .catch(() => {
        list.innerHTML = `<div class="empty">랭킹을 불러오지 못했어요.</div>`;
      });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
