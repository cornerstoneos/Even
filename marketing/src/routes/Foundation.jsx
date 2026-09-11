import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import {
  VB, AX, AY, P, pts, path, rectPlan, silhouette,
  GOLD, GOLD_HI, BG, EASE, HEAVY, ORIGIN,
  SLAB, FOOT, FOOT_Z, SLAB_Z, Volume,
} from '../house/camera'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · STAGE 01 · FOUNDATION

   Stage one of a multi-stage brand piece that builds a house as a metaphor
   for the construction of the Even product. The foundation is Even's local
   data layer: permits, labor rates, supply house pricing, municipal codes.
   The unsexy structural work nobody sees but everything depends on.

   The camera rig (AX/AY/ORIGIN/VB/P) and the completed-foundation geometry
   (SLAB/FOOT) live in ../house/camera.jsx — every later stage imports the
   same values, so the ground plane sits in exactly the same place in every
   frame of the finished piece. See that file for the composition contract.

   PACING
     Deliberate and heavy throughout. Nothing pops, nothing bounces up.
     Volumes fill from the bottom with a long decelerating ease, the slab
     lands with weight, and gold light traces the edges only after the
     concrete has set.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── TIMELINE (ms) ────────────────────────────────────────────────────── */
const T = {
  eyebrow: 300,
  grid:    1500,
  plan:    3000,
  cap1:    3500,
  trench:  6300,
  cap2:    6700,
  foot:    7400,
  pour:    10200,
  cap3:    10500,
  settle:  13900,
  trace:   14600,
  cap4:    16000,
  mesh:    16400,
  nodes:   18100,
  end:     22000,
  logo:    23800,
  loop:    28000,
}

const POUR_S = 3.6   // seconds of slab pour
const FOOT_S = 2.4   // seconds of footing pour

const CAPTIONS = [
  { eyebrow: 'Site',        line: 'Every market has its own ground conditions.' },
  { eyebrow: 'Excavation',  line: 'So we dig into the part nobody wants to.' },
  { eyebrow: 'The Pour',    line: 'Permits. Labor. Supply. Code.' },
  { eyebrow: 'Data Layer',  line: 'Local, current, and load-bearing.' },
]

/* Technical callouts. Node sits on the slab top; the leader risers are
   authored in screen space so they stay clear of the silhouette. */
const CALLOUTS = [
  { k: 'permits', plan: [-135, -82], elbow: [512, 202], end: [238, 202], anchor: 'end',
    label: 'PERMITS',              sub: 'Fees · timelines · jurisdictions' },
  { k: 'labor',   plan: [-135,  82], elbow: [370, 424], end: [238, 424], anchor: 'end',
    label: 'LABOR RATES',          sub: 'By trade · by zip · current' },
  { k: 'codes',   plan: [ 135, -82], elbow: [828, 306], end: [962, 306], anchor: 'start',
    label: 'MUNICIPAL CODES',      sub: '86 municipalities indexed' },
  { k: 'supply',  plan: [ 135,  82], elbow: [806, 486], end: [962, 486], anchor: 'start',
    label: 'SUPPLY HOUSE PRICING', sub: 'Pro-tier counters · local' },
]

/* Reinforcing mesh inside the slab — the data lattice. */
const MESH_X = [-152, -114, -76, -38, 0, 38, 76, 114, 152]
const MESH_Y = [-95, -57, -19, 19, 57, 95]

/* Top-face perimeter length in screen px, for the running light head. */
const TOP_PERIM = 2 * (
  Math.hypot((SLAB.x1 - SLAB.x0) * AX, (SLAB.x1 - SLAB.x0) * AY) +
  Math.hypot((SLAB.y1 - SLAB.y0) * AX, (SLAB.y1 - SLAB.y0) * AY)
)

/* ── PIECES ───────────────────────────────────────────────────────────── */

/** Blueprint dimension string with end ticks, laid along the iso axis. */
function Dim({ a, b, off, text, show, delay }) {
  const A = P(a[0] + off[0], a[1] + off[1], 0)
  const B = P(b[0] + off[0], b[1] + off[1], 0)
  const [p, q] = A[0] <= B[0] ? [A, B] : [B, A]
  const ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI
  const ux = (q[0] - p[0]) / Math.hypot(q[0] - p[0], q[1] - p[1])
  const uy = (q[1] - p[1]) / Math.hypot(q[0] - p[0], q[1] - p[1])
  const tick = 5
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.9, delay: show ? delay : 0, ease: EASE }}
    >
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={GOLD} strokeOpacity="0.3" strokeWidth="0.8" />
      {[p, q].map((e, i) => (
        <line key={i}
          x1={e[0] + uy * tick} y1={e[1] - ux * tick}
          x2={e[0] - uy * tick} y2={e[1] + ux * tick}
          stroke={GOLD} strokeOpacity="0.4" strokeWidth="0.8"
        />
      ))}
      <text
        x={(p[0] + q[0]) / 2} y={(p[1] + q[1]) / 2 - 6}
        transform={`rotate(${ang} ${(p[0] + q[0]) / 2} ${(p[1] + q[1]) / 2 - 6})`}
        textAnchor="middle" fill={GOLD} fillOpacity="0.5"
        style={{ fontSize: 11, letterSpacing: '0.18em', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}
      >
        {text}
      </text>
    </motion.g>
  )
}

/* ── SCENE ────────────────────────────────────────────────────────────── */

export default function Foundation() {
  const [cycle,  setCycle]  = useState(0)
  const [grid,   setGrid]   = useState(false)
  const [plan,   setPlan]   = useState(false)
  const [trench, setTrench] = useState(false)
  const [footP,  setFootP]  = useState(0)     // footing fill 0 → 1
  const [pour,   setPour]   = useState(0)     // slab fill    0 → 1
  const [impact, setImpact] = useState(false)
  const [trace,  setTrace]  = useState(false)
  const [mesh,   setMesh]   = useState(false)
  const [nodes,  setNodes]  = useState(false)
  const [end,    setEnd]    = useState(false)
  const [logo,   setLogo]   = useState(false)
  const [eyebrow, setEyebrow] = useState(false)
  const [cap,    setCap]    = useState(-1)

  const timers = useRef([])
  const anims  = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout); timers.current = []
    anims.current.forEach(a => a.stop && a.stop()); anims.current = []
    setGrid(false); setPlan(false); setTrench(false)
    setFootP(0); setPour(0); setImpact(false)
    setTrace(false); setMesh(false); setNodes(false)
    setEnd(false); setLogo(false); setEyebrow(false); setCap(-1)
  }

  function run() {
    reset()
    setCycle(c => c + 1)
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    at(T.eyebrow, () => setEyebrow(true))
    at(T.grid,   () => setGrid(true))
    at(T.plan,   () => setPlan(true))
    at(T.cap1,   () => setCap(0))
    at(T.trench, () => setTrench(true))
    at(T.cap2,   () => setCap(1))
    at(T.foot,   () => anims.current.push(
      animate(0, 1, { duration: FOOT_S, ease: HEAVY, onUpdate: setFootP })))
    at(T.pour,   () => anims.current.push(
      animate(0, 1, { duration: POUR_S, ease: HEAVY, onUpdate: setPour })))
    at(T.cap3,   () => setCap(2))
    at(T.settle, () => setImpact(true))
    at(T.trace,  () => setTrace(true))
    at(T.cap4,   () => setCap(3))
    at(T.mesh,   () => setMesh(true))
    at(T.nodes,  () => setNodes(true))
    at(T.end,    () => { setEnd(true); setCap(-1) })
    at(T.logo,   () => setLogo(true))
    at(T.loop,   run)
  }

  useEffect(() => {
    run()
    return () => {
      timers.current.forEach(clearTimeout)
      anims.current.forEach(a => a.stop && a.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* current poured heights */
  const footZt = FOOT_Z[0] + (FOOT_Z[1] - FOOT_Z[0]) * footP
  const slabZt = SLAB_Z[0] + (SLAB_Z[1] - SLAB_Z[0]) * pour
  const wet    = pour > 0 && pour < 1 ? 1 - pour : 0
  const poured = pour > 0.001

  const progress = end ? 1 : cap >= 0 ? (cap + 1) / (CAPTIONS.length + 1) : 0

  return (
    <div style={{
      width: '100vw', height: '100vh', background: BG, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Fixed-aspect stage — SVG geometry and HTML chrome share one
          coordinate system, so nothing drifts at any viewport size.
          1em = 1% of stage width. */}
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

        {/* ── camera: one continuous slow push-in across the whole scene ── */}
        <motion.div
          key={cycle}
          initial={{ scale: 0.968, y: '1.2%' }}
          animate={{ scale: 1.032, y: '-0.7%' }}
          transition={{ duration: T.loop / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* slab landing — the only impulse in the piece */}
          <motion.div
            animate={impact ? { y: [0, 5.5, -2.4, 1, 0] } : { y: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut', times: [0, 0.16, 0.4, 0.68, 1] }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
              <defs>
                {/* concrete — slab tone */}
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
                {/* concrete — footing tone, one stop darker (in the trench) */}
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

                <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%"   stopColor={GOLD} stopOpacity="0.13" />
                  <stop offset="55%"  stopColor={GOLD} stopOpacity="0.045" />
                  <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
                </radialGradient>
                <radialGradient id="gridFade" cx="0.5" cy="0.46" r="0.52">
                  <stop offset="0%"   stopColor="#fff" stopOpacity="1" />
                  <stop offset="62%"  stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="wetSheen" x1="0.1" y1="0" x2="0.9" y2="1">
                  <stop offset="0%"   stopColor={GOLD_HI} stopOpacity="0.55" />
                  <stop offset="50%"  stopColor={GOLD}    stopOpacity="0.18" />
                  <stop offset="100%" stopColor={GOLD}    stopOpacity="0.05" />
                </linearGradient>

                <mask id="gridMask">
                  <rect x="0" y="0" width={VB.w} height={VB.h} fill="url(#gridFade)" />
                </mask>

                <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glowSoft" x="-90%" y="-90%" width="280%" height="280%">
                  <feGaussianBlur stdDeviation="11" />
                </filter>
                <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>
                <filter id="grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>

                <clipPath id="slabClip">
                  <polygon points={pts(silhouette(SLAB, SLAB_Z[0], Math.max(slabZt, SLAB_Z[0] + 0.5)))} />
                </clipPath>
                <clipPath id="topClip">
                  <polygon points={pts(rectPlan(SLAB, SLAB_Z[1]))} />
                </clipPath>
              </defs>

              {/* ── GROUND: blueprint grid, ghosted, for context only ── */}
              <motion.g
                mask="url(#gridMask)"
                initial={{ opacity: 0 }}
                animate={{ opacity: grid ? (poured ? 0.42 : 1) : 0 }}
                transition={{ duration: poured ? 2.2 : 1.8, ease: 'easeOut' }}
              >
                {Array.from({ length: 25 }, (_, i) => -480 + i * 40).map((x, i) => (
                  <motion.line key={`gx${x}`}
                    x1={P(x, -340)[0]} y1={P(x, -340)[1]} x2={P(x, 340)[0]} y2={P(x, 340)[1]}
                    stroke={GOLD} strokeWidth="0.6" strokeOpacity={x === 0 ? 0.2 : 0.085}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: grid ? 1 : 0 }}
                    transition={{ duration: 1.3, delay: Math.abs(x) / 900, ease: EASE }}
                  />
                ))}
                {Array.from({ length: 18 }, (_, i) => -340 + i * 40).map(y => (
                  <motion.line key={`gy${y}`}
                    x1={P(-480, y)[0]} y1={P(-480, y)[1]} x2={P(480, y)[0]} y2={P(480, y)[1]}
                    stroke={GOLD} strokeWidth="0.6" strokeOpacity={y === 0 ? 0.2 : 0.085}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: grid ? 1 : 0 }}
                    transition={{ duration: 1.3, delay: Math.abs(y) / 900, ease: EASE }}
                  />
                ))}
              </motion.g>

              {/* ── pool of light on the ground, so the mass has something to sit in ── */}
              <motion.ellipse
                cx={ORIGIN.x} cy={ORIGIN.y + 14} rx={430} ry={186} fill="url(#pool)"
                initial={{ opacity: 0 }}
                animate={{ opacity: grid ? 1 : 0 }}
                transition={{ duration: 2.4, ease: 'easeOut' }}
              />

              {/* ── BLUEPRINT: footprint, dimensions, ghost of the volume to come ── */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: plan ? (poured ? 0 : 1) : 0 }}
                transition={{ duration: poured ? 1.1 : 1.2, ease: 'easeOut' }}
              >
                <motion.path
                  d={path(rectPlan(SLAB, 0))}
                  fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1.2"
                  strokeDasharray="7 6"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: plan ? 1 : 0 }}
                  transition={{ duration: 1.6, ease: EASE }}
                />
                {/* ghost of the finished volume — you see the intent before the pour */}
                <motion.g
                  initial={{ opacity: 0 }} animate={{ opacity: plan ? 0.28 : 0 }}
                  transition={{ duration: 1.4, delay: 0.7 }}
                >
                  <path d={path(rectPlan(SLAB, SLAB_Z[1]))} fill="none" stroke={GOLD} strokeWidth="0.9" strokeOpacity="0.85" />
                  {rectPlan(SLAB, 0).map(([x, y], i) => (
                    <line key={i}
                      x1={P(x, y, 0)[0]} y1={P(x, y, 0)[1]}
                      x2={P(x, y, SLAB_Z[1])[0]} y2={P(x, y, SLAB_Z[1])[1]}
                      stroke={GOLD} strokeWidth="0.7" strokeOpacity="0.5"
                    />
                  ))}
                </motion.g>
                <Dim a={[SLAB.x0, SLAB.y0]} b={[SLAB.x0, SLAB.y1]} off={[-34, 0]} text={'38′-0″'} show={plan && !poured} delay={0.9} />
                <Dim a={[SLAB.x0, SLAB.y0]} b={[SLAB.x1, SLAB.y0]} off={[0, -34]} text={'25′-0″'} show={plan && !poured} delay={1.1} />
              </motion.g>

              {/* ── EXCAVATION: the trench the footing gets poured into ── */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: trench ? 1 : 0 }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              >
                <path
                  d={`${path(rectPlan(FOOT, 0))} ${path(rectPlan(SLAB, 0))}`}
                  fillRule="evenodd" fill="#050505"
                />
                <path d={path(rectPlan(FOOT, 0))} fill="none" stroke={GOLD} strokeOpacity="0.22" strokeWidth="0.9" />
                <path d={path(rectPlan(SLAB, 0))} fill="none" stroke="#000" strokeOpacity="0.9" strokeWidth="1.4" />
              </motion.g>

              {/* ── contact shadow — appears with the mass, grounds it ── */}
              <motion.polygon
                points={pts(rectPlan(
                  { x0: FOOT.x0 - 26, x1: FOOT.x1 + 26, y0: FOOT.y0 - 26, y1: FOOT.y1 + 26 }, 0))}
                fill="#000" filter="url(#shadow)"
                initial={{ opacity: 0 }}
                animate={{ opacity: footP > 0 ? 0.9 : 0 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
              />

              {/* ── POURED CONCRETE ── */}
              <Volume r={FOOT} zb={FOOT_Z[0]} zt={footZt} tone="foot" />

              {/* formwork: the recess the slab pours into. Reads as a form
                  waiting to be filled, and the rising slab covers it. */}
              {footP > 0.35 && (
                <motion.g
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                >
                  <polygon points={pts(rectPlan(SLAB, FOOT_Z[1]))} fill="#090808" />
                  {/* inner walls catching a little bounce on the far sides */}
                  <polygon points={pts([[SLAB.x0, SLAB.y0, FOOT_Z[1]], [SLAB.x1, SLAB.y0, FOOT_Z[1]],
                                        [SLAB.x1, SLAB.y0, FOOT_Z[1] - 4], [SLAB.x0, SLAB.y0, FOOT_Z[1] - 4]])}
                    fill="#151310" />
                  <path d={path(rectPlan(SLAB, FOOT_Z[1]))} fill="none"
                    stroke={GOLD} strokeOpacity="0.2" strokeWidth="0.9" />
                </motion.g>
              )}

              <Volume r={SLAB} zb={SLAB_Z[0]} zt={slabZt} tone="slab" />

              {/* concrete grain, clipped to the slab body */}
              {poured && (
                <g clipPath="url(#slabClip)">
                  <rect x="0" y="0" width={VB.w} height={VB.h}
                    filter="url(#grain)" opacity="0.11" style={{ mixBlendMode: 'overlay' }} />
                </g>
              )}

              {/* wet edge — bright gold rim riding the rising surface, hardening off */}
              {poured && pour < 1 && (
                <g>
                  <polygon points={pts(rectPlan(SLAB, slabZt))} fill="url(#wetSheen)" opacity={0.5 * wet} />
                  <path d={path(rectPlan(SLAB, slabZt))} fill="none"
                    stroke={GOLD_HI} strokeWidth="1.6" strokeOpacity={0.35 + 0.5 * wet} filter="url(#glow)" />
                </g>
              )}

              {/* ── SET: gold light traces the edges ── */}
              <g>
                {/* top face perimeter */}
                <motion.path
                  d={path(rectPlan(SLAB, SLAB_Z[1]))}
                  fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.9" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 2.1, ease: EASE }}
                />
                {/* footing shelf */}
                <motion.path
                  d={path(rectPlan(FOOT, FOOT_Z[1]))}
                  fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 2.1, delay: 0.5, ease: EASE }}
                />
                {/* near vertical arris, catching the key light */}
                <motion.line
                  x1={P(SLAB.x1, SLAB.y1, SLAB_Z[1])[0]} y1={P(SLAB.x1, SLAB.y1, SLAB_Z[1])[1]}
                  x2={P(FOOT.x1, FOOT.y1, FOOT_Z[0])[0]} y2={P(FOOT.x1, FOOT.y1, FOOT_Z[0])[1]}
                  stroke={GOLD} strokeWidth="1.1" strokeOpacity="0.55" filter="url(#glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: trace ? 1 : 0 }}
                  transition={{ duration: 1.1, delay: 1.5, ease: EASE }}
                />
                {/* running light head */}
                {trace && (
                  <motion.path
                    d={path(rectPlan(SLAB, SLAB_Z[1]))}
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

              {/* ── DATA LATTICE: the reinforcing mesh, revealed as a directional wipe ── */}
              <g clipPath="url(#topClip)">
                {MESH_X.map((x, i) => (
                  <motion.line key={`mx${x}`}
                    x1={P(x, SLAB.y0 + 14, SLAB_Z[1])[0]} y1={P(x, SLAB.y0 + 14, SLAB_Z[1])[1]}
                    x2={P(x, SLAB.y1 - 14, SLAB_Z[1])[0]} y2={P(x, SLAB.y1 - 14, SLAB_Z[1])[1]}
                    stroke={GOLD} strokeWidth="0.75" strokeOpacity="0.34"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: mesh ? 1 : 0 }}
                    transition={{ duration: 0.9, delay: mesh ? i * 0.075 : 0, ease: EASE }}
                  />
                ))}
                {MESH_Y.map((y, i) => (
                  <motion.line key={`my${y}`}
                    x1={P(SLAB.x0 + 14, y, SLAB_Z[1])[0]} y1={P(SLAB.x0 + 14, y, SLAB_Z[1])[1]}
                    x2={P(SLAB.x1 - 14, y, SLAB_Z[1])[0]} y2={P(SLAB.x1 - 14, y, SLAB_Z[1])[1]}
                    stroke={GOLD} strokeWidth="0.75" strokeOpacity="0.34"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: mesh ? 1 : 0 }}
                    transition={{ duration: 0.9, delay: mesh ? 0.35 + i * 0.075 : 0, ease: EASE }}
                  />
                ))}
              </g>

              {/* ── CALLOUTS ── */}
              {CALLOUTS.map((c, i) => {
                const n = P(c.plan[0], c.plan[1], SLAB_Z[1])
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

              {/* ── settle: displaced dust ring at the base ── */}
              <AnimatePresence>
                {impact && (
                  <motion.ellipse key="dust"
                    cx={ORIGIN.x} cy={ORIGIN.y + 8}
                    initial={{ rx: 190, ry: 82, opacity: 0.5 }}
                    animate={{ rx: 470, ry: 202, opacity: 0 }}
                    transition={{ duration: 1.6, ease: 'easeOut' }}
                    fill="none" stroke={GOLD} strokeWidth="2" filter="url(#glowSoft)"
                  />
                )}
              </AnimatePresence>
            </svg>
          </motion.div>
        </motion.div>

        {/* ── bloom under the finished foundation on the hold ── */}
        <motion.div
          animate={{ opacity: end ? 1 : 0 }}
          transition={{ duration: 2.6, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 52% 34% at 50% 56%, rgba(212,175,55,0.13) 0%, transparent 70%)',
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
                Stage 01 / 04 — Foundation
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
                  The foundation is the data.
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
                  Unglamorous. Load-bearing. Everything else sits on it.
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
                Next — Framing
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
