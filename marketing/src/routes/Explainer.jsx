import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'

const LOOP = 22000

function CountUp({ to, running, prefix = '', decimals = 0 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v =>
        setVal(decimals > 0 ? v.toFixed(decimals) : Math.floor(v)),
    })
    return () => ctrl.stop()
  }, [running, to])
  return <>{prefix}{typeof val === 'number' ? val.toLocaleString() : val}</>
}

function Row({ label, value, delay, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.6rem 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', letterSpacing: '0.03em' }}>
            {label}
          </span>
          <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SectionLabel({ children, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{
            color: '#D4AF37',
            fontSize: '0.55rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '0.25rem',
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const PHASES = {
  nav: 400,
  project: 1200,
  permit_label: 3200,
  permit_loading: 3600,
  permit_rows: 4800,
  estimate_label: 7800,
  estimate_rows: 8400,
  total: 11000,
  bid: 12200,
  export_btn: 13600,
  logo: 16500,
}

export default function Explainer() {
  const [phase, setPhase] = useState({})
  const timers = useRef([])

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase({})
  }

  function run() {
    reset()
    Object.entries(PHASES).forEach(([key, delay]) => {
      timers.current.push(setTimeout(() => {
        setPhase(p => ({ ...p, [key]: true }))
      }, delay))
    })
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => {
    run()
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const p = phase

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080808',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Nav */}
      <AnimatePresence>
        {p.nav && (
          <motion.div
            key="nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '1.5rem 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <img
              src="/logo.png"
              alt="Even"
              style={{ height: '1.4rem', objectFit: 'contain' }}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <span
              style={{
                display: 'none',
                color: '#D4AF37',
                fontWeight: 900,
                fontSize: '1rem',
                letterSpacing: '-0.02em',
              }}
            >
              EVEN
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4AF37', opacity: 0.8 }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                New Estimate
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <AnimatePresence>
        {p.nav && (
          <motion.div
            key="divider-top"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
              marginTop: '1.25rem',
              transformOrigin: 'left',
            }}
          />
        )}
      </AnimatePresence>

      {/* Main panel */}
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          flex: 1,
          padding: '2rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '2.25rem',
        }}
      >
        {/* Project section */}
        <div>
          <SectionLabel visible={p.project}>Project</SectionLabel>

          <AnimatePresence>
            {p.project && (
              <motion.div
                key="project-block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                <div
                  style={{
                    borderLeft: '2px solid #D4AF37',
                    paddingLeft: '1rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3 }}>
                    Residential Roofing Replacement
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.3rem', letterSpacing: '0.04em' }}>
                    Miami, FL 33101 &nbsp;·&nbsp; 2,400 sq ft &nbsp;·&nbsp; Permit-required
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Permit section */}
        <div>
          <SectionLabel visible={p.permit_label}>Permit Data</SectionLabel>

          <AnimatePresence>
            {p.permit_loading && (
              <motion.div
                key="permit-loading"
                initial={{ opacity: 0 }}
                animate={p.permit_rows ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginTop: '0.5rem',
                  paddingBottom: '0.5rem',
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(212,175,55,0.3)',
                    borderTopColor: '#D4AF37',
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  Pulling Miami-Dade Building Dept...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {p.permit_rows && (
            <div style={{ marginTop: '0.25rem' }}>
              <Row label="City Application Fee" value="$847" delay={0} visible={p.permit_rows} />
              <Row label="State Filing Fee" value="$120" delay={0.18} visible={p.permit_rows} />
              <Row label="Required Inspections (×2)" value="$250" delay={0.36} visible={p.permit_rows} />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.6rem',
                  marginTop: '0.1rem',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Total Permit Fees
                </span>
                <span style={{ color: '#D4AF37', fontSize: '0.82rem', fontWeight: 700 }}>$1,217</span>
              </motion.div>
            </div>
          )}
        </div>

        {/* Divider */}
        <AnimatePresence>
          {p.estimate_label && (
            <motion.div
              key="divider-mid"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '1px',
                background: 'rgba(255,255,255,0.06)',
                transformOrigin: 'left',
                marginTop: '-1rem',
              }}
            />
          )}
        </AnimatePresence>

        {/* Estimate section */}
        <div>
          <SectionLabel visible={p.estimate_label}>Estimate</SectionLabel>

          {p.estimate_rows && (
            <div style={{ marginTop: '0.25rem' }}>
              <Row label="Materials" value="$12,450" delay={0} visible={p.estimate_rows} />
              <Row label="Labor" value="$8,200" delay={0.15} visible={p.estimate_rows} />
              <Row label="Permits & Fees" value="$1,217" delay={0.3} visible={p.estimate_rows} />
              <Row label="Overhead & Margin (12%)" value="$2,630" delay={0.45} visible={p.estimate_rows} />
            </div>
          )}

          {/* Total */}
          <AnimatePresence>
            {p.total && (
              <motion.div
                key="total"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Total Estimate
                </span>
                <span
                  style={{
                    color: '#fff',
                    fontSize: '2.25rem',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  $<CountUp to={24497} running={p.total} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bid range */}
          <AnimatePresence>
            {p.bid && (
              <motion.div
                key="bid"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                style={{ marginTop: '1.5rem' }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.25)',
                    fontSize: '0.55rem',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: '0.6rem',
                  }}
                >
                  Bid Range
                </div>
                <div style={{ position: 'relative', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px' }}>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      position: 'absolute',
                      left: '0%',
                      right: '0%',
                      top: 0,
                      bottom: 0,
                      background: 'linear-gradient(90deg, rgba(212,175,55,0.3), #D4AF37, rgba(212,175,55,0.3))',
                      borderRadius: '999px',
                      transformOrigin: 'left',
                    }}
                  />
                  {/* Marker at ~60% (our price) */}
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.1 }}
                    style={{
                      position: 'absolute',
                      left: '58%',
                      top: '-3px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: '#D4AF37',
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '0.68rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span>$21,000</span>
                  <span style={{ color: 'rgba(212,175,55,0.7)', fontSize: '0.72rem', fontWeight: 600 }}>$24,497</span>
                  <span>$28,000</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Export button */}
          <AnimatePresence>
            {p.export_btn && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ marginTop: '2rem' }}
              >
                <motion.button
                  animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 20px 4px rgba(212,175,55,0.2)', '0 0 0 0 rgba(212,175,55,0)'] }}
                  transition={{ duration: 2, repeat: 2, ease: 'easeInOut' }}
                  style={{
                    background: '#D4AF37',
                    color: '#080808',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Export PDF ↗
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom logo */}
      <AnimatePresence>
        {p.logo && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            style={{
              padding: '1rem 0 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.2rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.5rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 600 }}>
              even-os.com
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
