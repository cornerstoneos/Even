"""Even daily stories v2: brand grid, big type. 1080x1920, 30fps. Usage: make_stories.py <outdir>
Builds the typing story + 5 everyday stories, EN + ES. Content rules: only claims we can back up (see even-data tasks/marketing.md CLAIMS RULE)."""
import sys, os, math, random, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
W, H, FPS = 1080, 1920, 30
BG = (8, 8, 8); GOLD = (212, 175, 55); WHITE = (255, 255, 255); GRAY = (140, 140, 140)
FONT = '/usr/share/fonts/opentype/inter/Inter-%s.otf'
F = lambda w, s: ImageFont.truetype(FONT % w, s)
LOGO = '/home/user/Even/marketing/public/logo.png'

def grid_bg():
    layer = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(layer)
    col = (24, 20, 8)
    sp = 46
    t = math.tan(math.radians(60))
    for off in range(-int(H / t) - sp, W + sp, sp):
        d.line((off, 0, off + H / t, H), fill=col, width=1)
        d.line((off + H / t, 0, off, H), fill=col, width=1)
    # vignette + soft gold bloom
    bloom = Image.new('RGB', (W, H), (0, 0, 0))
    ImageDraw.Draw(bloom).ellipse((60, 520, 1020, 1400), fill=(40, 33, 9))
    bloom = bloom.filter(ImageFilter.GaussianBlur(190))
    vig = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vig).ellipse((-250, -150, W + 250, H + 150), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(260))
    a = np.asarray(layer, dtype=np.float32) + np.asarray(bloom, dtype=np.float32)
    a = a * (np.asarray(vig, dtype=np.float32)[..., None] / 255.0 * 0.85 + 0.15)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

BG_IMG = grid_bg()
try:
    LOGO_IMG = Image.open(LOGO).convert('RGBA'); r = 170 / LOGO_IMG.height; LOGO_IMG = LOGO_IMG.resize((int(LOGO_IMG.width * r), 170))
except Exception:
    LOGO_IMG = None

def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

def fade_text(img, d, xy, text, font, fill, t, start, dur=0.55, rise=26, center=False):
    k = ease((t - start) / dur)
    if k <= 0: return
    x, y = xy
    if center: x = (W - d.textlength(text, font=font)) / 2
    col = tuple(int(c * k + BG[i] * (1 - k)) for i, c in enumerate(fill))
    d.text((x, y + (1 - k) * rise), text, font=font, fill=col)

def wrap(d, text, font, maxw):
    lines, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def chrome(img, d, t, cta=True, lang='en'):
    k = ease(t / 0.5)
    if LOGO_IMG is not None:
        tmp = LOGO_IMG.copy(); tmp.putalpha(tmp.getchannel('A').point(lambda v: int(v * k)))
        img.paste(tmp, ((W - tmp.width) // 2, 120), tmp)
    fw = F('Bold', 72)
    wx = (W - d.textlength('even.', font=fw)) / 2
    col = lambda c: tuple(int(v * k + BG[i] * (1 - k)) for i, v in enumerate(c))
    d.text((wx, 305), 'even', font=fw, fill=col(WHITE))
    d.text((wx + d.textlength('even', font=fw), 305), '.', font=fw, fill=col(GOLD))
    if cta:
        bob = int(8 * math.sin(t * 5))
        fade_text(img, d, (0, 1470 + bob), ('Toca el link  ↓' if lang == 'es' else 'Tap the link  ↓'), F('SemiBold', 46), WHITE, t, 1.0, center=True)
    fade_text(img, d, (0, 1560), 'even-os.com', F('SemiBold', 44), GOLD, t, 0.6, center=True)

# ---------- generic text story ----------
def text_story(lang, spec, t):
    img = BG_IMG.copy(); d = ImageDraw.Draw(img)
    chrome(img, d, t, cta=spec.get('cta', True), lang=lang)
    y = 620
    beat = 0.35
    if spec.get('eyebrow'):
        fade_text(img, d, (0, y), spec['eyebrow'].upper(), F('SemiBold', 42), GOLD, t, beat, center=True); y += 100; beat += 0.25
    if spec.get('big'):
        fade_text(img, d, (0, y), spec['big'], F('Bold', spec.get('bigsize', 230)), GOLD, t, beat, center=True); y += spec.get('bigsize', 230) + 40; beat += 0.3
    tsize = 88
    while tsize > 52 and max((d.textlength(l, font=F('Bold', tsize)) for l in spec.get('title', [''])), default=0) > W - 130: tsize -= 4
    for ln in spec.get('title', []):
        fade_text(img, d, (0, y), ln, F('Bold', tsize), WHITE, t, beat, center=True); y += int(tsize * 1.22); beat += 0.2
    y += 24
    for ln in spec.get('sub', []):
        fade_text(img, d, (0, y), ln, F('Medium', 50), GRAY, t, beat, center=True); y += 66; beat += 0.2
    for (a, b) in spec.get('rows', []):
        k = ease((t - beat) / 0.5)
        if k > 0:
            fa, fb = F('Medium', 48), F('SemiBold', 54)
            col = lambda c: tuple(int(v * k + BG[i] * (1 - k)) for i, v in enumerate(c))
            d.text((140, y), a, font=fa, fill=col(GRAY))
            d.text((W - 140 - d.textlength(b, font=fb), y - 4), b, font=fb, fill=col(GOLD if b.startswith('$') and a.startswith(spec.get('hl', '~')) else WHITE))
            d.line((140, y + 82, W - 140, y + 82), fill=tuple(int(40 * k) for _ in range(3)), width=2)
        y += 104; beat += 0.25
    if spec.get('src'):
        fade_text(img, d, (0, 1385), spec['src'], F('Regular', 32), (120, 120, 120), t, beat + 0.2, center=True)
    return img

STORIES = {
 'permit': {
  'en': dict(eyebrow='Permit fact', big='$162.50', bigsize=210, title=['Aventura electrical', 'permit minimum'], sub=['What would you have guessed?'], src='City of Aventura fee schedule, effective Jul 8, 2026'),
  'es': dict(eyebrow='Dato de permisos', big='$162.50', bigsize=210, title=['Permiso eléctrico', 'mínimo en Aventura'], sub=['¿Cuánto habrías adivinado?'], src='Tarifa de la Ciudad de Aventura, vigente desde el 8 jul 2026'),
 },
 'howlong': {
  'en': dict(eyebrow='Be honest', title=['How long does your', 'estimate take?'], sub=['Vote below'], cta=False),
  'es': dict(eyebrow='Sé honesto', title=['¿Cuánto tarda', 'tu estimado?'], sub=['Vota abajo'], cta=False),
 },
 'three': {
  'en': dict(eyebrow='Try it free', big='3', bigsize=360, title=['free estimates.'], sub=['No credit card.', 'Run your next bid through it.']),
  'es': dict(eyebrow='Pruébalo gratis', big='3', bigsize=360, title=['estimados gratis.'], sub=['Sin tarjeta de crédito.', 'Pasa tu próximo presupuesto por aquí.']),
 },
 'bid': {
  'en': dict(eyebrow='Would you bid this?', title=['200A panel upgrade', 'Aventura, FL'], rows=[('Materials', '$1,736.66'), ('Labor', '$1,159.08'), ('Permit', '$162.50'), ('Bid', '$4,550')], hl='Bid', src='One real run, Oct 7, 2026. Every line shows its source.'),
  'es': dict(eyebrow='¿Lo cotizarías así?', title=['Cambio de panel 200A', 'Aventura, FL'], rows=[('Materiales', '$1,736.66'), ('Mano de obra', '$1,159.08'), ('Permiso', '$162.50'), ('Oferta', '$4,550')], hl='Oferta', src='Una corrida real, 7 oct 2026. Cada línea muestra su fuente.'),
 },
 'margins': {
  'en': dict(eyebrow='Your numbers', big='You', bigsize=200, title=['set the margins.'], sub=['Overhead. Profit. Risk.', 'Even never picks them for you.']),
  'es': dict(eyebrow='Tus números', big='Tú', bigsize=200, title=['pones los márgenes.'], sub=['Gastos. Ganancia. Riesgo.', 'Even nunca los decide por ti.']),
 },
 'cement': {
  'en': dict(eyebrow='Remember', title=['A bad estimate is', 'cement in your shoes.'], sub=['You drag it through the whole job.']),
  'es': dict(eyebrow='Recuerda', title=['Un mal estimado es', 'cemento en los zapatos.'], sub=['Lo arrastras todo el trabajo.']),
 },
 'underbid': {
  'en': dict(eyebrow='Real talk', title=["What's the last job", 'you underbid?'], sub=['Tell me below. No judgment.'], cta=False),
  'es': dict(eyebrow='Sin rodeos', title=['¿Cuál fue el último', 'trabajo que cotizaste bajo?'], sub=['Cuéntame abajo. Sin juicios.'], cta=False),
 },
}

# ---------- typing story ----------
URL = 'even-os.com'
def typing_times():
    random.seed(7); t = 0.9; out = []
    for _ in URL: t += random.uniform(0.11, 0.21); out.append(round(t, 3))
    return out
KEYS = typing_times(); ENTER = KEYS[-1] + 0.45

def typing_frame(lang, t):
    img = BG_IMG.copy(); d = ImageDraw.Draw(img)
    chrome(img, d, t, cta=False, lang=lang)
    f = F('Bold', 140)
    typed = sum(1 for k in KEYS if t >= k); text = URL[:typed]
    full_w = d.textlength(URL, font=f); x0 = (W - full_w) / 2; y = 880
    d.text((x0, y), text, font=f, fill=WHITE)
    if t < ENTER and (int(t * 2.4) % 2 == 0 or (typed and t - KEYS[typed - 1] < 0.18)):
        cx = x0 + d.textlength(text, font=f) + 8
        d.rectangle((cx, y + 18, cx + 10, y + 150), fill=GOLD)
    if t >= ENTER:   # gold underline sweep + tagline
        k = ease((t - ENTER) / 0.45)
        d.rectangle((x0, y + 178, x0 + full_w * k, y + 188), fill=GOLD)
        tag = {'en': ('3 free estimates.', 'No credit card.'), 'es': ('3 estimados gratis.', 'Sin tarjeta de crédito.')}[lang]
        fade_text(img, d, (0, 1100), tag[0], F('Bold', 76), WHITE, t, ENTER + 0.3, center=True)
        fade_text(img, d, (0, 1196), tag[1], F('Medium', 56), GOLD, t, ENTER + 0.5, center=True)
    return img

def typing_audio(path, dur):
    SR = 44100; a = np.zeros(int(SR * dur), dtype=np.float32); rng = np.random.default_rng(3); rnd = random.Random(11)
    def click(at, low=1.0, amp=0.55):
        n = int(SR * 0.09); i0 = int(at * SR); x = np.arange(n) / SR
        tick = np.convolve(rng.standard_normal(n) * np.exp(-x * 160), [1, -0.9], mode='same')
        thump = np.sin(2 * np.pi * 140 * low * x) * np.exp(-x * 70)
        s = (0.8 * tick + 0.9 * thump) * amp; a[i0:i0 + n] += s[: max(0, min(n, len(a) - i0))]
    for k in KEYS: click(k, rnd.uniform(0.9, 1.15), rnd.uniform(0.4, 0.6))
    click(ENTER, 0.7, 0.75)
    a = a / (float(np.max(np.abs(a))) or 1) * 0.8
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype(np.int16).tobytes())

def render(name, lang, fn, dur, audio=None):
    d = os.path.join(OUT, f'{name}-{lang}'); os.makedirs(d, exist_ok=True)
    for i in range(int(dur * FPS)): fn(i / FPS).save(os.path.join(d, 'f%04d.png' % i))
    if audio: typing_audio(os.path.join(d, 'a.wav'), dur)
    return d

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for lang in os.environ.get('LANGS', 'en,es').split(','):
        render('typing', lang, lambda t, l=lang: typing_frame(l, t), 6.0, audio=True)
        for name, v in STORIES.items():
            render(name, lang, lambda t, s=v[lang], l=lang: text_story(l, s, t), 6.0)
    print('frames done')
