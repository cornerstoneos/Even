/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — USER'S MANUAL LANDING PAGE · WEEKLY CONTENT

   This is the only file that should change week to week. Swap the video,
   the "what just happened" roadmap (screenshots + copy per step), and
   the proof screenshots here — the page itself (src/routes/Manual.jsx)
   shouldn't need to change.

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
  //
  // This is the "roadmap" — three real phone screens from this week's
  // job, each shown in a little phone frame, chained left-to-right
  // (top-to-bottom on phone) with an arrow between each, ending at the
  // two outputs.
  //
  // `media` takes either a short silent screen recording (.mp4/.webm/
  // .mov — plays muted, looping, like a GIF) or a static screenshot
  // (.png/.jpg) — which one it is gets auto-detected from the file
  // extension. Recordings read better here than stills; keep each one
  // short (5–10s) and compressed before committing — these load on
  // every visitor's phone, so a couple MB per clip, not tens.
  //
  // Drop the file in marketing/public/manual/ and point `media` at it
  // below. A step with no `media` set just shows a "coming soon"
  // placeholder in its place, so this is safe to fill in one step at a
  // time. If you want callouts (arrows/circles on the screen itself),
  // bake those into the recording/screenshot before dropping it in —
  // the page doesn't draw on top of it.
  breakdown: [
    {
      step: 'SCOPE',
      title: 'Even read the plans.',
      body: 'Every trade, every quantity, pulled straight off the plan set — no manual takeoff.',
      media: '', // e.g. '/manual/step-1-scope.mp4'
    },
    {
      step: 'REFINE',
      title: 'We changed the job, live.',
      body: 'Adjust anything by voice or text and Even reprices the whole estimate instantly.',
      media: '', // e.g. '/manual/step-2-refine.mp4'
    },
    {
      step: 'ESTIMATE',
      title: 'Two outputs, one job.',
      body: 'A client-ready proposal and your internal cost sheet — same numbers, built for two audiences.',
      media: '', // e.g. '/manual/step-3-estimate.mp4'
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
