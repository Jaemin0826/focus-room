import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { wrapEffect } from '@react-three/postprocessing'
import { CrtDitherEffect } from './crtDither'

const CrtDither = wrapEffect(CrtDitherEffect)

export default function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.32} luminanceThreshold={0.78} luminanceSmoothing={0.28} radius={0.45} />
      <CrtDither />
    </EffectComposer>
  )
}
