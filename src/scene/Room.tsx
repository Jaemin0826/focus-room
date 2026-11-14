import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CUBE_SIZE, EXTENT, FLOOR, GRID, INK, TILE_PITCH, WALL, WALL_H } from './config'
import { createLineMaterial, DottedLines, lineGeometry, type Seg, type Tuple } from './lines'

const HALF = TILE_PITCH / 2

function gridLines(y: number): Seg[] {
  const segs: Seg[] = []
  for (let i = 0; i <= GRID; i++) {
    const p = -EXTENT + i * TILE_PITCH
    segs.push([
      [-EXTENT, y, p],
      [EXTENT, y, p],
    ])
    segs.push([
      [p, y, -EXTENT],
      [p, y, EXTENT],
    ])
  }
  return segs
}

function wallLines(h: number): Seg[] {
  const segs: Seg[] = []
  segs.push([
    [-EXTENT, h, -EXTENT],
    [EXTENT, h, -EXTENT],
  ])
  segs.push([
    [-EXTENT, h, -EXTENT],
    [-EXTENT, h, EXTENT],
  ])
  for (let i = 0; i <= GRID; i++) {
    const p = -EXTENT + i * TILE_PITCH
    segs.push([
      [p, 0, -EXTENT],
      [p, h, -EXTENT],
    ])
    if (i > 0) {
      segs.push([
        [-EXTENT, 0, p],
        [-EXTENT, h, p],
      ])
    }
  }
  return segs
}

function tileLoop(x: number, z: number, y: number): Seg[] {
  const a: Tuple = [x - HALF, y, z - HALF]
  const b: Tuple = [x + HALF, y, z - HALF]
  const c: Tuple = [x + HALF, y, z + HALF]
  const d: Tuple = [x - HALF, y, z + HALF]
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ]
}

function cubeEdges(): Seg[] {
  const s = CUBE_SIZE * 0.5 + 0.012
  const y = CUBE_SIZE * 0.5
  const corners: Tuple[] = [
    [-s, y - s, -s],
    [s, y - s, -s],
    [s, y - s, s],
    [-s, y - s, s],
    [-s, y + s, -s],
    [s, y + s, -s],
    [s, y + s, s],
    [-s, y + s, s],
  ]
  const pairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const
  return pairs.map(([i, j]) => [corners[i], corners[j]])
}

function Tile({ x, z }: { x: number; z: number }) {
  const floor = useRef<THREE.MeshStandardMaterial>(null)
  const hot = useRef(false)
  const count = useRef(0)
  const outline = useMemo(() => {
    const material = createLineMaterial(false)
    material.uniforms.uDuty.value = 0
    return material
  }, [])
  const geometry = useMemo(() => lineGeometry(tileLoop(x, z, 0.04)), [x, z])

  useEffect(() => {
    outline.uniforms.uColor.value.set(INK)
    outline.uniforms.uGain.value = 3.4
    return () => {
      outline.dispose()
      geometry.dispose()
    }
  }, [outline, geometry])

  useFrame(() => {
    const show = hot.current ? 1 : 0
    outline.uniforms.uDuty.value += (show - outline.uniforms.uDuty.value) * 0.28
    const surface = floor.current
    if (!surface) return
    const target = hot.current ? 0.35 : 0
    surface.emissiveIntensity += (target - surface.emissiveIntensity) * 0.2
  })

  const hover = (delta: number) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    count.current = Math.max(0, count.current + delta)
    hot.current = count.current > 0
    document.body.style.cursor = hot.current ? 'pointer' : 'default'
  }

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[x, 0, z]}
        receiveShadow
        onPointerOver={hover(1)}
        onPointerOut={hover(-1)}
      >
        <planeGeometry args={[0.96, 0.96]} />
        <meshStandardMaterial
          ref={floor}
          color={FLOOR}
          roughness={0.92}
          metalness={0}
          emissive={INK}
          emissiveIntensity={0}
        />
      </mesh>
      <lineSegments geometry={geometry} material={outline} renderOrder={3} raycast={() => null} />
    </group>
  )
}

function Walls() {
  return (
    <group>
      <mesh position={[0, WALL_H / 2, -EXTENT]} receiveShadow>
        <planeGeometry args={[EXTENT * 2, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-EXTENT, WALL_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[EXTENT * 2, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function Cube() {
  return (
    <mesh position={[0, CUBE_SIZE / 2, 0]} castShadow>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshStandardMaterial color="#d9d2c6" roughness={0.58} metalness={0} />
    </mesh>
  )
}

export default function Room() {
  const floorGrid = useMemo(() => gridLines(0.018), [])
  const walls = useMemo(() => wallLines(WALL_H), [])
  const edges = useMemo(() => cubeEdges(), [])
  const tiles = []
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      tiles.push(<Tile key={`${ix}-${iz}`} x={(ix - 1) * TILE_PITCH} z={(iz - 1) * TILE_PITCH} />)
    }
  }

  return (
    <group>
      {tiles}
      <Walls />
      <DottedLines segments={floorGrid} />
      <DottedLines segments={walls} />
      <DottedLines segments={edges} dotted={false} />
      <Cube />
    </group>
  )
}
