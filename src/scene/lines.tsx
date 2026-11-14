import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export type Tuple = [number, number, number]
export type Seg = [Tuple, Tuple]

export function lineGeometry(segments: Seg[]) {
  const position: number[] = []
  const along: number[] = []
  for (const [a, b] of segments) {
    position.push(a[0], a[1], a[2], b[0], b[1], b[2])
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    along.push(0, len)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1))
  return geometry
}

/**
 * Screen-space dots. `fwidth` keeps the gap a fixed number of device pixels,
 * so zooming reveals more of the line instead of enlarging the dots.
 */
export function createLineMaterial(dotted: boolean) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#f6f1e6') },
      uSpacing: { value: dotted ? 3.4 : 1 },
      uDuty: { value: dotted ? 0.4 : 1 },
      uGain: { value: dotted ? 2.6 : 3.2 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      varying float vAlong;
      void main() {
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlong;
      uniform vec3 uColor;
      uniform float uSpacing;
      uniform float uDuty;
      uniform float uGain;
      void main() {
        if (uDuty < 0.999) {
          float px = vAlong / max(fwidth(vAlong), 1e-4);
          if (fract(px / uSpacing) > uDuty) discard;
        }
        gl_FragColor = vec4(uColor * uGain, 1.0);
      }
    `,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  })
  return material
}

export function DottedLines({
  segments,
  dotted = true,
  material,
  renderOrder = 2,
}: {
  segments: Seg[]
  dotted?: boolean
  material?: THREE.ShaderMaterial
  renderOrder?: number
}) {
  const geometry = useMemo(() => lineGeometry(segments), [segments])
  const owned = useMemo(() => material ?? createLineMaterial(dotted), [material, dotted])

  useEffect(() => {
    return () => {
      geometry.dispose()
      if (!material) owned.dispose()
    }
  }, [geometry, material, owned])

  return <lineSegments geometry={geometry} material={owned} renderOrder={renderOrder} raycast={() => null} />
}
