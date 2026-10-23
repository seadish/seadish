"""「일곱 개의 씨앗」 배경음악을 코드로 작곡·합성한다 (저작권 걱정 없는 자체 제작 음원).

따뜻한 피아노 아르페지오 + 오르골 멜로디 + 부드러운 패드·베이스.
out/timeline.json 의 장면 구간에 맞춰 세기가 변한다:
  프롤로그(잔잔) → 각 장(가볍게 리듬) → 졸업 사진 페이지(벅차게) → 에필로그(가장 풍성) → 엔딩(잔잔히 마무리)

사용법: python3 tools/bgm.py  →  audio/bgm.wav
"""
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
BPM = 80
BEAT = 60 / BPM
BAR = BEAT * 4

tl = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
TOTAL = tl['total']
N = int((TOTAL + 4) * SR)
L = np.zeros(N, np.float32)
R = np.zeros(N, np.float32)
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def intensity(t):
    """장면에 따른 음악 세기 0~1"""
    for s in tl['scenes']:
        if s['start'] <= t < s['start'] + s['dur']:
            lt = t - s['start']
            if s['key'] == 'prologue':
                return 0.45 + 0.15 * min(1, lt / s['dur'])
            if s['key'] == 'epilogue':
                return 0.8 + 0.2 * min(1, lt / 8)
            if s['key'] == 'ending':
                return 0.85 - 0.35 * min(1, lt / s['dur'])
            if lt >= s['narrDur']:
                return 1.0  # 졸업 사진 페이지
            return 0.62
    return 0.4


def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - pan) * 0.5 ** 0.5 * 1.2
    R[i:i + len(sig)] += sig * (1 + pan) * 0.5 ** 0.5 * 1.2


def piano(f, dur, vel):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n, np.float32)
    for k in range(1, 7):
        fk = f * k * (1 + 0.0004 * k * k)  # 살짝 비조화 → 피아노 느낌
        s += np.sin(2 * np.pi * fk * t) * (1 / k ** 1.6) * np.exp(-t * (1.2 + 0.9 * k))
    env = np.minimum(1, t / 0.004)
    rel = np.clip(1 - (t - dur) / 0.6, 0, 1)
    return (s * env * rel * vel).astype(np.float32)


def bell(f, vel):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5)
         + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9))
    return (s * np.minimum(1, t / 0.002) * vel).astype(np.float32)


def pad(freqs, dur, vel):
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n, np.float32)
    for f in freqs:
        for d in (-0.15, 0.15):
            ff = f * 2 ** (d / 12)
            s += np.sin(2 * np.pi * ff * t + rng.random() * 6) + 0.25 * np.sin(4 * np.pi * ff * t)
    env = np.minimum(1, t / 0.8) * np.clip(1 - (t - dur) / 1.5, 0, 1)
    return (s / len(freqs) * env * vel).astype(np.float32)


def bass(f, dur, vel):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 0.9) * np.clip(1 - (t - dur) / 0.3, 0, 1)
    return (s * env * vel).astype(np.float32)


def shaker(vel):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    s = rng.normal(0, 1, n)
    s = np.diff(np.concatenate([[0], s]))  # 고음 위주
    return (s * np.exp(-t * 45) * vel).astype(np.float32)


# 다장조: I - V - vi - IV / IV - I - ii - V
PROG = [
    [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
    [53, 57, 60], [60, 64, 67], [62, 65, 69], [55, 59, 62],
]
SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]

# 8마디 멜로디 (박자, 음 높이) — 동요처럼 단순하고 따뜻하게
MELODY = [
    [(0, 76, 1), (1, 74, 1), (2, 72, 1), (3, 74, 1)],
    [(0, 74, 2), (2, 71, 1), (3, 72, 1)],
    [(0, 72, 1), (1, 76, 1), (2, 79, 1.5), (3.5, 77, 0.5)],
    [(0, 77, 2), (2, 76, 1), (3, 74, 1)],
    [(0, 72, 1), (1, 74, 1), (2, 76, 1), (3, 77, 1)],
    [(0, 79, 2), (2, 76, 1), (3, 72, 1)],
    [(0, 74, 1), (1, 77, 1), (2, 76, 1), (3, 74, 1)],
    [(0, 74, 3), (3, 71, 1)],
]

bars = int(np.ceil(TOTAL / BAR)) + 1
for b in range(bars):
    t0 = b * BAR
    if t0 > TOTAL:
        break
    lv = intensity(t0 + 0.01)
    chord = PROG[b % 8]
    root = chord[0] - 12
    # 피아노 아르페지오 (8분음표)
    pattern = [0, 1, 2, 1, 0 + 12, 1, 2, 1]
    for i, idx in enumerate(pattern):
        note = chord[idx % 3] + (12 if idx >= 12 else 0)
        tt = t0 + i * BEAT / 2
        add(piano(midi(note), BEAT * 0.9, 0.16 + 0.04 * (i % 2 == 0)), tt, pan=-0.25 + 0.5 * (i / 7), gain=0.7 + 0.5 * lv)
    # 왼손 베이스
    if lv > 0.5:
        add(bass(midi(root), BAR * 0.95, 0.32), t0, gain=lv)
        add(bass(midi(root + 7), BEAT * 1.5, 0.18), t0 + BEAT * 2, gain=lv)
    # 패드 (세기가 클수록 진하게)
    add(pad([midi(n) for n in chord], BAR, 0.05 + 0.09 * lv), t0, gain=1.0)
    # 셰이커 (장면 본편부터)
    if lv > 0.55:
        for i in range(8):
            add(shaker(0.05 if i % 2 else 0.03), t0 + i * BEAT / 2 + 0.01, pan=0.4, gain=lv)
    # 오르골 멜로디 (프롤로그 첫 2마디는 쉬고 시작)
    if b >= 2:
        for beat, m, length in MELODY[b % 8]:
            vel = 0.22 * (0.6 + 0.6 * lv)
            add(bell(midi(m), vel), t0 + beat * BEAT, pan=0.15)
            if lv > 0.95:  # 졸업 페이지·에필로그: 한 옥타브 위 반짝임
                add(bell(midi(m + 12), vel * 0.35), t0 + beat * BEAT + 0.02, pan=-0.3)

# 졸업 사진 페이지가 열릴 때 반짝이는 글리산도
for s in tl['scenes']:
    if s['narrDur'] < s['dur']:
        t0 = s['start'] + s['narrDur']
        for i, m in enumerate([72, 76, 79, 84, 88, 91, 96]):
            add(bell(midi(m), 0.13), t0 + i * 0.06, pan=-0.6 + i * 0.2)

# 공간감: 간단한 리버브 (지수 감쇠 노이즈와 합성곱)
ir_n = int(1.8 * SR)
ir_t = np.arange(ir_n) / SR
ir = (rng.normal(0, 1, ir_n) * np.exp(-ir_t * 3.2)).astype(np.float32)
ir /= np.sqrt((ir ** 2).sum())


def reverb(x, mix=0.22):
    n = len(x) + ir_n
    size = 1 << int(np.ceil(np.log2(n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - mix) + wet.astype(np.float32) * mix * 2.2


L, R = reverb(L), reverb(R)
end = int(TOTAL * SR)
L, R = L[:end], R[:end]
t = np.arange(end) / SR
fade = np.minimum(1, t / 1.5) * np.clip((TOTAL - t) / 3.5, 0, 1)
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.7, R / peak * 0.7

os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
out = os.path.join(ROOT, 'audio', 'bgm.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes())
print('저장:', out, f'{TOTAL:.1f}초')
