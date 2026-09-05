import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const CNTY_GEO = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

const TRI_FIPS = [12086, 12011, 12099]
const isTri  = id => TRI_FIPS.includes(Number(id))
const isHvhz = id => [12086, 12011].includes(Number(id))

const COASTAL = new Set([
  'Miami Beach','Sunny Isles Beach','Aventura','Bal Harbour','Bay Harbor Islands',
  'Surfside','Golden Beach','Indian Creek','North Bay Village','Key Biscayne',
  'Hallandale Beach','Dania Beach','Pompano Beach','Deerfield Beach',
  'Lighthouse Point','Sea Ranch Lakes','Hillsboro Beach','Lauderdale-by-the-Sea',
  'Palm Beach','Palm Beach Shores','Juno Beach','Ocean Ridge','Manalapan',
  'Lake Park','Riviera Beach',
])

const COUNTY = {
  12086: {
    label: 'MIAMI-DADE', labelCoords: [-80.43, 25.60],
    baseFill: 'rgba(185,65,15,0.28)', baseStroke: 'rgba(220,90,20,0.7)',
    hvhzFill: 'rgba(205,68,12,0.62)', hvhzStroke: 'rgba(230,90,20,0.98)',
  },
  12011: {
    label: 'BROWARD', labelCoords: [-80.33, 26.11],
    baseFill: 'rgba(175,115,12,0.24)', baseStroke: 'rgba(210,140,20,0.65)',
    hvhzFill: 'rgba(190,112,8,0.55)', hvhzStroke: 'rgba(215,138,15,0.95)',
  },
  12099: {
    label: 'PALM BEACH', labelCoords: [-80.21, 26.65],
    baseFill: 'rgba(25,155,125,0.20)', baseStroke: 'rgba(35,185,148,0.60)',
    hvhzFill: 'rgba(28,178,142,0.40)', hvhzStroke: 'rgba(38,198,158,0.92)',
  },
}

const MUNIS = [
  {n:'Miami',             c:[-80.191,25.774]},
  {n:'Miami Beach',       c:[-80.130,25.790]},
  {n:'Coral Gables',      c:[-80.268,25.722]},
  {n:'Hialeah',           c:[-80.279,25.858]},
  {n:'Homestead',         c:[-80.477,25.469]},
  {n:'North Miami',       c:[-80.187,25.890]},
  {n:'North Miami Beach', c:[-80.163,25.933]},
  {n:'Aventura',          c:[-80.139,25.957]},
  {n:'Sunny Isles Beach', c:[-80.122,25.940]},
  {n:'Doral',             c:[-80.355,25.820]},
  {n:'Miami Gardens',     c:[-80.243,25.942]},
  {n:'Opa-locka',         c:[-80.250,25.902]},
  {n:'Miami Lakes',       c:[-80.313,25.909]},
  {n:'Miami Shores',      c:[-80.195,25.861]},
  {n:'Miami Springs',     c:[-80.291,25.822]},
  {n:'South Miami',       c:[-80.291,25.708]},
  {n:'Sweetwater',        c:[-80.372,25.765]},
  {n:'West Miami',        c:[-80.307,25.759]},
  {n:'Florida City',      c:[-80.479,25.449]},
  {n:'Biscayne Park',     c:[-80.176,25.871]},
  {n:'Bay Harbor Islands',c:[-80.124,25.888]},
  {n:'Bal Harbour',       c:[-80.122,25.898]},
  {n:'Surfside',          c:[-80.124,25.874]},
  {n:'El Portal',         c:[-80.192,25.853]},
  {n:'Golden Beach',      c:[-80.119,25.973]},
  {n:'Indian Creek',      c:[-80.132,25.878]},
  {n:'Key Biscayne',      c:[-80.162,25.693]},
  {n:'Medley',            c:[-80.339,25.823]},
  {n:'North Bay Village', c:[-80.149,25.843]},
  {n:'Pinecrest',         c:[-80.297,25.665]},
  {n:'Virginia Gardens',  c:[-80.301,25.804]},
  {n:'Palmetto Bay',      c:[-80.339,25.625]},
  {n:'Cutler Bay',        c:[-80.347,25.577]},
  {n:'Hialeah Gardens',   c:[-80.341,25.875]},
  {n:'Fort Lauderdale',       c:[-80.143,26.122]},
  {n:'Hollywood',             c:[-80.150,26.012]},
  {n:'Pembroke Pines',        c:[-80.296,26.008]},
  {n:'Miramar',               c:[-80.233,25.987]},
  {n:'Coral Springs',         c:[-80.271,26.271]},
  {n:'Pompano Beach',         c:[-80.125,26.238]},
  {n:'Davie',                 c:[-80.251,26.064]},
  {n:'Plantation',            c:[-80.234,26.126]},
  {n:'Sunrise',               c:[-80.256,26.167]},
  {n:'Lauderhill',            c:[-80.213,26.166]},
  {n:'Deerfield Beach',       c:[-80.100,26.318]},
  {n:'Coconut Creek',         c:[-80.179,26.252]},
  {n:'Margate',               c:[-80.207,26.247]},
  {n:'Oakland Park',          c:[-80.132,26.174]},
  {n:'Tamarac',               c:[-80.249,26.213]},
  {n:'North Lauderdale',      c:[-80.226,26.218]},
  {n:'Lauderdale Lakes',      c:[-80.199,26.177]},
  {n:'West Park',             c:[-80.196,25.988]},
  {n:'Hallandale Beach',      c:[-80.149,25.981]},
  {n:'Dania Beach',           c:[-80.144,26.052]},
  {n:'Cooper City',           c:[-80.271,26.055]},
  {n:'Weston',                c:[-80.400,26.100]},
  {n:'Parkland',              c:[-80.248,26.319]},
  {n:'Wilton Manors',         c:[-80.157,26.161]},
  {n:'Lighthouse Point',      c:[-80.086,26.275]},
  {n:'Sea Ranch Lakes',       c:[-80.090,26.283]},
  {n:'Lauderdale-by-the-Sea', c:[-80.095,26.193]},
  {n:'Hillsboro Beach',       c:[-80.079,26.303]},
  {n:'Lazy Lake',             c:[-80.162,26.189]},
  {n:'Southwest Ranches',     c:[-80.346,26.048]},
  {n:'Pembroke Park',         c:[-80.175,26.001]},
  {n:'West Palm Beach',    c:[-80.053,26.715]},
  {n:'Boca Raton',         c:[-80.105,26.368]},
  {n:'Boynton Beach',      c:[-80.064,26.530]},
  {n:'Delray Beach',       c:[-80.073,26.461]},
  {n:'Lake Worth Beach',   c:[-80.055,26.617]},
  {n:'Palm Beach Gardens', c:[-80.095,26.824]},
  {n:'Jupiter',            c:[-80.094,26.934]},
  {n:'Wellington',         c:[-80.269,26.660]},
  {n:'Riviera Beach',      c:[-80.058,26.776]},
  {n:'Greenacres',         c:[-80.132,26.629]},
  {n:'Royal Palm Beach',   c:[-80.215,26.700]},
  {n:'North Palm Beach',   c:[-80.063,26.819]},
  {n:'Palm Beach',         c:[-80.037,26.707]},
  {n:'Lake Park',          c:[-80.061,26.800]},
  {n:'Tequesta',           c:[-80.105,26.972]},
  {n:'Juno Beach',         c:[-80.053,26.878]},
  {n:'Lantana',            c:[-80.051,26.587]},
  {n:'Atlantis',           c:[-80.100,26.599]},
  {n:'Manalapan',          c:[-80.040,26.571]},
  {n:'Ocean Ridge',        c:[-80.040,26.524]},
  {n:'Palm Beach Shores',  c:[-80.036,26.776]},
]

const LOOP = 43000

// Florida SVG coordinate system: x=(87.6-|lon|)*50, y=(31.0-lat)*77, viewBox="0 0 400 530"
const FL_POLY =
  'M 0,0 L 310,0 L 305,25 L 297,52 ' +
  'L 312,82 L 328,135 L 344,192 L 349,226 L 362,272 ' +
  'L 374,308 L 377,330 L 375,355 L 373,376 L 371,403 ' +
  'L 360,422 L 340,448 L 326,444 ' +
  'L 297,391 L 290,373 L 287,335 ' +
  'L 269,311 L 258,300 L 248,269 ' +
  'L 243,253 L 240,236 L 241,221 ' +
  'L 228,143 L 222,128 L 201,68 ' +
  'L 172,65 L 161,74 L 147,88 ' +
  'L 131,97 L 115,91 L 96,64 ' +
  'L 55,37 L 19,45 L 0,54 Z'

const FL_KEYS =
  'M 360,422 C 356,438 348,452 336,463 C 322,475 307,484 291,496 ' +
  'L 291,500 C 308,488 323,479 337,467 C 349,456 357,443 362,426 Z'

// All highway paths — drawn with motion.path pathLength (JavaScript-driven, no CSS keyframes)
const HW_PATHS = [
  { key:'i10',   d:'M 19,45 L 55,49 L 96,50 L 131,50 L 172,51 L 201,51 L 240,51 L 270,51 L 297,52', color:'#D4AF37', w:1.2, dur:1.4, delay:0    },
  { key:'i75n',  d:'M 283,42 L 278,68 L 270,100 L 260,150 L 250,200 L 240,236',                       color:'#C8A030', w:1.2, dur:1.3, delay:0.35 },
  { key:'i95',   d:'M 297,52 L 310,82 L 328,135 L 344,192 L 349,226 L 360,272 L 372,328 L 373,376 L 371,403', color:'#FCF6BA', w:2.0, dur:2.0, delay:0.65 },
  { key:'tpk',   d:'M 310,195 L 308,220 L 316,258 L 330,300 L 346,345 L 358,378 L 362,402',           color:'#D4AF37', w:1.4, dur:1.5, delay:1.0  },
  { key:'i4',    d:'M 240,236 L 258,225 L 280,215 L 298,208 L 312,200 L 326,195 L 329,183',           color:'#B89030', w:1.2, dur:0.9, delay:1.35 },
  { key:'alley', d:'M 287,335 L 300,374 L 325,373 L 350,374 L 362,379',                               color:'#C8A030', w:1.2, dur:0.8, delay:1.65 },
]

// City labels on full-Florida SVG — appear staggered as highways ignite past each region
const FL_CITY_LABELS = [
  { name:'JACKSONVILLE',   x:272, y:50,  labelDelay:0.8,  size:9  },
  { name:'TAMPA',          x:196, y:232, labelDelay:1.1,  size:9  },
  { name:'ORLANDO',        x:283, y:187, labelDelay:1.4,  size:9  },
  { name:'PALM BEACH',     x:265, y:328, labelDelay:1.8,  size:13 },
  { name:'FT. LAUDERDALE', x:248, y:374, labelDelay:2.1,  size:13 },
  { name:'MIAMI',          x:258, y:401, labelDelay:2.3,  size:15 },
]

// Large city labels on tri-county map
const TRI_CITY_LABELS = [
  { name:'PALM BEACH',     coords:[-80.54, 26.68], delay:0    },
  { name:'FT. LAUDERDALE', coords:[-80.56, 26.12], delay:0.35 },
  { name:'MIAMI',          coords:[-80.55, 25.90], delay:0.65 },
]

function Counter({ target, running }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, target, {
      duration: 1.6, ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setVal(Math.floor(v)),
    })
    return () => ctrl.stop()
  }, [running, target])
  return <>{val}</>
}

function MapDefs() {
  return (
    <defs>
      <linearGradient id="goldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#FCF6BA" stopOpacity="0.95" />
        <stop offset="45%"  stopColor="#D4AF37" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#7A4F0A" stopOpacity="0.50" />
      </linearGradient>
      <filter id="county-raised" x="-18%" y="-18%" width="136%" height="136%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="ab" />
        <feOffset in="ab" dx="1" dy="7" result="so" />
        <feFlood floodColor="#000" floodOpacity="1" result="blk" />
        <feComposite in="blk" in2="so" operator="in" result="shadow" />
        <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="county-hvhz" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="ab" />
        <feOffset in="ab" dx="1" dy="7" result="so" />
        <feFlood floodColor="#000" floodOpacity="1" result="blk" />
        <feComposite in="blk" in2="so" operator="in" result="shadow" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="glow" />
        <feMerge><feMergeNode in="shadow" /><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

// Isolated component so motion.path pathLength animations restart clean on each loop
function FloridaCircuit({ showLabels, show86 }) {
  return (
    <div style={{
      transform: 'perspective(1000px) rotateX(12deg) rotateY(-5deg)',
      transformOrigin: 'center center',
      width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg
        viewBox="0 0 400 530"
        style={{ width: '90vw', height: 'auto', maxHeight: '88vh', overflow: 'visible' }}
      >
        <defs>
          <filter id="sfGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sfGlowBright" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="sfOcean" cx="100%" cy="60%" r="80%">
            <stop offset="0%"   stopColor="#0A3028" />
            <stop offset="60%"  stopColor="#071A14" />
            <stop offset="100%" stopColor="#040E0B" />
          </radialGradient>
        </defs>

        {/* Ocean background */}
        <rect width="400" height="530" fill="url(#sfOcean)" />

        {/* Subtle grid on ocean */}
        <g opacity="0.035" stroke="#D4AF37" strokeWidth="0.5">
          {[50,100,150,200,250,300,350].map(x => (
            <line key={`vg${x}`} x1={x} y1="0" x2={x} y2="530" />
          ))}
          {[60,120,180,240,300,360,420,480].map(y => (
            <line key={`hg${y}`} x1="0" y1={y} x2="400" y2={y} />
          ))}
        </g>

        {/* Florida silhouette — dark with subtle gold outline */}
        <path d={FL_POLY} fill="#0E0E0E" stroke="rgba(212,175,55,0.20)" strokeWidth="0.8" />
        <path d={FL_KEYS} fill="#0E0E0E" stroke="rgba(212,175,55,0.14)" strokeWidth="0.6" />

        {/* Highway glow halos — wider, dimmer, drawn first */}
        {HW_PATHS.map(hw => (
          <motion.path
            key={`${hw.key}-halo`}
            d={hw.d}
            fill="none"
            stroke={hw.color}
            strokeWidth={hw.w + 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.18}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: hw.dur, delay: hw.delay, ease: 'easeInOut' }}
          />
        ))}

        {/* Highway main lines — motion.path pathLength, JavaScript-driven */}
        {HW_PATHS.map(hw => (
          <motion.path
            key={hw.key}
            d={hw.d}
            fill="none"
            stroke={hw.color}
            strokeWidth={hw.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#sfGlow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: hw.dur, delay: hw.delay, ease: 'easeInOut' },
              opacity:    { duration: 0.25,   delay: hw.delay },
            }}
          />
        ))}

        {/* Shooting flare — bright segment that races slightly ahead of ignition */}
        {HW_PATHS.filter(hw => ['i95', 'i75n', 'tpk', 'i10'].includes(hw.key)).map(hw => (
          <motion.path
            key={`flare-${hw.key}`}
            d={hw.d}
            fill="none"
            stroke="rgba(255,252,220,0.9)"
            strokeWidth={hw.key === 'i95' ? 2.8 : 2.0}
            strokeLinecap="round"
            filter="url(#sfGlowBright)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0.6, 0] }}
            transition={{
              pathLength: { duration: hw.dur * 0.75, delay: hw.delay, ease: 'easeOut' },
              opacity:    { duration: hw.dur,         delay: hw.delay, times: [0, 0.1, 0.7, 1] },
            }}
          />
        ))}

        {/* City labels — rise as highway ignition passes through their region */}
        {FL_CITY_LABELS.map(c => (
          <AnimatePresence key={c.name}>
            {showLabels && (
              <motion.text
                x={c.x} y={c.y}
                textAnchor="start"
                initial={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: -8 }}
                transition={{ duration: 0.7, delay: c.labelDelay, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fill: '#ffffff',
                  fontSize: c.size,
                  fontWeight: 800,
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.12em',
                  filter: 'drop-shadow(0 0 5px rgba(0,0,0,1)) drop-shadow(0 2px 10px rgba(0,0,0,0.95))',
                }}
              >
                {c.name}
              </motion.text>
            )}
          </AnimatePresence>
        ))}

        {/* City dots */}
        {FL_CITY_LABELS.map(c => (
          <AnimatePresence key={`dot-${c.name}`}>
            {showLabels && (
              <motion.circle
                cx={c.x - 5} cy={c.y - 2}
                r={c.size > 10 ? 2.5 : 1.6}
                fill="#D4AF37"
                filter="url(#sfGlow)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: c.labelDelay + 0.05 }}
              />
            )}
          </AnimatePresence>
        ))}

        {/* "86 cities. Zero guesswork." — appears after highway animation completes */}
        <AnimatePresence>
          {show86 && (
            <motion.text
              x="200" y="518"
              textAnchor="middle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ duration: 1.0 }}
              style={{
                fill: '#D4AF37',
                fontSize: 8,
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.42em',
              }}
            >
              86 CITIES · ZERO GUESSWORK
            </motion.text>
          )}
        </AnimatePresence>
      </svg>
    </div>
  )
}

function SouthFloridaBase({ strings }) {
  const [scene, setScene]                 = useState('fl')
  const [showFlLabels, setShowFlLabels]   = useState(false)
  const [show86, setShow86]               = useState(false)
  const [zooming, setZooming]             = useState(false)
  const [dots, setDots]                   = useState(false)
  const [showTriLabels, setShowTriLabels] = useState(false)
  const [hvhz, setHvhz]                   = useState(false)
  const [logo, setLogo]                   = useState(false)
  const [flKey, setFlKey]                 = useState(0)
  const timers = useRef([])

  function cleanup() { timers.current.forEach(clearTimeout); timers.current = [] }
  function t(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  function run() {
    cleanup()
    setScene('fl'); setFlKey(k => k + 1)
    setShowFlLabels(false); setShow86(false); setZooming(false)
    setDots(false); setShowTriLabels(false); setHvhz(false); setLogo(false)

    // 0–5.5s: Florida circuit animates in (pathLength draws from north→south)
    t(() => setShowFlLabels(true),  5500)
    // 7s: "86 cities" text appears after animation is complete
    t(() => setShow86(true),        7000)
    // 8.2s: zoom into black begins
    t(() => setZooming(true),       8200)
    // 9.8s: tri-county takes over
    t(() => { setScene('tri'); setZooming(false); setDots(true) }, 9800)
    t(() => setShowTriLabels(true), 10600)

    // 18s: HVHZ — unchanged
    t(() => { setScene('hvhz'); setShowTriLabels(false) }, 18000)
    t(() => setHvhz(true),          18400)

    // 31s: Materials — unchanged
    t(() => { setScene('mat'); setHvhz(false) }, 31000)

    // 38s: End card — unchanged
    t(() => setScene('end'),        38000)
    t(() => setLogo(true),          38300)

    t(run, LOOP)
  }

  useEffect(() => { run(); return cleanup }, [])

  const isMap = scene === 'tri' || scene === 'hvhz' || scene === 'mat'

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      overflow: 'hidden', position: 'relative', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Isometric grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'repeating-linear-gradient(60deg,rgba(212,175,55,0.032) 0px,rgba(212,175,55,0.032) 1px,transparent 1px,transparent 56px)',
          'repeating-linear-gradient(-60deg,rgba(212,175,55,0.032) 0px,rgba(212,175,55,0.032) 1px,transparent 1px,transparent 56px)',
        ].join(','),
      }} />

      {/* ── FLORIDA CIRCUIT ── */}
      <AnimatePresence>
        {scene === 'fl' && (
          <motion.div
            key="fl"
            initial={{ opacity: 0 }}
            animate={{ opacity: zooming ? 0 : 1, scale: zooming ? 3 : 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: zooming ? 1.3 : 1.0, ease: 'easeInOut' },
              scale:   { duration: 1.5, ease: [0.4, 0, 0.6, 1] },
            }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transformOrigin: '72% 75%',
            }}
          >
            <FloridaCircuit
              key={flKey}
              showLabels={showFlLabels}
              show86={show86}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TRI-COUNTY MAP ── */}
      <AnimatePresence>
        {isMap && (
          <motion.div
            key="tri"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: '10rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [-80.35, 26.25], scale: 26000 }}
              width={960} height={560}
              style={{ width: '96vw', height: 'auto', overflow: 'visible' }}
            >
              <MapDefs />

              <Geographies geography={CNTY_GEO}>
                {({ geographies }) =>
                  geographies.filter(g => isTri(g.id)).map(geo => {
                    const c    = COUNTY[Number(geo.id)]
                    const hv   = hvhz && isHvhz(geo.id)
                    const fill   = hv ? c.hvhzFill   : c.baseFill
                    const stroke = hv ? c.hvhzStroke : c.baseStroke
                    const filt   = hvhz ? 'url(#county-hvhz)' : 'url(#county-raised)'
                    return (
                      <Geography key={geo.rsmKey} geography={geo}
                        fill={fill} stroke={stroke} strokeWidth={1.5}
                        style={{
                          default:  { outline: 'none', filter: filt, transition: 'fill 1.1s ease, stroke 1.1s ease' },
                          hover:    { outline: 'none' },
                          pressed:  { outline: 'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>

              {/* County name labels */}
              {Object.entries(COUNTY).map(([fips, c]) => (
                <Marker key={fips} coordinates={c.labelCoords}>
                  <text textAnchor="middle" style={{
                    fill: hvhz ? 'rgba(255,255,255,0.45)' : 'rgba(212,175,55,0.38)',
                    fontSize: '9px', fontFamily: 'monospace', fontWeight: 800,
                    letterSpacing: '0.22em', userSelect: 'none', transition: 'fill 1.1s ease',
                  }}>
                    {c.label}
                  </text>
                </Marker>
              ))}

              {/* Municipality dots */}
              {dots && MUNIS.map(m => {
                const coastal = COASTAL.has(m.n) && hvhz
                return (
                  <Marker key={m.n} coordinates={m.c}>
                    {coastal ? (
                      <>
                        <circle r={5} fill="none" stroke="rgba(212,175,55,0.55)" strokeWidth={0.8} />
                        <circle r={2.2} fill="#D4AF37" style={{ filter: 'drop-shadow(0 0 3px rgba(212,175,55,0.9))' }} />
                      </>
                    ) : (
                      <circle r={2.2} fill="rgba(212,175,55,0.65)"
                        style={{ filter: 'drop-shadow(0 0 2px rgba(212,175,55,0.35))' }}
                      />
                    )}
                  </Marker>
                )
              })}

              {/* Large floating city labels — tri-county scene only */}
              {scene === 'tri' && TRI_CITY_LABELS.map((c, i) => (
                <Marker key={c.name} coordinates={c.coords}>
                  <motion.text
                    textAnchor="start"
                    initial={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: showTriLabels ? 1 : 0, translateY: showTriLabels ? -8 : 10 }}
                    transition={{ duration: 0.75, delay: showTriLabels ? c.delay : 0, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      fill: '#ffffff',
                      fontSize: i === 2 ? '26px' : i === 1 ? '22px' : '20px',
                      fontWeight: 900,
                      fontFamily: 'Inter, sans-serif',
                      letterSpacing: '0.08em',
                      filter: 'drop-shadow(0 0 6px rgba(0,0,0,1)) drop-shadow(0 3px 12px rgba(0,0,0,0.95))',
                    }}
                  >
                    {c.name}
                  </motion.text>
                  <motion.circle
                    r={3.5} fill="#D4AF37"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showTriLabels ? 1 : 0 }}
                    transition={{ duration: 0.4, delay: showTriLabels ? c.delay + 0.2 : 0 }}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.9))' }}
                  />
                </Marker>
              ))}

              {/* "86 cities" caption — tri-county scene */}
              {scene === 'tri' && (
                <Marker coordinates={[-80.60, 25.60]}>
                  <motion.text
                    textAnchor="start"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showTriLabels ? 0.6 : 0 }}
                    transition={{ duration: 0.8, delay: 1.0 }}
                    style={{
                      fill: '#D4AF37', fontSize: '7px',
                      fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.35em',
                    }}
                  >
                    86 CITIES · ZERO GUESSWORK
                  </motion.text>
                </Marker>
              )}
            </ComposableMap>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCENE CAPTIONS ── */}
      <AnimatePresence mode="wait">

        {/* Tri-county: 86 counter */}
        {scene === 'tri' && dots && (
          <motion.div key="cap1"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '9.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 2rem',
            }}
          >
            <div style={{
              color: '#D4AF37',
              fontSize: 'clamp(3.2rem,12vw,7.5rem)',
              fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
              textShadow: '0 0 55px rgba(212,175,55,0.4)',
            }}>
              <Counter target={86} running={scene === 'tri' && dots} />
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.72rem', letterSpacing: '0.4em', textTransform: 'uppercase',
              fontWeight: 700, marginTop: '0.55rem', fontFamily: 'monospace',
            }}>
              {strings.cap1label}
            </div>
          </motion.div>
        )}

        {/* HVHZ */}
        {scene === 'hvhz' && (
          <motion.div key="cap2"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '9.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 2rem', textAlign: 'center',
            }}
          >
            <motion.div
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '1px', width: '2rem', background: '#D4AF37', marginBottom: '0.9rem', transformOrigin: 'center' }}
            />
            <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 'clamp(0.78rem,2.2vw,1.05rem)', fontWeight: 600, lineHeight: 1.45, marginBottom: '0.35rem' }}>
              {strings.hvhzLine1}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(0.65rem,1.7vw,0.82rem)', fontWeight: 400, lineHeight: 1.45, marginBottom: '0.55rem', maxWidth: '560px' }}>
              {strings.hvhzLine2}
            </div>
            <div style={{ color: 'rgba(212,175,55,0.7)', fontSize: '0.62rem', letterSpacing: '0.06em', fontStyle: 'italic' }}>
              {strings.hvhzTagline}
            </div>
          </motion.div>
        )}

        {/* Materials */}
        {scene === 'mat' && (
          <motion.div key="cap3"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '9.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 2rem', textAlign: 'center',
            }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.5em', textTransform: 'uppercase', marginBottom: '0.75rem', fontFamily: 'monospace', textShadow: '0 0 16px rgba(212,175,55,0.45)' }}>
              {strings.cap3eyebrow}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(1rem,2.8vw,1.4rem)', fontWeight: 600, lineHeight: 1.4 }}>
              {strings.cap3main}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.68rem', marginTop: '0.45rem', letterSpacing: '0.08em' }}>
              {strings.cap3sub}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── END CARD HEADLINE ── */}
      <AnimatePresence>
        {scene === 'end' && (
          <motion.div key="h-end"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{ position: 'absolute', top: '1.5rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5em', textTransform: 'uppercase', fontFamily: 'monospace', textShadow: '0 0 28px rgba(212,175,55,0.6)' }}>
              {strings.headline}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOGO ── */}
      <AnimatePresence>
        {logo && (
          <motion.div key="logo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{ position: 'absolute', bottom: '1.75rem', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.6rem', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 16px rgba(212,175,55,0.45)' }}>
              {strings.url}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 30%, rgba(8,8,8,0.5) 68%, #080808 100%)',
      }} />
    </div>
  )
}

const EN = {
  headline:    'South Florida',
  cap1label:   'Municipalities Indexed',
  hvhzLine1:   'HVHZ · Miami-Dade & Broward',
  hvhzLine2:   '40-Year Recertification · Miami-Dade & Broward, Coastal Municipalities Following Suit',
  hvhzTagline: 'We price to the code that actually applies to your job.',
  cap3eyebrow: 'Materials Pricing',
  cap3main:    'Electrical · Plumbing · HVAC · Painting',
  cap3sub:     'Pro-tier pricing — tri-county wide.',
  url:         'even-os.com',
}

const ES = {
  headline:    'Sur de Florida',
  cap1label:   'Municipios Indexados',
  hvhzLine1:   'HVHZ · Miami-Dade y Broward',
  hvhzLine2:   'Recertificación de 40 Años · Miami-Dade y Broward, Municipios Costeros en Seguimiento',
  hvhzTagline: 'Cotizamos según el código que aplica a tu trabajo.',
  cap3eyebrow: 'Precios de Materiales',
  cap3main:    'Eléctrico · Plomería · HVAC · Pintura',
  cap3sub:     'Precio de nivel profesional — tri-condado.',
  url:         'even-os.com',
}

export default function SouthFlorida() {
  return <SouthFloridaBase strings={EN} />
}

export function SouthFloridaES() {
  return <SouthFloridaBase strings={ES} />
}
