import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

function spotCookie() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.72)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export default function Lighting() {
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)
  const cookie = useMemo(() => spotCookie(), [])

  useLayoutEffect(() => {
    const spot = light.current
    const aim = target.current
    if (!spot || !aim) return
    spot.target = aim
    spot.map = cookie
    spot.shadow.bias = -0.0004
    spot.shadow.normalBias = 0.03
    spot.shadow.radius = 2.5
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.needsUpdate = true
    return () => cookie.dispose()
  }, [cookie])

  return (
    <>
      <ambientLight intensity={0.11} color="#e6e0d4" />
      <directionalLight position={[4.2, 5.2, 3.4]} intensity={0.42} color="#e4ddd0" />
      <object3D ref={target} position={[0, 0, 0]} />
      <spotLight
        ref={light}
        position={[0.85, 4.7, -0.28]}
        angle={0.46}
        penumbra={0.72}
        intensity={70}
        distance={12}
        decay={2}
        color="#fff5e8"
        castShadow
      />
    </>
  )
}
