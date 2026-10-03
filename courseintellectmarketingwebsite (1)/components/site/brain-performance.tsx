"use client"

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"

export type BrainMetrics = { fps: number; p95: number; calls: number; triangles: number; dpr: number; samples: number }

export function BrainPerformance({ onMetrics, adaptive = false, compact }: { onMetrics?: (metrics: BrainMetrics) => void; adaptive?: boolean; compact: boolean }) {
  const { gl, setDpr } = useThree()
  const frames = useRef<number[]>([]), elapsed = useRef(0), calls = useRef(0), triangles = useRef(0), slow = useRef(0), stable = useRef(0)
  useEffect(() => {
    // Include shadow and reflection passes in the frame's drawing budget.
    // WebGLRenderer owns this imperative counter, not React state.
    // eslint-disable-next-line react-hooks/immutability
    gl.info.autoReset = false
    return () => { gl.info.autoReset = true }
  }, [gl])
  useFrame((_, delta) => {
    if (delta < .5) { frames.current.push(delta * 1000); elapsed.current += delta }
    calls.current = Math.max(calls.current, gl.info.render.calls)
    triangles.current = Math.max(triangles.current, gl.info.render.triangles)
    gl.info.reset()
    if (elapsed.current < 2 || frames.current.length < 20) return
    const sorted = [...frames.current].sort((a, b) => a - b)
    const average = frames.current.reduce((sum, value) => sum + value, 0) / frames.current.length
    const fps = 1000 / average, dpr = gl.getPixelRatio(), ceiling = Math.min(window.devicePixelRatio, compact ? 1.25 : 1.5)
    onMetrics?.({ fps: Math.round(fps), p95: Math.round(sorted[Math.floor(sorted.length * .95)] * 10) / 10, calls: calls.current, triangles: triangles.current, dpr, samples: frames.current.length })
    if (adaptive) {
      slow.current = fps < 43 ? slow.current + 1 : 0
      stable.current = fps > 57 ? stable.current + 1 : 0
      if (slow.current >= 2 && dpr > .9) { setDpr(Math.max(.9, dpr - .2)); slow.current = 0; stable.current = 0 }
      else if (stable.current >= 4 && dpr < ceiling) { setDpr(Math.min(ceiling, dpr + .1)); stable.current = 0 }
    }
    frames.current.length = 0; elapsed.current = 0; calls.current = 0; triangles.current = 0
  }, -100)
  return null
}
