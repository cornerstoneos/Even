# Export routes to postable MP4 (9:16, 1080x1920)

Renders a route frame by frame with Playwright's paused fake clock (deterministic, no dropped frames),
then ffmpeg adds the voiceover and burns in captions (.ass files here).

```
npm run build && npx vite preview --port 4173 &
cd /some/scratch && npm i playwright@1.56
# args: route outDir seconds fps [sampleFrames] [startFrame endFrame]  (split ranges across workers)
node capture.mjs /explainer-es frames 49.4 30
ffmpeg -framerate 30 -i frames/f%05d.jpg -i ../public/es-voiceover.mp3 \
  -vf "ass=explainer-es.ass,format=yuv420p" -c:v libx264 -crf 18 -c:a aac -b:a 192k \
  -movflags +faststart -shortest even-explainer-es.mp4
```
Notes: Element.prototype.animate is removed so framer-motion animates on the fake clock; the clock must be
paused (pauseAt) or real screenshot time leaks in. Video t=0 = play tap = audio start.
Captions: Inter Bold in a dark box, no em dashes. Caption timing comes from a word-level transcript of the voice.
