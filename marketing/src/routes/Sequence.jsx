import { useState, useEffect, useRef } from 'react'
import Foundation from './Foundation'
import Framing from './Framing'
import Walls from './Walls'
import Finish from './Finish'

/* ═══════════════════════════════════════════════════════════════════════════
   EVEN — HOUSE SEQUENCE · FULL CUT

   All four stages played back to back as one continuous piece: Foundation
   → Framing → Walls → Finish → loops back to Foundation. Each stage is
   already its own standalone route (/foundation, /framing, /walls,
   /finish); this route composes those four existing scenes in order for a
   single continuous recording — no new visuals of its own.

   Each stage component loops itself internally (its own `at(T.loop, run)`
   call). Rather than touching that, this wrapper unmounts one stage and
   mounts the next shortly *before* the current one's own loop would fire
   — DWELL below is each stage's real loop duration minus a small margin,
   so the hand-off is a clean cut during that stage's held final frame,
   never a restart-flash from its own internal loop racing the swap.
   ═══════════════════════════════════════════════════════════════════════════ */

const MARGIN = 400   // ms trimmed off each stage's own loop duration

const STAGES = [
  { Component: Foundation, dwell: 28000 - MARGIN },
  { Component: Framing,    dwell: 25600 - MARGIN },
  { Component: Walls,      dwell: 22800 - MARGIN },
  { Component: Finish,     dwell: 21500 - MARGIN },
]

export default function Sequence() {
  const [phase, setPhase] = useState(0)
  const [cycle, setCycle] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    timer.current = setTimeout(() => {
      setPhase(p => {
        const next = (p + 1) % STAGES.length
        if (next === 0) setCycle(c => c + 1)
        return next
      })
    }, STAGES[phase].dwell)
    return () => clearTimeout(timer.current)
  }, [phase])

  const { Component } = STAGES[phase]
  // key forces a full remount on every phase change (and on wrap-around
  // back to phase 0, via cycle), so each stage's own timers/state always
  // start completely fresh.
  return <Component key={`${cycle}-${phase}`} />
}
