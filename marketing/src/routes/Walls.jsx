import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import {
  VB, P, pts, path, rectPlan, silhouette,
  GOLD, GOLD_HI, BG, EASE, HEAVY, ORIGIN,
  SLAB, FOOT, FOOT_Z, SLAB_Z, Volume,
  SILL_Z, STUD_Z, PLATE_Z, WALL_X, WALL_Y, studRight, studLeft,
} from '../house/camera'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · STAGE 03 · WALLS

   Third stage of the house-construction metaphor. Walls are Even's two
   outputs: the exact same underlying numbers (stages 01–02), enclosed
   into two faces of the same job. The right wall — the one that catches
   the light — is the client proposal: clean, final, theirs to sign. The
   left wall is the internal cost sheet: every margin, every rate, yours
   alone. Same studs behind both. Different face.

   Opens on the completed frame from stage 02, held static and using its
   exact geometry (SLAB/FOOT/SILL_Z/STUD_Z/PLATE_Z from ../house/camera),
   then the two sheathed wall faces rise together and cover the open stud
   bays. Same camera rig, same composition contract — see camera.jsx.

   PACING
     One coordinated rise this time, not several — enclosure is fast once
     the frame exists. Both panels lift together, settle with weight,
     then gold traces the two faces once they're standing.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── WALL PANELS — sheathe the two visible stud bays from stage 02.
   Same footprint discipline as the sill/plate: a thin box whose outward
   face (Volume's "right" face for the x1 wall, "left" face for the y1
   wall) is the one broad surface the camera actually sees. ──────────── */
const RIGHT_PANEL = { x0: SLAB.x1 - 6, x1: SLAB.x1 + 6, y0: SLAB.y0, y1: SLAB.y1 }
const LEFT_PANEL  = { x0: SLAB.x0, x1: SLAB.x1, y0: SLAB.y1 - 6, y1: SLAB.y1 + 6 }
const PANEL_Z = [SLAB_Z[1], PLATE_Z[1]]   // [60, 179] — full wall height

/* ── TIMELINE (ms) ────────────────────────────────────────────────────── */
const T = {
  eyebrow:      300,
  base:         400,
  cap1:         2000,
  panels:       2600,
  settle:       6200,
  cap2:         6600,
  confidential: 8200,
  cap3:         8600,
  trace:        9600,
  cap4:         10000,
  nodes:        12200,
  end:          15800,
  logo:         17600,
  loop:         22800,
}

const PANEL_S = 3.2

const CAPTIONS = [
  { eyebrow: 'Enclosure', line: 'Every estimate has two sides.' },
  { eyebrow: 'One Face',  line: 'A proposal your client signs.' },
  { eyebrow: 'The Other', line: 'A cost sheet only you see.' },
  { eyebrow: 'Same Job',  line: 'Built from the exact same numbers.' },
]

const CALLOUTS = [
  { k: 'proposal', plan: [SLAB.x1, 0], z: 122, elbow: [820, 300], end: [900, 300], anchor: 'start',
    label: 'CLIENT PROPOSAL', sub: 'Clean, final, theirs to sign.', tag: null },
  { k: 'internal',  plan: [0, SLAB.y1], z: 122, elbow: [380, 400], end: [280, 400], anchor: 'end',
    label: 'INTERNAL SHEET', sub: 'Every margin. Yours alone.', tag: 'CONFIDENTIAL' },
]

const JOIST_X = [-152, -76, 0, 76, 152]

/* ── SCENE ────────────────────────────────────────────────────────────── */

export default function Walls() {
  const [cycle,   setCycle]   = useState(0)
  const [base,    setBase]    = useState(false)   // stage-01 + stage-02, held
  const [panelP,  setPanelP]  = useState(0)
  const [impact,  setImpact]  = useState(false)
  const [confidential, setConfidential] = useState(false)
  const [trace,   setTrace]   = useState(false)
  const [nodes,   setNodes]   = useState(false)
  const [end,     setEnd]     = useState(false)
  const [logo,    setLogo]    = useState(false)
  const [eyebrow, setEyebrow] = useState(false)
  const [cap,     setCap]     = useState(-1)

  const timers = useRef([])
  const anims  = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = []
    anims.current.forEach(a => a.stop && a.stop()); anims.current = []
    setBase(false); setPanelP(0); setImpact(false)
    setConfidential(false); setTrace(false); setNodes(false)
    setEnd(false); setLogo(false); setEyebrow(false); setCap(-1)
  }

  function run() {
    reset()
    setCycle(c => c + 1)
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    at(T.eyebrow,      () => setEyebrow(true))
    at(T.base,         () => setBase(true))
    at(T.cap1,         () => setCap(0))
    at(T.panels,       () => anims.current.push(
      animate(0, 1, { duration: PANEL_S, ease: HEAVY, onUpdate: setPanelP })))
    at(T.settle,       () => setImpact(true))
    at(T.cap2,         () => setCap(1))
    at(T.confidential, () => setConfidential(true))
    at(T.cap3,         () => setCap(2))
    at(T.trace,        () => setTrace(true))
    at(T.cap4,         () => setCap(3))
    at(T.nodes,        () => setNodes(true))
    at(T.end,          () => { setEnd(true); setCap(-1) })
    at(T.logo,         () => setLogo(true))
    at(T.loop,         run)
  }

  useEffect(() => {
    run()
    return () => {
      timers.current.forEach(clearTimeout)
      anims.current.forEach(a => a.stop && a.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const panelZt = PANEL_Z[0] + (PANEL_Z[1] - PANEL_Z[0]) * panelP

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

        {/* ── camera: continues stage 02's push-in ── */}
        <motion.div
          key={cycle}
          initial={{ scale: 1.09, y: '-1.6%' }}
          animate={{ scale: 1.15, y: '-2.4%' }}
          transition={{ duration: T.loop / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* wall panels landing */}
          <motion.div
            animate={impact ? { y: [0, 4.5, -2, 0.8, 0] } : { y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.16, 0.4, 0.68, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
              <defs>
                {/* concrete — carried over from stage 01 */}
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

                {/* framing lumber — carried over from stage 02 */}
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

                {/* proposal wall — lighter, warmer, presentable */}
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

                {/* internal wall — cooler, darker, technical */}
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

                <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glowSoft" x="-90%" y="-90%" width="280%" height="280%">
                  <feGaussianBlur stdDeviation="11" />
                </filter>
                <filter id="glowRed" x="-90%" y="-90%" width="280%" height="280%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>

                <clipPath id="slabClip">
                  <polygon points={pts(silhouette(SLAB, SLAB_Z[0], SLAB_Z[1]))} />
                </clipPath>
              </defs>

              {/* ── STAGE 01 + 02, HELD: the completed frame this stage encloses ── */}
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

                <path d={path(rectPlan(FOOT, FOOT_Z[1]))} fill="none"
                  stroke={GOLD} strokeWidth="1" strokeOpacity="0.22" />

                {/* held frame from stage 02 */}
                <Volume r={SLAB} zb={SILL_Z[0]} zt={SILL_Z[1]} tone="wood" />
                {WALL_Y.map(y => <Volume key={`sr${y}`} r={studRight(y)} zb={STUD_Z[0]} zt={STUD_Z[1]} tone="wood" />)}
                {WALL_X.map(x => <Volume key={`sl${x}`} r={studLeft(x)} zb={STUD_Z[0]} zt={STUD_Z[1]} tone="wood" />)}
                <g>
                  {JOIST_X.map(x => (
                    <line key={`j${x}`}
                      x1={P(x, SLAB.y0 + 6, STUD_Z[1])[0]} y1={P(x, SLAB.y0 + 6, STUD_Z[1])[1]}
                      x2={P(x, SLAB.y1 - 6, STUD_Z[1])[0]} y2={P(x, SLAB.y1 - 6, STUD_Z[1])[1]}
                      stroke={GOLD} strokeWidth="1" strokeOpacity="0.22"
                    />
                  ))}
                </g>
                <Volume r={SLAB} zb={PLATE_Z[0]} zt={PLATE_Z[1]} tone="wood" />

                {/* held gold trace from stage 02 */}
                <path d={path(rectPlan(SLAB, PLATE_Z[1]))} fill="none"
                  stroke={GOLD} strokeWidth="1.3" strokeOpacity="0.5" filter="url(#glow)" />
              </motion.g>

              {/* ── WALL PANELS — enclose the frame, rise together ── */}
              <Volume r={RIGHT_PANEL} zb={PANEL_Z[0]} zt={panelZt} tone="proposal" />
              <Volume r={LEFT_PANEL}  zb={PANEL_Z[0]} zt={panelZt} tone="internal" />

              {/* confidential accent — the internal wall reads differently */}
              <AnimatePresence>
                {confidential && (
                  <motion.g key="conf"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  >
                    <line
                      x1={P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[1])[0]} y1={P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[1])[1]}
                      x2={P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[1])[0]} y2={P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[1])[1]}
                      stroke="#ff6b6b" strokeWidth="1.4" strokeOpacity="0.65" filter="url(#glowRed)"
                    />
                  </motion.g>
                )}
              </AnimatePresence>

              {/* ── SET: gold light traces both wall faces once standing ── */}
              <g>
                <motion.path
                  d={`M${P(RIGHT_PANEL.x1, RIGHT_PANEL.y0, PANEL_Z[1]).join(',')} L${P(RIGHT_PANEL.x1, RIGHT_PANEL.y1, PANEL_Z[1]).join(',')} L${P(RIGHT_PANEL.x1, RIGHT_PANEL.y1, PANEL_Z[0]).join(',')} L${P(RIGHT_PANEL.x1, RIGHT_PANEL.y0, PANEL_Z[0]).join(',')} Z`}
                  fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.85" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.8, ease: EASE }}
                />
                <motion.path
                  d={`M${P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[1]).join(',')} L${P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[1]).join(',')} L${P(LEFT_PANEL.x1, LEFT_PANEL.y1, PANEL_Z[0]).join(',')} L${P(LEFT_PANEL.x0, LEFT_PANEL.y1, PANEL_Z[0]).join(',')} Z`}
                  fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.85" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.8, delay: 0.35, ease: EASE }}
                />
                <motion.path
                  d={path(rectPlan(SLAB, PLATE_Z[1]))}
                  fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 2, delay: 0.7, ease: EASE }}
                />
              </g>

              {/* ── CALLOUTS ── */}
              {CALLOUTS.map((c, i) => {
                const n = P(c.plan[0], c.plan[1], c.z)
                const d = `M${n[0]},${n[1]} L${c.elbow[0]},${c.elbow[1]} L${c.end[0]},${c.end[1]}`
                const tx = c.anchor === 'end' ? c.end[0] - 9 : c.end[0] + 9
                return (
                  <g key={c.k}>
                    <motion.path
                      d={d} fill="none" stroke={GOLD} strokeWidth="0.9" strokeOpacity="0.55"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: nodes ? 1 : 0 }}
                      transition={{ duration: 0.85, delay: nodes ? i * 0.3 : 0, ease: EASE }}
                    />
                    <motion.g
                      initial={{ opacity: 0 }}
                      animate={{ opacity: nodes ? 1 : 0 }}
                      transition={{ duration: 0.6, delay: nodes ? i * 0.3 : 0 }}
                    >
                      <circle cx={n[0]} cy={n[1]} r="7" fill={GOLD} opacity="0.16" filter="url(#glowSoft)" />
                      <circle cx={n[0]} cy={n[1]} r="2.6" fill={GOLD_HI} filter="url(#glow)" />
                    </motion.g>
                    <motion.g
                      initial={{ opacity: 0, x: c.anchor === 'end' ? 8 : -8 }}
                      animate={{ opacity: nodes ? 1 : 0, x: nodes ? 0 : (c.anchor === 'end' ? 8 : -8) }}
                      transition={{ duration: 0.7, delay: nodes ? 0.5 + i * 0.3 : 0, ease: EASE }}
                    >
                      {c.tag && (
                        <text x={tx} y={c.end[1] - 15} textAnchor={c.anchor} fill="#ff6b6b"
                          style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', fontFamily: 'Inter, sans-serif' }}>
                          {c.tag}
                        </text>
                      )}
                      <text x={tx} y={c.end[1] + 1} textAnchor={c.anchor} fill={GOLD}
                        style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.16em', fontFamily: 'Inter, sans-serif' }}>
                        {c.label}
                      </text>
                      <text x={tx} y={c.end[1] + 16} textAnchor={c.anchor} fill="#fff" fillOpacity="0.32"
                        style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.09em', fontFamily: 'Inter, sans-serif' }}>
                        {c.sub}
                      </text>
                    </motion.g>
                  </g>
                )
              })}

              {/* ── settle: displaced dust at the panels' landing ── */}
              <AnimatePresence>
                {impact && (
                  <motion.ellipse key="dust"
                    cx={ORIGIN.x} cy={ORIGIN.y + 8}
                    initial={{ rx: 210, ry: 92, opacity: 0.4 }}
                    animate={{ rx: 440, ry: 190, opacity: 0 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    fill="none" stroke={GOLD} strokeWidth="1.6" filter="url(#glowSoft)"
                  />
                )}
              </AnimatePresence>
            </svg>
          </motion.div>
        </motion.div>

        {/* ── bloom on the hold ── */}
        <motion.div
          animate={{ opacity: end ? 1 : 0 }}
          transition={{ duration: 2.6, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 58% 44% at 50% 40%, rgba(212,175,55,0.11) 0%, transparent 70%)',
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
                Stage 03 / 04 — Walls
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
                <div style={{ color: '#fff', fontSize: '2.5em', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  The walls are the two outputs.
                </div>
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
                  style={{ height: '1px', width: '3.4em', background: 'rgba(212,175,55,0.5)', margin: '0.8em auto', transformOrigin: 'center' }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
                  style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.98em', fontWeight: 400, letterSpacing: '0.03em' }}
                >
                  One client-facing. One yours alone. Both accurate.
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
                Next — Finish
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
