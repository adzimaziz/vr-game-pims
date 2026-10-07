"""Beat map for the game music -> assets/beats.json  (tempo, first-beat offset, per-beat strength).

Spectral-flux onset envelope -> tempo by autocorrelation (70-180 BPM) -> beat phase that maximises
onset energy on the grid. Run: python tools/beats.py assets/bgm.mp3
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

SR, HOP, NFFT = 22050, 256, 1024


def load(path):
    raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def onset_envelope(x):
    n = 1 + (len(x) - NFFT) // HOP
    win = np.hanning(NFFT).astype(np.float32)
    frames = np.lib.stride_tricks.as_strided(x, (n, NFFT), (x.strides[0] * HOP, x.strides[0]))
    mag = np.log1p(np.abs(np.fft.rfft(frames * win, axis=1)) * 10)
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, "same")          # remove slow trend
    return np.maximum(flux, 0)


def main(path):
    x = load(path)
    env = onset_envelope(x)
    fps = SR / HOP
    ac = np.correlate(env - env.mean(), env - env.mean(), "full")[len(env) - 1:]
    lags = np.arange(len(ac))
    bpm_of = 60 * fps / np.maximum(lags, 1)
    ok = (bpm_of >= 70) & (bpm_of <= 180)
    # weight towards ~120 BPM to avoid half/double tempo picks
    w = np.exp(-0.5 * (np.log2(bpm_of / 120) / 0.9) ** 2)
    lag = int(lags[ok][np.argmax((ac * w)[ok])])
    # refine the period with a fine search around the lag
    best = (0, lag, 0.0)
    for period in np.linspace(lag - 1.5, lag + 1.5, 61):
        for phase in np.arange(0, period, 0.5):
            idx = np.round(np.arange(phase, len(env), period)).astype(int)
            s = env[idx[idx < len(env)]].mean()
            if s > best[0]:
                best = (s, period, phase)
    _, period, phase = best
    bpm = 60 * fps / period
    beat_s = period / fps
    t0 = phase / fps
    times = np.arange(t0, len(x) / SR - 0.2, beat_s)
    strength = []
    for t in times:
        i = int(round(t * fps)); seg = env[max(0, i - 2): i + 3]
        strength.append(float(seg.max()) if len(seg) else 0.0)
    strength = np.array(strength); strength = (strength / (np.percentile(strength, 95) + 1e-9)).clip(0, 1)
    out = {"bpm": round(float(bpm), 3), "beat": round(float(beat_s), 5), "offset": round(float(t0), 4),
           "duration": round(len(x) / SR, 3), "strength": [round(float(s), 3) for s in strength]}
    dst = Path(path).with_name("beats.json")
    dst.write_text(json.dumps(out), encoding="utf-8")
    print(f"BPM {out['bpm']}  beat {out['beat']}s  first beat {out['offset']}s  beats {len(times)}  -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/bgm.mp3")
