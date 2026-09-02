import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker, useMapContext } from 'react-simple-maps'

const US_GEO   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
const CNTY_GEO = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

const TRI_FIPS  = [12086, 12011, 12099]
const HVHZ_FIPS = [12086, 12011]
const isTri  = id => TRI_FIPS.includes(Number(id))
const isHvhz = id => HVHZ_FIPS.includes(Number(id))

const COUNTY_META = {
  12086: { label: 'MIAMI-DADE', center: [-80.38, 25.62], baseColor: 'rgba(212,100,40,0.07)',  hvhzColor: 'rgba(212,90,30,0.30)',  hvhzStroke: 'rgba(212,90,30,0.78)'  },
  12011: { label: 'BROWARD',    center: [-80.27, 26.13], baseColor: 'rgba(212,155,40,0.07)',  hvhzColor: 'rgba(212,120,30,0.24)', hvhzStroke: 'rgba(212,130,30,0.68)' },
  12099: { label: 'PALM BEACH', center: [-80.19, 26.68], baseColor: 'rgba(50,190,160,0.06)',  hvhzColor: 'rgba(40,190,155,0.20)', hvhzStroke: 'rgba(40,190,155,0.65)' },
}

const HIGH = new Set([
  'Miami','Miami Beach','Coral Gables','Miramar',
  'Boca Raton','Boynton Beach','Delray Beach','North Palm Beach',
])

const ALIAS_CYCLE = ['FTL','WPB','Boca','SoBe','Delray','Pompano','Boynton','Doral']

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

// Gold mesh of connections between nearby municipalities
function NetworkMesh({ active }) {
  const ctx = useMapContext()
  if (!active || !ctx?.projection) return null

  const pts = MUNIS.map(m => {
    try {
      const p = ctx.projection(m.c)
      return p ? { x: p[0], y: p[1] } : null
    } catch { return null }
  }).filter(Boolean)

  const THRESH = 34
  const lines = []
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x
      const dy = pts[j].y - pts[i].y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < THRESH) {
        lines.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[j].x, y2: pts[j].y, a: (1 - d / THRESH) * 0.22 })
      }
    }
  }

  return (
    <g>
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={`rgba(212,175,55,${l.a.toFixed(3)})`} strokeWidth={0.45}
        />
      ))}
    </g>
  )
}

// Faint county name labels stamped into the map
function CountyLabels() {
  const ctx = useMapContext()
  if (!ctx?.projection) return null
  return (
    <g>
      {Object.entries(COUNTY_META).map(([fips, meta]) => {
        try {
          const p = ctx.projection(meta.center)
          if (!p) return null
          return (
            <text key={fips} x={p[0]} y={p[1]}
              textAnchor="middle"
              style={{
                fill: 'rgba(212,175,55,0.16)',
                fontSize: '5.5px',
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.22em',
                userSelect: 'none',
              }}
            >
              {meta.label}
            </text>
          )
        } catch { return null }
      })}
    </g>
  )
}

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

function SouthFloridaBase({ strings }) {
  const [scene,     setScene]     = useState(0)
  const [zoomed,    setZoomed]    = useState(false)
  const [dots,      setDots]      = useState(false)
  const [showAlias, setShowAlias] = useState(false)
  const [aliasIdx,  setAliasIdx]  = useState(0)
  const [hvhz,      setHvhz]      = useState(false)
  const [logo,      setLogo]      = useState(false)
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
    setScene(0); setZoomed(false); setDots(false)
    setShowAlias(false); setAliasIdx(0); setHvhz(false); setLogo(false)

    t(() => setZoomed(true), 1800)

    t(() => setScene(1), 5000)
    t(() => setDots(true), 5300)
    t(() => {
      setShowAlias(true)
      let idx = 0
      const iv = setInterval(() => {
        idx = (idx + 1) % ALIAS_CYCLE.length
        setAliasIdx(idx)
      }, 850)
      ivals.current.push(iv)
    }, 8200)

    t(() => { setScene(2); setShowAlias(false) }, 14000)

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
      width: '100vw', height: '100vh', background: '#0D0D0D',
      overflow: 'hidden', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* isometric gold grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'repeating-linear-gradient(60deg, rgba(212,175,55,0.04) 0px, rgba(212,175,55,0.04) 1px, transparent 1px, transparent 52px)',
          'repeating-linear-gradient(-60deg, rgba(212,175,55,0.04) 0px, rgba(212,175,55,0.04) 1px, transparent 1px, transparent 52px)',
        ].join(','),
      }} />

      {/* ── NATIONAL MAP (scene 0) ── */}
      <motion.div
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        animate={{ opacity: scene >= 1 ? 0 : 1 }}
        transition={{ duration: 1.8 }}
      >
        <motion.div
          style={{ transformOrigin: '84% 77%' }}
          initial={{ scale: 1.35 }}
          animate={{ scale: zoomed ? 10 : 1.35 }}
          transition={{ duration: 3.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 950 }}
            width={960} height={560}
            style={{ width: '96vw', height: 'auto', overflow: 'visible' }}
          >
            <Geographies geography={US_GEO}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const fl = geo.properties.name === 'Florida'
                  return (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill={fl ? '#D4AF37' : '#141414'}
                      stroke="#0D0D0D" strokeWidth={0.8}
                      style={{
                        default: {
                          outline: 'none', cursor: 'default',
                          filter: fl ? 'drop-shadow(0 0 16px rgba(212,175,55,0.85))' : 'none',
                          transition: 'fill 0.9s',
                        },
                        hover:   { outline: 'none', fill: fl ? '#dfc145' : '#1e1e1e' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
        </motion.div>
      </motion.div>

      {/* ── TRI-COUNTY MAP (scenes 1–4) ── */}
      <AnimatePresence>
        {scene >= 1 && scene < 5 && (
          <motion.div key="tri"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.8 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [-80.35, 26.2], scale: 23000 }}
              width={960} height={560}
              style={{ width: '96vw', height: 'auto', overflow: 'visible' }}
            >
              <Geographies geography={CNTY_GEO}>
                {({ geographies }) =>
                  geographies.filter(g => isTri(g.id)).map(geo => {
                    const meta = COUNTY_META[Number(geo.id)]
                    const fill   = hvhz ? meta.hvhzColor   : meta.baseColor
                    const stroke = hvhz ? meta.hvhzStroke  : 'rgba(212,175,55,0.45)'
                    return (
                      <Geography key={geo.rsmKey} geography={geo}
                        fill={fill} stroke={stroke} strokeWidth={1.0}
                        style={{
                          default:  { outline: 'none', cursor: 'default', transition: 'fill 1.2s ease, stroke 1.2s ease' },
                          hover:    { outline: 'none' },
                          pressed:  { outline: 'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>

              {/* gold network mesh connecting nearby cities */}
              <NetworkMesh active={dots} />

              {/* faint county name stamps */}
              <CountyLabels />

              {/* municipality markers */}
              {dots && MUNIS.map(m => {
                const high   = HIGH.has(m.n)
                const bright = scene >= 2 && high
                return (
                  <Marker key={m.n} coordinates={m.c}>
                    {bright ? (
                      <>
                        {/* outer glow ring */}
                        <circle r={13} fill="none" stroke="rgba(212,175,55,0.07)" strokeWidth={0.8}
                          style={{ animation: 'dotPulse 2.6s ease-in-out infinite' }}
                        />
                        {/* mid ring */}
                        <circle r={7.5} fill="none" stroke="rgba(212,175,55,0.18)" strokeWidth={0.7}
                          style={{ animation: 'dotPulse 2.2s ease-in-out infinite', animationDelay: '0.35s' }}
                        />
                        {/* core beacon */}
                        <circle r={3.5} fill="#D4AF37"
                          style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.95))', animation: 'dotPulse 1.8s ease-in-out infinite' }}
                        />
                        {/* label */}
                        <text textAnchor="middle" y={-16}
                          style={{ fill: '#D4AF37', fontSize: '4px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.1em' }}
                        >
                          {m.n.toUpperCase()}
                        </text>
                      </>
                    ) : (
                      <circle
                        r={scene >= 2 ? 1.8 : 2.2}
                        fill={scene >= 2 ? 'rgba(212,175,55,0.22)' : 'rgba(212,175,55,0.52)'}
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
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            style={{ position: 'absolute', top: '1.25rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.45em', textTransform: 'uppercase', textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
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
            style={{ position: 'absolute', bottom: '6.5rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', textShadow: '0 0 40px rgba(212,175,55,0.35)' }}>
              <Counter target={86} running={scene === 1 && dots} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, marginTop: '0.55rem', fontFamily: 'monospace' }}>
              {strings.cap1label}
            </div>
            <div style={{ color: 'rgba(212,175,55,0.4)', fontSize: '0.58rem', marginTop: '0.5rem', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
              {strings.cap1aliases}
            </div>
            <AnimatePresence>
              {showAlias && (
                <motion.div key="alias-row"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ marginTop: '0.5rem', height: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AnimatePresence mode="wait">
                    <motion.span key={aliasIdx}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace' }}
                    >
                      {ALIAS_CYCLE[aliasIdx]}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {scene === 2 && (
          <motion.div key="cap2"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{ position: 'absolute', bottom: '6.5rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', fontFamily: 'monospace', textShadow: '0 0 40px rgba(212,175,55,0.35)' }}>
              8
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, marginTop: '0.55rem', fontFamily: 'monospace' }}>
              {strings.cap2label}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.58rem', marginTop: '0.4rem', letterSpacing: '0.06em' }}>
              {strings.cap2expanding}
            </div>
          </motion.div>
        )}

        {scene === 3 && (
          <motion.div key="cap3"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{ position: 'absolute', bottom: '6.5rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: 'rgba(212,90,30,0.95)', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.5em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'monospace', textShadow: '0 0 16px rgba(212,90,30,0.5)' }}>
              HVHZ
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'clamp(0.85rem,2.5vw,1.1rem)', fontWeight: 600, lineHeight: 1.45, maxWidth: '480px', margin: '0 auto' }}>
              {strings.cap3main}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.65rem', marginTop: '0.55rem', lineHeight: 1.5 }}>
              {strings.cap3sub}
            </div>
          </motion.div>
        )}

        {scene === 4 && (
          <motion.div key="cap4"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{ position: 'absolute', bottom: '6.5rem', left: '1rem', right: '1rem', textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.45em', textTransform: 'uppercase', marginBottom: '0.7rem', fontFamily: 'monospace', textShadow: '0 0 14px rgba(212,175,55,0.4)' }}>
              {strings.cap4eyebrow}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 'clamp(0.9rem,2.5vw,1.2rem)', fontWeight: 600, lineHeight: 1.4 }}>
              {strings.cap4main}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.65rem', marginTop: '0.5rem', letterSpacing: '0.1em' }}>
              {strings.cap4sub}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── END CARD HEADLINE ── */}
      <AnimatePresence>
        {scene === 5 && (
          <motion.div key="h5"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{ position: 'absolute', top: '1.25rem', left: 0, right: 0, textAlign: 'center' }}
          >
            <div style={{ color: '#D4AF37', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.45em', textTransform: 'uppercase', textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
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
            <span style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 14px rgba(212,175,55,0.45)' }}>
              {strings.url}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 85% 80% at 50% 55%, transparent 20%, rgba(13,13,13,0.65) 68%, #0D0D0D 100%)',
      }} />

    </div>
  )
}

const EN = {
  headline:      'South Florida — Hyper-Local',
  cap1label:     'Municipalities Indexed',
  cap1aliases:   '25 local aliases recognized',
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
  cap1aliases:   '25 alias locales reconocidos',
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
