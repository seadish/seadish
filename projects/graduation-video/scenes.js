// 「일곱 개의 씨앗」 장면 구성
// 각 장면: dur(초), narr(나레이션 자막), draw(ctx, t, dur)
// 음성 파일을 받으면 dur 만 실제 길이에 맞춰 바꾸면 된다.

const IMG = {};
const FACE_KEYS = ['hajun', 'geunho', 'juwon', 'gyuyeon', 'yugeon', 'taeyeon', 'yumin'];
const CUT_KEYS = ['hajun1', 'hajun2', 'hajun3', 'hajun4', 'hajun_election', 'geunho1', 'geunho2', 'geunho_council',
  'juwon1', 'juwon2', 'juwon3', 'juwon4', 'gyuyeon1', 'gyuyeon2', 'gyuyeon_juwon_sports', 'yugeon1', 'yugeon2', 'yugeon3',
  'taeyeon1', 'yumin1', 'yumin_taeyeon1', 'yumin_taeyeon_camp1', 'yumin_taeyeon_camp2'];

function loadImages() {
  const jobs = [];
  const load = (key, src) => jobs.push(new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { IMG[key] = im; res(); }; im.onerror = () => rej(new Error(src)); im.src = src;
  }));
  CUT_KEYS.forEach(k => load(k, `images/cut/${k}.png`));
  FACE_KEYS.forEach(k => load('face_' + k, `images/faces/${k}.png`));
  PROP_KEYS.forEach(k => load(k, `images/props/${k}.png`));
  GRAD_KEYS.forEach(k => load(k, `images/grad/${k}.png`));
  load('ending_bg1', 'images/ending/bg1.png'); load('ending_bg2', 'images/ending/bg2.png');
  return Promise.all(jobs);
}
const PROP_KEYS = ['drum', 'gavel', 'soccer', 'book', 'laptop', 'baseball', 'masks', 'bass', 'pottery', 'dancer', 'mic',
  'seed', 'sprout', 'tree', 'forest'];

// 소품 스티커: 톡 튀어나오고, o.motion(t) 로 위치·회전·크기를 흔든다
function prop(ctx, key, x, y, w, t, o = {}) {
  const { start = 0, rot = 0, anchor = 'center', alpha = 1 } = o;
  const img = IMG[key]; const p = prog(t, start, 0.5);
  if (p <= 0 || alpha <= 0) return;
  const m = o.motion ? o.motion(t - start) : {};
  const h = w * img.height / img.width;
  const s = easeOutBack(p) * (m.s ?? 1);
  ctx.save(); ctx.globalAlpha *= alpha * clamp(p * 3);
  ctx.translate(x + (m.dx || 0), y + (m.dy || 0)); ctx.rotate(rot + (m.r || 0) + Math.sin((t - start) * 1.4 + w) * 0.015);
  ctx.scale(s * (m.sx ?? 1), s * (m.sy ?? 1));
  ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
  ctx.drawImage(img, -w / 2, anchor === 'bottom' ? -h : -h / 2, w, h);
  ctx.restore();
}
// 장 구석에서 씨앗 → 새싹
function seedToSprout(ctx, t) {
  const x = 1830, base = 985;
  const grow = easeOut(prog(t, 2.2, 1.0));
  prop(ctx, 'seed', x, base - 40, 46, t, { start: 0.8, alpha: 1 - grow, rot: 0.3 });
  if (grow > 0) {
    ctx.save(); ctx.translate(x, base); ctx.scale(lerp(0.2, 1, grow), lerp(0.2, 1, grow)); ctx.translate(-x, -base);
    prop(ctx, 'sprout', x, base, 140, t, { start: 2.2, anchor: 'bottom', motion: tt => ({ r: Math.sin(tt * 2) * 0.05 }) });
    ctx.restore();
  }
}

// 가장자리에 흐릿하게 깔리는 연필 낙서
function ambient(ctx, t, seed) {
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const x = r() < 0.5 ? 40 + r() * 180 : W - 40 - r() * 180;
    const y = 60 + r() * (H - 280);
    const k = r(), s = 0.5 + r() * 0.5;
    ctx.save(); ctx.globalAlpha = 0.28;
    if (k < 0.33) sketch(ctx, shp.star(x, y, 22 * s), { width: 2.5, seed: seed + i, t, color: C.pencil });
    else if (k < 0.66) sketch(ctx, shp.heart(x, y, 26 * s), { width: 2.5, seed: seed + i, t, color: C.pencil });
    else sketch(ctx, shp.circle(x, y, 14 * s, 20), { width: 2.5, seed: seed + i, t, color: C.pencil });
    ctx.restore();
  }
}

// 장(chapter) 공통 레이아웃
function chapterBase(ctx, t, dur, cfg) {
  drawPaper(ctx);
  ambient(ctx, t, cfg.num * 17);
  const main = IMG[cfg.main];
  const portrait = main.height > main.width;
  sticker(ctx, main, cfg.mainX || 470, cfg.mainY || 440, cfg.mainW || (portrait ? 460 : 620), t,
    { start: 0.35, rot: cfg.mainRot ?? -0.05, seed: cfg.num * 3 });
  if (cfg.second) {
    const s2 = IMG[cfg.second];
    sticker(ctx, s2, cfg.secondX || 330, cfg.secondY || 735, cfg.secondW || (s2.height > s2.width ? 250 : 340), t,
      { start: cfg.secondAt || 6.5, rot: cfg.secondRot ?? 0.08, seed: cfg.num * 3 + 1, tapes: 1 });
  }
  // 이름 손글씨
  text(ctx, cfg.name, cfg.nameX || 470, cfg.nameY || 92, { size: 70, font: 'Nanum Pen Script', weight: 400, color: C.ink, reveal: prog(t, 0.9, 0.6), rot: -0.04 });
  sketch(ctx, [[(cfg.nameX || 470) - 70, (cfg.nameY || 92) + 36], [(cfg.nameX || 470) + 70, (cfg.nameY || 92) + 30]], { width: 5, color: cfg.color, seed: cfg.num, t, progress: prog(t, 1.3, 0.4) });
  chapterTitle(ctx, cfg.num, cfg.title, t, { color: cfg.color });
  seedToSprout(ctx, t);
}

// ==================== 장면 ====================
const SCENES = [
  // ---------- 프롤로그 ----------
  {
    key: 'prologue', dur: 12,
    narr: '옛날옛날에, 작은 교실 하나에 일곱 명의 아이들이 살았어요. 아이들은 저마다 주머니 속에 아무도 모르는 씨앗을 하나씩 품고 있었답니다.',
    subLead: 3.2,
    draw(ctx, t, dur) {
      drawPaper(ctx); ambient(ctx, t, 3);
      // 제목 → 위로 이동
      const up = easeInOut(prog(t, 2.6, 0.9));
      const ty = lerp(470, 120, up), sc = lerp(1, 0.62, up);
      ctx.save(); ctx.translate(W / 2, ty); ctx.scale(sc, sc);
      text(ctx, '옛날옛날에…', 0, -150, { size: 64, font: 'Nanum Pen Script', weight: 400, color: C.pencil, reveal: prog(t, 0.2, 0.8), alpha: 1 - up });
      popText(ctx, '일곱 개의 씨앗', 0, 0, t - 0.7, { size: 150, color: C.ink, outline: { width: 14, color: '#fff' } });
      // 씨앗 낙서
      for (let i = 0; i < 7; i++) {
        const p = prog(t, 1.4 + i * 0.08, 0.3);
        if (p > 0) {
          const x = -330 + i * 110, y = 120;
          prop(ctx, 'seed', x, y, 42, t, { start: 1.4 + i * 0.08, rot: -0.3 + i * 0.1 });
        }
      }
      ctx.restore();
      // 우리 학교 사진
      sticker(ctx, IMG.school, W / 2, 455, 1000, t, { start: 3.1, rot: -0.02, seed: 11 });
      const lp = prog(t, 4.2, 0.5);
      if (lp > 0) {
        ctx.save(); ctx.translate(560, 255); ctx.rotate(-0.08); ctx.scale(easeOutBack(lp), easeOutBack(lp));
        ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#fff6d8'; ctx.fillRect(-190, -48, 380, 96); ctx.shadowColor = 'transparent';
        sketch(ctx, shp.rect(-190, -48, 380, 96), { width: 3, seed: 12, t });
        text(ctx, '6학년 우리 반', 0, 4, { size: 64, font: 'Single Day', weight: 400, color: C.green });
        tape(ctx, 0, -48, 120, 0.05, 13);
        ctx.restore();
      }
      // 일곱 아이
      FACE_KEYS.forEach((k, i) => {
        const x = 420 + i * 180, y = 620;
        face(ctx, IMG['face_' + k], x, y, 70, t, { start: 4.6 + i * 0.32, seed: i + 1 });
        // 주머니 속 반짝이는 씨앗
        const g = prog(t, 8.2 + i * 0.12, 0.5);
        if (g > 0) {
          const pulse = 0.6 + 0.4 * Math.sin(t * 5 + i);
          const grd = ctx.createRadialGradient(x, y + 120, 0, x, y + 120, 50);
          grd.addColorStop(0, `rgba(255,220,120,${0.7 * g * pulse})`); grd.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.fillStyle = grd; ctx.fillRect(x - 60, y + 60, 120, 120);
          prop(ctx, 'seed', x, y + 120, 40, t, { start: 8.2 + i * 0.12, rot: 0.2 - i * 0.07 });
          if (g >= 1) sparkle(ctx, x + 30, y + 95, 0.5, { seed: 50 + i, t });
        }
      });
    },
  },

  // ---------- 1장 하준 ----------
  {
    key: 'hajun', dur: 12,
    narr: "첫 번째 아이, 하준이의 씨앗은 '쿵, 쿵' 소리를 냈어요. 처음엔 책상을 두드리던 손이 어느새 드럼 스틱을 쥐었죠. 지금 하준이는 무대에 오를 날만 기다리는 드러머랍니다.",
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 1, name: '하준', title: '쿵쿵 드러머', color: C.red, main: 'hajun2', second: 'hajun_election' });
      // 책상 두드리기
      const deskA = 1 - prog(t, 4.2, 0.6);
      if (deskA > 0) {
        ctx.save(); ctx.globalAlpha = deskA;
        const dp = prog(t, 1.0, 0.8);
        sketch(ctx, shp.rect(1060, 560, 580, 40), { width: 5, seed: 61, t, progress: dp });
        wash(ctx, shp.rect(1060, 560, 580, 40), C.brown, { alpha: 0.5 * dp, seed: 62, t });
        sketch(ctx, [[1100, 600], [1100, 800]], { width: 5, seed: 63, t, progress: dp });
        sketch(ctx, [[1600, 600], [1600, 800]], { width: 5, seed: 64, t, progress: dp });
        const hit = Math.abs(Math.sin(t * 6));
        sketch(ctx, shp.circle(1250, 520 - hit * 60, 32, 24), { width: 4, seed: 65, t });
        sketch(ctx, shp.circle(1450, 520 - (1 - hit) * 60, 32, 24), { width: 4, seed: 66, t });
        ctx.restore();
        popText(ctx, '쿵!', 1180, 380, t - 1.6, { size: 100, color: C.red });
        popText(ctx, '쿵!', 1520, 340, t - 2.4, { size: 120, color: C.orange });
      }
      // 드럼 세트 (박자마다 들썩)
      const beat = tt => Math.pow(Math.max(0, Math.sin(tt * 9)), 6);
      prop(ctx, 'drum', 1330, 610, 560, t, { start: 4.4, motion: tt => ({ s: 1 + beat(tt) * 0.035, r: Math.sin(tt * 9) * 0.01 }) });
      if (t > 5.0) {
        const b = beat(t - 4.4);
        if (b > 0.3) {
          for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.35; sketch(ctx, [[1330 + Math.cos(a) * 300, 620 + Math.sin(a) * 260], [1330 + Math.cos(a) * 345, 620 + Math.sin(a) * 300]], { width: 4, seed: 85 + k, t, color: C.orange, alpha: b }); }
        }
        for (let i = 0; i < 3; i++) note(ctx, 1080 + i * 250 + Math.sin(t * 2 + i) * 20, 420 - ((t * 60 + i * 70) % 160), 1, { seed: 90 + i, t, color: [C.red, C.blue, C.purple][i] });
      }
      // COMING SOON 팻말
      const sp = prog(t, 8.3, 0.6);
      if (sp > 0) {
        ctx.save(); ctx.translate(1330, 268); ctx.rotate(-0.06); ctx.scale(easeOutBack(sp), easeOutBack(sp));
        ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#fff6d8'; ctx.fillRect(-240, -60, 480, 120); ctx.shadowColor = 'transparent';
        sketch(ctx, shp.rect(-240, -60, 480, 120), { width: 3.5, seed: 95, t });
        text(ctx, 'COMING SOON!', 0, 4, { size: 72, font: 'Single Day', weight: 400, color: C.red });
        tape(ctx, -200, -60, 110, -0.4, 96); tape(ctx, 200, -60, 110, 0.4, 97);
        ctx.restore();
        sparkle(ctx, 1060, 250, 0.8, { seed: 98, t }); sparkle(ctx, 1620, 300, 0.7, { seed: 99, t });
      }
    },
  },

  // ---------- 2장 근호 ----------
  {
    key: 'geunho', dur: 12,
    narr: "두 번째 아이, 근호의 씨앗은 사람들을 모으는 힘을 가졌어요. 전교회장 근호는 친구들의 목소리에 귀 기울이고, 다 함께 정한 약속을 의사봉 '탕!'으로 알렸답니다.",
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 2, name: '근호', title: '우리 학교 전교회장', color: C.blue, main: 'geunho1', mainW: 560, mainY: 400, second: null });
      sticker(ctx, IMG.geunho_council, 1330, 600, 600, t, { start: 1.0, rot: 0.04, seed: 120 });
      // 흩어진 말풍선 → 하나로
      const words = ['!', '?', '…', '좋아!', '음…', '저요!', '찬성!', '!!'];
      const merge = easeInOut(prog(t, 5.2, 2.2));
      const r = rng(130);
      words.forEach((w, i) => {
        const sx = 1000 + r() * 700, sy = 220 + r() * 160;
        const angle = r() * Math.PI * 2;
        const p = prog(t, 1.6 + i * 0.18, 0.4);
        if (p <= 0 || merge >= 1) return;
        const x = lerp(sx + Math.cos(t + angle) * 10, 1640, merge), y = lerp(sy + Math.sin(t * 1.3 + angle) * 8, 215, merge);
        ctx.save(); ctx.globalAlpha = 1 - merge * merge; ctx.translate(x, y); ctx.scale(easeOutBack(p) * (1 - merge * 0.6), easeOutBack(p) * (1 - merge * 0.6));
        bubble(ctx, 0, 0, 120, 74, t, { seed: 131 + i, tail: [-0.2, 1] });
        text(ctx, w, 0, 2, { size: 40, font: 'Single Day', weight: 400, color: [C.red, C.blue, C.green, C.purple][i % 4] });
        ctx.restore();
      });
      // 투표함: 모두의 의견이 한 표씩
      const vb = prog(t, 4.6, 0.5);
      if (vb > 0) {
        ctx.save(); ctx.translate(1640, 270); ctx.scale(easeOutBack(vb), easeOutBack(vb));
        const box = shp.rect(-95, -50, 190, 120);
        wash(ctx, box, '#fff', { alpha: 0.95, seed: 140, t }); wash(ctx, box, C.blue, { alpha: 0.25, seed: 141, t });
        sketch(ctx, box, { width: 4, seed: 142, t });
        sketch(ctx, [[-45, -50], [45, -50]], { width: 7, seed: 143, t, color: C.ink });
        text(ctx, '투표함', 0, 18, { size: 44, font: 'Single Day', weight: 400, color: C.blue });
        ctx.restore();
      }
      const bp = prog(t, 7.3, 0.6);
      if (bp > 0) {
        ctx.save(); ctx.translate(1220, 250); ctx.scale(easeOutElastic(bp), easeOutElastic(bp));
        bubble(ctx, 0, 0, 560, 150, t, { seed: 150, fill: '#fffbe8', tail: [0.3, 1] });
        text(ctx, '다 함께 정했어요!', 0, 4, { size: 66, font: 'Single Day', weight: 400, color: C.blue });
        ctx.restore();
        popText(ctx, '찬성!', 1640, 385, t - 7.6, { size: 50, color: C.green });
        sparkle(ctx, 930, 180, 0.7, { seed: 151, t }); sparkle(ctx, 1780, 360, 0.6, { seed: 152, t });
      }
      // 의사봉: 들었다가 '탕!'
      const lift = tt => tt < 1.0 ? -0.35 * easeOut(clamp(tt / 1.0)) : tt < 1.12 ? lerp(-0.35, 0.06, (tt - 1.0) / 0.12) : 0.06 * Math.max(0, 1 - (tt - 1.12) * 4);
      prop(ctx, 'gavel', 830, 700, 330, t, { start: 3.2, motion: tt => ({ r: lift(tt), dy: lift(tt) * 40, sy: tt > 1.0 && tt < 1.3 ? 0.94 : 1 }) });
      if (t > 4.32) {
        const ip = prog(t, 4.32, 0.35);
        for (let k = 0; k < 7; k++) { const a = Math.PI + k * Math.PI / 6; sketch(ctx, [[760 + Math.cos(a) * 150 * (0.7 + ip * 0.3), 760 + Math.sin(a) * 90], [760 + Math.cos(a) * 200 * (0.7 + ip * 0.3), 760 + Math.sin(a) * 125]], { width: 4, seed: 168 + k, t, color: C.red, alpha: 1 - prog(t, 5.0, 0.5) }); }
        popText(ctx, '탕!', 900, 520, t - 4.32, { size: 110, color: C.red });
      }
    },
  },

  // ---------- 3장 주원 ----------
  {
    key: 'juwon', dur: 12,
    narr: '세 번째 아이, 주원이의 씨앗은 세 갈래로 싹을 틔웠어요. 책을 펴면 척척박사, 운동장에선 축구왕. 게다가 노래까지 잘하는 우리 반 대표 보컬이랍니다.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 3, name: '주원', title: '삼박자 만능 보컬', color: C.purple, main: 'juwon2', second: 'juwon1', secondAt: 8.2 });
      // 책: 척척박사
      prop(ctx, 'book', 1110, 600, 330, t, { start: 1.6, rot: -0.08, motion: tt => ({ dy: Math.sin(tt * 2) * 8 }) });
      if (t > 2.4) {
        for (let k = 0; k < 3; k++) { const ph = ((t - 2.4) * 0.5 + k / 3) % 1; text(ctx, ['A+', '?', '!'][k], 1040 + k * 80, 470 - ph * 120, { size: 52, font: 'Single Day', weight: 400, color: [C.blue, C.teal, C.red][k], alpha: 1 - ph }); }
        popText(ctx, '척척박사!', 1110, 800, t - 3.0, { size: 64, color: C.blue });
      }
      // 축구공: 굴러 들어와 통통
      const bt = t - 4.2;
      if (bt > 0) {
        const x = lerp(1950, 1600, easeOut(clamp(bt / 1.2)));
        const bounceH = 170 * Math.exp(-bt * 0.6) * Math.abs(Math.sin(bt * 5));
        prop(ctx, 'soccer', x, 660 - bounceH, 220, t, { start: 4.2, rot: -bt * 4 });
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(x, 780, 90 - bounceH * 0.2, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        popText(ctx, '축구왕!', 1600, 450, t - 5.4, { size: 70, color: C.orange });
      }
      // 마이크: 대표 보컬
      prop(ctx, 'mic', 1370, 420, 150, t, { start: 7.4, rot: -0.35, motion: tt => ({ r: Math.sin(tt * 3) * 0.08 }) });
      if (t > 7.9) {
        for (let k = 0; k < 4; k++) {
          const ph = ((t - 7.9) * 0.5 + k / 4) % 1;
          note(ctx, 1430 + ph * 200, 330 - ph * 140 + Math.sin(ph * 8 + k) * 25, 0.9, { seed: 270 + k, t, color: [C.purple, C.pink, C.blue, C.red][k] });
        }
        popText(ctx, '대표 보컬!', 1350, 230, t - 8.6, { size: 72, color: C.purple });
      }
    },
  },

  // ---------- 4장 규연 ----------
  {
    key: 'gyuyeon', dur: 12,
    narr: '네 번째 아이, 규연이의 씨앗은 책 속에서 무럭무럭 자랐어요. 책장을 넘기며 키운 생각 덕분에, 어떤 상황에서도 인공지능보다 빠르게 정답을 찾아냈죠.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 4, name: '규연', title: 'AI보다 빠른 두뇌', color: C.teal, main: 'gyuyeon1', mainY: 400, second: 'gyuyeon2', secondW: 240, secondY: 730 });
      // 책 + 넘어가는 책장
      prop(ctx, 'book', 1110, 660, 340, t, { start: 1.0, rot: 0.06 });
      if (t > 1.8 && t < 7.2) {
        for (let k = 0; k < 3; k++) {
          const ph = ((t - 1.8) * 0.8 + k / 3) % 1;
          ctx.save(); ctx.translate(1110, 560); ctx.rotate(-ph * Math.PI * 0.9);
          const pg = [[0, 0], [130, -18], [140, 50], [0, 60]];
          wash(ctx, pg, '#fffdf3', { alpha: 0.95 * (1 - ph), seed: 300 + k, t });
          sketch(ctx, [...pg, pg[0]], { width: 2.5, seed: 303 + k, t, alpha: 1 - ph });
          ctx.restore();
        }
        text(ctx, '사락사락~', 1110, 450, { size: 50, font: 'Nanum Pen Script', weight: 400, color: C.teal, rot: Math.sin(t * 3) * 0.06 });
      }
      // AI 노트북
      prop(ctx, 'laptop', 1610, 600, 430, t, { start: 3.8, rot: -0.04 });
      if (t > 5.0 && t < 8.4) {
        const dots = '.'.repeat(1 + Math.floor(t * 3) % 3);
        ctx.save(); ctx.translate(1640, 330);
        bubble(ctx, 0, 0, 280, 90, t, { seed: 352, tail: [0.1, 1] });
        text(ctx, 'AI 계산 중' + dots, -118, 4, { size: 42, font: 'Single Day', weight: 400, color: C.pencil, align: 'left' });
        ctx.restore();
      }
      if (t > 8.4) {
        ctx.save(); ctx.translate(1640, 330);
        bubble(ctx, 0, 0, 170, 90, t, { seed: 353, tail: [0.1, 1] });
        text(ctx, '?!', 0, 4, { size: 56, font: 'Single Day', weight: 400, color: C.red });
        ctx.restore();
      }
      // 규연 번쩍
      const lp = prog(t, 7.4, 0.5);
      if (lp > 0) {
        const LX = 1110, LY = 405, s = easeOutBack(lp);
        const glow = ctx.createRadialGradient(LX, LY, 0, LX, LY, 170 * s);
        glow.addColorStop(0, 'rgba(255,225,110,0.75)'); glow.addColorStop(1, 'rgba(255,225,110,0)');
        ctx.fillStyle = glow; ctx.fillRect(LX - 200, LY - 200, 400, 400);
        ctx.save(); ctx.translate(LX, LY); ctx.scale(s, s);
        const bulb = shp.circle(0, 0, 55, 30);
        wash(ctx, bulb, C.yellow, { alpha: 0.95, seed: 360, t }); sketch(ctx, bulb, { width: 4, seed: 361, t });
        sketch(ctx, shp.rect(-26, 53, 52, 36), { width: 4, seed: 362, t });
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; sketch(ctx, [[Math.cos(a) * 80, Math.sin(a) * 80], [Math.cos(a) * 112, Math.sin(a) * 112]], { width: 4, seed: 363 + k, t, color: C.orange }); }
        ctx.restore();
        popText(ctx, '번쩍! 정답!', LX, LY - 160, t - 7.8, { size: 72, color: C.orange });
      }
    },
  },

  // ---------- 5장 유건 ----------
  {
    key: 'yugeon', dur: 12,
    narr: '다섯 번째 아이, 유건이의 씨앗은 바람처럼 빨랐어요. 운동장을 달리면 누구도 따라잡을 수 없었죠. 이제 유건이는 그 바람을 타고 야구장의 주인공이 되는 꿈을 향해 달리고 있답니다.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 5, name: '유건', title: '바람의 야구왕', color: C.green, main: 'yugeon2', mainY: 400, second: 'yugeon3', secondAt: 7.0 });
      const swap = easeInOut(prog(t, 6.2, 0.8));
      // 운동장 달리기
      if (swap < 1) {
        ctx.save(); ctx.globalAlpha = 1 - swap;
        sketch(ctx, [[980, 760], [1800, 760]], { width: 4, seed: 400, t, progress: prog(t, 0.8, 0.6), color: C.brown });
        sketch(ctx, [[980, 640], [1800, 640]], { width: 3, seed: 401, t, progress: prog(t, 0.9, 0.6), color: C.brown, alpha: 0.5 });
        for (let k = 0; k < 9; k++) {
          const ph = ((t * 1.6 + k / 9) % 1);
          const y = 300 + (k * 53) % 420, x = 1800 - ph * 900;
          sketch(ctx, [[x, y], [x + 120 + (k % 3) * 40, y]], { width: 3, seed: 410 + k, t, color: C.teal, alpha: 0.7 });
        }
        const lag = prog(t, 1.4, 4.5);
        for (let k = 0; k < 2; k++) {
          const x = 1260 - k * 170 - lag * 240, y = 600, bob = Math.abs(Math.sin(t * 8 + k)) * 12;
          sketch(ctx, shp.circle(x, y - 110 - bob, 28, 22), { width: 3.5, seed: 420 + k, t, progress: prog(t, 1.2, 0.5) });
          sketch(ctx, [[x, y - 82 - bob], [x - 8, y - 20 - bob], [x - 40, y + 30], [x - 8, y - 20 - bob], [x + 30, y + 30]], { width: 3.5, seed: 422 + k, t, progress: prog(t, 1.2, 0.5) });
          sketch(ctx, [[x - 4, y - 65 - bob], [x - 45, y - 40 - bob]], { width: 3.5, seed: 424 + k, t, progress: prog(t, 1.2, 0.5) });
          if (t > 2.5) text(ctx, '헉헉', x, y - 170 - bob, { size: 44, font: 'Nanum Pen Script', weight: 400, color: C.pencil, rot: -0.1 });
        }
        const bob = Math.abs(Math.sin(t * 9)) * 18;
        face(ctx, IMG.face_yugeon, 1560 + Math.sin(t * 2) * 15, 470 - bob, 95, t, { start: 1.0, seed: 430 });
        if (t > 1.5) {
          for (let k = 0; k < 3; k++) {
            const ph = ((t * 2 + k / 3) % 1);
            sketch(ctx, shp.circle(1440 - ph * 150, 700 - ph * 30, 20 + ph * 30, 16), { width: 3, seed: 440 + k, t, alpha: 1 - ph, color: C.brown });
          }
          popText(ctx, '쌩~!', 1560, 280, t - 2.2, { size: 90, color: C.teal });
        }
        ctx.restore();
      }
      // 야구장 스티커 + 홈런
      if (swap > 0) {
        prop(ctx, 'baseball', 1340, 580, 700, t, { start: 6.3, rot: -0.03 });
        face(ctx, IMG.face_yugeon, 1770, 470, 66, t, { start: 6.9, seed: 460 });
        const fp = prog(t, 7.8, 2.4);
        const path = q => [lerp(1200, 1720, q), 680 - Math.sin(q * Math.PI * 0.85) * 560 - q * 110];
        if (fp > 0 && fp < 1) {
          for (let k = 1; k < 8; k++) { const [qx, qy] = path(Math.max(0, fp - k * 0.025)); sketch(ctx, shp.circle(qx, qy, 4, 8), { width: 3, seed: 470 + k, t, color: C.pencil, alpha: 0.6 }); }
          const [x, y] = path(fp);
          const b = shp.circle(x, y, 24, 20);
          wash(ctx, b, '#fff', { alpha: 1, seed: 480, t }); sketch(ctx, b, { width: 3.5, seed: 481, t });
          sketch(ctx, [[x - 12, y - 18], [x - 6, y], [x - 12, y + 18]], { width: 2.5, seed: 482, t, color: C.red });
        }
        if (fp >= 1) {
          const sp = prog(t, 10.2, 0.6);
          ctx.save(); ctx.translate(1720, 210); ctx.rotate(t * 0.8); ctx.scale(easeOutElastic(sp), easeOutElastic(sp));
          starDoodle(ctx, 0, 0, 60, { seed: 490, t }); ctx.restore();
          sparkle(ctx, 1620, 170, 0.7, { seed: 491, t }); sparkle(ctx, 1810, 300, 0.6, { seed: 492, t });
        }
        if (t > 8.0) popText(ctx, '홈런!', 1120, 300, t - 8.0, { size: 110, color: C.red });
      }
    },
  },

  // ---------- 6장 태연 ----------
  {
    key: 'taeyeon', dur: 12,
    narr: '여섯 번째 아이, 태연이의 씨앗은 팔방으로 가지를 뻗었어요. 무대 위에선 멋진 배우, 베이스를 잡으면 든든한 연주자. 무엇이든 해내는 우리 반 팔방미인이랍니다.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 6, name: '태연', title: '우리 반 팔방미인', color: C.pink, main: 'taeyeon1', second: 'yumin_taeyeon1', secondAt: 8.4 });
      // 팔방으로 뻗는 손그림 선 (배경)
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + 0.2;
        const p = prog(t, 0.9 + i * 0.1, 0.6);
        sketch(ctx, [[1370 + Math.cos(a) * 120, 520 + Math.sin(a) * 100], [1370 + Math.cos(a) * 330, 520 + Math.sin(a) * 270]], { width: 4, seed: 500 + i, t, progress: p, color: C.pink, alpha: 0.45 });
      }
      // 연극 가면: 웃음 ↔ 울음 뒤집기
      const flip = Math.cos(Math.max(0, t - 3.0) * 2.2);
      prop(ctx, 'masks', 1150, 520, 400, t, { start: 1.8, rot: -0.06, motion: tt => ({ sx: tt > 1.2 ? Math.sign(flip || 1) * Math.max(0.15, Math.abs(flip)) : 1, dy: Math.sin(tt * 2) * 8 }) });
      text(ctx, '멋진 배우', 1150, 760, { size: 60, font: 'Nanum Pen Script', weight: 400, color: C.purple, reveal: prog(t, 3.0, 0.6), rot: -0.04 });
      // 베이스 기타
      prop(ctx, 'bass', 1620, 540, 250, t, { start: 4.6, rot: 0.18, motion: tt => ({ r: Math.sin(tt * 6) * 0.03 }) });
      if (t > 5.3) {
        for (let k = 0; k < 4; k++) {
          const ph = ((t - 5.3) * 0.45 + k / 4) % 1;
          note(ctx, 1500 - ph * 180, 560 - ph * 260 + Math.sin(ph * 7 + k) * 25, 1, { seed: 540 + k, t, color: [C.pink, C.purple, C.orange, C.blue][k] });
        }
        sketch(ctx, [[1700, 560], [1760, 540]], { width: 3, seed: 548, t, color: C.orange, alpha: Math.abs(Math.sin(t * 12)) });
        sketch(ctx, [[1700, 600], [1770, 610]], { width: 3, seed: 549, t, color: C.orange, alpha: Math.abs(Math.cos(t * 12)) });
      }
      text(ctx, '든든한 연주자', 1600, 885, { size: 56, font: 'Nanum Pen Script', weight: 400, color: C.orange, reveal: prog(t, 5.6, 0.6), rot: 0.03 });
      if (t > 8.6) {
        popText(ctx, '팔방미인!', 1380, 250, t - 8.6, { size: 84, color: C.pink });
        sparkle(ctx, 1110, 300, 0.7, { seed: 560, t }); sparkle(ctx, 1780, 360, 0.6, { seed: 561, t });
      }
    },
  },

  // ---------- 7장 유민 ----------
  {
    key: 'yumin', dur: 12,
    narr: '일곱 번째 아이, 유민이의 씨앗은 흙과 음악을 좋아했어요. 물레 위에서 도자기를 빚고, 음악에 맞춰 춤을 추던 유민이는 지금 반짝이는 스타로 자라는 중이에요.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 7, name: '유민', title: '반짝반짝 스타', color: C.orange, main: 'yumin1', mainY: 400, second: 'yumin_taeyeon_camp2', secondAt: 8.4 });
      // 도자기 물레 (빙글빙글)
      prop(ctx, 'pottery', 1160, 640, 430, t, { start: 1.0, motion: tt => ({ dx: Math.sin(tt * 30) * 1.5, r: Math.sin(tt * 2) * 0.02 }) });
      if (t > 1.6) {
        for (let k = 0; k < 3; k++) {
          const a0 = t * 3 + k * 2.1;
          const arc = []; for (let q = 0; q <= 12; q++) { const a = a0 + q * 0.12; arc.push([1160 + Math.cos(a) * 250, 560 + Math.sin(a) * 60]); }
          sketch(ctx, arc, { width: 3, seed: 630 + k, t, color: C.brown, alpha: 0.55 });
        }
        if (t < 5.6) text(ctx, '빙글빙글~', 1160, 380, { size: 58, font: 'Nanum Pen Script', weight: 400, color: C.brown, rot: Math.sin(t * 3) * 0.08 });
      }
      // 스포트라이트 + 춤
      const sl = prog(t, 4.4, 0.6);
      if (sl > 0) {
        ctx.save(); ctx.globalAlpha = 0.5 * sl;
        const g = ctx.createLinearGradient(1700, 80, 1600, 820);
        g.addColorStop(0, 'rgba(255,236,170,0.95)'); g.addColorStop(1, 'rgba(255,236,170,0.2)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1650, 70); ctx.lineTo(1760, 70); ctx.lineTo(1830, 820); ctx.lineTo(1390, 820); ctx.closePath(); ctx.fill();
        ctx.restore();
        wash(ctx, shp.rect(1650, 40, 120, 50), C.ink, { alpha: 0.8, seed: 601, t }); sketch(ctx, shp.rect(1650, 40, 120, 50), { width: 4, seed: 600, t });
      }
      prop(ctx, 'dancer', 1610, 520, 330, t, { start: 4.8, motion: tt => ({ r: Math.sin(tt * 4) * 0.14, dy: -Math.abs(Math.sin(tt * 4)) * 30, sx: Math.sin(tt * 1.3) > -0.9 ? 1 : -1 }) });
      if (t > 5.2) for (let k = 0; k < 4; k++) {
        const ph = ((t - 5.2) * 0.45 + k / 4) % 1;
        note(ctx, 1420 + ph * 360, 700 - Math.sin(ph * Math.PI * 2 + k) * 60 - ph * 300, 0.9, { seed: 640 + k, t, color: [C.orange, C.pink, C.purple, C.blue][k] });
      }
      if (t > 7.0) {
        for (let k = 0; k < 10; k++) {
          const r = rng(660 + k);
          const x = 1020 + r() * 800, sp = 0.15 + r() * 0.15;
          const y = ((t - 7.0) * sp * 600 + r() * 600) % 760 + 60;
          ctx.save(); ctx.translate(x + Math.sin(t * 2 + k) * 20, y); ctx.rotate(t * (r() - 0.5) * 3);
          starDoodle(ctx, 0, 0, 16 + r() * 16, { seed: 670 + k, t, fill: [C.yellow, C.pink, C.orange][k % 3] });
          ctx.restore();
        }
        popText(ctx, '반짝반짝 스타!', 1250, 290, t - 7.6, { size: 76, color: C.orange });
      }
    },
  },

  // ---------- 에필로그 ----------
  // 1쪽: 무대 위 일곱 친구와 나무 7그루 → (종이 찢기) → 2쪽: 큰 숲과 곳곳의 얼굴, 축하 배너
  {
    key: 'epilogue', dur: 16,
    narr: '그렇게 1년이 지나, 일곱 개의 씨앗은 일곱 그루의 나무가 되었어요. 그리고 오늘, 아이들은 새로운 숲을 향해 떠납니다. 졸업을 축하해, 우리 일곱 친구들!',
    subTail: 3.0,
    pageAt: 6.6,
    drawStage(ctx, t) {
      drawPaper(ctx); ambient(ctx, t, 77);
      const cp = easeOut(prog(t, 0.6, 1.2));
      [[-1, 0], [1, W]].forEach(([dir, edge], i) => {
        const pts = [[edge, 0]];
        const wdt = lerp(420, 170, cp);
        for (let y = 0; y <= 700; y += 35) pts.push([edge - dir * (wdt + Math.sin(y * 0.05 + i) * 18), y]);
        pts.push([edge, 700]);
        wash(ctx, pts, C.red, { alpha: 0.85, seed: 700 + i, t, spread: 4 });
        sketch(ctx, pts.slice(1, -1), { width: 4, seed: 702 + i, t });
      });
      wash(ctx, shp.rect(0, 0, W, 60), C.red, { alpha: 0.9, seed: 704, t });
      // 일곱 그루 나무
      for (let i = 0; i < 7; i++) {
        const gp = easeOut(prog(t, 2.6 + i * 0.25, 1.0)); if (gp <= 0) continue;
        const x = 330 + i * 210, base = 960;
        ctx.save(); ctx.translate(x, base); ctx.scale(gp, gp); ctx.translate(-x, -base);
        prop(ctx, 'tree', x, base, 210, t, { start: 2.6 + i * 0.25, anchor: 'bottom', motion: tt => ({ r: Math.sin(tt * 1.5 + i) * 0.03 }) });
        ctx.restore();
      }
      sketch(ctx, [[140, 640], [1780, 640]], { width: 5, seed: 705, t, color: C.brown });
      wash(ctx, [[140, 640], [1780, 640], [1860, 700], [60, 700]], C.brown, { alpha: 0.45, seed: 706, t });
      const order = ['geunho', 'hajun', 'juwon', 'gyuyeon', 'yugeon', 'taeyeon', 'yumin'];
      order.forEach((k, i) => {
        const x = 330 + i * 210, y = 470 + (i % 2) * 30;
        face(ctx, IMG['face_' + k], x, y - Math.abs(Math.sin(t * 4 + i)) * (t > 3.5 ? 14 : 0), 80, t, { start: 1.2 + i * 0.3, seed: 710 + i });
        const mini = { geunho: ['gavel', 120], hajun: ['drum', 140], juwon: ['mic', 50], gyuyeon: ['laptop', 130], yugeon: ['baseball', 150], taeyeon: ['bass', 60], yumin: ['dancer', 90] }[k];
        prop(ctx, mini[0], x, y + 150, mini[1], t, { start: 2.4 + i * 0.3, anchor: 'bottom', rot: (i % 2 ? 0.08 : -0.08), motion: tt => ({ r: Math.sin(tt * 4 + i) * 0.06 }) });
      });
      if (t > 3.5) for (let k = 0; k < 6; k++) {
        const ph = ((t - 3.5) * 0.35 + k / 6) % 1;
        note(ctx, 400 + k * 230 + Math.sin(ph * 6 + k) * 30, 380 - ph * 220, 0.8, { seed: 740 + k, t, color: [C.red, C.purple, C.teal, C.orange, C.pink, C.blue][k] });
      }
    },
    drawForest(ctx, t) {
      const t0 = this.pageAt;
      drawPaper(ctx); ambient(ctx, t, 88);
      // 큰 숲 한 장
      prop(ctx, 'forest', W / 2, 590, 860, t, { start: t0 + 0.2, motion: tt => ({ s: 1 + Math.sin(tt * 0.8) * 0.01 }) });
      // 곳곳의 얼굴 배지
      const spots = { geunho: [330, 450], hajun: [1590, 450], juwon: [610, 330], gyuyeon: [1310, 330], yugeon: [440, 770], taeyeon: [1480, 770], yumin: [960, 820] };
      Object.entries(spots).forEach(([k, [x, y]], i) => face(ctx, IMG['face_' + k], x, y, 78, t, { start: t0 + 0.7 + i * 0.22, seed: 850 + i }));
      // 불꽃놀이
      [[520, 250, t0 + 1.8], [1400, 250, t0 + 2.4], [960, 120, t0 + 5.4]].forEach(([cx, cy, st], j) => {
        const boom = prog(t, st, 1.4);
        if (boom <= 0 || boom >= 1) return;
        for (let k = 0; k < 14; k++) {
          const a = k / 14 * Math.PI * 2, R = 40 + 200 * easeOut(boom);
          ctx.save(); ctx.globalAlpha = 1 - boom;
          sparkle(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.75, 0.6, { seed: 760 + j * 20 + k, t, color: [C.yellow, C.red, C.pink, C.teal][k % 4] });
          ctx.restore();
        }
      });
      // 축하 배너
      const bp = prog(t, 9.6, 0.7);
      if (bp > 0) {
        ctx.save(); ctx.translate(W / 2, 150); ctx.rotate(-0.02); ctx.scale(easeOutBack(bp), easeOutBack(bp));
        const band = [[-720, -100], [720, -90], [690, 0], [720, 100], [-720, 92], [-690, 0]];
        ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); band.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
        ctx.shadowColor = 'transparent';
        sketch(ctx, [...band, band[0]], { width: 4, seed: 810, t });
        tape(ctx, -640, -95, 140, -0.5, 811); tape(ctx, 640, -95, 140, 0.5, 812);
        ctx.save(); ctx.translate(-600, -10); ctx.rotate(-0.15);
        const cap = [[-60, -10], [0, -40], [60, -10], [0, 20], [-60, -10]];
        wash(ctx, cap, C.ink, { alpha: 0.95, seed: 813, t }); sketch(ctx, cap, { width: 3, seed: 814, t });
        wash(ctx, shp.rect(-34, 5, 68, 36), C.ink, { alpha: 0.95, seed: 815, t });
        sketch(ctx, [[40, -6], [52, 40]], { width: 3, seed: 816, t, color: C.yellow });
        ctx.restore();
        ctx.restore();
        popText(ctx, '졸업을 축하합니다!', W / 2 + 60, 150, t - 9.9, { size: 100, color: C.red, stagger: 0.07 });
      }
      // 꽃가루
      if (t > 10) {
        for (let k = 0; k < 40; k++) {
          const r = rng(900 + k);
          const x = r() * W, sp = 120 + r() * 160;
          const y = (t - 10) * sp + r() * -400; if (y < -20 || y > H) continue;
          ctx.save(); ctx.translate(x + Math.sin(t * 2 + k) * 30, y); ctx.rotate(t * 3 * (r() - 0.5));
          ctx.fillStyle = [C.red, C.yellow, C.blue, C.green, C.pink, C.purple][k % 6];
          ctx.fillRect(-8, -5, 16, 10);
          ctx.restore();
        }
      }
    },
    draw(ctx, t, dur) {
      if (t < this.pageAt) return this.drawStage(ctx, t);
      this.drawForest(ctx, t);
      const p = (t - this.pageAt) / TRANSITION;
      if (p < 1) {
        epiBuf = epiBuf || Object.assign(document.createElement('canvas'), { width: W, height: H });
        const b = epiBuf.getContext('2d');
        b.save(); this.drawStage(b, t); b.restore();
        tornTransition(ctx, epiBuf, p, 41);
      }
    },
  },
];
let epiBuf = null;


// ==================== 졸업 사진 페이지 ====================
// 각 장의 나레이션이 끝나면 페이지가 찢어지며 졸업복 사진 페이지로 넘어간다.
const GRAD_DUR = 4.6;
const GRAD = {
  hajun: { call: '하준아', line: '미래의 멋진 드러머', color: C.red, main: 'hajun_g1', extras: ['hajun_drum', 'hajun_g2'] },
  geunho: { call: '근호야', line: '친구들의 목소리를 듣는 리더', color: C.blue, main: 'geunho_g1', extras: ['geunho_g3', 'geunho_g2'] },
  juwon: { call: '주원아', line: '척척박사 축구왕, 우리 반 보컬', color: C.purple, main: 'juwon_g1', extras: ['juwon_vocal', 'juwon_g2'] },
  gyuyeon: { call: '규연아', line: 'AI보다 반짝이는 생각', color: C.teal, main: 'gyuyeon_g1', extras: ['gyuyeon_g2', 'gyuyeon_juwon'] },
  yugeon: { call: '유건아', line: '바람처럼 달려 야구왕으로', color: C.green, main: 'yugeon_g1', extras: ['yugeon_g3', 'yugeon_g2'] },
  taeyeon: { call: '태연아', line: '무대를 빛낼 팔방미인', color: C.pink, main: 'taeyeon_g1', extras: ['taeyeon_bass', 'taeyeon_g2'] },
  yumin: { call: '유민아', line: '반짝반짝 빛날 우리 스타', color: C.orange, main: 'yumin_g1', extras: ['yumin_g2'] },
};
const GRAD_KEYS = ['hajun_g1', 'hajun_g2', 'hajun_drum', 'geunho_g1', 'geunho_g2', 'geunho_g3', 'juwon_g1', 'juwon_g2', 'juwon_vocal',
  'gyuyeon_g1', 'gyuyeon_g2', 'gyuyeon_juwon', 'yugeon_g1', 'yugeon_g2', 'yugeon_g3', 'taeyeon_g1', 'taeyeon_g2', 'taeyeon_bass',
  'yumin_g1', 'yumin_g2', 'group1', 'group2', 'group3', 'school'];

function banner(ctx, str, y, t, start, color, size = 84) {
  const bp = prog(t, start, 0.6);
  if (bp <= 0) return;
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.015); ctx.scale(easeOutBack(bp), easeOutBack(bp));
  const band = [[-760, -95], [760, -86], [730, 0], [760, 95], [-760, 88], [-730, 0]];
  ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); band.forEach(([x, yy], j) => j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  sketch(ctx, [...band, band[0]], { width: 4, seed: 900 + size, t });
  tape(ctx, -680, -90, 140, -0.5, 901); tape(ctx, 680, -90, 140, 0.5, 902);
  // 학사모
  ctx.save(); ctx.translate(-640, -6); ctx.rotate(-0.15);
  const cap = [[-56, -10], [0, -38], [56, -10], [0, 18], [-56, -10]];
  wash(ctx, cap, C.ink, { alpha: 0.95, seed: 903, t }); sketch(ctx, cap, { width: 3, seed: 904, t });
  wash(ctx, shp.rect(-32, 4, 64, 34), C.ink, { alpha: 0.95, seed: 905, t });
  sketch(ctx, [[38, -6], [50, 38]], { width: 3, seed: 906, t, color: C.yellow });
  ctx.restore();
  ctx.restore();
  popText(ctx, str, W / 2 + 50, y, t - start - 0.25, { size, color, stagger: 0.05 });
}

function confetti(ctx, t, seed, n = 36) {
  for (let k = 0; k < n; k++) {
    const r = rng(seed + k);
    const x = r() * W, sp = 110 + r() * 150;
    const y = t * sp - 60 - r() * 500; if (y < -20 || y > H) continue;
    ctx.save(); ctx.translate(x + Math.sin(t * 2 + k) * 30, y); ctx.rotate(t * 3 * (r() - 0.5));
    ctx.fillStyle = [C.red, C.yellow, C.blue, C.green, C.pink, C.purple][k % 6];
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
  }
}

function gradPage(ctx, t, key) {
  const g = GRAD[key];
  drawPaper(ctx); ambient(ctx, t, 300 + key.length);
  // 은은한 빛
  const glow = ctx.createRadialGradient(700, 560, 50, 700, 560, 650);
  glow.addColorStop(0, 'rgba(255,230,160,0.35)'); glow.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // 상자(boxW×boxH) 안에 꽉 차게 맞춘 폭
  const fit = (im, bw, bh) => Math.min(bw, bh * im.width / im.height);
  const main = IMG[g.main];
  sticker(ctx, main, 540, 640, fit(main, 660, 790), t, { start: 0.25, rot: -0.035, seed: 960 + key.length });
  g.extras.forEach((k, i) => {
    const im = IMG[k]; const land = im.width > im.height;
    let x, y, bw, bh, r;
    if (g.extras.length === 1) [x, y, bw, bh, r] = [1340, 625, 760, 800, 0.04];
    else if (i === 0) [x, y, bw, bh, r] = [1250, 520, 820, 600, 0.04];
    else if (land) [x, y, bw, bh, r] = [1560, 830, 600, 440, -0.05];
    else [x, y, bw, bh, r] = [1640, 790, 430, 560, -0.05];
    sticker(ctx, im, x, y, fit(im, bw, bh), t, { start: 0.7 + i * 0.45, rot: r, seed: 970 + i, tapes: 1 });
  });
  banner(ctx, `${g.call}, 너의 꿈을 응원해!`, 118, t, 0.5, g.color, 84);
  const lp = prog(t, 1.5, 0.5);
  if (lp > 0) {
    ctx.save(); ctx.translate(540, 1000); ctx.rotate(-0.03); ctx.scale(easeOutBack(lp), easeOutBack(lp));
    ctx.font = '400 83px "Nanum Pen Script"'; const lw = ctx.measureText(g.line).width + 70;
    ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(-lw / 2, -42, lw, 84); ctx.shadowColor = 'transparent';
    tape(ctx, -lw / 2 + 20, -40, 90, -0.5, 985);
    text(ctx, g.line, 0, 2, { size: 64, font: 'Nanum Pen Script', weight: 400, color: g.color });
    ctx.restore();
  }
  sparkle(ctx, 300, 300, 0.8, { seed: 980, t }); sparkle(ctx, 1000, 260, 0.6, { seed: 981, t }); sparkle(ctx, 1780, 600, 0.7, { seed: 982, t });
  confetti(ctx, t, 990);
}

// 장면에 졸업 사진 페이지를 붙인다
let gradBuf = null;
SCENES.forEach(s => {
  if (!GRAD[s.key]) return;
  const orig = s.draw.bind(s);
  s.narrDur = s.dur;
  s.dur = s.narrDur + GRAD_DUR;
  s.draw = (ctx, t) => {
    if (t < s.narrDur) return orig(ctx, t, s.narrDur);
    const tg = t - s.narrDur;
    gradPage(ctx, tg, s.key);
    const p = tg / TRANSITION;
    if (p < 1) {
      gradBuf = gradBuf || Object.assign(document.createElement('canvas'), { width: W, height: H });
      const b = gradBuf.getContext('2d');
      b.save(); orig(b, t, s.narrDur); b.restore();
      tornTransition(ctx, gradBuf, p, 53);
    }
  };
});

// ==================== 엔딩 크레딧 ====================
function coverImage(ctx, img, zoom, alpha = 1) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}
SCENES.push({
  key: 'ending', dur: 15,
  narr: '',
  draw(ctx, t, dur) {
    drawPaper(ctx);
    // 1부: 들판 배경 + 졸업 단체 사진
    const swap = easeInOut(prog(t, 7.0, 1.4));
    coverImage(ctx, IMG.ending_bg1, 1.04 + t * 0.006, 1);
    if (swap > 0) coverImage(ctx, IMG.ending_bg2, 1.1 - (t - 7) * 0.006, swap);
    // 따뜻한 빛 + 비네팅
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.0);
    v.addColorStop(0, 'rgba(255,240,210,0.08)'); v.addColorStop(1, 'rgba(60,40,20,0.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (swap < 1) {
      ctx.save(); ctx.globalAlpha = 1 - swap;
      sticker(ctx, IMG.group1, 560, 470, 760, t, { start: 0.8, rot: -0.06, seed: 1001 });
      sticker(ctx, IMG.group2, 1370, 600, 760, t, { start: 1.8, rot: 0.05, seed: 1002 });
      text(ctx, '함께여서 행복했던 1년', W / 2, 940, { size: 84, font: 'Single Day', weight: 400, color: '#fff', reveal: prog(t, 3.0, 1.0), outline: { width: 10, color: 'rgba(59,47,42,0.55)' } });
      ctx.restore();
    }
    // 2부: 단체 사진 + 크레딧
    if (swap > 0) {
      ctx.save(); ctx.globalAlpha = swap;
      sticker(ctx, IMG.group3, W / 2, 480, 500, t, { start: 7.4, rot: -0.02, seed: 1003 });
      const lines = [
        ['2026 졸업을 축하합니다', 76, C.red],
        ['하준 · 근호 · 주원 · 규연 · 유건 · 태연 · 유민', 60, C.ink],
        ['우리의 다음 이야기를 응원해!', 60, C.green],
      ];
      const cp = prog(t, 8.3, 0.6);
      if (cp > 0) {
        ctx.save(); ctx.translate(W / 2, 170); ctx.rotate(-0.01); ctx.scale(easeOutBack(cp), easeOutBack(cp));
        ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
        ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.fillRect(-640, -150, 1280, 300); ctx.shadowColor = 'transparent';
        sketch(ctx, shp.rect(-640, -150, 1280, 300), { width: 3.5, seed: 1010, t });
        tape(ctx, -560, -150, 150, -0.4, 1011); tape(ctx, 560, -150, 150, 0.4, 1012);
        ctx.restore();
      }
      lines.forEach(([s, size, color], i) => text(ctx, s, W / 2, 80 + i * 88, { size, font: 'Single Day', weight: 400, color, reveal: prog(t, 8.7 + i * 0.9, 0.9) }));
      ctx.restore();
    }
    // 마지막 페이드아웃
    const fo = prog(t, dur - 1.6, 1.6);
    if (fo > 0) { ctx.fillStyle = `rgba(20,14,10,${fo})`; ctx.fillRect(0, 0, W, H); }
  },
});

// 시작 시각 계산
let TOTAL = 0;
SCENES.forEach(s => { s.start = TOTAL; TOTAL += s.dur; });
const TRANSITION = 0.9;
