import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import {
  VB, P, pts, path, rectPlan, silhouette,
  GOLD, GOLD_HI, BG, EASE, HEAVY,
  SLAB, FOOT, FOOT_Z, SLAB_Z, Volume,
  SILL_Z, STUD_Z, PLATE_Z, WALL_X, WALL_Y, studRight, studLeft,
  RIGHT_PANEL, LEFT_PANEL, PANEL_Z,
} from '../house/camera'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · STAGE 04 · FINISH

   Fourth and final stage of the house-construction metaphor. Finish is
   the polished, delivered product itself — the roof that makes a
   structure a house, the trim and light that make it livable. In Even's
   terms: the fast, clean, professional output the contractor actually
   sends. Same job as every stage before it — foundation data, framing
   logic, wall outputs — now finished and ready.

   Opens on the completed walls from stage 03, held static and using
   their exact geometry (RIGHT_PANEL/LEFT_PANEL/PANEL_Z from
   ../house/camera), then a gable roof rises to cap it — the one piece
   of geometry in the sequence that isn't a straight extrusion, built by
   animating the ridge height rather than a zt. Same camera rig — see
   camera.jsx.

   No technical callouts this time. Stages 01–03 narrowed from four
   inputs to four cost categories to two outputs; stage 04 has nothing
   left to annotate — the finished thing speaks for itself. It closes
   on the actual brand statement instead: the payoff of the whole
   4-part metaphor.

   PACING
     Same discipline as every stage before it: the roof lifts into its
     peak on a long decelerating ease and settles with weight, gold
     traces the ridge and eaves once it's standing, then the house holds
     before giving way to the brand.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── ROOF — a simple gable, ridge running the long (x) axis. Eave
   footprint reuses FOOT exactly: what overhangs above lines up with
   what's poured below. Only the near slope (facing y1) and the near
   gable end (facing x1) are visible from this camera, same rule that
   gives Volume() its two visible side faces. ─────────────────────── */
const RIDGE_Z_FULL = PLATE_Z[1] + 58   // 237

const nearSlope = ridgeZ => [
  [FOOT.x0, 0, ridgeZ], [FOOT.x1, 0, ridgeZ],
  [FOOT.x1, FOOT.y1, PLATE_Z[1]], [FOOT.x0, FOOT.y1, PLATE_Z[1]],
]
const gableEnd = ridgeZ => [
  [FOOT.x1, FOOT.y0, PLATE_Z[1]], [FOOT.x1, FOOT.y1, PLATE_Z[1]], [FOOT.x1, 0, ridgeZ],
]

const BATTEN_T = [0.2, 0.4, 0.6, 0.8]   // fractional position along the slope, ridge → eave

/* Two small lit windows on the proposal wall — the finish detail that
   says the space is occupied, ready, alive. */
const WINDOWS = [
  { y0: -95, y1: -40, z0: 88, z1: 128 },
  { y0: 40, y1: 95, z0: 88, z1: 128 },
]

/* ── TIMELINE (ms) ────────────────────────────────────────────────────── */
const T = {
  eyebrow: 300,
  base:    400,
  cap1:    2200,
  roof:    2800,
  settle:  6500,
  cap2:    6900,
  windows: 8200,
  cap3:    8600,
  trace:   9600,
  cap4:    10600,
  end:     14500,
  logo:    16500,
  loop:    21500,
}

const ROOF_S = 3.2

const CAPTIONS = [
  { eyebrow: 'Trim',    line: 'Every piece, exactly measured.' },
  { eyebrow: 'Coat',    line: 'Nothing left half-finished.' },
  { eyebrow: 'Ready',   line: 'An estimate, not a rough guess.' },
  { eyebrow: 'Minutes', line: 'Under two minutes, start to send.' },
]

/* ── SCENE ────────────────────────────────────────────────────────────── */

export default function Finish() {
  const [cycle,   setCycle]   = useState(0)
  const [base,    setBase]    = useState(false)   // stages 01–03, held
  const [roofP,   setRoofP]   = useState(0)
  const [impact,  setImpact]  = useState(false)
  const [windows, setWindows] = useState(false)
  const [trace,   setTrace]   = useState(false)
  const [end,     setEnd]     = useState(false)
  const [logo,    setLogo]    = useState(false)
  const [eyebrow, setEyebrow] = useState(false)
  const [cap,     setCap]     = useState(-1)

  const timers = useRef([])
  const anims  = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = []
    anims.current.forEach(a => a.stop && a.stop()); anims.current = []
    setBase(false); setRoofP(0); setImpact(false)
    setWindows(false); setTrace(false)
    setEnd(false); setLogo(false); setEyebrow(false); setCap(-1)
  }

  function run() {
    reset()
    setCycle(c => c + 1)
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    at(T.eyebrow, () => setEyebrow(true))
    at(T.base,    () => setBase(true))
    at(T.cap1,    () => setCap(0))
    at(T.roof,    () => anims.current.push(
      animate(0, 1, { duration: ROOF_S, ease: HEAVY, onUpdate: setRoofP })))
    at(T.settle,  () => setImpact(true))
    at(T.cap2,    () => setCap(1))
    at(T.windows, () => setWindows(true))
    at(T.cap3,    () => setCap(2))
    at(T.trace,   () => setTrace(true))
    at(T.cap4,    () => setCap(3))
    at(T.end,     () => { setEnd(true); setCap(-1) })
    at(T.logo,    () => setLogo(true))
    at(T.loop,    run)
  }

  useEffect(() => {
    run()
    return () => {
      timers.current.forEach(clearTimeout)
      anims.current.forEach(a => a.stop && a.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ridgeZ = PLATE_Z[1] + (RIDGE_Z_FULL - PLATE_Z[1]) * roofP
  const slope  = nearSlope(ridgeZ)
  const gable  = gableEnd(ridgeZ)

  const progress = end ? 1 : cap >= 0 ? (cap + 1) / (CAPTIONS.length + 1) : 0

  return (
    <div style={{
      width: '100vw', height: '100vh', background: BG, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        position: 'relative',
        width:  'min(100vw, 177.78vh)',
        height: 'min(56.25vw, 100vh)',
        fontSize: 'calc(min(100vw, 177.78vh) / 100)',
      }}>

        {/* ── progress ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0.17em', background: 'rgba(255,255,255,0.05)', zIndex: 6 }}>
          <motion.div
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{ height: '100%', background: GOLD, boxShadow: `0 0 0.8em ${GOLD}` }}
          />
        </div>

        {/* ── camera: continues stage 03's push-in, kept gentle here so the
             roof peak — the tallest point in the whole sequence — clears
             the chrome ── */}
        <motion.div
          key={cycle}
          initial={{ scale: 1.15, y: '-2.4%' }}
          animate={{ scale: 1.19, y: '-2.6%' }}
          transition={{ duration: T.loop / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* roof landing */}
          <motion.div
            animate={impact ? { y: [0, 4, -1.8, 0.7, 0] } : { y: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut', times: [0, 0.16, 0.4, 0.68, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
              <defs>
                {/* concrete — stage 01 */}
                <linearGradient id="f-top-slab" x1="0.15" y1="0" x2="0.75" y2="1">
                  <stop offset="0%"   stopColor="#26231c" />
                  <stop offset="48%"  stopColor="#1b1915" />
                  <stop offset="100%" stopColor="#141210" />
                </linearGradient>
                <linearGradient id="f-left-slab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#131110" />
                  <stop offset="100%" stopColor="#070707" />
                </linearGradient>
                <linearGradient id="f-right-slab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1d1a15" />
                  <stop offset="100%" stopColor="#0b0a09" />
                </linearGradient>
                <linearGradient id="f-top-foot" x1="0.15" y1="0" x2="0.75" y2="1">
                  <stop offset="0%"   stopColor="#1c1a15" />
                  <stop offset="100%" stopColor="#111010" />
                </linearGradient>
                <linearGradient id="f-left-foot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0e0d0c" />
                  <stop offset="100%" stopColor="#050505" />
                </linearGradient>
                <linearGradient id="f-right-foot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#151310" />
                  <stop offset="100%" stopColor="#080807" />
                </linearGradient>

                {/* framing lumber — stage 02 */}
                <linearGradient id="f-top-wood" x1="0.15" y1="0" x2="0.75" y2="1">
                  <stop offset="0%"   stopColor="#2f2413" />
                  <stop offset="48%"  stopColor="#1f1810" />
                  <stop offset="100%" stopColor="#130f09" />
                </linearGradient>
                <linearGradient id="f-left-wood" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#17110a" />
                  <stop offset="100%" stopColor="#0a0705" />
                </linearGradient>
                <linearGradient id="f-right-wood" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#241a0d" />
                  <stop offset="100%" stopColor="#0d0a06" />
                </linearGradient>

                {/* walls — stage 03 */}
                <linearGradient id="f-top-proposal" x1="0.15" y1="0" x2="0.75" y2="1">
                  <stop offset="0%"   stopColor="#3c3220" />
                  <stop offset="48%"  stopColor="#2a2415" />
                  <stop offset="100%" stopColor="#1b160d" />
                </linearGradient>
                <linearGradient id="f-left-proposal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#211b10" />
                  <stop offset="100%" stopColor="#110d07" />
                </linearGradient>
                <linearGradient id="f-right-proposal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#332a17" />
                  <stop offset="100%" stopColor="#16110a" />
                </linearGradient>
                <linearGradient id="f-top-internal" x1="0.15" y1="0" x2="0.75" y2="1">
                  <stop offset="0%"   stopColor="#201f23" />
                  <stop offset="48%"  stopColor="#17161a" />
                  <stop offset="100%" stopColor="#0e0d10" />
                </linearGradient>
                <linearGradient id="f-left-internal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#121114" />
                  <stop offset="100%" stopColor="#08080a" />
                </linearGradient>
                <linearGradient id="f-right-internal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1a1a1f" />
                  <stop offset="100%" stopColor="#0c0c0e" />
                </linearGradient>

                {/* roof — the hero surface of the finale, richest tone in the piece */}
                <linearGradient id="roofSlope" x1="0.2" y1="0" x2="0.7" y2="1">
                  <stop offset="0%"   stopColor="#4a3c1f" />
                  <stop offset="45%"  stopColor="#332913" />
                  <stop offset="100%" stopColor="#1d1810" />
                </linearGradient>
                <linearGradient id="roofGable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2a2211" />
                  <stop offset="100%" stopColor="#14100a" />
                </linearGradient>
                <radialGradient id="windowGlow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%"   stopColor="#ffd98a" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#ffb347" stopOpacity="0.15" />
                </radialGradient>

                <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glowSoft" x="-90%" y="-90%" width="280%" height="280%">
                  <feGaussianBlur stdDeviation="11" />
                </filter>
                <filter id="glowWarm" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
                <filter id="grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>

                <clipPath id="slabClip">
                  <polygon points={pts(silhouette(SLAB, SLAB_Z[0], SLAB_Z[1]))} />
                </clipPath>
              </defs>

              {/* ── STAGES 01–03, HELD: the completed house this stage roofs ── */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: base ? 1 : 0 }}
                transition={{ duration: 1.3, ease: 'easeOut' }}
              >
                <Volume r={FOOT} zb={FOOT_Z[0]} zt={FOOT_Z[1]} tone="foot" />
                <Volume r={SLAB} zb={SLAB_Z[0]} zt={SLAB_Z[1]} tone="slab" />
                <g clipPath="url(#slabClip)">
                  <rect x="0" y="0" width={VB.w} height={VB.h}
                    filter="url(#grain)" opacity="0.11" style={{ mixBlendMode: 'overlay' }} />
                </g>
                <Volume r={SLAB} zb={SILL_Z[0]} zt={SILL_Z[1]} tone="wood" />
                {WALL_Y.map(y => <Volume key={`sr${y}`} r={studRight(y)} zb={STUD_Z[0]} zt={STUD_Z[1]} tone="wood" />)}
                {WALL_X.map(x => <Volume key={`sl${x}`} r={studLeft(x)} zb={STUD_Z[0]} zt={STUD_Z[1]} tone="wood" />)}
                <Volume r={SLAB} zb={PLATE_Z[0]} zt={PLATE_Z[1]} tone="wood" />
                <Volume r={RIGHT_PANEL} zb={PANEL_Z[0]} zt={PANEL_Z[1]} tone="proposal" />
                <Volume r={LEFT_PANEL}  zb={PANEL_Z[0]} zt={PANEL_Z[1]} tone="internal" />
                <line
                  x1={P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[1])[0]} y1={P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[1])[1]}
                  x2={P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[1])[0]} y2={P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[1])[1]}
                  stroke="#ff6b6b" strokeWidth="1.2" strokeOpacity="0.45"
                />
                <path d={path(rectPlan(SLAB, PLATE_Z[1]))} fill="none"
                  stroke={GOLD} strokeWidth="1.2" strokeOpacity="0.4" />
              </motion.g>

              {/* ── ROOF — rises into its peak ── */}
              {roofP > 0.02 && (
                <g>
                  <polygon points={pts(gable)} fill="url(#roofGable)" />
                  <polygon points={pts(slope)} fill="url(#roofSlope)" />
                  {/* seam between gable end and slope */}
                  <line
                    x1={P(FOOT.x1, 0, ridgeZ)[0]} y1={P(FOOT.x1, 0, ridgeZ)[1]}
                    x2={P(FOOT.x1, FOOT.y1, PLATE_Z[1])[0]} y2={P(FOOT.x1, FOOT.y1, PLATE_Z[1])[1]}
                    stroke="#000" strokeOpacity="0.5" strokeWidth="1"
                  />
                  {/* batten lines — a little material texture on the slope */}
                  {BATTEN_T.map((t, i) => {
                    const a = P(FOOT.x0 + (FOOT.x1 - FOOT.x0) * 0, 0 + (FOOT.y1 - 0) * t, ridgeZ + (PLATE_Z[1] - ridgeZ) * t)
                    const b = P(FOOT.x1, 0 + (FOOT.y1 - 0) * t, ridgeZ + (PLATE_Z[1] - ridgeZ) * t)
                    return (
                      <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                        stroke="#000" strokeOpacity="0.14" strokeWidth="0.8" />
                    )
                  })}
                </g>
              )}

              {/* ── WINDOWS — the finish detail: occupied, lit, ready ── */}
              <AnimatePresence>
                {windows && WINDOWS.map((w, i) => {
                  const c0 = P(RIGHT_PANEL.x1, w.y0, w.z0)
                  const c1 = P(RIGHT_PANEL.x1, w.y1, w.z1)
                  const cx = (c0[0] + c1[0]) / 2, cy = (c0[1] + c1[1]) / 2
                  return (
                    <motion.g key={`w${i}`}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 1.1, delay: i * 0.3, ease: 'easeOut' }}
                    >
                      <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="1"
                        fill="url(#windowGlow)" filter="url(#glowWarm)" />
                      <rect x={cx - 13} y={cy - 9} width="26" height="18"
                        fill="none" stroke="#3a2f18" strokeWidth="1.2" strokeOpacity="0.6" />
                    </motion.g>
                  )
                })}
              </AnimatePresence>

              {/* ── SET: gold traces the ridge and eave once standing ── */}
              <g>
                <motion.path
                  d={`M${P(FOOT.x0, 0, RIDGE_Z_FULL).join(',')} L${P(FOOT.x1, 0, RIDGE_Z_FULL).join(',')}`}
                  fill="none" stroke={GOLD_HI} strokeWidth="1.8" strokeOpacity="0.95" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.4, ease: EASE }}
                />
                <motion.path
                  d={`M${P(FOOT.x0, FOOT.y1, PLATE_Z[1]).join(',')} L${P(FOOT.x1, FOOT.y1, PLATE_Z[1]).join(',')}`}
                  fill="none" stroke={GOLD} strokeWidth="1.3" strokeOpacity="0.7" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.4, delay: 0.4, ease: EASE }}
                />
                <motion.path
                  d={`M${P(FOOT.x1, FOOT.y0, PLATE_Z[1]).join(',')} L${P(FOOT.x1, 0, RIDGE_Z_FULL).join(',')} L${P(FOOT.x1, FOOT.y1, PLATE_Z[1]).join(',')}`}
                  fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.45"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.3, delay: 0.8, ease: EASE }}
                />
              </g>

              {/* ── settle: displaced dust at the roof's landing ── */}
              <AnimatePresence>
                {impact && (
                  <motion.ellipse key="dust"
                    cx={P(0, 0, 0)[0]} cy={P(0, 0, 0)[1] + 8}
                    initial={{ rx: 200, ry: 88, opacity: 0.35 }}
                    animate={{ rx: 420, ry: 182, opacity: 0 }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                    fill="none" stroke={GOLD} strokeWidth="1.4" filter="url(#glowSoft)"
                  />
                )}
              </AnimatePresence>
            </svg>
          </motion.div>
        </motion.div>

        {/* ── bloom on the hold — warmest, widest of the sequence ── */}
        <motion.div
          animate={{ opacity: end ? 1 : 0 }}
          transition={{ duration: 2.8, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 62% 50% at 50% 34%, rgba(212,175,55,0.14) 0%, transparent 72%)',
          }}
        />

        {/* ── SERIES CHROME ── */}
        <AnimatePresence>
          {eyebrow && (
            <motion.div key="chrome"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: EASE }}
              style={{ position: 'absolute', top: '4.4%', left: '4%', right: '4%', display: 'flex', justifyContent: 'space-between' }}
            >
              <div style={{ color: 'rgba(255,255,255,0.26)', fontSize: '0.82em', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 600 }}>
                Even
              </div>
              <div style={{ color: GOLD, fontSize: '0.82em', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 700, textShadow: `0 0 1.2em rgba(212,175,55,0.45)` }}>
                Stage 04 / 04 — Finish
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CAPTION BAND ── */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '5%', height: '13%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6%' }}>
          <AnimatePresence mode="wait">
            {cap >= 0 && !end && (
              <motion.div key={`cap${cap}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
                transition={{ duration: 0.75, ease: EASE }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ color: GOLD, fontSize: '0.85em', letterSpacing: '0.5em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.8em' }}>
                  {CAPTIONS[cap].eyebrow}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.86)', fontSize: '1.9em', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
                  {CAPTIONS[cap].line}
                </div>
              </motion.div>
            )}

            {end && (
              <motion.div key="end"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: EASE }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ color: '#fff', fontSize: '2.7em', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  This is Even.
                </div>
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
                  style={{ height: '1px', width: '3.4em', background: 'rgba(212,175,55,0.5)', margin: '0.8em auto', transformOrigin: 'center' }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
                  style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.05em', fontWeight: 400, letterSpacing: '0.02em' }}
                >
                  You run the business. We run the numbers.
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── LOCKUP ── */}
        <AnimatePresence>
          {logo && (
            <motion.div key="logo"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.3 }}
              style={{ position: 'absolute', bottom: '2.4%', left: '4%', right: '4%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9em' }}>
                <img src="/logo.png" alt="Even" style={{ height: '1.5em', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                <span style={{ color: GOLD, fontSize: '0.72em', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 700 }}>
                  even-os.com
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '0.72em', letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 600 }}>
                Foundation → Finish
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── vignette ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 88% 84% at 50% 48%, transparent 34%, rgba(8,8,8,0.55) 72%, #080808 100%)',
        }} />
      </div>
    </div>
  )
}
