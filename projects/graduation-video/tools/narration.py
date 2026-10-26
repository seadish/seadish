"""TTS 나레이션 다듬기 + 자막 타이밍 + 전체 나레이션 트랙 만들기

1단계 (기본): audio/tts/<key>.wav → audio/tts_proc/<key>.wav
   - 앞뒤 무음 제거, 문장 사이 긴 쉼을 PAUSE 초로 줄이고, TEMPO 배 빠르게
   - 문장 경계(가장 긴 쉼들)를 찾아 narration.js 에 문장별 시작·끝 시각 기록
2단계 (--assemble): out/timeline.json 의 장면 시작 시각에 맞춰 audio/narration.wav 로 합치기

사용법: python3 tools/narration.py && node render.mjs --timeline && python3 tools/narration.py --assemble
"""
import json, os, re, subprocess, sys, wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR_IN, SR = 24000, 44100
PAUSE = 0.45      # 문장 사이 쉼 최대 길이
TEMPO = 1.06      # 말 빠르기
# 장면 안에서 나레이션이 시작하는 시각 (프롤로그는 제목이 먼저 나온다)
START = {'prologue': 3.4, 'epilogue': 0.8}
DEFAULT_START = 1.0


def read(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def silences(x, sr, thresh_db=-38, min_len=0.3):
    hop = int(sr * 0.01)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 2) / (hop * 2), 'same'))[::hop]
    quiet = 20 * np.log10(rms + 1e-9) < thresh_db
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * 0.01 >= min_len:
                out.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return out


def sentences(text):
    return [s for s in re.split(r'(?<=[.!?…])\s+', text.strip()) if s]


def process():
    src = open(os.path.join(ROOT, 'scenes.js'), encoding='utf-8').read()
    texts = {k: t for k, _, t in re.findall(r"key: '(\w+)', dur: [\d.]+,\s*narr: (['\"])(.*?)\2,", src, re.S) if t}
    os.makedirs(os.path.join(ROOT, 'audio', 'tts_proc'), exist_ok=True)
    meta = {}
    for key, text in texts.items():
        x = read(os.path.join(ROOT, 'audio', 'tts', f'{key}.wav'))
        sil = silences(x, SR_IN)
        dur = len(x) / SR_IN
        head = sil[0][1] if sil and sil[0][0] <= 0.02 else 0.0
        tail = sil[-1][0] if sil and sil[-1][1] >= dur - 0.02 else dur
        inner = [s for s in sil if s[0] > head + 0.05 and s[1] < tail - 0.05]
        # 문장 경계 = 가장 긴 쉼 (문장 수 - 1)개
        n = len(sentences(text))
        bounds = sorted(sorted(inner, key=lambda s: s[1] - s[0], reverse=True)[:n - 1])
        # 쉼 줄이기: 긴 쉼은 PAUSE 로, 짧은 쉼은 그대로
        pieces, t, newpos, cuts = [], head, 0.0, {}
        for a, b in inner:
            keep = min(b - a, PAUSE) if (b - a) > PAUSE else (b - a)
            pieces.append(x[int(t * SR_IN):int((a + keep / 2) * SR_IN)])
            newpos += a + keep / 2 - t
            cuts[(a, b)] = newpos  # 쉼 한가운데의 새 시각
            t = b - keep / 2
        pieces.append(x[int(t * SR_IN):int(tail * SR_IN)])
        newpos += tail - t
        y = np.concatenate(pieces)
        fade = int(0.01 * SR_IN)
        y[:fade] *= np.linspace(0, 1, fade); y[-fade:] *= np.linspace(1, 0, fade)
        tmp = os.path.join(ROOT, 'audio', 'tts_proc', f'{key}_raw.wav')
        with wave.open(tmp, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR_IN)
            w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
        out = os.path.join(ROOT, 'audio', 'tts_proc', f'{key}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'atempo={TEMPO},loudnorm=I=-16:TP=-1.5',
                        '-ar', str(SR), '-ac', '2', out], check=True)
        os.remove(tmp)
        length = newpos / TEMPO
        edges = [0.0] + [cuts[b] / TEMPO for b in bounds] + [length]
        sents = [[round(edges[i] + (0.1 if i else 0), 2), round(edges[i + 1] - (0.1 if i < len(edges) - 2 else 0), 2)] for i in range(len(edges) - 1)]
        meta[key] = {'start': START.get(key, DEFAULT_START), 'len': round(length, 2), 'sents': sents}
        print(f'{key}: {dur:.1f}초 → {length:.1f}초, 문장 {n}개 {sents}')
    with open(os.path.join(ROOT, 'narration.js'), 'w', encoding='utf-8') as f:
        f.write('// tools/narration.py 가 만든 파일: 장면별 나레이션 시작·길이·문장 시각(초)\n')
        f.write('const NARR = ' + json.dumps(meta, ensure_ascii=False, indent=1) + ';\n')


def assemble():
    tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
    meta = json.loads(re.search(r'const NARR = (\{.*\});', open(os.path.join(ROOT, 'narration.js'), encoding='utf-8').read(), re.S).group(1))
    track = np.zeros((int((tl['total'] + 1) * SR), 2), np.float32)
    for s in tl['scenes']:
        if s['key'] not in meta:
            continue
        with wave.open(os.path.join(ROOT, 'audio', 'tts_proc', f"{s['key']}.wav")) as w:
            y = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2) / 32768
        i = int((s['start'] + meta[s['key']]['start']) * SR)
        track[i:i + len(y)] += y[:len(track) - i]
    track = track[:int(tl['total'] * SR)]
    with wave.open(os.path.join(ROOT, 'audio', 'narration.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())
    print('저장: audio/narration.wav', f"{tl['total']:.1f}초")


if __name__ == '__main__':
    assemble() if '--assemble' in sys.argv else process()
