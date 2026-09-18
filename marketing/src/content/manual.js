/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — USER'S MANUAL LANDING PAGE · WEEKLY CONTENT

   This is the only file that should change week to week. Swap the video,
   the "what just happened" breakdown, and the proof screenshots here —
   the page itself (src/routes/Manual.jsx) shouldn't need to change.

   Spanish: not decided yet (toggle vs. separate page, and whether the
   embedded video itself should swap language) — flagged, not built.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MANUAL = {
  video: {
    // YouTube/Vimeo/Loom *embed* URL (not the watch/share URL) —
    // e.g. 'https://www.youtube.com/embed/XXXXXXXXXXX'. Leave blank to
    // show the "coming this week" placeholder instead of a broken embed.
    embedUrl: '',
    // Optional poster/thumbnail shown before the embed loads.
    poster: '',
    weekOf: '',   // e.g. 'Week of Sep 15' — shown next to the label, optional
  },

  // Mirrors the App Explainer's own step labels (SCOPE → REFINE →
  // ESTIMATE) so this page and the app read as the same product.
  breakdown: [
    {
      step: 'SCOPE',
      title: 'Even read the plans.',
      body: 'Every trade, every quantity, pulled straight off the plan set — no manual takeoff.',
    },
    {
      step: 'REFINE',
      title: 'We changed the job, live.',
      body: 'Adjust anything by voice or text and Even reprices the whole estimate instantly.',
    },
    {
      step: 'ESTIMATE',
      title: 'Two outputs, one job.',
      body: 'A client-ready proposal and your internal cost sheet — same numbers, built for two audiences.',
    },
  ],

  // Screenshots pulled from the actual webinar (real PDF output, real
  // interface). Paths are relative to /public — drop files in
  // marketing/public/manual/ and reference them here.
  screenshots: [
    // { src: '/manual/proof-1.png', alt: 'Client proposal output from this week’s job' },
    // { src: '/manual/proof-2.png', alt: 'Internal cost sheet from this week’s job' },
  ],

  // Where the CTA buttons send people to start their own estimate.
  ctaHref: 'https://even-os.com',
}
