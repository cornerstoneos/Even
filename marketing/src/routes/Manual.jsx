import { useState, Fragment } from 'react'
import { motion } from 'framer-motion'
import { MANUAL } from '../content/manual'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — USER'S MANUAL

   A standalone marketing landing page, separate from the Even app itself.
   Houses the current week's webinar and breaks down what Even does in
   clear, scannable steps. Does not touch or reference the app's codebase.

   Reuses the brand system already established by the other marketing
   assets (South Florida map, house sequence): black ground, gold accent
   lighting, Inter for copy, monospace for eyebrows/labels, the
   [0.16,1,0.3,1] "settle" ease on scroll-reveals.

   Weekly content (video, breakdown copy, screenshots) lives in
   src/content/manual.js — this file is the fixed structure around it.

   Tone rule, applied throughout: nothing implies the contractor is doing
   something wrong. Frame everything as removing a burden, not correcting
   a mistake — "one less thing standing between you and the job," never
   "stop guessing."

   Held back from production: built on the dev branch, not pushed to
   main, until the content (real video, real screenshots) is ready.
   ═══════════════════════════════════════════════════════════════════════════ */

const GOLD       = '#D4AF37'
const GOLD_BRIGHT = '#F2D782'
const BG         = '#080808'
const EASE       = [0.16, 1, 0.3, 1]

const container = { maxWidth: '68rem', margin: '0 auto', padding: '0 1.5rem' }

function Reveal({ children, delay = 0, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

function Eyebrow({ children }) {
  return (
    <div style={{
      color: GOLD, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.38em',
      textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '0.9rem',
      textShadow: '0 0 20px rgba(212,175,55,0.35)',
    }}>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{
      width: '100%', maxWidth: '68rem', margin: '0 auto',
      height: '1px',
      background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.28), transparent)',
    }} />
  )
}

function GoldButton({ href, children, size = 'lg', as = 'a', style, ...rest }) {
  const Tag = as
  const big = size === 'lg'
  return (
    <Tag
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        background: 'linear-gradient(180deg, #F2D782 0%, #D4AF37 100%)',
        color: '#0A0A0A', fontWeight: 800, letterSpacing: '0.01em', textDecoration: 'none',
        borderRadius: '3px', border: 'none', cursor: 'pointer',
        padding: big ? '1rem 2.1rem' : '0.7rem 1.5rem',
        fontSize: big ? 'clamp(0.9rem,1.6vw,1.02rem)' : '0.85rem',
        boxShadow: '0 8px 30px rgba(212,175,55,0.28), 0 0 0 1px rgba(212,175,55,0.4)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

function GhostPanel({ children, style }) {
  return (
    <div style={{
      border: '1px solid rgba(212,175,55,0.18)',
      background: 'linear-gradient(155deg, rgba(212,175,55,0.05), rgba(212,175,55,0.015) 60%)',
      borderRadius: '4px',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── SECTION 1 — HOOK ─────────────────────────────────────────────────── */
function Hook() {
  return (
    <section style={{ padding: '6.5rem 0 4rem', position: 'relative' }}>
      <div style={container}>
        <Reveal>
          <Eyebrow>The Even User's Manual</Eyebrow>
          <h1 style={{
            color: '#fff', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.08,
            fontSize: 'clamp(2.1rem,5.6vw,3.6rem)', maxWidth: '42rem', margin: 0,
          }}>
            Watch us run a real job through Even —{' '}
            <span style={{ color: GOLD }}>start to finish, no pitch.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.95rem,2vw,1.15rem)',
            lineHeight: 1.6, maxWidth: '34rem', marginTop: '1.4rem',
          }}>
            A real job, a real output, no sales call. This page updates every
            week with the actual estimate we ran — plus the short version,
            for anyone who'd rather skim.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ── SECTION 2 — THIS WEEK'S WEBINAR ─────────────────────────────────── */
function Webinar() {
  const { embedUrl, poster, weekOf } = MANUAL.video
  return (
    <section style={{ padding: '1rem 0 5rem' }}>
      <div style={container}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', marginBottom: '1.4rem', flexWrap: 'wrap' }}>
            <Eyebrow>This Week's Estimate</Eyebrow>
            {weekOf && (
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                {weekOf}
              </span>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <GhostPanel style={{
            position: 'relative', width: '100%', aspectRatio: '16/9',
            overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          }}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="This week's Even estimate, start to finish"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: poster
                  ? `linear-gradient(rgba(8,8,8,0.55), rgba(8,8,8,0.75)), url(${poster}) center/cover`
                  : 'radial-gradient(ellipse at center, rgba(212,175,55,0.08), transparent 70%)',
              }}>
                <div style={{
                  width: '4.2rem', height: '4.2rem', borderRadius: '50%',
                  border: `1.5px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(212,175,55,0.3)',
                }}>
                  <div style={{
                    width: 0, height: 0, marginLeft: '0.3rem',
                    borderTop: '0.7rem solid transparent', borderBottom: '0.7rem solid transparent',
                    borderLeft: `1.1rem solid ${GOLD}`,
                  }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', letterSpacing: '0.06em' }}>
                  This week's walkthrough is loading in
                </div>
              </div>
            )}
          </GhostPanel>
        </Reveal>
      </div>
    </section>
  )
}

/* ── SECTION 3 — WHAT JUST HAPPENED ──────────────────────────────────── */
/* Screenshot-and-arrow roadmap: each step is a real screenshot from the
   job (annotated or not — we draw the connecting arrow either way) with
   its label underneath, chained left-to-right on desktop and top-to-
   bottom on phone, ending at the two outputs. Falls back to a plain
   "screenshot coming" placeholder per step until real ones are dropped
   into src/content/manual.js. */
function Breakdown() {
  return (
    <section style={{ padding: '2rem 0 5rem' }}>
      <style>{`
        @media (max-width: 760px) {
          .manual-roadmap { flex-direction: column; }
          .manual-roadmap-arrow { width: 100% !important; height: 2.2rem; transform: rotate(90deg); }
        }
      `}</style>
      <div style={container}>
        <Reveal>
          <Eyebrow>The Manual</Eyebrow>
          <h2 style={{
            color: '#fff', fontWeight: 800, letterSpacing: '-0.02em',
            fontSize: 'clamp(1.6rem,3.6vw,2.3rem)', margin: '0 0 0.5rem',
          }}>
            What just happened
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.92rem', maxWidth: '30rem', marginBottom: '2.6rem' }}>
            Didn't watch the whole thing? Here's the roadmap — same job,
            three screens, straight through to both outputs.
          </p>
        </Reveal>

        <div className="manual-roadmap" style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {MANUAL.breakdown.map((s, i) => (
            <Fragment key={s.step}>
              <Reveal delay={i * 0.1} style={{ flex: '1 1 240px', minWidth: 0 }}>
                <GhostPanel style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {s.screenshot ? (
                    <img
                      src={s.screenshot}
                      alt={s.title}
                      style={{ display: 'block', width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderBottom: '1px solid rgba(212,175,55,0.18)' }}
                    />
                  ) : (
                    <div style={{
                      aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderBottom: '1px solid rgba(212,175,55,0.14)',
                      color: 'rgba(255,255,255,0.18)', fontSize: '0.68rem', letterSpacing: '0.1em',
                      textTransform: 'uppercase', fontFamily: 'monospace',
                    }}>
                      Screenshot coming
                    </div>
                  )}
                  <div style={{ padding: '1.5rem 1.5rem 1.7rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
                      <div style={{
                        width: '1.9rem', height: '1.9rem', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(212,175,55,0.12)', border: `1px solid ${GOLD}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: GOLD, fontFamily: 'monospace', fontWeight: 900, fontSize: '0.78rem',
                      }}>
                        {i + 1}
                      </div>
                      <div style={{
                        color: GOLD, fontFamily: 'monospace', fontWeight: 800,
                        fontSize: '0.72rem', letterSpacing: '0.28em',
                      }}>
                        {s.step}
                      </div>
                    </div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.02rem', marginBottom: '0.5rem', lineHeight: 1.35 }}>
                      {s.title}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.86rem', lineHeight: 1.55 }}>
                      {s.body}
                    </div>
                  </div>
                </GhostPanel>
              </Reveal>

              {i < MANUAL.breakdown.length - 1 && (
                <div className="manual-roadmap-arrow" style={{
                  flex: '0 0 auto', width: '2.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: GOLD, fontSize: '1.3rem', textShadow: '0 0 14px rgba(212,175,55,0.5)',
                }}>
                  →
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── SECTION 4 — ADD TO HOME SCREEN ──────────────────────────────────── */
function AddToHomeScreen() {
  const steps = [
    'Open this page in Safari',
    'Tap the Share icon',
    'Tap "Add to Home Screen"',
  ]
  return (
    <section style={{ padding: '1rem 0 5rem' }}>
      <div style={container}>
        <Reveal>
          <GhostPanel style={{
            padding: 'clamp(1.8rem,4vw,2.6rem)',
            display: 'flex', flexWrap: 'wrap', gap: '2.2rem', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ maxWidth: '24rem' }}>
              <Eyebrow>First Step</Eyebrow>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(1.15rem,2.6vw,1.5rem)', marginBottom: '0.5rem' }}>
                Add Even to your home screen
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                Ten seconds, no download, no account yet — just one tap away
                next time you need it.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '1.7rem', height: '1.7rem', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(212,175,55,0.1)', border: `1px solid rgba(212,175,55,0.5)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: GOLD, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.72rem',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', maxWidth: '9rem' }}>{s}</span>
                  {i < steps.length - 1 && (
                    <span style={{ color: 'rgba(212,175,55,0.35)', marginLeft: '0.6rem' }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </GhostPanel>
        </Reveal>
      </div>
    </section>
  )
}

/* ── SECTION 5 — UPLOAD YOUR JOB ─────────────────────────────────────── */
function UploadJob() {
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    try {
      const res = await fetch('/', { method: 'POST', body: new FormData(form) })
      if (!res.ok) throw new Error('bad response')
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '3px', color: '#fff', fontSize: '0.88rem', padding: '0.8rem 0.9rem',
    outline: 'none', fontFamily: 'inherit',
  }

  return (
    <section style={{ padding: '1rem 0 5rem' }} id="upload-your-job">
      <div style={container}>
        <Reveal>
          <GhostPanel style={{ padding: 'clamp(1.8rem,4vw,2.8rem)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.4rem' }}>
              <div>
                <Eyebrow>Or Skip Straight To It</Eyebrow>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(1.2rem,2.8vw,1.6rem)', lineHeight: 1.25, marginBottom: '0.7rem' }}>
                  Send us your next job, we'll send back the estimate.
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Upload a plan set or scope doc. We'll run it through Even
                  and email you the estimate — no strings, no call required.
                </div>
              </div>

              <form
                name="job-upload"
                method="POST"
                encType="multipart/form-data"
                data-netlify="true"
                netlify-honeypot="bot-field"
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
              >
                <input type="hidden" name="form-name" value="job-upload" />
                <p style={{ display: 'none' }}>
                  <label>Don't fill this out: <input name="bot-field" /></label>
                </p>

                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                  Email
                  <input type="email" name="email" required placeholder="you@company.com" style={{ ...inputStyle, marginTop: '0.35rem' }} />
                </label>

                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                  Job file (plans, scope doc, photos)
                  <input type="file" name="job-file" style={{ ...inputStyle, marginTop: '0.35rem', padding: '0.6rem 0.9rem' }} />
                </label>

                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                  Anything we should know? (optional)
                  <textarea name="notes" rows={2} style={{ ...inputStyle, marginTop: '0.35rem', resize: 'vertical' }} />
                </label>

                <GoldButton as="button" type="submit" size="sm" style={{ marginTop: '0.4rem', width: '100%' }}
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending…' : 'Send My Job'}
                </GoldButton>

                {status === 'sent' && (
                  <div style={{ color: GOLD_BRIGHT, fontSize: '0.82rem' }}>
                    Got it — we'll email your estimate soon.
                  </div>
                )}
                {status === 'error' && (
                  <div style={{ color: '#e08', fontSize: '0.82rem' }}>
                    Something went wrong — try again, or email us directly.
                  </div>
                )}
              </form>
            </div>
          </GhostPanel>
        </Reveal>
      </div>
    </section>
  )
}

/* ── SECTION 6 — FREE ESTIMATE CTA ───────────────────────────────────── */
function FreeEstimateCta() {
  return (
    <section style={{ padding: '2rem 0 5rem', textAlign: 'center' }}>
      <div style={container}>
        <Reveal>
          <Eyebrow>Ready When You Are</Eyebrow>
          <h2 style={{
            color: '#fff', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15,
            fontSize: 'clamp(1.8rem,4.4vw,2.8rem)', maxWidth: '32rem', margin: '0 auto 0.7rem',
          }}>
            Run your own estimate free.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', maxWidth: '26rem', margin: '0 auto 1.8rem' }}>
            Same tool you just watched. Your job. First estimate's on us.
          </p>
          <GoldButton href={MANUAL.ctaHref}>Run Your Own Estimate Free</GoldButton>
        </Reveal>
      </div>
    </section>
  )
}

/* ── SECTION 7 — PROOF STRIP ─────────────────────────────────────────── */
function ProofStrip() {
  const shots = MANUAL.screenshots
  return (
    <section style={{ padding: '1rem 0 6rem' }}>
      <div style={container}>
        <Reveal>
          <Eyebrow>From This Week's Job</Eyebrow>
          <h2 style={{
            color: '#fff', fontWeight: 800, letterSpacing: '-0.02em',
            fontSize: 'clamp(1.4rem,3.2vw,1.9rem)', margin: '0 0 2rem',
          }}>
            Real output, no editing.
          </h2>
        </Reveal>

        {shots.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem',
            marginBottom: '2.6rem',
          }}>
            {shots.map((s, i) => (
              <Reveal key={s.src} delay={i * 0.08}>
                <GhostPanel style={{ overflow: 'hidden' }}>
                  <img src={s.src} alt={s.alt} style={{ display: 'block', width: '100%', height: 'auto' }} />
                </GhostPanel>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <GhostPanel style={{
              padding: '2.2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem',
              marginBottom: '2.6rem',
            }}>
              Screenshots from this week's job go here — see
              src/content/manual.js.
            </GhostPanel>
          </Reveal>
        )}

        <Reveal delay={0.1} style={{ textAlign: 'center' }}>
          <GoldButton href={MANUAL.ctaHref} size="sm">Run Your Own Estimate Free</GoldButton>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ padding: '3rem 0', textAlign: 'center' }}>
      <img src="/logo.png" alt="Even" style={{ height: '1.5rem', objectFit: 'contain', marginBottom: '0.7rem' }}
        onError={e => { e.target.style.display = 'none' }} />
      <div style={{ color: 'rgba(212,175,55,0.6)', fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
        even-os.com
      </div>
    </footer>
  )
}

export default function Manual() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,175,55,0.06), transparent 60%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Hook />
        <Webinar />
        <Divider />
        <Breakdown />
        <AddToHomeScreen />
        <UploadJob />
        <Divider />
        <FreeEstimateCta />
        <ProofStrip />
        <Footer />
      </div>
    </div>
  )
}
