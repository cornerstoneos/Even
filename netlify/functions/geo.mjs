// Demand map (founder 2026-11-28): the visitor's rough city from the web host
// (Netlify's own geo lookup on the request). Returns city / region / country only;
// the IP is never returned or stored. The app sends this once a day per browser as
// a 'visit' event so we can see which metros people come from.
export default async (req, context) => {
  const g = context.geo || {};
  return new Response(JSON.stringify({
    city: g.city || null,
    region: (g.subdivision && g.subdivision.code) || null,
    country: (g.country && g.country.code) || null
  }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
export const config = { path: '/api/geo' };
