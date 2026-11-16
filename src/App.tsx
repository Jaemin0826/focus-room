import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Beam from './scene/Beam'
import CameraRig from './scene/CameraRig'
import Effects from './scene/Effects'
import Lighting from './scene/Lighting'
import Room from './scene/Room'
import { TimerPanel } from './ui/TimerPanel'

export default function App() {
  return (
    <div className="app">
      <Canvas
        orthographic
        shadows
        dpr={[1, 2]}
        flat
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ position: [9, 9, 9], zoom: 90, near: -30, far: 60 }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.NoToneMapping
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.setClearColor('#000000', 1)
          camera.lookAt(0, 0.38, 0)
        }}
      >
        <color attach="background" args={['#000000']} />
        <CameraRig />
        <Lighting />
        <Room />
        <Beam />
        <Effects />
      </Canvas>
      <TimerPanel />
      <p className="hint">스크롤해서 가까이 · 멀리</p>
    </div>
  )
}
