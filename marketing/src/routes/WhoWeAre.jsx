import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SECTIONS = [
  {
    label: 'The Tool',
    body: "Knows what a permit costs in your city\nbefore you pull one.",
    at: 800,
  },
  {
    label: 'Right Now',
    body: "Knows what labor runs in your zip code\nright now.",
    at: 6000,
  },
  {
    label: 'Under 2 Minutes',
    body: "Prices your job with local data\nyou can't get anywhere else.",
    at: 11200,
  },
  {
    label: 'Not This',
    body: "Not a spreadsheet.\nNot a guess. Not your cousin's number from 2022.",
    at: 16400,
  },
  {
    label: 'Already Knows You',
    body: 'It already knows your market.',
    at: 21600,
  },
]

const BRAND_AT = 25500
const TAGLINE_AT = 27200
const LOGO_AT = 28800
const LOOP = 33000

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
  const [showBrand, setShowBrand] = useState(false)
  const [showTagline, setShowTagline] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setActiveIndex(-1)
    setShowBrand(false)
    setShowTagline(false)
    setShowLogo(false)
  }

  function run() {
    reset()
    SECTIONS.forEach((s, i) => {
      timers.current.push(setTimeout(() => setActiveIndex(i), s.at))
    })
    timers.current.push(setTimeout(() => setShowBrand(true), BRAND_AT))
    timers.current.push(setTimeout(() => setShowTagline(true), TAGLINE_AT))
    timers.current.push(setTimeout(() => setShowLogo(true), LOGO_AT))
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout) }, [])

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#080808',
        backgroundImage: "repeating-linear-gradient(60deg,rgba(212,175,55,0.032) 0,rgba(212,175,55,0.032) 1px,transparent 0,transparent 50%),repeating-linear-gradient(-60deg,rgba(212,175,55,0.032) 0,rgba(212,175,55,0.032) 1px,transparent 0,transparent 50%)",
        backgroundSize: '28px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative',
      }}
    >
      {/* Top progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 10 }}>
        <motion.div
          animate={{
            width: showBrand
              ? '100%'
              : activeIndex >= 0
                ? `${((activeIndex + 1) / SECTIONS.length) * 100}%`
                : '0%',
          }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: '#D4AF37', borderRadius: '0 1px 1px 0' }}
        />
      </div>

      {/* Gold bloom behind brand */}
      <motion.div
        animate={{ opacity: showBrand ? 0.1 : 0, scale: showBrand ? 1.6 : 0.6 }}
        transition={{ duration: 2.5, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(212,175,55,0.9) 0%, transparent 55%)',
        }}
      />

      {/* Main content */}
      <AnimatePresence mode="wait">
        {!showBrand && activeIndex >= 0 && (
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
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}
            >
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.45em', textTransform: 'uppercase', fontWeight: 700 }}
              >
                {SECTIONS[activeIndex].label}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.28 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                style={{ color: '#ffffff', fontSize: '0.5rem', letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
              >
                {String(activeIndex + 1).padStart(2, '0')} / {String(SECTIONS.length).padStart(2, '0')}
              </motion.div>
            </div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '1px', background: 'rgba(212,175,55,0.15)', marginBottom: '1.5rem', transformOrigin: 'center' }}
            />

            {/* Body */}
            <div style={{ color: '#ffffff', fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.025em' }}>
              <StaggerBody body={SECTIONS[activeIndex].body} />
            </div>
          </motion.div>
        )}

        {showBrand && (
          <motion.div
            key="brand"
            initial={{ opacity: 0, y: 24, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', padding: '0 2rem' }}
          >
            <div
              style={{
                color: '#D4AF37',
                fontSize: 'clamp(3.5rem, 13vw, 7.5rem)',
                fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95,
                marginBottom: showTagline ? '1.5rem' : 0,
              }}
            >
              Even.
            </div>

            <AnimatePresence>
              {showTagline && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div style={{ color: '#ffffff', fontSize: 'clamp(1.2rem, 3.5vw, 1.75rem)', fontWeight: 300, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                    You run the business.
                  </div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '1px', background: 'rgba(212,175,55,0.3)', margin: '0.85rem auto', width: '2.5rem', transformOrigin: 'center' }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    style={{ color: '#ffffff', fontSize: 'clamp(1.2rem, 3.5vw, 1.75rem)', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.025em' }}
                  >
                    We run the numbers.
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
