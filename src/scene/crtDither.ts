import { BlendFunction, Effect } from 'postprocessing'
import {
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  Uniform,
  UnsignedByteType,
} from 'three'

/** 8×8 Bayer matrix, indexed row-major. Values are 0–63. */
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39,
  13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]

function createBayerTexture() {
  const data = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    data[i] = Math.round(((BAYER_8[i] + 0.5) / 64) * 255)
  }
  const texture = new DataTexture(data, 8, 8, RedFormat, UnsignedByteType)
  texture.colorSpace = NoColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.generateMipmaps = false
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

/**
 * Samples the lit scene through a mild barrel lens, then shades it with a
 * 1-pixel Bayer pattern so gray faces become dither. Scanlines, a rounded
 * glass mask, and a vignette sit on top of that, in device pixels.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D bayerMap;
uniform float uCurve;
uniform float uScan;

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + vec3(b))) / (x * (c * x + vec3(d)) + vec3(e)), 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 centered = uv * 2.0 - 1.0;
  float r2 = dot(centered, centered);
  vec2 warped = centered * (1.0 + uCurve * r2);
  vec2 suv = warped * 0.5 + 0.5;

  vec3 paper = vec3(0.965, 0.933, 0.855);
  vec3 ink = vec3(0.0);

  if (suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) {
    vec3 sharp = texture2D(inputBuffer, suv).rgb;
    vec3 bleed = (
      texture2D(inputBuffer, suv + texelSize * vec2(1.6, 0.0)).rgb +
      texture2D(inputBuffer, suv - texelSize * vec2(1.6, 0.0)).rgb +
      texture2D(inputBuffer, suv + texelSize * vec2(0.0, 1.6)).rgb +
      texture2D(inputBuffer, suv - texelSize * vec2(0.0, 1.6)).rgb
    ) * 0.25;
    vec3 col = aces(max(sharp, bleed * 0.42));
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    luma = smoothstep(0.03, 0.97, luma);
    float threshold = texture2D(bayerMap, gl_FragCoord.xy / 8.0).r;
    float bit = step(threshold, luma);
    float scan = mix(1.0 - uScan, 1.0, step(0.5, fract(gl_FragCoord.y * 0.5)));
    float vig = smoothstep(1.12, 0.22, length(warped));
    ink = paper * bit * scan * mix(0.62, 1.0, vig);
  }

  float aspectFix = resolution.x / max(resolution.y, 1.0);
  vec2 p = abs(warped);
  p.x *= aspectFix;
  vec2 bounds = vec2(aspectFix, 1.0) * vec2(0.94, 0.91);
  float radius = 0.22;
  vec2 q = p - (bounds - vec2(radius));
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float inside = smoothstep(0.0035, -0.001, dist);
  float rim = smoothstep(0.006, 0.0, abs(dist));
  ink += paper * rim * 0.4 * inside;

  outputColor = vec4(ink * inside, 1.0);
}
`

export class CrtDitherEffect extends Effect {
  constructor() {
    super('CrtDitherEffect', fragmentShader, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ['bayerMap', new Uniform(createBayerTexture())],
        ['uCurve', new Uniform(0.42)],
        ['uScan', new Uniform(0.12)],
      ]),
    })
  }
}
