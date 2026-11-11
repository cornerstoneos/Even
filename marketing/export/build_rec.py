import json,sys,subprocess,os
d=sys.argv[1]; fj=json.load(open(f'{d}/frames.json')); T0=fj['T0']; ts=fj['ts']
lines=[]
for i,t in enumerate(ts):
    dur=(ts[i+1]-t) if i+1<len(ts) else 0.5
    if i==0: dur=ts[1]-T0
    lines.append(f"file 'fr/{i:05d}.jpg'\nduration {max(dur,0.001):.4f}")
lines.append(f"file 'fr/{len(ts)-1:05d}.jpg'")
open(f'{d}/list.txt','w').write('\n'.join(lines))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',f'{d}/list.txt','-vf','fps=30,format=yuv420p','-c:v','libx264','-crf','17','-preset','fast',f'{d}/rec.mp4'],check=True)
print(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'{d}/rec.mp4']).decode().strip())
