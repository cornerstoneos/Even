// Post library: finished assets for posting. Files live in public/library/. Add an entry here when a new piece is ready.
// Captions follow the claims rule in even-data tasks/marketing.md: no "your city, not the county"; say "real permit fees" and "shows where every number comes from".
const EN_TAGS = '#contractors #southflorida #miami #construction'
const ES_TAGS = '#contratistas #sofla #miami #construccion'

export const LIBRARY = {
  videos: [
    {
      id: 'explainer-es', title: 'App Explainer (Spanish)', meta: '43s · vertical 9:16 · voice + captions · POST #1', file: '/library/videos/even-explainer-es.mp4',
      caption: `¿Cuánto tiempo te toma sacar un estimado? Even calcula el trabajo con tarifas de permiso reales y te muestra de dónde sale cada número. Prueba 3 estimados gratis, sin tarjeta de crédito. Link en el perfil.\n\n#contratistas #electricista #construccion #miami #sofla`,
    },
    {
      id: 'explainer-en', title: 'App Explainer (English)', meta: '37s · vertical 9:16 · voice + captions', file: '/library/videos/even-explainer-en.mp4',
      caption: `How long does it take you to get a client a number? Even prices the job with real permit fees and shows you where every number comes from. Try 3 estimates free, no credit card. Link in bio.\n\n#contractors #electrician #construction #miami #southflorida`,
    },
    {
      id: 'wwa-es', title: 'Who We Are (Spanish)', meta: '31s · silent text video', file: '/library/videos/even-who-we-are-es.mp4',
      caption: `Tarifas de permisos reales, con la fuente a la vista. Mano de obra del sur de la Florida. Calcula tu trabajo en minutos, con números que puedes revisar. Prueba 3 estimados gratis, sin tarjeta de crédito. Link en el perfil.\n\n${ES_TAGS}`,
    },
    {
      id: 'wwa-en', title: 'Who We Are (English)', meta: '31s · silent text video', file: '/library/videos/even-who-we-are-en.mp4',
      caption: `Real permit fees, with the source shown. Local labor rates for South Florida. Prices your job in minutes, with numbers you can check. Try 3 estimates free, no credit card. Link in bio.\n\n${EN_TAGS}`,
    },
    {
      id: 'pp-es', title: 'Pain Point (Spanish)', meta: '25s · silent text video', file: '/library/videos/even-pain-point-es.mp4',
      caption: `El contratista que gana el trabajo no es más listo que tú. Conoce sus números. ¿Y tú? Prueba 3 estimados gratis, sin tarjeta de crédito. Link en el perfil.\n\n#contratistas #electricista #presupuestos #sofla`,
    },
    {
      id: 'pp-en', title: 'Pain Point (English)', meta: '25s · silent text video', file: '/library/videos/even-pain-point-en.mp4',
      caption: `The contractor who wins the bid isn't smarter than you. He knows his numbers. Do you? Try 3 estimates free, no credit card. Link in bio.\n\n#contractors #electrician #bidding #southflorida`,
    },
  ],
  stories: [
    { id: 'st-typing-en', title: '1. Typing even-os.com' + ' (English)', meta: '6s · keyboard sound · Link sticker', file: '/library/stories/even-story-typing-en.mp4', caption: '' },
    { id: 'st-typing-es', title: 'Typing even-os.com' + ' (Spanish)', meta: '6s · keyboard sound · Link sticker', file: '/library/stories/even-story-typing-es.mp4', caption: '' },
    { id: 'st-permit-en', title: '2. Permit fact: Aventura $162.50' + ' (English)', meta: '6s · real fee, source shown · Link sticker', file: '/library/stories/even-story-permit-en.mp4', caption: '' },
    { id: 'st-permit-es', title: 'Dato de permisos: Aventura $162.50' + ' (Spanish)', meta: '6s · real fee, source shown · Link sticker', file: '/library/stories/even-story-permit-es.mp4', caption: '' },
    { id: 'st-howlong-en', title: '3. How long does your estimate take?' + ' (English)', meta: '6s · engagement · Poll sticker: 10 min / 1 hour / 1 day', file: '/library/stories/even-story-howlong-en.mp4', caption: '' },
    { id: 'st-howlong-es', title: '¿Cuánto tarda tu estimado?' + ' (Spanish)', meta: '6s · engagement · Poll sticker: 10 min / 1 hora / 1 día', file: '/library/stories/even-story-howlong-es.mp4', caption: '' },
    { id: 'st-three-en', title: '4. 3 free estimates' + ' (English)', meta: '6s · Link sticker', file: '/library/stories/even-story-three-en.mp4', caption: '' },
    { id: 'st-three-es', title: '3 estimados gratis' + ' (Spanish)', meta: '6s · Link sticker', file: '/library/stories/even-story-three-es.mp4', caption: '' },
    { id: 'st-bid-en', title: '5. Would you bid this? ($4,550 real job)' + ' (English)', meta: '6s · example job, real run · Link sticker', file: '/library/stories/even-story-bid-en.mp4', caption: '' },
    { id: 'st-bid-es', title: '¿Lo cotizarías así? ($4,550 trabajo real)' + ' (Spanish)', meta: '6s · example job, real run · Link sticker', file: '/library/stories/even-story-bid-es.mp4', caption: '' },
    { id: 'st-margins-en', title: '6. You set the margins' + ' (English)', meta: '6s · Link sticker', file: '/library/stories/even-story-margins-en.mp4', caption: '' },
    { id: 'st-margins-es', title: 'Tú pones los márgenes' + ' (Spanish)', meta: '6s · Link sticker', file: '/library/stories/even-story-margins-es.mp4', caption: '' },
    { id: 'st-cement-en', title: '7. A bad estimate is cement in your shoes' + ' (English)', meta: '6s · Link sticker', file: '/library/stories/even-story-cement-en.mp4', caption: '' },
    { id: 'st-cement-es', title: 'Un mal estimado es cemento en los zapatos' + ' (Spanish)', meta: '6s · Link sticker', file: '/library/stories/even-story-cement-es.mp4', caption: '' },
    { id: 'st-underbid-en', title: "8. What's the last job you underbid?" + ' (English)', meta: '6s · engagement · Question sticker (ask for replies)', file: '/library/stories/even-story-underbid-en.mp4', caption: '' },
    { id: 'st-underbid-es', title: '¿Cuál fue el último trabajo que cotizaste bajo?' + ' (Spanish)', meta: '6s · engagement · Question sticker (ask for replies)', file: '/library/stories/even-story-underbid-es.mp4', caption: '' },
  ],
  carousels: [
    {
      id: 'how-es', title: 'How It Works (Spanish)', meta: '5 slides · 1080x1350', dir: '/library/carousels/how-it-works-es', prefix: 'how-it-works-es', count: 5,
      caption: `Así de rápido: describe el trabajo, responde unas preguntas, recibe tu oferta y envía la propuesta. Un trabajo real, con cada número a la vista. Prueba 3 estimados gratis, sin tarjeta de crédito. Link en el perfil.\n\n${ES_TAGS}`,
    },
    {
      id: 'how-en', title: 'How It Works (English)', meta: '5 slides · 1080x1350', dir: '/library/carousels/how-it-works-en', prefix: 'how-it-works-en', count: 5,
      caption: `Describe the job. Answer a few questions. Get your bid. Send the proposal. One real job, every number on the table. Try 3 estimates free, no credit card. Link in bio.\n\n${EN_TAGS}`,
    },
    {
      id: 'proof-es', title: 'Where every number comes from (Spanish)', meta: '6 slides · 1080x1350 · proof post', dir: '/library/carousels/where-numbers-come-from-es', prefix: 'where-numbers-come-from-es', count: 6,
      caption: `Un cambio de panel a 200A en Aventura. Permiso, mano de obra, materiales y tus márgenes: cada número con su fuente. Revisa las cuentas en tu próximo presupuesto. 3 estimados gratis, sin tarjeta de crédito. Link en el perfil.\n\n#electricista #contratistas #aventura #miami #sofla`,
    },
    {
      id: 'proof-en', title: 'Where every number comes from (English)', meta: '6 slides · 1080x1350 · proof post', dir: '/library/carousels/where-numbers-come-from-en', prefix: 'where-numbers-come-from-en', count: 6,
      caption: `A 200A panel upgrade in Aventura. Permit, labor, materials and your margins: every number with its source. Check the math on your next bid. 3 free estimates, no credit card. Link in bio.\n\n#electrician #contractors #aventura #miami #southflorida`,
    },
  ],
}
