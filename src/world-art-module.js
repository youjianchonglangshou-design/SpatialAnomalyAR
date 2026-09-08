import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {SpatialArt} from './art-system.js?v=5'

const ui = {
  badge: () => document.getElementById('trackingBadge'),
  reticle: () => document.getElementById('reticle'),
  panel: () => document.getElementById('statusPanel'),
  title: () => document.getElementById('statusTitle'),
  text: () => document.getElementById('statusText'),
  controls: () => document.getElementById('controls'),
  respawn: () => document.getElementById('respawnButton'),
  reposition: () => document.getElementById('repositionButton'),
}

const TYPE_PRIORITY = {
  DETECTED_SURFACE: 0,
  ESTIMATED_SURFACE: 1,
  FEATURE_POINT: 2,
  UNSPECIFIED: 3,
}

const finitePosition = (position) => position
  && Number.isFinite(position.x)
  && Number.isFinite(position.y)
  && Number.isFinite(position.z)

export const worldArtPipelineModule = () => {
  let art = null
  let scene = null
  let camera = null
  let renderer = null
  let canvas = null
  let placed = false
  let anchorBase = null
  let lastPlacement = null
  let cameraHasVideo = false
  let trackingStatus = 'LIMITED'

  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  const setText = (element, value) => {
    if (element) element.textContent = value
  }

  const showPanel = (title, text) => {
    const panel = ui.panel()
    if (panel) {
      panel.style.display = ''
      panel.classList.remove('done')
    }
    setText(ui.title(), title)
    setText(ui.text(), text)
  }

  const updateTrackingBadge = (status = 'LIMITED') => {
    trackingStatus = status || 'LIMITED'
    const badge = ui.badge()
    if (!badge) return

    if (!cameraHasVideo) {
      badge.textContent = 'STARTING'
      badge.classList.remove('normal')
      badge.classList.add('limited')
      return
    }

    if (trackingStatus === 'NORMAL') {
      badge.textContent = placed ? 'ANCHORED' : 'READY'
      badge.classList.add('normal')
      badge.classList.remove('limited')
    } else {
      // LIMITED is no longer a blocker. The user can still tap immediately.
      badge.textContent = placed ? 'ANCHORED*' : 'TAP NOW'
      badge.classList.remove('normal')
      badge.classList.add('limited')
    }
  }

  const moveReticleToClientPoint = (clientX, clientY) => {
    const reticle = ui.reticle()
    if (!reticle) return
    reticle.style.left = `${clientX}px`
    reticle.style.top = `${clientY}px`
  }

  const resetReticleToCenter = () => {
    const reticle = ui.reticle()
    if (!reticle) return
    reticle.style.left = '50%'
    reticle.style.top = '50%'
    reticle.classList.remove('locked')
  }

  const selectHit = (hits = []) => {
    const valid = hits.filter((hit) => finitePosition(hit?.position))
    if (!valid.length) return null

    valid.sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 9
      const pb = TYPE_PRIORITY[b.type] ?? 9
      if (pa !== pb) return pa - pb

      const da = Number.isFinite(a.distance) ? a.distance : 999
      const db = Number.isFinite(b.distance) ? b.distance : 999
      return da - db
    })

    return valid[0]
  }

  const fallbackPointFromScreen = (nx, ny) => {
    if (!camera) return null

    camera.updateMatrixWorld(true)
    const ndc = new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1))
    raycaster.setFromCamera(ndc, camera)

    // First fallback: intersect the current 8th Wall ground plane (Y = 0).
    const groundHit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(groundPlane, groundHit)) {
      const cameraPosition = new THREE.Vector3()
      camera.getWorldPosition(cameraPosition)
      const distance = cameraPosition.distanceTo(groundHit)
      if (distance >= 0.45 && distance <= 9) {
        return {
          type: 'GROUND_FALLBACK',
          position: groundHit,
          distance,
        }
      }
    }

    // Final fallback: place along the exact tapped ray, farther away than v3.
    // This is immediate, but can drift slightly until SLAM has warmed up.
    const fallbackDistance = 2.8
    return {
      type: 'RAY_FALLBACK',
      position: raycaster.ray.origin.clone().add(
        raycaster.ray.direction.clone().multiplyScalar(fallbackDistance),
      ),
      distance: fallbackDistance,
    }
  }

  const resolvePlacement = (clientX, clientY) => {
    if (!canvas || !camera) return null

    const rect = canvas.getBoundingClientRect()
    const nx = THREE.MathUtils.clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1)
    const ny = THREE.MathUtils.clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1)

    let hit = null
    try {
      const hits = XR8.XrController.hitTest(nx, ny, ['FEATURE_POINT']) || []
      hit = selectHit(hits)
    } catch (error) {
      console.warn('XR8 hitTest unavailable, using fallback placement.', error)
    }

    if (hit) {
      return {
        type: hit.type || 'FEATURE_POINT',
        position: new THREE.Vector3(hit.position.x, hit.position.y, hit.position.z),
        distance: Number.isFinite(hit.distance) ? hit.distance : null,
      }
    }

    return fallbackPointFromScreen(nx, ny)
  }

  const visualPositionForAnchor = (base) => {
    // The selected point is the root. Lift the center slightly so the art grows
    // out of the floor instead of having half of the geometry below it.
    return base.clone().add(new THREE.Vector3(0, 0.28, 0))
  }

  const spawnAtAnchor = () => {
    if (!art || !anchorBase) return
    art.spawn(visualPositionForAnchor(anchorBase), {scale: 0.42})
  }

  const placeAtScreenPoint = (clientX, clientY) => {
    if (placed || !cameraHasVideo) return

    moveReticleToClientPoint(clientX, clientY)
    const placement = resolvePlacement(clientX, clientY)
    if (!placement) {
      showPanel('這個位置暫時抓不到', '請改點附近有紋理或明暗細節的位置。')
      return
    }

    anchorBase = placement.position.clone()
    lastPlacement = placement
    spawnAtAnchor()
    placed = true

    ui.reticle()?.classList.add('locked')
    ui.controls()?.classList.remove('is-hidden')
    updateTrackingBadge(trackingStatus)

    const sourceLabel = placement.type === 'RAY_FALLBACK'
      ? '快速空間定位'
      : placement.type === 'GROUND_FALLBACK'
        ? '地面定位'
        : '表面定位'

    showPanel(
      '已固定在你選的位置',
      `${sourceLabel}完成。現在直接移動鏡頭觀察視差；不需要先等 30～60 公分的掃描流程。`,
    )

    window.setTimeout(() => {
      const panel = ui.panel()
      if (panel && placed) {
        panel.classList.add('done')
        window.setTimeout(() => {
          if (panel && placed) panel.style.display = 'none'
        }, 280)
      }
    }, 850)
  }

  const regenerateSameAnchor = () => {
    if (!anchorBase) return
    spawnAtAnchor()
    showPanel('已換一種藝術', '位置沒有改變，只重新隨機生成視覺。')
    window.setTimeout(() => {
      const panel = ui.panel()
      if (panel && placed) panel.style.display = 'none'
    }, 650)
  }

  const requestReposition = () => {
    art?.dispose()
    placed = false
    anchorBase = null
    lastPlacement = null
    resetReticleToCenter()
    ui.controls()?.classList.add('is-hidden')
    updateTrackingBadge(trackingStatus)
    showPanel(
      '點一下新的位置',
      '直接點你想要的位置。點地面通常最穩；不需要先左右移動 30～60 公分。',
    )
  }

  const updateLockedReticleProjection = () => {
    if (!placed || !anchorBase || !camera) return

    const projected = anchorBase.clone().project(camera)
    const visible = projected.z >= -1 && projected.z <= 1
      && projected.x >= -1.25 && projected.x <= 1.25
      && projected.y >= -1.25 && projected.y <= 1.25

    const reticle = ui.reticle()
    if (!reticle) return

    if (!visible) {
      reticle.classList.add('offscreen')
      return
    }

    reticle.classList.remove('offscreen')
    const rect = canvas.getBoundingClientRect()
    const x = rect.left + ((projected.x + 1) * 0.5) * rect.width
    const y = rect.top + ((1 - projected.y) * 0.5) * rect.height
    moveReticleToClientPoint(x, y)
  }

  const handlePointerUp = (event) => {
    if (!placed) {
      event.preventDefault()
      placeAtScreenPoint(event.clientX, event.clientY)
    }
  }

  return {
    name: 'spatial-art',

    onStart: ({canvas: startedCanvas}) => {
      canvas = startedCanvas
      const xrScene = XR8.Threejs.xrScene()
      scene = xrScene.scene
      camera = xrScene.camera
      renderer = xrScene.renderer

      renderer.shadowMap.enabled = false
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      scene.background = null

      // Keep a real-world-like camera height so the Y=0 ground fallback is useful.
      camera.position.set(0, 1.6, 2)
      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })

      art = new SpatialArt(scene)

      canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
      canvas.addEventListener('pointerup', handlePointerUp, {passive: false})
      ui.respawn()?.addEventListener('click', regenerateSameAnchor)
      ui.reposition()?.addEventListener('click', requestReposition)

      resetReticleToCenter()
      setText(ui.badge(), 'STARTING')
    },

    onCameraStatusChange: ({status}) => {
      if (status === 'hasVideo') {
        cameraHasVideo = true
        updateTrackingBadge(trackingStatus)
        showPanel(
          '點一下你要生成的位置',
          '像你紅圈那樣，直接點地面或空間位置就放置；不用先左右掃描。',
        )
      }
    },

    onUpdate: ({processCpuResult}) => {
      const now = performance.now() * 0.001
      art?.update(now)

      const reality = processCpuResult?.reality
      if (reality?.trackingStatus) {
        updateTrackingBadge(reality.trackingStatus)
      }

      updateLockedReticleProjection()
    },

    listeners: [
      {
        event: 'reality.trackingstatus',
        process: ({detail}) => updateTrackingBadge(detail?.status),
      },
    ],
  }
}
