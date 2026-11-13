import * as THREE from 'three'
import { FLOOR_EXT } from './config'

const EXT = FLOOR_EXT

function lcg(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function worldToPx(x: number, z: number, size: number) {
  const u = (x + EXT) / (EXT * 2)
  const v = (z + EXT) / (EXT * 2)
  return [u * size, v * size] as const
}

function paintDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, `rgba(${rgb},${alpha})`)
  g.addColorStop(0.28, `rgba(${rgb},${alpha * 0.62})`)
  g.addColorStop(0.62, `rgba(${rgb},${alpha * 0.18})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/** High-resolution painted light sitting on the floor: soft washes plus bokeh dots. */
export function makeDappleTexture() {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.clearRect(0, 0, size, size)
  const rnd = lcg(7)
  const pxPerUnit = size / (EXT * 2)

  const palette = ['244,251,140', '214,242,122', '255,246,196', '198,230,106']

  ctx.globalCompositeOperation = 'lighter'

  // Broad painterly washes so the pool is not a flat gradient.
  for (let i = 0; i < 9; i++) {
    const r = Math.sqrt(rnd()) * 0.72
    const th = rnd() * Math.PI * 2
    const [px, py] = worldToPx(Math.cos(th) * r * EXT * 0.85, Math.sin(th) * r * EXT * 0.85, size)
    const rad = (0.34 + rnd() * 0.55) * pxPerUnit
    paintDot(ctx, px, py, rad, rnd() < 0.5 ? '255,246,210' : '232,240,150', 0.05 + rnd() * 0.07)
  }

  // A handful of larger, very soft orbs — painterly bokeh, not hard discs.
  for (let i = 0; i < 14; i++) {
    const r = Math.sqrt(rnd()) * 0.78
    const th = rnd() * Math.PI * 2
    const x = Math.cos(th) * r * EXT * 0.8
    const z = Math.sin(th) * r * EXT * 0.8
    const [px, py] = worldToPx(x, z, size)
    const rad = (0.16 + rnd() * 0.22) * pxPerUnit
    paintDot(ctx, px, py, rad, rnd() < 0.5 ? '214,242,122' : '244,251,140', 0.22 + rnd() * 0.2)
  }

  // Bokeh dots, denser toward the center, softer than hard circles.
  for (let i = 0; i < 84; i++) {
    const r = Math.sqrt(rnd()) * 0.98
    const th = rnd() * Math.PI * 2
    const x = Math.cos(th) * r * EXT * 0.94
    const z = Math.sin(th) * r * EXT * 0.94
    if (Math.abs(x) > EXT * 0.97 || Math.abs(z) > EXT * 0.97) continue
    const dist = Math.hypot(x, z)
    const fall = 1 - r
    const [px, py] = worldToPx(x, z, size)
    const underCube = dist < 0.32
    const rad = (underCube ? 0.03 + rnd() * 0.04 : 0.05 + rnd() * 0.16) * pxPerUnit
    const alpha = (0.28 + fall * 0.55) * (underCube ? 0.2 : 1)
    const rgb = palette[Math.floor(rnd() * palette.length)]
    paintDot(ctx, px, py, rad, rgb, Math.min(0.9, alpha))
    if (!underCube && rnd() > 0.55) {
      paintDot(ctx, px, py, rad * 0.34, '255,252,210', Math.min(0.7, alpha * 0.55))
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Grayscale cookie. Mostly open, with soft brighter mottling — not a pixel pattern. */
export function makeGoboTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(0, 0, size, size)

  const base = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5)
  base.addColorStop(0, 'rgba(255,255,255,0.95)')
  base.addColorStop(0.45, 'rgba(255,255,255,0.35)')
  base.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  const rnd = lcg(11)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 22; i++) {
    const r = Math.sqrt(rnd()) * 0.42
    const th = rnd() * Math.PI * 2
    const x = size / 2 + Math.cos(th) * r * size
    const y = size / 2 + Math.sin(th) * r * size
    const rad = (0.04 + rnd() * 0.1) * size
    const a = 0.18 + rnd() * 0.45
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.35})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export function makeShadowBlobTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5)
  g.addColorStop(0, 'rgba(0,0,0,0.72)')
  g.addColorStop(0.35, 'rgba(0,0,0,0.38)')
  g.addColorStop(0.7, 'rgba(0,0,0,0.1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.flipY = false
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export const dappleTexture = makeDappleTexture()
export const goboTexture = makeGoboTexture()
export const shadowBlobTexture = makeShadowBlobTexture()
