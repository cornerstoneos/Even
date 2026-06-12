import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SECTIONS = [
  {
    label: 'What We Are',
    body: 'Even is the estimating engine\nfor modern contractors.',
    at: 800,
  },
  {
    label: 'Who We Serve',
    body: 'Roofing. HVAC. Electrical. Plumbing.\nAny trade bidding real jobs.',
    at: 6000,
  },
  {
    label: 'When We Show Up',
    body: 'Before you price the job.\nBefore you walk out the door.',
    at: 11200,
  },
  {
    label: 'Where We Work',
    body: '7 states. 30+ cities.\n20+ live permit databases.',
    at: 16400,
  },
  {
    label: 'Why We Exist',
    body: "Because contractors\nshouldn't have to guess.",
    at: 21600,
  },
]

const TAGLINE_AT = 25500
const LOGO_AT = 27500
const LOOP = 32000

export default function WhoWeAre() {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showTagline, setShowTagline] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const [clearing, setClearing] = useState(false)
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setActiveIndex(-1)
    setShowTagline(false)
    setShowLogo(false)
    setClearing(false)
  }

  function run() {
    reset()

    SECTIONS.forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        setActiveIndex(i)
      }, s.at))
    })

    // Clear sections before tagline
    timers.current.push(setTimeout(() => setClearing(true), 24500))

    timers.current.push(setTimeout(() => setShowTagline(true), TAGLINE_AT))
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
      {/* Section content */}
      <AnimatePresence mode="wait">
        {!showTagline && activeIndex >= 0 && (
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: clearing ? 0 : 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{
              opacity: { duration: clearing ? 0.8 : 0.7, ease: 'easeOut' },
              y: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            }}
            style={{
              textAlign: 'center',
              maxWidth: '600px',
              padding: '0 2rem',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{
                color: '#D4AF37',
                fontSize: '0.55rem',
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: '1.25rem',
              }}
            >
              {SECTIONS[activeIndex].label}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {SECTIONS[activeIndex].body.split('\n').map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: '-0.025em',
                  }}
                >
                  {line}
                </div>
              ))}
            </motion.div>

            {/* Progress dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              style={{
                display: 'flex',
                gap: '0.4rem',
                justifyContent: 'center',
                marginTop: '2rem',
              }}
            >
              {SECTIONS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === activeIndex ? '1.5rem' : '0.4rem',
                    height: '0.2rem',
                    borderRadius: '999px',
                    background: i === activeIndex ? '#D4AF37' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.4s ease',
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tagline */}
      <AnimatePresence>
        {showTagline && (
          <motion.div
            key="tagline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              textAlign: 'center',
              maxWidth: '680px',
              padding: '0 2rem',
            }}
          >
            <div
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 300,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              You run the business.
            </div>
            <div
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 800,
                lineHeight: 1.3,
                letterSpacing: '-0.025em',
              }}
            >
              We run the numbers.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo */}
      <AnimatePresence>
        {showLogo && (
          <motion.div
            key="logo"
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
