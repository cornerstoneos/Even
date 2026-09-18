import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — SOUTH FLORIDA MARKET MAP · REVISION 2

   Reworked against the Sep 2026 brief. What changed from rev 1:
     1. County-by-county reveal is one continuous south → north cascade
        (Miami-Dade → Broward → Palm Beach) rather than a single 86-dot
        pop, timed by a progress value (no visible sweep bar — see the
        REV 3 note below); each county's name crossfades in on its own
        even, readable timer as the cascade moves through its cities.
     2. Bolder markers — halo + ignition ping + larger core, sized to read
        on a phone screen, not just a desktop preview.
     3. Crosshatch background removed. Clean dark ground.
     4. Big on-map labels now say MIAMI-DADE / BROWARD / PALM BEACH — not
        the city names Miami / Ft. Lauderdale that used to stand in for
        the counties they sit inside.
     5. The regulatory (HVHZ) and payoff copy now lives in the empty
        Everglades/western band of the map itself, as bold integrated
        callouts — not small text crammed into a bottom caption strip.
     6. Opens on a text hook ("South Florida's best contractors don't
        guess. Are you one of them?") instead of a cold silhouette.
     7. States the core message directly: generic tools lump distinct
        municipalities together; Even doesn't, because it's priced city
        by city.
     8. Data that would change for a different market — county list,
        city list, hook line, core message, payoff number — is grouped
        at the top of the file as one block, so this file is the pattern
        to copy for the next regional map rather than a one-off.
     9. The cascade in point 1 is itself the connective motion tying the
        county reveals into one continuous sequence, rather than three
        disconnected phases.
    10. Conversion polish, applied directly to structure/copy:
          - the payoff (86 · zero guesswork) lands the instant the
            cascade finishes and gets the biggest type in the piece —
            everything after it (HVHZ, materials) stays smaller so
            nothing competes with that hit
          - every stat is paired with what it means for the contractor
            ("86" + "never guess a permit fee again"), not left bare
          - closes on a specific, benefit-loaded, micro-commitment CTA
            ("Get your first estimate free" / "no sales call") instead
            of a generic sign-off
          - the gold/orange palette and marker style here are the
            house "proof" signature — reuse them as-is on future
            market maps and other proof-based pieces rather than
            reinventing per asset (see COUNTY_STYLE / CityDot below)

   PACING
     Same discipline as the rest of the library: nothing snaps in. A
     single progress value driven over SWEEP_S seconds is the one
     continuous through-line tying the whole reveal together — every
     dot's ignition is driven by that progress, not an independent timer.

   REVISION 3 (per live phone feedback)
     - Removed the visible sweep bar (trailing glow + leading edge +
       logo riding it) entirely. The underlying progress value that
       drives the dot cascade is unchanged — only its on-screen line
       and logo mark are gone.
     - Removed the faint full-state Florida ghost outline that sat
       behind the tri-county map.
     - The big crossfade county-name label now uses each county's own
       COUNTY_STYLE labelCoords instead of one fixed coordinate, so it
       sits over the county it's naming.
     - Each county's name now gets an equal, generous slice of the
       pre-HVHZ window to display (see countySlot below) instead of a
       duration proportional to its city count, which used to leave
       Miami-Dade and Broward flashing by unreadably fast.
   ═══════════════════════════════════════════════════════════════════════════ */

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

// This orange/gold palette (and CityDot's marker style below) is Even's
// house "proof" signature — the visual language for showing coverage and
// precision. Reuse it as-is on future market maps and other proof-based
// pieces rather than picking new colors per asset.
const COUNTY_STYLE = {
  12086: {
    baseFill: 'rgba(185,65,15,0.28)', baseStroke: 'rgba(220,90,20,0.7)',
    hvhzFill: 'rgba(205,68,12,0.62)', hvhzStroke: 'rgba(230,90,20,0.98)',
    labelCoords: [-80.43, 25.60],
  },
  12011: {
    baseFill: 'rgba(175,115,12,0.24)', baseStroke: 'rgba(210,140,20,0.65)',
    hvhzFill: 'rgba(190,112,8,0.55)', hvhzStroke: 'rgba(215,138,15,0.95)',
    labelCoords: [-80.33, 26.11],
  },
  12099: {
    baseFill: 'rgba(25,155,125,0.20)', baseStroke: 'rgba(35,185,148,0.60)',
    hvhzFill: 'rgba(28,178,142,0.40)', hvhzStroke: 'rgba(38,198,158,0.92)',
    labelCoords: [-80.21, 26.65],
  },
}

/* ── MARKET DATA — this block is the thing that changes for the next
   regional map. Each county's cities are ordered south → north (by
   latitude) so the flattened list below is already the correct sweep
   order without any extra sort logic at render time. ─────────────────── */
const COUNTIES = [
  {
    fips: 12086, name: 'MIAMI-DADE',
    cities: [
      { n: 'Florida City', c: [-80.479, 25.449] },
      { n: 'Homestead', c: [-80.477, 25.469] },
      { n: 'Cutler Bay', c: [-80.347, 25.577] },
      { n: 'Palmetto Bay', c: [-80.339, 25.625] },
      { n: 'Pinecrest', c: [-80.297, 25.665] },
      { n: 'Key Biscayne', c: [-80.162, 25.693] },
      { n: 'South Miami', c: [-80.291, 25.708] },
      { n: 'Coral Gables', c: [-80.268, 25.722] },
      { n: 'West Miami', c: [-80.307, 25.759] },
      { n: 'Sweetwater', c: [-80.372, 25.765] },
      { n: 'Miami', c: [-80.191, 25.774] },
      { n: 'Miami Beach', c: [-80.130, 25.790] },
      { n: 'Virginia Gardens', c: [-80.301, 25.804] },
      { n: 'Doral', c: [-80.355, 25.820] },
      { n: 'Miami Springs', c: [-80.291, 25.822] },
      { n: 'Medley', c: [-80.339, 25.823] },
      { n: 'North Bay Village', c: [-80.149, 25.843] },
      { n: 'El Portal', c: [-80.192, 25.853] },
      { n: 'Hialeah', c: [-80.279, 25.858] },
      { n: 'Miami Shores', c: [-80.195, 25.861] },
      { n: 'Biscayne Park', c: [-80.176, 25.871] },
      { n: 'Surfside', c: [-80.124, 25.874] },
      { n: 'Hialeah Gardens', c: [-80.341, 25.875] },
      { n: 'Indian Creek', c: [-80.132, 25.878] },
      { n: 'Bay Harbor Islands', c: [-80.124, 25.888] },
      { n: 'North Miami', c: [-80.187, 25.890] },
      { n: 'Bal Harbour', c: [-80.122, 25.898] },
      { n: 'Opa-locka', c: [-80.250, 25.902] },
      { n: 'Miami Lakes', c: [-80.313, 25.909] },
      { n: 'North Miami Beach', c: [-80.163, 25.933] },
      { n: 'Sunny Isles Beach', c: [-80.122, 25.940] },
      { n: 'Miami Gardens', c: [-80.243, 25.942] },
      { n: 'Aventura', c: [-80.139, 25.957] },
      { n: 'Golden Beach', c: [-80.119, 25.973] },
    ],
  },
  {
    fips: 12011, name: 'BROWARD',
    cities: [
      { n: 'Hallandale Beach', c: [-80.149, 25.981] },
      { n: 'Miramar', c: [-80.233, 25.987] },
      { n: 'West Park', c: [-80.196, 25.988] },
      { n: 'Pembroke Park', c: [-80.175, 26.001] },
      { n: 'Pembroke Pines', c: [-80.296, 26.008] },
      { n: 'Hollywood', c: [-80.150, 26.012] },
      { n: 'Southwest Ranches', c: [-80.346, 26.048] },
      { n: 'Dania Beach', c: [-80.144, 26.052] },
      { n: 'Cooper City', c: [-80.271, 26.055] },
      { n: 'Davie', c: [-80.251, 26.064] },
      { n: 'Weston', c: [-80.400, 26.100] },
      { n: 'Fort Lauderdale', c: [-80.143, 26.122] },
      { n: 'Plantation', c: [-80.234, 26.126] },
      { n: 'Wilton Manors', c: [-80.157, 26.161] },
      { n: 'Lauderhill', c: [-80.213, 26.166] },
      { n: 'Sunrise', c: [-80.256, 26.167] },
      { n: 'Oakland Park', c: [-80.132, 26.174] },
      { n: 'Lauderdale Lakes', c: [-80.199, 26.177] },
      { n: 'Lazy Lake', c: [-80.162, 26.189] },
      { n: 'Lauderdale-by-the-Sea', c: [-80.095, 26.193] },
      { n: 'Tamarac', c: [-80.249, 26.213] },
      { n: 'North Lauderdale', c: [-80.226, 26.218] },
      { n: 'Pompano Beach', c: [-80.125, 26.238] },
      { n: 'Margate', c: [-80.207, 26.247] },
      { n: 'Coconut Creek', c: [-80.179, 26.252] },
      { n: 'Coral Springs', c: [-80.271, 26.271] },
      { n: 'Lighthouse Point', c: [-80.086, 26.275] },
      { n: 'Sea Ranch Lakes', c: [-80.090, 26.283] },
      { n: 'Hillsboro Beach', c: [-80.079, 26.303] },
      { n: 'Deerfield Beach', c: [-80.100, 26.318] },
      { n: 'Parkland', c: [-80.248, 26.319] },
    ],
  },
  {
    fips: 12099, name: 'PALM BEACH',
    cities: [
      { n: 'Boca Raton', c: [-80.105, 26.368] },
      { n: 'Delray Beach', c: [-80.073, 26.461] },
      { n: 'Ocean Ridge', c: [-80.040, 26.524] },
      { n: 'Boynton Beach', c: [-80.064, 26.530] },
      { n: 'Manalapan', c: [-80.040, 26.571] },
      { n: 'Lantana', c: [-80.051, 26.587] },
      { n: 'Atlantis', c: [-80.100, 26.599] },
      { n: 'Lake Worth Beach', c: [-80.055, 26.617] },
      { n: 'Greenacres', c: [-80.132, 26.629] },
      { n: 'Wellington', c: [-80.269, 26.660] },
      { n: 'Royal Palm Beach', c: [-80.215, 26.700] },
      { n: 'Palm Beach', c: [-80.037, 26.707] },
      { n: 'West Palm Beach', c: [-80.053, 26.715] },
      { n: 'Riviera Beach', c: [-80.058, 26.776] },
      { n: 'Palm Beach Shores', c: [-80.036, 26.776] },
      { n: 'Lake Park', c: [-80.061, 26.800] },
      { n: 'North Palm Beach', c: [-80.063, 26.819] },
      { n: 'Palm Beach Gardens', c: [-80.095, 26.824] },
      { n: 'Juno Beach', c: [-80.053, 26.878] },
      { n: 'Jupiter', c: [-80.094, 26.934] },
      { n: 'Tequesta', c: [-80.105, 26.972] },
    ],
  },
]

const ALL_CITIES = COUNTIES.flatMap(co => co.cities.map(city => ({ ...city, fips: co.fips })))
const TOTAL_CITIES = ALL_CITIES.length   // 86

const LOOP = 47000

/* ── TIMELINE (ms) ────────────────────────────────────────────────────── */
const T = {
  hookIn:     300,
  triIn:      3600,
  sweepStart: 4200,
  // payoff lands the instant the cascade finishes — the loudest moment
  // in the piece gets the cascade's own momentum, not a delayed beat
  payoffIn:   11600,
  coreMsgIn:  14200,
  hvhzIn:     20500,
  matIn:      32500,
  endIn:      39500,
  ctaIn:      40000,
  logoIn:     44500,
  loop:       LOOP,
}

const SWEEP_S = 7.0            // seconds for the full south→north cascade

function Counter({ target, running, onDone }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, target, {
      duration: 1.6, ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setVal(Math.floor(v)),
      onComplete: onDone,
    })
    return () => ctrl.stop()
  }, [running, target])
  return <>{val}</>
}

function MapDefs() {
  return (
    <defs>
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
      <filter id="dotGlow" x="-140%" y="-140%" width="380%" height="380%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

/** One city marker: soft halo, an ignition ping that plays once, then a
    bold core dot — sized to read at phone scale, not just desktop.
    No `delay` prop: this only ever mounts at the instant the sweep
    reaches it (gated by the caller), so its own pop-in transition needs
    no scheduling of its own — mount time *is* the trigger. That also
    means nothing for this city exists in the DOM a moment early, which
    a delay-based approach couldn't fully guarantee (SVG filters can let
    a faint pre-delay trace show through in some renderers). */
function CityDot({ coastal }) {
  const coreR = coastal ? 3.8 : 3.1
  return (
    <>
      <motion.circle
        initial={{ opacity: 0 }} animate={{ opacity: 0.12 }}
        transition={{ duration: 0.5 }}
        r={10} fill="#D4AF37" filter="url(#dotGlow)"
      />
      <motion.circle
        initial={{ r: 3, opacity: 0.85 }}
        animate={{ r: 15, opacity: 0 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        fill="none" stroke="#F2D782" strokeWidth={1.3}
      />
      <motion.circle
        initial={{ r: 0.4, opacity: 0 }}
        animate={{ r: coreR, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        fill="#D4AF37" filter="url(#dotGlow)"
      />
      {coastal && (
        <motion.circle
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          r={6.5} fill="none" stroke="rgba(212,175,55,0.55)" strokeWidth={1}
        />
      )}
    </>
  )
}

function SouthFloridaBase({ strings }) {
  const [scene, setScene]         = useState('hook')   // hook | tri | hvhz | mat | end
  const [litCount, setLitCount]   = useState(0)         // how many cities (south→north) have mounted
  const [countyIdx, setCountyIdx] = useState(-1)
  const [coreMsg, setCoreMsg]     = useState(false)
  const [payoff, setPayoff]       = useState(false)
  const [landed, setLanded]       = useState(false)   // brief flash once the counter finishes
  const [hvhz, setHvhz]           = useState(false)
  const [cta, setCta]             = useState(false)
  const [logo, setLogo]           = useState(false)
  const timers = useRef([])
  const anims  = useRef([])

  function cleanup() {
    timers.current.forEach(clearTimeout); timers.current = []
    anims.current.forEach(a => a.stop && a.stop()); anims.current = []
  }
  function t(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  function run() {
    cleanup()
    setScene('hook')
    setLitCount(0); setCountyIdx(-1)
    setCoreMsg(false); setPayoff(false); setLanded(false); setHvhz(false); setCta(false); setLogo(false)

    t(() => setScene('tri'), T.triIn)
    t(() => {
      // progress value drives how many cities (south→north) have
      // mounted — a dot that hasn't been reached yet simply isn't in
      // the DOM.
      anims.current.push(animate(0, 1, {
        duration: SWEEP_S, ease: 'linear',
        onUpdate: v => setLitCount(Math.floor(v * TOTAL_CITIES)),
      }))
    }, T.sweepStart)

    // county-name crossfade: each county gets an equal, comfortably
    // readable slice of the window between the cascade starting and the
    // HVHZ scene taking over — not a duration proportional to how many
    // cities that county has, which used to leave Miami-Dade and Broward
    // flashing by while Palm Beach (last, holding until hvhzIn) got most
    // of the time.
    const countySlot = (T.hvhzIn - T.sweepStart) / COUNTIES.length
    COUNTIES.forEach((co, i) => {
      t(() => setCountyIdx(i), T.sweepStart + i * countySlot)
    })

    // payoff lands first — right as the cascade finishes, biggest beat
    // in the piece — core message follows as smaller supporting copy
    t(() => setPayoff(true),  T.payoffIn)
    t(() => setCoreMsg(true), T.coreMsgIn)

    t(() => { setScene('hvhz'); setCoreMsg(false); setPayoff(false) }, T.hvhzIn)
    t(() => setHvhz(true), T.hvhzIn + 400)

    t(() => { setScene('mat'); setHvhz(false) }, T.matIn)
    t(() => setScene('end'), T.endIn)
    t(() => setCta(true),  T.ctaIn)
    t(() => setLogo(true), T.logoIn)
    t(run, T.loop)
  }

  useEffect(() => { run(); return cleanup }, [])

  const isMap = scene === 'tri' || scene === 'hvhz' || scene === 'mat'
  const westCopy = scene === 'tri' ? 'core' : scene === 'hvhz' ? 'hvhz' : null

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      overflow: 'hidden', position: 'relative', fontFamily: 'Inter, sans-serif',
    }}>

      {/* ── HOOK ── */}
      <AnimatePresence>
        {scene === 'hook' && (
          <motion.div
            key="hook"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 8vw', textAlign: 'center',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em',
                fontSize: 'clamp(1.7rem, 5.4vw, 3.4rem)', lineHeight: 1.25,
                textShadow: '0 0 40px rgba(212,175,55,0.18)',
              }}
            >
              {strings.hookLine1}
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
                style={{ color: '#D4AF37', display: 'block', marginTop: '0.4em' }}
              >
                {strings.hookLine2}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TRI-COUNTY MAP ── */}
      <AnimatePresence>
        {isMap && (
          <motion.div
            key="tri"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
                    const c    = COUNTY_STYLE[Number(geo.id)]
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

              {Object.entries(COUNTY_STYLE).map(([fips, c]) => (
                <Marker key={fips} coordinates={c.labelCoords}>
                  <text textAnchor="middle" style={{
                    fill: hvhz ? 'rgba(255,255,255,0.65)' : 'rgba(212,175,55,0.62)',
                    fontSize: '15px', fontFamily: 'monospace', fontWeight: 800,
                    letterSpacing: '0.18em', userSelect: 'none', transition: 'fill 1.1s ease',
                    filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.35))',
                  }}>
                    {COUNTIES.find(co => co.fips === Number(fips)).name}
                  </text>
                </Marker>
              ))}

              {/* ── city dots — each mounts (and so ignites) the instant
                   the sweep reaches it; nothing north of the line exists
                   in the DOM yet ── */}
              {ALL_CITIES.slice(0, litCount).map(m => (
                <Marker key={m.n} coordinates={m.c}>
                  <CityDot coastal={COASTAL.has(m.n)} />
                </Marker>
              ))}

              {/* ── current-county crossfade label ── */}
              <AnimatePresence mode="wait">
                {countyIdx >= 0 && scene === 'tri' && (
                  <Marker key={countyIdx} coordinates={COUNTY_STYLE[COUNTIES[countyIdx].fips].labelCoords}>
                    <motion.text
                      textAnchor="middle"
                      initial={{ opacity: 0, y: 10, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                      style={{
                        fill: '#F2D782', fontSize: '25px', fontWeight: 900,
                        fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em',
                        filter: 'drop-shadow(0 0 18px rgba(212,175,55,0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
                        transformOrigin: 'center',
                      }}
                    >
                      {COUNTIES[countyIdx].name}
                    </motion.text>
                  </Marker>
                )}
              </AnimatePresence>
            </ComposableMap>

            {/* ── WEST / EVERGLADES-SPACE COPY — bold callouts in the
                 naturally empty western third of the map, replacing the
                 old cramped bottom caption strip ── */}
            <div style={{
              position: 'absolute', left: '4%', top: 0, bottom: 0, width: '36%',
              display: 'flex', alignItems: 'center', pointerEvents: 'none',
            }}>
              <AnimatePresence mode="wait">
                {westCopy === 'core' && (
                  <motion.div key="core"
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* ── PAYOFF — the loudest moment in the piece. Lands
                         the instant the cascade finishes, and gets the
                         biggest type of anything on screen so nothing
                         after it competes for the hit. The count is
                         paired with what it means for the contractor,
                         not left as a bare stat. ── */}
                    {payoff && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        style={{ marginBottom: '1.3rem' }}
                      >
                        <motion.div
                          animate={landed ? { scale: [1, 1.14, 1] } : {}}
                          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                          style={{
                            color: '#D4AF37', fontSize: 'clamp(3.2rem,9vw,5.6rem)',
                            fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em',
                            fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
                            textShadow: landed
                              ? '0 0 80px rgba(242,215,130,0.9), 0 0 30px rgba(255,255,255,0.5)'
                              : '0 0 55px rgba(212,175,55,0.45)',
                            transformOrigin: 'left center',
                            transition: 'text-shadow 0.4s ease',
                          }}
                        >
                          <Counter target={TOTAL_CITIES} running={payoff} onDone={() => setLanded(true)} />
                        </motion.div>
                        <div style={{
                          color: '#F2D782', fontSize: 'clamp(0.7rem,1.8vw,0.92rem)', letterSpacing: '0.22em',
                          textTransform: 'uppercase', fontWeight: 800, marginTop: '0.5rem', fontFamily: 'monospace',
                        }}>
                          {strings.cap1label}
                        </div>
                        <div style={{
                          color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.55rem',
                          lineHeight: 1.4, maxWidth: '17rem',
                        }}>
                          {strings.payoffBenefit}
                        </div>
                      </motion.div>
                    )}
                    {/* ── core message — supporting copy, deliberately
                         smaller than the payoff above so it doesn't
                         compete with it ── */}
                    {coreMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div style={{
                          color: '#D4AF37', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.3em',
                          textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'monospace',
                        }}>
                          {strings.coreEyebrow}
                        </div>
                        <div style={{
                          color: 'rgba(255,255,255,0.88)', fontSize: 'clamp(0.88rem,2.2vw,1.15rem)',
                          fontWeight: 700, lineHeight: 1.35, maxWidth: '18rem',
                        }}>
                          {strings.coreMain}
                        </div>
                        <div style={{
                          color: 'rgba(255,255,255,0.42)', fontSize: '0.66rem', marginTop: '0.55rem',
                          lineHeight: 1.4, maxWidth: '17rem',
                        }}>
                          {strings.coreSub}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {westCopy === 'hvhz' && (
                  <motion.div key="hvhz"
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <motion.div
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '2px', width: '2.4rem', background: '#D4AF37', marginBottom: '1rem', transformOrigin: 'left' }}
                    />
                    <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 'clamp(0.95rem,2.4vw,1.25rem)', fontWeight: 700, lineHeight: 1.4, marginBottom: '0.5rem', maxWidth: '19rem' }}>
                      {strings.hvhzLine1}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.68rem,1.7vw,0.85rem)', fontWeight: 400, lineHeight: 1.5, marginBottom: '0.7rem', maxWidth: '18rem' }}>
                      {strings.hvhzLine2}
                    </div>
                    <div style={{ color: 'rgba(212,175,55,0.75)', fontSize: '0.66rem', letterSpacing: '0.04em', fontStyle: 'italic', maxWidth: '17rem' }}>
                      {strings.hvhzTagline}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MATERIALS CAPTION (unchanged placement — bottom band) ── */}
      <AnimatePresence mode="wait">
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

      {/* ── CTA — specific and benefit-loaded, not a generic "learn
           more." Framed as one small, easy first step (the free
           estimate credit), not a sales pitch. ── */}
      <AnimatePresence>
        {cta && (
          <motion.div key="cta"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 2rem', textAlign: 'center',
            }}
          >
            <div style={{
              color: '#F2D782', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.32em',
              textTransform: 'uppercase', marginBottom: '0.9rem', fontFamily: 'monospace',
            }}>
              {strings.ctaMicro}
            </div>
            <div style={{
              color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15,
              fontSize: 'clamp(1.5rem,4.6vw,2.7rem)', textShadow: '0 0 40px rgba(212,175,55,0.2)',
              maxWidth: '30rem',
            }}>
              {strings.ctaMain}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.7rem,1.8vw,0.88rem)',
              marginTop: '0.9rem', maxWidth: '22rem', lineHeight: 1.45,
            }}>
              {strings.ctaSub}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 30%, rgba(8,8,8,0.5) 68%, #080808 100%)',
      }} />
    </div>
  )
}

const EN = {
  hookLine1:     "South Florida's best contractors don't guess.",
  hookLine2:     'Are you one of them?',
  cap1label:     'Cities · Zero Guesswork',
  payoffBenefit: 'Never guess a permit fee again.',
  coreEyebrow:   'Built City By City',
  coreMain:      "Generic tools lump Fort Lauderdale into “Broward.” We don't.",
  coreSub:       "Every municipality priced on its own — never averaged into the county.",
  hvhzLine1:     'HVHZ · Miami-Dade & Broward',
  hvhzLine2:     '40-Year Recertification · Miami-Dade & Broward, Coastal Municipalities Following Suit',
  hvhzTagline:   'We price to the code that actually applies to your job.',
  cap3eyebrow:   'Materials Pricing',
  cap3main:      'Electrical · Plumbing · HVAC · Painting',
  cap3sub:       'Pro-tier pricing — tri-county wide.',
  headline:      'South Florida',
  ctaMicro:      'One Estimate · No Sales Call',
  ctaMain:       'Get Your First Estimate Free',
  ctaSub:        "See your city's real numbers — not a county average.",
  url:           'even-os.com',
}

const ES = {
  hookLine1:     'Los mejores contratistas del Sur de Florida no adivinan.',
  hookLine2:     '¿Eres uno de ellos?',
  cap1label:     'Ciudades · Cero Adivinanzas',
  payoffBenefit: 'Nunca más adivines una tarifa de permiso.',
  coreEyebrow:   'Ciudad Por Ciudad',
  coreMain:      'Las herramientas genéricas meten Fort Lauderdale en "Broward." Nosotros no.',
  coreSub:       'Cada municipio con su propio precio — nunca promediado por condado.',
  hvhzLine1:     'HVHZ · Miami-Dade y Broward',
  hvhzLine2:     'Recertificación de 40 Años · Miami-Dade y Broward, Municipios Costeros en Seguimiento',
  hvhzTagline:   'Cotizamos según el código que aplica a tu trabajo.',
  cap3eyebrow:   'Precios de Materiales',
  cap3main:      'Eléctrico · Plomería · HVAC · Pintura',
  cap3sub:       'Precio de nivel profesional — tri-condado.',
  headline:      'Sur de Florida',
  ctaMicro:      'Un Estimado · Sin Llamada de Ventas',
  ctaMain:       'Obtén Tu Primer Estimado Gratis',
  ctaSub:        'Mira los números reales de tu ciudad — no un promedio del condado.',
  url:           'even-os.com',
}

export default function SouthFlorida() {
  return <SouthFloridaBase strings={EN} />
}

export function SouthFloridaES() {
  return <SouthFloridaBase strings={ES} />
}
