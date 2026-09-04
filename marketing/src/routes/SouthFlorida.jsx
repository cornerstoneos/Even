import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const US_GEO   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
const CNTY_GEO = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

const TRI_FIPS  = [12086, 12011, 12099]
const isTri  = id => TRI_FIPS.includes(Number(id))
const isHvhz = id => [12086, 12011].includes(Number(id))

// Coastal municipalities with 40-year recertification requirement
const COASTAL = new Set([
  'Miami Beach','Sunny Isles Beach','Aventura','Bal Harbour','Bay Harbor Islands',
  'Surfside','Golden Beach','Indian Creek','North Bay Village','Key Biscayne',
  'Hallandale Beach','Dania Beach','Pompano Beach','Deerfield Beach',
  'Lighthouse Point','Sea Ranch Lakes','Hillsboro Beach','Lauderdale-by-the-Sea',
  'Palm Beach','Palm Beach Shores','Juno Beach','Ocean Ridge','Manalapan',
  'Lake Park','Riviera Beach',
])

// Per-county visual config — warm colors on by default
const COUNTY = {
  12086: {
    label: 'MIAMI-DADE',
    labelCoords: [-80.43, 25.60],
    baseFill:   'rgba(185,65,15,0.28)',
    baseStroke: 'rgba(220,90,20,0.7)',
    hvhzFill:   'rgba(205,68,12,0.62)',
    hvhzStroke: 'rgba(230,90,20,0.98)',
  },
  12011: {
    label: 'BROWARD',
    labelCoords: [-80.33, 26.11],
    baseFill:   'rgba(175,115,12,0.24)',
    baseStroke: 'rgba(210,140,20,0.65)',
    hvhzFill:   'rgba(190,112,8,0.55)',
    hvhzStroke: 'rgba(215,138,15,0.95)',
  },
  12099: {
    label: 'PALM BEACH',
    labelCoords: [-80.21, 26.65],
    baseFill:   'rgba(25,155,125,0.20)',
    baseStroke: 'rgba(35,185,148,0.60)',
    hvhzFill:   'rgba(28,178,142,0.40)',
    hvhzStroke: 'rgba(38,198,158,0.92)',
  },
}

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

// 4 scenes after Florida intro
const LOOP = 43000

function Counter({ target, running }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, target, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setVal(Math.floor(v)),
    })
    return () => ctrl.stop()
  }, [running, target])
  return <>{val}</>
}

// SVG defs shared across both maps
function MapDefs() {
  return (
    <defs>
      {/* Directional gold gradient for county borders */}
      <linearGradient id="goldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#FCF6BA" stopOpacity="0.95" />
        <stop offset="45%"  stopColor="#D4AF37" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#7A4F0A" stopOpacity="0.50" />
      </linearGradient>

      {/* Raised slab: shadow below, source on top */}
      <filter id="county-raised" x="-18%" y="-18%" width="136%" height="136%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="ab" />
        <feOffset in="ab" dx="1" dy="7" result="so" />
        <feFlood floodColor="#000" floodOpacity="1" result="blk" />
        <feComposite in="blk" in2="so" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* HVHZ: slab shadow + outer color glow */}
      <filter id="county-hvhz" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="ab" />
        <feOffset in="ab" dx="1" dy="7" result="so" />
        <feFlood floodColor="#000" floodOpacity="1" result="blk" />
        <feComposite in="blk" in2="so" operator="in" result="shadow" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="glow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Florida silhouette: specular highlight + deep shadow */}
      <filter id="fl-raised" x="-12%" y="-12%" width="124%" height="124%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="ab" />
        <feOffset in="ab" dx="0" dy="10" result="so" />
        <feFlood floodColor="#000" floodOpacity="1" result="blk" />
        <feComposite in="blk" in2="so" operator="in" result="shadow" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="sb" />
        <feSpecularLighting in="sb" surfaceScale="5" specularConstant="0.55" specularExponent="22" result="spec">
          <feDistantLight azimuth="315" elevation="50" lightColor="#FCF6BA" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="sc" />
        <feBlend in="SourceGraphic" in2="sc" mode="screen" result="lit" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="lit" />
        </feMerge>
      </filter>

      {/* Florida fill gradient */}
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

  function cleanup() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function t(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  function run() {
    cleanup()
    setScene(0); setDots(false); setHvhz(false); setLogo(false)

    // 0–4.8s  Florida alone
    // 4.8–18s Tri-county + 86 dots
    // 18–31s  HVHZ feature moment
    // 31–38s  Materials beat
    // 38–43s  End card
    t(() => setScene(1),      4800)
    t(() => setDots(true),    5200)

    t(() => setScene(2),      18000)
    t(() => setHvhz(true),    18400)

    t(() => { setScene(3); setHvhz(false) }, 31000)

    t(() => setScene(4),      38000)
    t(() => setLogo(true),    38300)

    t(run, LOOP)
  }

  useEffect(() => { run(); return cleanup }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      overflow: 'hidden', position: 'relative',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* Isometric grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'repeating-linear-gradient(60deg,  rgba(212,175,55,0.032) 0px, rgba(212,175,55,0.032) 1px, transparent 1px, transparent 56px)',
          'repeating-linear-gradient(-60deg, rgba(212,175,55,0.032) 0px, rgba(212,175,55,0.032) 1px, transparent 1px, transparent 56px)',
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
            <motion.div
              animate={{ opacity: [0.22, 0.38, 0.22], scale: [1, 1.06, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 60% 65% at 58% 52%, rgba(212,175,55,0.6) 0%, transparent 70%)',
              }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1.08, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 4.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [-82.5, 27.4], scale: 7200 }}
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
                          stroke="rgba(252,246,186,0.22)"
                          strokeWidth={0.5}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TRI-COUNTY MAP (scenes 1–3) ── */}
      <AnimatePresence>
        {scene >= 1 && scene < 4 && (
          <motion.div key="tri"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.6 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              /* reserve bottom space for caption */
              bottom: '10rem',
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
                    const c   = COUNTY[Number(geo.id)]
                    const hv  = hvhz && isHvhz(geo.id)
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
                  <text textAnchor="middle"
                    style={{
                      fill: hvhz ? 'rgba(255,255,255,0.45)' : 'rgba(212,175,55,0.38)',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                      userSelect: 'none',
                      transition: 'fill 1.1s ease',
                    }}
                  >
                    {c.label}
                  </text>
                </Marker>
              ))}

              {/* All 86 municipality dots — equal weight */}
              {dots && MUNIS.map(m => {
                const coastal = COASTAL.has(m.n) && hvhz
                return (
                  <Marker key={m.n} coordinates={m.c}>
                    {coastal ? (
                      <>
                        {/* ring marks 40-year recert coastal municipalities in HVHZ scene */}
                        <circle r={5} fill="none" stroke="rgba(212,175,55,0.55)" strokeWidth={0.8}
                          style={{ animation: 'dotPulse 2.4s ease-in-out infinite' }}
                        />
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
            </ComposableMap>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCENE 0 EYEBROW ── */}
      <AnimatePresence>
        {scene === 0 && (
          <motion.div key="h0"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{ position: 'absolute', top: '1.5rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5em', textTransform: 'uppercase', fontFamily: 'monospace', textShadow: '0 0 28px rgba(212,175,55,0.65)' }}>
              {strings.headline}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCENE CAPTIONS — below the map ── */}
      <AnimatePresence mode="wait">

        {/* Scene 1: 86 Municipalities */}
        {scene === 1 && dots && (
          <motion.div key="cap1"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '9.5rem',
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
              <Counter target={86} running={scene === 1 && dots} />
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

        {/* Scene 2: HVHZ Feature Moment */}
        {scene === 2 && (
          <motion.div key="cap2"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '9.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 2rem', textAlign: 'center',
            }}
          >
            {/* Gold rule */}
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

        {/* Scene 3: Materials */}
        {scene === 3 && (
          <motion.div key="cap3"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '9.5rem',
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

      {/* ── END CARD ── */}
      <AnimatePresence>
        {scene === 4 && (
          <motion.div key="h4"
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
  headline:     'South Florida',
  cap1label:    'Municipalities Indexed',
  hvhzLine1:    'HVHZ · Miami-Dade & Broward',
  hvhzLine2:    '40-Year Recertification · Miami-Dade & Broward, Coastal Municipalities Following Suit',
  hvhzTagline:  'We price to the code that actually applies to your job.',
  cap3eyebrow:  'Materials Pricing',
  cap3main:     'Electrical · Plumbing · HVAC · Painting',
  cap3sub:      'Pro-tier pricing — tri-county wide.',
  url:          'even-os.com',
}

const ES = {
  headline:     'Sur de Florida',
  cap1label:    'Municipios Indexados',
  hvhzLine1:    'HVHZ · Miami-Dade y Broward',
  hvhzLine2:    'Recertificación de 40 Años · Miami-Dade y Broward, Municipios Costeros en Seguimiento',
  hvhzTagline:  'Cotizamos según el código que aplica a tu trabajo.',
  cap3eyebrow:  'Precios de Materiales',
  cap3main:     'Eléctrico · Plomería · HVAC · Pintura',
  cap3sub:      'Precio de nivel profesional — tri-condado.',
  url:          'even-os.com',
}

export default function SouthFlorida() {
  return <SouthFloridaBase strings={EN} />
}

export function SouthFloridaES() {
  return <SouthFloridaBase strings={ES} />
}
