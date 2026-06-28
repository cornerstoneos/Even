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

function StaggerBody({ body }) {
  const lines = body.split('\n')
  let g = 0
  const allWords = lines.map(line =>
    line.split(' ').map(word => ({ word, delay: 0.28 + g++ * 0.065 }))
  )
  return (
    <div>
      {allWords.map((words, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', lineHeight: 1.2 }}>
          {words.map(({ word, delay }, wi) => (
            <motion.span
              key={wi}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'inline-block', marginRight: '0.28em', marginBottom: '0.08em' }}
            >
              {word}
            </motion.span>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function WhoWeAre() {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showTagline, setShowTagline] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setActiveIndex(-1)
    setShowTagline(false)
    setShowLogo(false)
  }

  function run() {
    reset()
    SECTIONS.forEach((s, i) => {
      timers.current.push(setTimeout(() => setActiveIndex(i), s.at))
    })
    timers.current.push(setTimeout(() => setShowTagline(true), TAGLINE_AT))
    timers.current.push(setTimeout(() => setShowLogo(true), LOGO_AT))
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout) }, [])

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#080808',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative',
      }}
    >
      {/* Top progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 10 }}>
        <motion.div
          animate={{
            width: showTagline
              ? '100%'
              : activeIndex >= 0
                ? `${((activeIndex + 1) / SECTIONS.length) * 100}%`
                : '0%',
          }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: '#D4AF37', borderRadius: '0 1px 1px 0' }}
        />
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        {!showTagline && activeIndex >= 0 && (
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10, filter: 'blur(3px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', maxWidth: '600px', padding: '0 2rem', width: '100%' }}
          >
            {/* Label + counter */}
            <div
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: '1rem', marginBottom: '1.5rem',
              }}
            >
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                style={{
                  color: '#D4AF37', fontSize: '0.55rem',
                  letterSpacing: '0.45em', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                {SECTIONS[activeIndex].label}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.28 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                style={{
                  color: '#ffffff', fontSize: '0.5rem',
                  letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums', fontWeight: 500,
                }}
              >
                {String(activeIndex + 1).padStart(2, '0')} / {String(SECTIONS.length).padStart(2, '0')}
              </motion.div>
            </div>

            {/* Divider under label */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '1px', background: 'rgba(212,175,55,0.15)',
                marginBottom: '1.5rem', transformOrigin: 'center',
              }}
            />

            {/* Body text with word stagger */}
            <div
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)',
                fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.025em',
              }}
            >
              <StaggerBody body={SECTIONS[activeIndex].body} />
            </div>
          </motion.div>
        )}

        {showTagline && (
          <motion.div
            key="tagline"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', maxWidth: '680px', padding: '0 2rem' }}
          >
            <div
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 300, lineHeight: 1.3, letterSpacing: '-0.01em',
              }}
            >
              You run the business.
            </div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.65, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '1px', background: 'rgba(212,175,55,0.3)',
                margin: '0.9rem auto', width: '2.5rem', transformOrigin: 'center',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
              style={{
                color: '#ffffff',
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.025em',
              }}
            >
              We run the numbers.
            </motion.div>
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
              position: 'absolute', bottom: '2rem', left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.4rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 600 }}>
              even-os.com
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
