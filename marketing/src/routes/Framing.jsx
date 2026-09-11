import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import {
  VB, P, pts, path, rectPlan, silhouette,
  GOLD, GOLD_HI, BG, EASE, HEAVY, ORIGIN,
  SLAB, FOOT, FOOT_Z, SLAB_Z, Volume,
} from '../house/camera'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · STAGE 02 · FRAMING

   Stage two of the multi-stage brand piece that builds a house as a
   metaphor for the construction of the Even product. Framing is Even's
   estimating engine: the cost-code structure — materials, labor, permits
   & fees, overhead — that turns the foundation's raw data into a real,
   load-bearing number. Same underlying data as stage 01, now organized
   into the shape an actual estimate takes.

   Opens on the completed foundation from stage 01, held static and using
   its exact geometry (SLAB/FOOT from ../house/camera), then builds the
   frame upward into the volume that stage left empty above it. Same
   camera rig, same composition contract — see camera.jsx.

   PACING
     Same discipline as stage 01: nothing pops. The sill lands first, the
     stud wall rises as one coordinated mass and settles with weight, the
     top plate caps it with a second, smaller settle, and gold light only
     traces the frame once it's standing.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── FRAMING GEOMETRY — sits directly on the stage-01 slab (SLAB_Z[1]) ── */
const SILL_Z  = [SLAB_Z[1], SLAB_Z[1] + 6]   // [60, 66]
const STUD_Z  = [66, 170]
const PLATE_Z = [170, 179]

const POST_HW = 4   // stud half-width, plan units

/* Two visible exterior walls — same two faces Volume() ever draws:
   the y1 wall (varying x) and the x1 wall (varying y). */
const WALL_X = [-190, -135.7, -81.4, -27.1, 27.1, 81.4, 135.7, 190]
const WALL_Y = [-125, -89.3, -53.6, -17.9, 17.9, 53.6, 89.3, 125]

const studRight = y => ({ x0: SLAB.x1 - POST_HW, x1: SLAB.x1 + POST_HW, y0: y - POST_HW, y1: y + POST_HW })
const studLeft  = x => ({ x0: x - POST_HW, x1: x + POST_HW, y0: SLAB.y1 - POST_HW, y1: SLAB.y1 + POST_HW })

/* Ceiling joists spanning the two long walls, resting on the stud tops
   under the plate — the calculation lattice, echoing stage 01's data
   lattice at the next level up. */
const JOIST_X = [-152, -76, 0, 76, 152]

/* ── TIMELINE (ms) ────────────────────────────────────────────────────── */
const T = {
  eyebrow:     300,
  base:        400,
  cap1:        2000,
  sill:        2600,
  cap2:        3800,
  studs:       4600,
  settle:      8100,
  cap3:        8500,
  plate:       9200,
  plateSettle: 10000,
  joists:      10300,
  trace:       11800,
  cap4:        12200,
  nodes:       14400,
  end:         18300,
  logo:        20100,
  loop:        25600,
}

const SILL_S  = 0.9
const WALL_S  = 3.2
const PLATE_S = 0.7

const CAPTIONS = [
  { eyebrow: 'Structure',    line: "Data alone isn't an estimate." },
  { eyebrow: 'The Frame',    line: 'So it gets built into cost codes.' },
  { eyebrow: 'Load-Bearing', line: 'Materials. Labor. Permits. Overhead.' },
  { eyebrow: 'The Engine',   line: 'Every line item, applied automatically.' },
]

/* Callouts anchor on the top plate — same (x, y) footprint positions as
   stage 01's callouts, one level up. Same inputs, new shape. */
const CALLOUTS = [
  { k: 'materials', plan: [-135, -82], elbow: [480, 110], end: [238, 110], anchor: 'end',
    label: 'MATERIALS',       sub: 'Local supply pricing, applied' },
  { k: 'labor',     plan: [-135,  82], elbow: [320, 330], end: [238, 330], anchor: 'end',
    label: 'LABOR',           sub: 'Local labor rates, applied' },
  { k: 'fees',      plan: [ 135, -82], elbow: [880, 180], end: [962, 180], anchor: 'start',
    label: 'PERMITS & FEES',  sub: 'Local permit costs, applied' },
  { k: 'overhead',  plan: [ 135,  82], elbow: [830, 420], end: [962, 420], anchor: 'start',
    label: 'OVERHEAD',        sub: 'G&A, applied automatically' },
]

/* Reinforcing mesh inside the slab top — persists statically from stage 01. */
const MESH_X = [-152, -114, -76, -38, 0, 38, 76, 114, 152]
const MESH_Y = [-95, -57, -19, 19, 57, 95]

const TOP_PERIM = 2 * (
  Math.hypot((SLAB.x1 - SLAB.x0) * 0.866, (SLAB.x1 - SLAB.x0) * 0.40) +
  Math.hypot((SLAB.y1 - SLAB.y0) * 0.866, (SLAB.y1 - SLAB.y0) * 0.40)
)

/* ── SCENE ────────────────────────────────────────────────────────────── */

export default function Framing() {
  const [cycle,   setCycle]   = useState(0)
  const [base,    setBase]    = useState(false)   // stage-01 foundation, held
  const [sillP,   setSillP]   = useState(0)
  const [wallP,   setWallP]   = useState(0)
  const [impactStuds, setImpactStuds] = useState(false)
  const [joists,  setJoists]  = useState(false)
  const [plateP,  setPlateP]  = useState(0)
  const [impactPlate, setImpactPlate] = useState(false)
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
    setBase(false); setSillP(0); setWallP(0); setImpactStuds(false)
    setJoists(false); setPlateP(0); setImpactPlate(false)
    setTrace(false); setNodes(false)
    setEnd(false); setLogo(false); setEyebrow(false); setCap(-1)
  }

  function run() {
    reset()
    setCycle(c => c + 1)
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    at(T.eyebrow, () => setEyebrow(true))
    at(T.base,    () => setBase(true))
    at(T.cap1,    () => setCap(0))
    at(T.sill,    () => anims.current.push(
      animate(0, 1, { duration: SILL_S, ease: HEAVY, onUpdate: setSillP })))
    at(T.cap2,    () => setCap(1))
    at(T.studs,   () => anims.current.push(
      animate(0, 1, { duration: WALL_S, ease: HEAVY, onUpdate: setWallP })))
    at(T.settle,  () => setImpactStuds(true))
    at(T.cap3,    () => setCap(2))
    at(T.plate,   () => anims.current.push(
      animate(0, 1, { duration: PLATE_S, ease: HEAVY, onUpdate: setPlateP })))
    at(T.plateSettle, () => setImpactPlate(true))
    at(T.joists,  () => setJoists(true))
    at(T.trace,   () => setTrace(true))
    at(T.cap4,    () => setCap(3))
    at(T.nodes,   () => setNodes(true))
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

  const sillZt  = SILL_Z[0]  + (SILL_Z[1]  - SILL_Z[0])  * sillP
  const wallZt  = STUD_Z[0]  + (STUD_Z[1]  - STUD_Z[0])  * wallP
  const plateZt = PLATE_Z[0] + (PLATE_Z[1] - PLATE_Z[0]) * plateP
  const framed  = plateP > 0.999

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

        {/* ── camera: continues stage 01's push-in rather than resetting it ── */}
        <motion.div
          key={cycle}
          initial={{ scale: 1.03, y: '-0.7%' }}
          animate={{ scale: 1.09, y: '-1.6%' }}
          transition={{ duration: T.loop / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* stud wall landing */}
          <motion.div
            animate={impactStuds ? { y: [0, 5, -2.2, 0.9, 0] } : { y: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut', times: [0, 0.16, 0.4, 0.68, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* top plate landing — a second, lighter settle */}
            <motion.div
              animate={impactPlate ? { y: [0, 3, -1.3, 0.5, 0] } : { y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', times: [0, 0.18, 0.42, 0.7, 1] }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <svg viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
                <defs>
                  {/* concrete — carried over from stage 01, unchanged */}
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

                  {/* framing lumber — warm dark bronze, distinct from concrete */}
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

                  <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowSoft" x="-90%" y="-90%" width="280%" height="280%">
                    <feGaussianBlur stdDeviation="11" />
                  </filter>
                  <filter id="grain" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>

                  <clipPath id="slabClip">
                    <polygon points={pts(silhouette(SLAB, SLAB_Z[0], SLAB_Z[1]))} />
                  </clipPath>
                  <clipPath id="topClip">
                    <polygon points={pts(rectPlan(SLAB, SLAB_Z[1]))} />
                  </clipPath>
                </defs>

                {/* ── STAGE 01, HELD: the completed foundation this stage builds on ── */}
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

                  {/* held gold trace, already set from stage 01 */}
                  <path d={path(rectPlan(SLAB, SLAB_Z[1]))} fill="none"
                    stroke={GOLD} strokeWidth="1.3" strokeOpacity="0.55" filter="url(#glow)" />
                  <path d={path(rectPlan(FOOT, FOOT_Z[1]))} fill="none"
                    stroke={GOLD} strokeWidth="1" strokeOpacity="0.28" />

                  {/* persisting data lattice */}
                  <g clipPath="url(#topClip)">
                    {MESH_X.map(x => (
                      <line key={`mx${x}`}
                        x1={P(x, SLAB.y0 + 14, SLAB_Z[1])[0]} y1={P(x, SLAB.y0 + 14, SLAB_Z[1])[1]}
                        x2={P(x, SLAB.y1 - 14, SLAB_Z[1])[0]} y2={P(x, SLAB.y1 - 14, SLAB_Z[1])[1]}
                        stroke={GOLD} strokeWidth="0.75" strokeOpacity="0.26"
                      />
                    ))}
                    {MESH_Y.map(y => (
                      <line key={`my${y}`}
                        x1={P(SLAB.x0 + 14, y, SLAB_Z[1])[0]} y1={P(SLAB.x0 + 14, y, SLAB_Z[1])[1]}
                        x2={P(SLAB.x1 - 14, y, SLAB_Z[1])[0]} y2={P(SLAB.x1 - 14, y, SLAB_Z[1])[1]}
                        stroke={GOLD} strokeWidth="0.75" strokeOpacity="0.26"
                      />
                    ))}
                  </g>
                </motion.g>

                {/* ── SILL PLATE ── */}
                <Volume r={SLAB} zb={SILL_Z[0]} zt={sillZt} tone="wood" />

                {/* ── STUD WALL — rises as one coordinated mass ── */}
                {sillP > 0.6 && (
                  <g>
                    {WALL_Y.map(y => (
                      <Volume key={`sr${y}`} r={studRight(y)} zb={STUD_Z[0]} zt={wallZt} tone="wood" />
                    ))}
                    {WALL_X.map(x => (
                      <Volume key={`sl${x}`} r={studLeft(x)} zb={STUD_Z[0]} zt={wallZt} tone="wood" />
                    ))}
                  </g>
                )}

                {/* ── JOISTS — the calculation lattice, resting on the stud tops ── */}
                <g>
                  {JOIST_X.map((x, i) => (
                    <motion.line key={`j${x}`}
                      x1={P(x, SLAB.y0 + 6, STUD_Z[1])[0]} y1={P(x, SLAB.y0 + 6, STUD_Z[1])[1]}
                      x2={P(x, SLAB.y1 - 6, STUD_Z[1])[0]} y2={P(x, SLAB.y1 - 6, STUD_Z[1])[1]}
                      stroke={GOLD} strokeWidth="1.1" strokeOpacity="0.4" filter="url(#glow)"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: joists ? 1 : 0 }}
                      transition={{ duration: 0.9, delay: joists ? i * 0.12 : 0, ease: EASE }}
                    />
                  ))}
                </g>

                {/* ── TOP PLATE — caps the wall ── */}
                <Volume r={SLAB} zb={PLATE_Z[0]} zt={plateZt} tone="wood" />

                {/* ── SET: gold light traces the new frame once it's standing ── */}
                <g>
                  <motion.path
                    d={path(rectPlan(SLAB, PLATE_Z[1]))}
                    fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.9" filter="url(#glow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: trace ? 1 : 0 }}
                    transition={{ duration: 2.1, ease: EASE }}
                  />
                  <motion.path
                    d={path(rectPlan(SLAB, STUD_Z[1]))}
                    fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.35"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: trace ? 1 : 0 }}
                    transition={{ duration: 2.1, delay: 0.4, ease: EASE }}
                  />
                  {/* corner post arrises, catching the key light */}
                  {[[SLAB.x1, SLAB.y1], [SLAB.x0, SLAB.y1], [SLAB.x1, SLAB.y0]].map(([x, y], i) => (
                    <motion.line key={i}
                      x1={P(x, y, PLATE_Z[1])[0]} y1={P(x, y, PLATE_Z[1])[1]}
                      x2={P(x, y, SILL_Z[0])[0]} y2={P(x, y, SILL_Z[0])[1]}
                      stroke={GOLD} strokeWidth="0.9" strokeOpacity="0.3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: trace ? 1 : 0 }}
                      transition={{ duration: 1.3, delay: 0.9 + i * 0.15, ease: EASE }}
                    />
                  ))}
                  {trace && (
                    <motion.path
                      d={path(rectPlan(SLAB, PLATE_Z[1]))}
                      fill="none" stroke={GOLD_HI} strokeWidth="2.4" strokeLinecap="round"
                      filter="url(#glow)"
                      strokeDasharray={`64 ${TOP_PERIM}`}
                      initial={{ strokeDashoffset: 0, opacity: 0 }}
                      animate={{ strokeDashoffset: [-0, -TOP_PERIM], opacity: [0, 1, 1, 0.75] }}
                      transition={{
                        strokeDashoffset: { duration: 3.1, ease: 'linear', repeat: Infinity },
                        opacity: { duration: 3.1, times: [0, 0.12, 0.8, 1] },
                      }}
                    />
                  )}
                </g>

                {/* ── CALLOUTS ── */}
                {CALLOUTS.map((c, i) => {
                  const n = P(c.plan[0], c.plan[1], PLATE_Z[1])
                  const d = `M${n[0]},${n[1]} L${c.elbow[0]},${c.elbow[1]} L${c.end[0]},${c.end[1]}`
                  const tx = c.anchor === 'end' ? c.end[0] - 9 : c.end[0] + 9
                  return (
                    <g key={c.k}>
                      <motion.path
                        d={d} fill="none" stroke={GOLD} strokeWidth="0.9" strokeOpacity="0.55"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: nodes ? 1 : 0 }}
                        transition={{ duration: 0.85, delay: nodes ? i * 0.28 : 0, ease: EASE }}
                      />
                      <motion.g
                        initial={{ opacity: 0 }}
                        animate={{ opacity: nodes ? 1 : 0 }}
                        transition={{ duration: 0.6, delay: nodes ? i * 0.28 : 0 }}
                      >
                        <circle cx={n[0]} cy={n[1]} r="7" fill={GOLD} opacity="0.16" filter="url(#glowSoft)" />
                        <circle cx={n[0]} cy={n[1]} r="2.6" fill={GOLD_HI} filter="url(#glow)" />
                      </motion.g>
                      <motion.g
                        initial={{ opacity: 0, x: c.anchor === 'end' ? 8 : -8 }}
                        animate={{ opacity: nodes ? 1 : 0, x: nodes ? 0 : (c.anchor === 'end' ? 8 : -8) }}
                        transition={{ duration: 0.7, delay: nodes ? 0.5 + i * 0.28 : 0, ease: EASE }}
                      >
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

                {/* ── settle: displaced dust at the stud wall's landing ── */}
                <AnimatePresence>
                  {impactStuds && (
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
        </motion.div>

        {/* ── bloom on the hold ── */}
        <motion.div
          animate={{ opacity: end ? 1 : 0 }}
          transition={{ duration: 2.6, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 56% 42% at 50% 38%, rgba(212,175,55,0.11) 0%, transparent 70%)',
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
                Stage 02 / 04 — Framing
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
                  The frame is the cost structure.
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
                  Not a spreadsheet. Not a guess. Every number has a place to stand.
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
                Next — Walls
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
