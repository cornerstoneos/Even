/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · SHARED CAMERA RIG

   Single source of truth for the dimetric projection and the completed-
   foundation geometry, imported by every stage (Foundation, Framing, and
   whatever follows). This exists so "the camera doesn't move" is enforced
   by import, not by comment discipline — a later stage literally cannot
   define its own AX/AY/ORIGIN without visibly duplicating this file.

     AX / AY   dimetric axes. AY < AX gives a low, grounded camera height.
     ORIGIN    screen position of plan (0,0,0) — the centre of the ground
               under the building.
     VB        1200 x 675 viewBox (16:9). Everything, captions included,
               lives inside a fixed-aspect stage so overlay text and drawn
               geometry never drift apart.
     P()       the one projection every piece of geometry in every stage
               goes through. Plan coordinates (x = east, y = north/depth,
               z = up) in, screen [x, y] out.

   COMPOSITION CONTRACT
     · the completed foundation (SLAB/FOOT below) occupies screen y
       214 → 537 — the lower-middle band — in every stage, always
     · each new stage fills upward into whatever band the previous stage
       left empty above it, rather than re-composing the frame
     · the bottom ~20% is the caption band and stays clear of geometry
     · the camera may dolly slowly along this same axis from stage to
       stage (continuing one push-in across the whole film) but never
       re-angles
   ═══════════════════════════════════════════════════════════════════════════ */

export const VB     = { w: 1200, h: 675 }
export const AX     = 0.866
export const AY     = 0.40
export const ORIGIN = { x: 600, y: 400 }

/** Plan (x = east, y = north/depth, z = up) → screen [x, y]. */
export const P = (x, y, z = 0) => [
  ORIGIN.x + (x - y) * AX,
  ORIGIN.y + (x + y) * AY - z,
]
export const pts  = list => list.map(([x, y, z = 0]) => P(x, y, z).join(',')).join(' ')
export const path = list => 'M' + list.map(([x, y, z = 0]) => P(x, y, z).join(',')).join(' L') + ' Z'

export const rectPlan = (r, z) => [[r.x0, r.y0, z], [r.x1, r.y0, z], [r.x1, r.y1, z], [r.x0, r.y1, z]]

/** Outer outline of an iso box — used for clipping, shadow and glow. */
export const silhouette = (r, zb, zt) => [
  [r.x0, r.y0, zt], [r.x1, r.y0, zt], [r.x1, r.y0, zb],
  [r.x1, r.y1, zb], [r.x0, r.y1, zb], [r.x0, r.y1, zt],
]

export const GOLD    = '#D4AF37'
export const GOLD_HI = '#F2D782'
export const BG      = '#080808'

/* Heavy ease — leaves fast, arrives slow, never overshoots upward. */
export const HEAVY = [0.24, 0.72, 0.10, 1]
export const EASE  = [0.16, 1, 0.3, 1]

/* ── FOUNDATION GEOMETRY — locked. Stage 01 pours this; every later stage
   builds on this exact shape without redefining it. ─────────────────── */
export const SLAB   = { x0: -190, x1: 190, y0: -125, y1: 125 }
export const FOOT   = { x0: -204, x1: 204, y0: -139, y1: 139 }
export const FOOT_Z = [0, 22]
export const SLAB_Z = [22, 60]

/* ── FRAME GEOMETRY — locked. Stage 02 builds this on the slab; stage 03
   (walls) and beyond hold it static and build further on top of it. ─── */
export const SILL_Z  = [SLAB_Z[1], SLAB_Z[1] + 6]   // [60, 66]
export const STUD_Z  = [66, 170]
export const PLATE_Z = [170, 179]

export const POST_HW = 4   // stud half-width, plan units

/* Two visible exterior walls — same two faces Volume() ever draws:
   the y1 wall (varying x) and the x1 wall (varying y). */
export const WALL_X = [-190, -135.7, -81.4, -27.1, 27.1, 81.4, 135.7, 190]
export const WALL_Y = [-125, -89.3, -53.6, -17.9, 17.9, 53.6, 89.3, 125]

export const studRight = y => ({ x0: SLAB.x1 - POST_HW, x1: SLAB.x1 + POST_HW, y0: y - POST_HW, y1: y + POST_HW })
export const studLeft  = x => ({ x0: x - POST_HW, x1: x + POST_HW, y0: SLAB.y1 - POST_HW, y1: SLAB.y1 + POST_HW })

/** One solid volume: top face, two visible side faces, ambient occlusion.
    Grow it over time by animating `zt` — since z maps to screen y as a
    flat additive offset (see P above), a box growing from a fixed zb is a
    true vertical extrusion, not an approximation. Expects the caller's
    <svg><defs> to declare `f-top-${tone}`, `f-left-${tone}`, `f-right-${tone}`
    gradients. */
export function Volume({ r, zb, zt, tone }) {
  if (zt - zb < 0.4) return null
  const top   = rectPlan(r, zt)
  const left  = [[r.x0, r.y1, zt], [r.x1, r.y1, zt], [r.x1, r.y1, zb], [r.x0, r.y1, zb]]
  const right = [[r.x1, r.y0, zt], [r.x1, r.y1, zt], [r.x1, r.y1, zb], [r.x1, r.y0, zb]]
  return (
    <g>
      <polygon points={pts(left)}  fill={`url(#f-left-${tone})`} />
      <polygon points={pts(right)} fill={`url(#f-right-${tone})`} />
      <polygon points={pts(top)}   fill={`url(#f-top-${tone})`} />
      {/* seam between the two side faces — the near vertical arris */}
      <line
        x1={P(r.x1, r.y1, zt)[0]} y1={P(r.x1, r.y1, zt)[1]}
        x2={P(r.x1, r.y1, zb)[0]} y2={P(r.x1, r.y1, zb)[1]}
        stroke="#000" strokeOpacity="0.55" strokeWidth="1"
      />
    </g>
  )
}
