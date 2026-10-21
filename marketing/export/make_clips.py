"""App-first clips: cut real Even screen recording into step clips with brand frame + callouts. 1080x1920, 30fps, silent.
Usage: make_clips.py <src.mp4> <outdir>. Source = screen recording of the real 200A Aventura run (Oct 6-7 2026)."""
import sys, os, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920
BG=(8,8,8); GOLD=(212,175,55); WHITE=(255,255,255); GRAY=(150,150,150)
F=lambda w,s: ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf'%w,s)
PW, PH = 690, 1500; PX, PY = (W-PW)//2, 300; K = PW/1206  # source px -> output px
logo=Image.open('/home/user/Even/marketing/public/logo.png').convert('RGBA')

def bg():
    img=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(img); t=math.tan(math.radians(60)); sp=46
    for off in range(-int(H/t)-sp,W+sp,sp):
        d.line((off,0,off+H/t,H),fill=(24,20,8),width=1); d.line((off+H/t,0,off,H),fill=(24,20,8),width=1)
    vig=Image.new('L',(W,H),0); ImageDraw.Draw(vig).ellipse((-250,-150,W+250,H+150),fill=255); vig=vig.filter(ImageFilter.GaussianBlur(260))
    a=np.asarray(img,dtype=np.float32)*(np.asarray(vig,dtype=np.float32)[...,None]/255*0.85+0.15)
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
BG_IMG=bg()

def frame_png(step, title, path):
    img=BG_IMG.copy(); d=ImageDraw.Draw(img)
    lg=logo.resize((int(logo.width*64/logo.height),64)); img.paste(lg,(60,70),lg)
    d.text((60+lg.width+16,76),'even.',font=F('Bold',52),fill=WHITE)
    s=step.upper(); f=F('SemiBold',34); d.text((W-60-d.textlength(s,font=f),92),s,font=f,fill=GOLD)
    tf=F('Bold',64); d.text((60,190),title,font=tf,fill=WHITE)
    # phone bezel
    d.rounded_rectangle((PX-8,PY-8,PX+PW+8,PY+PH+8),radius=44,outline=(70,58,20),width=4)
    cf=F('SemiBold',34); t='even-os.com'; d.text(((W-d.textlength(t,font=cf))/2,1838),t,font=cf,fill=GOLD)
    img.save(path)

def callout_png(box,label,path):
    x0,y0,x1,y1=box; X0,Y0,X1,Y1=PX+x0*K,PY+y0*K,PX+x1*K,PY+y1*K
    img=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rounded_rectangle((X0,Y0,X1,Y1),radius=22,outline=GOLD+(255,),width=7)
    f=F('Bold',40); tw=d.textlength(label,font=f); pw,ph=tw+56,76
    px=min(max(40,(X0+X1)/2-pw/2),W-40-pw)
    py=Y0-ph-18 if Y0-ph-18>PY+10 else Y1+18
    d.rounded_rectangle((px,py,px+pw,py+ph),radius=38,fill=GOLD+(255,))
    d.text((px+28,py+14),label,font=f,fill=(10,10,10,255))
    # pointer triangle
    cx=min(max(px+50,(X0+X1)/2),px+pw-50)
    if py<Y0: d.polygon([(cx-16,py+ph-2),(cx+16,py+ph-2),(cx,py+ph+22)],fill=GOLD+(255,))
    else: d.polygon([(cx-16,py+2),(cx+16,py+2),(cx,py-22)],fill=GOLD+(255,))
    img.save(path)

# clip: (id, step_en, step_es, title_en, title_es, segments[(a,b,speed)], callouts[(t0,t1,box,en,es)])
CLIPS=[
 ('1-describe','Step 1','Paso 1','Describe the job.','Describe el trabajo.',[(7,21,1.15)],
   [(0.3,5.2,(90,330,1110,1020),'Type it, paste it, or upload plans','Escríbelo, pégalo o sube planos'),(8.2,12.2,(90,480,1110,660),'Pick your city','Elige tu ciudad')]),
 ('2-margins','Step 2','Paso 2','You set the margins.','Tú pones los márgenes.',[(26,29.6,1.3),(30.0,30.05,1.0,4.0)],
   [(3.0,6.5,(40,1100,1160,1930),'Overhead, profit, risk: yours','Gastos, ganancia, riesgo: tuyos')]),
 ('3-questions','Step 3','Paso 3','Answer a few questions.','Responde unas preguntas.',[(44,66,2.1)],
   [(2.2,9.5,(40,640,1160,1040),'Only the ones that change the price','Solo las que cambian el precio')]),
 ('4-bid','Step 4','Paso 4','Get your bid.','Recibe tu oferta.',[(71,92,5.0),(96,121,1.9)],
   [(5.0,9.0,(90,900,1110,1530),'Every line, with its number','Cada línea, con su número'),(9.2,13.5,(160,1240,760,1480),'Your bid range','Tu rango de oferta'),(13.7,17.5,(40,560,1160,1060),'You set the final price','Tú pones el precio final')]),
 ('5-proposal','Step 5','Paso 5','Send the proposal.','Envía la propuesta.',[(123,131,1.3),(141.2,143.4,1.0),(150.65,150.7,1.0,4.6)],
   [(0.2,5.8,(30,150,1180,1000),'Cost sheet: only you see it','Hoja de costos: solo tú'),(6.3,8.2,(90,1140,1120,1730),'Two outputs, one tap each','Dos documentos, un toque'),(8.6,12.5,(90,1480,1150,1700),'Client proposal, clean price','Propuesta limpia para el cliente')]),
]
tmp=os.path.join(OUT,'_tmp'); os.makedirs(tmp,exist_ok=True)
for cid,sen,ses,ten,tes,segs,calls in CLIPS:
  for lang,step,title in (('en',sen,ten),('es',ses,tes)):
    base=os.path.join(tmp,f'{cid}-{lang}-frame.png'); frame_png(step,title,base)
    dur=lambda g:(g[3] if len(g)>3 else (g[1]-g[0])/g[2])
    total=sum(dur(g) for g in segs)
    inputs=['-loop','1','-t',f'{total:.2f}','-i',base,'-i',SRC]; fc=[]; labels=[]
    for i,g in enumerate(segs):
        a,b,sp=g[:3]
        extra=f',tpad=stop_mode=clone:stop_duration={g[3]}' if len(g)>3 else ''
        fc.append(f'[1:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{sp},fps=30{extra},scale={PW}:{PH}[s{i}]'); labels.append(f'[s{i}]')
    fc.append(''.join(labels)+f'concat=n={len(segs)}:v=1:a=0[ph]')
    fc.append(f'[0:v][ph]overlay={PX}:{PY}:shortest=0[b0]'); last='b0'
    for j,(t0,t1,box,len_en,len_es) in enumerate(calls):
        cp=os.path.join(tmp,f'{cid}-{lang}-c{j}.png'); callout_png(box,len_en if lang=='en' else len_es,cp)
        inputs+=['-loop','1','-t',f'{total:.2f}','-i',cp]
        n=2+j
        fc.append(f'[{n}:v]format=rgba,fade=t=in:st={t0}:d=0.3:alpha=1,fade=t=out:st={t1-0.3}:d=0.3:alpha=1[c{j}]')
        fc.append(f'[{last}][c{j}]overlay=0:0:shortest=0[b{j+1}]'); last=f'b{j+1}'
    out=os.path.join(OUT,f'even-{cid}-{lang}.mp4')
    cmd=['ffmpeg','-v','error','-y']+inputs+['-filter_complex',';'.join(fc),'-map',f'[{last}]','-t',f'{total:.2f}','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',out]
    subprocess.run(cmd,check=True); print(out,round(total,1))
