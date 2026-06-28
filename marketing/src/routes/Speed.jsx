import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate } from 'framer-motion'

// ─── VOICE TIMESTAMP MARKERS ────────────────────────────────────────────────
// Layer ElevenLabs audio against these ms offsets when mixing in post:
//   00:00  ring fires    → "Client's calling. They need a number."
//   00:04  jobType fires → [ambient / silence while Even fills in]
//   00:09  permitLabel   → "Permit fees. Live."
//   00:13  estimateLabel → "Estimate generating."
//   00:16  total locks   → "Done."
//   00:18  tagline1      → "Do the work. We'll handle the bid."
//   00:20  tagline2      → "Focus on the job. Even's got the estimate."
// ────────────────────────────────────────────────────────────────────────────

const LOOP = 25000

const PHASES = {
  ring: 400,
  answer: 3300,
  nav: 3800,
  form: 4200,
  jobType: 4500,
  location: 5400,
  size: 6100,
  runBtn: 6800,
  runTap: 7400,
  permitLabel: 7900,
  permitLoading: 8100,
  permitRows: 9500,
  estimateLabel: 11600,
  estimateRows: 12000,
  total: 14000,
  tagline1: 16500,
  tagline2: 18200,
  logo: 20000,
}

const STRINGS_EN = {
  callerName: 'Ryan H.',
  callerSub: 'Incoming Call',
  decline: 'Decline',
  accept: 'Accept',
  newEstimate: 'New Estimate',
  jobDetails: 'Job Details',
  jobTypeLabel: 'Job Type',
  jobTypeValue: 'Roofing Replacement',
  locationLabel: 'Location',
  locationValue: 'Houston, TX',
  sizeLabel: 'Size',
  sizeValue: '3,200 sq ft',
  getEstimate: 'Get Estimate →',
  permitData: 'Permit Data',
  pullingPermit: 'Pulling Harris County permit data...',
  cityFee: 'City Application Fee',
  stateFee: 'State Filing Fee',
  inspections: 'Required Inspections (×2)',
  totalFees: 'Total Fees',
  estimate: 'Estimate',
  materials: 'Materials',
  labor: 'Labor',
  permitsLabel: 'Permits & Fees',
  overhead: 'Overhead (12%)',
  total: 'Total',
  tagline1: "Do the work. We'll handle the bid.",
  tagline2: "Focus on the job. Even's got the estimate.",
}

const STRINGS_ES = {
  callerName: 'Carlos M.',
  callerSub: 'Llamada Entrante',
  decline: 'Rechazar',
  accept: 'Aceptar',
  newEstimate: 'Nuevo Estimado',
  jobDetails: 'Detalles del Trabajo',
  jobTypeLabel: 'Tipo de Trabajo',
  jobTypeValue: 'Reemplazo de Techo',
  locationLabel: 'Ubicación',
  locationValue: 'Houston, TX',
  sizeLabel: 'Tamaño',
  sizeValue: '3,200 pies²',
  getEstimate: 'Obtener Estimado →',
  permitData: 'Datos de Permisos',
  pullingPermit: 'Obteniendo permisos de Harris County...',
  cityFee: 'Tarifa de Solicitud',
  stateFee: 'Tarifa Estatal',
  inspections: 'Inspecciones Requeridas (×2)',
  totalFees: 'Total de Tarifas',
  estimate: 'Estimado',
  materials: 'Materiales',
  labor: 'Mano de Obra',
  permitsLabel: 'Permisos y Tarifas',
  overhead: 'Gastos Generales (12%)',
  total: 'Total',
  tagline1: 'Haz el trabajo. Nosotros manejamos la oferta.',
  tagline2: 'Concéntrate en el trabajo. Even tiene el estimado.',
}

// ─── UTILS ──────────────────────────────────────────────────────────────────

function fmt(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

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
  return <>{shown}{shown.length < text.length && active && <span style={{ opacity: 0.4 }}>|</span>}</>
}

function CountUp({ to, running }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: v => setVal(Math.floor(v)) })
    return () => ctrl.stop()
  }, [running, to])
  return <>{val.toLocaleString()}</>
}

function FormRow({ label, value, active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '0.5rem 0.7rem', color: '#fff', fontSize: '0.75rem', fontWeight: 500, minHeight: '2.1rem' }}>
            <TypeIn text={value} active={active} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, delay, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay }}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.68rem' }}>{label}</span>
          <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SectionLabel({ children, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          style={{ color: '#D4AF37', fontSize: '0.48rem', letterSpacing: '0.38em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── PHONE FRAME ────────────────────────────────────────────────────────────

function PhoneFrame({ children }) {
  return (
    <div style={{
      position: 'relative', width: 'min(300px, 86vw)', flexShrink: 0,
      background: '#1c1c1e', borderRadius: '44px', padding: '10px',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.03)',
    }}>
      <div style={{
        background: '#080808', borderRadius: '36px', overflow: 'hidden',
        position: 'relative', display: 'flex', flexDirection: 'column',
        height: 'min(620px, 82vh)',
      }}>
        {/* Dynamic Island */}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 110, height: 30, background: '#000', borderRadius: '20px', zIndex: 20 }} />
        <div style={{ height: 48, flexShrink: 0 }} />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', flexShrink: 0 }}>
          <div style={{ width: 110, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '999px' }} />
        </div>
      </div>
      {[100, 148, 196].map((top, i) => (
        <div key={i} style={{ position: 'absolute', left: -3, top, width: 3, height: i === 0 ? 28 : 52, background: '#2e2e30', borderRadius: '2px 0 0 2px' }} />
      ))}
      <div style={{ position: 'absolute', right: -3, top: 150, width: 3, height: 70, background: '#2e2e30', borderRadius: '0 2px 2px 0' }} />
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

function SpeedBase({ strings }) {
  const [p, setP] = useState({})
  const timers = useRef([])
  const callInterval = useRef(null)
  const [callSecs, setCallSecs] = useState(0)

  function reset() {
    timers.current.forEach(t => typeof t === 'function' ? t() : clearTimeout(t))
    timers.current = []
    if (callInterval.current) { clearInterval(callInterval.current); callInterval.current = null }
    setP({})
    setCallSecs(0)
  }

  function run() {
    reset()
    Object.entries(PHASES).forEach(([key, delay]) => {
      timers.current.push(setTimeout(() => setP(prev => ({ ...prev, [key]: true })), delay))
    })
    // Start call timer on answer
    timers.current.push(setTimeout(() => {
      setCallSecs(0)
      callInterval.current = setInterval(() => setCallSecs(s => s + 1), 1000)
    }, PHASES.answer))
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => { run(); return reset }, [])

  const showCall = p.ring && !p.answer
  const showApp = p.answer && !p.tagline1
  const showFinal = !!p.tagline1

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#080808',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      <PhoneFrame>
        <AnimatePresence mode="wait">

          {/* ── 1. INCOMING CALL ── */}
          {showCall && (
            <motion.div
              key="call"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.4, 0, 1, 1] }}
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(160deg, #0e1420 0%, #080808 60%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '2.5rem 2rem 2rem',
              }}
            >
              {/* Pulse rings */}
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.8 + i * 0.3], opacity: [0.3, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', top: '2.5rem',
                    width: 72, height: 72, borderRadius: '50%',
                    border: '1px solid rgba(212,175,55,0.4)',
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(212,175,55,0.12)',
                  border: '1.5px solid rgba(212,175,55,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1rem', position: 'relative', zIndex: 1,
                }}
              >
                <span style={{ color: '#D4AF37', fontSize: '1.5rem', fontWeight: 700 }}>
                  {strings.callerName[0]}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.45 }}
                style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}
              >
                {strings.callerName}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 0.35 }}
                style={{ color: '#fff', fontSize: '0.65rem', letterSpacing: '0.04em', marginBottom: 'auto' }}
              >
                {strings.callerSub}
              </motion.div>

              {/* Answer / Decline */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', gap: '3.5rem', width: '100%', justifyContent: 'center', paddingBottom: '1rem' }}
              >
                {/* Decline */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M19.59 7c.37.85.41 1.42.1 1.73l-2.06 2.06c-.3.3-.83.37-1.57.21-.74-.16-1.56-.55-2.44-1.18-.88-.62-1.66-1.35-2.3-2.19-.63-.83-1.05-1.65-1.22-2.44-.17-.78-.1-1.33.22-1.63L12.38 1.5c.32-.32.9-.28 1.75.12L16.19 3c.84.39 1.02.89.59 1.5l-1.35 1.85c.5.76 1.08 1.44 1.75 2.04L19.59 7z" transform="rotate(135 12 12)"/>
                    </svg>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.58rem' }}>{strings.decline}</span>
                </div>
                {/* Accept */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: 54, height: 54, borderRadius: '50%', background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </motion.div>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.58rem' }}>{strings.accept}</span>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── 2. EVEN APP (call active) ── */}
          {showApp && (
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              {/* Active call banner */}
              <motion.div
                initial={{ y: -28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: '#34C759', padding: '0.28rem 1rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 700 }}>{strings.callerName}</span>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {fmt(callSecs)}
                </span>
              </motion.div>

              {/* Nav */}
              <AnimatePresence>
                {p.nav && (
                  <motion.div
                    key="nav"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}
                  >
                    <img src="/logo.png" alt="Even" style={{ height: '1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37' }} />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.58rem' }}>{strings.newEstimate}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Form */}
                <AnimatePresence>
                  {p.form && !p.permitLabel && (
                    <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}>
                        {strings.jobDetails}
                      </div>
                      <FormRow label={strings.jobTypeLabel} value={strings.jobTypeValue} active={p.jobType} />
                      <FormRow label={strings.locationLabel} value={strings.locationValue} active={p.location} />
                      <FormRow label={strings.sizeLabel} value={strings.sizeValue} active={p.size} />
                      <AnimatePresence>
                        {p.runBtn && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                            <motion.div
                              animate={p.runTap ? { scale: [1, 0.96, 1] } : {}}
                              transition={{ duration: 0.18 }}
                              style={{ background: '#D4AF37', color: '#080808', borderRadius: '4px', padding: '0.65rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                            >
                              {strings.getEstimate}
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Permits */}
                <div>
                  <SectionLabel visible={p.permitLabel}>{strings.permitData}</SectionLabel>
                  <AnimatePresence>
                    {p.permitLoading && !p.permitRows && (
                      <motion.div key="permit-load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37' }} />
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem' }}>{strings.pullingPermit}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {p.permitRows && (
                    <div>
                      <Row label={strings.cityFee} value="$847" delay={0} visible={p.permitRows} />
                      <Row label={strings.stateFee} value="$120" delay={0.14} visible={p.permitRows} />
                      <Row label={strings.inspections} value="$250" delay={0.28} visible={p.permitRows} />
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                        style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{strings.totalFees}</span>
                        <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.7rem' }}>$1,217</span>
                      </motion.div>
                    </div>
                  )}
                </div>

                {/* Estimate */}
                <div>
                  <SectionLabel visible={p.estimateLabel}>{strings.estimate}</SectionLabel>
                  {p.estimateRows && (
                    <div>
                      <Row label={strings.materials} value="$14,800" delay={0} visible={p.estimateRows} />
                      <Row label={strings.labor} value="$9,400" delay={0.13} visible={p.estimateRows} />
                      <Row label={strings.permitsLabel} value="$1,217" delay={0.26} visible={p.estimateRows} />
                      <Row label={strings.overhead} value="$3,051" delay={0.39} visible={p.estimateRows} />
                    </div>
                  )}
                  <AnimatePresence>
                    {p.total && (
                      <motion.div key="total" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.52rem', letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 600 }}>{strings.total}</span>
                        <motion.span
                          animate={{ color: ['#ffffff', '#D4AF37'] }}
                          transition={{ delay: 1.9, duration: 0.5 }}
                          style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}
                        >
                          $<CountUp to={28468} running={p.total} />
                        </motion.span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}

          {/* ── 3. END FRAME ── */}
          {showFinal && (
            <motion.div
              key="final"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '2rem 1.5rem', textAlign: 'center',
              }}
            >
              {/* Gold rule */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '1px', width: '2.5rem', background: '#D4AF37', marginBottom: '1.5rem', transformOrigin: 'center' }}
              />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.01em', marginBottom: '0.75rem' }}
              >
                {strings.tagline1}
              </motion.div>
              <AnimatePresence>
                {p.tagline2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.72rem', fontWeight: 400, lineHeight: 1.5 }}
                  >
                    {strings.tagline2}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </PhoneFrame>

      {/* Logo below phone */}
      <AnimatePresence>
        {p.logo && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            style={{ position: 'absolute', bottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.45rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 600 }}>even-os.com</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Speed() {
  return <SpeedBase strings={STRINGS_EN} />
}

export function SpeedES() {
  return <SpeedBase strings={STRINGS_ES} />
}
