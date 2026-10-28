// client/src/ui/TeacherDashboard.ts
import { getClassStudentsWithToday, deleteStudentUser, type StudentSummary } from '../firebase/userStore';
import { type Classroom } from '../firebase/classrooms';
import { todayKstKey } from '../utils/dateKst';

const STYLE = `
  #mumu-teacher-overlay {
    position: fixed; inset: 0;
    background: #FAFAF8;
    z-index: 1100;
    overflow: auto;
    font-family: 'Pretendard Variable', 'Pretendard', 'Malgun Gothic', sans-serif;
    color: #000;
  }
  #mumu-teacher-overlay .wrap {
    max-width: 1080px;
    margin: 0 auto;
    padding: 28px 24px 56px;
  }
  #mumu-teacher-overlay .top {
    display: flex; align-items: flex-end; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
    border-bottom: 1.5px solid #000;
    padding-bottom: 14px;
    margin-bottom: 22px;
  }
  #mumu-teacher-overlay h1 {
    font-size: 26px; margin: 0;
    letter-spacing: -0.5px;
  }
  #mumu-teacher-overlay .meta {
    font-size: 13px; color: #555;
  }
  #mumu-teacher-overlay .meta b { color: #4F46E5; }
  #mumu-teacher-overlay .actions { display: flex; gap: 8px; align-items: center; }
  #mumu-teacher-overlay button {
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 8px 14px;
    background: #FFFFFF;
    color: #000;
    border: 1.5px solid #000;
    border-radius: 6px;
    box-shadow: 2px 2px 0 #000;
    cursor: pointer;
    transition: transform .08s, box-shadow .08s;
  }
  #mumu-teacher-overlay button:hover { background: #FFF8E0; }
  #mumu-teacher-overlay button:active {
    transform: translate(2px, 2px); box-shadow: 0 0 0 #000;
  }
  #mumu-teacher-overlay button.primary { background: #4F46E5; color: #fff; }
  #mumu-teacher-overlay button.primary:hover { background: #5e55ec; }
  #mumu-teacher-overlay button.danger { background: #FEE2E2; color: #991B1B; border-color: #991B1B; }
  #mumu-teacher-overlay button.danger:hover { background: #FECACA; }
  #mumu-teacher-overlay button.small {
    padding: 4px 10px; font-size: 11px;
    box-shadow: 1.5px 1.5px 0 #000;
  }
  #mumu-teacher-overlay td.cred {
    font-family: 'D2Coding', 'Galmuri11', monospace;
    font-size: 12px;
    color: #4F46E5;
  }
  #mumu-teacher-overlay td.action { text-align: center; }

  #mumu-teacher-overlay .grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 20px;
  }
  @media (max-width: 900px) {
    #mumu-teacher-overlay .grid { grid-template-columns: 1fr; }
  }

  #mumu-teacher-overlay .card {
    background: #FFFFFF;
    border: 1.5px solid #000;
    border-radius: 12px;
    overflow: hidden;
  }
  #mumu-teacher-overlay .card .card-head {
    padding: 12px 16px;
    background: #F5F5F2;
    border-bottom: 1.5px solid #000;
    font-weight: 700;
    display: flex; justify-content: space-between; align-items: center;
  }

  /* 학급 정보 카드 */
  #mumu-teacher-overlay .info-box {
    padding: 16px;
  }
  #mumu-teacher-overlay .info-row {
    display: flex; justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    border-bottom: 1px dashed #ddd;
  }
  #mumu-teacher-overlay .info-row:last-child { border-bottom: none; }
  #mumu-teacher-overlay .info-row b { color: #4F46E5; }
  #mumu-teacher-overlay .notice {
    margin-top: 14px;
    padding: 12px 14px;
    background: #FFFBEB;
    border: 1.5px solid #000;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: #555;
  }
  #mumu-teacher-overlay .notice b { color: #000; }

  /* 학생 통계 테이블 */
  #mumu-teacher-overlay table {
    width: 100%; border-collapse: collapse; font-size: 14px;
  }
  #mumu-teacher-overlay th, #mumu-teacher-overlay td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  #mumu-teacher-overlay th {
    background: #F5F5F2;
    font-weight: 700;
    border-bottom: 1.5px solid #000;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  #mumu-teacher-overlay td.num { text-align: right; font-variant-numeric: tabular-nums; }
  #mumu-teacher-overlay tr:hover td { background: #FFFBEF; }
  #mumu-teacher-overlay .err-rate-high { color: #C2410C; font-weight: 700; }
  #mumu-teacher-overlay .err-rate-mid  { color: #A16207; }
  #mumu-teacher-overlay .empty {
    padding: 32px 20px; text-align: center;
    color: #666; font-size: 14px;
    line-height: 1.6;
  }
  #mumu-teacher-overlay .loading {
    padding: 32px; text-align: center; color: #888;
  }
  #mumu-teacher-overlay .footer {
    margin-top: 14px;
    font-size: 12px;
    color: #666;
  }
`;

export interface TeacherDashboardOptions {
  classroom: Classroom;
  onLogout: () => void;
  onPlayGame?: () => void;
}

function fmtCoin(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
function fmtErrorRate(r: number): string {
  if (!isFinite(r) || r === 0) return '0%';
  return `${Math.round(r * 100)}%`;
}
function errorRateClass(r: number): string {
  if (r >= 0.4) return 'err-rate-high';
  if (r >= 0.2) return 'err-rate-mid';
  return '';
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

export function showTeacherDashboard(opts: TeacherDashboardOptions): void {
  const { classroom } = opts;
  const styleTag = document.createElement('style');
  styleTag.textContent = STYLE;
  document.head.appendChild(styleTag);

  const overlay = document.createElement('div');
  overlay.id = 'mumu-teacher-overlay';
  overlay.innerHTML = `
    <div class="wrap">
      <div class="top">
        <div>
          <h1>👨‍🏫 학급 통계 대시보드</h1>
          <div class="meta">
            <b>${escapeHtml(classroom.schoolName)}</b>
            ${classroom.grade}학년 ${classroom.classNumber}반 ·
            선생님 <b>${escapeHtml(classroom.teacherName)}</b> ·
            기준일 ${todayKstKey()} (KST)
          </div>
        </div>
        <div class="actions">
          <button id="mumu-play" class="primary">🎮 게임 플레이</button>
          <button id="mumu-refresh">새로고침</button>
          <button id="mumu-logout">로그아웃</button>
        </div>
      </div>

      <div class="grid">
        <!-- 좌측: 학생 통계 -->
        <div class="card">
          <div class="card-head">📊 학생 통계 (오늘 + 누적)</div>
          <div id="mumu-tbl" class="loading">불러오는 중…</div>
        </div>

        <!-- 우측: 학급 정보 -->
        <div>
          <div class="card">
            <div class="card-head">🏫 학급 정보</div>
            <div class="info-box">
              <div class="info-row"><span>학교</span><b>${escapeHtml(classroom.schoolName)}</b></div>
              <div class="info-row"><span>학년</span><b>${classroom.grade}학년</b></div>
              <div class="info-row"><span>반</span><b>${classroom.classNumber}반</b></div>
              <div class="notice">
                학생에게 이렇게 안내하세요:<br/>
                <b>"${escapeHtml(classroom.schoolName)} ${classroom.grade}학년 ${classroom.classNumber}반"</b>으로
                회원가입하면 우리 반에 자동으로 들어와요.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        ※ 디스코인은 학생이 챕터 보스를 처치한 시점에 적립됩니다. 도중에 그만둔 코인은 누적되지 않아요.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const refreshBtn = overlay.querySelector('#mumu-refresh') as HTMLButtonElement;
  const logoutBtn = overlay.querySelector('#mumu-logout') as HTMLButtonElement;
  const tblBox = overlay.querySelector('#mumu-tbl') as HTMLElement;

  async function loadStats(): Promise<void> {
    tblBox.className = 'loading';
    tblBox.innerHTML = '불러오는 중…';
    try {
      const rows = await getClassStudentsWithToday(classroom.classCode);
      renderStats(rows);
    } catch (e) {
      tblBox.className = 'empty';
      tblBox.textContent = '학생 통계를 불러오지 못했어요.';
      console.error(e);
    }
  }

  function renderStats(rows: StudentSummary[]): void {
    if (rows.length === 0) {
      tblBox.className = 'empty';
      tblBox.innerHTML = `
        아직 우리 반에 가입한 학생이 없어요.<br/>
        학생들에게 같은 학교·학년·반으로 <b>회원가입</b>하라고 안내해주세요.
      `;
      return;
    }
    tblBox.className = '';
    const body = rows.map((r) => {
      const attempts = r.totalCorrect + r.totalWrong;
      const username = r.username || '—';
      const pw = r.displayPassword || '—';
      return `
        <tr data-uid="${escapeHtml(r.uid)}" data-name="${escapeHtml(r.name)}">
          <td>${escapeHtml(r.name)}</td>
          <td class="cred">${escapeHtml(username)}</td>
          <td class="cred">${escapeHtml(pw)}</td>
          <td class="num">${fmtCoin(r.todayCoins)}</td>
          <td class="num">${fmtCoin(r.totalCoins)}</td>
          <td class="num">${r.totalCorrect}</td>
          <td class="num">${r.totalWrong}</td>
          <td class="num ${errorRateClass(r.errorRate)}">${fmtErrorRate(r.errorRate)}</td>
          <td class="action"><button class="small danger" data-act="del">🗑 삭제</button></td>
        </tr>
      `;
    }).join('');
    tblBox.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>아이디</th>
            <th>비번</th>
            <th style="text-align:right;">오늘 DC</th>
            <th style="text-align:right;">누적 DC</th>
            <th style="text-align:right;">정답</th>
            <th style="text-align:right;">오답</th>
            <th style="text-align:right;">오답률</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;

    // 삭제 버튼 핸들러
    tblBox.querySelectorAll<HTMLButtonElement>('button[data-act="del"]').forEach((btn) => {
      btn.onclick = async () => {
        const tr = btn.closest('tr') as HTMLTableRowElement | null;
        if (!tr) return;
        const uid = tr.dataset.uid ?? '';
        const name = tr.dataset.name ?? '';
        if (!uid) return;
        const ok = confirm(`${name} 학생을 우리 반에서 삭제할까요?\n\n학생의 게임 진행 기록(코인·정답·오답)이 모두 사라집니다.\n학생이 다시 들어오려면 새 아이디로 회원가입해야 해요.`);
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = '삭제 중…';
        try {
          await deleteStudentUser(uid);
          await loadStats();
        } catch (e) {
          alert('삭제 실패: ' + (e instanceof Error ? e.message : String(e)));
          console.error(e);
          btn.disabled = false;
          btn.textContent = '🗑 삭제';
        }
      };
    });
  }

  refreshBtn.onclick = () => { void loadStats(); };
  const playBtn = overlay.querySelector('#mumu-play') as HTMLButtonElement | null;
  if (playBtn) {
    if (opts.onPlayGame) {
      playBtn.onclick = () => {
        document.body.removeChild(overlay);
        document.head.removeChild(styleTag);
        opts.onPlayGame!();
      };
    } else {
      playBtn.style.display = 'none';
    }
  }
  logoutBtn.onclick = () => {
    document.body.removeChild(overlay);
    document.head.removeChild(styleTag);
    opts.onLogout();
  };

  void loadStats();
}
