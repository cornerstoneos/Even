import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const MARKETS = [
  {
    name: 'Florida',
    cities: [
      { name: 'Miami', coords: [-80.19, 25.76] },
      { name: 'Orlando', coords: [-81.38, 28.54] },
      { name: 'Tampa', coords: [-82.46, 27.95] },
    ],
    delay: 2000,
  },
  {
    name: 'Georgia',
    cities: [
      { name: 'Atlanta', coords: [-84.39, 33.75] },
      { name: 'Savannah', coords: [-81.10, 32.08] },
    ],
    delay: 5200,
  },
  {
    name: 'South Carolina',
    cities: [
      { name: 'Charleston', coords: [-79.93, 32.78] },
      { name: 'Columbia', coords: [-81.03, 34.00] },
    ],
    delay: 8400,
  },
  {
    name: 'North Carolina',
    cities: [
      { name: 'Charlotte', coords: [-80.84, 35.23] },
      { name: 'Raleigh', coords: [-78.64, 35.78] },
    ],
    delay: 11600,
  },
  {
    name: 'Tennessee',
    cities: [
      { name: 'Nashville', coords: [-86.78, 36.16] },
      { name: 'Memphis', coords: [-90.05, 35.15] },
    ],
    delay: 14800,
  },
  {
    name: 'Texas',
    cities: [
      { name: 'Houston', coords: [-95.37, 29.76] },
      { name: 'Dallas', coords: [-96.80, 32.78] },
      { name: 'Austin', coords: [-97.74, 30.27] },
    ],
    delay: 18000,
  },
  {
    name: 'Arizona',
    cities: [
      { name: 'Phoenix', coords: [-112.07, 33.45] },
      { name: 'Scottsdale', coords: [-111.93, 33.49] },
    ],
    delay: 21200,
  },
]

const LOOP = 31000

function Counter({ target, running, suffix = '' }) {
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
  return <>{val}{suffix}</>
}

export default function Map() {
  const [activeStates, setActiveStates] = useState(new Set())
  const [visibleCities, setVisibleCities] = useState(new Set())
  const [showTitle, setShowTitle] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showTagline, setShowTagline] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setActiveStates(new Set())
    setVisibleCities(new Set())
    setShowTitle(false)
    setShowStats(false)
    setShowTagline(false)
    setShowLogo(false)
  }

  function schedule(fn, delay) {
    timers.current.push(setTimeout(fn, delay))
  }

  function run() {
    reset()
    schedule(() => setShowTitle(true), 400)

    MARKETS.forEach(m => {
      schedule(() => setActiveStates(prev => new Set([...prev, m.name])), m.delay)
      schedule(() => setVisibleCities(prev => new Set([...prev, m.name])), m.delay + 500)
    })

    schedule(() => setShowStats(true), 23000)
    schedule(() => setShowTagline(true), 25500)
    schedule(() => setShowLogo(true), 27500)
    schedule(run, LOOP)
  }

  useEffect(() => {
    run()
    return () => timers.current.forEach(clearTimeout)
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080808',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 860 }}
          width={960}
          height={560}
          style={{ width: '86vw', height: 'auto', maxHeight: '68vh', overflow: 'visible' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const active = activeStates.has(geo.properties.name)
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={active ? '#D4AF37' : '#171717'}
                    stroke="#080808"
                    strokeWidth={0.8}
                    style={{
                      default: {
                        outline: 'none',
                        cursor: 'default',
                        transition: 'fill 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: active
                          ? 'drop-shadow(0 0 6px rgba(212,175,55,0.55)) drop-shadow(0 0 16px rgba(212,175,55,0.2))'
                          : 'none',
                        animation: active ? 'stateGlow 3s ease-in-out infinite' : 'none',
                      },
                      hover: { outline: 'none', fill: active ? '#dfc145' : '#1f1f1f' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {MARKETS.map(market =>
            visibleCities.has(market.name)
              ? market.cities.map(city => (
                  <Marker key={`${market.name}-${city.name}`} coordinates={city.coords}>
                    <circle
                      r={2.5}
                      fill="#ffffff"
                      opacity={0.9}
                      style={{ animation: 'dotPulse 2.5s ease-in-out infinite' }}
                    />
                    <circle r={6} fill="rgba(255,255,255,0.08)" />
                    <text
                      textAnchor="middle"
                      y={-10}
                      style={{
                        fill: 'rgba(255,255,255,0.8)',
                        fontSize: '6.5px',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {city.name}
                    </text>
                  </Marker>
                ))
              : null
          )}
        </ComposableMap>
      </div>

      {/* Title */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                color: '#D4AF37',
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
              }}
            >
              Active Markets
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              bottom: '8.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '5rem',
              alignItems: 'flex-end',
            }}
          >
            {[
              { target: 7, suffix: '', label: 'States' },
              { target: 30, suffix: '+', label: 'Cities' },
              { target: 20, suffix: '+', label: 'Permit Databases' },
            ].map(({ target, suffix, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    color: '#D4AF37',
                    fontSize: '4rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  <Counter target={target} running={showStats} suffix={suffix} />
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    marginTop: '0.5rem',
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tagline */}
      <AnimatePresence>
        {showTagline && (
          <motion.div
            key="tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              position: 'absolute',
              bottom: '5.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                fontWeight: 300,
              }}
            >
              We operate everywhere. These markets have the real numbers.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo lockup */}
      <AnimatePresence>
        {showLogo && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              position: 'absolute',
              bottom: '1.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <img
              src="/logo.png"
              alt="Even"
              style={{ height: '1.6rem', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}
            />
            <span
              style={{
                color: '#D4AF37',
                fontSize: '0.55rem',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              even-os.com
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, #080808 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
