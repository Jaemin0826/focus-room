import type { WebGLProgramParametersWithUniforms } from 'three'
import { FLOOR_EXT } from './config'
import { dappleTexture } from './textures'

export const dappleUniforms = {
  strength: { value: 1 },
  glow: { value: 0.62 },
}

const SPAN = (FLOOR_EXT * 2).toFixed(5)
const EXT = FLOOR_EXT.toFixed(5)

/**
 * Mixes the painted dots into the tile albedo so they take real light and shadow,
 * plus a little emissive so the brightest specks bloom.
 */
export function applyDapples(shader: WebGLProgramParametersWithUniforms) {
  shader.uniforms.dappleMap = { value: dappleTexture }
  shader.uniforms.uDappleStrength = dappleUniforms.strength
  shader.uniforms.uDappleGlow = dappleUniforms.glow

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDappleWorld;')
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vDappleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform sampler2D dappleMap;
      uniform float uDappleStrength;
      uniform float uDappleGlow;
      varying vec3 vDappleWorld;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        vec2 duv = vDappleWorld.xz / ${SPAN} + 0.5;
        vec4 dapple = texture2D(dappleMap, duv);
        float pool = smoothstep(1.08, 0.12, length(vDappleWorld.xz) / ${EXT});
        float edge = smoothstep(0.0, 0.035, duv.x) * smoothstep(1.0, 0.965, duv.x);
        edge *= smoothstep(0.0, 0.035, duv.y) * smoothstep(1.0, 0.965, duv.y);
        float a = clamp(dapple.a * uDappleStrength, 0.0, 1.0) * pool * edge;
        diffuseColor.rgb = mix(diffuseColor.rgb, dapple.rgb, a);
      }`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec2 duv = vDappleWorld.xz / ${SPAN} + 0.5;
        vec4 dapple = texture2D(dappleMap, duv);
        float pool = smoothstep(1.02, 0.18, length(vDappleWorld.xz) / ${EXT});
        totalEmissiveRadiance += dapple.rgb * dapple.a * uDappleGlow * pool;
      }`,
    )
}
