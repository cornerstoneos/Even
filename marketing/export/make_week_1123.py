# Week of Nov 23, 2026 posts (founder 2026-11-23).
#   Mon  Even 1.4 "what's new": static image + clip of the new questions screen (offer B)
#   Tue  Step 4 "Get your bid", re-cut so the Spanish version skips the loading
#        screen's old English chips (recorded before the 11/15 fix) (offer A)
#   Wed  Feature 1 of the feature series: the quote link (static image)
#   Thu  Step 5 (last week's file, unchanged)   Sat  Pain Point (last week's file)
# Usage: python3 make_week_1123.py <out_dir> <questions_rec_dir>
#   questions_rec_dir holds q_en.webm / q_es.webm (phone recording of the questions screen).
import os, subprocess, sys, shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
VID = os.path.join(HERE, '..', 'public', 'library', 'videos')
LAST = os.path.join(HERE, '..', 'public', 'library', 'week-2026-11-16')
OUT, REC = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, '_tmp'); os.makedirs(TMP, exist_ok=True)
W, H = 1080, 1920
GOLD, WHITE, MUTED, BG, GREEN = (255, 179, 0), (255, 255, 255), (170, 170, 170), (10, 10, 10), (60, 207, 110)
F = lambda w, s: ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf' % w, s)
LOGO = Image.open(os.path.join(HERE, '..', '..', 'assets', 'logo-hero.png')).convert('RGBA')
CTA = {'a': {'en': '3 free estimates. No card.', 'es': '3 estimados gratis. Sin tarjeta.'},
       'b': {'en': 'Sign up free. Get 5 estimates.', 'es': 'Regístrate gratis. Recibe 5 estimados.'}}

def run(*a): subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *a], check=True)

def lines(d, items, font, x, y, fill, gap, width):
    for t in items:
        words, ln = t.split(), ''
        for w in words:
            tt = (ln + ' ' + w).strip()
            if d.textlength(tt, font=font) > width: d.text((x, y), ln, font=font, fill=fill); y += font.size + gap; ln = w
            else: ln = tt
        d.text((x, y), ln, font=font, fill=fill); y += font.size + gap
    return y

def brand(im, d, y=70):
    lg = LOGO.resize((84, 84)); im.paste(lg, (70, y), lg); d.text((170, y + 8), 'even.', font=F('Bold', 56), fill=WHITE)

def fit(d, text, weight, size, width):
    while d.textlength(text, font=F(weight, size)) > width: size -= 2
    return F(weight, size)

# ── Even 1.4 ──
V14 = {
    'en': dict(tag='EVEN 1.4', head='What\'s new this week', items=[
        ('Big plan sets now upload', 'Send the whole permit set. Even keeps the sheets for your trade.'),
        ('Same job, same price', 'English or Spanish, the number does not change.'),
        ('Your estimate builds as you answer', 'Every answer shows up as it goes into the bid.')],
        band='New: your estimate builds as you answer.'),
    'es': dict(tag='EVEN 1.4', head='Lo nuevo esta semana', items=[
        ('Juegos de planos grandes', 'Sube el juego completo. Even usa las hojas de tu oficio.'),
        ('El mismo trabajo, el mismo precio', 'En inglés o en español, el número no cambia.'),
        ('Tu estimado se arma mientras respondes', 'Cada respuesta aparece mientras entra en la oferta.')],
        band='Nuevo: tu estimado se arma mientras respondes.'),
}

def card_14(lang, size):
    w, h = size; t = V14[lang]
    im = Image.new('RGB', (w, h), BG); d = ImageDraw.Draw(im); brand(im, d)
    y = 230 if h > 1500 else 200
    d.text((70, y), t['tag'], font=F('Bold', 40), fill=GOLD); y += 66
    y = lines(d, [t['head']], fit(d, t['head'], 'ExtraBold', 86, w - 140), 70, y, WHITE, 10, w - 140) + 50
    for title, sub in t['items']:
        d.ellipse((70, y + 6, 116, y + 52), fill=GREEN); d.text((81, y + 7), '✓', font=F('Bold', 34), fill=BG)
        y = lines(d, [title], F('Bold', 48), 146, y, WHITE, 8, w - 216)
        y = lines(d, [sub], F('Regular', 36), 146, y + 4, MUTED, 8, w - 216) + 40
    d.text((70, h - 120), 'even-os.com', font=F('Bold', 52), fill=GOLD)
    return im

def band_png(text, path):
    im = Image.new('RGBA', (W, 250), (10, 10, 10, 255)); d = ImageDraw.Draw(im)
    d.text((60, 44), 'EVEN 1.4', font=F('SemiBold', 34), fill=GOLD)
    lines(d, [text], fit(d, text, 'Bold', 56, W - 120) if len(text) < 60 else F('Bold', 50), 60, 96, WHITE, 6, W - 120)
    d.rectangle((0, 246, W, 250), fill=GOLD + (255,)); im.save(path)

def end_png(lang, cta, path):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    lg = LOGO.resize((220, 220)); im.paste(lg, ((W - 220) // 2, 420), lg)
    def ctr(t, f, y, c): d.text(((W - d.textlength(t, font=f)) / 2, y), t, font=f, fill=c)
    ctr('even.', F('Bold', 96), 680, WHITE)
    ctr('Pruébalo en tu próximo trabajo.' if lang == 'es' else 'Try it on your next job.', F('SemiBold', 50), 840, MUTED)
    t = CTA[cta][lang]; f = fit(d, t, 'ExtraBold', 70, W - 220); tw = d.textlength(t, font=f); px = (W - tw) / 2 - 50
    d.rounded_rectangle((px, 970, px + tw + 100, 970 + f.size + 70), radius=60, fill=GOLD); d.text((px + 50, 1002), t, font=f, fill=BG)
    ctr('even-os.com', F('Bold', 64), 1230, GOLD)
    im.save(path)

def still(png, secs, out):
    run('-loop', '1', '-t', str(secs), '-i', png, '-f', 'lavfi', '-t', str(secs), '-i', 'anullsrc=r=44100:cl=stereo',
        '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-shortest', out)

def concat(parts, out):
    lst = os.path.join(TMP, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    run('-f', 'concat', '-safe', '0', '-i', lst, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', out)

for lang in ('en', 'es'):
    # Mon: static post (4:5) + clip
    card_14(lang, (1080, 1350)).save(os.path.join(OUT, f'1-mon-even-1-4-{lang}.png'))
    base = os.path.join(TMP, f'14-{lang}')
    card_14(lang, (W, H)).save(base + '-hook.png'); still(base + '-hook.png', 3.2, base + '-1.mp4')
    band_png(V14[lang]['band'], base + '-band.png')
    rec = os.path.join(REC, f'q_{lang}.webm')
    run('-ss', '3.0', '-i', rec, '-i', base + '-band.png', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-filter_complex', '[0:v]scale=1080:-2,crop=1080:1670:0:150,pad=1080:1920:0:250:color=0x0a0a0a[z];[z][1:v]overlay=0:0,fps=30,format=yuv420p[v]',
        '-map', '[v]', '-map', '2:a', '-shortest', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', base + '-2.mp4')
    end_png(lang, 'b', base + '-end.png'); still(base + '-end.png', 2.8, base + '-3.mp4')
    concat([base + '-1.mp4', base + '-2.mp4', base + '-3.mp4'], os.path.join(OUT, f'1-mon-even-1-4-b-{lang}.mp4'))

    # Tue: step 4, body starts after the loading screen (skips the old English chips in ES)
    base = os.path.join(TMP, f's4-{lang}')
    src = os.path.join(LAST, f'4-thu-4-bid-b-{lang}.mp4')   # hook (0-2.2s) + body + end card (last 2.8s)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
    run('-t', '2.2', '-i', src, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', base + '-1.mp4')
    run('-ss', str(2.2 + 3.9), '-t', str(dur - 2.8 - 2.2 - 3.9), '-i', src, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', base + '-2.mp4')
    end_png(lang, 'a', base + '-end.png'); still(base + '-end.png', 2.8, base + '-3.mp4')
    concat([base + '-1.mp4', base + '-2.mp4', base + '-3.mp4'], os.path.join(OUT, f'2-tue-step-4-bid-a-{lang}.mp4'))

    # Thu / Sat: last week's files, unchanged
    shutil.copy(os.path.join(LAST, f'5-fri-5-proposal-a-{lang}.mp4'), os.path.join(OUT, f'4-thu-step-5-proposal-a-{lang}.mp4'))
    shutil.copy(os.path.join(LAST, f'6-sat-pain-point-b-{lang}.mp4'), os.path.join(OUT, f'6-sat-pain-point-b-{lang}.mp4'))

# ── Wed: Feature 1, the quote link (static, 4:5) ──
QL = {
    'en': dict(tag='FEATURE 1 · YOUR QUOTE LINK', head='Free estimates without losing your nights.',
               steps=[('1', 'Share your link', 'even-os.com/q/your-company on your website, Google listing, door hangers or texts.'),
                      ('2', 'The client describes the job', 'They send the work, the address and how to reach them.'),
                      ('3', 'You get a priced draft', 'One tap builds it with your settings. Check it, adjust it, send it.')],
               foot='Free with your account. Sign up and get 5 estimates.'),
    'es': dict(tag='FUNCIÓN 1 · TU LINK DE COTIZACIÓN', head='Estimados gratis sin perder tus noches.',
               steps=[('1', 'Comparte tu link', 'even-os.com/q/tu-empresa en tu web, tu perfil de Google, volantes o textos.'),
                      ('2', 'El cliente describe el trabajo', 'Te manda el trabajo, la dirección y cómo contactarlo.'),
                      ('3', 'Recibes un borrador con precio', 'Un toque lo arma con tus ajustes. Revísalo, ajústalo y envíalo.')],
               foot='Gratis con tu cuenta. Regístrate y recibe 5 estimados.'),
}
for lang in ('en', 'es'):
    t = QL[lang]; w, h = 1080, 1350
    im = Image.new('RGB', (w, h), BG); d = ImageDraw.Draw(im); brand(im, d)
    y = 210; d.text((70, y), t['tag'], font=fit(d, t['tag'], 'Bold', 36, w - 140), fill=GOLD); y += 64
    y = lines(d, [t['head']], F('ExtraBold', 76), 70, y, WHITE, 10, w - 140) + 46
    for n, title, sub in t['steps']:
        d.ellipse((70, y, 130, y + 60), outline=GOLD, width=4); d.text((89 if n != '1' else 92, y + 6), n, font=F('Bold', 40), fill=GOLD)
        y = lines(d, [title], F('Bold', 46), 160, y + 2, WHITE, 8, w - 230)
        y = lines(d, [sub], F('Regular', 34), 160, y + 4, MUTED, 8, w - 230) + 36
    d.rectangle((70, h - 190, w - 70, h - 186), fill=GOLD)
    d.text((70, h - 160), t['foot'], font=fit(d, t['foot'], 'SemiBold', 38, w - 140), fill=WHITE)
    d.text((70, h - 100), 'even-os.com', font=F('Bold', 48), fill=GOLD)
    im.save(os.path.join(OUT, f'3-wed-feature-1-quote-link-{lang}.png'))
shutil.rmtree(TMP)
print('done')
