import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Map, { MapES } from './routes/Map'
import Explainer, { ExplainerES } from './routes/Explainer'
import PainPoint from './routes/PainPoint'
import WhoWeAre from './routes/WhoWeAre'
import Speed, { SpeedES } from './routes/Speed'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/map-es" element={<MapES />} />
        <Route path="/explainer" element={<Explainer />} />
        <Route path="/explainer-es" element={<ExplainerES />} />
        <Route path="/pain-point" element={<PainPoint />} />
        <Route path="/who-we-are" element={<WhoWeAre />} />
        <Route path="/speed" element={<Speed />} />
        <Route path="/speed-es" element={<SpeedES />} />
      </Routes>
    </BrowserRouter>
  )
}

const ASSETS = [
  { path: '/map', label: 'US Market Map', meta: '30s loop · state activation · landscape' },
  { path: '/map-es', label: 'US Market Map (ES)', meta: '30s loop · Spanish version' },
  { path: '/explainer', label: 'App Explainer', meta: '30s loop · phone mockup' },
  { path: '/explainer-es', label: 'App Explainer (ES)', meta: '30s loop · Spanish version' },
  { path: '/pain-point', label: 'Pain Point', meta: '26s loop · who wins bids' },
  { path: '/who-we-are', label: 'Who We Are', meta: '33s loop · brand statement' },
  { path: '/speed', label: 'Speed', meta: '25s loop · live estimate · phone call' },
  { path: '/speed-es', label: 'Speed (ES)', meta: '25s loop · Spanish version' },
]

function Home() {
  return (
    <div
      style={{
        background: '#080808',
        minHeight: '100vh',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2.5rem',
        fontFamily: 'Inter, sans-serif',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.75rem' }}>
          Even — Marketing Engine
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
          Select an asset · screen record any route · that's your post
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '680px',
        }}
      >
        {ASSETS.map(({ path, label, meta }) => (
          <Link
            key={path}
            to={path}
            style={{
              border: '1px solid rgba(212,175,55,0.15)',
              padding: '1.25rem 1.5rem',
              borderRadius: '2px',
              textDecoration: 'none',
              background: 'rgba(212,175,55,0.02)',
              display: 'block',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)'
              e.currentTarget.style.background = 'rgba(212,175,55,0.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.15)'
              e.currentTarget.style.background = 'rgba(212,175,55,0.02)'
            }}
          >
            <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.3rem' }}>{label}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{path}</div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', letterSpacing: '0.03em' }}>{meta}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
