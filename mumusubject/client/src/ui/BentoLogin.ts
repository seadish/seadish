// client/src/ui/BentoLogin.ts
import { searchElementarySchools, type School } from '../utils/neisSchool';

export type LoginMode = 'signup-student' | 'signup-teacher' | 'login' | 'guest';

export interface BentoLoginResult {
  mode: LoginMode;
  username?: string;
  password?: string;
  name?: string;
  teacherCode?: string;
  school?: School;
  grade?: number;
  classNumber?: number;
}

export type BentoLoginValidator = (input: BentoLoginResult) => Promise<string | null>;

// ─── localStorage: 마지막 로그인 username 기억 ──────────────
const LS_LAST_ID = 'mumusubject:lastUsername';

export function rememberUsername(u: string): void {
  try { localStorage.setItem(LS_LAST_ID, u); } catch {}
}
export function forgetUsername(): void {
  try { localStorage.removeItem(LS_LAST_ID); } catch {}
}
function loadLastUsername(): string {
  try { return localStorage.getItem(LS_LAST_ID) ?? ''; } catch { return ''; }
}

// ─── 스타일 ────────────────────────────────────────────────
const STYLE = `
  #mumu-bento-overlay {
    position: fixed; inset: 0;
    background: rgba(10, 10, 26, 0.55);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    overflow: auto;
    font-family: 'Pretendard Variable', 'Pretendard', 'Malgun Gothic', sans-serif;
    color: #000;
  }
  #mumu-bento-overlay .wrap {
    width: 100%; max-width: 920px;
    padding: 32px 24px;
  }
  #mumu-bento-overlay h1 {
    margin: 0 0 6px;
    font-size: 30px;
    text-align: center;
    letter-spacing: -0.5px;
    color: #FFD700;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9);
  }
  #mumu-bento-overlay .sub {
    text-align: center; color: #f5f5f5; font-size: 14px;
    margin: 0 0 28px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.7);
  }

  /* 벤토 카드 그리드 */
  #mumu-bento-overlay .bento {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  #mumu-bento-overlay .bento .full {
    grid-column: 1 / -1;
  }
  @media (max-width: 600px) {
    #mumu-bento-overlay .bento { grid-template-columns: 1fr; }
    #mumu-bento-overlay .bento .full { grid-column: auto; }
  }
  #mumu-bento-overlay .card {
    background: #FFFFFF;
    border: 2.5px solid #000;
    border-radius: 16px;
    box-shadow: 4px 4px 0 #000;
    padding: 26px 22px;
    cursor: pointer;
    transition: transform .1s, box-shadow .1s;
    text-align: center;
  }
  #mumu-bento-overlay .card:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 #000;
  }
  #mumu-bento-overlay .card:active {
    transform: translate(4px, 4px);
    box-shadow: 0 0 0 #000;
  }
  #mumu-bento-overlay .card.signup { background: #EEF2FF; }
  #mumu-bento-overlay .card.login { background: #FFFBEB; }
  #mumu-bento-overlay .card.guest {
    background: #F5F5F2;
    padding: 14px 22px;
    display: flex; align-items: center; justify-content: center; gap: 14px;
  }
  #mumu-bento-overlay .card.student { background: #EEF2FF; }
  #mumu-bento-overlay .card.teacher { background: #FFFBEB; }
  #mumu-bento-overlay .card.guest .emoji { font-size: 32px; }
  #mumu-bento-overlay .card.guest h2 { margin: 0; font-size: 17px; }
  #mumu-bento-overlay .card.guest p { margin: 0; font-size: 12px; }
  #mumu-bento-overlay .card .emoji { font-size: 56px; line-height: 1; }
  #mumu-bento-overlay .card h2 {
    margin: 12px 0 6px; font-size: 22px;
  }
  #mumu-bento-overlay .card p {
    margin: 0; font-size: 13px; color: #555;
  }

  /* 폼 패널 */
  #mumu-bento-overlay .panel {
    background: #FFFFFF;
    border: 2.5px solid #000;
    border-radius: 16px;
    box-shadow: 4px 4px 0 #000;
    padding: 28px;
    max-width: 460px;
    margin: 0 auto;
  }
  #mumu-bento-overlay .panel h2 {
    margin: 0 0 4px; font-size: 22px; text-align: center;
  }
  #mumu-bento-overlay .panel .panel-sub {
    text-align: center; color: #555; font-size: 13px; margin: 0 0 18px;
  }
  #mumu-bento-overlay label {
    display: block; font-size: 13px; font-weight: 700;
    margin: 12px 0 4px;
  }
  #mumu-bento-overlay input, #mumu-bento-overlay select {
    width: 100%; padding: 10px 12px;
    font: inherit; font-size: 15px;
    border: 1.5px solid #000; border-radius: 8px;
    background: #FFFFFF; color: #000;
    box-sizing: border-box;
    outline: none;
    transition: box-shadow .1s;
  }
  #mumu-bento-overlay input:focus, #mumu-bento-overlay select:focus {
    box-shadow: 3px 3px 0 #4F46E5;
  }
  #mumu-bento-overlay .hint {
    font-size: 11px; color: #777; margin-top: 4px;
  }
  #mumu-bento-overlay .err {
    color: #C2410C; font-weight: 700;
    font-size: 13px; min-height: 18px; margin: 10px 0 0;
  }
  #mumu-bento-overlay .row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }

  /* 학교 검색 */
  #mumu-bento-overlay .school-wrap { position: relative; }
  #mumu-bento-overlay .school-results {
    position: absolute; top: 100%; left: 0; right: 0;
    background: #fff; border: 1.5px solid #000; border-radius: 8px;
    max-height: 220px; overflow-y: auto;
    margin-top: 4px;
    box-shadow: 3px 3px 0 #000;
    z-index: 10;
    display: none;
  }
  #mumu-bento-overlay .school-results.show { display: block; }
  #mumu-bento-overlay .school-item {
    padding: 8px 12px; cursor: pointer; font-size: 14px;
    border-bottom: 1px solid #eee;
  }
  #mumu-bento-overlay .school-item:hover { background: #FFFBEB; }
  #mumu-bento-overlay .school-item:last-child { border-bottom: none; }
  #mumu-bento-overlay .school-item .region {
    font-size: 11px; color: #888; margin-left: 6px;
  }
  #mumu-bento-overlay .picked {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px; background: #F5F5F2;
    border: 1.5px solid #000; border-radius: 8px;
    margin-top: 4px;
  }
  #mumu-bento-overlay .picked b { font-size: 14px; }
  #mumu-bento-overlay .picked button.clear {
    background: transparent; border: 1.5px solid #000; padding: 4px 10px;
    border-radius: 6px; cursor: pointer; font-size: 12px;
  }

  /* 액션 버튼 */
  #mumu-bento-overlay button.submit {
    width: 100%; padding: 13px;
    font: inherit; font-size: 16px; font-weight: 700;
    background: #4F46E5; color: #fff;
    border: 2.5px solid #000; border-radius: 10px;
    box-shadow: 4px 4px 0 #000;
    cursor: pointer; margin-top: 18px;
    transition: transform .08s, box-shadow .08s;
  }
  #mumu-bento-overlay button.submit:hover { background: #5e55ec; }
  #mumu-bento-overlay button.submit:active {
    transform: translate(4px, 4px); box-shadow: 0 0 0 #000;
  }
  #mumu-bento-overlay button.submit:disabled { background: #999; cursor: wait; }
  #mumu-bento-overlay .back {
    background: none; border: none; color: #666;
    cursor: pointer; font-size: 13px; margin-top: 14px;
    text-decoration: underline;
  }
`;

type View = 'bento' | 'signup-choose' | 'signup-student' | 'signup-teacher' | 'login';

export function showBentoLogin(validate: BentoLoginValidator): Promise<BentoLoginResult> {
  return new Promise((resolve) => {
    const styleTag = document.createElement('style');
    styleTag.textContent = STYLE;
    document.head.appendChild(styleTag);

    const overlay = document.createElement('div');
    overlay.id = 'mumu-bento-overlay';
    overlay.innerHTML = `<div class="wrap" id="mumu-bento-root"></div>`;
    document.body.appendChild(overlay);

    const root = overlay.querySelector('#mumu-bento-root') as HTMLElement;

    let view: View = 'bento';
    let pickedSchool: School | null = null;
    let searchTimer: number | null = null;

    function close(result: BentoLoginResult): void {
      document.body.removeChild(overlay);
      document.head.removeChild(styleTag);
      resolve(result);
    }

    function render(): void {
      if (view === 'bento') return renderBento();
      if (view === 'signup-choose') return renderSignupChoose();
      if (view === 'signup-student') return renderSignupForm('student');
      if (view === 'signup-teacher') return renderSignupForm('teacher');
      if (view === 'login') return renderLogin();
    }

    function renderBento(): void {
      root.innerHTML = `
        <h1>⚔ 수학 마법사의 탑 ⚔</h1>
        <p class="sub">어떻게 들어오시겠어요?</p>
        <div class="bento">
          <div class="card signup" id="card-signup">
            <div class="emoji">📝</div>
            <h2>회원가입</h2>
            <p>새 계정 만들기 — 학생/선생님 선택</p>
          </div>
          <div class="card login" id="card-login">
            <div class="emoji">🔑</div>
            <h2>로그인</h2>
            <p>아이디·비밀번호로 들어가기</p>
          </div>
          <div class="card guest full" id="card-guest">
            <div class="emoji">🎮</div>
            <div>
              <h2>로그인 없이 체험</h2>
              <p>점수는 저장되지 않아요</p>
            </div>
          </div>
        </div>
      `;
      (root.querySelector('#card-signup') as HTMLElement).onclick = () => { view = 'signup-choose'; render(); };
      (root.querySelector('#card-login') as HTMLElement).onclick = () => { view = 'login'; render(); };
      (root.querySelector('#card-guest') as HTMLElement).onclick = () => {
        close({ mode: 'guest' });
      };
    }

    function renderSignupChoose(): void {
      root.innerHTML = `
        <h1>📝 회원가입</h1>
        <p class="sub">학생인가요, 선생님인가요?</p>
        <div class="bento">
          <div class="card student" id="card-student">
            <div class="emoji">🧒</div>
            <h2>학생</h2>
            <p>학교·학년·반에 자동 배정</p>
          </div>
          <div class="card teacher" id="card-teacher">
            <div class="emoji">👨‍🏫</div>
            <h2>선생님</h2>
            <p>학급 만들고 학생 등록</p>
          </div>
        </div>
        <p style="text-align:center; margin-top: 14px;">
          <button class="back" id="back-bento" type="button">처음으로</button>
        </p>
      `;
      (root.querySelector('#card-student') as HTMLElement).onclick = () => { view = 'signup-student'; pickedSchool = null; render(); };
      (root.querySelector('#card-teacher') as HTMLElement).onclick = () => { view = 'signup-teacher'; pickedSchool = null; render(); };
      (root.querySelector('#back-bento') as HTMLButtonElement).onclick = () => { view = 'bento'; render(); };
    }

    function renderSignupForm(role: 'student' | 'teacher'): void {
      const isTeacher = role === 'teacher';
      const emoji = isTeacher ? '👨‍🏫' : '🧒';
      const title = isTeacher ? '선생님 회원가입' : '학생 회원가입';

      root.innerHTML = `
        <div class="panel">
          <h2>${emoji} ${title}</h2>
          <p class="panel-sub">학교를 찾아 학년·반을 정하고 아이디를 만들어요</p>

          <label for="su-school-search">학교 검색</label>
          <div class="school-wrap">
            <input id="su-school-search" type="text" maxlength="30" placeholder="학교 이름 일부 입력" autocomplete="off" />
            <div id="su-school-results" class="school-results"></div>
          </div>
          <div id="su-school-picked"></div>

          <div class="row">
            <div>
              <label for="su-grade">학년</label>
              <select id="su-grade">
                <option value="">선택</option>
                <option value="1">1학년</option><option value="2">2학년</option>
                <option value="3">3학년</option><option value="4">4학년</option>
                <option value="5">5학년</option><option value="6">6학년</option>
              </select>
            </div>
            <div>
              <label for="su-class">반</label>
              <select id="su-class">
                <option value="">선택</option>
                ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${i + 1}반</option>`).join('')}
              </select>
            </div>
          </div>

          <label for="su-name">이름</label>
          <input id="su-name" type="text" maxlength="20" placeholder="${isTeacher ? '예: 이준용' : '예: 김민수'}" autocomplete="off" />

          <label for="su-username">아이디</label>
          <input id="su-username" type="text" maxlength="20" placeholder="영문/숫자/-/_ 4~20자" autocomplete="off" />
          <div class="hint">로그인 시 사용. 소문자/숫자/-/_만 가능</div>

          <label for="su-pw">비밀번호</label>
          <input id="su-pw" type="password" maxlength="40" placeholder="6자리 이상" />

          <label for="su-pw2">비밀번호 확인</label>
          <input id="su-pw2" type="password" maxlength="40" placeholder="같은 비밀번호 한 번 더" />
          <div class="hint">위와 같게 입력해주세요</div>

          ${isTeacher ? `
            <label for="su-code">교사 코드</label>
            <input id="su-code" type="text" maxlength="40" placeholder="학교에 안내된 교사 코드" autocomplete="off" />
            <div class="hint">선생님 가입에만 필요. 분실 시 학교 관리자에게 문의</div>
          ` : ''}

          <p class="err" id="su-err"></p>
          <button class="submit" id="su-submit">${isTeacher ? '학급 만들기 ▶' : '가입하고 시작 ▶'}</button>
          <button class="back" id="su-back" type="button">처음으로</button>
        </div>
      `;

      bindSchoolSearch();

      const nameInput = root.querySelector('#su-name') as HTMLInputElement;
      const usernameInput = root.querySelector('#su-username') as HTMLInputElement;
      const pwInput = root.querySelector('#su-pw') as HTMLInputElement;
      const pw2Input = root.querySelector('#su-pw2') as HTMLInputElement;
      const codeInput = root.querySelector('#su-code') as HTMLInputElement | null;
      const gradeSel = root.querySelector('#su-grade') as HTMLSelectElement;
      const classSel = root.querySelector('#su-class') as HTMLSelectElement;
      const err = root.querySelector('#su-err') as HTMLElement;
      const submit = root.querySelector('#su-submit') as HTMLButtonElement;
      const back = root.querySelector('#su-back') as HTMLButtonElement;

      back.onclick = () => { view = 'bento'; render(); };

      submit.onclick = async () => {
        const name = nameInput.value.trim();
        const username = usernameInput.value.trim().toLowerCase();
        const password = pwInput.value.trim();
        const teacherCode = codeInput?.value.trim() ?? '';
        const grade = parseInt(gradeSel.value, 10);
        const classNumber = parseInt(classSel.value, 10);

        if (!pickedSchool) { err.textContent = '학교를 검색해서 선택하세요.'; return; }
        if (!grade) { err.textContent = '학년을 선택하세요.'; return; }
        if (!classNumber) { err.textContent = '반을 선택하세요.'; return; }
        if (!name) { err.textContent = '이름을 입력하세요.'; return; }
        if (!username || !/^[a-z0-9_-]{4,20}$/.test(username)) {
          err.textContent = '아이디는 영문 소문자/숫자/-/_ 4~20자입니다.'; return;
        }
        if (password.length < 6) { err.textContent = '비밀번호는 6자리 이상입니다.'; return; }
        if (password !== pw2Input.value.trim()) {
          err.textContent = '비밀번호 확인이 일치하지 않아요.';
          pw2Input.focus();
          return;
        }
        if (isTeacher && !teacherCode) { err.textContent = '교사 코드를 입력하세요.'; return; }

        submit.disabled = true;
        submit.textContent = '확인 중…';
        err.textContent = '';

        const result: BentoLoginResult = {
          mode: isTeacher ? 'signup-teacher' : 'signup-student',
          name, username, password,
          teacherCode: isTeacher ? teacherCode : undefined,
          school: pickedSchool,
          grade, classNumber,
        };
        try {
          const msg = await validate(result);
          if (msg) {
            err.textContent = msg;
            submit.disabled = false;
            submit.textContent = isTeacher ? '학급 만들기 ▶' : '가입하고 시작 ▶';
            return;
          }
          close(result);
        } catch (e) {
          err.textContent = e instanceof Error ? e.message : '오류가 발생했어요.';
          submit.disabled = false;
          submit.textContent = isTeacher ? '학급 만들기 ▶' : '가입하고 시작 ▶';
        }
      };

      function bindSchoolSearch(): void {
        const searchInput = root.querySelector('#su-school-search') as HTMLInputElement;
        const resultsBox = root.querySelector('#su-school-results') as HTMLElement;
        const pickedBox = root.querySelector('#su-school-picked') as HTMLElement;
        searchInput.focus();

        function showPicked(): void {
          if (!pickedSchool) {
            pickedBox.innerHTML = '';
            searchInput.style.display = '';
            resultsBox.classList.remove('show');
            return;
          }
          searchInput.style.display = 'none';
          resultsBox.classList.remove('show');
          pickedBox.innerHTML = `
            <div class="picked">
              <div><b>${escapeHtml(pickedSchool.name)}</b><span class="region"> · ${escapeHtml(pickedSchool.regionName)}</span></div>
              <button class="clear" type="button" id="su-clear">변경</button>
            </div>
          `;
          (root.querySelector('#su-clear') as HTMLButtonElement).onclick = () => {
            pickedSchool = null;
            searchInput.value = '';
            showPicked();
            searchInput.focus();
          };
        }

        searchInput.oninput = () => {
          const q = searchInput.value.trim();
          if (searchTimer !== null) window.clearTimeout(searchTimer);
          if (q.length < 2) {
            resultsBox.classList.remove('show');
            resultsBox.innerHTML = '';
            return;
          }
          searchTimer = window.setTimeout(async () => {
            try {
              const schools = await searchElementarySchools(q);
              if (schools.length === 0) {
                resultsBox.innerHTML = `<div class="school-item">검색 결과 없음</div>`;
              } else {
                resultsBox.innerHTML = schools.slice(0, 30).map((s) => `
                  <div class="school-item" data-code="${s.code}">
                    ${escapeHtml(s.name)}<span class="region">${escapeHtml(s.regionName)}</span>
                  </div>
                `).join('');
                resultsBox.querySelectorAll<HTMLElement>('.school-item').forEach((el) => {
                  const code = el.dataset.code;
                  if (!code) return;
                  el.onclick = () => {
                    pickedSchool = schools.find((s) => s.code === code) ?? null;
                    showPicked();
                  };
                });
              }
              resultsBox.classList.add('show');
            } catch (e) {
              resultsBox.innerHTML = `<div class="school-item">검색 오류: ${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`;
              resultsBox.classList.add('show');
            }
          }, 300);
        };
      }
    }

    function renderLogin(): void {
      const last = loadLastUsername();
      root.innerHTML = `
        <div class="panel">
          <h2>🔑 로그인</h2>
          <p class="panel-sub">아이디와 비밀번호를 입력하세요</p>

          <label for="lg-username">아이디</label>
          <input id="lg-username" type="text" maxlength="20" placeholder="가입할 때 만든 아이디" value="${escapeHtml(last)}" autocomplete="username" />

          <label for="lg-pw">비밀번호</label>
          <input id="lg-pw" type="password" maxlength="40" placeholder="" autocomplete="current-password" />

          <p class="err" id="lg-err"></p>
          <button class="submit" id="lg-submit">시작 ▶</button>
          <button class="back" id="lg-back" type="button">처음으로</button>
        </div>
      `;
      const usernameInput = root.querySelector('#lg-username') as HTMLInputElement;
      const pwInput = root.querySelector('#lg-pw') as HTMLInputElement;
      const err = root.querySelector('#lg-err') as HTMLElement;
      const submit = root.querySelector('#lg-submit') as HTMLButtonElement;
      const back = root.querySelector('#lg-back') as HTMLButtonElement;

      (last ? pwInput : usernameInput).focus();

      back.onclick = () => { view = 'bento'; render(); };

      const onSubmit = async () => {
        const username = usernameInput.value.trim().toLowerCase();
        const password = pwInput.value.trim();
        if (!username) { err.textContent = '아이디를 입력하세요.'; return; }
        if (!password) { err.textContent = '비밀번호를 입력하세요.'; return; }

        submit.disabled = true;
        submit.textContent = '확인 중…';
        err.textContent = '';
        try {
          const result: BentoLoginResult = { mode: 'login', username, password };
          const msg = await validate(result);
          if (msg) {
            err.textContent = msg;
            submit.disabled = false;
            submit.textContent = '시작 ▶';
            return;
          }
          close(result);
        } catch (e) {
          err.textContent = e instanceof Error ? e.message : '오류가 발생했어요.';
          submit.disabled = false;
          submit.textContent = '시작 ▶';
        }
      };
      submit.onclick = onSubmit;
      pwInput.onkeydown = (e) => { if (e.key === 'Enter') onSubmit(); };
      usernameInput.onkeydown = (e) => { if (e.key === 'Enter') pwInput.focus(); };
    }

    render();
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
