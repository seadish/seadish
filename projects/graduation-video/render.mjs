// index.html 을 프레임 단위로 캡처해 MP4 로 만든다.
// 사용법:
//   node render.mjs                     → out/graduation.mp4 (전체)
//   node render.mjs --stills 5,20,40    → out/still_5.png ... (미리보기 장면)
//   node render.mjs --from 12 --to 24   → 일부 구간만
import { createRequire } from 'module';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const FPS = +(args.fps || 30);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });

// 정적 파일 서버
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/index.html?render`);
const { total } = await page.evaluate(() => window.ready);
console.log(`총 길이 ${total}s`);

const grab = async t => {
  const data = await page.evaluate(t => { window.seek(t); return document.getElementById('c').toDataURL('image/jpeg', 0.92); }, t);
  return Buffer.from(data.split(',')[1], 'base64');
};

if (args.stills) {
  for (const t of String(args.stills).split(',').map(Number)) {
    fs.writeFileSync(path.join(ROOT, 'out', `still_${t}.jpg`), await grab(t));
    console.log('still', t);
  }
} else {
  const from = +(args.from || 0), to = Math.min(+(args.to || total), total);
  const out = path.join(ROOT, 'out', args.out || 'graduation.mp4');
  const audio = path.join(ROOT, 'audio', 'narration.wav');
  const withAudio = fs.existsSync(audio) && !args.noaudio;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(withAudio ? ['-ss', String(from), '-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((to - from) * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(from + i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (FPS * 5) === 0) console.log(`${(from + i / FPS).toFixed(0)}s / ${to}s  (${((Date.now() - t0) / 1000).toFixed(0)}초 경과)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('완료:', out);
}
await browser.close();
server.close();
