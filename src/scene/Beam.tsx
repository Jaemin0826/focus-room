import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const BASE_Y = 0.82
const APEX_Y = 4.85
const BASE_R = 1.32
const APEX_R = 0.04

/**
 * Analytic-ish light shaft: raymarch a soft cone inside a bounding cylinder
 * and add the result. Reads as a volume once bloom softens it.
 */
export default function Beam() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color('#f7f6c8') },
          uRayDir: { value: new THREE.Vector3(0, -1, 0) },
          uIntensity: { value: 0.42 },
          uBase: { value: BASE_Y },
          uApex: { value: APEX_Y },
          uBaseR: { value: BASE_R },
          uApexR: { value: APEX_R },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vWorld;
          uniform vec3 uColor;
          uniform vec3 uRayDir;
          uniform float uIntensity;
          uniform float uBase;
          uniform float uApex;
          uniform float uBaseR;
          uniform float uApexR;

          void main() {
            vec3 dir = normalize(uRayDir);
            float energy = 0.0;
            const int STEPS = 28;
            float maxT = 8.0;
            float dt = maxT / float(STEPS);
            for (int i = 0; i < STEPS; i++) {
              vec3 p = vWorld + dir * (dt * (float(i) + 0.5));
              float h = (p.y - uBase) / (uApex - uBase);
              if (h < 0.0 || h > 1.0) continue;
              float maxR = mix(uBaseR, uApexR, h);
              float radial = clamp(1.0 - length(p.xz) / maxR, 0.0, 1.0);
              float core = pow(radial, 1.45);
              float vertical = pow(1.0 - h, 0.55) * smoothstep(0.0, 0.12, 1.0 - h);
              vertical *= smoothstep(0.0, 0.05, h);
              energy += core * vertical * dt;
            }
            energy = min(energy * uIntensity, 1.6);
            gl_FragColor = vec4(uColor * energy, 1.0);
          }
        `,
      }),
    [],
  )

  const dir = useRef(new THREE.Vector3())

  useFrame(({ camera }) => {
    camera.getWorldDirection(dir.current)
    mat.uniforms.uRayDir.value.copy(dir.current)
  })

  const height = APEX_Y - BASE_Y
  return (
    <mesh
      material={mat}
      position={[0, BASE_Y + height / 2, 0]}
      raycast={() => null}
      frustumCulled={false}
    >
      <cylinderGeometry args={[BASE_R, BASE_R, height, 48, 1, true]} />
    </mesh>
  )
}
