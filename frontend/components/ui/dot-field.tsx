'use client'

import { useEffect, useRef, memo } from 'react'
import './dot-field.css'

const TWO_PI = Math.PI * 2

const DotField = memo(({
  dotRadius = 1.5,
  dotSpacing = 14,
  cursorRadius = 160,
  bulgeStrength = 67,
  gradientFrom = 'rgba(59, 61, 240, 0.3)',
  gradientTo = 'rgba(139, 92, 246, 0.15)',
}: {
  dotRadius?: number
  dotSpacing?: number
  cursorRadius?: number
  bulgeStrength?: number
  gradientFrom?: string
  gradientTo?: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<{ ax: number; ay: number; sx: number; sy: number }[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number | null>(null)
  const propsRef = useRef({ dotRadius, dotSpacing, cursorRadius, bulgeStrength, gradientFrom, gradientTo })
  propsRef.current = { dotRadius, dotSpacing, cursorRadius, bulgeStrength, gradientFrom, gradientTo }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function buildDots(w: number, h: number) {
      const p = propsRef.current
      const step = p.dotRadius + p.dotSpacing
      const cols = Math.floor(w / step)
      const rows = Math.floor(h / step)
      const padX = (w % step) / 2
      const padY = (h % step) / 2
      const newDots = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ax = padX + c * step + step / 2
          const ay = padY + r * step + step / 2
          newDots.push({ ax, ay, sx: ax, sy: ay })
        }
      }
      dotsRef.current = newDots
    }

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildDots(w, h)
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.parentElement!.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    function onMouseLeave() {
      mouseRef.current.x = -9999
      mouseRef.current.y = -9999
    }

    function tick() {
      const p = propsRef.current
      const dots = dotsRef.current
      const m = mouseRef.current
      const rect = canvas!.parentElement!.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const crSq = p.cursorRadius * p.cursorRadius

      ctx.clearRect(0, 0, w, h)

      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, p.gradientFrom)
      grad.addColorStop(1, p.gradientTo)
      ctx.fillStyle = grad

      const rad = p.dotRadius / 2

      ctx.beginPath()
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        const dx = m.x - d.ax
        const dy = m.y - d.ay
        const distSq = dx * dx + dy * dy

        if (distSq < crSq) {
          const dist = Math.sqrt(distSq)
          const t = 1 - dist / p.cursorRadius
          const push = t * t * p.bulgeStrength
          const angle = Math.atan2(dy, dx)
          d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15
          d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15
        } else {
          d.sx += (d.ax - d.sx) * 0.1
          d.sy += (d.ay - d.sy) * 0.1
        }

        ctx.moveTo(d.sx + rad, d.sy)
        ctx.arc(d.sx, d.sy, rad, 0, TWO_PI)
      }
      ctx.fill()
      rafRef.current = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
})

DotField.displayName = 'DotField'
export default DotField
