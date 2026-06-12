import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LINES = [
  { text: 'I used to guess.', at: 800, size: 'lg', weight: 700 },
  { text: 'Lost jobs.', at: 3200, size: 'lg', weight: 700 },
  { text: 'Left money.', at: 5400, size: 'lg', weight: 700 },
  { text: 'Bid wrong.', at: 7600, size: 'lg', weight: 700 },
]

const PIVOT = {
  text: 'Built the thing I wish I had.',
  at: 10800,
}

const BRAND = {
  text: 'Even.',
  at: 14200,
}

const LOGO_AT = 16800
const LOOP = 21000

export default function PainPoint() {
  const [visibleLines, setVisibleLines] = useState([])
  const [showPivot, setShowPivot] = useState(false)
  const [showBrand, setShowBrand] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const [dim, setDim] = useState(false)
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setVisibleLines([])
    setShowPivot(false)
    setShowBrand(false)
    setShowLogo(false)
    setDim(false)
  }

  function run() {
    reset()

    LINES.forEach((line, i) => {
      timers.current.push(setTimeout(() => {
        setVisibleLines(prev => [...prev, i])
      }, line.at))
    })

    // Dim the initial lines before pivot
    timers.current.push(setTimeout(() => setDim(true), 9800))

    timers.current.push(setTimeout(() => setShowPivot(true), PIVOT.at))
    timers.current.push(setTimeout(() => setShowBrand(true), BRAND.at))
    timers.current.push(setTimeout(() => setShowLogo(true), LOGO_AT))

    timers.current.push(setTimeout(run, LOOP))
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '0 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}
      >
        {/* Opening lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '2.5rem' }}>
          {LINES.map((line, i) => (
            <AnimatePresence key={i}>
              {visibleLines.includes(i) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{
                    opacity: dim ? 0.2 : 1,
                    y: 0,
                  }}
                  transition={{
                    opacity: { duration: dim ? 1.2 : 0.7, ease: 'easeOut' },
                    y: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                  }}
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {line.text}
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>

        {/* Pivot line */}
        <AnimatePresence>
          {showPivot && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
                marginBottom: '1.75rem',
                fontStyle: 'italic',
              }}
            >
              {PIVOT.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brand reveal */}
        <AnimatePresence>
          {showBrand && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <span
                style={{
                  color: '#D4AF37',
                  fontSize: 'clamp(3rem, 10vw, 6rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  display: 'block',
                }}
              >
                {BRAND.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logo lockup */}
      <AnimatePresence>
        {showLogo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              position: 'absolute',
              bottom: '2rem',
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
              style={{ height: '1.4rem', objectFit: 'contain' }}
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
    </div>
  )
}
