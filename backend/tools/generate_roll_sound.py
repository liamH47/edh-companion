"""Synthesize `apps/web/public/sounds/roll.wav` from the die animation's contact schedule.

The point of generating rather than hand-authoring this clip is synchronization: the
animation's bounce timings live in `packages/core/src/dieAnimation.ts`, and this script
reads them out of that file so every impact in the audio lands on the frame the die
touches down. Restating the numbers here instead would work exactly once, then drift.

Stdlib only -- no ffmpeg on the build VM -- so the output is a 16-bit mono WAV.

Run: `uv run python tools/generate_roll_sound.py` (add `--check` to verify the committed
file is current without rewriting it).
"""

from __future__ import annotations

import argparse
import math
import random
import re
import struct
import sys
import wave
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ANIMATION_TS = REPO_ROOT / "packages" / "core" / "src" / "dieAnimation.ts"
MOTION_TS = REPO_ROOT / "packages" / "core" / "src" / "motion.ts"
OUTPUT = REPO_ROOT / "apps" / "web" / "public" / "sounds" / "roll.wav"

RATE = 22050

# Timbre of the chosen candidate ("slow tumble"). These describe the *surface and die*,
# not the rhythm -- the rhythm comes from dieAnimation.ts. A die on cloth: steep low-pass
# so little high end survives, a soft attack so there is no digital-sounding edge, and
# more body than noise so it reads as mass rather than clatter.
NOISE_CUTOFF_HZ = 720
NOISE_PASSES = 4
BODY_HZ = 152
BODY_DECAY_S = 0.088
NOISE_DECAY_S = 0.046
NOISE_LEVEL = 0.36
BODY_LEVEL = 0.72
ATTACK_S = 0.0058
HIT_FALLOFF = 0.66
# Deliberately below the win/lose clips: a roll happens on every activation, so it has to
# sit under them rather than compete. Loud transients on a phone speaker are what made an
# earlier version unpleasant.
TARGET_PEAK = 0.33
SEED = 47


def read_contact_fractions() -> list[float]:
    source = ANIMATION_TS.read_text(encoding="utf-8")
    match = re.search(r"CONTACT_FRACTIONS\s*=\s*\[([^\]]*)\]", source)
    if not match:
        raise SystemExit(f"Could not find CONTACT_FRACTIONS in {ANIMATION_TS}")
    return [float(part) for part in match.group(1).replace(" ", "").split(",") if part]


def read_reveal_duration_ms() -> int:
    source = MOTION_TS.read_text(encoding="utf-8")
    match = re.search(r"REVEAL_DURATION_MS\s*=\s*(\d+)", source)
    if not match:
        raise SystemExit(f"Could not find REVEAL_DURATION_MS in {MOTION_TS}")
    return int(match.group(1))


def lowpass(samples: list[float], cutoff_hz: float, passes: int) -> list[float]:
    """Cascaded one-pole low-pass. More passes = steeper slope = duller."""
    out = list(samples)
    dt = 1.0 / RATE
    rc = 1.0 / (2 * math.pi * cutoff_hz)
    alpha = dt / (rc + dt)
    for _ in range(passes):
        previous = 0.0
        for i, value in enumerate(out):
            previous = previous + alpha * (value - previous)
            out[i] = previous
    return out


def impact(level: float, settling: bool, rng: random.Random) -> list[float]:
    """One die-on-cloth contact: filtered noise for the clatter, damped sine for the mass."""
    body_hz = BODY_HZ * (0.85 if settling else 1.0) * rng.uniform(0.94, 1.06)
    body_decay = BODY_DECAY_S * (1.4 if settling else 1.0)
    cutoff = NOISE_CUTOFF_HZ * (0.7 if settling else 1.0)

    count = int(body_decay * 6 * RATE)
    noise = lowpass([rng.uniform(-1.0, 1.0) for _ in range(count)], cutoff, NOISE_PASSES)
    peak = max((abs(v) for v in noise), default=1.0) or 1.0
    noise = [v / peak for v in noise]

    attack_samples = max(1, int(ATTACK_S * RATE))
    noise_level = NOISE_LEVEL * level * (0.7 if settling else 1.0)
    body_level = BODY_LEVEL * level * (1.15 if settling else 1.0)

    out = []
    for i in range(count):
        t = i / RATE
        # A soft attack rather than a sample-zero edge. That edge is the "click" that
        # makes a synthesized hit read as digital, and the part that hurts at volume.
        attack = min(1.0, i / attack_samples)
        clatter = noise_level * noise[i] * math.exp(-t / NOISE_DECAY_S)
        mass = body_level * math.sin(2 * math.pi * body_hz * t) * math.exp(-t / body_decay)
        out.append(attack * (clatter + mass))
    return out


def render(contacts_ms: list[float]) -> list[float]:
    rng = random.Random(SEED)
    track: list[float] = []
    level = 1.0
    for index, offset_ms in enumerate(contacts_ms):
        hit = impact(level, settling=index == len(contacts_ms) - 1, rng=rng)
        start = int(offset_ms / 1000 * RATE)
        if start + len(hit) > len(track):
            track.extend([0.0] * (start + len(hit) - len(track)))
        for i, value in enumerate(hit):
            track[start + i] += value
        level *= HIT_FALLOFF
    return track


def encode(track: list[float]) -> bytes:
    peak = max((abs(v) for v in track), default=1.0) or 1.0
    scale = TARGET_PEAK / peak
    return b"".join(struct.pack("<h", int(max(-1.0, min(1.0, v * scale)) * 32767)) for v in track)


def wav_bytes(frames: bytes) -> bytes:
    import io

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(frames)
    return buffer.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the committed WAV is not what this script would produce.",
    )
    args = parser.parse_args()

    fractions = read_contact_fractions()
    total_ms = read_reveal_duration_ms()
    first = fractions[0]
    # Relative to the first impact: the clip starts when the die first lands, and the
    # caller delays playback by the flight time. Leading silence in the asset would tie
    # it to one duration.
    contacts_ms = [(f - first) * total_ms for f in fractions]

    data = wav_bytes(encode(render(contacts_ms)))

    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != data:
            print(
                f"{OUTPUT.relative_to(REPO_ROOT)} is stale. "
                "Run `uv run python tools/generate_roll_sound.py`.",
                file=sys.stderr,
            )
            return 1
        print(f"{OUTPUT.relative_to(REPO_ROOT)} is current.")
        return 0

    OUTPUT.write_bytes(data)
    gaps = [round(b - a) for a, b in zip(contacts_ms, contacts_ms[1:], strict=False)]
    print(
        f"Wrote {OUTPUT.relative_to(REPO_ROOT)} "
        f"({len(data) / 1024:.1f} KB, {len(data) / 2 / RATE:.2f}s) "
        f"-- {len(contacts_ms)} contacts, gaps {gaps} ms"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
