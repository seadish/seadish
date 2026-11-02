type Child = Node | string | null | undefined | false;
interface Props {
  class?: string;
  testid?: string;
  text?: string;
  onclick?: (e: MouseEvent) => void;
  [attr: string]: unknown;
}

/** 작은 DOM 헬퍼: h('button', { class: 'x', testid: 'start-btn', onclick }, '시작') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'testid') el.dataset.testid = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'onclick') el.addEventListener('click', v as EventListener);
    else if (k in el) (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const ui = (): HTMLElement => document.getElementById('ui')!;
export function mount(...nodes: Node[]): void { ui().replaceChildren(...nodes); }
