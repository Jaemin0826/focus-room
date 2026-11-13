import { Bloom, BrightnessContrast, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'

export default function Effects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={0.55}
        luminanceThreshold={0.78}
        luminanceSmoothing={0.42}
        radius={0.78}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={-0.015} contrast={0.08} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.2} />
      <Vignette eskil={false} offset={0.18} darkness={0.98} />
    </EffectComposer>
  )
}
