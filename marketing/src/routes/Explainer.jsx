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

const STRINGS_EN = {
  newEstimate: 'New Estimate',
  uploadPlans: 'Upload Plans',
  uploadingPlans: 'Uploading plans...',
  plansReady: '✓ Plans ready',
  plansRead: '✓ Plans read',
  jobDetails: 'Job Details',
  jobTypeLabel: 'Job Type',
  jobTypeValue: 'Roofing Replacement',
  locationLabel: 'Location',
  locationValue: 'Miami, FL',
  sizeLabel: 'Size',
  sizeValue: '2,400 sq ft',
  getEstimate: 'Get Estimate →',
  permitData: 'Permit Data',
  pullingPermit: 'Pulling Miami-Dade permit data...',
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
  bidRange: 'Bid Range',
  clientProposal: 'Client Proposal ↗',
  internalCost: 'Internal Cost',
  addHome: 'Add Even to your Home Screen',
  addHomeSub: 'Tap ↑ Share → "Add to Home Screen"',
}

const STRINGS_ES = {
  newEstimate: 'Nuevo Estimado',
  uploadPlans: 'Subir Planos',
  uploadingPlans: 'Subiendo planos...',
  plansReady: '✓ Planos listos',
  plansRead: '✓ Planos leídos',
  jobDetails: 'Detalles del Trabajo',
  jobTypeLabel: 'Tipo de Trabajo',
  jobTypeValue: 'Reemplazo de Techo',
  locationLabel: 'Ubicación',
  locationValue: 'Miami, FL',
  sizeLabel: 'Tamaño',
  sizeValue: '2,400 pies cuadrados',
  getEstimate: 'Obtener Estimado →',
  permitData: 'Datos de Permisos',
  pullingPermit: 'Obteniendo permisos de Miami-Dade...',
  cityFee: 'Tarifa de Solicitud Ciudad',
  stateFee: 'Tarifa Estatal',
  inspections: 'Inspecciones Requeridas (×2)',
  totalFees: 'Total de Tarifas',
  estimate: 'Estimado',
  materials: 'Materiales',
  labor: 'Mano de Obra',
  permitsLabel: 'Permisos y Tarifas',
  overhead: 'Gastos Generales (12%)',
  total: 'Total',
  bidRange: 'Rango de Propuesta',
  clientProposal: 'Propuesta al Cliente ↗',
  internalCost: 'Costo Interno',
  addHome: 'Agrega Even a tu Pantalla de Inicio',
  addHomeSub: 'Toca ↑ Compartir → "Agregar a Inicio"',
}

// Phone frame wrapper
function PhoneFrame({ children }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 'min(300px, 86vw)',
        flexShrink: 0,
        background: '#1c1c1e',
        borderRadius: '44px',
        padding: '10px',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      {/* Screen */}
      <div
        style={{
          background: '#080808',
          borderRadius: '36px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: 'min(620px, 82vh)',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 110,
            height: 30,
            background: '#000',
            borderRadius: '20px',
            zIndex: 20,
          }}
        />
        {/* Status bar space */}
        <div style={{ height: 48, flexShrink: 0 }} />

        {/* Scrollable screen content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>

        {/* Home indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', flexShrink: 0 }}>
          <div style={{ width: 110, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: '999px' }} />
        </div>
      </div>

      {/* Volume buttons (left) */}
      {[100, 148, 196].map((top, i) => (
        <div key={i} style={{ position: 'absolute', left: -3, top, width: 3, height: i === 0 ? 28 : 52, background: '#2e2e30', borderRadius: '2px 0 0 2px' }} />
      ))}
      {/* Power button (right) */}
      <div style={{ position: 'absolute', right: -3, top: 150, width: 3, height: 70, background: '#2e2e30', borderRadius: '0 2px 2px 0' }} />
    </div>
  )
}

// Floor plan blueprint
function FloorPlan({ selected, scanning, analyzed, plansRead }) {
  const line = 'rgba(80,140,220,0.5)'
  const dim = 'rgba(80,140,220,0.25)'
  const lbl = 'rgba(100,160,255,0.55)'

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
        padding: '0.75rem',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(80,120,200,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(80,120,200,0.07) 1px, transparent 1px)`, backgroundSize: '14px 14px' }} />

      <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
        <rect x="10" y="10" width="180" height="110" fill="none" stroke={line} strokeWidth="2.5" />
        <line x1="110" y1="10" x2="110" y2="80" stroke={line} strokeWidth="1.5" />
        <line x1="110" y1="55" x2="190" y2="55" stroke={line} strokeWidth="1.5" />
        <line x1="10" y1="75" x2="110" y2="75" stroke={line} strokeWidth="1.5" />
        <path d="M110 75 Q95 75 95 60" fill="none" stroke={dim} strokeWidth="1" />
        <path d="M110 55 Q125 55 125 40" fill="none" stroke={dim} strokeWidth="1" />
        <line x1="30" y1="10" x2="60" y2="10" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />
        <line x1="130" y1="10" x2="170" y2="10" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />
        <line x1="190" y1="30" x2="190" y2="50" stroke="rgba(150,200,255,0.6)" strokeWidth="2.5" />
        <text x="55" y="48" textAnchor="middle" style={{ fontSize: '7px', fill: lbl, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>LIVING</text>
        <text x="55" y="95" textAnchor="middle" style={{ fontSize: '7px', fill: lbl, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>KITCHEN</text>
        <text x="150" y="38" textAnchor="middle" style={{ fontSize: '7px', fill: lbl, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>BED 1</text>
        <text x="150" y="90" textAnchor="middle" style={{ fontSize: '7px', fill: lbl, fontFamily: 'Inter,sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>BED 2</text>
        <line x1="10" y1="125" x2="190" y2="125" stroke={dim} strokeWidth="0.8" />
        <text x="100" y="123" textAnchor="middle" style={{ fontSize: '5.5px', fill: 'rgba(80,140,220,0.4)', fontFamily: 'Inter,sans-serif' }}>48 ft</text>
        <line x1="4" y1="10" x2="4" y2="120" stroke={dim} strokeWidth="0.8" />
        <text x="2" y="68" textAnchor="middle" style={{ fontSize: '5.5px', fill: 'rgba(80,140,220,0.4)', fontFamily: 'Inter,sans-serif' }} transform="rotate(-90 2 68)">50 ft</text>
      </svg>

      {scanning && !analyzed && (
        <motion.div
          initial={{ top: '0%' }}
          animate={{ top: '100%' }}
          transition={{ duration: 1.6, ease: 'linear' }}
          style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.9), transparent)', boxShadow: '0 0 10px rgba(212,175,55,0.5)', pointerEvents: 'none' }}
        />
      )}

      {analyzed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '3px', padding: '3px 7px' }}
        >
          <span style={{ color: '#D4AF37', fontSize: '0.52rem', fontWeight: 700 }}>{plansRead}</span>
        </motion.div>
      )}

      {selected && !analyzed && (
        <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </motion.div>
  )
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
  return <>{shown}{shown.length < text.length && active && <span style={{ opacity: 0.5 }}>|</span>}</>
}

function CountUp({ to, running }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!running) { setVal(0); return }
    const ctrl = animate(0, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: v => setVal(Math.floor(v)) })
    return () => ctrl.stop()
  }, [running, to])
  return <>{val.toLocaleString()}</>
}

function FormRow({ label, value, active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
        <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay }} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} style={{ color: '#D4AF37', fontSize: '0.48rem', letterSpacing: '0.38em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ExplainerBase({ strings }) {
  const [p, setP] = useState({})
  const timers = useRef([])
  const [uploadPct, setUploadPct] = useState(0)

  function reset() {
    timers.current.forEach(t => typeof t === 'function' ? t() : clearTimeout(t))
    timers.current = []
    setP({})
    setUploadPct(0)
  }

  function run() {
    reset()
    Object.entries(PHASES).forEach(([key, delay]) => {
      timers.current.push(setTimeout(() => setP(prev => ({ ...prev, [key]: true })), delay))
    })
    timers.current.push(setTimeout(() => {
      const ctrl = animate(0, 100, { duration: 1.2, ease: 'easeInOut', onUpdate: v => setUploadPct(Math.floor(v)) })
      timers.current.push(() => ctrl.stop())
    }, PHASES.uploadStart))
    timers.current.push(setTimeout(run, LOOP))
  }

  useEffect(() => { run(); return reset }, [])

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <PhoneFrame>
        {/* Nav */}
        <AnimatePresence>
          {p.nav && (
            <motion.div
              key="nav"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}
            >
              <img src="/logo.png" alt="Even" style={{ height: '1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37' }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.58rem', letterSpacing: '0.04em' }}>{strings.newEstimate}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Upload / floor plan */}
          <AnimatePresence>
            {p.cameraRoll && !p.formSection && (
              <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }}>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '0.6rem' }}>
                  {strings.uploadPlans}
                </div>
                <FloorPlan selected={p.select} scanning={p.scanLine && !p.uploadDone} analyzed={p.uploadDone} plansRead={strings.plansRead} />

                <AnimatePresence>
                  {p.uploadStart && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem' }}>
                          {p.uploadDone ? strings.plansReady : strings.uploadingPlans}
                        </span>
                        <span style={{ color: p.uploadDone ? '#D4AF37' : 'rgba(255,255,255,0.28)', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums' }}>
                          {p.uploadDone ? '100%' : `${uploadPct}%`}
                        </span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: p.uploadDone ? '100%' : `${uploadPct}%`, background: p.uploadDone ? '#D4AF37' : 'rgba(212,175,55,0.5)', borderRadius: '999px', transition: 'width 0.1s, background 0.4s' }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <AnimatePresence>
            {p.formSection && !p.permitLabel && (
              <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.5 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}>
                  {strings.jobDetails}
                </div>
                <FormRow label={strings.jobTypeLabel} value={strings.jobTypeValue} active={p.jobType} />
                <FormRow label={strings.locationLabel} value={strings.locationValue} active={p.location} />
                <FormRow label={strings.sizeLabel} value={strings.sizeValue} active={p.size} />

                <AnimatePresence>
                  {p.runBtn && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginTop: '0.2rem' }}>
                      <motion.div
                        animate={p.runTap ? { scale: [1, 0.96, 1] } : {}}
                        transition={{ duration: 0.2 }}
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
                <motion.div key="permit-load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37' }} />
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem' }}>{strings.pullingPermit}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {p.permitRows && (
              <div>
                <Row label={strings.cityFee} value="$847" delay={0} visible={p.permitRows} />
                <Row label={strings.stateFee} value="$120" delay={0.15} visible={p.permitRows} />
                <Row label={strings.inspections} value="$250" delay={0.3} visible={p.permitRows} />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem' }}>
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
                <Row label={strings.materials} value="$12,450" delay={0} visible={p.estimateRows} />
                <Row label={strings.labor} value="$8,200" delay={0.14} visible={p.estimateRows} />
                <Row label={strings.permitsLabel} value="$1,217" delay={0.28} visible={p.estimateRows} />
                <Row label={strings.overhead} value="$2,630" delay={0.42} visible={p.estimateRows} />
              </div>
            )}

            <AnimatePresence>
              {p.total && (
                <motion.div key="total" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.52rem', letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 600 }}>{strings.total}</span>
                  <span style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                    $<CountUp to={24497} running={p.total} />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {p.bid && (
                <motion.div key="bid" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginTop: '0.75rem' }}>
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.48rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{strings.bidRange}</div>
                  <div style={{ position: 'relative', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px' }}>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(212,175,55,0.3), #D4AF37, rgba(212,175,55,0.3))', borderRadius: '999px', transformOrigin: 'left' }} />
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ position: 'absolute', left: '58%', top: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: '#D4AF37', transform: 'translateX(-50%)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
                    <span>$21,000</span>
                    <span style={{ color: 'rgba(212,175,55,0.7)', fontWeight: 600 }}>$24,497</span>
                    <span>$28,000</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {p.exportBtn && (
                <motion.div key="export" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem' }}>
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 14px 3px rgba(212,175,55,0.18)', '0 0 0 0 rgba(212,175,55,0)'] }}
                    transition={{ duration: 1.8, repeat: 2, ease: 'easeInOut' }}
                    style={{ flex: 1, background: '#D4AF37', color: '#080808', borderRadius: '4px', padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}
                  >
                    {strings.clientProposal}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{ flex: 1, background: 'transparent', border: '1px solid rgba(212,175,55,0.35)', color: '#D4AF37', borderRadius: '4px', padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
                  >
                    {strings.internalCost}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add to Home Screen */}
        <AnimatePresence>
          {p.addHome && !p.logo && (
            <motion.div
              key="add-home"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', bottom: 28, left: 0, right: 0, background: 'rgba(18,18,18,0.98)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', zIndex: 30 }}
            >
              <div style={{ width: 30, height: 30, borderRadius: '7px', background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#080808', fontWeight: 900, fontSize: '0.65rem' }}>E</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.1rem' }}>{strings.addHome}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem' }}>{strings.addHomeSub}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.9rem' }}>×</div>
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

export default function Explainer() {
  return <ExplainerBase strings={STRINGS_EN} />
}

export function ExplainerES() {
  return <ExplainerBase strings={STRINGS_ES} />
}
