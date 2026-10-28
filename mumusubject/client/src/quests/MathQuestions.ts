// client/src/quests/MathQuestions.ts
// 학년별 수학 문제 생성 시스템
// 몬스터 타입별 특기 문제 70% + 전체 랜덤 30% (혼합 방식)

export const GRADES = {
  G12: '1~2학년',
  G34: '3~4학년',
  G56: '5~6학년',
} as const;

export type Grade = typeof GRADES[keyof typeof GRADES];

export const MONSTER_TYPES = ['slime', 'goblin', 'orc', 'witch', 'skeleton', 'dragon'] as const;
export type MonsterType = typeof MONSTER_TYPES[number];
export type MonsterTypeOrBoss = MonsterType | 'boss' | 'archangel';

export const MONSTER_NAMES: Record<MonsterTypeOrBoss, string> = {
  slime:     '슬라임',
  goblin:    '고블린',
  orc:       '오크전사',
  witch:     '마녀',
  skeleton:  '해골기사',
  dragon:    '드래곤',
  boss:      '수학 마왕 👑',
  archangel: '타락한 대천사 👼',
};

export interface Question {
  question: string;
  answer: number;
}

type Specialty = 'basic' | 'operation' | 'measurement' | 'pattern' | 'applied' | 'hard' | 'all';
type QuestionFactory = () => Question;
type Pool = Record<Exclude<Specialty, 'all'>, QuestionFactory[]>;

const MONSTER_SPECIALTY: Record<MonsterTypeOrBoss, Specialty> = {
  slime:     'basic',
  goblin:    'operation',
  orc:       'measurement',
  witch:     'pattern',
  skeleton:  'applied',
  dragon:    'hard',
  boss:      'all',
  archangel: 'all',
};

export class MathQuestionGenerator {
  private grade: Grade;

  constructor(grade: Grade = GRADES.G12) {
    this.grade = grade;
  }

  setGrade(grade: Grade): void { this.grade = grade; }

  generate(monsterType: MonsterTypeOrBoss = 'slime'): Question {
    const specialty = MONSTER_SPECIALTY[monsterType] ?? 'all';
    const allPool = this._pool('all');

    if (specialty === 'all') {
      return pick(allPool)();
    }

    const specialPool = this._pool(specialty);
    const useSpecialty = Math.random() < 0.7 && specialPool.length > 0;
    return useSpecialty ? pick(specialPool)() : pick(allPool)();
  }

  private _pool(category: Specialty): QuestionFactory[] {
    switch (this.grade) {
      case GRADES.G34: return this._pool34(category);
      case GRADES.G56: return this._pool56(category);
      default:         return this._pool12(category);
    }
  }

  private _pool12(category: Specialty): QuestionFactory[] {
    const pools: Pool = {
      basic: [
        () => { const a = rand(1,10), b = rand(1,10); return q(`${a} + ${b} = ?`, a+b); },
        () => { const a = rand(5,15), b = rand(1,a); return q(`${a} - ${b} = ?`, a-b); },
        () => { const a = rand(5,9), b = rand(10-a,9); return q(`${a} + ${b} = ?`, a+b); },
        () => { const ans=rand(2,9), b=rand(1,5); return q(`□ + ${b} = ${ans+b},  □ 는?`, ans); },
        () => { const ans=rand(1,8), b=rand(1,5); return q(`${ans+b} - □ = ${ans},  □ 는?`, b); },
        () => { const a=rand(10,20), b=rand(1,a-1); return q(`${a} - ${b} = ?`, a-b); },
      ],
      operation: [
        () => { const b=rand(1,9); return q(`2 × ${b} = ?`, 2*b); },
        () => { const b=rand(1,9); return q(`3 × ${b} = ?`, 3*b); },
        () => { const b=rand(1,9); return q(`5 × ${b} = ?`, 5*b); },
        () => { const b=rand(2,5), ans=rand(1,5); return q(`${b*ans} ÷ ${b} = ?`, ans); },
        () => { const a=rand(2,5), b=rand(2,5); return q(`${a} × ${b} = ?`, a*b); },
      ],
      measurement: [
        () => { const h=rand(1,10), add=rand(1,3); return q(`${h}시에서 ${add}시간 후는 몇 시?`, h+add); },
        () => { const n=rand(2,9); return q(`100원짜리 ${n}개는 모두 몇 원?`, 100*n); },
        () => { const n=rand(2,9); return q(`10개씩 ${n}묶음은 모두 몇 개?`, 10*n); },
        () => { const a=rand(3,8), b=rand(3,8); return q(`${a}cm + ${b}cm = ?cm`, a+b); },
        () => { const n=rand(2,5); return q(`50원짜리 ${n}개는 모두 몇 원?`, 50*n); },
      ],
      pattern: [
        () => { const s=rand(1,5), d=rand(2,4), c=rand(3,5); const seq=Array.from({length:c},(_,i)=>s+i*d); return q(`${seq.join(', ')}, □ = ?`, s+c*d); },
        () => { const s=rand(2,8), d=2, c=rand(3,5); const seq=Array.from({length:c},(_,i)=>s+i*d); return q(`${seq.join(', ')}, □ = ?`, s+c*d); },
        () => { const s=rand(10,30); return q(`${s}, ${s-2}, ${s-4}, ${s-6}, □ = ?`, s-8); },
      ],
      applied: [
        () => { const t=rand(10,20), e=rand(1,t-1); return q(`사탕 ${t}개에서 ${e}개 먹으면 남은 개수는?`, t-e); },
        () => { const a=rand(3,8), b=rand(3,8); return q(`어항에 금붕어 ${a}마리, 열대어 ${b}마리 — 모두 몇 마리?`, a+b); },
        () => { const p=rand(2,8), c=rand(2,4); return q(`사과가 한 바구니에 ${p}개씩 ${c}바구니 — 모두 몇 개?`, p*c); },
      ],
      hard: [
        () => { const b=rand(1,9); return q(`4 × ${b} = ?`, 4*b); },
        () => { const b=rand(1,9); return q(`6 × ${b} = ?`, 6*b); },
        () => { const ans=rand(2,9), b=rand(1,5); return q(`□ × ${b} = ${ans*b},  □ 는?`, ans); },
      ],
    };
    if (category === 'all') return Object.values(pools).flat();
    return pools[category] ?? pools.basic;
  }

  private _pool34(category: Specialty): QuestionFactory[] {
    const pools: Pool = {
      basic: [
        () => { const a=rand(15,80), b=rand(10,99-a); return q(`${a} + ${b} = ?`, a+b); },
        () => { const a=rand(30,99), b=rand(10,a-5); return q(`${a} - ${b} = ?`, a-b); },
        () => { const ans=rand(5,20), b=rand(3,8); return q(`□ + ${b} = ${ans+b},  □ 는?`, ans); },
        () => { const a=rand(20,80), b=rand(5,a-5); return q(`${a} - ${b} = ?`, a-b); },
      ],
      operation: [
        () => { const a=rand(2,9), b=rand(2,9); return q(`${a} × ${b} = ?`, a*b); },
        () => { const b=rand(2,9), ans=rand(2,9); return q(`${b*ans} ÷ ${b} = ?`, ans); },
        () => { const a=rand(2,7), b=rand(2,5), c=rand(2,4); return q(`(${a} + ${b}) × ${c} = ?`, (a+b)*c); },
        () => { const a=rand(2,6), b=rand(2,6), c=rand(1,9); return q(`${a} × ${b} + ${c} = ?`, a*b+c); },
        () => { const b=rand(2,9), ans=rand(2,9); return q(`${b} × □ = ${b*ans},  □ 는?`, ans); },
      ],
      measurement: [
        () => { const h=rand(1,3), m=rand(5,55); return q(`${h}시간 ${m}분은 모두 몇 분?`, h*60+m); },
        () => { const w=rand(3,9), h=rand(3,9); return q(`가로 ${w}cm, 세로 ${h}cm 직사각형의 넓이는?`, w*h); },
        () => { const price=rand(2,8)*100, count=rand(2,5); return q(`${price}원짜리 ${count}개의 값은?`, price*count); },
        () => { const price=rand(2,9)*100; return q(`${price}원 물건에 1000원 내면 거스름돈은?`, 1000-price); },
        () => { const m=rand(10,50)*10; return q(`${m}분은 몇 시간 몇 분? — 시간 부분만:`, Math.floor(m/60)); },
      ],
      pattern: [
        () => { const s=rand(5,20), d=rand(3,7), c=rand(3,5); const seq=Array.from({length:c},(_,i)=>s+i*d); return q(`${seq.join(', ')}, □ = ?`, s+c*d); },
        () => { const s=rand(20,50); return q(`${s}, ${s-4}, ${s-8}, ${s-12}, □ = ?`, s-16); },
        () => { const n=rand(2,5), total=n*rand(2,6); return q(`${total}의 1/${n}은?`, total/n); },
      ],
      applied: [
        () => { const b=rand(3,7), qv=rand(2,8), r=rand(1,b-1); return q(`${b*qv+r} ÷ ${b}의 나머지는?`, r); },
        () => { const n=rand(2,5), total=n*rand(2,6); return q(`${total}개를 ${n}명이 똑같이 나누면 1인당?`, total/n); },
        () => { const a=rand(3,8), b=rand(2,4); return q(`한 상자에 ${a}개씩 ${b}상자, 그리고 낱개 ${a-1}개 — 총?`, a*b+(a-1)); },
      ],
      hard: [
        () => { const a=rand(3,8), b=rand(3,8), c=rand(2,5); return q(`${a} × ${b} - ${c} = ?`, a*b-c); },
        () => { const a=rand(2,7), b=rand(2,5), c=rand(1,5); return q(`(${a} + ${b}) × ${c} - ${a} = ?`, (a+b)*c-a); },
        () => { const n=rand(2,5), total=n*rand(3,7); return q(`${total}의 1/${n}의 2배는?`, total/n*2); },
      ],
    };
    if (category === 'all') return Object.values(pools).flat();
    return pools[category] ?? pools.basic;
  }

  private _pool56(category: Specialty): QuestionFactory[] {
    const pools: Pool = {
      basic: [
        () => { const a=rand(100,500), b=rand(100,500); return q(`${a} + ${b} = ?`, a+b); },
        () => { const a=rand(300,999), b=rand(100,a-50); return q(`${a} - ${b} = ?`, a-b); },
        () => { const a=rand(50,200), b=rand(50,200); return q(`${a} + ${b} = ?`, a+b); },
      ],
      operation: [
        () => { const a=rand(10,25), b=rand(2,12); return q(`${a} × ${b} = ?`, a*b); },
        () => { const b=rand(2,12), ans=rand(10,25); return q(`${b*ans} ÷ ${b} = ?`, ans); },
        () => { const a=rand(5,20), b=rand(3,10), c=rand(2,5); return q(`${a} × ${b} - ${c} = ?`, a*b-c); },
        () => { const a=rand(3,9), b=rand(3,9), c=rand(2,5); return q(`(${a} + ${b}) × ${c} = ?`, (a+b)*c); },
      ],
      measurement: [
        () => { const speed=rand(2,8)*10, time=rand(2,5); return q(`시속 ${speed}km로 ${time}시간 가면 몇 km?`, speed*time); },
        () => { const price=rand(3,9)*100, paid=Math.ceil(price/1000)*1000; return q(`${price}원 물건에 ${paid}원 내면 거스름돈은?`, paid-price); },
        () => { const a=rand(1,9); return q(`${a}.5 × 2 = ?`, a*2+1); },
        () => { const a=rand(1,9); return q(`${a}.5 + ${a}.5 = ?`, a*2+1); },
      ],
      pattern: [
        () => { const n=rand(2,6), m=n*rand(2,5); return q(`${m} × (1/${n}) = ?`, m/n); },
        () => { const base=rand(2,10)*100, pct=[10,20,25,50][rand(0,3)]; return q(`${base}의 ${pct}%는?`, base*pct/100); },
        () => { const total=rand(2,8)*50, pct=[10,20,25,50][rand(0,3)]; return q(`전체 ${total}개의 ${pct}%는?`, total*pct/100); },
      ],
      applied: [
        () => { const base=rand(2,10)*100, pct=[10,20,25,50][rand(0,3)]; return q(`${base}의 ${pct}%는?`, base*pct/100); },
        () => { const n=rand(2,6), m=n*rand(2,5); return q(`${m}을 ${n}으로 나누면?`, m/n); },
        () => { const speed=rand(3,9)*10, dist=speed*rand(2,5); return q(`${dist}km를 시속 ${speed}km로 가면 몇 시간?`, dist/speed); },
      ],
      hard: [
        () => { const g=rand(2,9), a=g*rand(2,5), b=g*rand(2,5); return q(`${a}과 ${b}의 최대공약수는?`, g); },
        () => { const a=rand(2,8), b=rand(2,8); return q(`${a}과 ${b}의 최소공배수는?`, lcm(a,b)); },
        () => { const a=rand(10,25), b=rand(2,12); return q(`${a} × ${b} = ?`, a*b); },
        () => { const a=rand(3,9), b=rand(3,9), c=rand(2,6), d=rand(1,5); return q(`${a} × ${b} + ${c} × ${d} = ?`, a*b+c*d); },
      ],
    };
    if (category === 'all') return Object.values(pools).flat();
    return pools[category] ?? pools.basic;
  }
}

function q(question: string, answer: number): Question { return { question, answer }; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function lcm(a: number, b: number): number { return a * b / gcd(a, b); }
