"use client"

import { useMemo, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Float,
  ContactShadows,
  RoundedBox,
  PerspectiveCamera,
} from "@react-three/drei"

// ============================================================================
// Screen content textures (Canvas2D — no fonts → no Turkish issues)
// ============================================================================

function makeScreenTexture(kind: "desktop" | "mobile") {
  if (typeof document === "undefined") return null
  const w = kind === "desktop" ? 1600 : 540
  const h = kind === "desktop" ? 1000 : 1180
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, "#0a2535")
  bg.addColorStop(1, "#021622")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const orange = "#D9790B"
  const orangeWarm = "#FBB971"
  const orangeSoft = "rgba(217, 121, 11, 0.18)"
  const orangeMid = "rgba(217, 121, 11, 0.45)"
  const ink = "rgba(255, 255, 255, 0.92)"
  const inkMid = "rgba(255, 255, 255, 0.5)"
  const inkDim = "rgba(255, 255, 255, 0.2)"
  const cardBg = "rgba(255, 255, 255, 0.045)"
  const cardBorder = "rgba(255, 255, 255, 0.09)"

  function roundRect(x: number, y: number, ww: number, hh: number, r: number) {
    ctx!.beginPath()
    ctx!.moveTo(x + r, y)
    ctx!.arcTo(x + ww, y, x + ww, y + hh, r)
    ctx!.arcTo(x + ww, y + hh, x, y + hh, r)
    ctx!.arcTo(x, y + hh, x, y, r)
    ctx!.arcTo(x, y, x + ww, y, r)
    ctx!.closePath()
  }

  if (kind === "desktop") {
    // ===== Desktop dashboard =====
    const pad = 70

    // Top bar
    ctx.fillStyle = orange
    ctx.beginPath()
    ctx.arc(pad, pad - 8, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = inkDim
    ctx.fillRect(pad + 18, pad - 11, 70, 5)
    ctx.fillRect(pad + 100, pad - 11, 50, 5)
    // Top-right pill (status)
    ctx.fillStyle = orangeSoft
    roundRect(w - pad - 280, pad - 22, 280, 36, 18)
    ctx.fill()
    ctx.fillStyle = orange
    ctx.beginPath()
    ctx.arc(w - pad - 256, pad - 4, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = orangeWarm
    ctx.fillRect(w - pad - 240, pad - 6, 100, 5)
    // Hairline divider
    ctx.fillStyle = cardBorder
    ctx.fillRect(pad, pad + 28, w - pad * 2, 1)

    // KPI row (3 cards)
    const kpiTop = pad + 56
    const kpiH = 150
    const kpiW = (w - pad * 2 - 32) / 3
    const kpiAccents = [orange, orangeWarm, "#5499c7"]
    for (let i = 0; i < 3; i++) {
      const x = pad + i * (kpiW + 16)
      ctx.fillStyle = cardBg
      roundRect(x, kpiTop, kpiW, kpiH, 22)
      ctx.fill()
      ctx.strokeStyle = cardBorder
      ctx.lineWidth = 1
      ctx.stroke()
      // Accent stripe
      ctx.fillStyle = kpiAccents[i]
      roundRect(x, kpiTop, 4, kpiH, 2)
      ctx.fill()
      // Top label line
      ctx.fillStyle = inkMid
      ctx.fillRect(x + 28, kpiTop + 28, 80, 5)
      // Big number block
      ctx.fillStyle = ink
      ctx.fillRect(x + 28, kpiTop + 60, 130, 28)
      // Suffix small
      ctx.fillStyle = orangeMid
      ctx.fillRect(x + 162, kpiTop + 70, 22, 18)
      // Sub line
      ctx.fillStyle = orangeMid
      ctx.fillRect(x + 28, kpiTop + 108, 60, 6)
      ctx.fillStyle = inkDim
      ctx.fillRect(x + 92, kpiTop + 108, 32, 6)
      // Mini icon corner
      ctx.fillStyle = orangeSoft
      roundRect(x + kpiW - 56, kpiTop + 24, 36, 36, 12)
      ctx.fill()
      ctx.fillStyle = orange
      ctx.beginPath()
      ctx.arc(x + kpiW - 38, kpiTop + 42, 6, 0, Math.PI * 2)
      ctx.fill()
    }

    // Big chart card
    const chartTop = kpiTop + kpiH + 22
    const chartH = 320
    ctx.fillStyle = cardBg
    roundRect(pad, chartTop, w - pad * 2, chartH, 22)
    ctx.fill()
    ctx.strokeStyle = cardBorder
    ctx.stroke()
    // Chart header
    ctx.fillStyle = orange
    ctx.beginPath()
    ctx.arc(pad + 24, chartTop + 32, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = inkMid
    ctx.fillRect(pad + 36, chartTop + 30, 130, 6)
    ctx.fillStyle = ink
    ctx.fillRect(pad + 36, chartTop + 50, 80, 14)
    // Trend tag
    ctx.fillStyle = "rgba(74,222,128,0.15)"
    roundRect(w - pad - 100, chartTop + 24, 80, 28, 14)
    ctx.fill()
    ctx.fillStyle = "rgba(74,222,128,0.85)"
    ctx.fillRect(w - pad - 84, chartTop + 35, 50, 6)

    // Chart bars (always full)
    const bars = [0.45, 0.62, 0.4, 0.78, 0.55, 0.86, 0.72, 0.6, 0.88, 0.74, 0.9, 0.68]
    const barAreaTop = chartTop + 100
    const barAreaH = chartH - 130
    const barW = (w - pad * 2 - 60) / bars.length
    for (let i = 0; i < bars.length; i++) {
      const bx = pad + 28 + i * barW + 4
      const bh = bars[i] * barAreaH
      const by = barAreaTop + (barAreaH - bh)
      const grd = ctx.createLinearGradient(0, by, 0, by + bh)
      const isHi = i === 9
      grd.addColorStop(0, isHi ? "rgba(251,185,113,0.95)" : "rgba(251,185,113,0.7)")
      grd.addColorStop(1, isHi ? "rgba(217,121,11,0.65)" : "rgba(217,121,11,0.35)")
      ctx.fillStyle = grd
      roundRect(bx, by, barW - 8, bh, 5)
      ctx.fill()
    }
    // Trend line overlay
    ctx.strokeStyle = orangeWarm
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    for (let i = 0; i < bars.length; i++) {
      const bx = pad + 28 + i * barW + 4 + (barW - 8) / 2
      const by = barAreaTop + barAreaH - bars[i] * barAreaH
      if (i === 0) ctx.moveTo(bx, by)
      else ctx.lineTo(bx, by)
    }
    ctx.stroke()
    // Hilite point on trend
    ctx.fillStyle = orangeWarm
    ctx.beginPath()
    const hx = pad + 28 + 9 * barW + 4 + (barW - 8) / 2
    const hy = barAreaTop + barAreaH - bars[9] * barAreaH
    ctx.arc(hx, hy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(251,185,113,0.4)"
    ctx.lineWidth = 12
    ctx.stroke()

    // Bottom row (left card + right card)
    const bottomTop = chartTop + chartH + 22
    const bottomH = h - bottomTop - pad
    const leftW = (w - pad * 2) * 0.62
    // Left
    ctx.fillStyle = cardBg
    roundRect(pad, bottomTop, leftW - 12, bottomH, 22)
    ctx.fill()
    ctx.strokeStyle = cardBorder
    ctx.stroke()
    for (let r = 0; r < 5; r++) {
      const ry = bottomTop + 32 + r * 38
      ctx.fillStyle = orangeSoft
      ctx.beginPath()
      ctx.arc(pad + 32, ry + 10, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = inkMid
      ctx.fillRect(pad + 56, ry + 5, 280, 6)
      ctx.fillStyle = inkDim
      ctx.fillRect(pad + 56, ry + 18, 180, 5)
      ctx.fillStyle = orangeMid
      ctx.fillRect(pad + leftW - 92, ry + 9, 44, 6)
    }
    // Right (donut)
    const rx0 = pad + leftW + 12
    ctx.fillStyle = cardBg
    roundRect(rx0, bottomTop, w - pad - rx0, bottomH, 22)
    ctx.fill()
    ctx.strokeStyle = cardBorder
    ctx.stroke()
    const cx = rx0 + (w - pad - rx0) / 2
    const cy = bottomTop + bottomH / 2 + 8
    ctx.lineWidth = 22
    ctx.strokeStyle = inkDim
    ctx.beginPath()
    ctx.arc(cx, cy, 70, 0, Math.PI * 2)
    ctx.stroke()
    const grad = ctx.createLinearGradient(cx - 70, cy, cx + 70, cy)
    grad.addColorStop(0, orange)
    grad.addColorStop(1, orangeWarm)
    ctx.strokeStyle = grad
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5)
    ctx.stroke()
    // Center number
    ctx.fillStyle = ink
    ctx.fillRect(cx - 28, cy - 6, 56, 14)
    ctx.fillStyle = orangeMid
    ctx.fillRect(cx - 18, cy + 14, 36, 5)
  } else {
    // ===== Mobile (clean, big elements, lots of breathing room) =====

    // Background subtle radial accent
    const radial = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.95)
    radial.addColorStop(0, "rgba(217,121,11,0.07)")
    radial.addColorStop(1, "transparent")
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, w, h)

    // Wider padding so content stays away from rounded corners
    const pad = 84

    // ============ STATUS BAR (pushed inward to clear rounded corners) ============
    const sbY = 64 // pushed lower so it sits below the curved top
    // Time (left)
    ctx.fillStyle = ink
    roundRect(pad, sbY, 48, 14, 4); ctx.fill()
    // Battery shell (right)
    ctx.fillStyle = inkMid
    roundRect(w - pad - 30, sbY + 2, 26, 12, 3); ctx.fill()
    // Battery fill (orange)
    ctx.fillStyle = orange
    roundRect(w - pad - 28, sbY + 4, 17, 8, 2); ctx.fill()
    // Battery tip
    ctx.fillStyle = inkMid
    ctx.fillRect(w - pad - 3, sbY + 5, 2, 6)
    // Wifi bars
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = inkMid
      ctx.fillRect(w - pad - 56 + i * 7, sbY + 14 - i * 4, 5, 5 + i * 4)
    }

    // ============ HERO HEADER ============
    const headerY = 130
    // Eyebrow
    ctx.fillStyle = orange
    ctx.beginPath()
    ctx.arc(pad + 6, headerY + 4, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = orangeMid
    roundRect(pad + 18, headerY, 86, 8, 4); ctx.fill()
    // Greeting big block (looks like a bold heading)
    ctx.fillStyle = ink
    roundRect(pad, headerY + 24, 280, 30, 6); ctx.fill()
    ctx.fillStyle = inkMid
    roundRect(pad, headerY + 64, 180, 14, 4); ctx.fill()

    // Avatar (top right circle)
    const avatarX = w - pad - 60
    const avatarY = headerY + 12
    ctx.fillStyle = "#5499c7"
    ctx.beginPath()
    ctx.arc(avatarX + 30, avatarY + 30, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = orangeWarm
    ctx.beginPath()
    ctx.arc(avatarX + 30, avatarY + 30, 28, 0, Math.PI * 1.5)
    ctx.fill()
    // Avatar inner indicator
    ctx.fillStyle = "#021622"
    ctx.beginPath()
    ctx.arc(avatarX + 30, avatarY + 30, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink
    roundRect(avatarX + 19, avatarY + 24, 22, 12, 3); ctx.fill()
    // Notification dot on avatar
    ctx.fillStyle = orange
    ctx.beginPath()
    ctx.arc(avatarX + 50, avatarY + 12, 5, 0, Math.PI * 2)
    ctx.fill()

    // ============ HERO SUMMARY CARD ============
    const heroT = 270
    const heroH = 220
    const heroGrad = ctx.createLinearGradient(pad, heroT, pad + (w - pad * 2), heroT + heroH)
    heroGrad.addColorStop(0, "rgba(217,121,11,0.32)")
    heroGrad.addColorStop(0.55, "rgba(217,121,11,0.18)")
    heroGrad.addColorStop(1, "rgba(217,121,11,0.05)")
    ctx.fillStyle = heroGrad
    roundRect(pad, heroT, w - pad * 2, heroH, 32); ctx.fill()
    ctx.strokeStyle = "rgba(217,121,11,0.45)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Hero card: eyebrow row
    ctx.fillStyle = orangeWarm
    roundRect(pad + 24, heroT + 26, 90, 8, 4); ctx.fill()
    ctx.fillStyle = orangeMid
    ctx.beginPath()
    ctx.arc(pad + 132, heroT + 30, 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = orangeMid
    roundRect(pad + 142, heroT + 26, 60, 8, 4); ctx.fill()

    // Big number
    ctx.fillStyle = ink
    roundRect(pad + 24, heroT + 56, 130, 56, 8); ctx.fill()
    // suffix small
    ctx.fillStyle = orangeWarm
    roundRect(pad + 162, heroT + 80, 28, 32, 6); ctx.fill()

    // Sub label line
    ctx.fillStyle = inkMid
    roundRect(pad + 24, heroT + 130, 200, 10, 3); ctx.fill()

    // Bottom progress
    ctx.fillStyle = "rgba(255,255,255,0.1)"
    roundRect(pad + 24, heroT + 168, w - pad * 2 - 48, 8, 4); ctx.fill()
    const pgW = (w - pad * 2 - 48) * 0.74
    const pgGrad = ctx.createLinearGradient(pad + 24, 0, pad + 24 + pgW, 0)
    pgGrad.addColorStop(0, orange)
    pgGrad.addColorStop(1, orangeWarm)
    ctx.fillStyle = pgGrad
    roundRect(pad + 24, heroT + 168, pgW, 8, 4); ctx.fill()

    // ============ QUICK ACTIONS ROW (4 rounded square icons) ============
    const qaY = 530
    const qaSize = 92
    const qaGap = (w - pad * 2 - qaSize * 4) / 3
    const qaColors = [orange, orangeWarm, "#5499c7", "#9c87d3"]
    for (let i = 0; i < 4; i++) {
      const qx = pad + i * (qaSize + qaGap)
      ctx.fillStyle = `${qaColors[i]}1f`
      roundRect(qx, qaY, qaSize, qaSize, 22); ctx.fill()
      ctx.strokeStyle = `${qaColors[i]}55`
      ctx.lineWidth = 1
      ctx.stroke()
      // Icon center (a simple shape per slot)
      ctx.fillStyle = qaColors[i]
      if (i === 0) {
        // book/calendar icon
        roundRect(qx + 24, qaY + 28, 44, 36, 6); ctx.fill()
        ctx.fillStyle = "rgba(2,22,34,0.5)"
        ctx.fillRect(qx + 32, qaY + 36, 28, 4)
        ctx.fillRect(qx + 32, qaY + 46, 22, 4)
        ctx.fillRect(qx + 32, qaY + 56, 18, 4)
      } else if (i === 1) {
        // chart icon
        ctx.fillRect(qx + 26, qaY + 50, 8, 22)
        ctx.fillRect(qx + 38, qaY + 38, 8, 34)
        ctx.fillRect(qx + 50, qaY + 28, 8, 44)
        ctx.fillRect(qx + 62, qaY + 44, 8, 28)
      } else if (i === 2) {
        // bell icon (rounded triangle-ish)
        ctx.beginPath()
        ctx.arc(qx + qaSize / 2, qaY + 36, 16, Math.PI, 0)
        ctx.lineTo(qx + qaSize / 2 + 16, qaY + 56)
        ctx.lineTo(qx + qaSize / 2 - 16, qaY + 56)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.arc(qx + qaSize / 2, qaY + 64, 6, 0, Math.PI)
        ctx.fill()
      } else {
        // people icon
        ctx.beginPath()
        ctx.arc(qx + 32, qaY + 36, 9, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath()
        ctx.arc(qx + 60, qaY + 38, 9, 0, Math.PI * 2); ctx.fill()
        roundRect(qx + 18, qaY + 50, 28, 20, 8); ctx.fill()
        roundRect(qx + 46, qaY + 52, 28, 18, 8); ctx.fill()
      }
    }

    // ============ ACTIVITY FEED (3 list items, generous spacing) ============
    const feedY = 670
    const itemH = 86
    const itemGap = 16
    const feedColors = [orange, orangeWarm, "#5499c7"]
    for (let i = 0; i < 3; i++) {
      const iy = feedY + i * (itemH + itemGap)
      // Card bg
      ctx.fillStyle = cardBg
      roundRect(pad, iy, w - pad * 2, itemH, 22); ctx.fill()
      ctx.strokeStyle = cardBorder
      ctx.lineWidth = 1
      ctx.stroke()
      // Left avatar
      ctx.fillStyle = `${feedColors[i]}28`
      roundRect(pad + 18, iy + 18, 48, 48, 14); ctx.fill()
      ctx.fillStyle = feedColors[i]
      ctx.beginPath()
      ctx.arc(pad + 42, iy + 42, 7, 0, Math.PI * 2)
      ctx.fill()
      // Title bar
      ctx.fillStyle = ink
      roundRect(pad + 82, iy + 22, 200 + (i * 12) % 80, 9, 4); ctx.fill()
      // Sub bar
      ctx.fillStyle = inkMid
      roundRect(pad + 82, iy + 40, 130 + (i * 9) % 60, 7, 3); ctx.fill()
      // Right value chip
      ctx.fillStyle = `${feedColors[i]}25`
      roundRect(w - pad - 70, iy + 28, 56, 28, 14); ctx.fill()
      ctx.fillStyle = feedColors[i]
      roundRect(w - pad - 60, iy + 38, 36, 8, 4); ctx.fill()
    }

    // ============ BOTTOM TAB BAR ============
    const tabH = 96
    const tabY = h - tabH - 28
    // Floating pill bg
    ctx.fillStyle = "rgba(255,255,255,0.045)"
    roundRect(pad, tabY, w - pad * 2, tabH, 32); ctx.fill()
    ctx.strokeStyle = cardBorder
    ctx.lineWidth = 1
    ctx.stroke()
    // 4 tabs, first active
    const tabCount = 4
    const slot = (w - pad * 2) / tabCount
    for (let i = 0; i < tabCount; i++) {
      const cx = pad + slot * i + slot / 2
      const isActive = i === 0
      const col = isActive ? orange : inkDim
      // Icon (simple rounded shape)
      ctx.fillStyle = isActive ? `${orange}25` : "transparent"
      if (isActive) {
        roundRect(cx - 24, tabY + 16, 48, 36, 14); ctx.fill()
      }
      ctx.fillStyle = col
      // Different tiny shape per tab
      if (i === 0) {
        // home (rounded square + triangle roof)
        ctx.beginPath()
        ctx.moveTo(cx, tabY + 22)
        ctx.lineTo(cx - 14, tabY + 36)
        ctx.lineTo(cx - 14, tabY + 50)
        ctx.lineTo(cx + 14, tabY + 50)
        ctx.lineTo(cx + 14, tabY + 36)
        ctx.closePath()
        ctx.fill()
      } else if (i === 1) {
        ctx.fillRect(cx - 13, tabY + 28, 26, 22)
        ctx.fillRect(cx - 13, tabY + 24, 26, 4)
      } else if (i === 2) {
        ctx.beginPath()
        ctx.arc(cx, tabY + 38, 13, 0, Math.PI * 2); ctx.fill()
      } else {
        // person
        ctx.beginPath()
        ctx.arc(cx, tabY + 30, 7, 0, Math.PI * 2); ctx.fill()
        roundRect(cx - 11, tabY + 40, 22, 12, 6); ctx.fill()
      }
      // Active dot
      if (isActive) {
        ctx.fillStyle = orange
        ctx.beginPath()
        ctx.arc(cx, tabY + 70, 3, 0, Math.PI * 2); ctx.fill()
      }
    }

    // Home indicator
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    roundRect(w / 2 - 60, h - 14, 120, 5, 3); ctx.fill()

    // ============ ROUNDED-CORNER MASK ============
    // Paint the 4 corners with body color so any content near corners is
    // visually contained within the phone case. Matches body's clearcoat dark navy.
    const cornerR = 80 // texture-space radius matching the body curve
    ctx.fillStyle = "#0a1825"
    // Top-left
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(cornerR, 0)
    ctx.arc(cornerR, cornerR, cornerR, -Math.PI / 2, Math.PI, true)
    ctx.lineTo(0, cornerR)
    ctx.closePath()
    ctx.fill()
    // Top-right
    ctx.beginPath()
    ctx.moveTo(w, 0)
    ctx.lineTo(w, cornerR)
    ctx.arc(w - cornerR, cornerR, cornerR, 0, -Math.PI / 2, true)
    ctx.lineTo(w - cornerR, 0)
    ctx.closePath()
    ctx.fill()
    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, h - cornerR)
    ctx.arc(cornerR, h - cornerR, cornerR, Math.PI, Math.PI / 2, true)
    ctx.lineTo(cornerR, h)
    ctx.closePath()
    ctx.fill()
    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(w, h)
    ctx.lineTo(w - cornerR, h)
    ctx.arc(w - cornerR, h - cornerR, cornerR, Math.PI / 2, 0, true)
    ctx.lineTo(w, h - cornerR)
    ctx.closePath()
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.needsUpdate = true
  return tex
}

// ============================================================================
// Laptop — built in OPEN position with screen facing +Z (camera-friendly)
// ============================================================================

function Laptop({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  const screenTex = useMemo(() => makeScreenTexture("desktop"), [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    // Idle rotation + scroll-driven sweep
    groupRef.current.rotation.y = -0.32 + Math.sin(t * 0.28) * 0.05 + progress * 0.55
    groupRef.current.rotation.x = -0.04 + Math.sin(t * 0.22) * 0.02
    groupRef.current.position.y = -0.35 + Math.sin(t * 0.5) * 0.06
  })

  // Geometry constants
  const baseW = 3.4
  const baseD = 2.3
  const baseH = 0.12
  const lidW = 3.4
  const lidH = 2.05
  const lidT = 0.06
  // Lid is positioned in OPEN state — leaning ~12° backward from vertical
  const lidTilt = -0.18
  const lidY = lidH / 2 + baseH / 2 + 0.02 // top of base + half of lid height
  const lidZ = -baseD / 2 + Math.sin(lidTilt) * lidH * 0.5 - 0.02

  return (
    <group ref={groupRef}>
      {/* Base (keyboard half) */}
      <RoundedBox
        args={[baseW, baseH, baseD]}
        radius={0.04}
        smoothness={6}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#0a1620" metalness={0.85} roughness={0.32} />
      </RoundedBox>
      {/* Trackpad */}
      <RoundedBox args={[1.5, 0.005, 1.0]} radius={0.03} smoothness={4} position={[0, baseH / 2 + 0.001, baseD / 2 - 0.6]}>
        <meshStandardMaterial color="#06121b" metalness={0.6} roughness={0.5} />
      </RoundedBox>
      {/* Keyboard area */}
      <RoundedBox args={[2.95, 0.006, 0.85]} radius={0.02} smoothness={4} position={[0, baseH / 2 + 0.001, -0.45]}>
        <meshStandardMaterial color="#08131c" metalness={0.4} roughness={0.65} />
      </RoundedBox>
      {/* Keyboard subtle key dots — 3 rows of small bumps */}
      {[0, 1, 2].map((row) =>
        [...Array(11)].map((_, i) => (
          <mesh
            key={`k-${row}-${i}`}
            position={[
              -1.35 + i * 0.27,
              baseH / 2 + 0.005,
              -0.74 + row * 0.22,
            ]}
          >
            <boxGeometry args={[0.18, 0.01, 0.14]} />
            <meshStandardMaterial color="#0e1a25" metalness={0.5} roughness={0.6} />
          </mesh>
        ))
      )}

      {/* Hinge cylinder (visible joint at back of base) */}
      <mesh position={[0, baseH / 2 + 0.02, -baseD / 2 - 0.01]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, baseW * 0.96, 24]} />
        <meshStandardMaterial color="#040c14" metalness={0.95} roughness={0.32} />
      </mesh>

      {/* Lid — built directly in open position */}
      <group position={[0, lidY, lidZ]} rotation={[lidTilt, 0, 0]}>
        {/* Lid back panel (dark, faces -Z away from camera) */}
        <RoundedBox
          args={[lidW, lidH, lidT]}
          radius={0.04}
          smoothness={6}
          position={[0, 0, -lidT / 2 - 0.001]}
          castShadow
        >
          <meshStandardMaterial color="#0a1620" metalness={0.88} roughness={0.3} />
        </RoundedBox>
        {/* Bezel (front-facing matte plane) */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[lidW * 0.97, lidH * 0.93]} />
          <meshStandardMaterial color="#020910" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Screen (front-facing, +Z toward camera) */}
        <mesh position={[0, 0.02, 0.001]}>
          <planeGeometry args={[lidW * 0.93, lidH * 0.85]} />
          {screenTex ? (
            <meshBasicMaterial map={screenTex} toneMapped={false} />
          ) : (
            <meshBasicMaterial color="#0a1620" toneMapped={false} />
          )}
        </mesh>
        {/* Screen glow (additive bloom in front) */}
        <mesh position={[0, 0.02, 0.003]}>
          <planeGeometry args={[lidW * 0.95, lidH * 0.88]} />
          <meshBasicMaterial
            color="#D9790B"
            transparent
            opacity={0.07}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* Camera notch on top */}
        <mesh position={[0, lidH / 2 - 0.03, 0.002]}>
          <circleGeometry args={[0.012, 16]} />
          <meshBasicMaterial color="#000" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ============================================================================
// Phone (stylized, screen facing camera)
// ============================================================================

function Phone({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  const screenTex = useMemo(() => makeScreenTexture("mobile"), [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    // Gentle face-on rotation — show screen, not side
    groupRef.current.rotation.y = -0.18 + Math.sin(t * 0.3) * 0.07 - progress * 0.25
    groupRef.current.rotation.x = -0.02 + Math.sin(t * 0.22) * 0.025
    groupRef.current.position.y = 0.0 + Math.sin(t * 0.5) * 0.06
  })

  // Realistic phone proportions (iPhone 15 Pro-ish: 70.6 × 146.6 × 8.25 mm)
  // Aspect 1 : 2.08, very slim
  const W = 1.4
  const H = 2.92
  const D = 0.13
  const R = 0.27 // smooth corners

  return (
    <group ref={groupRef} position={[2.7, 0.0, 0.6]} scale={0.78}>
      {/* === SINGLE BODY SHELL (solid, no internal layers showing through) === */}
      <RoundedBox
        args={[W, H, D]}
        radius={R}
        smoothness={12}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#1c2a3a"
          metalness={0.85}
          roughness={0.28}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          envMapIntensity={1.2}
        />
      </RoundedBox>

      {/* === FRONT GLASS PANEL (sits flush on top, slight inset) === */}
      <RoundedBox
        args={[W - 0.06, H - 0.06, 0.005]}
        radius={R - 0.03}
        smoothness={10}
        position={[0, 0, D / 2 + 0.002]}
      >
        <meshPhysicalMaterial
          color="#000000"
          metalness={0.1}
          roughness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={2.2}
        />
      </RoundedBox>

      {/* === SCREEN CONTENT === */}
      <mesh position={[0, 0, D / 2 + 0.0055]}>
        <planeGeometry args={[W - 0.12, H - 0.12]} />
        {screenTex ? (
          <meshBasicMaterial map={screenTex} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#021622" toneMapped={false} />
        )}
      </mesh>

      {/* === DYNAMIC ISLAND === */}
      <group position={[0, H * 0.39, D / 2 + 0.0058]}>
        <mesh>
          <RoundedBox args={[0.36, 0.085, 0.001]} radius={0.04} smoothness={8}>
            <meshBasicMaterial color="#000000" toneMapped={false} />
          </RoundedBox>
        </mesh>
        {/* Front camera */}
        <mesh position={[0.115, 0, 0.0015]}>
          <circleGeometry args={[0.013, 24]} />
          <meshBasicMaterial color="#0a1825" toneMapped={false} />
        </mesh>
        <mesh position={[0.115, 0, 0.0018]}>
          <circleGeometry args={[0.0055, 24]} />
          <meshBasicMaterial color="#FBB971" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>

      {/* === SUBTLE SCREEN GLOW (additive) === */}
      <mesh position={[0, 0, D / 2 + 0.008]}>
        <planeGeometry args={[W * 0.96, H * 0.96]} />
        <meshBasicMaterial
          color="#D9790B"
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* === RIM HIGHLIGHT (thin titanium edge accent) === */}
      <RoundedBox
        args={[W + 0.012, H + 0.012, 0.012]}
        radius={R + 0.006}
        smoothness={10}
        position={[0, 0, D / 2 - 0.005]}
      >
        <meshStandardMaterial color="#6a7c8c" metalness={1} roughness={0.22} envMapIntensity={1.6} />
      </RoundedBox>

      {/* === BACK CAMERA BUMP (subtle, single block) === */}
      <group position={[-W * 0.3, H * 0.34, -D / 2 - 0.014]}>
        {/* Bump plate */}
        <RoundedBox args={[0.36, 0.36, 0.028]} radius={0.07} smoothness={8} castShadow>
          <meshStandardMaterial color="#0d1a26" metalness={0.7} roughness={0.32} />
        </RoundedBox>
        {/* Lens 1 */}
        <mesh position={[-0.07, 0.07, -0.018]}>
          <cylinderGeometry args={[0.058, 0.058, 0.022, 32]} />
          <meshStandardMaterial color="#020910" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[-0.07, 0.07, -0.03]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 32]} />
          <meshPhysicalMaterial
            color="#0a1825"
            metalness={0.4}
            roughness={0.06}
            clearcoat={1}
            clearcoatRoughness={0.04}
            envMapIntensity={2.5}
          />
        </mesh>
        {/* Lens 2 */}
        <mesh position={[0.07, -0.07, -0.018]}>
          <cylinderGeometry args={[0.058, 0.058, 0.022, 32]} />
          <meshStandardMaterial color="#020910" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0.07, -0.07, -0.03]}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 32]} />
          <meshPhysicalMaterial
            color="#0a1825"
            metalness={0.4}
            roughness={0.06}
            clearcoat={1}
            clearcoatRoughness={0.04}
            envMapIntensity={2.5}
          />
        </mesh>
        {/* LED flash */}
        <mesh position={[0.07, 0.07, -0.016]}>
          <cylinderGeometry args={[0.024, 0.024, 0.004, 24]} />
          <meshStandardMaterial color="#FBB971" emissive="#D9790B" emissiveIntensity={0.5} />
        </mesh>
        {/* Lidar */}
        <mesh position={[-0.07, -0.07, -0.016]}>
          <cylinderGeometry args={[0.018, 0.018, 0.004, 20]} />
          <meshStandardMaterial color="#1a2530" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* === OUTER GLOW (rim light, behind the device) === */}
      <mesh position={[0, 0, -D]}>
        <planeGeometry args={[W * 1.7, H * 1.4]} />
        <meshBasicMaterial
          color="#D9790B"
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// ============================================================================
// Floating ambient orbs
// ============================================================================

function Orbs() {
  const refs = useRef<THREE.Mesh[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.y = Math.sin(t * 0.4 + i * 1.7) * 0.5 + (i - 3) * 0.3
      m.position.x = -4 + i * 1.4 + Math.sin(t * 0.3 + i) * 0.3
    })
  })
  const orbs = [0, 1, 2, 3, 4, 5]
  return (
    <>
      {orbs.map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) refs.current[i] = el
          }}
          position={[-4 + i * 1.4, 0, -3.5]}
        >
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color="#D9790B" toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

// ============================================================================
// Scene root
// ============================================================================

export default function ThreeDPlatformScene({ progress }: { progress: number }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <PerspectiveCamera makeDefault position={[0.4, 0.9, 6.2]} fov={32} />

      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3, 6, 5]}
        intensity={1.5}
        color="#FBB971"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 2, 3]} intensity={0.7} color="#5499c7" />
      <pointLight position={[0, 1.5, 4]} intensity={0.7} color="#D9790B" distance={9} />
      <pointLight position={[2, -1, 3]} intensity={0.4} color="#FBB971" distance={6} />

      <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.4}>
        <group position={[-1.0, 0.1, 0]}>
          <Laptop progress={progress} />
        </group>
      </Float>

      <Float speed={1.5} rotationIntensity={0.18} floatIntensity={0.55}>
        <Phone progress={progress} />
      </Float>

      <Orbs />

      <ContactShadows
        position={[0, -1.55, 0]}
        opacity={0.4}
        scale={6}
        blur={3.5}
        far={2.5}
        color="#000000"
        resolution={512}
      />
    </Canvas>
  )
}
