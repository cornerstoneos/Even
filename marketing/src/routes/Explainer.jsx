import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'

const LOOP = 30000

const PHASES = {
  nav: 400,
  cameraRoll: 1400,
  select: 3200,
  uploadStart: 4200,
  scanLine: 4400,
  uploadDone: 6200,
  formSection: 7400,
  jobType: 7700,
  location: 8500,
  size: 9200,
  runBtn: 10000,
  runTap: 10800,
  permitLabel: 11500,
  permitLoading: 11800,
  permitRows: 13200,
  estimateLabel: 15500,
  estimateRows: 16000,
  total: 18200,
  bid: 19400,
  exportBtn: 20800,
  addHome: 23000,
  logo: 25500,
}

// Readable floor plan blueprint
function FloorPlan({ selected, scanning, analyzed }) {
  const line = 'rgba(80,140,220,0.5)'
  const dim = 'rgba(80,140,220,0.25)'
  const label = 'rgba(100,160,255,0.55)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        width: '100%',
        background: '#090e1a',
        border: `1.5px solid ${selected ? '#D4AF37' : 'rgba(80,140,220,0.2)'}`,
        borderRadius: '6px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.4s ease',
        padding: '1rem',
      }}
    >
      {/* Blueprint grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(80,120,200,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(80,120,200,0.07) 1px, transparent 1px)`,
        backgroundSize: '14px 14px',
      }} />

      {/* Floor plan SVG */}
      <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
        {/* Outer walls */}
        <rect x="10" y="10" width="180" height="110" fill="none" stroke={line} strokeWidth="2.5" />

        {/* Interior walls */}
        {/* Vertical divide ~55% */}
        <line x1="110" y1="10" x2="110" y2="80" stroke={line} strokeWidth="1.5" />
        {/* Horizontal divide in right section */}
        <line x1="110" y1="55" x2="190" y2="55" stroke={line} strokeWidth="1.5" />
        {/* Horizontal divide left section */}
        <line x1="10" y1="75" x2="110" y2="75" stroke={line} strokeWidth="1.5" />

        {/* Doors (arcs) */}
        <path d="M110 75 Q95 75 95 60" fill="none" stroke={dim} strokeWidth="1" />
        <path d="M110 55 Q125 55 125 40" fill="none" stroke={dim} strokeWidth="1" />

        {/* Windows */}
        <line x1="30" y1="10" x2="60" y2="10" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />
        <line x1="130" y1="10" x2="170" y2="10" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />
        <line x1="190" y1="30" x2="190" y2="50" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />

        {/* Room labels */}
        <text x="55" y="48" textAnchor="middle" style={{ fontSize: '7px', fill: label, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>LIVING</text>
        <text x="55" y="95" textAnchor="middle" style={{ fontSize: '7px', fill: label, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>KITCHEN</text>
        <text x="150" y="38" textAnchor="middle" style={{ fontSize: '7px', fill: label, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>BED 1</text>
        <text x="150" y="90" textAnchor="middle" style={{ fontSize: '7px', fill: label, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>BED 2</text>

        {/* Dimension lines */}
        <line x1="10" y1="125" x2="190" y2="125" stroke={dim} strokeWidth="0.8" markerEnd="url(#arr)" />
        <text x="100" y="123" textAnchor="middle" style={{ fontSize: '5.5px', fill: 'rgba(80,140,220,0.4)', fontFamily: 'Inter,sans-serif' }}>48 ft</text>
        <line x1="4" y1="10" x2="4" y2="120" stroke={dim} strokeWidth="0.8" />
        <text x="2" y="68" textAnchor="middle" style={{ fontSize: '5.5px', fill: 'rgba(80,140,220,0.4)', fontFamily: 'Inter,sans-serif' }} transform="rotate(-90 2 68)">50 ft</text>
      </svg>

      {/* Scan line animation */}
      {scanning && !analyzed && (
        <motion.div
          initial={{ top: '0%' }}
          animate={{ top: '100%' }}
          transition={{ duration: 1.6, ease: 'linear' }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.8), transparent)',
            boxShadow: '0 0 8px rgba(212,175,55,0.4)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Analyzed overlay */}
      {analyzed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'absolute',
            top: 6, right: 6,
            background: 'rgba(212,175,55,0.12)',
            border: '1px solid rgba(212,175,55,0.4)',
            borderRadius: '3px',
            padding: '3px 7px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ color: '#D4AF37', fontSize: '0.55rem', fontWeight: 700 }}>✓ Plans read</span>
        </motion.div>
      )}

      {/* Selected checkmark */}
      {selected && !analyzed && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 18, height: 18, borderRadius: '50%',
          background: '#D4AF37',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </motion.div>
  )
}

// Typing text effect
function TypeIn({ text, active, speed = 38 }) {
  const [shown, setShown] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!active) { setShown(''); return }
    let i = 0
    ref.current = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(ref.current)
    }, speed)
    return () => clearInterval(ref.current)
  }, [active, text])

  return (
    <>
      {shown}
      {shown.length < text.length && active && (
        <span style={{ opacity: 0.5, animation: 'subtlePulse 0.6s ease-in-out infinite' }}>|</span>
      )}
    </>
  )
}

function CountUp({ to, running, prefix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setVal(Math.floor(v)),
    })
    return () => ctrl.stop()
  }, [running, to])
  return <>{prefix}{val.toLocaleString()}</>
}

function FormRow({ label, value, active, typeDelay = 0 }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>
            {label}
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              padding: '0.6rem 0.8rem',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 500,
              minHeight: '2.4rem',
            }}
          >
            <TypeIn text={value} active={active} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function EstimateRow({ label, value, delay, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.5rem 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{label}</span>
          <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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
          transition={{ duration: 0.5 }}
          style={{
            color: '#D4AF37',
            fontSize: '0.52rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '0.6rem',
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Explainer() {
  const [p, setP] = useState({})
  const timers = useRef([])
  const [uploadPct, setUploadPct] = useState(0)

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setP({})
    setUploadPct(0)
  }

  function run() {
    reset()
    Object.entries(PHASES).forEach(([key, delay]) => {
      timers.current.push(setTimeout(() => {
        setP(prev => ({ ...prev, [key]: true }))
      }, delay))
    })

    // Animate upload bar
    timers.current.push(setTimeout(() => {
      const ctrl = animate(0, 100, {
        duration: 1.2,
        ease: 'easeInOut',
        onUpdate: v => setUploadPct(Math.floor(v)),
      })
      timers.current.push(() => ctrl.stop())
    }, PHASES.uploadStart))

    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => {
    run()
    return () => timers.current.forEach(t => typeof t === 'function' ? t() : clearTimeout(t))
  }, [])

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
        position: 'relative',
      }}
    >
      {/* Mobile-width container */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 1.25rem',
          overflow: 'hidden',
        }}
      >
        {/* Nav */}
        <AnimatePresence>
          {p.nav && (
            <motion.div
              key="nav"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 0 1rem',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <img
                src="/logo.png"
                alt="Even"
                style={{ height: '1.2rem', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4AF37' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                  New Estimate
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1.25rem', paddingBottom: '1rem' }}>

          {/* Camera roll section */}
          <AnimatePresence>
            {p.cameraRoll && !p.formSection && (
              <motion.div
                key="camera-roll"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
              >
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '0.75rem' }}>
                  Upload Plans
                </div>

                {/* Floor plan */}
                <div style={{ marginBottom: '1rem' }}>
                  <FloorPlan
                    selected={p.select}
                    scanning={p.scanLine && !p.uploadDone}
                    analyzed={p.uploadDone}
                  />
                </div>

                {/* Upload progress */}
                <AnimatePresence>
                  {p.uploadStart && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
                          {p.uploadDone ? '✓ Plans ready' : 'Uploading plans...'}
                        </span>
                        <span style={{ color: p.uploadDone ? '#D4AF37' : 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>
                          {p.uploadDone ? '100%' : `${uploadPct}%`}
                        </span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                        <motion.div
                          animate={{ width: p.uploadDone ? '100%' : `${uploadPct}%` }}
                          transition={{ duration: 0.1 }}
                          style={{
                            height: '100%',
                            background: p.uploadDone ? '#D4AF37' : 'rgba(212,175,55,0.6)',
                            borderRadius: '999px',
                            transition: 'background 0.4s ease',
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form section (auto-populated from upload) */}
          <AnimatePresence>
            {p.formSection && !p.permitLabel && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>
                  Job Details
                </div>

                <FormRow label="Job Type" value="Roofing Replacement" active={p.jobType} />
                <FormRow label="Location" value="Miami, FL" active={p.location} />
                <FormRow label="Size" value="2,400 sq ft" active={p.size} />

                <AnimatePresence>
                  {p.runBtn && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      style={{ marginTop: '0.25rem' }}
                    >
                      <motion.div
                        animate={p.runTap ? { scale: [1, 0.96, 1] } : {}}
                        transition={{ duration: 0.2 }}
                        style={{
                          background: '#D4AF37',
                          color: '#080808',
                          borderRadius: '4px',
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'default',
                        }}
                      >
                        Get Estimate →
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Permit section */}
          <div>
            <SectionLabel visible={p.permitLabel}>Permit Data</SectionLabel>

            <AnimatePresence>
              {p.permitLoading && !p.permitRows && (
                <motion.div
                  key="permit-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      border: '1.5px solid rgba(212,175,55,0.25)',
                      borderTopColor: '#D4AF37',
                    }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.7rem' }}>Pulling Miami-Dade permit data...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {p.permitRows && (
              <div>
                <EstimateRow label="City Application Fee" value="$847" delay={0} visible={p.permitRows} />
                <EstimateRow label="State Filing Fee" value="$120" delay={0.15} visible={p.permitRows} />
                <EstimateRow label="Required Inspections (×2)" value="$250" delay={0.3} visible={p.permitRows} />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Fees</span>
                  <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.78rem' }}>$1,217</span>
                </motion.div>
              </div>
            )}
          </div>

          {/* Estimate section */}
          <div>
            <SectionLabel visible={p.estimateLabel}>Estimate</SectionLabel>

            {p.estimateRows && (
              <div>
                <EstimateRow label="Materials" value="$12,450" delay={0} visible={p.estimateRows} />
                <EstimateRow label="Labor" value="$8,200" delay={0.14} visible={p.estimateRows} />
                <EstimateRow label="Permits & Fees" value="$1,217" delay={0.28} visible={p.estimateRows} />
                <EstimateRow label="Overhead (12%)" value="$2,630" delay={0.42} visible={p.estimateRows} />
              </div>
            )}

            <AnimatePresence>
              {p.total && (
                <motion.div
                  key="total"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total
                  </span>
                  <span style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
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
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  style={{ marginTop: '1rem' }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.52rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Bid Range
                  </div>
                  <div style={{ position: 'relative', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px' }}>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(212,175,55,0.3), #D4AF37, rgba(212,175,55,0.3))', borderRadius: '999px', transformOrigin: 'left' }}
                    />
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      style={{ position: 'absolute', left: '58%', top: '-3px', width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37', transform: 'translateX(-50%)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', fontVariantNumeric: 'tabular-nums' }}>
                    <span>$21,000</span>
                    <span style={{ color: 'rgba(212,175,55,0.7)', fontWeight: 600 }}>$24,497</span>
                    <span>$28,000</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Export */}
            <AnimatePresence>
              {p.exportBtn && (
                <motion.div
                  key="export"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ marginTop: '1.25rem' }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <motion.div
                      animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 16px 3px rgba(212,175,55,0.18)', '0 0 0 0 rgba(212,175,55,0)'] }}
                      transition={{ duration: 1.8, repeat: 2, ease: 'easeInOut' }}
                      style={{
                        flex: 1,
                        background: '#D4AF37',
                        color: '#080808',
                        borderRadius: '4px',
                        padding: '0.7rem 0.5rem',
                        textAlign: 'center',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Client Proposal ↗
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: '1px solid rgba(212,175,55,0.35)',
                        color: '#D4AF37',
                        borderRadius: '4px',
                        padding: '0.7rem 0.5rem',
                        textAlign: 'center',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Internal Cost
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Add to Home Screen prompt */}
      <AnimatePresence>
        {p.addHome && !p.logo && (
          <motion.div
            key="add-home"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(15,15,15,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              padding: '1rem 1.5rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: '#D4AF37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#080808', fontWeight: 900, fontSize: '0.7rem', letterSpacing: '-0.02em' }}>E</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.15rem' }}>
                Add Even to your Home Screen
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.62rem' }}>
                Tap ↑ Share → "Add to Home Screen"
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', lineHeight: 1 }}>×</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo */}
      <AnimatePresence>
        {p.logo && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            style={{
              padding: '0.75rem 0 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1.1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.48rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 600 }}>
              even-os.com
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
