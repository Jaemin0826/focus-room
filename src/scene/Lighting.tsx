import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { goboTexture } from './textures'

export default function Lighting() {
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useLayoutEffect(() => {
    const spot = light.current
    const aim = target.current
    if (!spot || !aim) return
    spot.target = aim
    spot.map = goboTexture
    spot.shadow.bias = -0.00035
    spot.shadow.normalBias = 0.025
    spot.shadow.radius = 2
    spot.shadow.mapSize.set(2048, 2048)
    spot.shadow.needsUpdate = true
  }, [])

  return (
    <>
      <ambientLight intensity={0.05} color="#8d8aad" />
      {/* Cool fill so the unlit cube face stays readable without competing with the key. */}
      <directionalLight position={[5.5, 6.5, 4.5]} intensity={0.28} color="#b9b4cc" />
      <object3D ref={target} position={[0, 0.05, 0]} />
      <spotLight
        ref={light}
        position={[-0.85, 5.15, -0.5]}
        angle={0.52}
        penumbra={0.86}
        intensity={108}
        distance={14}
        decay={2}
        color="#fff3c6"
        castShadow
      />
    </>
  )
}
