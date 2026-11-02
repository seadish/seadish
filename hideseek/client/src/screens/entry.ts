import { h, mount } from '../ui/dom';

export interface EntryHandlers {
  /** 오류가 있으면 보여줄 문구를 돌려준다. */
  student(code: string, name: string): Promise<string | null>;
  teacher(teacherCode: string): Promise<string | null>;
}

export function showEntry(handlers: EntryHandlers): void {
  const error = h('div', { class: 'error', testid: 'entry-error' });
  const code = h('input', { testid: 'room-code-input', inputMode: 'numeric', maxLength: 4, placeholder: '방 코드 4자리' });
  const name = h('input', { testid: 'name-input', maxLength: 8, placeholder: '이름 (1~8글자)' });
  const tcode = h('input', { testid: 'teacher-code-input', type: 'password', placeholder: '교사 코드' });

  const run = async (btn: HTMLButtonElement, fn: () => Promise<string | null>) => {
    btn.disabled = true;
    error.textContent = '';
    try {
      const msg = await fn();
      if (msg) error.textContent = msg;
    } catch (e) {
      console.error(e);
      error.textContent = '연결에 문제가 있어요. 잠시 후 다시 해 주세요.';
    } finally {
      btn.disabled = false;
    }
  };
  const join: HTMLButtonElement = h('button', {
    testid: 'join-btn',
    onclick: () => run(join, () => handlers.student(code.value.trim(), name.value)),
  }, '입장하기');
  const teach: HTMLButtonElement = h('button', {
    testid: 'teacher-btn', class: 'ghost',
    onclick: () => run(teach, () => handlers.teacher(tcode.value)),
  }, '방 만들기 / 돌아가기');
  for (const [input, btn] of [[code, join], [name, join], [tcode, teach]] as const) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  }

  mount(h('div', { class: 'center' },
    h('div', { class: 'entry panel' },
      h('h1', {}, '🏫 학교 변신 숨바꼭질'),
      h('div', { class: 'sub' }, '교실 물건으로 변신해서 술래를 속여 보세요!'),
      h('div', { class: 'row' },
        h('div', { class: 'card', testid: 'role-student' }, h('h2', {}, '🙋 학생'), code, name, join),
        h('div', { class: 'card', testid: 'role-teacher' }, h('h2', {}, '🧑‍🏫 선생님'), tcode, teach),
      ),
      error,
    ),
  ));
  code.focus();
}

export const JOIN_ERRORS: Record<string, string> = {
  notfound: '방 코드를 다시 확인해 주세요',
  full: '방이 꽉 찼어요 (7명)',
  kicked: '선생님이 입장을 막았어요',
  badname: '이름은 1~8글자로 써 주세요',
};
