import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHASES = {
  b0: 800,    b0x: 3900,
  b1: 4300,   b1x: 6600,
  b2: 7000,   b2x: 9900,
  b3: 10300,  b3x: 12800,
  b4: 13200,  b4x: 15200,
  b5: 15600,  b5x: 17800,
  b6: 18200,  b6x: 20000,
  brand: 20400,
  logo: 22500,
}
const LOOP = 26500

function Beat({ text, size, weight = 700, color = '#ffffff', lineHeight = 1.2, wordDelay = 0 }) {
  const lines = text.split('\n')
  let g = 0
  const rows = lines.map(line => line.split(' ').map(word => ({ word, delay: wordDelay + g++ * 0.07 })))
  return (
    <motion.div
      initial={{ y: 16 }}
      animate={{ y: 0 }}
      exit={{ opacity: 0, x: -26, filter: 'blur(5px)' }}
      transition={{ duration: 0.35, ease: [0.4, 0, 1, 1] }}
      style={{ fontSize: size, fontWeight: weight, color, lineHeight, letterSpacing: '-0.02em' }}
    >
      {rows.map((words, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap' }}>
          {words.map(({ word, delay }, wi) => (
            <motion.span
              key={wi}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'inline-block', marginRight: '0.28em', marginBottom: '0.06em' }}
            >
              {word}
            </motion.span>
          ))}
        </div>
      ))}
    </motion.div>
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

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#080808',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative',
      }}
    >
      {/* Gold bloom on brand */}
      <motion.div
        animate={{ opacity: p.brand ? 0.12 : 0, scale: p.brand ? 1.8 : 0.5 }}
        transition={{ duration: 2.8, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at 28% 52%, rgba(212,175,55,0.9) 0%, transparent 52%)',
        }}
      />

      <div style={{ width: '100%', maxWidth: '640px', padding: '0 2.5rem', position: 'relative' }}>
        <AnimatePresence>

          {/* Beat 0 — opener */}
          {p.b0 && !p.b0x && (
            <Beat
              key="b0"
              text={"The contractor who wins the bid\nisn't smarter than you."}
              size="clamp(1.45rem, 4.4vw, 2.2rem)"
              weight={700}
            />
          )}

          {/* Beat 1 */}
          {p.b1 && !p.b1x && (
            <Beat
              key="b1"
              text={"He's not faster.\nHe's not cheaper."}
              size="clamp(1.25rem, 3.8vw, 1.9rem)"
              weight={600}
              color="rgba(255,255,255,0.78)"
            />
          )}

          {/* Beat 2 — pivot, with rule wipe */}
          {p.b2 && !p.b2x && (
            <motion.div
              key="b2"
              initial={{ y: 16 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, x: -26, filter: 'blur(5px)' }}
              transition={{ duration: 0.35, ease: [0.4, 0, 1, 1] }}
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, #D4AF37, rgba(212,175,55,0))',
                  marginBottom: '0.85rem', transformOrigin: 'left',
                }}
              />
              <div style={{ fontSize: 'clamp(1.55rem, 4.8vw, 2.4rem)', fontWeight: 700, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                {['He', 'knows', 'his', 'numbers.'].map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.22 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'inline-block', marginRight: '0.28em' }}
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Beat 3 — the specifics */}
          {p.b3 && !p.b3x && (
            <Beat
              key="b3"
              text={"Permit fees. Local labor rates.\nReal material costs."}
              size="clamp(1.35rem, 4vw, 2rem)"
              weight={600}
            />
          )}

          {/* Beat 4 — the contrast, dimmer italic */}
          {p.b4 && !p.b4x && (
            <Beat
              key="b4"
              text={"Not guesses. Not last year's prices.\nNot what his cousin told him."}
              size="clamp(1rem, 3vw, 1.5rem)"
              weight={400}
              color="rgba(255,255,255,0.4)"
              lineHeight={1.4}
            />
          )}

          {/* Beat 5 — the verdict */}
          {p.b5 && !p.b5x && (
            <Beat
              key="b5"
              text={"The guys losing bids\nare pricing jobs blind."}
              size="clamp(1.45rem, 4.4vw, 2.2rem)"
              weight={700}
            />
          )}

          {/* Beat 6 — the punchline */}
          {p.b6 && !p.b6x && (
            <Beat
              key="b6"
              text={"The guys winning them\naren't."}
              size="clamp(1.45rem, 4.4vw, 2.2rem)"
              weight={700}
            />
          )}

          {/* Brand */}
          {p.brand && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 30, scale: 0.88 }}
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
