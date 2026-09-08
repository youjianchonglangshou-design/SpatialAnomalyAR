import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

const palettes = [
  [0x72f7ff, 0xc879ff, 0xffffff],
  [0xff6db1, 0x7b7dff, 0xd7f5ff],
  [0xffb85a, 0xff4f8b, 0x7af7d4],
  [0xb8ff6a, 0x49d7ff, 0xe9fff2],
  [0xff5d5d, 0x8d63ff, 0xf2eaff],
]

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uSeed;
  varying float vPulse;
  varying vec3 vNormal;

  void main() {
    vec3 p = position;
    float a = sin((p.x * 4.1 + p.y * 3.3 + p.z * 5.2) + uTime * 1.7 + uSeed);
    float b = sin(length(p.xy) * 9.0 - uTime * 2.25 + uSeed * 1.37);
    float c = sin((p.x - p.z) * 7.0 + uTime * 1.05);
    float displacement = (a * 0.055) + (b * 0.04) + (c * 0.025);
    p += normal * displacement;
    vPulse = displacement;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */`
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  varying float vPulse;
  varying vec3 vNormal;

  void main() {
    float facing = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 1.4);
    float wave = 0.5 + 0.5 * sin(uTime * 2.0 + vPulse * 50.0);
    vec3 color = mix(uColorA, uColorB, clamp(facing * 0.72 + wave * 0.28, 0.0, 1.0));
    float alpha = 0.58 + facing * 0.35;
    gl_FragColor = vec4(color, alpha);
  }
`

const randomRange = (min, max) => min + Math.random() * (max - min)

export class SpatialArt {
  constructor(scene) {
    this.scene = scene
    this.group = null
    this.core = null
    this.rings = []
    this.particles = null
    this.uniforms = null
    this.seed = Math.random() * 50
    this.birthTime = performance.now() * 0.001
  }

  spawn(position) {
    this.dispose()
    this.birthTime = performance.now() * 0.001
    this.seed = Math.random() * 50

    const palette = palettes[Math.floor(Math.random() * palettes.length)]
    const group = new THREE.Group()
    group.position.copy(position)
    group.scale.setScalar(0.001)

    this.uniforms = {
      uTime: {value: 0},
      uSeed: {value: this.seed},
      uColorA: {value: new THREE.Color(palette[0])},
      uColorB: {value: new THREE.Color(palette[1])},
    }

    const coreGeo = new THREE.IcosahedronGeometry(randomRange(0.34, 0.48), 5)
    const coreMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.rotation.set(Math.random(), Math.random(), Math.random())
    group.add(core)

    this.rings = []
    const ringCount = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < ringCount; i += 1) {
      const radius = 0.58 + i * 0.16 + Math.random() * 0.08
      const tube = 0.006 + Math.random() * 0.011
      const geo = new THREE.TorusKnotGeometry(radius, tube, 150, 5, 2 + (i % 2), 3 + (i % 3))
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % 2],
        transparent: true,
        opacity: 0.28 + Math.random() * 0.28,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      mesh.userData.spin = new THREE.Vector3(
        randomRange(-0.18, 0.18),
        randomRange(-0.22, 0.22),
        randomRange(-0.16, 0.16),
      )
      mesh.userData.phase = Math.random() * Math.PI * 2
      group.add(mesh)
      this.rings.push(mesh)
    }

    const pointCount = 520
    const positions = new Float32Array(pointCount * 3)
    const scales = new Float32Array(pointCount)
    for (let i = 0; i < pointCount; i += 1) {
      const r = randomRange(0.52, 1.2)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(randomRange(-1, 1))
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * randomRange(0.65, 1.25)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      scales[i] = randomRange(0.4, 1.6)
    }
    const pointsGeo = new THREE.BufferGeometry()
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pointsGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    const pointsMat = new THREE.PointsMaterial({
      color: palette[2],
      size: 0.018,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(pointsGeo, pointsMat)
    group.add(particles)

    const haloGeo = new THREE.SphereGeometry(0.86, 32, 20)
    const haloMat = new THREE.MeshBasicMaterial({
      color: palette[0],
      wireframe: true,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.scale.y = randomRange(0.7, 1.25)
    group.add(halo)

    this.group = group
    this.core = core
    this.particles = particles
    this.halo = halo
    this.scene.add(group)
  }

  update(nowSeconds) {
    if (!this.group) return
    const elapsed = nowSeconds - this.birthTime
    const reveal = THREE.MathUtils.smoothstep(Math.min(elapsed / 1.25, 1), 0, 1)
    const pulse = 1 + Math.sin(elapsed * 2.05) * 0.035
    this.group.scale.setScalar(Math.max(0.001, reveal * pulse))

    this.uniforms.uTime.value = elapsed
    this.core.rotation.x += 0.0015
    this.core.rotation.y += 0.0022

    this.rings.forEach((ring, index) => {
      const spin = ring.userData.spin
      ring.rotation.x += spin.x * 0.008
      ring.rotation.y += spin.y * 0.008
      ring.rotation.z += spin.z * 0.008
      const wobble = 1 + Math.sin(elapsed * (0.8 + index * 0.11) + ring.userData.phase) * 0.05
      ring.scale.setScalar(wobble)
    })

    this.particles.rotation.y = elapsed * 0.08
    this.particles.rotation.x = Math.sin(elapsed * 0.25) * 0.15
    this.halo.rotation.y = -elapsed * 0.035
    this.halo.rotation.z = elapsed * 0.02
  }

  dispose() {
    if (!this.group) return
    this.scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
    this.group = null
    this.core = null
    this.particles = null
    this.rings = []
  }
}
