import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ZOOM_MAX, ZOOM_MIN } from './config'

const LOOK = new THREE.Vector3(0, 0.38, 0)

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const factor = useRef(1)
  const target = useRef(1)

  useEffect(() => {
    const el = gl.domElement
    let pinch: number | null = null

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      let dy = event.deltaY
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 16
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= el.clientHeight
      target.current = clamp(target.current * Math.exp(-dy * 0.00115), ZOOM_MIN, ZOOM_MAX)
    }

    const distance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinch = distance(event.touches)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinch === null) return
      event.preventDefault()
      const next = distance(event.touches)
      target.current = clamp(target.current * (next / pinch), ZOOM_MIN, ZOOM_MAX)
      pinch = next
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    const k = 1 - Math.pow(0.88, delta * 60)
    factor.current += (target.current - factor.current) * k
    // Floor reads as a diamond; keep generous black margin at the default zoom.
    const zoomW = (size.width * 0.42) / 4.4
    const zoomH = (size.height * 0.48) / 3.35
    camera.zoom = Math.min(zoomW, zoomH) * factor.current
    camera.position.set(9, 9, 9)
    camera.lookAt(LOOK)
    camera.near = -30
    camera.far = 60
    camera.updateProjectionMatrix()
  })

  return null
}
