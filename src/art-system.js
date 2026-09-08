import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

const palettes = [
  [0x42efff, 0xcd63ff, 0xffffff],
  [0xff4fa3, 0x6c78ff, 0xe9fbff],
  [0xffa43a, 0xff397d, 0x6dffe0],
  [0x9cff45, 0x25cfff, 0xf5fff1],
  [0xff4242, 0x8056ff, 0xfff1ff],
]

const randomRange = (min, max) => min + Math.random() * (max - min)

export class SpatialArt {
  constructor(scene) {
    this.scene = scene
    this.group = null
    this.core = null
    this.shell = null
    this.rings = []
    this.particles = null
    this.halo = null
    this.birthTime = performance.now() * 0.001
  }

  spawn(position) {
    this.dispose()
    this.birthTime = performance.now() * 0.001

    const palette = palettes[Math.floor(Math.random() * palettes.length)]
    const group = new THREE.Group()
    group.position.copy(position)
    group.scale.setScalar(0.001)
    group.renderOrder = 100

    // Opaque-ish luminous core: intentionally uses MeshBasicMaterial instead of
    // a custom shader so the first visible baseline is robust across mobile GPUs.
    const coreGeo = new THREE.IcosahedronGeometry(randomRange(0.42, 0.55), 4)
    const coreMat = new THREE.MeshBasicMaterial({
      color: palette[0],
      transparent: true,
      opacity: 0.72,
      wireframe: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.rotation.set(Math.random(), Math.random(), Math.random())
    core.renderOrder = 102
    group.add(core)

    // A second distorted-looking shell gives the object visual mass even on a
    // bright camera feed.
    const shellGeo = new THREE.DodecahedronGeometry(randomRange(0.32, 0.43), 2)
    const shellMat = new THREE.MeshBasicMaterial({
      color: palette[1],
      transparent: true,
      opacity: 0.42,
      wireframe: false,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    const shell = new THREE.Mesh(shellGeo, shellMat)
    shell.scale.set(0.78, 1.2, 0.86)
    shell.renderOrder = 101
    group.add(shell)

    this.rings = []
    const ringCount = 4
    for (let i = 0; i < ringCount; i += 1) {
      const radius = 0.62 + i * 0.14
      const tube = 0.008 + i * 0.0015
      const geo = new THREE.TorusKnotGeometry(radius, tube, 120, 4, 2 + (i % 2), 3 + (i % 3))
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % 2],
        transparent: true,
        opacity: 0.38,
        wireframe: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      mesh.userData.spin = new THREE.Vector3(
        randomRange(-0.018, 0.018),
        randomRange(-0.022, 0.022),
        randomRange(-0.016, 0.016),
      )
      mesh.userData.phase = Math.random() * Math.PI * 2
      mesh.renderOrder = 103 + i
      group.add(mesh)
      this.rings.push(mesh)
    }

    const pointCount = 650
    const positions = new Float32Array(pointCount * 3)
    for (let i = 0; i < pointCount; i += 1) {
      const r = randomRange(0.52, 1.22)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(randomRange(-1, 1))
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * randomRange(0.7, 1.25)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const pointsGeo = new THREE.BufferGeometry()
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pointsMat = new THREE.PointsMaterial({
      color: palette[2],
      size: 0.026,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(pointsGeo, pointsMat)
    particles.renderOrder = 110
    group.add(particles)

    const haloGeo = new THREE.SphereGeometry(0.92, 28, 18)
    const haloMat = new THREE.MeshBasicMaterial({
      color: palette[0],
      wireframe: true,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.scale.y = randomRange(0.72, 1.22)
    halo.renderOrder = 100
    group.add(halo)

    this.group = group
    this.core = core
    this.shell = shell
    this.particles = particles
    this.halo = halo
    this.scene.add(group)
  }

  update(nowSeconds) {
    if (!this.group) return

    const elapsed = nowSeconds - this.birthTime
    const t = Math.min(elapsed / 0.9, 1)
    const reveal = t * t * (3 - 2 * t)
    const pulse = 1 + Math.sin(elapsed * 2.2) * 0.045
    this.group.scale.setScalar(Math.max(0.001, reveal * pulse))

    this.core.rotation.x += 0.0032
    this.core.rotation.y += 0.0046
    this.shell.rotation.x -= 0.0021
    this.shell.rotation.z += 0.0035
    this.shell.scale.x = 0.78 + Math.sin(elapsed * 1.7) * 0.07
    this.shell.scale.y = 1.2 + Math.cos(elapsed * 1.35) * 0.1

    this.rings.forEach((ring, index) => {
      const spin = ring.userData.spin
      ring.rotation.x += spin.x
      ring.rotation.y += spin.y
      ring.rotation.z += spin.z
      const wobble = 1 + Math.sin(elapsed * (0.9 + index * 0.12) + ring.userData.phase) * 0.06
      ring.scale.setScalar(wobble)
    })

    this.particles.rotation.y = elapsed * 0.12
    this.particles.rotation.x = Math.sin(elapsed * 0.32) * 0.18
    this.halo.rotation.y = -elapsed * 0.055
    this.halo.rotation.z = elapsed * 0.035
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
    this.shell = null
    this.particles = null
    this.halo = null
    this.rings = []
  }
}
