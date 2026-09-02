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
  eyebrow: 'Blueprint → Estimate',
  newEstimate: 'New Estimate',
  uploadPlans: 'Upload Plans',
  uploadingPlans: 'Uploading plans...',
  plansReady: '✓ Plans ready',
  plansRead: '✓ Plans read',
  jobDetails: 'Job Details',
  jobTypeLabel: 'Job Type',
  jobTypeValue: 'Roofing Replacement',
  locationLabel: 'Location',
  locationValue: 'Sunny Isles Beach, FL',
  sizeLabel: 'Size',
  sizeValue: '2,400 sq ft',
  getEstimate: 'Get Estimate →',
  permitData: 'Permit Data',
  pullingPermit: 'Indexing Miami-Dade permit schedule...',
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
  eyebrow: 'Plano → Estimado',
  newEstimate: 'Nuevo Estimado',
  uploadPlans: 'Subir Planos',
  uploadingPlans: 'Subiendo planos...',
  plansReady: '✓ Planos listos',
  plansRead: '✓ Planos leídos',
  jobDetails: 'Detalles del Trabajo',
  jobTypeLabel: 'Tipo de Trabajo',
  jobTypeValue: 'Reemplazo de Techo',
  locationLabel: 'Ubicación',
  locationValue: 'Sunny Isles Beach, FL',
  sizeLabel: 'Tamaño',
  sizeValue: '2,400 pies cuadrados',
  getEstimate: 'Obtener Estimado →',
  permitData: 'Datos de Permisos',
  pullingPermit: 'Indexando permisos Miami-Dade...',
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

// ── PHONE FRAME ────────────────────────────────────────────────────────────────
function PhoneFrame({ children }) {
  return (
    <div style={{
      position: 'relative',
      width: 'min(300px, 86vw)',
      flexShrink: 0,
      background: 'linear-gradient(160deg, #222222 0%, #141414 60%, #0e0e0e 100%)',
      borderRadius: '44px',
      padding: '10px',
      transform: 'perspective(1100px) rotateX(5deg) rotateY(-10deg)',
      boxShadow: `
        0 0 0 1px rgba(212,175,55,0.18),
        0 2px 0 2px rgba(0,0,0,0.9),
        0 6px 0 2px rgba(0,0,0,0.7),
        0 12px 0 2px rgba(0,0,0,0.5),
        0 20px 0 2px rgba(0,0,0,0.3),
        0 50px 100px -10px rgba(0,0,0,0.95),
        0 80px 160px -20px rgba(0,0,0,0.6),
        inset 0 1px 0 rgba(255,255,255,0.08),
        inset 0 0 0 1px rgba(255,255,255,0.04)
      `,
    }}>
      {/* Gold top edge accent */}
      <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)', borderRadius: '999px' }} />

      {/* Screen */}
      <div style={{
        background: '#080808',
        borderRadius: '36px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: 'min(620px, 82vh)',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.9)',
      }}>
        {/* Dynamic Island */}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 110, height: 30, background: '#000', borderRadius: '20px', zIndex: 20 }} />
        {/* Status bar space */}
        <div style={{ height: 48, flexShrink: 0 }} />
        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', flexShrink: 0 }}>
          <div style={{ width: 110, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: '999px' }} />
        </div>
      </div>

      {/* Side buttons */}
      {[100, 148, 196].map((top, i) => (
        <div key={i} style={{ position: 'absolute', left: -3, top, width: 3, height: i === 0 ? 28 : 52, background: '#252525', borderRadius: '2px 0 0 2px' }} />
      ))}
      <div style={{ position: 'absolute', right: -3, top: 150, width: 3, height: 70, background: '#252525', borderRadius: '0 2px 2px 0' }} />
    </div>
  )
}

// ── BLUEPRINT ──────────────────────────────────────────────────────────────────
function FloorPlan({ selected, scanning, analyzed, plansRead }) {
  const wall  = 'rgba(255,255,255,0.6)'
  const inner = 'rgba(255,255,255,0.25)'
  const door  = 'rgba(255,255,255,0.14)'
  const lbl   = 'rgba(212,175,55,0.9)'
  const dim   = 'rgba(255,255,255,0.2)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        width: '100%',
        background: '#080808',
        border: `1.5px solid ${selected ? 'rgba(212,175,55,0.9)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '6px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.4s ease',
        padding: '0.75rem',
        boxShadow: selected ? '0 0 20px rgba(212,175,55,0.12)' : 'none',
      }}
    >
      {/* Architectural grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: [
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
        ].join(','),
      }} />

      <svg viewBox="0 0 200 130" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
        {/* Outer walls */}
        <rect x="10" y="10" width="180" height="110" fill="none" stroke={wall} strokeWidth="2.5" />
        {/* Interior walls */}
        <line x1="110" y1="10" x2="110" y2="80" stroke={inner} strokeWidth="1.5" />
        <line x1="110" y1="55" x2="190" y2="55" stroke={inner} strokeWidth="1.5" />
        <line x1="10" y1="75" x2="110" y2="75" stroke={inner} strokeWidth="1.5" />
        {/* Door arcs */}
        <path d="M110 75 Q95 75 95 60" fill="none" stroke={door} strokeWidth="1" />
        <path d="M110 55 Q125 55 125 40" fill="none" stroke={door} strokeWidth="1" />
        {/* Windows — white ticks on walls */}
        <line x1="30" y1="10" x2="60" y2="10" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" />
        <line x1="130" y1="10" x2="170" y2="10" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" />
        <line x1="190" y1="30" x2="190" y2="50" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" />
        {/* Room labels */}
        <text x="55"  y="48" textAnchor="middle" style={{ fontSize:'7px', fill:lbl, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>LIVING</text>
        <text x="55"  y="95" textAnchor="middle" style={{ fontSize:'7px', fill:lbl, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>KITCHEN</text>
        <text x="150" y="38" textAnchor="middle" style={{ fontSize:'7px', fill:lbl, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>BED 1</text>
        <text x="150" y="90" textAnchor="middle" style={{ fontSize:'7px', fill:lbl, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em' }}>BED 2</text>
        {/* Dimension lines */}
        <line x1="10" y1="125" x2="190" y2="125" stroke={dim} strokeWidth="0.8" />
        <text x="100" y="123" textAnchor="middle" style={{ fontSize:'5.5px', fill:'rgba(255,255,255,0.22)', fontFamily:'monospace' }}>48 ft</text>
        <line x1="4" y1="10" x2="4" y2="120" stroke={dim} strokeWidth="0.8" />
        <text x="2" y="68" textAnchor="middle" style={{ fontSize:'5.5px', fill:'rgba(255,255,255,0.22)', fontFamily:'monospace' }} transform="rotate(-90 2 68)">50 ft</text>
      </svg>

      {/* Gold scan laser */}
      {scanning && !analyzed && (
        <motion.div
          initial={{ top: '0%' }}
          animate={{ top: '100%' }}
          transition={{ duration: 1.6, ease: 'linear' }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 15%, rgba(212,175,55,1) 50%, rgba(212,175,55,0.4) 85%, transparent 100%)',
            boxShadow: '0 0 20px 4px rgba(212,175,55,0.65), 0 0 50px rgba(212,175,55,0.25)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Analyzed badge */}
      {analyzed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.5)', borderRadius: '3px', padding: '3px 7px' }}
        >
          <span style={{ color: '#D4AF37', fontSize: '0.52rem', fontWeight: 700, fontFamily: 'monospace' }}>{plansRead}</span>
        </motion.div>
      )}

      {/* Selection checkmark */}
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

// ── HELPERS ────────────────────────────────────────────────────────────────────
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
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{label}</div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '4px', padding: '0.5rem 0.7rem', color: '#fff', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'monospace', minHeight: '2.1rem' }}>
            <TypeIn text={value} active={active} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, delay, visible, gold }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay }} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.67rem', fontFamily: 'monospace' }}>{label}</span>
          <span style={{ color: gold ? '#D4AF37' : '#fff', fontSize: '0.7rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>{value}</span>
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
          style={{ color: '#D4AF37', fontSize: '0.46rem', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'monospace', textShadow: '0 0 12px rgba(212,175,55,0.4)' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
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
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0D0D0D',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Isometric gold grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: [
          'repeating-linear-gradient(60deg, rgba(212,175,55,0.045) 0px, rgba(212,175,55,0.045) 1px, transparent 1px, transparent 44px)',
          'repeating-linear-gradient(-60deg, rgba(212,175,55,0.045) 0px, rgba(212,175,55,0.045) 1px, transparent 1px, transparent 44px)',
        ].join(','),
        pointerEvents: 'none',
      }} />

      {/* Vignette — pull eye to center */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 65% at 50% 50%, transparent 0%, #0D0D0D 100%)',
        pointerEvents: 'none',
      }} />

      {/* Eyebrow */}
      <AnimatePresence>
        {p.nav && (
          <motion.div key="eyebrow"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', top: '1.5rem', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}
          >
            <span style={{ color: '#D4AF37', fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.45em', textTransform: 'uppercase', fontFamily: 'monospace', textShadow: '0 0 20px rgba(212,175,55,0.35)' }}>
              {strings.eyebrow}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <PhoneFrame>
        {/* Nav bar */}
        <AnimatePresence>
          {p.nav && (
            <motion.div key="nav"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}
            >
              <img src="/logo.png" alt="Even" style={{ height: '1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4AF37', boxShadow: '0 0 6px rgba(212,175,55,0.7)' }} />
                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.58rem', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{strings.newEstimate}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Blueprint / upload */}
          <AnimatePresence>
            {p.cameraRoll && !p.formSection && (
              <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }}>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.6rem', fontFamily: 'monospace' }}>
                  {strings.uploadPlans}
                </div>
                <FloorPlan selected={p.select} scanning={p.scanLine && !p.uploadDone} analyzed={p.uploadDone} plansRead={strings.plansRead} />

                <AnimatePresence>
                  {p.uploadStart && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', fontFamily: 'monospace' }}>
                          {p.uploadDone ? strings.plansReady : strings.uploadingPlans}
                        </span>
                        <span style={{ color: p.uploadDone ? '#D4AF37' : 'rgba(255,255,255,0.25)', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                          {p.uploadDone ? '100%' : `${uploadPct}%`}
                        </span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: p.uploadDone ? '100%' : `${uploadPct}%`, background: p.uploadDone ? 'linear-gradient(90deg,#BF953F,#FCF6BA,#D4AF37)' : 'rgba(212,175,55,0.45)', borderRadius: '999px', transition: 'width 0.1s, background 0.4s', boxShadow: p.uploadDone ? '0 0 8px rgba(212,175,55,0.6)' : 'none' }} />
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
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>
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
                        style={{
                          background: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 40%, #D4AF37 60%, #B38728 100%)',
                          color: '#080808',
                          borderRadius: '4px',
                          padding: '0.65rem',
                          textAlign: 'center',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          fontFamily: 'monospace',
                          boxShadow: p.runTap ? '0 0 30px rgba(212,175,55,0.4)' : '0 0 20px rgba(212,175,55,0.2)',
                        }}
                      >
                        {strings.getEstimate}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Permit data */}
          <div>
            <SectionLabel visible={p.permitLabel}>{strings.permitData}</SectionLabel>
            <AnimatePresence>
              {p.permitLoading && !p.permitRows && (
                <motion.div key="permit-load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(212,175,55,0.15)', borderTopColor: '#D4AF37' }} />
                  <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.62rem', fontFamily: 'monospace' }}>{strings.pullingPermit}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {p.permitRows && (
              <div>
                <Row label={strings.cityFee} value="$847" delay={0} visible={p.permitRows} />
                <Row label={strings.stateFee} value="$120" delay={0.15} visible={p.permitRows} />
                <Row label={strings.inspections} value="$250" delay={0.3} visible={p.permitRows} />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace' }}>{strings.totalFees}</span>
                  <span style={{ color: '#D4AF37', fontWeight: 800, fontSize: '0.7rem', fontFamily: 'monospace', textShadow: '0 0 10px rgba(212,175,55,0.4)' }}>$1,217</span>
                </motion.div>
              </div>
            )}
          </div>

          {/* Estimate */}
          <div>
            <SectionLabel visible={p.estimateLabel}>{strings.estimate}</SectionLabel>
            {p.estimateRows && (
              <div>
                <Row label={strings.materials} value="$12,450" delay={0}    visible={p.estimateRows} />
                <Row label={strings.labor}     value="$8,200"  delay={0.14} visible={p.estimateRows} />
                <Row label={strings.permitsLabel} value="$1,217" delay={0.28} visible={p.estimateRows} />
                <Row label={strings.overhead}  value="$2,630"  delay={0.42} visible={p.estimateRows} />
              </div>
            )}

            <AnimatePresence>
              {p.total && (
                <motion.div key="total" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(212,175,55,0.2)' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.5rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace' }}>{strings.total}</span>
                  <span style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>
                    $<CountUp to={24497} running={p.total} />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {p.bid && (
                <motion.div key="bid" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginTop: '0.75rem' }}>
                  <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.46rem', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '0.4rem', fontFamily: 'monospace' }}>{strings.bidRange}</div>
                  <div style={{ position: 'relative', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px' }}>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(212,175,55,0.2), #D4AF37, rgba(212,175,55,0.2))', borderRadius: '999px', transformOrigin: 'left', boxShadow: '0 0 8px rgba(212,175,55,0.5)' }}
                    />
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                      style={{ position: 'absolute', left: '58%', top: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: '#D4AF37', transform: 'translateX(-50%)', boxShadow: '0 0 10px rgba(212,175,55,0.8)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    <span>$21,000</span>
                    <span style={{ color: '#D4AF37', fontWeight: 700 }}>$24,497</span>
                    <span>$28,000</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {p.exportBtn && (
                <motion.div key="export" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem' }}>
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 20px 4px rgba(212,175,55,0.22)', '0 0 0 0 rgba(212,175,55,0)'] }}
                    transition={{ duration: 1.8, repeat: 2, ease: 'easeInOut' }}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #BF953F, #D4AF37, #B38728)', color: '#080808', borderRadius: '4px', padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.56rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}
                  >
                    {strings.clientProposal}
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    style={{ flex: 1, background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: '4px', padding: '0.6rem 0.4rem', textAlign: 'center', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}
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
            <motion.div key="add-home"
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', bottom: 28, left: 0, right: 0, background: 'rgba(14,14,14,0.98)', borderTop: '1px solid rgba(212,175,55,0.15)', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', zIndex: 30 }}
            >
              <div style={{ width: 30, height: 30, borderRadius: '7px', background: 'linear-gradient(135deg,#BF953F,#D4AF37)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#080808', fontWeight: 900, fontSize: '0.7rem', fontFamily: 'monospace' }}>E</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.1rem' }}>{strings.addHome}</div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.55rem', fontFamily: 'monospace' }}>{strings.addHomeSub}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.9rem' }}>×</div>
            </motion.div>
          )}
        </AnimatePresence>
      </PhoneFrame>

      {/* Logo end card */}
      <AnimatePresence>
        {p.logo && (
          <motion.div key="logo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
            style={{ position: 'absolute', bottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}
          >
            <img src="/logo.png" alt="Even" style={{ height: '1rem', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
            <span style={{ color: '#D4AF37', fontSize: '0.45rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 12px rgba(212,175,55,0.4)' }}>even-os.com</span>
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
