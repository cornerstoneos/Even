"""Even carousels, 1080x1350 (4:5). Usage: make_carousel.py <outdir>. Builds EN + ES sets of two carousels."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

OUT = sys.argv[1]
W, H = 1080, 1350
BG = (10, 10, 10); GOLD = (212, 175, 55); WHITE = (255, 255, 255); GRAY = (150, 150, 150); CARD = (22, 22, 22); LINE = (52, 52, 52)
FONT = '/usr/share/fonts/opentype/inter/Inter-%s.otf'
F = lambda w, s: ImageFont.truetype(FONT % w, s)

def base():
    img = Image.new('RGB', (W, H), BG)
    bloom = Image.new('RGB', (W, H), (0, 0, 0))
    ImageDraw.Draw(bloom).ellipse((-200, -250, 700, 450), fill=(34, 28, 8))
    bloom = bloom.filter(ImageFilter.GaussianBlur(140))
    return Image.fromarray(np.clip(np.asarray(img, dtype=np.int16) + np.asarray(bloom, dtype=np.int16), 0, 255).astype(np.uint8))

def wrap(d, text, font, maxw):
    lines, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def chrome(d, i, n, swipe, last):
    d.text((90, 80), 'even.', font=F('Bold', 54), fill=GOLD)
    num = f'{i}/{n}'
    d.text((W - 90 - d.textlength(num, font=F('Medium', 34)), 92), num, font=F('Medium', 34), fill=GRAY)
    if not last:
        sw = swipe + '  →'
        d.text((W - 90 - d.textlength(sw, font=F('Medium', 36)), H - 110), sw, font=F('Medium', 36), fill=GOLD)
    d.text((90, H - 110), 'even-os.com', font=F('Medium', 36), fill=GRAY)

def slide(kind, i, n, swipe, eyebrow=None, title='', sub='', rows=None, big=None, cards=None, foot=None, cta=None):
    img = base(); d = ImageDraw.Draw(img)
    chrome(d, i, n, swipe, kind == 'cta')
    y = 270
    if eyebrow:
        d.text((90, y), eyebrow.upper(), font=F('SemiBold', 38), fill=GOLD); y += 80
    for ln in wrap(d, title, F('Bold', 92), W - 180):
        d.text((90, y), ln, font=F('Bold', 92), fill=WHITE); y += 108
    y += 18
    if sub:
        for ln in wrap(d, sub, F('Regular', 44), W - 180):
            d.text((90, y), ln, font=F('Regular', 44), fill=GRAY); y += 60
        y += 20
    if big:
        y += 20
        d.text((90, y), big, font=F('Bold', 150), fill=GOLD); y += 190
    if rows:
        y += 10
        for k, (a, b) in enumerate(rows):
            d.line((90, y, W - 90, y), fill=LINE, width=2)
            fa = F('Medium', 44); fb = F('SemiBold', 44)
            colb = GOLD if k == len(rows) - 1 and kind == 'table-total' else WHITE
            d.text((90, y + 26), a, font=fa, fill=GRAY if colb == WHITE else WHITE)
            d.text((W - 90 - d.textlength(b, font=fb), y + 26), b, font=fb, fill=colb)
            y += 100
        d.line((90, y, W - 90, y), fill=LINE, width=2)
    if cards:
        y += 30
        for (a, b) in cards:
            fb = F('SemiBold', 46)
            bl = wrap(d, b, fb, W - 180 - 80)
            hh = 78 + 58 * len(bl)
            d.rounded_rectangle((90, y, W - 90, y + hh), radius=28, fill=CARD, outline=LINE, width=2)
            d.text((130, y + 24), a, font=F('Medium', 34), fill=GRAY)
            yy = y + 74
            for ln in bl:
                d.text((130, yy), ln, font=fb, fill=WHITE); yy += 58
            y += hh + 26
    if cta:
        y += 30
        d.rounded_rectangle((90, y, W - 90, y + 150), radius=75, fill=GOLD)
        t = cta; f = F('Bold', 60)
        d.text(((W - d.textlength(t, font=f)) / 2, y + 40), t, font=f, fill=(10, 10, 10))
    if foot:
        fl = wrap(d, foot, F('Regular', 30), W - 180)
        yy = H - 150 - 40 * len(fl)
        for ln in fl:
            d.text((90, yy), ln, font=F('Regular', 30), fill=(110, 110, 110)); yy += 40
    return img

def build(name, lang, slides, swipe):
    d = os.path.join(OUT, f'{name}-{lang}'); os.makedirs(d, exist_ok=True)
    n = len(slides)
    for i, kw in enumerate(slides, 1):
        slide(i=i, n=n, swipe=swipe, **kw).save(os.path.join(d, f'{name}-{lang}-{i}.png'))

# ---------- Carousel 1: How it works ----------
HOW = {
 'en': ('Swipe', [
  dict(kind='text', eyebrow='Step 1', title='Describe the job.', sub='Type it, paste it, or upload the plans.',
       cards=[('You type', 'Change the 100A panel to 200A in a 2,400 sq ft home in Aventura')]),
  dict(kind='text', eyebrow='Step 2', title='Answer a few questions.', sub='The ones that change the price.',
       cards=[('Panel location?', 'Indoor garage'), ('Straight swap or relocation?', 'Same location'), ('Permit included?', 'Yes'), ('Panel brand?', 'Siemens')]),
  dict(kind='table-total', eyebrow='Step 3', title='Get your bid.', rows=[('Direct costs', '$3,108.24'), ('Overhead (12%)', '$373.00'), ('Risk cushion (8%)', '$249.00'), ('Profit (22%)', '$821.00'), ('Bid range', '$4,187 – $4,915')],
       foot='Example job from a real run: 200A panel upgrade, Aventura, FL. Oct 7, 2026.'),
  dict(kind='text', eyebrow='Step 4', title='Send the proposal.', sub='Your client gets a clean proposal. You keep the cost sheet.',
       cards=[('Client proposal', '$4,550'), ('Cost sheet', 'Only you see it')]),
  dict(kind='cta', title='Try it on your next bid.', sub='3 free estimates. No credit card.', cta='even-os.com'),
 ]),
 'es': ('Desliza', [
  dict(kind='text', eyebrow='Paso 1', title='Describe el trabajo.', sub='Escríbelo, pégalo o sube los planos.',
       cards=[('Tú escribes', 'Cambiar el panel de 100A a 200A en una casa de 2,400 pies² en Aventura')]),
  dict(kind='text', eyebrow='Paso 2', title='Responde unas preguntas.', sub='Las que cambian el precio.',
       cards=[('¿Ubicación del panel?', 'Garaje interior'), ('¿Cambio directo o reubicación?', 'Misma ubicación'), ('¿Incluye permiso?', 'Sí'), ('¿Marca del panel?', 'Siemens')]),
  dict(kind='table-total', eyebrow='Paso 3', title='Recibe tu oferta.', rows=[('Costos directos', '$3,108.24'), ('Gastos (12%)', '$373.00'), ('Colchón (8%)', '$249.00'), ('Ganancia (22%)', '$821.00'), ('Rango de oferta', '$4,187 – $4,915')],
       foot='Trabajo de ejemplo de una corrida real: cambio de panel 200A, Aventura, FL. 7 oct 2026.'),
  dict(kind='text', eyebrow='Paso 4', title='Envía la propuesta.', sub='Tu cliente recibe una propuesta limpia. Tú guardas la hoja de costos.',
       cards=[('Propuesta al cliente', '$4,550'), ('Hoja de costos', 'Solo tú la ves')]),
  dict(kind='cta', title='Pruébalo en tu próximo presupuesto.', sub='3 estimados gratis. Sin tarjeta de crédito.', cta='even-os.com'),
 ]),
}

# ---------- Carousel 2: where every number comes from ----------
PROOF = {
 'en': ('Swipe', [
  dict(kind='text', title='What does a 200A panel upgrade cost in Aventura?', sub='One real job. Every number, with where it came from.'),
  dict(kind='text', eyebrow='Permit', title='City of Aventura', big='$162.50', sub='Building permit (minimum), from the city fee schedule effective July 8, 2026.'),
  dict(kind='text', eyebrow='Labor', title='20 hours', big='$1,159.08', sub='Built from BLS wage data for the Miami metro (May 2025) and your own multiplier.'),
  dict(kind='text', eyebrow='Materials', title='Panel, surge protector, wire', big='$1,736.66', sub='Published supplier prices, with the source on every line.'),
  dict(kind='table-total', eyebrow='Your numbers', title='You set the margins.', rows=[('Overhead', '12%'), ('Risk cushion', '8%'), ('Profit', '22%'), ('Your bid', '$4,550')]),
  dict(kind='cta', title='Check the math on your next bid.', sub='3 free estimates. No credit card.', cta='even-os.com'),
 ]),
 'es': ('Desliza', [
  dict(kind='text', title='¿Cuánto cuesta cambiar un panel a 200A en Aventura?', sub='Un trabajo real. Cada número, con su fuente.'),
  dict(kind='text', eyebrow='Permiso', title='Ciudad de Aventura', big='$162.50', sub='Permiso de construcción (mínimo), de la tarifa de la ciudad vigente desde el 8 de julio de 2026.'),
  dict(kind='text', eyebrow='Mano de obra', title='20 horas', big='$1,159.08', sub='Calculada con salarios de BLS del área de Miami (mayo 2025) y tu propio multiplicador.'),
  dict(kind='text', eyebrow='Materiales', title='Panel, protector, cable', big='$1,736.66', sub='Precios publicados de proveedores, con la fuente en cada línea.'),
  dict(kind='table-total', eyebrow='Tus números', title='Tú pones los márgenes.', rows=[('Gastos', '12%'), ('Colchón de riesgo', '8%'), ('Ganancia', '22%'), ('Tu oferta', '$4,550')]),
  dict(kind='cta', title='Revisa las cuentas en tu próximo presupuesto.', sub='3 estimados gratis. Sin tarjeta de crédito.', cta='even-os.com'),
 ]),
}

for lang in ('en', 'es'):
    build('how-it-works', lang, HOW[lang][1], HOW[lang][0])
    build('where-numbers-come-from', lang, PROOF[lang][1], PROOF[lang][0])
print('done')
