import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'

const LOOP = 22000

const PHASES = {
  nav: 400,
  cameraRoll: 1200,
  select: 2600,
  uploadStart: 3300,
  uploadDone: 4600,
  formSection: 5200,
  jobType: 5400,
  location: 6000,
  size: 6500,
  runBtn: 7100,
  runTap: 7700,
  permitLabel: 8200,
  permitLoading: 8400,
  permitRows: 9600,
  estimateLabel: 11600,
  estimateRows: 12000,
  total: 13800,
  bid: 14800,
  exportBtn: 15800,
  addHome: 17200,
  logo: 19000,
}

// Blueprint thumbnail grid
function BlueprintThumb({ selected, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay }}
      style={{
        aspectRatio: '1',
        background: selected ? '#0d1520' : '#111',
        border: `1.5px solid ${selected ? '#D4AF37' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '6px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s ease',
        cursor: 'default',
      }}
    >
      {/* Blueprint grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(80,120,200,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(80,120,200,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '10px 10px',
        }}
      />
      {/* Floor plan shapes */}
      <div style={{ position: 'absolute', top: '18%', left: '12%', right: '35%', bottom: '18%', border: '1px solid rgba(80,140,220,0.25)' }} />
      <div style={{ position: 'absolute', top: '18%', left: '68%', right: '10%', bottom: '40%', border: '1px solid rgba(80,140,220,0.2)' }} />
      <div style={{ position: 'absolute', top: '62%', left: '68%', right: '10%', bottom: '18%', border: '1px solid rgba(80,140,220,0.2)' }} />
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#D4AF37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

                {/* Thumbnail grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <BlueprintThumb key={i} selected={p.select && i === 2} delay={i * 0.06} />
                  ))}
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
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 16px 3px rgba(212,175,55,0.18)', '0 0 0 0 rgba(212,175,55,0)'] }}
                    transition={{ duration: 1.8, repeat: 2, ease: 'easeInOut' }}
                    style={{
                      background: '#D4AF37',
                      color: '#080808',
                      borderRadius: '4px',
                      padding: '0.7rem',
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Export PDF ↗
                  </motion.div>
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
