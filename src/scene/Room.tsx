import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CUBE_SIZE,
  FLOOR_EXT,
  GRID,
  SIDE_COLORS,
  TILE_H,
  TILE_PITCH,
  TILE_SIZE,
  TOP_COLORS,
  WALL_COLORS,
  WALL_H,
  WALL_T,
} from './config'
import { applyDapples } from './dapples'
import { dappleTexture, goboTexture, shadowBlobTexture } from './textures'

function useAnisotropy() {
  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    const max = gl.capabilities.getMaxAnisotropy()
    for (const tex of [dappleTexture, goboTexture, shadowBlobTexture]) {
      tex.anisotropy = max
      tex.needsUpdate = true
    }
  }, [gl])
}

function Tile({ x, z, top, side }: { x: number; z: number; top: string; side: string }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const hot = useRef(false)
  const count = useRef(0)
  const topColor = useMemo(() => new THREE.Color(top), [top])
  const hotColor = useMemo(() => topColor.clone().lerp(new THREE.Color('#fff3c4'), 0.2), [topColor])

  useLayoutEffect(() => {
    const material = mat.current
    if (!material) return
    material.customProgramCacheKey = () => 'focus-room-dapple-v1'
    material.onBeforeCompile = applyDapples
    material.needsUpdate = true
  }, [])

  useFrame(() => {
    const material = mat.current
    if (!material) return
    material.color.lerp(hot.current ? hotColor : topColor, 0.16)
    const target = hot.current ? 0.1 : 0
    material.emissiveIntensity += (target - material.emissiveIntensity) * 0.16
  })

  const hover = (delta: number) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    count.current = Math.max(0, count.current + delta)
    hot.current = count.current > 0
    document.body.style.cursor = hot.current ? 'pointer' : 'default'
  }

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, TILE_H / 2, 0]} receiveShadow onPointerOver={hover(1)} onPointerOut={hover(-1)}>
        <boxGeometry args={[TILE_SIZE, TILE_H, TILE_SIZE]} />
        <meshStandardMaterial color={side} roughness={0.96} metalness={0} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TILE_H + 0.002, 0]}
        receiveShadow
        onPointerOver={hover(1)}
        onPointerOut={hover(-1)}
      >
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshStandardMaterial
          ref={mat}
          color={top}
          roughness={0.86}
          metalness={0}
          emissive="#f4fb8c"
          emissiveIntensity={0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  )
}

function Walls() {
  const inner = FLOOR_EXT - 0.012
  const t = WALL_T
  const h = WALL_H
  const lengthZ = inner * 2 + t
  return (
    <group>
      <mesh position={[-inner - t / 2, h / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[t, h, lengthZ]} />
        <meshStandardMaterial color={WALL_COLORS[1]} roughness={0.94} metalness={0} />
      </mesh>
      <mesh position={[0, h / 2, -inner - t / 2]} receiveShadow>
        <boxGeometry args={[inner * 2, h, t]} />
        <meshStandardMaterial color={WALL_COLORS[0]} roughness={0.92} metalness={0} />
      </mesh>
    </group>
  )
}

function Cube() {
  return (
    <mesh position={[0, TILE_H + CUBE_SIZE / 2, 0]} castShadow>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshStandardMaterial color="#d8d3cb" roughness={0.46} metalness={0.03} />
    </mesh>
  )
}

function ContactShadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_H + 0.008, 0]} renderOrder={2} raycast={() => null}>
      <planeGeometry args={[1.28, 1.28]} />
      <meshBasicMaterial
        map={shadowBlobTexture}
        transparent
        depthWrite={false}
        toneMapped={false}
        opacity={0.22}
        color="#000000"
      />
    </mesh>
  )
}

export default function Room() {
  useAnisotropy()
  const tiles = []
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const checker = (ix + iz) % 2
      tiles.push(
        <Tile
          key={`${ix}-${iz}`}
          x={(ix - 1) * TILE_PITCH}
          z={(iz - 1) * TILE_PITCH}
          top={TOP_COLORS[checker]}
          side={SIDE_COLORS[checker]}
        />,
      )
    }
  }
  return (
    <group>
      {tiles}
      <Walls />
      <ContactShadow />
      <Cube />
    </group>
  )
}
