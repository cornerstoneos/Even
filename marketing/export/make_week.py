# Week of posts (founder 2026-11-15): recuts of the existing app recordings.
# Each step post = 2s hook on the result ($5,219 bid card, zoomed) -> the step
# clip zoomed in with its title -> end card with ONE sign-up offer (A or B).
# Saturday = Pain Point: its own opening, then the bid proof, then the end card.
# Usage: python3 make_week.py <outdir>
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

VID = os.path.join(os.path.dirname(__file__), '..', 'public', 'library', 'videos')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, '_tmp'); os.makedirs(TMP, exist_ok=True)
W, H = 1080, 1920
GOLD, WHITE, MUTED, BG = (255, 179, 0), (255, 255, 255), (170, 170, 170), (10, 10, 10)
F = lambda w, s: ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf' % w, s)
LOGO = Image.open(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'logo-hero.png')).convert('RGBA')

CTA = {'a': {'en': '3 free estimates. No card.', 'es': '3 estimados gratis. Sin tarjeta.'},
       'b': {'en': 'Sign up free. Get 5 estimates.', 'es': 'Regístrate gratis. Recibe 5 estimados.'}}
POSTS = [  # day, clip, cta, hook {en,es}, title {en,es}
    ('1-mon', 'even-1-describe', 'a', {'en': 'Type the job.\nGet the bid.', 'es': 'Escribe el trabajo.\nRecibe la oferta.'},
     {'en': 'Describe the job.', 'es': 'Describe el trabajo.'}),
    ('2-tue', 'even-2-margins', 'b', {'en': 'Your overhead.\nYour profit.\nYour number.', 'es': 'Tus gastos.\nTu ganancia.\nTu número.'},
     {'en': 'You set the margins.', 'es': 'Tú pones los márgenes.'}),
    ('3-wed', 'even-3-questions', 'a', {'en': 'It asks what\na pro would ask.', 'es': 'Pregunta lo que\npreguntaría un profesional.'},
     {'en': 'Answer a few questions.', 'es': 'Responde unas preguntas.'}),
    ('4-thu', 'even-4-bid', 'b', {'en': 'Real permit fees.\nShown, not guessed.', 'es': 'Permisos reales.\nCon la fuente, sin adivinar.'},
     {'en': 'Get your bid.', 'es': 'Recibe tu oferta.'}),
    ('5-fri', 'even-5-proposal', 'a', {'en': 'Bid to client proposal.\nOne tap.', 'es': 'De la oferta a la propuesta.\nUn toque.'},
     {'en': 'Send the proposal.', 'es': 'Envía la propuesta.'}),
]
JOB = {'en': 'Panel upgrade 100A to 200A · Aventura, FL', 'es': 'Cambio de panel 100A a 200A · Aventura, FL'}

def run(*a): subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *a], check=True)

def text_block(d, lines, font, y, fill, gap=12):
    for ln in lines:
        d.text(((W - d.textlength(ln, font=font)) / 2, y), ln, font=font, fill=fill); y += font.size + gap
    return y

def hook_png(lang, hook, path):
    # result first: the bid card from the recording, zoomed, under the hook line
    src = os.path.join(TMP, f'bid_{lang}.png')
    run('-ss', '4.2', '-i', os.path.join(VID, f'even-4-bid-{lang}.mp4'), '-frames:v', '1', src)
    top = {'en': 388, 'es': 406}[lang]  # the ES run sits a little lower on screen
    card = Image.open(src).crop((210, top, 870, top + 543)).resize((1080, int(543 * 1080 / 660)), Image.LANCZOS)
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    lg = LOGO.resize((84, 84)); im.paste(lg, (60, 70), lg); d.text((160, 78), 'even.', font=F('Bold', 56), fill=WHITE)
    lines = hook.split('\n'); f = F('ExtraBold', 92 if max(len(l) for l in lines) <= 20 else 74)
    text_block(d, lines, f, 250, WHITE, 16)
    y0 = 720; im.paste(card, (0, y0))
    d.rectangle((0, y0 - 14, W, y0 - 10), fill=GOLD)
    jf = F('SemiBold', 40); d.text(((W - d.textlength(JOB[lang], font=jf)) / 2, y0 + card.height + 50), JOB[lang], font=jf, fill=GOLD)
    im.save(path)

def band_png(title, step, lang, path):
    im = Image.new('RGBA', (W, 230), (10, 10, 10, 255)); d = ImageDraw.Draw(im)
    s = ('PASO ' if lang == 'es' else 'STEP ') + step; sf = F('SemiBold', 34)
    d.text((60, 40), s, font=sf, fill=GOLD)
    d.text((60, 92), title, font=F('Bold', 72), fill=WHITE)
    d.rectangle((0, 226, W, 230), fill=GOLD + (255,))
    im.save(path)

def end_png(lang, cta, path):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    lg = LOGO.resize((220, 220)); im.paste(lg, ((W - 220) // 2, 420), lg)
    y = text_block(d, ['even.'], F('Bold', 96), 680, WHITE)
    y = text_block(d, ['Pruébalo en tu próximo trabajo.' if lang == 'es' else 'Try it on your next job.'], F('SemiBold', 50), y + 60, MUTED)
    t = CTA[cta][lang]; sz = 70
    while d.textlength(t, font=F('ExtraBold', sz)) > W - 220: sz -= 2
    f = F('ExtraBold', sz)
    tw = d.textlength(t, font=f); px = (W - tw) / 2 - 50
    d.rounded_rectangle((px, y + 70, px + tw + 100, y + 70 + f.size + 70), radius=60, fill=GOLD)
    d.text((px + 50, y + 70 + 32), t, font=f, fill=BG)
    text_block(d, ['even-os.com'], F('Bold', 64), y + 330, GOLD)
    im.save(path)

def still(png, secs, out):
    run('-loop', '1', '-t', str(secs), '-i', png, '-f', 'lavfi', '-t', str(secs), '-i', 'anullsrc=r=44100:cl=stereo',
        '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-shortest', out)

def concat(parts, out):
    lst = os.path.join(TMP, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    run('-f', 'concat', '-safe', '0', '-i', lst, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', out)

for lang in ('en', 'es'):
    for day, clip, cta, hook, title in POSTS:
        n = day.split('-')[0]; base = os.path.join(TMP, f'{day}-{lang}')
        hook_png(lang, hook[lang], base + '-hook.png'); still(base + '-hook.png', 2.2, base + '-1.mp4')
        band_png(title[lang], n, lang, base + '-band.png')
        # body: the recording zoomed 1.3x, its own header covered by the title band
        run('-i', os.path.join(VID, f'{clip}-{lang}.mp4'), '-i', base + '-band.png', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
            '-filter_complex', '[0:v]scale=1404:2496,crop=1080:1920:162:300[z];[z][1:v]overlay=0:0,fps=30,format=yuv420p[v]',
            '-map', '[v]', '-map', '2:a', '-shortest', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', base + '-2.mp4')
        end_png(lang, cta, base + '-end.png'); still(base + '-end.png', 2.8, base + '-3.mp4')
        concat([base + '-1.mp4', base + '-2.mp4', base + '-3.mp4'], os.path.join(OUT, f'{day}-{clip[5:]}-{cta}-{lang}.mp4'))
    # Saturday: Pain Point keeps its opening (dark lead-in trimmed), then the bid proof, then the end card (B)
    base = os.path.join(TMP, f'6-sat-{lang}')
    run('-ss', '0.8', '-t', '18.6', '-i', os.path.join(VID, f'even-pain-point-{lang}.mp4'), '-vf', 'fps=30,format=yuv420p',
        '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-af', 'afade=t=out:st=17.6:d=1', base + '-1.mp4')
    band_png('Recibe tu oferta.' if lang == 'es' else 'Get your bid.', '4', lang, base + '-band.png')
    run('-ss', '3.6', '-t', '5.5', '-i', os.path.join(VID, f'even-4-bid-{lang}.mp4'), '-i', base + '-band.png', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-filter_complex', '[0:v]scale=1404:2496,crop=1080:1920:162:300[z];[z][1:v]overlay=0:0,fps=30,format=yuv420p[v]',
        '-map', '[v]', '-map', '2:a', '-shortest', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', base + '-2.mp4')
    end_png(lang, 'b', base + '-end.png'); still(base + '-end.png', 2.8, base + '-3.mp4')
    concat([base + '-1.mp4', base + '-2.mp4', base + '-3.mp4'], os.path.join(OUT, f'6-sat-pain-point-b-{lang}.mp4'))
print('done')
