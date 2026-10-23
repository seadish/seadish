// 손그림·종이 콜라주 모션그래픽 엔진
// 모든 그리기는 seek(t) 하나로 결정된다 (같은 t → 같은 프레임).

const W = 1920, H = 1080;

// ---------- 난수·이징 ----------
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, start, dur) => clamp((t - start) / dur);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutElastic = t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
// 손그림 '보일링' (초당 8번 선이 살짝 떨림)
const boil = t => Math.floor(t * 8);

// ---------- 색 ----------
const C = {
  paper: '#f6eedd', paper2: '#efe3c8', ink: '#3b2f2a', pencil: '#5a4a42',
  red: '#e0614f', orange: '#f29c50', yellow: '#f5c94c', green: '#7cb66a',
  teal: '#4fa3a5', blue: '#5b8fd1', purple: '#9b7bc8', pink: '#ee8fb0', brown: '#a8754f',
};

// ---------- 종이 텍스처 ----------
let paperTex = null;
function makePaper() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  const r = rng(7);
  // 얼룩
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, rad = 40 + r() * 220;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.03 + r() * 0.05;
    grd.addColorStop(0, `rgba(190,160,110,${a})`); grd.addColorStop(1, 'rgba(190,160,110,0)');
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // 섬유 결
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(150,120,90,0.08)'; g.lineWidth = 1;
  for (let i = 0; i < 500; i++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI, l = 6 + r() * 20;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // 비네팅
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(120,90,60,0)'); v.addColorStop(1, 'rgba(120,90,60,0.28)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  paperTex = c;
}
function drawPaper(ctx) { ctx.drawImage(paperTex, 0, 0); }

// ---------- 손그림 선 ----------
// pts 를 따라 흔들리는 연필선을 그리고, progress(0~1) 만큼만 그린다.
function resample(pts, step = 6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
  }
  return out;
}
function sketch(ctx, pts, o = {}) {
  const { progress = 1, seed = 1, width = 4, color = C.ink, jitter = 2.2, t = 0, passes = 2, alpha = 1 } = o;
  if (progress <= 0) return;
  const rs = resample(pts);
  const n = Math.max(2, Math.floor(rs.length * clamp(progress)));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.globalAlpha *= alpha;
  for (let p = 0; p < passes; p++) {
    const r = rng(seed * 31 + p * 7 + boil(t) * 101);
    const ox = (r() - 0.5) * jitter, oy = (r() - 0.5) * jitter;
    ctx.lineWidth = width * (p === 0 ? 1 : 0.55);
    ctx.globalAlpha = (p === 0 ? 0.92 : 0.5) * alpha;
    ctx.beginPath();
    let wob = 0;
    for (let i = 0; i < n; i++) {
      wob += (r() - 0.5) * 0.6; wob *= 0.9;
      const x = rs[i][0] + ox + wob * jitter, y = rs[i][1] + oy + (r() - 0.5) * jitter * 0.5;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
// 수채화 채색 (여러 겹의 반투명 칠)
function wash(ctx, pts, color, o = {}) {
  const { seed = 1, alpha = 0.55, t = 0, spread = 5 } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.fillStyle = color;
  for (let p = 0; p < 3; p++) {
    const r = rng(seed * 13 + p + boil(t) * 3);
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const xx = x + (r() - 0.5) * spread, yy = y + (r() - 0.5) * spread;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    });
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// 모양 → 점 목록
const shp = {
  circle(cx, cy, r, n = 48, a0 = -Math.PI / 2, sweep = Math.PI * 2.08) {
    const p = []; for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p;
  },
  ellipse(cx, cy, rx, ry, n = 48, a0 = -Math.PI / 2, sweep = Math.PI * 2.05) {
    const p = []; for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
  },
  rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]]; },
  line(x0, y0, x1, y1) { return [[x0, y0], [x1, y1]]; },
  star(cx, cy, r, r2 = r * 0.45) {
    const p = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r2 : r; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p;
  },
  heart(cx, cy, s) {
    const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; p.push([cx + s * 16 * Math.pow(Math.sin(a), 3) / 16, cy - s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]); } return p;
  },
};

// ---------- 낙서 소품 ----------
function note(ctx, x, y, s, o = {}) { // 음표
  const c = o.color || C.ink;
  wash(ctx, shp.ellipse(x, y, 13 * s, 9 * s, 16), c, { alpha: 0.9, seed: o.seed });
  sketch(ctx, [[x + 12 * s, y], [x + 12 * s, y - 50 * s], [x + 30 * s, y - 38 * s]], { width: 4 * s, color: c, seed: o.seed, t: o.t });
}
function sparkle(ctx, x, y, s, o = {}) {
  const c = o.color || C.yellow;
  sketch(ctx, [[x, y - 22 * s], [x, y + 22 * s]], { width: 4 * s, color: c, seed: o.seed, t: o.t });
  sketch(ctx, [[x - 22 * s, y], [x + 22 * s, y]], { width: 4 * s, color: c, seed: (o.seed || 1) + 1, t: o.t });
  sketch(ctx, [[x - 12 * s, y - 12 * s], [x + 12 * s, y + 12 * s]], { width: 3 * s, color: c, seed: (o.seed || 1) + 2, t: o.t });
  sketch(ctx, [[x + 12 * s, y - 12 * s], [x - 12 * s, y + 12 * s]], { width: 3 * s, color: c, seed: (o.seed || 1) + 3, t: o.t });
}
function starDoodle(ctx, x, y, r, o = {}) {
  const pts = shp.star(x, y, r);
  wash(ctx, pts, o.fill || C.yellow, { alpha: o.alpha ?? 0.8, seed: o.seed, t: o.t });
  sketch(ctx, pts, { width: 3.5, seed: o.seed, t: o.t, progress: o.progress ?? 1 });
}

// ---------- 텍스트 ----------
function text(ctx, str, x, y, o = {}) {
  const { size = 60, font = 'Gamja Flower', weight = 400, color = C.ink, align = 'center', reveal = 1, rot = 0, alpha = 1, outline = null, base = 'middle' } = o;
  if (reveal <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `${weight} ${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = base;
  const w = ctx.measureText(str).width;
  if (reveal < 1) { // 왼쪽→오른쪽으로 써지는 느낌
    const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    ctx.beginPath(); ctx.rect(x0 - 10, -size, (w + 20) * reveal, size * 2.2); ctx.clip();
  }
  if (outline) { ctx.lineWidth = outline.width; ctx.strokeStyle = outline.color; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
  return w;
}
// 한 글자씩 톡톡 튀어나오는 텍스트
function popText(ctx, str, x, y, t, o = {}) {
  const { size = 80, font = 'Single Day', weight = 400, color = C.ink, stagger = 0.06, outline = { width: 10, color: '#fff' } } = o;
  ctx.save(); ctx.font = `${weight} ${size}px "${font}"`;
  const chars = [...str]; const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  chars.forEach((ch, i) => {
    const p = prog(t, i * stagger, 0.35);
    if (p > 0) {
      const s = easeOutBack(p);
      const r = rng(i + 3);
      text(ctx, ch, cx + widths[i] / 2, y + Math.sin(t * 3 + i) * 3, { size: size * s, font, weight, color, rot: (r() - 0.5) * 0.15, outline });
    }
    cx += widths[i];
  });
  ctx.restore();
}

// ---------- 스티커·테이프 ----------
function tape(ctx, x, y, w, rot, seed = 1, color = 'rgba(240,215,150,0.78)') {
  const r = rng(seed); const h = 34;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + w * i / 6, -h / 2 + (r() - 0.5) * 3);
  for (let i = 0; i <= 5; i++) ctx.lineTo(w / 2 + (i % 2 ? 4 : -2), -h / 2 + h * i / 5);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 + w * i / 6, h / 2 + (r() - 0.5) * 3);
  for (let i = 5; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? -4 : 2), -h / 2 + h * i / 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2 + 8); ctx.lineTo(w / 2 - 6, -h / 2 + 8); ctx.stroke();
  ctx.restore();
}
// 사진 스티커: 툭 떨어지며 붙고 테이프로 고정
function sticker(ctx, img, x, y, w, t, o = {}) {
  const { start = 0, rot = 0, tapes = 2, seed = 1, sway = true, dur = 0.55 } = o;
  const p = prog(t, start, dur);
  if (p <= 0) return;
  const s = lerp(1.35, 1, easeOutBack(p)) * (o.scale || 1);
  const a = clamp(p * 3);
  const h = w * img.height / img.width;
  const sw = sway ? Math.sin((t - start) * 1.3 + seed) * 0.012 : 0;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(rot + sw + (1 - easeOut(p)) * 0.25); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 18 * (2 - s); ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 10 + (s - 1) * 60;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent';
  if (p > 0.6 && tapes) {
    const r = rng(seed);
    tape(ctx, -w * 0.32, -h / 2 + 4, w * 0.3, -0.5 + r() * 0.2, seed);
    if (tapes > 1) tape(ctx, w * 0.32, -h / 2 + 4, w * 0.3, 0.45 + r() * 0.2, seed + 1);
  }
  ctx.restore();
}
// 원형 얼굴 배지
function face(ctx, img, x, y, r, t, o = {}) {
  const { start = 0, ring = '#fff', seed = 1 } = o;
  const p = prog(t, start, 0.5); if (p <= 0) return;
  const s = easeOutBack(p) * (o.scale || 1);
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2 + seed) * 4); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.5 + seed) * 0.04);
  ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore();
  sketch(ctx, shp.circle(0, 0, r + 12, 40), { width: 3, seed, t, color: C.pencil, jitter: 2.5 });
  ctx.restore();
}

// ---------- 말풍선·이름표 ----------
function bubble(ctx, x, y, w, h, t, o = {}) {
  const { seed = 1, fill = '#fff', progress = 1, tail = [-0.25, 1] } = o;
  const pts = [];
  const r = Math.min(w, h) * 0.45;
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + i / 40 * Math.PI * 2.03;
    pts.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]);
  }
  wash(ctx, pts, fill, { alpha: 0.95 * progress, seed, t, spread: 3 });
  sketch(ctx, pts, { width: 3.5, seed, t, progress });
  if (tail && progress > 0.9) sketch(ctx, [[x + tail[0] * w / 2, y + h / 2 - 6], [x + tail[0] * w / 2 - 20, y + h / 2 + 35], [x + tail[0] * w / 2 + 25, y + h / 2 - 4]], { width: 3.5, seed: seed + 9, t });
}
// 장 제목 리본
function chapterTitle(ctx, num, name, t, o = {}) {
  const { x = 1380, y = 115, color = C.red } = o;
  const p = prog(t, 0.15, 0.5);
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.03); ctx.scale(easeOutBack(p), easeOutBack(p));
  ctx.font = '400 76px "Single Day"'; const nameW = ctx.measureText(name).width;
  const w = nameW + 210, h = 110, x0 = -w / 2;
  const band = [[x0, -h / 2], [w / 2, -h / 2 + 6], [w / 2 - 20, 0], [w / 2, h / 2], [x0, h / 2 - 4], [x0 + 20, 0]];
  wash(ctx, band, color, { alpha: 0.95, seed: num + 50, t, spread: 3 });
  sketch(ctx, [...band, band[0]], { width: 3, seed: num + 51, t, color: C.ink });
  text(ctx, `${num}장`, x0 + 75, 4, { size: 50, font: 'Single Day', weight: 400, color: '#fff' });
  text(ctx, name, x0 + 130, 4, { size: 76, font: 'Single Day', weight: 400, color: '#fff', align: 'left', outline: { width: 6, color: 'rgba(59,47,42,0.6)' } });
  ctx.restore();
}

// ---------- 자막 ----------
// 문장을 길이 비례로 나눠 시간 배정
function splitSentences(str) {
  return str.match(/[^.!?…]+[.!?…]*/g).map(s => s.trim()).filter(Boolean);
}
function subtitleAt(narr, t, dur, lead = 0.7, tail = 0.5) {
  const ss = splitSentences(narr);
  const total = ss.reduce((a, s) => a + s.length, 0);
  let acc = lead; const span = dur - lead - tail;
  for (const s of ss) {
    const d = span * s.length / total;
    if (t < acc + d) return { s, p: (t - acc) / d, t0: acc };
    acc += d;
  }
  return null;
}
function wrapLines(ctx, str, maxW) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawSubtitle(ctx, narr, t, dur, o = {}) {
  const cur = subtitleAt(narr, t, dur, o.lead, o.tail);
  if (!cur || t < 0) return;
  const { s } = cur;
  const fadeIn = clamp((t - cur.t0) / 0.25);
  ctx.save();
  ctx.font = `400 54px "Gamja Flower"`;
  const lines = wrapLines(ctx, s, 1500);
  const lh = 58, bh = lines.length * lh + 34;
  const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 90;
  const y = H - 70 - bh / 2;
  ctx.globalAlpha = fadeIn;
  // 종이띠
  const r = rng(splitSentences(narr).indexOf(s) + 77);
  const pts = [[W / 2 - bw / 2, y - bh / 2 + r() * 6], [W / 2 + bw / 2, y - bh / 2 + r() * 6], [W / 2 + bw / 2 - 6, y + bh / 2], [W / 2 - bw / 2 + 4, y + bh / 2 - r() * 6]];
  ctx.shadowColor = 'rgba(60,40,20,0.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(255,252,244,0.95)'; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  tape(ctx, W / 2 - bw / 2 + 10, y - bh / 2 + 6, 90, -0.6, 5, 'rgba(160,200,220,0.7)');
  lines.forEach((l, i) => text(ctx, l, W / 2, y - (lines.length - 1) * lh / 2 + i * lh + 3, { size: 54, color: C.ink }));
  ctx.restore();
}

// ---------- 종이 찢기 전환 ----------
// prev 캔버스를 찢어서 날려 보내며 다음 장면을 드러낸다.
function tornEdge(p, seed) {
  const r = rng(seed); const pts = [];
  const xBase = lerp(-260, W + 260, easeInOut(p));
  for (let y = -40; y <= H + 40; y += 18) {
    const tilt = (y - H / 2) * 0.25;
    pts.push([xBase + tilt + (r() - 0.5) * 34 + Math.sin(y * 0.02 + seed) * 22, y]);
  }
  return pts;
}
function tornTransition(ctx, prevCanvas, p, seed = 3) {
  if (p >= 1) return;
  const edge = tornEdge(p, seed);
  // 남아 있는 이전 페이지 (가장자리 오른쪽)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(W + 400, -40); edge.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W + 400, H + 40); ctx.closePath();
  ctx.shadowColor = 'rgba(40,25,10,0.45)'; ctx.shadowBlur = 25; ctx.shadowOffsetX = -8;
  ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  // 하얀 종이 속살
  ctx.drawImage(prevCanvas, 0, 0);
  ctx.restore();
  // 찢긴 단면 (하얀 섬유 띠)
  ctx.save();
  ctx.beginPath(); edge.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 16; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(200,180,150,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  // 찢겨 나간 조각이 왼쪽 위로 날아감
  ctx.save();
  const fly = easeInOut(p);
  ctx.translate(-fly * 500, -fly * 260); ctx.rotate(-fly * 0.35);
  ctx.globalAlpha = 1 - clamp((p - 0.6) / 0.4);
  ctx.beginPath(); ctx.moveTo(-400, -40); edge.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(-400, H + 40); ctx.closePath();
  ctx.shadowColor = 'rgba(40,25,10,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 25;
  ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.clip(); ctx.drawImage(prevCanvas, 0, 0);
  ctx.restore();
}
