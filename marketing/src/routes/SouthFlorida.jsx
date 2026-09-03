import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const US_GEO   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
const CNTY_GEO = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

const TRI_FIPS  = [12086, 12011, 12099]
const HVHZ_FIPS = [12086, 12011]
const isTri  = id => TRI_FIPS.includes(Number(id))
const isHvhz = id => HVHZ_FIPS.includes(Number(id))

// Per-county visual config
const COUNTY = {
  12086: {
    label: 'MIAMI-DADE',
    labelCoords: [-80.42, 25.60],
    baseFill: '#1C1308',
    hvhzFill: 'rgba(200,70,15,0.55)',
    hvhzStroke: 'rgba(220,80,20,0.95)',
    pbFill: 'rgba(200,70,15,0.15)',
  },
  12011: {
    label: 'BROWARD',
    labelCoords: [-80.32, 26.10],
    baseFill: '#17140A',
    hvhzFill: 'rgba(195,110,10,0.48)',
    hvhzStroke: 'rgba(210,125,15,0.9)',
    pbFill: 'rgba(195,110,10,0.12)',
  },
  12099: {
    label: 'PALM BEACH',
    labelCoords: [-80.20, 26.66],
    baseFill: '#0D1614',
    hvhzFill: 'rgba(30,180,145,0.35)',
    hvhzStroke: 'rgba(35,195,155,0.85)',
    pbFill: 'rgba(30,180,145,0.10)',
  },
}

// 8 highest-confidence cities
const HIGH = new Set([
  'Miami','Miami Beach','Coral Gables','Miramar',
  'Boca Raton','Boynton Beach','Delray Beach','North Palm Beach',
])

const MUNIS = [
  // Miami-Dade (34)
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
  // Broward (31)
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
  // Palm Beach (21)
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

function Counter({ target, running }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, target, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setVal(Math.floor(v)),
    })
    return () => ctrl.stop()
  }, [running, target])
  return <>{val}</>
}

// SVG defs shared by the tri-county map
function MapDefs() {
  return (
    <defs>
      {/* Gold gradient for county borders — top-left bright, bottom-right dark (directional light) */}
      <linearGradient id="goldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#FCF6BA" stopOpacity="0.95" />
        <stop offset="40%"  stopColor="#D4AF37" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#7A5010" stopOpacity="0.55" />
      </linearGradient>

      {/* Raised slab: shadow below + source on top */}
      <filter id="county-raised" x="-18%" y="-18%" width="136%" height="136%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="alphaBlur" />
        <feOffset in="alphaBlur" dx="1" dy="7" result="shadowOff" />
        <feFlood floodColor="#000000" floodOpacity="1" result="black" />
        <feComposite in="black" in2="shadowOff" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* HVHZ activated: outer glow */}
      <filter id="county-hvhz" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="alphaBlur" />
        <feOffset in="alphaBlur" dx="1" dy="7" result="shadowOff" />
        <feFlood floodColor="#000000" floodOpacity="1" result="black" />
        <feComposite in="black" in2="shadowOff" operator="in" result="shadow" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="outerBlur" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="outerBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Florida silhouette: deep shadow + specular highlight */}
      <filter id="fl-raised" x="-12%" y="-12%" width="124%" height="124%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="alphaBlur" />
        <feOffset in="alphaBlur" dx="0" dy="10" result="shadowOff" />
        <feFlood floodColor="#000000" floodOpacity="1" result="black" />
        <feComposite in="black" in2="shadowOff" operator="in" result="shadow" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="specBlur" />
        <feSpecularLighting in="specBlur" surfaceScale="5" specularConstant="0.55" specularExponent="22" result="spec">
          <feDistantLight azimuth="315" elevation="50" lightColor="#FCF6BA" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
        <feBlend in="SourceGraphic" in2="specClip" mode="screen" result="lit" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="lit" />
        </feMerge>
      </filter>

      {/* Gold gradient fill for Florida */}
      <linearGradient id="flGold" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%"   stopColor="#E8D080" />
        <stop offset="35%"  stopColor="#D4AF37" />
        <stop offset="70%"  stopColor="#A07820" />
        <stop offset="100%" stopColor="#6A4C10" />
      </linearGradient>
    </defs>
  )
}

function SouthFloridaBase({ strings }) {
  const [scene, setScene] = useState(0)
  const [dots,  setDots]  = useState(false)
  const [hvhz,  setHvhz]  = useState(false)
  const [logo,  setLogo]  = useState(false)
  const timers = useRef([])
  const ivals  = useRef([])

  function cleanup() {
    timers.current.forEach(clearTimeout)
    ivals.current.forEach(clearInterval)
    timers.current = []
    ivals.current  = []
  }

  function t(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  function run() {
    cleanup()
    setScene(0); setDots(false); setHvhz(false); setLogo(false)

    t(() => setScene(1), 4800)
    t(() => setDots(true), 5200)

    t(() => setScene(2), 14000)

    t(() => setScene(3), 22000)
    t(() => setHvhz(true), 22400)

    t(() => { setScene(4); setHvhz(false) }, 30500)

    t(() => setScene(5), 37500)
    t(() => setLogo(true), 37800)

    t(run, LOOP)
  }

  useEffect(() => { run(); return cleanup }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      overflow: 'hidden', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Isometric grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'repeating-linear-gradient(60deg,  rgba(212,175,55,0.035) 0px, rgba(212,175,55,0.035) 1px, transparent 1px, transparent 56px)',
          'repeating-linear-gradient(-60deg, rgba(212,175,55,0.035) 0px, rgba(212,175,55,0.035) 1px, transparent 1px, transparent 56px)',
        ].join(','),
      }} />

      {/* ── SCENE 0: FLORIDA ALONE ── */}
      <AnimatePresence>
        {scene === 0 && (
          <motion.div key="florida"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {/* Pulsing gold bloom */}
            <motion.div
              animate={{ opacity: [0.18, 0.32, 0.18], scale: [1, 1.06, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 50% 55% at 58% 52%, rgba(212,175,55,0.55) 0%, transparent 70%)',
              }}
            />
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [-82.5, 27.5], scale: 4400 }}
              width={960} height={560}
              style={{ width: '96vw', height: 'auto', overflow: 'visible' }}
            >
              <MapDefs />
              <Geographies geography={US_GEO}>
                {({ geographies }) =>
                  geographies
                    .filter(g => g.properties.name === 'Florida')
                    .map(geo => (
                      <Geography key={geo.rsmKey} geography={geo}
                        fill="url(#flGold)"
                        stroke="rgba(252,246,186,0.25)"
                        strokeWidth={0.6}
                        style={{
                          default:  { outline: 'none', filter: 'url(#fl-raised)' },
                          hover:    { outline: 'none' },
                          pressed:  { outline: 'none' },
                        }}
                      />
                    ))
                }
              </Geographies>
            </ComposableMap>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TRI-COUNTY MAP (scenes 1–4) ── */}
      <AnimatePresence>
        {scene >= 1 && scene < 5 && (
          <motion.div key="tri"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.6 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [-80.35, 26.2], scale: 23000 }}
              width={960} height={560}
              style={{ width: '96vw', height: 'auto', overflow: 'visible' }}
            >
              <MapDefs />

              <Geographies geography={CNTY_GEO}>
                {({ geographies }) =>
                  geographies.filter(g => isTri(g.id)).map(geo => {
                    const c = COUNTY[Number(geo.id)]
                    const inHvhz = isHvhz(geo.id)
                    const fill   = hvhz ? c.hvhzFill   : c.baseFill
                    const stroke = hvhz ? c.hvhzStroke : 'url(#goldEdge)'
                    const filter = hvhz ? 'url(#county-hvhz)' : 'url(#county-raised)'
                    return (
                      <Geography key={geo.rsmKey} geography={geo}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={hvhz ? 1.8 : 1.5}
                        style={{
                          default:  { outline: 'none', filter, transition: 'fill 1s ease, stroke 1s ease' },
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
                  <text textAnchor="middle"
                    style={{
                      fill: hvhz ? 'rgba(255,255,255,0.35)' : 'rgba(212,175,55,0.28)',
                      fontSize: '6px',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                      userSelect: 'none',
                      transition: 'fill 1s ease',
                    }}
                  >
                    {c.label}
                  </text>
                </Marker>
              ))}

              {/* Municipality dots */}
              {dots && MUNIS.map(m => {
                const high   = HIGH.has(m.n)
                const bright = scene >= 2 && high
                return (
                  <Marker key={m.n} coordinates={m.c}>
                    {bright ? (
                      <>
                        {/* outer pulse ring */}
                        <circle r={14} fill="none" stroke="rgba(212,175,55,0.06)" strokeWidth={0.7}
                          style={{ animation: 'dotPulse 2.8s ease-in-out infinite' }}
                        />
                        {/* mid ring */}
                        <circle r={8} fill="none" stroke="rgba(212,175,55,0.18)" strokeWidth={0.8}
                          style={{ animation: 'dotPulse 2.2s ease-in-out infinite', animationDelay: '0.4s' }}
                        />
                        {/* core */}
                        <circle r={3.8} fill="#D4AF37"
                          style={{ filter: 'drop-shadow(0 0 5px rgba(212,175,55,1))', animation: 'dotPulse 1.8s ease-in-out infinite' }}
                        />
                        {/* label */}
                        <text textAnchor="middle" y={-16}
                          style={{ fill: '#D4AF37', fontSize: '3.8px', fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.12em' }}
                        >
                          {m.n.toUpperCase()}
                        </text>
                      </>
                    ) : (
                      <circle
                        r={scene >= 2 ? 1.8 : 2.2}
                        fill={scene >= 2 ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.55)'}
                      />
                    )}
                  </Marker>
                )
              })}
            </ComposableMap>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCENE 0 HEADLINE ── */}
      <AnimatePresence>
        {scene === 0 && (
          <motion.div key="h0"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{ position: 'absolute', top: '1.25rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.48em', textTransform: 'uppercase', fontFamily: 'monospace', textShadow: '0 0 24px rgba(212,175,55,0.6)' }}>
              {strings.headline}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCENE CAPTIONS ── */}
      <AnimatePresence mode="wait">

        {scene === 1 && dots && (
          <motion.div key="cap1"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{ position: 'absolute', bottom: '6rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: 'clamp(2.2rem,8vw,5rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', textShadow: '0 0 50px rgba(212,175,55,0.3)' }}>
              <Counter target={86} running={scene === 1 && dots} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.58rem', letterSpacing: '0.38em', textTransform: 'uppercase', fontWeight: 700, marginTop: '0.6rem', fontFamily: 'monospace' }}>
              {strings.cap1label}
            </div>
          </motion.div>
        )}

        {scene === 2 && (
          <motion.div key="cap2"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{ position: 'absolute', bottom: '6rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: 'clamp(2.2rem,8vw,5rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', fontFamily: 'monospace', textShadow: '0 0 50px rgba(212,175,55,0.3)' }}>
              8
            </div>
            <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.58rem', letterSpacing: '0.38em', textTransform: 'uppercase', fontWeight: 700, marginTop: '0.6rem', fontFamily: 'monospace' }}>
              {strings.cap2label}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.57rem', marginTop: '0.35rem', letterSpacing: '0.04em' }}>
              {strings.cap2expanding}
            </div>
          </motion.div>
        )}

        {scene === 3 && (
          <motion.div key="cap3"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{ position: 'absolute', bottom: '6rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: 'rgba(220,80,20,0.95)', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.5em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'monospace', textShadow: '0 0 18px rgba(220,80,20,0.55)' }}>
              HVHZ
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'clamp(0.85rem,2.5vw,1.1rem)', fontWeight: 600, lineHeight: 1.45, maxWidth: '480px', margin: '0 auto' }}>
              {strings.cap3main}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.26)', fontSize: '0.65rem', marginTop: '0.55rem', lineHeight: 1.5 }}>
              {strings.cap3sub}
            </div>
          </motion.div>
        )}

        {scene === 4 && (
          <motion.div key="cap4"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{ position: 'absolute', bottom: '6rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.48em', textTransform: 'uppercase', marginBottom: '0.7rem', fontFamily: 'monospace', textShadow: '0 0 16px rgba(212,175,55,0.45)' }}>
              {strings.cap4eyebrow}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(0.9rem,2.5vw,1.2rem)', fontWeight: 600, lineHeight: 1.4 }}>
              {strings.cap4main}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.26)', fontSize: '0.65rem', marginTop: '0.5rem', letterSpacing: '0.1em' }}>
              {strings.cap4sub}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── END CARD HEADLINE ── */}
      <AnimatePresence>
        {scene === 5 && (
          <motion.div key="h5"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{ position: 'absolute', top: '1.25rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.48em', textTransform: 'uppercase', fontFamily: 'monospace', textShadow: '0 0 24px rgba(212,175,55,0.55)' }}>
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
            style={{ position: 'absolute', bottom: '1.75rem', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.6rem', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.38em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 16px rgba(212,175,55,0.5)' }}>
              {strings.url}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 85% at 50% 55%, transparent 25%, rgba(8,8,8,0.55) 65%, #080808 100%)',
      }} />

    </div>
  )
}

const EN = {
  headline:      'South Florida — Hyper-Local',
  cap1label:     'Municipalities Indexed',
  cap2label:     'Cities at Full Confidence Today',
  cap2expanding: 'Expanding weekly as we add local permit data.',
  cap3main:      'Miami-Dade & Broward: Hurricane Zone code.',
  cap3sub:       'Palm Beach: different standard. We know the difference.',
  cap4eyebrow:   'Materials Pricing',
  cap4main:      'Electrical · Plumbing · HVAC · Painting',
  cap4sub:       'Pro-tier pricing — tri-county wide.',
  url:           'even-os.com',
}

const ES = {
  headline:      'Sur de Florida — Hiperlocal',
  cap1label:     'Municipios Indexados',
  cap2label:     'Ciudades con Confianza Completa Hoy',
  cap2expanding: 'Expandiendo semanalmente con datos de permisos locales.',
  cap3main:      'Miami-Dade y Broward: Código de Zona de Huracanes.',
  cap3sub:       'Palm Beach: estándar diferente. Conocemos la diferencia.',
  cap4eyebrow:   'Precios de Materiales',
  cap4main:      'Eléctrico · Plomería · HVAC · Pintura',
  cap4sub:       'Precio de nivel profesional — en todo el tri-condado.',
  url:           'even-os.com',
}

export default function SouthFlorida() {
  return <SouthFloridaBase strings={EN} />
}

export function SouthFloridaES() {
  return <SouthFloridaBase strings={ES} />
}
