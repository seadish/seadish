// client/src/scenes/MathScene.ts
// MathScene - 수학 마법사의 탑
// 학년 선택 → 방 입장 → 몬스터 대결 → 보스전

import Phaser from 'phaser';
import {
  MathQuestionGenerator,
  GRADES,
  MONSTER_NAMES,
  type Grade,
  type MonsterTypeOrBoss,
} from '../quests/MathQuestions';
import { ROOM_CONFIG, type RoomKey, type RoomConfig } from '../config/rooms';
import {
  PLAYER_SPEED, SELECT_RADIUS, ESCAPE_EXIT_BUFFER,
  EXP_PER_KILL, COIN_PER_HIT, EXP_LEVEL_GROWTH,
  SPEED_BONUS_THRESHOLD_SEC, SPEED_BONUS_AMOUNT, COMBO_BONUS_PER_THREE,
  MAX_ANSWER_LEN, PLAYER_BOUNDS,
} from '../config/constants';
import { Player, type PlayerStats } from '../objects/Player';
import { Monster } from '../objects/Monster';
import { updateHpBar } from '../ui/HpBar';
import { Numpad } from '../ui/Numpad';
import { Joystick } from '../ui/Joystick';
import { addFullscreenButton } from '../ui/FullscreenButton';
import { showGradeSelector } from '../ui/GradeSelector';
import { showGameOver, showGameClear } from '../ui/EndScreens';
import { showBentoLogin, rememberUsername, type BentoLoginResult } from '../ui/BentoLogin';
import { showLeaderboard } from '../ui/Leaderboard';
import { showModeSelect } from '../ui/ModeSelectScreen';
import { showTeacherDashboard } from '../ui/TeacherDashboard';
import { floatText, showExpBurst, hitShake, createDustEmitter } from '../utils/effects';
import { auth } from '../firebase/config';
import { signupWithId, loginWithId, verifyTeacherCode } from '../firebase/auth';
import {
  ensureUserProfile, getUserProfile, saveProgress, getLeaderboard,
  recordAnswer, commitChapterCoins,
} from '../firebase/userStore';
import {
  makeClassCode, getClassroom, createClassroomIfNew,
  type Classroom,
} from '../firebase/classrooms';
import { getProfile, setProfile } from '../firebase/session';

interface SceneData {
  room?: RoomKey;
  stats?: PlayerStats;
  grade?: Grade;
  fromRoom?: RoomKey | null;
}

interface PedestalChallenge {
  questions: { question: string; answer: number }[];
  current: number;
  correct: number;
  inputText: string;
  inputDisplay?: Phaser.GameObjects.Text;
  overlay?: Phaser.GameObjects.Container;
  keyHandler?: (e: KeyboardEvent) => void;
}

const DEFAULT_STATS: PlayerStats = {
  level: 1, exp: 0, expToNext: 50, coins: 0, hp: 5, maxHp: 5,
};

export default class MathScene extends Phaser.Scene {
  // — 상태 —
  private room!: RoomKey;
  private stats!: PlayerStats;
  private grade!: Grade;
  private wave: number = 1;
  private gameStarted: boolean = false;
  private caveOpen: boolean = false;
  private transitioning: boolean = false;
  private inBattle: boolean = false;
  private combo: number = 0;
  private battleStartTime: number = 0;
  private answer: string = '';

  private fromRoom: boolean = false;
  private urlGrade: Grade | null = null;

  // — 게임 객체 —
  private bgImg!: Phaser.GameObjects.Image;
  private player: Player | null = null;
  private monsters: Monster[] = [];
  private selectedMonster: Monster | null = null;
  private escapedFrom: Monster | null = null;
  private generator!: MathQuestionGenerator;

  // — 입력 —
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private joystick!: Joystick;
  private numpad!: Numpad;

  // — UI —
  private gradeUI?: Phaser.GameObjects.Container;
  private hudGroup?: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private expBar!: Phaser.GameObjects.Rectangle;
  private expBarMaxW: number = 100;
  private hudHpHearts: Phaser.GameObjects.Text[] = [];

  private problemPanel!: Phaser.GameObjects.Container;
  private problemText!: Phaser.GameObjects.Text;
  private inputDisplay!: Phaser.GameObjects.Text;

  // 전투 오버레이
  private battleOverlayGroup: Phaser.GameObjects.Container | null = null;
  private battleProblemText: Phaser.GameObjects.Text | null = null;
  private battleInputText: Phaser.GameObjects.Text | null = null;
  private battleHpHearts: Phaser.GameObjects.Text[] | null = null;
  private battleComboText: Phaser.GameObjects.Text | null = null;
  private battleNameHdr: Phaser.GameObjects.Text | null = null;

  // 출구 글로우
  private exitGlow?: Phaser.GameObjects.Arc;
  private exitLabel?: Phaser.GameObjects.Text;

  // 보물방
  private pedestalGlow?: Phaser.GameObjects.Arc | null;
  private pedestalLabel?: Phaser.GameObjects.Text | null;
  private pedestalUsed: boolean = false;
  private pedestalChallenge: PedestalChallenge | null = null;

  // Firestore 저장 디바운스
  private _saveTimer: number | null = null;
  private _currentClassroom: Classroom | null = null;

  constructor() {
    super('MathScene');
  }

  init(data: SceneData): void {
    this.room          = data.room  ?? 1;
    if (data.stats) {
      this.stats = data.stats;
    } else {
      // 신규/재시작: stats.coins는 "현재 챕터 임시 코인". 항상 0에서 시작.
      // (락인된 누적 코인은 profile.coins에 별도 저장됨)
      // 레벨·경험치는 profile에서 누적값 복원 (PR 18부터). 없으면 1/0.
      const p = getProfile();
      const level = p?.level ?? 1;
      const exp = p?.exp ?? 0;
      this.stats = {
        ...DEFAULT_STATS,
        level,
        exp,
        expToNext: this._expToNextFor(level),
      };
    }
    this.grade         = data.grade ?? this._gradeFromURL() ?? GRADES.G12;
    this.fromRoom      = !!data.room;
    this.urlGrade      = !data.room ? this._gradeFromURL() : null;
    // 인스턴스 상태 초기화
    this.wave = 1;
    this.gameStarted = false;
    this.caveOpen = false;
    this.transitioning = false;
    this.inBattle = false;
    this.combo = 0;
    this.battleStartTime = 0;
    this.answer = '';
    this.player = null;
    this.monsters = [];
    this.selectedMonster = null;
    this.escapedFrom = null;
    this.battleOverlayGroup = null;
    this.battleProblemText = null;
    this.battleInputText = null;
    this.battleHpHearts = null;
    this.battleComboText = null;
    this.battleNameHdr = null;
    this.pedestalUsed = false;
    this.pedestalChallenge = null;
    this.hudHpHearts = [];
  }

  /** 주어진 레벨에 도달하는 데 필요한 expToNext 계산. */
  private _expToNextFor(level: number): number {
    let exp = DEFAULT_STATS.expToNext; // Lv.1 기준 50
    for (let i = 1; i < level; i++) {
      exp = Math.floor(exp * EXP_LEVEL_GROWTH);
    }
    return exp;
  }

  private _gradeFromURL(): Grade | null {
    const p = new URLSearchParams(window.location.search).get('grade');
    if (p === '34') return GRADES.G34;
    if (p === '56') return GRADES.G56;
    if (p === '12') return GRADES.G12;
    return null;
  }

  create(): void {
    const cfg = ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1];
    this.bgImg = this.add.image(0, 0, cfg.bg).setOrigin(0);
    if (cfg.bgTint) this.bgImg.setTint(cfg.bgTint);

    this.generator = new MathQuestionGenerator(this.grade);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this._setupKeyboard();
    createDustEmitter(this);
    this.joystick = new Joystick(this);
    this.numpad = new Numpad(this);
    this.numpad.setHandler((k) => this._numpadInput(k));

    if (this.fromRoom || this.urlGrade) {
      this.cameras.main.fadeIn(600);
      this._startGame(this.urlGrade ?? this.grade);
    } else if (getProfile()) {
      // 같은 세션 내 재시작 — 교사면 대시보드, 학생이면 학년 선택
      const p = getProfile();
      if (p?.role === 'teacher') {
        this._showTeacherDashboardForCurrentUser();
      } else {
        this._showGradeAndModeSelect();
      }
    } else {
      this._showTitleSplash();
    }

    addFullscreenButton(this);
  }

  private _showTitleSplash(): void {
    const c = this.add.container(0, 0).setDepth(50);

    c.add(this.add.image(400, 300, 'game-main').setDisplaySize(800, 600));
    c.add(this.add.rectangle(400, 60, 800, 120, 0x0a0a1a, 0.45));

    c.add(this.add.text(400, 50, '⚔ 수학 마법사의 탑 ⚔', {
      fontSize: '36px',
      color: '#FFD700',
      stroke: '#000',
      strokeThickness: 6,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(400, 92, '교육용 JRPG · 1~6학년', {
      fontSize: '15px',
      color: '#dddddd',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5));

    c.add(this.add.rectangle(400, 555, 800, 50, 0x0a0a1a, 0.55));
    const startHint = this.add.text(400, 555, '▶ 클릭해서 시작', {
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 4,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(startHint);

    this.tweens.add({
      targets: startHint,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const hit = this.add.rectangle(400, 300, 800, 600, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    c.add(hit);

    hit.once('pointerdown', () => {
      this.tweens.add({
        targets: c,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          c.destroy(true);
          this._loginThenShowGradeSelector();
        },
      });
    });
  }

  private async _openLeaderboard(): Promise<void> {
    const profile = getProfile();
    if (!profile) return;
    const u = auth.currentUser;
    await showLeaderboard(
      profile.classCode,
      getLeaderboard(profile.classCode, 20),
      u?.uid ?? null,
    );
  }

  private async _loginThenShowGradeSelector(): Promise<void> {
    await showBentoLogin(async (input) => {
      try {
        if (input.mode === 'guest') {
          return null;
        }
        if (input.mode === 'login') {
          await this._handleLogin(input);
        } else if (input.mode === 'signup-student' || input.mode === 'signup-teacher') {
          await this._handleSignup(input);
        }
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : '오류가 발생했어요. 잠시 후 다시 시도해주세요.';
      }
    });

    const profile = getProfile();
    if (profile?.role === 'teacher') {
      this._showTeacherDashboardForCurrentUser();
      return;
    }
    this._showGradeAndModeSelect();
  }

  /** 회원가입 흐름: 학생/교사 공통 — 학교/학년/반/이름/아이디/비번 + 교사 코드(교사만) */
  private async _handleSignup(input: BentoLoginResult): Promise<void> {
    if (!input.school || !input.grade || !input.classNumber) {
      throw new Error('학교·학년·반을 모두 선택하세요.');
    }
    if (!input.name || !input.username || !input.password) {
      throw new Error('이름·아이디·비밀번호를 모두 입력하세요.');
    }
    const isTeacher = input.mode === 'signup-teacher';
    if (isTeacher) {
      if (!input.teacherCode || !verifyTeacherCode(input.teacherCode)) {
        throw new Error('교사 코드가 올바르지 않아요.');
      }
    }

    const classCode = makeClassCode(input.school.code, input.grade, input.classNumber);
    const role = isTeacher ? 'teacher' : 'student';

    const { user } = await signupWithId(input.username, input.password, role);

    const profile = await ensureUserProfile(
      user.uid, input.name, classCode, role,
      {
        schoolCode: input.school.code,
        schoolName: input.school.name,
        grade: input.grade,
        classNumber: input.classNumber,
        username: input.username,
        // 평문 비번 저장 (교사 대시보드 표시용). 보안 트레이드오프.
        displayPassword: input.password,
      },
    );
    setProfile(profile);

    // 교사면 학급(classroom) 생성/조회
    if (isTeacher) {
      let classroom = await getClassroom(classCode);
      if (!classroom) {
        classroom = await createClassroomIfNew({
          schoolCode: input.school.code,
          schoolName: input.school.name,
          grade: input.grade,
          classNumber: input.classNumber,
          teacherUid: user.uid,
          teacherName: input.name,
        });
      }
      if (!classroom) throw new Error('학급을 만들지 못했어요.');
      if (classroom.teacherUid !== user.uid) {
        throw new Error('이미 다른 선생님이 이 반을 운영 중입니다.');
      }
      this._currentClassroom = classroom;
    }

    rememberUsername(input.username);
  }

  /** 로그인 흐름: 아이디+비번 → role에 따라 자동 분기 (학생→게임, 교사→대시보드) */
  private async _handleLogin(input: BentoLoginResult): Promise<void> {
    if (!input.username || !input.password) {
      throw new Error('아이디·비밀번호를 입력하세요.');
    }
    const { user } = await loginWithId(input.username, input.password);

    const profile = await getUserProfile(user.uid);
    if (!profile) {
      throw new Error('계정 정보를 찾을 수 없어요. 회원가입을 다시 해주세요.');
    }
    setProfile(profile);

    if (profile.role === 'teacher') {
      this._currentClassroom = await getClassroom(profile.classCode);
    }

    rememberUsername(input.username);
  }

  private _showGradeAndModeSelect(): void {
    this.gradeUI = showGradeSelector(
      this,
      (grade) => this._afterGradeSelect(grade),
      () => this._openLeaderboard(),
    );
  }

  private _afterGradeSelect(grade: Grade): void {
    this.grade = grade;
    this.generator.setGrade(grade);
    this.gradeUI?.destroy();
    this.gradeUI = undefined;
    showModeSelect(this, (mode) => {
      void mode;
      this._startGame(grade);
    });
  }

  private async _showTeacherDashboardForCurrentUser(): Promise<void> {
    const profile = getProfile();
    if (!profile) return;
    if (!this._currentClassroom || this._currentClassroom.classCode !== profile.classCode) {
      this._currentClassroom = await getClassroom(profile.classCode);
    }
    if (!this._currentClassroom) {
      console.error('교사 학급 정보를 찾을 수 없음:', profile.classCode);
      return;
    }
    showTeacherDashboard({
      classroom: this._currentClassroom,
      onLogout: () => {
        setProfile(null);
        this._currentClassroom = null;
        try { void auth.signOut?.(); } catch {}
        this.scene.restart({} as SceneData);
      },
      onPlayGame: () => {
        this._showGradeAndModeSelect();
      },
    });
  }

  private _startGame(grade: Grade): void {
    this.grade = grade;
    this.generator.setGrade(grade);
    this.gameStarted = true;
    this.gradeUI?.destroy();
    this.gradeUI = undefined;

    const cfg = ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1];
    this.player = new Player(this, cfg.playerStart.x, cfg.playerStart.y, this.stats.level);

    if (cfg.isTreasureRoom) {
      this._setupTreasureRoom(cfg);
    } else {
      this._spawnMonsters();
    }

    this._createHUD();
    this._createProblemPanel();
    this._refreshHUD();
  }

  // ─── 몬스터 소환 ──────────────────────────────────────────
  private _spawnMonsters(): void {
    this.monsters.forEach((m) => {
      if (m.alive) {
        m.sprite.destroy();
        m.destroyMeta();
      }
    });
    this.monsters = [];
    this.selectedMonster = null;

    const cfg = ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1];

    if (cfg.bossRoom) {
      this._spawnBoss(cfg);
      return;
    }

    cfg.monsters?.forEach(({ x, y, type }) => {
      const monster = new Monster({
        scene: this,
        x, y,
        type: type as MonsterTypeOrBoss,
        generator: this.generator,
        patrolBounds: cfg.patrolBounds,
      });

      this.time.addEvent({
        delay: 1000 + Math.random() * 1400,
        loop: true,
        callback: () => {
          if (monster.alive) monster.pickNewPatrolTarget();
        },
      });

      this.monsters.push(monster);
    });
  }

  private _spawnBoss(cfg: RoomConfig): void {
    const spawn = cfg.monsters?.[0];
    if (!spawn) return;

    const bossType = spawn.type as MonsterTypeOrBoss;
    const monster = new Monster({
      scene: this,
      x: spawn.x,
      y: spawn.y,
      type: bossType,
      generator: this.generator,
      isBoss: true,
    });
    this.monsters.push(monster);

    const intro = bossType === 'archangel'
      ? { text: '👼 타락한 대천사 강림!', color: '#aaccff' }
      : { text: '👑 수학 마왕 등장!',     color: '#ff44ff' };

    this.time.delayedCall(200, () => {
      this.cameras.main.shake(500, 0.018);
      floatText(this, 400, 270, intro.text, intro.color, 36);
    });
  }

  // ─── HUD ──────────────────────────────────────────────────
  private _createHUD(): void {
    this.hudGroup = this.add.container(0, 0).setDepth(20);

    this.hudGroup.add(this.add.rectangle(400, 16, 800, 32, 0x000000, 0.65));
    this.hudGroup.add(this.add.text(14, 16, '🪙', { fontSize: '16px' }).setOrigin(0, 0.5));

    this.coinText = this.add.text(36, 16, '0.0 DC', {
      fontSize: '15px', color: '#FFD700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.hudGroup.add(this.coinText);

    this.waveText = this.add.text(400, 16, `Wave ${this.wave}`, {
      fontSize: '16px', color: '#aaddff',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudGroup.add(this.waveText);

    this.hudGroup.add(this.add.text(570, 16, this.grade, {
      fontSize: '13px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5));

    this.levelText = this.add.text(680, 10, `Lv.${this.stats.level}`, {
      fontSize: '14px', color: '#ffffff',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudGroup.add(this.levelText);

    const EXP_W = 100;
    this.hudGroup.add(this.add.rectangle(750, 22, EXP_W, 7, 0x333333).setOrigin(0.5));
    this.expBar = this.add.rectangle(700, 22, 0, 7, 0x44aaff).setOrigin(0, 0.5);
    this.expBarMaxW = EXP_W;
    this.hudGroup.add(this.expBar);

    this.hudHpHearts = [];
    for (let i = 0; i < this.stats.maxHp; i++) {
      const heart = this.add.text(158 + i * 22, 16, '❤', {
        fontSize: '14px',
        color: i < this.stats.hp ? '#ff4444' : '#444444',
      }).setOrigin(0.5).setDepth(21);
      this.hudHpHearts.push(heart);
    }
  }

  private _refreshHUD(): void {
    const dc = (Math.round(this.stats.coins * 10) / 10).toFixed(1);
    this.coinText?.setText(`${dc} DC`);

    const ratio = Math.min(1, this.stats.exp / this.stats.expToNext);
    if (this.expBar) this.expBar.width = this.expBarMaxW * ratio;

    this.levelText?.setText(`Lv.${this.stats.level}`);
    this.waveText?.setText(`Wave ${this.wave}`);

    this.hudHpHearts.forEach((heart, i) => {
      heart.setColor(i < this.stats.hp ? '#ff4444' : '#444444');
    });

    this._scheduleSave();
  }

  private _scheduleSave(): void {
    // 코인은 보스 락인 시점에만 저장됨. 레벨·경험치는 디바운스로 갱신.
    const u = auth.currentUser;
    if (!u) return;
    if (this._saveTimer !== null) window.clearTimeout(this._saveTimer);
    const level = this.stats.level;
    const exp = this.stats.exp;
    this._saveTimer = window.setTimeout(() => {
      this._saveTimer = null;
      void saveProgress(u.uid, { level, exp }).catch(() => {});
      const profile = getProfile();
      if (profile) {
        profile.level = level;
        profile.exp = exp;
      }
    }, 1500);
  }

  private async _saveImmediate(patch: { cleared?: boolean } = {}): Promise<void> {
    const u = auth.currentUser;
    if (!u) return;
    if (this._saveTimer !== null) {
      window.clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    try {
      await saveProgress(u.uid, {
        level: this.stats.level,
        exp: this.stats.exp,
        ...patch,
      });
      const profile = getProfile();
      if (profile) {
        profile.level = this.stats.level;
        profile.exp = this.stats.exp;
        if (this.stats.level > (profile.bestLevel ?? 1)) profile.bestLevel = this.stats.level;
        if (patch.cleared) profile.cleared = true;
      }
    } catch {}
  }

  private _createProblemPanel(): void {
    this.problemPanel = this.add.container(0, 510).setDepth(20);
    this.problemPanel.add(this.add.rectangle(400, 45, 800, 90, 0x0d0d1e, 0.92));

    this.problemText = this.add.text(400, 24, '몬스터에게 가까이 가면 문제가 나타납니다!', {
      fontSize: '18px', color: '#bbbbbb', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.inputDisplay = this.add.text(400, 60, '', {
      fontSize: '21px', color: '#FFD700',
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.problemPanel.add([this.problemText, this.inputDisplay]);
  }

  // ─── 키보드 ───────────────────────────────────────────────
  private _setupKeyboard(): void {
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (!this.gameStarted || !this.selectedMonster) return;

      if (e.key >= '0' && e.key <= '9') {
        if (this.answer.length < MAX_ANSWER_LEN) {
          this.answer += e.key;
          this._refreshInput();
        }
      } else if (e.key === 'Backspace') {
        this.answer = this.answer.slice(0, -1);
        this._refreshInput();
      } else if (e.key === 'Enter' && this.answer.length > 0) {
        this._checkAnswer();
      } else if (e.key === 'Escape') {
        this._exitBattle();
      }
    });
  }

  private _refreshInput(): void {
    if (!this.selectedMonster) return;
    const cursor = (Date.now() % 500 < 250) ? '|' : ' ';
    const inputStr = `답: ${this.answer}${cursor}`;
    this.inputDisplay.setText(inputStr);
    this.battleInputText?.setText(inputStr);
  }

  // ─── update ───────────────────────────────────────────────
  update(): void {
    if (!this.gameStarted || !this.player) return;

    if (!this.inBattle) {
      const p = this.player;
      if (this.cursors.left?.isDown)  p.x -= PLAYER_SPEED;
      if (this.cursors.right?.isDown) p.x += PLAYER_SPEED;
      if (this.cursors.up?.isDown)    p.y -= PLAYER_SPEED;
      if (this.cursors.down?.isDown)  p.y += PLAYER_SPEED;

      if (this.joystick.active) {
        p.x += this.joystick.dx * PLAYER_SPEED;
        p.y += this.joystick.dy * PLAYER_SPEED;
      }

      const bounds = (ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1]).playerBounds ?? PLAYER_BOUNDS;
      p.x = Phaser.Math.Clamp(p.x, bounds.minX, bounds.maxX);
      p.y = Phaser.Math.Clamp(p.y, bounds.minY, bounds.maxY);
    }

    const now = this.time.now;
    this.monsters.forEach((m) => {
      if (m.alive) m.syncPosition(now, m === this.selectedMonster);
    });

    if (!this.inBattle && !this.transitioning) {
      const cfg = ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1];

      if (this.caveOpen && cfg.exit) {
        const ex = cfg.exit;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ex.x, ex.y);
        if (d < ex.radius) {
          cfg.isTreasureRoom ? this._exitTreasureRoom() : this._enterNextRoom();
        }
      }

      if (cfg.secretExit && this.caveOpen) {
        const se = cfg.secretExit;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, se.x, se.y);
        if (d < se.radius) this._enterTreasureRoom();
      }

      if (cfg.isTreasureRoom && cfg.pedestal && !this.pedestalUsed && !this.pedestalChallenge) {
        const ped = cfg.pedestal;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ped.x, ped.y);
        if (d < ped.radius) this._startPedestalChallenge();
      }
    }

    if (this.escapedFrom) {
      if (!this.escapedFrom.alive) {
        this.escapedFrom = null;
      } else {
        const d = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          this.escapedFrom.sprite.x, this.escapedFrom.sprite.y,
        );
        if (d >= SELECT_RADIUS + ESCAPE_EXIT_BUFFER) this.escapedFrom = null;
      }
    }

    if (!this.inBattle) {
      let nearest: Monster | null = null;
      let nearestDist = SELECT_RADIUS;
      this.monsters.filter((m) => m.alive && m !== this.escapedFrom).forEach((m) => {
        const d = Phaser.Math.Distance.Between(
          this.player!.x, this.player!.y,
          m.sprite.x, m.sprite.y,
        );
        if (d < nearestDist) { nearest = m; nearestDist = d; }
      });
      if (nearest) this._enterBattle(nearest);
    }

    if (this.selectedMonster) this._refreshInput();
  }

  // ─── 전투 ────────────────────────────────────────────────
  private _enterBattle(monster: Monster): void {
    if (this.inBattle) return;
    this.inBattle = true;
    this.combo = 0;
    this.battleStartTime = this.time.now;

    if (this.selectedMonster && this.selectedMonster !== monster) {
      this.selectedMonster.sprite.clearTint();
    }
    this.selectedMonster = monster;
    monster.sprite.setTint(0xffff88);
    this.answer = '';

    this.cameras.main.flash(250, 255, 220, 80, true);
    this.cameras.main.shake(200, 0.010);

    this._createBattleOverlay(monster);
    this.problemPanel.setVisible(false);
    floatText(this, 400, 170, `⚔  ${MONSTER_NAMES[monster.type]}`, '#ff6688', 32);
    this.numpad.show(this);
  }

  private _exitBattle(): void {
    if (!this.inBattle) return;
    this.inBattle = false;

    const escaped = this.selectedMonster;
    this.escapedFrom = (escaped && escaped.alive) ? escaped : null;

    if (this.selectedMonster && this.selectedMonster.alive) {
      this.selectedMonster.sprite.clearTint();
    }
    this.selectedMonster = null;
    this.answer = '';
    this.combo = 0;

    if (this.battleOverlayGroup) {
      const grp = this.battleOverlayGroup;
      this.tweens.add({
        targets: grp, alpha: 0, duration: 200,
        onComplete: () => {
          grp.destroy(true);
          if (this.battleOverlayGroup === grp) this.battleOverlayGroup = null;
          this.battleProblemText = null;
          this.battleInputText = null;
          this.battleHpHearts = null;
          this.battleComboText = null;
          this.battleNameHdr = null;
        },
      });
    }

    this.problemText.setText('몬스터에게 가까이 가면 문제가 나타납니다!');
    this.inputDisplay.setText('');
    this.problemPanel.setVisible(true);
    this.numpad.hide(this);
  }

  private _createBattleOverlay(monster: Monster): void {
    if (this.battleOverlayGroup) {
      this.battleOverlayGroup.destroy(true);
      this.battleOverlayGroup = null;
    }

    const grp = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    this.battleOverlayGroup = grp;

    grp.add(this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5));
    grp.add(this.add.circle(monster.sprite.x, monster.sprite.y, 95, 0x9933ff, 0.12));

    const PX = 250, PW = 460;
    grp.add(this.add.rectangle(PX, 248, PW, 2, 0x9933ff, 0.8));
    grp.add(this.add.rectangle(PX, 538, PW, 2, 0x9933ff, 0.8));
    grp.add(this.add.rectangle(PX, 393, PW, 290, 0x0a0018, 0.96));

    const portraitX = PX - PW / 2 + 50;
    const portraitY = 286;
    grp.add(this.add.circle(portraitX, portraitY, 36, 0x1a1428, 0.9)
      .setStrokeStyle(2, 0x9933ff, 0.9));
    const portrait = this.add.sprite(portraitX, portraitY, `monster-${monster.type}`).setScale(0.5);
    grp.add(portrait);
    this.tweens.add({
      targets: portrait,
      scaleX: 0.55, scaleY: 0.55,
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const qLeft = monster.maxHp - monster.hp;
    const nameHdr = this.add.text(portraitX + 50, 278, `⚔  ${MONSTER_NAMES[monster.type]}`, {
      fontSize: '17px', color: '#ff88cc',
      stroke: '#000', strokeThickness: 4,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    grp.add(nameHdr);
    this.battleNameHdr = nameHdr;

    grp.add(this.add.text(portraitX + 50, 300, `문제 ${qLeft + 1} / ${monster.maxHp}`, {
      fontSize: '13px', color: '#aaaadd', fontFamily: 'monospace',
    }).setOrigin(0, 0.5));

    this.battleProblemText = this.add.text(PX, 360, monster.problem.question, {
      fontSize: '24px', color: '#ffffff',
      stroke: '#000', strokeThickness: 5,
      fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: PW - 30 },
      align: 'center',
    }).setOrigin(0.5);
    grp.add(this.battleProblemText);

    grp.add(this.add.rectangle(PX, 430, 280, 52, 0x000000, 0.55)
      .setStrokeStyle(2, 0xFFD700, 0.85));
    this.battleInputText = this.add.text(PX, 430, '답: _', {
      fontSize: '34px', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    grp.add(this.battleInputText);

    grp.add(this.add.text(PX, 468, 'Enter = 제출   ESC = 도망가기', {
      fontSize: '12px', color: '#666688', fontFamily: 'monospace',
    }).setOrigin(0.5));

    grp.add(this.add.rectangle(PX, 484, PW - 20, 1, 0x333355, 0.8));

    const HP_Y = 510;
    grp.add(this.add.text(60, HP_Y, '내 HP', {
      fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5));

    this.battleHpHearts = [];
    for (let i = 0; i < this.stats.maxHp; i++) {
      const heart = this.add.text(95 + i * 24, HP_Y, '❤', {
        fontSize: '18px',
        color: i < this.stats.hp ? '#ff3355' : '#333333',
      }).setOrigin(0.5);
      grp.add(heart);
      this.battleHpHearts.push(heart);
    }

    this.battleComboText = this.add.text(420, HP_Y, '', {
      fontSize: '16px', color: '#ffdd00',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    grp.add(this.battleComboText);

    grp.setAlpha(0);
    this.tweens.add({ targets: grp, alpha: 1, duration: 220, ease: 'Linear' });

    this.problemText.setText(monster.problem.question);
  }

  // ─── 정답 처리 ────────────────────────────────────────────
  private _checkAnswer(): void {
    if (!this.selectedMonster) return;

    const userAns = parseInt(this.answer, 10);
    if (Number.isNaN(userAns)) {
      this.answer = '';
      this._refreshInput();
      return;
    }
    const correctAns = this.selectedMonster.problem.answer;

    if (userAns === correctAns) {
      this._onCorrect();
    } else {
      this._onWrong();
    }

    this.answer = '';
    this._refreshInput();
  }

  private _onCorrect(): void {
    const m = this.selectedMonster;
    if (!m) return;

    m.hp--;
    updateHpBar(m.hpBar, m.hp);
    this.combo++;

    const elapsed = (this.time.now - this.battleStartTime) / 1000;
    const speedBonus = elapsed < SPEED_BONUS_THRESHOLD_SEC ? SPEED_BONUS_AMOUNT : 0;
    const comboBonus = this.combo >= 3
      ? Math.round(Math.floor(this.combo / 3) * COMBO_BONUS_PER_THREE * 10) / 10
      : 0;
    const totalCoin = Math.round((COIN_PER_HIT + speedBonus + comboBonus) * 10) / 10;

    this.stats.coins = Math.round((this.stats.coins + totalCoin) * 10) / 10;
    this._refreshHUD();
    this.cameras.main.flash(180, 0, 200, 0, true);

    const uid = auth.currentUser?.uid;
    if (uid) void recordAnswer(uid, true).catch(() => {});

    let coinMsg = `+${COIN_PER_HIT} DC`;
    if (speedBonus > 0) coinMsg += ` ⚡`;
    if (comboBonus > 0) coinMsg += ` 🔥`;
    floatText(this, m.sprite.x, m.sprite.y - 50, coinMsg, '#FFD700', 22);
    floatText(this, m.sprite.x, m.sprite.y - 80, '정답! ✓', '#44ff88', 30);

    if (this.battleComboText) {
      if (this.combo >= 2) {
        this.battleComboText.setText(`🔥 COMBO ×${this.combo}`);
        this.battleComboText.setColor(this.combo >= 5 ? '#ff4400' : '#ffdd00');
        this.tweens.add({
          targets: this.battleComboText,
          scaleX: 1.4, scaleY: 1.4, duration: 100,
          yoyo: true, ease: 'Back.easeOut',
        });
      } else {
        this.battleComboText.setText('');
      }
    }

    if (m.isBoss) {
      floatText(this, m.sprite.x, m.sprite.y - 108,
        `${m.maxHp - m.hp} / ${m.maxHp} 타격!`, '#ff88ff', 18);
    }

    if (m.hp <= 0) {
      this._killMonster(m);
    } else {
      m.generateNextProblem();
      this.problemText.setText(m.problem.question);
      this.battleProblemText?.setText(m.problem.question);
      if (this.battleNameHdr) {
        const qLeft = m.maxHp - m.hp;
        this.battleNameHdr.setText(`⚔  ${MONSTER_NAMES[m.type]}  (${qLeft + 1} / ${m.maxHp})`);
      }
      this.battleStartTime = this.time.now;
      hitShake(this, m.sprite);
    }
  }

  private _onWrong(): void {
    this.cameras.main.shake(280, 0.014);
    this.cameras.main.flash(200, 200, 0, 0, true);
    this.combo = 0;
    this.battleComboText?.setText('');

    this.stats.hp = Math.max(0, this.stats.hp - 1);
    this._refreshHUD();
    this._refreshBattleHpHearts();

    const uid = auth.currentUser?.uid;
    if (uid) void recordAnswer(uid, false).catch(() => {});

    this.player?.flashHurt(this);

    if (this.stats.hp <= 0) {
      floatText(this, 400, 250, '💀 쓰러졌다!', '#ff0000', 42);
      this.time.delayedCall(1200, () => this._gameOver());
    } else {
      floatText(this, 400, 270, `틀렸어! ❤ ${this.stats.hp}남음`, '#ff5533', 24);
    }
  }

  private _refreshBattleHpHearts(): void {
    if (!this.battleHpHearts) return;
    this.battleHpHearts.forEach((heart, i) => {
      heart.setColor(i < this.stats.hp ? '#ff3355' : '#333333');
    });
  }

  private _killMonster(monster: Monster): void {
    monster.alive = false;
    this._exitBattle();

    const gain = EXP_PER_KILL * this.wave;
    this._gainExp(gain);
    showExpBurst(this, monster.sprite.x, monster.sprite.y, gain);

    const targets: Phaser.GameObjects.GameObject[] = [
      monster.hpBar.bg, monster.hpBar.bar, monster.nameTag,
    ];
    if (monster.hpBar.label)  targets.push(monster.hpBar.label);
    if (monster.hpBar.hpText) targets.push(monster.hpBar.hpText);
    this.tweens.add({
      targets,
      alpha: 0, duration: 300,
      onComplete: () => monster.destroyMeta(),
    });

    if (monster.isBoss) {
      this.time.delayedCall(400, () => this._bossTransform(monster));
    } else {
      this.tweens.add({
        targets: [monster.sprite],
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 380, ease: 'Back.easeIn',
        onComplete: () => monster.sprite.destroy(),
      });
      if (this.monsters.filter((m) => m.alive).length === 0) {
        this.time.delayedCall(700, () => this._waveClear());
      }
    }
  }

  private _bossTransform(monster: Monster): void {
    this.cameras.main.flash(350, 255, 255, 255, true);
    const cfg = ROOM_CONFIG[this.room];
    const isFinal = cfg.isFinalBoss === true;
    const isArchangel = monster.type === 'archangel';
    const goodTex = isArchangel ? 'monster-archangel-good' : 'monster-boss-good';
    const finalScale = isArchangel ? 0.5 : 0.9;

    // 🔒 챕터 보스 락인: 현재 챕터에서 모은 임시 코인을 누적에 반영하고 리셋.
    const pending = this.stats.coins;
    const uid = auth.currentUser?.uid;
    if (uid && pending > 0) {
      void commitChapterCoins(uid, pending).catch(() => {});
      const profile = getProfile();
      if (profile) profile.coins = Math.round((profile.coins + pending) * 10) / 10;
      floatText(this, 400, 200, `💰 +${(Math.round(pending * 10) / 10).toFixed(1)} DC 적립!`, '#FFD700', 30);
    }
    this.stats.coins = 0;
    this._refreshHUD();

    this.tweens.add({
      targets: monster.sprite,
      scaleX: 0, scaleY: 0,
      duration: 280, ease: 'Back.easeIn',
      onComplete: () => {
        monster.sprite.setTexture(goodTex).setAlpha(1);
        this.tweens.add({
          targets: monster.sprite,
          scaleX: finalScale, scaleY: finalScale,
          duration: 550, ease: 'Back.easeOut',
          onComplete: () => {
            this.cameras.main.flash(200, 255, 240, 100, true);
            floatText(this, monster.sprite.x, monster.sprite.y - 100, '착해졌다! 🌟', '#FFD700', 34);
            this.time.delayedCall(2400, () => {
              if (isFinal) this._gameClear();
              else if (cfg.chapterTransitionRoom !== undefined) {
                this._enterNextChapter(monster, cfg.chapterTransitionRoom);
              } else {
                this._gameClear();
              }
            });
          },
        });
      },
    });
  }

  private _enterNextChapter(boss: Monster, nextRoom: RoomKey): void {
    if (this.transitioning) return;

    floatText(this, 400, 280, '✨ 따라와! 새로운 세상으로! ✨', '#88ddff', 30);

    const arrow = this.add.text(boss.sprite.x, boss.sprite.y - 70, '⬆', {
      fontSize: '40px',
      color: '#ffee99',
      stroke: '#000',
      strokeThickness: 4,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: arrow,
      y: arrow.y - 12,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: boss.sprite,
      y: '-=220',
      alpha: 0.35,
      duration: 1800,
      ease: 'Sine.easeIn',
    });

    this.time.delayedCall(2400, () => {
      this.transitioning = true;
      this.gameStarted = false;
      this.cameras.main.fadeOut(900, 200, 230, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MathScene', {
          room: nextRoom,
          stats: this.stats,
          grade: this.grade,
        } as SceneData);
      });
    });
  }

  // ─── EXP / 레벨 ──────────────────────────────────────────
  private _gainExp(amount: number): void {
    this.stats.exp += amount;
    if (this.stats.exp >= this.stats.expToNext) {
      this._levelUp();
    }
    this._refreshHUD();
  }

  private _levelUp(): void {
    this.stats.level++;
    this.stats.exp -= this.stats.expToNext;
    this.stats.expToNext = Math.floor(this.stats.expToNext * EXP_LEVEL_GROWTH);

    const tierName = this.player?.applyLevel(this, this.stats.level);
    const tierMsg = tierName ? ` [${tierName}]` : '';
    floatText(this, 400, 250, `★ Lv.${this.stats.level} UP!${tierMsg} ★`, '#FFD700', 34);
    this.cameras.main.flash(280, 255, 210, 0, true);
  }

  // ─── 웨이브 클리어 / 방 전환 ───────────────────────────────
  private _waveClear(): void {
    this.wave++;
    floatText(this, 400, 270, `★ Wave ${this.wave - 1} 클리어! ★`, '#FFD700', 38);
    this._refreshHUD();

    const hasNextRoom = ROOM_CONFIG[this.room].nextRoom !== undefined;
    if (hasNextRoom) {
      this.time.delayedCall(1000, () => this._openExit());
    } else {
      this.time.delayedCall(1400, () => this._spawnMonsters());
    }
  }

  private _openExit(): void {
    const cfg = (ROOM_CONFIG[this.room] ?? ROOM_CONFIG[1]).exit;
    if (!cfg) return;
    this.caveOpen = true;

    this.exitGlow = this.add.circle(cfg.x, cfg.y, cfg.radius, 0xffffff, 0.15).setDepth(8);
    this.tweens.add({
      targets: this.exitGlow,
      alpha: 0.4, scaleX: 1.15, scaleY: 1.15,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.exitLabel = this.add.text(cfg.x, cfg.y - cfg.radius - 18, cfg.label, {
      fontSize: '14px', color: '#FFD700',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(9);

    floatText(this, 400, 300, '출구가 열렸다!', '#ffffff', 30);
    this._showSecretDoor();
  }

  private _enterNextRoom(): void {
    if (this.transitioning) return;
    const nextRoom = ROOM_CONFIG[this.room].nextRoom;
    if (nextRoom === undefined) return;
    this.transitioning = true;
    this.gameStarted = false;

    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MathScene', {
        room: nextRoom,
        stats: this.stats,
        grade: this.grade,
      } as SceneData);
    });
  }

  private _showSecretDoor(): void {
    const cfg = ROOM_CONFIG[this.room];
    if (!cfg?.secretExit) return;
    const { x, y, radius, label } = cfg.secretExit;

    const outerGlow = this.add.circle(x, y, radius + 20, 0xffcc00, 0.12).setDepth(3);
    this.tweens.add({
      targets: outerGlow,
      alpha: 0.28, scaleX: 1.1, scaleY: 1.1,
      duration: 1000, yoyo: true, repeat: -1,
    });

    const glow = this.add.circle(x, y, radius, 0xffaa00, 0.30).setDepth(4);
    this.tweens.add({
      targets: glow,
      alpha: 0.55, scaleX: 1.08, scaleY: 1.08,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const lbl = this.add.text(x, y, label, {
      fontSize: '15px', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: lbl, alpha: 0.3,
      duration: 700, yoyo: true, repeat: -1,
    });
  }

  private _enterTreasureRoom(): void {
    if (this.transitioning) return;
    const target = ROOM_CONFIG[this.room].secretRoom;
    if (target === undefined) return;
    this.transitioning = true;
    this.gameStarted = false;
    this.cameras.main.fadeOut(700, 255, 215, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MathScene', {
        room: target,
        stats: this.stats,
        grade: this.grade,
        fromRoom: this.room,
      } as SceneData);
    });
  }

  private _exitTreasureRoom(): void {
    if (this.transitioning) return;
    const next = ROOM_CONFIG[this.room].nextRoom;
    if (next === undefined) return;
    this.transitioning = true;
    this.gameStarted = false;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MathScene', {
        room: next,
        stats: this.stats,
        grade: this.grade,
      } as SceneData);
    });
  }

  // ─── 보물방 / 제단 ─────────────────────────────────────────
  private _setupTreasureRoom(cfg: RoomConfig): void {
    this.monsters = [];
    this.pedestalUsed = false;
    this.pedestalChallenge = null;
    this.caveOpen = false;

    const ped = cfg.pedestal!;
    this.pedestalGlow = this.add.circle(ped.x, ped.y, ped.radius, 0xaaddff, 0.18).setDepth(4);
    this.tweens.add({
      targets: this.pedestalGlow,
      alpha: 0.38, scaleX: 1.12, scaleY: 1.12,
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.pedestalLabel = this.add.text(ped.x, ped.y - ped.radius - 16, '[ 가까이 가기 ]', {
      fontSize: '13px', color: '#aaddff',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: this.pedestalLabel,
      alpha: 0.2, duration: 600, yoyo: true, repeat: -1,
    });
  }

  private _startPedestalChallenge(): void {
    if (this.pedestalUsed || this.pedestalChallenge) return;
    const ch: PedestalChallenge = {
      questions: Array.from({ length: 5 }, () => this.generator.generate()),
      current: 0,
      correct: 0,
      inputText: '',
    };
    this.pedestalChallenge = ch;
    this._showPedestalQuestion();
  }

  private _showPedestalQuestion(): void {
    const ch = this.pedestalChallenge;
    if (!ch) return;
    ch.overlay?.destroy();

    const q = ch.questions[ch.current];
    const overlay = this.add.container(0, 0).setDepth(60);
    ch.overlay = overlay;

    overlay.add(this.add.rectangle(400, 300, 480, 320, 0x0d0d22, 0.92));
    overlay.add(this.add.rectangle(400, 300, 476, 316, 0x334466, 0).setStrokeStyle(2, 0xaaddff));
    overlay.add(this.add.text(400, 170, `문제 ${ch.current + 1} / 5`, {
      fontSize: '16px', color: '#aaddff', fontFamily: 'monospace',
    }).setOrigin(0.5));

    overlay.add(this.add.text(400, 245, q.question, {
      fontSize: '36px', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5));

    ch.inputText = '';
    ch.inputDisplay = this.add.text(400, 310, '답: _', {
      fontSize: '26px', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    overlay.add(ch.inputDisplay);

    overlay.add(this.add.text(400, 360, 'Enter로 제출', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5));

    if (ch.keyHandler) this.input.keyboard!.off('keydown', ch.keyHandler);
    ch.keyHandler = (e: KeyboardEvent) => this._handlePedestalInput(e);
    this.input.keyboard!.on('keydown', ch.keyHandler);
    this.numpad.show(this);
  }

  private _handlePedestalInput(e: KeyboardEvent): void {
    const ch = this.pedestalChallenge;
    if (!ch || !ch.inputDisplay) return;

    if (e.key >= '0' && e.key <= '9') {
      ch.inputText += e.key;
      ch.inputDisplay.setText(`답: ${ch.inputText}_`);
    } else if (e.key === 'Backspace') {
      ch.inputText = ch.inputText.slice(0, -1);
      ch.inputDisplay.setText(`답: ${ch.inputText || ''}_`);
    } else if (e.key === 'Enter') {
      this._submitPedestalAnswer();
    }
  }

  private _submitPedestalAnswer(): void {
    const ch = this.pedestalChallenge;
    if (!ch) return;
    const q = ch.questions[ch.current];
    const userAns = parseInt(ch.inputText, 10);

    if (userAns === q.answer) {
      ch.correct++;
      floatText(this, 400, 210, '✓ 정답!', '#44ff88', 28);
    } else {
      floatText(this, 400, 210, `✗ 오답 (${q.answer})`, '#ff4444', 28);
    }

    ch.current++;
    if (ch.current >= 5) {
      if (ch.keyHandler) this.input.keyboard!.off('keydown', ch.keyHandler);
      ch.overlay?.destroy();
      this.numpad.hide(this);
      this.time.delayedCall(600, () => this._finishPedestalChallenge());
    } else {
      ch.inputText = '';
      this.time.delayedCall(400, () => this._showPedestalQuestion());
    }
  }

  private _finishPedestalChallenge(): void {
    this.pedestalUsed = true;
    this.pedestalChallenge = null;

    this.pedestalGlow?.destroy();  this.pedestalGlow = null;
    this.pedestalLabel?.destroy(); this.pedestalLabel = null;

    this.stats.coins += 1;
    this._refreshHUD();
    floatText(this, 400, 270, '🏆 +1 DC 획득!', '#FFD700', 36);
    this.cameras.main.flash(400, 255, 215, 0, true);

    this.caveOpen = true;
    const ex = ROOM_CONFIG.treasure.exit;
    if (!ex) return;
    const exitGlow = this.add.circle(ex.x, ex.y, ex.radius, 0xffffff, 0.18).setDepth(8);
    this.tweens.add({
      targets: exitGlow,
      alpha: 0.45, scaleX: 1.15, scaleY: 1.15,
      duration: 800, yoyo: true, repeat: -1,
    });
    this.add.text(ex.x + ex.radius + 14, ex.y, ex.label, {
      fontSize: '14px', color: '#FFD700',
      stroke: '#000', strokeThickness: 3,
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(9);
    floatText(this, ex.x + 80, ex.y, '문이 열렸다!', '#ffffff', 24);
  }

  // ─── 숫자패드 입력 라우팅 ─────────────────────────────────
  private _numpadInput(k: string): void {
    if (this.inBattle && this.selectedMonster) {
      if (k === '⌫') {
        this.answer = this.answer.slice(0, -1);
      } else if (k === '✓') {
        if (this.answer.length > 0) this._checkAnswer();
      } else if (this.answer.length < MAX_ANSWER_LEN) {
        this.answer += k;
      }
      this._refreshInput();
      return;
    }
    const ch = this.pedestalChallenge;
    if (ch && ch.inputDisplay) {
      if (k === '⌫') {
        ch.inputText = ch.inputText.slice(0, -1);
        ch.inputDisplay.setText(`답: ${ch.inputText || ''}_`);
      } else if (k === '✓') {
        if (ch.inputText.length > 0) this._submitPedestalAnswer();
      } else if (ch.inputText.length < MAX_ANSWER_LEN) {
        ch.inputText += k;
        ch.inputDisplay.setText(`답: ${ch.inputText}_`);
      }
    }
  }

  // ─── 게임 오버 / 클리어 ────────────────────────────────────
  private _gameOver(): void {
    this.gameStarted = false;
    if (this.battleOverlayGroup) {
      this.battleOverlayGroup.destroy(true);
      this.battleOverlayGroup = null;
    }
    void this._saveImmediate();
    showGameOver(this, this.stats, () => {
      this.cameras.main.fadeOut(600);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MathScene', {} as SceneData);
      });
    });
  }

  private _gameClear(): void {
    this.gameStarted = false;
    void this._saveImmediate({ cleared: true });
    // 락인된 누적 코인을 표시 (stats.coins는 이미 0으로 리셋됨)
    const profile = getProfile();
    const displayStats = { ...this.stats, coins: profile?.coins ?? 0 };
    showGameClear(this, displayStats, this.bgImg ?? null, () => {
      this.cameras.main.fadeOut(600);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MathScene', {} as SceneData);
      });
    });
  }
}
