"""Story clip: types even-os.com into an address bar. 1080x1920, 30fps, 6s. Usage: make_story.py <lang> <outdir>"""
import sys, math, random, wave, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

lang, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
W, H, FPS, DUR = 1080, 1920, 30, 6.0
GOLD = (212, 175, 55)
BG = (10, 10, 10)
FONT = '/usr/share/fonts/opentype/inter/Inter-%s.otf'
f_url = ImageFont.truetype(FONT % 'SemiBold', 74)
f_tag = ImageFont.truetype(FONT % 'Medium', 52)
f_sub = ImageFont.truetype(FONT % 'Regular', 40)

URL = 'even-os.com'
TAG = {'en': ('3 free estimates.', 'No card.'), 'es': ('3 estimados gratis.', 'Sin tarjeta.')}[lang]

random.seed(7)
t = 0.7
key_times = []
for _ in URL:
    t += random.uniform(0.11, 0.21)
    key_times.append(round(t, 3))
enter_t = key_times[-1] + 0.45
tag_t = enter_t + 0.25

# ---------- audio: synthesized keystrokes ----------
SR = 44100
audio = np.zeros(int(SR * DUR), dtype=np.float32)
rng = np.random.default_rng(3)

def click(at, low=1.0, amp=0.55):
    n = int(SR * 0.09)
    i0 = int(at * SR)
    x = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # high-ish tick + short low thump
    tick = noise * np.exp(-x * 160)
    tick = np.convolve(tick, [1, -0.9], mode='same')  # emphasize highs
    thump = np.sin(2 * np.pi * (140 * low) * x) * np.exp(-x * 70)
    s = (0.8 * tick + 0.9 * thump) * amp
    audio[i0:i0 + n] += s[: max(0, min(n, len(audio) - i0))]

for k in key_times:
    click(k, low=random.uniform(0.9, 1.15), amp=random.uniform(0.4, 0.6))
click(enter_t, low=0.7, amp=0.75)
peak = float(np.max(np.abs(audio))) or 1.0
audio = (audio / peak * 0.8)
with wave.open(os.path.join(out, 'typing.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((audio * 32767).astype(np.int16).tobytes())

# ---------- frames ----------
def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

glow_base = Image.new('RGB', (W, H), BG)

def frame(ts):
    img = glow_base.copy()
    # soft gold bloom behind the bar, stronger after enter
    boost = ease((ts - enter_t) / 0.6) * 0.5
    bloom = Image.new('RGB', (W, H), (0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    a = int(255 * (0.10 + boost * 0.25))
    bd.ellipse((140, 700, 940, 1160), fill=(int(GOLD[0] * a / 255), int(GOLD[1] * a / 255), int(GOLD[2] * a / 255)))
    bloom = bloom.filter(ImageFilter.GaussianBlur(160))
    img = Image.fromarray(np.clip(np.asarray(img, dtype=np.int16) + np.asarray(bloom, dtype=np.int16), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)

    # address bar
    bx0, by0, bx1, by1 = 90, 830, 990, 1010
    pulse = ease((ts - enter_t) / 0.25) * (1 - ease((ts - enter_t - 0.25) / 0.5))
    border = tuple(int(c * (0.45 + 0.55 * pulse)) for c in GOLD)
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=90, fill=(22, 22, 22), outline=border, width=4 + int(4 * pulse))

    # lock dot + typed text
    typed = sum(1 for k in key_times if ts >= k)
    text = URL[:typed]
    tx = bx0 + 70
    d.ellipse((tx, 905, tx + 22, 927), fill=GOLD)
    tx += 60
    ty = 892
    d.text((tx, ty), text, font=f_url, fill=(255, 255, 255))
    # cursor
    tw = d.textlength(text, font=f_url)
    blink = (int(ts * 2.2) % 2 == 0) or (ts < key_times[-1] + 0.4 and typed > 0 and ts - (key_times[typed - 1] if typed else 0) < 0.15)
    if ts < enter_t and blink:
        cx = tx + tw + 6
        d.rectangle((cx, ty + 6, cx + 5, ty + 86), fill=GOLD)

    # tagline
    k = ease((ts - tag_t) / 0.5)
    if k > 0:
        y0 = 1110 + int((1 - k) * 24)
        for text_, font_, fill_, dy in [(TAG[0], f_tag, (255, 255, 255), 0), (TAG[1], f_sub, GOLD, 78)]:
            tl = d.textlength(text_, font=font_)
            col = tuple(int(c * k + BG[i] * (1 - k)) for i, c in enumerate(fill_))
            d.text(((W - tl) / 2, y0 + dy), text_, font=font_, fill=col)
    return img

n = int(DUR * FPS)
for i in range(n):
    frame(i / FPS).save(os.path.join(out, 'f%04d.png' % i))
print('frames', n, 'enter', enter_t)
