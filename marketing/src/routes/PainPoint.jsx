import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHASES = {
  line0: 800,
  line1: 3100,
  line2: 5400,
  line3: 7700,
  dim: 9300,
  exitPain: 10100,
  pivot: 11000,
  brand: 14200,
  sub: 15300,
  logo: 17800,
}

const LINES = ['I used to guess.', 'Lost jobs.', 'Left money.', 'Bid wrong.']
const LOOP = 21500

function WordReveal({ text }) {
  const words = text.split(' ')
  return (
    <div style={{ fontSize: 'clamp(1.8rem, 5.5vw, 2.6rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: '#ffffff' }}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline-block', marginRight: '0.3em' }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

export default function PainPoint() {
  const [p, setP] = useState({})
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setP({})
  }

  function run() {
    reset()
    Object.entries(PHASES).forEach(([key, delay]) => {
      timers.current.push(setTimeout(() => setP(prev => ({ ...prev, [key]: true })), delay))
    })
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout) }, [])

  const showPain = !p.exitPain
  const showPivot = !!(p.pivot && !p.brand)
  const showBrand = !!p.brand

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#080808',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative',
      }}
    >
      {/* Ambient gold bloom — grows on brand */}
      <motion.div
        animate={{ opacity: showBrand ? 0.13 : 0, scale: showBrand ? 1.7 : 0.5 }}
        transition={{ duration: 2.8, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 55%, rgba(212,175,55,0.9) 0%, transparent 55%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '640px', padding: '0 2.5rem', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {showPain && (
            <motion.div
              key="pain"
              animate={{ opacity: p.dim ? 0.08 : 1 }}
              exit={{ opacity: 0, x: -30, filter: 'blur(6px)' }}
              transition={{ duration: 0.55, ease: [0.4, 0, 1, 1] }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', position: 'relative', paddingLeft: '1.35rem' }}
            >
              {/* Left accent line */}
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: p.dim ? 0 : 1, opacity: p.dim ? 0 : 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute', left: 0, top: '0.15rem', bottom: '0.15rem',
                  width: '2px',
                  background: 'linear-gradient(180deg, #D4AF37, rgba(212,175,55,0.04))',
                  borderRadius: '1px', transformOrigin: 'top',
                }}
              />
              {LINES.map((text, i) => (
                p[`line${i}`] && <WordReveal key={i} text={text} />
              ))}
            </motion.div>
          )}

          {showPivot && (
            <motion.div
              key="pivot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Rule wipe */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, #D4AF37, rgba(212,175,55,0))',
                  marginBottom: '1.75rem', transformOrigin: 'left',
                }}
              />
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.95, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  color: 'rgba(255,255,255,0.58)', margin: 0,
                  fontSize: 'clamp(1rem, 2.8vw, 1.4rem)',
                  fontWeight: 400, lineHeight: 1.5, fontStyle: 'italic', letterSpacing: '-0.01em',
                }}
              >
                Built the thing I wish I had.
              </motion.p>
            </motion.div>
          )}

          {showBrand && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 28, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                style={{
                  color: '#D4AF37',
                  fontSize: 'clamp(3.5rem, 14vw, 8rem)',
                  fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95,
                }}
              >
                Even.
              </div>
              <AnimatePresence>
                {p.sub && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      color: 'rgba(255,255,255,0.22)',
                      fontSize: 'clamp(0.65rem, 2vw, 0.85rem)',
                      letterSpacing: '0.06em', fontWeight: 300,
                      marginTop: '1.1rem',
                    }}
                  >
                    Built for the way you actually work.
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logo */}
      <AnimatePresence>
        {p.logo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.4rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.55rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 600 }}>even-os.com</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
