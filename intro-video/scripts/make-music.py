"""Generates public/music.wav: an original 5-second jingle synced to the intro.

Everything is synthesized here, so there are no licensing concerns.
Run: python3 scripts/make-music.py   (needs numpy)
"""

import wave
from pathlib import Path

import numpy as np

SR = 44100
DURATION = 5.0
FPS = 30
N = int(SR * DURATION)
left = np.zeros(N)
right = np.zeros(N)


def note_hz(name: str) -> float:
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    semis = names[name[0]] + 12 * (int(name[-1]) + 1)
    return 440.0 * 2 ** ((semis - 69) / 12)


def add(sig: np.ndarray, start: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    left[i : i + len(sig)] += sig * (1 - pan) / 2 * 2 ** 0.5
    right[i : i + len(sig)] += sig * (1 + pan) / 2 * 2 ** 0.5


def env(length: float, attack: float, decay: float) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    return np.minimum(t / attack, 1.0) * np.exp(-t / decay)


def pluck(freq: float, length: float = 0.6, decay: float = 0.18) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    tone = (
        np.sin(2 * np.pi * freq * t)
        + 0.35 * np.sin(2 * np.pi * 2 * freq * t)
        + 0.12 * np.sin(2 * np.pi * 3 * freq * t)
    )
    return tone * env(length, 0.004, decay)


def bell(freq: float, length: float = 1.4, decay: float = 0.5) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    tone = (
        np.sin(2 * np.pi * freq * t)
        + 0.4 * np.sin(2 * np.pi * 2.76 * freq * t) * np.exp(-t / 0.15)
        + 0.2 * np.sin(2 * np.pi * 5.4 * freq * t) * np.exp(-t / 0.08)
    )
    return tone * env(length, 0.002, decay)


def pad(freqs: list[float], length: float, attack: float, release: float) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    sig = sum(
        np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 5 * t)) for f in freqs
    ) / len(freqs)
    shape = np.minimum(t / attack, 1.0) * np.clip((length - t) / release, 0, 1)
    return sig * shape


rng = np.random.default_rng(7)


def shaker(length: float = 0.08) -> np.ndarray:
    noise = rng.standard_normal(int(length * SR))
    noise = np.diff(noise, prepend=0)  # brighter, high-passed noise
    return noise * env(length, 0.002, 0.02)


def bubble(start_hz: float, length: float = 0.12) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    freq = start_hz * (1 + 3 * t / length)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * env(length, 0.003, 0.04)


def whale_call(length: float = 1.1) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    p = t / length
    freq = 320 + 380 * np.sin(np.pi * p) ** 1.5 + 12 * np.sin(2 * np.pi * 6 * t)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) + 0.25 * np.sin(2 * phase)
    return tone * np.sin(np.pi * p) ** 0.8


def whoosh(length: float = 1.4) -> np.ndarray:
    noise = rng.standard_normal(int(length * SR))
    smooth = np.convolve(noise, np.ones(40) / 40, mode="same")  # low-pass
    p = np.arange(len(smooth)) / len(smooth)
    return smooth * np.sin(np.pi * p) ** 2


# 0.0s – bubbles rising
for k, t0 in enumerate([0.15, 0.32, 0.5, 0.62, 0.8, 0.9]):
    add(bubble(500 + 120 * k), t0, 0.25, pan=-0.6 + 0.24 * k)

# 0.3s – soft pad underneath everything
add(pad([note_hz(n) for n in ["C4", "E4", "G4", "B4"]], 4.4, 0.8, 0.8), 0.3, 0.12)

# 1.0s – each letter lands with a rising pluck (letters drop every 4 frames)
for i, n in enumerate(["C5", "D5", "E5", "G5", "A5", "C6", "D6"]):
    land = 1.0 + i * 4 / FPS + 0.22
    add(pluck(note_hz(n)), land, 0.32, pan=-0.6 + 0.2 * i)

# 1.0s – bouncy bass and shaker groove (120 bpm)
for t0, n in zip(np.arange(1.0, 4.5, 0.5), ["C3", "G2", "A2", "F2", "C3", "G2", "C3"]):
    add(pluck(note_hz(n), 0.5, 0.2), t0, 0.45)
for t0 in np.arange(1.25, 4.3, 0.25):
    add(shaker(), t0, 0.08 if (t0 * 4) % 2 else 0.05, pan=0.3)

# 2.6s – the orca swims by (left to right)
add(whoosh(), 2.6, 0.5, pan=0.0)
add(whale_call(), 2.85, 0.14, pan=0.2)

# 3.6s – sparkles
for k, n in enumerate(["G6", "C7", "E7", "G7"]):
    add(bell(note_hz(n), 1.0, 0.3), 3.6 + k * 0.07, 0.12, pan=(-1) ** k * 0.5)

# 4.0s – final chord
for n in ["C4", "G4", "C5", "E5", "G5"]:
    add(bell(note_hz(n), 1.0, 0.45), 4.0, 0.13)

# master fade-out and normalize
fade = np.clip((DURATION - np.arange(N) / SR) / 0.5, 0, 1)
stereo = np.stack([left * fade, right * fade], axis=1)
stereo /= np.max(np.abs(stereo)) / 0.85

out = Path(__file__).resolve().parent.parent / "public" / "music.wav"
with wave.open(str(out), "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((stereo * 32767).astype("<i2").tobytes())
print(f"wrote {out}")
