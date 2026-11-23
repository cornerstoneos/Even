# Photo posts with the feature ON SCREEN (founder rule 2026-11-23: every piece of
# content shows the feature visually, never text only). Screenshots are the real
# app pages with sample data (a made-up client); any price shown is computed by
# the real pricing engine on real data, and the image says it is a sample.
# Usage: python3 make_feature_stills.py <out_dir> <shots_dir>
#   shots_dir: q_form_{en,es}.png, q_inbox_{en,es}.png (3x phone shots), qcard_{en,es}.png (2x frame)
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT, SH = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(__file__)
GOLD, WHITE, MUTED, BG, GREEN = (255, 179, 0), (255, 255, 255), (165, 165, 165), (10, 10, 10), (60, 207, 110)
F = lambda w, s: ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf' % w, s)
LOGO = Image.open(os.path.join(HERE, '..', '..', 'assets', 'logo-hero.png')).convert('RGBA')
W, H = 1080, 1350

def wrap(d, text, font, width):
    out, ln = [], ''
    for w in text.split():
        t = (ln + ' ' + w).strip()
        if d.textlength(t, font=font) > width and ln: out.append(ln); ln = w
        else: ln = t
    return out + ([ln] if ln else [])

def text(d, s, font, x, y, fill, width, gap=8):
    for ln in wrap(d, s, font, width): d.text((x, y), ln, font=font, fill=fill); y += font.size + gap
    return y

def shot(img, w, radius=28, border=GOLD):
    img = img.resize((w, int(img.height * w / img.width)), Image.LANCZOS)
    m = Image.new('L', img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=radius, fill=255)
    out = Image.new('RGBA', (img.width + 6, img.height + 6), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle((0, 0, img.width + 5, img.height + 5), radius=radius + 3, fill=border + (255,))
    out.paste(img, (3, 3), m)
    return out

def base(tag, head):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    lg = LOGO.resize((64, 64)); im.paste(lg, (60, 46), lg); d.text((138, 52), 'even.', font=F('Bold', 44), fill=WHITE)
    d.text((60, 140), tag, font=F('Bold', 30), fill=GOLD)
    y = text(d, head, F('ExtraBold', 62), 60, 184, WHITE, W - 120, 6)
    return im, d, y

QL = {
    'en': dict(tag='FEATURE 1 · YOUR QUOTE LINK', head='Free estimates without losing your nights.',
               l1='1  The client sends the job', l2='2  You get a priced draft', l3='3  Check it, adjust it, send it.',
               link='Your link: even-os.com/q/your-company', foot='Free with your account. Sign up and get 5 estimates.',
               note='Sample request. Draft priced by Even with Pembroke Pines permit data and default settings.'),
    'es': dict(tag='FUNCIÓN 1 · TU LINK DE COTIZACIÓN', head='Estimados gratis sin perder tus noches.',
               l1='1  El cliente manda el trabajo', l2='2  Recibes un borrador con precio', l3='3  Revísalo, ajústalo y envíalo.',
               link='Tu link: even-os.com/q/tu-empresa', foot='Gratis con tu cuenta. Regístrate y recibe 5 estimados.',
               note='Solicitud de ejemplo. Borrador con precio de Even, con datos de permisos de Pembroke Pines y ajustes estándar.'),
}
for lang, t in QL.items():
    im, d, y = base(t['tag'], t['head'])
    y += 26
    form = Image.open(os.path.join(SH, f'q_form_{lang}.png')); form = form.crop((0, 0, form.width, int(form.height * 0.80)))
    inbox = Image.open(os.path.join(SH, f'q_inbox_{lang}.png'))
    colw = (W - 60 * 2 - 40) // 2
    d.text((60, y), t['l1'], font=F('Bold', 30), fill=WHITE); d.text((60 + colw + 40, y), t['l2'], font=F('Bold', 30), fill=WHITE)
    y += 50
    a = shot(form, colw); im.paste(a, (60, y), a)
    b = shot(inbox, colw); im.paste(b, (60 + colw + 40, y), b)
    ry = y + b.height + 34
    ry = text(d, t['l3'], F('Bold', 30), 60 + colw + 40, ry, WHITE, colw) + 18
    ry = text(d, t['link'], F('SemiBold', 26), 60 + colw + 40, ry, GOLD, colw) + 26
    text(d, t['note'], F('Regular', 21), 60 + colw + 40, ry, MUTED, colw, 5)
    d.rectangle((60, H - 120, W - 60, H - 117), fill=GOLD)
    d.text((60, H - 96), t['foot'], font=F('SemiBold', 30), fill=WHITE)
    d.text((W - 60 - d.textlength('even-os.com', font=F('Bold', 34)), H - 52), 'even-os.com', font=F('Bold', 34), fill=GOLD)
    im.save(os.path.join(OUT, f'3-wed-feature-1-quote-link-{lang}.png'))

V14 = {
    'en': dict(tag='EVEN 1.4 · WHAT\'S NEW', head='Your estimate builds as you answer.',
               items=['Big plan sets upload, Even keeps your trade\'s sheets', 'Same job, same price in English or Spanish']),
    'es': dict(tag='EVEN 1.4 · LO NUEVO', head='Tu estimado se arma mientras respondes.',
               items=['Planos grandes: Even usa las hojas de tu oficio', 'El mismo precio en inglés o en español']),
}
for lang, t in V14.items():
    im, d, y = base(t['tag'], t['head'])
    y += 18
    for it in t['items']:
        d.ellipse((60, y + 4, 92, y + 36), fill=GREEN); d.text((67, y + 3), '✓', font=F('Bold', 24), fill=BG)
        y = text(d, it, F('SemiBold', 30), 108, y, WHITE, W - 170) + 12
    y += 14
    top = {'en': 400, 'es': 520}[lang]  # the Spanish page sits lower (longer question text)
    card = Image.open(os.path.join(SH, f'qcard_{lang}.png')).crop((0, top, 780, top + 960))
    s = shot(card, 600); im.paste(s, ((W - s.width) // 2, y), s)
    d.text(((W - d.textlength('even-os.com', font=F('Bold', 40))) // 2, H - 70), 'even-os.com', font=F('Bold', 40), fill=GOLD)
    im.save(os.path.join(OUT, f'1-mon-even-1-4-{lang}.png'))
print('done')
