import * as THREE from "three"

export const flowSegments = 64
export function createFlowGeometry() {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array((flowSegments + 1) * 2 * 3)
  const uv = new Float32Array((flowSegments + 1) * 2 * 2), indices: number[] = []
  for (let i = 0; i <= flowSegments; i++) {
    uv.set([i / flowSegments, 0, i / flowSegments, 1], i * 4)
    if (i < flowSegments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices)
  return geometry
}

const center = new THREE.Vector3(), tangent = new THREE.Vector3()
export function updateFlowGeometry(geometry: THREE.BufferGeometry, curve: THREE.CatmullRomCurve3, width = .16) {
  const positions = geometry.attributes.position
  for (let i = 0; i <= flowSegments; i++) {
    curve.getPoint(i / flowSegments, center); curve.getTangent(i / flowSegments, tangent)
    const length = Math.hypot(tangent.x, tangent.z) || 1
    const dx = -tangent.z / length * width / 2, dz = tangent.x / length * width / 2
    positions.setXYZ(i * 2, center.x - dx, center.y, center.z - dz)
    positions.setXYZ(i * 2 + 1, center.x + dx, center.y, center.z + dz)
  }
  positions.needsUpdate = true
}

export const flowVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
export const flowFragmentShader = `
uniform float uTime;
uniform float uOpacity;
uniform float uReveal;
uniform float uOffset;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float edge = abs(vUv.y - .5) * 2.0;
  float core = 1.0 - smoothstep(.08, .28, edge);
  float halo = pow(1.0 - edge, 2.2);
  float rails = exp(-pow((edge - .83) * 30.0, 2.0));
  float travel = fract(vUv.x - uTime * .16 - uOffset);
  float packet = exp(-travel * 39.0);
  float secondary = exp(-fract(travel + .47) * 58.0) * .35;
  float ticks = pow(max(0.0, sin(vUv.x * 190.0)), 28.0) * rails;
  float reveal = 1.0 - smoothstep(uReveal - .045, uReveal + .012, vUv.x);
  float energy = packet + secondary;
  float alpha = (.09 * halo + .45 * core + .26 * rails + .15 * ticks + energy * halo * .65) * uOpacity * reveal;
  vec3 color = mix(uColor, vec3(1.0, .96, .88), packet * core * .95);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`
