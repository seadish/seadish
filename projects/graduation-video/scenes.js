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
  return Promise.all(jobs);
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
          const sp = shp.ellipse(x, y, 16 * easeOutBack(p), 24 * easeOutBack(p), 20);
          wash(ctx, sp, C.brown, { alpha: 0.9, seed: i + 4, t });
          sketch(ctx, sp, { width: 3, seed: i + 4, t });
        }
      }
      ctx.restore();
      // 교실 낙서
      const cp = prog(t, 3.1, 1.4);
      const X0 = 300, X1 = 1620, Y0 = 330, Y1 = 800;
      sketch(ctx, [[X0, Y1], [X0, Y0], [W / 2, Y0 - 110], [X1, Y0], [X1, Y1], [X0, Y1]], { width: 5, seed: 11, t, progress: cp, color: C.pencil });
      if (cp > 0.6) {
        const wp = prog(t, 3.9, 0.8);
        [[420, 400], [1380, 400]].forEach(([x, y], i) => {
          sketch(ctx, shp.rect(x, y, 120, 90), { width: 3, seed: 20 + i, t, progress: wp });
          sketch(ctx, [[x + 60, y], [x + 60, y + 90]], { width: 2.5, seed: 22 + i, t, progress: wp });
          wash(ctx, shp.rect(x, y, 120, 90), C.blue, { alpha: 0.35 * wp, seed: 24 + i, t });
        });
        // 칠판
        sketch(ctx, shp.rect(760, 360, 400, 120), { width: 4, seed: 30, t, progress: wp });
        wash(ctx, shp.rect(760, 360, 400, 120), C.green, { alpha: 0.55 * wp, seed: 31, t });
        text(ctx, '6학년 우리 반', W / 2, 422, { size: 52, font: 'Nanum Pen Script', weight: 400, color: '#fff', reveal: prog(t, 4.4, 0.8) });
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
          const sp = shp.ellipse(x, y + 120, 12 * g, 18 * g, 16);
          wash(ctx, sp, C.brown, { alpha: 0.95, seed: 40 + i, t }); sketch(ctx, sp, { width: 2.5, seed: 40 + i, t });
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
      const cx = 1350;
      // 책상 → 드럼
      const deskA = 1 - prog(t, 4.2, 0.6);
      if (deskA > 0) {
        ctx.save(); ctx.globalAlpha = deskA;
        const dp = prog(t, 1.0, 0.8);
        sketch(ctx, shp.rect(1060, 560, 580, 40), { width: 5, seed: 61, t, progress: dp });
        wash(ctx, shp.rect(1060, 560, 580, 40), C.brown, { alpha: 0.5 * dp, seed: 62, t });
        sketch(ctx, [[1100, 600], [1100, 800]], { width: 5, seed: 63, t, progress: dp });
        sketch(ctx, [[1600, 600], [1600, 800]], { width: 5, seed: 64, t, progress: dp });
        // 두드리는 손 (주먹 동그라미)
        const hit = Math.abs(Math.sin(t * 6));
        sketch(ctx, shp.circle(1250, 520 - hit * 60, 32, 24), { width: 4, seed: 65, t });
        sketch(ctx, shp.circle(1450, 520 - (1 - hit) * 60, 32, 24), { width: 4, seed: 66, t });
        ctx.restore();
        popText(ctx, '쿵!', 1180, 380, t - 1.6, { size: 100, color: C.red });
        popText(ctx, '쿵!', 1520, 340, t - 2.4, { size: 120, color: C.orange });
      }
      // 드럼 세트
      const kp = prog(t, 4.4, 1.6);
      if (kp > 0) {
        const bass = shp.circle(cx, 620, 150, 56);
        wash(ctx, bass, C.red, { alpha: 0.55 * kp, seed: 70, t });
        sketch(ctx, bass, { width: 5, seed: 71, t, progress: kp });
        sketch(ctx, shp.circle(cx, 620, 95, 40), { width: 3, seed: 72, t, progress: kp, color: C.pencil });
        text(ctx, 'HAJUN', cx, 620, { size: 48, font: 'Jua', weight: 400, color: '#fff', alpha: kp });
        const snare = shp.ellipse(1105, 520, 95, 28, 30);
        sketch(ctx, snare, { width: 4, seed: 73, t, progress: kp });
        sketch(ctx, [[1010, 520], [1010, 590], [1200, 590], [1200, 520]], { width: 4, seed: 74, t, progress: kp });
        wash(ctx, [[1010, 520], [1010, 590], [1200, 590], [1200, 520]], C.yellow, { alpha: 0.5 * kp, seed: 75, t });
        sketch(ctx, [[1105, 590], [1060, 790]], { width: 3, seed: 76, t, progress: kp });
        sketch(ctx, [[1105, 590], [1150, 790]], { width: 3, seed: 77, t, progress: kp });
        // 심벌
        const cym = shp.ellipse(1620, 400, 120, 22, 30);
        const wob = Math.sin(t * 9) * 0.06 * kp;
        ctx.save(); ctx.translate(1620, 400); ctx.rotate(wob); ctx.translate(-1620, -400);
        wash(ctx, cym, C.yellow, { alpha: 0.8 * kp, seed: 78, t }); sketch(ctx, cym, { width: 4, seed: 79, t, progress: kp });
        ctx.restore();
        sketch(ctx, [[1620, 420], [1620, 790]], { width: 3, seed: 80, t, progress: kp });
        // 스틱
        if (kp >= 1) {
          const a = Math.max(0, Math.sin(t * 10)) * 0.45;
          ctx.save(); ctx.translate(980, 330); ctx.rotate(0.95 - a);
          sketch(ctx, [[0, 0], [200, 0]], { width: 9, seed: 81, t, color: C.brown }); ctx.restore();
          ctx.save(); ctx.translate(1520, 300); ctx.rotate(Math.PI - 1.15 + Math.max(0, -Math.sin(t * 10)) * 0.45);
          sketch(ctx, [[0, 0], [200, 0]], { width: 9, seed: 82, t, color: C.brown }); ctx.restore();
          for (let i = 0; i < 3; i++) note(ctx, 1200 + i * 150 + Math.sin(t * 2 + i) * 20, 300 - ((t * 60 + i * 70) % 160), 1, { seed: 90 + i, t, color: [C.red, C.blue, C.purple][i] });
        }
      }
      // COMING SOON 팻말
      const sp = prog(t, 8.3, 0.6);
      if (sp > 0) {
        ctx.save(); ctx.translate(1330, 290); ctx.rotate(-0.06); ctx.scale(easeOutBack(sp), easeOutBack(sp));
        ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#fff6d8'; ctx.fillRect(-240, -60, 480, 120); ctx.shadowColor = 'transparent';
        sketch(ctx, shp.rect(-240, -60, 480, 120), { width: 3.5, seed: 95, t });
        text(ctx, 'COMING SOON!', 0, 4, { size: 72, font: 'Jua', weight: 400, color: C.red });
        tape(ctx, -200, -60, 110, -0.4, 96); tape(ctx, 200, -60, 110, 0.4, 97);
        ctx.restore();
        sparkle(ctx, 1080, 200, 0.8, { seed: 98, t }); sparkle(ctx, 1630, 300, 0.7, { seed: 99, t });
      }
    },
  },

  // ---------- 2장 근호 ----------
  {
    key: 'geunho', dur: 12,
    narr: "두 번째 아이, 근호의 씨앗은 사람들을 모으는 힘을 가졌어요. 전교회장이 된 근호가 의사봉을 '탕' 치면, 모두의 의견이 하나로 모였답니다.",
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 2, name: '근호', title: '우리 학교 전교회장', color: C.blue, main: 'geunho1', mainW: 560, mainY: 400, second: null });
      // 자치회의 사진 (가운데 큰 스티커)
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
        const x = lerp(sx + Math.cos(t + angle) * 10, 1330, merge), y = lerp(sy + Math.sin(t * 1.3 + angle) * 8, 230, merge);
        ctx.save(); ctx.globalAlpha = 1 - merge * merge; ctx.translate(x, y); ctx.scale(easeOutBack(p) * (1 - merge * 0.6), easeOutBack(p) * (1 - merge * 0.6));
        bubble(ctx, 0, 0, 120, 74, t, { seed: 131 + i, tail: [-0.2, 1] });
        text(ctx, w, 0, 2, { size: 40, font: 'Jua', weight: 400, color: [C.red, C.blue, C.green, C.purple][i % 4] });
        ctx.restore();
      });
      const bp = prog(t, 7.1, 0.6);
      if (bp > 0) {
        ctx.save(); ctx.translate(1330, 240); ctx.scale(easeOutElastic(bp), easeOutElastic(bp));
        bubble(ctx, 0, 0, 620, 150, t, { seed: 150, fill: '#fffbe8', tail: [0, 1] });
        text(ctx, '모두의 의견을 하나로!', 0, 4, { size: 64, font: 'Jua', weight: 400, color: C.blue });
        ctx.restore();
        sparkle(ctx, 1000, 170, 0.7, { seed: 151, t }); sparkle(ctx, 1660, 300, 0.6, { seed: 152, t });
      }
      // 의사봉
      const gp = prog(t, 3.2, 0.5);
      if (gp > 0) {
        const hit = t > 4.4 ? 0 : Math.max(0, Math.sin((t - 3.2) * 4)) * 0.8;
        ctx.save(); ctx.translate(820, 700); ctx.scale(easeOutBack(gp), easeOutBack(gp));
        sketch(ctx, shp.ellipse(0, 70, 90, 20, 24), { width: 4, seed: 160, t });
        wash(ctx, shp.ellipse(0, 70, 90, 20, 24), C.brown, { alpha: 0.6, seed: 161, t });
        ctx.translate(0, 20); ctx.rotate(-0.35 - hit);
        sketch(ctx, [[0, 0], [170, 30]], { width: 11, seed: 162, t, color: C.brown });
        const head = shp.rect(-30, -55, 60, 110);
        wash(ctx, head, C.brown, { alpha: 0.95, seed: 163, t }); sketch(ctx, head, { width: 4, seed: 164, t });
        sketch(ctx, [[-30, -30], [30, -30]], { width: 3, seed: 165, t, color: C.yellow });
        sketch(ctx, [[-30, 30], [30, 30]], { width: 3, seed: 166, t, color: C.yellow });
        ctx.restore();
        if (t > 4.3) popText(ctx, '탕!', 900, 560, t - 4.3, { size: 110, color: C.red });
      }
    },
  },

  // ---------- 3장 주원 ----------
  {
    key: 'juwon', dur: 12,
    narr: '세 번째 아이, 주원이의 씨앗은 세 갈래로 싹을 틔웠어요. 공부도, 운동도, 노래도 모두 꽃을 피웠죠. 그중에서도 가장 크게 자란 건, 우리 반을 대표하는 목소리였답니다.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 3, name: '주원', title: '삼박자 보컬', color: C.purple, main: 'juwon2', second: 'gyuyeon_juwon_sports', secondAt: 7.2 });
      const ground = 800;
      sketch(ctx, [[980, ground], [1780, ground]], { width: 5, seed: 200, t, progress: prog(t, 0.8, 0.8), color: C.brown });
      wash(ctx, [[980, ground], [1780, ground], [1780, ground + 30], [980, ground + 30]], C.brown, { alpha: 0.35 * prog(t, 0.8, 0.8), seed: 201, t });
      const items = [
        { x: 1110, label: '공부', color: C.blue, kind: 'book' },
        { x: 1380, label: '노래', color: C.purple, kind: 'note' },
        { x: 1650, label: '운동', color: C.orange, kind: 'ball' },
      ];
      items.forEach((it, i) => {
        const big = it.kind === 'note';
        const g1 = prog(t, 1.6 + i * 0.5, 1.2);
        const g2 = big ? prog(t, 6.4, 1.6) : 0;
        if (g1 <= 0) return;
        const topY = lerp(ground, 560, easeOut(g1)) - (big ? 170 * easeOut(g2) : 0);
        const sway = Math.sin(t * 1.5 + i) * 10;
        sketch(ctx, [[it.x, ground], [it.x + sway * 0.5, (ground + topY) / 2], [it.x + sway, topY]], { width: 6, seed: 210 + i, t, color: C.green });
        // 잎
        const lp = prog(t, 2.2 + i * 0.5, 0.5);
        if (lp > 0) {
          const ly = (ground + topY) / 2 + 30;
          const leaf = [[it.x, ly], [it.x + 50 * lp, ly - 30 * lp], [it.x + 70 * lp, ly - 5], [it.x, ly]];
          wash(ctx, leaf, C.green, { alpha: 0.8, seed: 220 + i, t }); sketch(ctx, leaf, { width: 3, seed: 221 + i, t });
        }
        const hp = prog(t, 2.6 + i * 0.5, 0.6);
        if (hp > 0 && !(big && g2 > 0.2)) {
          const s = easeOutBack(hp), x = it.x + sway, y = topY - 40;
          ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
          if (it.kind === 'book') {
            const L = [[-70, -40], [0, -25], [0, 45], [-70, 30]], R = [[0, -25], [70, -40], [70, 30], [0, 45]];
            wash(ctx, L, C.blue, { alpha: 0.7, seed: 230, t }); wash(ctx, R, C.teal, { alpha: 0.7, seed: 231, t });
            sketch(ctx, [...L, L[0]], { width: 3.5, seed: 232, t }); sketch(ctx, [...R, R[0]], { width: 3.5, seed: 233, t });
          } else if (it.kind === 'ball') {
            const b = shp.circle(0, 0, 50, 36);
            wash(ctx, b, C.orange, { alpha: 0.85, seed: 234, t }); sketch(ctx, b, { width: 4, seed: 235, t });
            sketch(ctx, [[-50, 0], [50, 0]], { width: 3, seed: 236, t }); sketch(ctx, [[0, -50], [0, 50]], { width: 3, seed: 237, t });
          } else note(ctx, 0, 20, 1.4, { seed: 238, t, color: C.purple });
          ctx.restore();
          text(ctx, it.label, it.x + sway - 62, topY + 70, { size: 58, font: 'Nanum Pen Script', weight: 400, color: it.color, alpha: hp });
        }
        // 마이크 꽃
        if (big && g2 > 0.2) {
          const fp = easeOutBack(prog(t, 7.2, 0.9));
          const x = it.x + sway, y = topY - 50;
          for (let k = 0; k < 8; k++) {
            const a = k / 8 * Math.PI * 2 + t * 0.3;
            const px = x + Math.cos(a) * 95 * fp, py = y + Math.sin(a) * 95 * fp;
            const petal = shp.ellipse(px, py, 55 * fp, 38 * fp, 20);
            wash(ctx, petal, k % 2 ? C.pink : C.purple, { alpha: 0.75, seed: 240 + k, t }); sketch(ctx, petal, { width: 2.5, seed: 250 + k, t });
          }
          const head = shp.circle(x, y, 62 * fp, 32);
          wash(ctx, head, '#cfd3da', { alpha: 0.95, seed: 260, t }); sketch(ctx, head, { width: 4, seed: 261, t });
          for (let k = -2; k <= 2; k++) sketch(ctx, [[x - 50 * fp, y + k * 20 * fp], [x + 50 * fp, y + k * 20 * fp]], { width: 2, seed: 262 + k, t, color: C.pencil });
          if (t > 8.2) {
            for (let k = 0; k < 4; k++) {
              const ph = ((t - 8.2) * 0.5 + k / 4) % 1;
              note(ctx, x + 120 + ph * 260, y - 40 - ph * 200 + Math.sin(ph * 8 + k) * 30, 1, { seed: 270 + k, t, color: [C.purple, C.pink, C.blue, C.red][k] });
            }
            popText(ctx, '대표 보컬!', 1690, 470, t - 9.0, { size: 76, color: C.purple });
          }
        }
      });
    },
  },

  // ---------- 4장 규연 ----------
  {
    key: 'gyuyeon', dur: 12,
    narr: '네 번째 아이, 규연이의 씨앗은 손끝에서 피어났어요. 건반 위에서는 감미로운 멜로디가 흐르고, 어떤 상황에서도 인공지능보다 빠르게 정답을 찾아냈죠.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 4, name: '규연', title: '건반 위의 천재', color: C.teal, main: 'gyuyeon1', mainY: 400, second: 'gyuyeon2', secondW: 240, secondY: 730 });
      // 건반
      const kp = prog(t, 1.0, 1.4);
      const KX = 1000, KY = 640, KW = 640, KH = 150;
      if (kp > 0) {
        wash(ctx, shp.rect(KX, KY, KW, KH), '#fff', { alpha: 0.95 * kp, seed: 300, t });
        sketch(ctx, shp.rect(KX, KY, KW, KH), { width: 4.5, seed: 301, t, progress: kp });
        for (let i = 1; i < 12; i++) sketch(ctx, [[KX + i * KW / 12, KY], [KX + i * KW / 12, KY + KH]], { width: 2.5, seed: 302 + i, t, progress: prog(t, 1.4 + i * 0.03, 0.3) });
        [1, 2, 4, 5, 6, 8, 9, 11].forEach((i, k) => {
          const bx = KX + i * KW / 12 - 18;
          const bp = prog(t, 2.0 + k * 0.04, 0.2);
          if (bp > 0) { ctx.fillStyle = C.ink; ctx.globalAlpha = bp; ctx.fillRect(bx, KY, 36, 90); ctx.globalAlpha = 1; }
        });
        // 눌리는 건반 하이라이트
        if (t > 2.4) {
          const key = Math.floor(t * 4) % 12;
          ctx.fillStyle = 'rgba(79,163,165,0.45)'; ctx.fillRect(KX + key * KW / 12 + 3, KY + 92, KW / 12 - 6, KH - 96);
          for (let k = 0; k < 5; k++) {
            const ph = ((t - 2.4) * 0.4 + k / 5) % 1;
            const x = KX + 80 + ph * 520, y = KY - 30 - Math.sin(ph * Math.PI) * 200 - k * 6;
            note(ctx, x, y, 0.9, { seed: 320 + k, t, color: [C.teal, C.blue, C.purple, C.pink, C.green][k] });
          }
          // 멜로디 물결선
          const wave = []; for (let i = 0; i <= 40; i++) { const x = KX + i * 16; wave.push([x, KY - 60 + Math.sin(i * 0.5 - t * 4) * 18]); }
          sketch(ctx, wave, { width: 3, seed: 330, t, color: C.teal, alpha: 0.6, progress: prog(t, 2.4, 1) });
        }
      }
      // 로봇 vs 규연
      const rp = prog(t, 4.6, 0.9);
      const RX = 1650, RY = 440;
      if (rp > 0) {
        const head = shp.rect(RX - 70, RY - 60, 140, 110), body = shp.rect(RX - 90, RY + 60, 180, 120);
        wash(ctx, head, '#c9d4dc', { alpha: 0.9 * rp, seed: 340, t }); wash(ctx, body, '#c9d4dc', { alpha: 0.9 * rp, seed: 341, t });
        sketch(ctx, head, { width: 4, seed: 342, t, progress: rp }); sketch(ctx, body, { width: 4, seed: 343, t, progress: rp });
        sketch(ctx, [[RX, RY - 60], [RX, RY - 100]], { width: 3, seed: 344, t, progress: rp });
        sketch(ctx, shp.circle(RX, RY - 108, 10, 12), { width: 3, seed: 345, t, progress: rp });
        const blink = Math.sin(t * 12) > 0.6;
        [[RX - 32, RY - 10], [RX + 32, RY - 10]].forEach(([x, y], i) => {
          if (blink && t > 8.6) sketch(ctx, [[x - 12, y], [x + 12, y]], { width: 4, seed: 346 + i, t });
          else { wash(ctx, shp.circle(x, y, 14, 14), C.red, { alpha: 0.9, seed: 348 + i, t }); sketch(ctx, shp.circle(x, y, 14, 14), { width: 3, seed: 350 + i, t }); }
        });
        if (t > 5.6 && t < 8.6) {
          const dots = '.'.repeat(1 + Math.floor(t * 3) % 3);
          ctx.save(); ctx.translate(RX - 10, RY - 190);
          bubble(ctx, 0, 0, 260, 90, t, { seed: 352, tail: [0.2, 1] });
          text(ctx, '계산 중' + dots, -110, 4, { size: 44, font: 'Jua', weight: 400, color: C.pencil, align: 'left' });
          ctx.restore();
        }
        if (t > 8.6) {
          ctx.save(); ctx.translate(RX - 10, RY - 190);
          bubble(ctx, 0, 0, 160, 90, t, { seed: 353, tail: [0.2, 1] });
          text(ctx, '?!', 0, 4, { size: 56, font: 'Jua', weight: 400, color: C.red });
          ctx.restore();
        }
      }
      // 전구 번쩍
      const lp = prog(t, 7.4, 0.5);
      if (lp > 0) {
        const LX = 1120, LY = 400, s = easeOutBack(lp);
        const glow = ctx.createRadialGradient(LX, LY, 0, LX, LY, 170 * s);
        glow.addColorStop(0, 'rgba(255,225,110,0.75)'); glow.addColorStop(1, 'rgba(255,225,110,0)');
        ctx.fillStyle = glow; ctx.fillRect(LX - 200, LY - 200, 400, 400);
        ctx.save(); ctx.translate(LX, LY); ctx.scale(s, s);
        const bulb = shp.circle(0, 0, 60, 30);
        wash(ctx, bulb, C.yellow, { alpha: 0.95, seed: 360, t }); sketch(ctx, bulb, { width: 4, seed: 361, t });
        sketch(ctx, shp.rect(-28, 58, 56, 40), { width: 4, seed: 362, t });
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; sketch(ctx, [[Math.cos(a) * 85, Math.sin(a) * 85], [Math.cos(a) * 120, Math.sin(a) * 120]], { width: 4, seed: 363 + k, t, color: C.orange }); }
        ctx.restore();
        popText(ctx, '번쩍!', LX - 10, LY - 165, t - 7.8, { size: 80, color: C.orange });
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
      // 달리기 장면
      if (swap < 1) {
        ctx.save(); ctx.globalAlpha = 1 - swap;
        // 트랙
        sketch(ctx, [[980, 760], [1800, 760]], { width: 4, seed: 400, t, progress: prog(t, 0.8, 0.6), color: C.brown });
        sketch(ctx, [[980, 640], [1800, 640]], { width: 3, seed: 401, t, progress: prog(t, 0.9, 0.6), color: C.brown, alpha: 0.5 });
        // 속도선
        for (let k = 0; k < 9; k++) {
          const ph = ((t * 1.6 + k / 9) % 1);
          const y = 300 + (k * 53) % 420, x = 1800 - ph * 900;
          sketch(ctx, [[x, y], [x + 120 + (k % 3) * 40, y]], { width: 3, seed: 410 + k, t, color: C.teal, alpha: 0.7 });
        }
        // 헉헉 친구들 (뒤처짐)
        const lag = prog(t, 1.4, 4.5);
        for (let k = 0; k < 2; k++) {
          const x = 1260 - k * 170 - lag * 240, y = 600, bob = Math.abs(Math.sin(t * 8 + k)) * 12;
          sketch(ctx, shp.circle(x, y - 110 - bob, 28, 22), { width: 3.5, seed: 420 + k, t, progress: prog(t, 1.2, 0.5) });
          sketch(ctx, [[x, y - 82 - bob], [x - 8, y - 20 - bob], [x - 40, y + 30], [x - 8, y - 20 - bob], [x + 30, y + 30]], { width: 3.5, seed: 422 + k, t, progress: prog(t, 1.2, 0.5) });
          sketch(ctx, [[x - 4, y - 65 - bob], [x - 45, y - 40 - bob]], { width: 3.5, seed: 424 + k, t, progress: prog(t, 1.2, 0.5) });
          if (t > 2.5) text(ctx, '헉헉', x, y - 170 - bob, { size: 40, font: 'Nanum Pen Script', weight: 400, color: C.pencil, rot: -0.1 });
        }
        // 유건 얼굴 배지 (앞서 달림)
        const bob = Math.abs(Math.sin(t * 9)) * 18;
        face(ctx, IMG.face_yugeon, 1560 + Math.sin(t * 2) * 15, 470 - bob, 95, t, { start: 1.0, seed: 430 });
        if (t > 1.5) {
          for (let k = 0; k < 3; k++) {
            const ph = ((t * 2 + k / 3) % 1);
            const pts = shp.circle(1440 - ph * 150, 700 - ph * 30, 20 + ph * 30, 16);
            sketch(ctx, pts, { width: 3, seed: 440 + k, t, alpha: 1 - ph, color: C.brown });
          }
          popText(ctx, '쌩~!', 1560, 280, t - 2.2, { size: 90, color: C.teal });
        }
        ctx.restore();
      }
      // 야구장
      if (swap > 0) {
        ctx.save(); ctx.globalAlpha = swap;
        const D = [[1360, 800], [1600, 600], [1360, 400], [1120, 600]];
        wash(ctx, [[1360, 860], [1760, 560], [1360, 260], [960, 560]], C.green, { alpha: 0.45, seed: 450, t });
        wash(ctx, D, '#d9a66b', { alpha: 0.6, seed: 451, t });
        sketch(ctx, [...D, D[0]], { width: 4, seed: 452, t, color: '#fff' });
        D.forEach(([x, y], i) => wash(ctx, shp.rect(x - 14, y - 14, 28, 28), '#fff', { alpha: 1, seed: 453 + i, t }));
        // 타자 유건
        face(ctx, IMG.face_yugeon, 1360, 700, 70, t, { start: 6.6, seed: 460 });
        const swing = prog(t, 7.6, 0.25);
        ctx.save(); ctx.translate(1400, 740); ctx.rotate(lerp(-2.2, 0.4, easeOut(swing)));
        sketch(ctx, [[0, 0], [160, 0]], { width: 12, seed: 461, t, color: C.brown }); ctx.restore();
        ctx.restore();
        // 홈런 공 → 별
        const fp = prog(t, 7.8, 2.4);
        if (fp > 0 && fp < 1) {
          const x = lerp(1440, 1720, fp), y = 700 - Math.sin(fp * Math.PI * 0.85) * 520 - fp * 120;
          for (let k = 1; k < 8; k++) { const q = Math.max(0, fp - k * 0.025); sketch(ctx, shp.circle(lerp(1440, 1720, q), 700 - Math.sin(q * Math.PI * 0.85) * 520 - q * 120, 4, 8), { width: 3, seed: 470 + k, t, color: C.pencil, alpha: 0.6 }); }
          const b = shp.circle(x, y, 24, 20);
          wash(ctx, b, '#fff', { alpha: 1, seed: 480, t }); sketch(ctx, b, { width: 3.5, seed: 481, t });
          sketch(ctx, [[x - 12, y - 18], [x - 6, y], [x - 12, y + 18]], { width: 2.5, seed: 482, t, color: C.red });
        }
        if (fp >= 1) {
          const sp = prog(t, 10.2, 0.6);
          ctx.save(); ctx.translate(1720, 170); ctx.rotate(t * 0.8); ctx.scale(easeOutElastic(sp), easeOutElastic(sp));
          starDoodle(ctx, 0, 0, 60, { seed: 490, t }); ctx.restore();
          sparkle(ctx, 1620, 120, 0.7, { seed: 491, t }); sparkle(ctx, 1810, 260, 0.6, { seed: 492, t });
        }
        if (t > 8.0) popText(ctx, '홈런!', 1150, 260, t - 8.0, { size: 110, color: C.red });
      }
    },
  },

  // ---------- 6장 태연 ----------
  {
    key: 'taeyeon', dur: 12,
    narr: '여섯 번째 아이, 태연이의 씨앗은 팔방으로 가지를 뻗었어요. 공부도, 춤도, 연기도 척척. 무엇이든 해내는 우리 반 팔방미인이랍니다.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 6, name: '태연', title: '우리 반 팔방미인', color: C.pink, main: 'taeyeon1', second: 'yumin_taeyeon1', secondAt: 7.6 });
      const TX = 1370, TY = 520, ground = 820;
      const tp = prog(t, 0.9, 1.2);
      sketch(ctx, [[TX - 18, ground], [TX - 10, TY + 40], [TX, TY]], { width: 14, seed: 500, t, progress: tp, color: C.brown });
      sketch(ctx, [[TX + 18, ground], [TX + 10, TY + 40]], { width: 8, seed: 501, t, progress: tp, color: C.brown });
      sketch(ctx, [[1100, ground], [1640, ground]], { width: 4, seed: 502, t, progress: tp, color: C.green });
      const items = ['book', 'note', 'mask', 'star', 'heart', 'shoe', 'trophy', 'pencil'];
      const labels = ['공부', '춤', '연기', '', '', '', '', ''];
      items.forEach((kind, i) => {
        const a = lerp(-Math.PI * 1.05, Math.PI * 0.05, i / 7);
        const L = 270;
        const bp = prog(t, 2.1 + i * 0.22, 0.7);
        if (bp <= 0) return;
        const ex = TX + Math.cos(a) * L, ey = TY + Math.sin(a) * L * 0.85;
        sketch(ctx, [[TX, TY], [lerp(TX, ex, 0.5), lerp(TY, ey, 0.5) - 15], [ex, ey]], { width: 6, seed: 510 + i, t, progress: bp, color: C.brown });
        const lp = prog(t, 2.6 + i * 0.22, 0.5);
        if (lp > 0) {
          const blob = shp.circle(ex, ey, 62 * easeOutBack(lp), 20);
          wash(ctx, blob, C.green, { alpha: 0.55, seed: 520 + i, t, spread: 10 });
        }
        const ip = prog(t, 4.6 + i * 0.35, 0.5);
        if (ip > 0) {
          const s = easeOutBack(ip), bob = Math.sin(t * 2 + i) * 6;
          ctx.save(); ctx.translate(ex, ey + bob); ctx.scale(s, s);
          const sd = 530 + i * 3;
          if (kind === 'book') { const b = shp.rect(-34, -26, 68, 52); wash(ctx, b, C.blue, { alpha: 0.85, seed: sd, t }); sketch(ctx, b, { width: 3, seed: sd + 1, t }); sketch(ctx, [[0, -26], [0, 26]], { width: 3, seed: sd + 2, t }); }
          else if (kind === 'note') note(ctx, -6, 18, 1.1, { seed: sd, t, color: C.purple });
          else if (kind === 'mask') {
            const m1 = shp.circle(-18, 0, 26, 18), m2 = shp.circle(20, 4, 26, 18);
            wash(ctx, m1, '#fff', { alpha: 1, seed: sd, t }); sketch(ctx, m1, { width: 3, seed: sd + 1, t });
            wash(ctx, m2, C.yellow, { alpha: 1, seed: sd + 2, t }); sketch(ctx, m2, { width: 3, seed: sd + 3, t });
            sketch(ctx, shp.circle(-18, 6, 10, 10, 0.2, Math.PI * 0.8), { width: 2.5, seed: sd + 4, t });
            sketch(ctx, shp.circle(20, 18, 10, 10, Math.PI * 1.2, Math.PI * 0.6), { width: 2.5, seed: sd + 5, t });
          }
          else if (kind === 'star') starDoodle(ctx, 0, 0, 34, { seed: sd, t });
          else if (kind === 'heart') { const h = shp.heart(0, 0, 40); wash(ctx, h, C.red, { alpha: 0.85, seed: sd, t }); sketch(ctx, h, { width: 3, seed: sd + 1, t }); }
          else if (kind === 'shoe') { const sh = [[-36, 10], [-36, -20], [-10, -20], [6, 0], [36, 4], [36, 18], [-36, 18], [-36, 10]]; wash(ctx, sh, C.pink, { alpha: 0.9, seed: sd, t }); sketch(ctx, sh, { width: 3, seed: sd + 1, t }); }
          else if (kind === 'trophy') { const cup = [[-28, -30], [28, -30], [18, 8], [-18, 8], [-28, -30]]; wash(ctx, cup, C.yellow, { alpha: 0.95, seed: sd, t }); sketch(ctx, cup, { width: 3, seed: sd + 1, t }); sketch(ctx, [[0, 8], [0, 26], [-16, 30], [16, 30]], { width: 3, seed: sd + 2, t }); }
          else if (kind === 'pencil') { const pc = [[-36, 8], [24, -12], [36, -16], [28, -4], [-32, 16], [-36, 8]]; wash(ctx, pc, C.orange, { alpha: 0.9, seed: sd, t }); sketch(ctx, pc, { width: 3, seed: sd + 1, t }); }
          ctx.restore();
          if (labels[i]) text(ctx, labels[i], ex - 70, ey + 40, { size: 54, font: 'Nanum Pen Script', weight: 400, color: C.ink, alpha: ip });
        }
      });
      if (t > 8.6) {
        popText(ctx, '팔방미인!', 1730, 745, t - 8.6, { size: 80, color: C.pink });
        sparkle(ctx, 1080, 300, 0.7, { seed: 560, t }); sparkle(ctx, 1780, 420, 0.6, { seed: 561, t });
      }
    },
  },

  // ---------- 7장 유민 ----------
  {
    key: 'yumin', dur: 12,
    narr: '일곱 번째 아이, 유민이의 씨앗은 흙과 음악을 좋아했어요. 물레 위에서 도자기를 빚고, 음악에 맞춰 춤을 추던 유민이는 지금 반짝이는 스타로 자라는 중이에요.',
    draw(ctx, t, dur) {
      chapterBase(ctx, t, dur, { num: 7, name: '유민', title: '반짝반짝 스타', color: C.orange, main: 'yumin1', mainY: 400, second: 'yumin_taeyeon_camp1', secondAt: 8.0 });
      // 스포트라이트
      const sl = prog(t, 5.4, 0.6);
      if (sl > 0) {
        ctx.save(); ctx.globalAlpha = 0.55 * sl;
        const g = ctx.createLinearGradient(1700, 80, 1350, 800);
        g.addColorStop(0, 'rgba(255,236,170,0.95)'); g.addColorStop(1, 'rgba(255,236,170,0.15)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1660, 70); ctx.lineTo(1760, 70); ctx.lineTo(1660, 820); ctx.lineTo(1080, 820); ctx.closePath(); ctx.fill();
        ctx.restore();
        sketch(ctx, shp.rect(1650, 40, 120, 50), { width: 4, seed: 600, t });
        wash(ctx, shp.rect(1650, 40, 120, 50), C.ink, { alpha: 0.8, seed: 601, t });
      }
      // 물레와 도자기
      const WX = 1250, WY = 760;
      const wp = prog(t, 0.9, 0.9);
      const plate = shp.ellipse(WX, WY, 190, 38, 36);
      wash(ctx, plate, '#9aa3ab', { alpha: 0.8 * wp, seed: 610, t }); sketch(ctx, plate, { width: 4, seed: 611, t, progress: wp });
      sketch(ctx, [[WX - 120, WY + 30], [WX - 140, WY + 90], [WX + 140, WY + 90], [WX + 120, WY + 30]], { width: 4, seed: 612, t, progress: wp });
      const vp = easeOut(prog(t, 1.6, 2.6));
      if (vp > 0) {
        const h = 260 * vp;
        const body = y => 55 + 60 * Math.sin(Math.PI * y / 190 * 0.95);
        const prof = y => y <= 190 ? body(y) : y < 240 ? lerp(body(190), 36, (y - 190) / 50) : lerp(36, 60, (y - 240) / 20);
        const left = [], right = [];
        for (let k = 0; k <= 20; k++) { const yy = k / 20 * h; const w = prof(yy / vp); left.push([WX - w, WY - 10 - yy]); right.push([WX + w, WY - 10 - yy]); }
        const vase = [...left, ...right.reverse()];
        wash(ctx, vase, C.brown, { alpha: 0.85, seed: 620, t }); sketch(ctx, vase, { width: 4, seed: 621, t });
        // 회전 무늬
        for (let k = 0; k < 4; k++) {
          const ph = ((t * 0.8 + k / 4) % 1) * 2 - 1;
          const yy = h * (0.25 + 0.15 * k);
          const w = prof(yy / Math.max(vp, 0.01));
          sketch(ctx, [[WX + ph * w * 0.9, WY - 10 - yy - 20], [WX + ph * w * 0.9, WY - 10 - yy + 20]], { width: 3, seed: 630 + k, t, color: '#f3d9b5', alpha: 1 - Math.abs(ph) });
        }
        if (t > 1.6 && t < 4.4) text(ctx, '빙글빙글~', WX, WY - 330, { size: 52, font: 'Nanum Pen Script', weight: 400, color: C.brown, rot: Math.sin(t * 3) * 0.08 });
      }
      // 춤추는 음표와 스타 유민
      if (t > 4.2) {
        for (let k = 0; k < 4; k++) {
          const ph = ((t - 4.2) * 0.45 + k / 4) % 1;
          note(ctx, 1000 + ph * 360, 600 - Math.sin(ph * Math.PI * 2 + k) * 80 - ph * 180, 0.9, { seed: 640 + k, t, color: [C.orange, C.pink, C.purple, C.blue][k] });
        }
      }
      face(ctx, IMG.face_yumin, 1560, 470, 100, t, { start: 6.0, seed: 650, ring: '#ffe9a8' });
      if (t > 6.6) {
        for (let k = 0; k < 10; k++) {
          const r = rng(660 + k);
          const x = 1020 + r() * 800, sp = 0.15 + r() * 0.15;
          const y = ((t - 6.6) * sp * 600 + r() * 600) % 760 + 60;
          ctx.save(); ctx.translate(x + Math.sin(t * 2 + k) * 20, y); ctx.rotate(t * (r() - 0.5) * 3);
          starDoodle(ctx, 0, 0, 16 + r() * 16, { seed: 670 + k, t, fill: [C.yellow, C.pink, C.orange][k % 3] });
          ctx.restore();
        }
        popText(ctx, '반짝반짝 스타!', 1540, 260, t - 7.4, { size: 76, color: C.orange });
      }
    },
  },

  // ---------- 에필로그 ----------
  {
    key: 'epilogue', dur: 16,
    narr: '그렇게 1년이 지나, 일곱 개의 씨앗은 일곱 그루의 나무가 되었어요. 그리고 오늘, 아이들은 새로운 숲을 향해 떠납니다. 졸업을 축하해, 우리 일곱 친구들!',
    subTail: 3.0,
    draw(ctx, t, dur) {
      drawPaper(ctx); ambient(ctx, t, 77);
      // 무대 커튼
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
      // 무대 바닥
      sketch(ctx, [[140, 640], [1780, 640]], { width: 5, seed: 705, t, color: C.brown });
      wash(ctx, [[140, 640], [1780, 640], [1860, 700], [60, 700]], C.brown, { alpha: 0.45, seed: 706, t });
      // 일곱 친구 (근호가 무대를 열고, 순서대로 등장)
      const order = ['geunho', 'hajun', 'juwon', 'gyuyeon', 'yugeon', 'taeyeon', 'yumin'];
      order.forEach((k, i) => {
        const x = 330 + i * 210, y = 470 + (i % 2) * 30;
        face(ctx, IMG['face_' + k], x, y - Math.abs(Math.sin(t * 4 + i)) * (t > 3.5 ? 14 : 0), 80, t, { start: 1.2 + i * 0.3, seed: 710 + i });
        const ip = prog(t, 2.4 + i * 0.3, 0.5); if (ip <= 0) return;
        ctx.save(); ctx.translate(x, y + 125); ctx.scale(easeOutBack(ip), easeOutBack(ip));
        const sd = 720 + i * 5;
        if (k === 'hajun') { const d = shp.circle(0, 0, 36, 24); wash(ctx, d, C.red, { alpha: 0.8, seed: sd, t }); sketch(ctx, d, { width: 3, seed: sd + 1, t }); sketch(ctx, [[-30, -50 + Math.sin(t * 10) * 10], [10, -20]], { width: 5, seed: sd + 2, t, color: C.brown }); }
        else if (k === 'juwon') { sketch(ctx, shp.circle(0, -12, 18, 16), { width: 3, seed: sd, t }); wash(ctx, shp.circle(0, -12, 18, 16), '#cfd3da', { alpha: 1, seed: sd + 1, t }); sketch(ctx, [[0, 6], [0, 40]], { width: 5, seed: sd + 2, t }); }
        else if (k === 'gyuyeon') { const kb = shp.rect(-50, -16, 100, 34); wash(ctx, kb, '#fff', { alpha: 1, seed: sd, t }); sketch(ctx, kb, { width: 3, seed: sd + 1, t }); for (let q = 1; q < 5; q++) sketch(ctx, [[-50 + q * 20, -16], [-50 + q * 20, 18]], { width: 2, seed: sd + 2 + q, t }); }
        else if (k === 'geunho') { const rb = [[-46, -10], [46, -10], [46, 14], [-46, 14]]; wash(ctx, rb, C.blue, { alpha: 0.85, seed: sd, t }); sketch(ctx, [...rb, rb[0]], { width: 3, seed: sd + 1, t }); text(ctx, '회장', 0, 3, { size: 26, font: 'Jua', weight: 400, color: '#fff' }); }
        else if (k === 'yugeon') { const b = shp.circle(0, 0, 26, 20); if (t < 5) { wash(ctx, b, '#fff', { alpha: 1, seed: sd, t }); sketch(ctx, b, { width: 3, seed: sd + 1, t }); } }
        else note(ctx, 0, 14, 0.9, { seed: sd, t, color: k === 'taeyeon' ? C.pink : C.orange });
        ctx.restore();
      });
      // 음표들
      if (t > 3.5) for (let k = 0; k < 6; k++) {
        const ph = ((t - 3.5) * 0.35 + k / 6) % 1;
        note(ctx, 400 + k * 230 + Math.sin(ph * 6 + k) * 30, 380 - ph * 220, 0.8, { seed: 740 + k, t, color: [C.red, C.purple, C.teal, C.orange, C.pink, C.blue][k] });
      }
      // 유건의 홈런 불꽃놀이
      const bx0 = 330 + 4 * 210, by0 = 595;
      const fly = prog(t, 5.0, 0.9);
      if (fly > 0 && fly < 1) {
        const x = lerp(bx0, 960, easeOut(fly)), y = lerp(by0, 190, easeOut(fly));
        const b = shp.circle(x, y, 22, 18);
        wash(ctx, b, '#fff', { alpha: 1, seed: 750, t }); sketch(ctx, b, { width: 3, seed: 751, t });
      }
      const boom = prog(t, 5.9, 1.4);
      if (boom > 0 && boom < 1) {
        for (let k = 0; k < 16; k++) {
          const a = k / 16 * Math.PI * 2, R = 60 + 260 * easeOut(boom);
          ctx.save(); ctx.globalAlpha = 1 - boom;
          sparkle(ctx, 960 + Math.cos(a) * R, 190 + Math.sin(a) * R * 0.7, 0.6, { seed: 760 + k, t, color: [C.yellow, C.red, C.pink, C.teal][k % 4] });
          ctx.restore();
        }
      }
      // 일곱 그루 나무 → 숲
      for (let i = 0; i < 7; i++) {
        const gp = easeOut(prog(t, 6.8 + i * 0.25, 1.2)); if (gp <= 0) continue;
        const x = 330 + i * 210, base = 900, h = 120 * gp;
        sketch(ctx, [[x, base], [x, base - h]], { width: 10, seed: 780 + i, t, color: C.brown });
        [[0, -40, 62], [-48, -5, 46], [48, -5, 46], [0, 10, 50]].forEach(([dx, dy, rr], q) => {
          const crown = shp.circle(x + dx * gp, base - h + dy * gp, rr * gp, 22);
          wash(ctx, crown, [C.green, '#5fa35a', '#8cc46f'][(i + q) % 3], { alpha: 0.85, seed: 790 + i * 4 + q, t, spread: 8 });
          sketch(ctx, crown, { width: 2.5, seed: 830 + i * 4 + q, t, color: '#3f6b3a', alpha: 0.7 });
        });
      }
      // 축하 배너
      const bp = prog(t, 9.6, 0.7);
      if (bp > 0) {
        ctx.save(); ctx.translate(W / 2, 190); ctx.rotate(-0.02); ctx.scale(easeOutBack(bp), easeOutBack(bp));
        const band = [[-620, -95], [620, -85], [590, 0], [620, 95], [-620, 88], [-590, 0]];
        ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); band.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
        ctx.shadowColor = 'transparent';
        sketch(ctx, [...band, band[0]], { width: 4, seed: 810, t });
        tape(ctx, -540, -90, 140, -0.5, 811); tape(ctx, 540, -90, 140, 0.5, 812);
        // 학사모
        ctx.save(); ctx.translate(-470, -10); ctx.rotate(-0.15);
        const cap = [[-60, -10], [0, -40], [60, -10], [0, 20], [-60, -10]];
        wash(ctx, cap, C.ink, { alpha: 0.95, seed: 813, t }); sketch(ctx, cap, { width: 3, seed: 814, t });
        wash(ctx, shp.rect(-34, 5, 68, 36), C.ink, { alpha: 0.95, seed: 815, t });
        sketch(ctx, [[40, -6], [52, 40]], { width: 3, seed: 816, t, color: C.yellow });
        ctx.restore();
        ctx.restore();
        popText(ctx, '졸업을 축하합니다!', W / 2 + 40, 190, t - 9.9, { size: 120, color: C.red, stagger: 0.07 });
      }
      // 꽃가루
      if (t > 10) {
        for (let k = 0; k < 40; k++) {
          const r = rng(900 + k);
          const x = r() * W, sp = 120 + r() * 160;
          const y = ((t - 10) * sp + r() * -400) ; if (y < -20 || y > H) continue;
          ctx.save(); ctx.translate(x + Math.sin(t * 2 + k) * 30, y); ctx.rotate(t * 3 * (r() - 0.5));
          ctx.fillStyle = [C.red, C.yellow, C.blue, C.green, C.pink, C.purple][k % 6];
          ctx.fillRect(-8, -5, 16, 10);
          ctx.restore();
        }
      }
    },
  },
];

// 시작 시각 계산
let TOTAL = 0;
SCENES.forEach(s => { s.start = TOTAL; TOTAL += s.dur; });
const TRANSITION = 0.9;
