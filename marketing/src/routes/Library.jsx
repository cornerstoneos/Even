import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LIBRARY } from '../content/library'

const GOLD = '#D4AF37'

function copyText(text, done) {
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch (e) { /* ignore */ }
    document.body.removeChild(ta); done()
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback)
  else fallback()
}

function Btn({ children, href, onClick, download, primary }) {
  const style = {
    display: 'inline-block', padding: '0.7rem 1.1rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
    border: `1px solid ${primary ? GOLD : 'rgba(212,175,55,0.4)'}`, background: primary ? GOLD : 'transparent', color: primary ? '#0A0A0A' : GOLD, cursor: 'pointer',
  }
  if (href) return <a href={href} download={download} style={style}>{children}</a>
  return <button onClick={onClick} style={style}>{children}</button>
}

function Caption({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.8rem' }}>{text}</div>
      <div style={{ marginTop: '0.6rem' }}>
        <Btn onClick={() => copyText(text, () => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}>{copied ? 'Copied ✓' : 'Copy caption'}</Btn>
      </div>
    </div>
  )
}

function Card({ title, meta, children }) {
  return (
    <div style={{ border: '1px solid rgba(212,175,55,0.18)', borderRadius: 12, padding: '1rem', background: 'rgba(212,175,55,0.02)' }}>
      <div style={{ color: GOLD, fontWeight: 700, fontSize: '0.95rem' }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', margin: '0.25rem 0 0.8rem' }}>{meta}</div>
      {children}
    </div>
  )
}

function VideoCard({ v }) {
  const name = v.file.split('/').pop()
  return (
    <Card title={v.title} meta={v.meta}>
      <video src={v.file} controls playsInline preload="metadata" style={{ width: '100%', maxWidth: 300, borderRadius: 10, background: '#000', display: 'block', margin: '0 auto 0.9rem' }} />
      <Btn primary href={v.file} download={name}>Save video</Btn>
      <Caption text={v.caption} />
    </Card>
  )
}

function CarouselCard({ c }) {
  const slides = Array.from({ length: c.count }, (_, i) => `${c.dir}/${c.prefix}-${i + 1}.png`)
  return (
    <Card title={c.title} meta={`${c.meta} · tap a slide to open it, then long-press to save`}>
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.6rem' }}>
        {slides.map((src, i) => (
          <a key={src} href={src} target="_blank" rel="noreferrer" style={{ flex: '0 0 auto' }}>
            <img src={src} alt={`${c.title} slide ${i + 1}`} loading="lazy" style={{ height: 220, borderRadius: 8, display: 'block' }} />
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Btn primary href={`${c.dir}.zip`} download={`${c.prefix}.zip`}>Save all slides (zip)</Btn>
      </div>
      <Caption text={c.caption} />
    </Card>
  )
}

function Section({ title, note, children }) {
  return (
    <section style={{ width: '100%', maxWidth: 640 }}>
      <div style={{ color: GOLD, fontSize: '0.7rem', letterSpacing: '0.35em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
      {note && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: '0.4rem 0 0' }}>{note}</div>}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>{children}</div>
    </section>
  )
}

export default function Library() {
  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '2rem 16px 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 640 }}>
        <Link to="/" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', textDecoration: 'none' }}>← All assets</Link>
        <div style={{ color: GOLD, fontSize: '1.4rem', fontWeight: 800, marginTop: '0.8rem' }}>Post Library</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
          Finished posts. Save the file, copy the caption, post. Internal page: do not share the link with customers.
        </div>
      </div>
      <Section title="Videos" note="Order: Spanish explainer first, then English, then Who We Are, then Pain Point. One or two a day.">
        {LIBRARY.videos.map(v => <VideoCard key={v.id} v={v} />)}
      </Section>
      <Section title="Daily stories" note="Post as a story and add the Link sticker (even-os.com).">
        {LIBRARY.stories.map(v => <VideoCard key={v.id} v={v} />)}
      </Section>
      <Section title="Carousels" note="Instagram: + then select all slides in order. Facebook: multi-photo post.">
        {LIBRARY.carousels.map(c => <CarouselCard key={c.id} c={c} />)}
      </Section>
    </div>
  )
}
