import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {SpatialArt} from './art-system.js?v=2'

const ui = {
  badge: () => document.getElementById('trackingBadge'),
  reticle: () => document.getElementById('reticle'),
  panel: () => document.getElementById('statusPanel'),
  title: () => document.getElementById('statusTitle'),
  text: () => document.getElementById('statusText'),
  meter: () => document.getElementById('meterFill'),
  controls: () => document.getElementById('controls'),
  respawn: () => document.getElementById('respawnButton'),
  recenter: () => document.getElementById('recenterButton'),
}

export const worldArtPipelineModule = () => {
  let art = null
  let scene = null
  let camera = null
  let renderer = null
  let normalFrames = 0
  let placed = false
  let pendingRespawn = false
  let startedAt = performance.now()
  let lastTrackingStatus = 'LIMITED'

  const setText = (el, value) => {
    if (el) el.textContent = value
  }

  const setTrackingUI = (status = 'LIMITED', reason = 'INITIALIZING') => {
    lastTrackingStatus = status || 'LIMITED'
    const badge = ui.badge()
    if (!badge) return

    badge.textContent = lastTrackingStatus
    badge.classList.toggle('normal', lastTrackingStatus === 'NORMAL')
    badge.classList.toggle('limited', lastTrackingStatus !== 'NORMAL')

    if (placed) return

    const meter = ui.meter()
    if (meter) {
      const pct = Math.min(100, Math.max(8, Math.round((normalFrames / 10) * 100)))
      meter.style.width = `${pct}%`
    }

    if (lastTrackingStatus === 'NORMAL') {
      setText(ui.title(), '空間追蹤已鎖定')
      setText(ui.text(), '保持鏡頭穩定一下，藝術體正在固定到現實空間。')
    } else if (reason === 'INITIALIZING') {
      setText(ui.title(), '正在建立空間座標')
      setText(ui.text(), '請緩慢左右移動手機，讓鏡頭看到地面、牆角、箱子等有細節的地方。')
    } else {
      setText(ui.title(), '追蹤訊號較弱')
      setText(ui.text(), '請慢慢左右移動；避免只拍純白牆面或過暗區域。')
    }
  }

  // IMPORTANT: derive the anchor from the Three.js camera itself.
  // XR8.Threejs.pipelineModule() has already mapped SLAM into this same scene,
  // so this avoids mixing raw-reality coordinates with rendered scene coordinates.
  const computeAnchorFromCamera = () => {
    if (!camera) return null

    camera.updateMatrixWorld(true)
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    camera.getWorldPosition(position)
    camera.getWorldQuaternion(quaternion)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize()

    // Keep it close enough to be unmistakably visible in a small indoor room.
    const distance = 1.55 + Math.random() * 0.25
    const anchor = position.clone().add(forward.multiplyScalar(distance))
    anchor.add(right.multiplyScalar((Math.random() - 0.5) * 0.12))
    anchor.y -= 0.05
    return anchor
  }

  const placeArt = () => {
    if (!art || !camera) return
    const anchor = computeAnchorFromCamera()
    if (!anchor) return

    art.spawn(anchor)
    placed = true
    pendingRespawn = false
    normalFrames = 10

    ui.reticle()?.classList.add('locked')
    ui.panel()?.classList.add('done')
    ui.controls()?.classList.remove('is-hidden')
    setText(ui.badge(), 'ANCHORED')
    ui.badge()?.classList.add('normal')

    window.setTimeout(() => {
      const panel = ui.panel()
      if (panel && placed) panel.style.display = 'none'
    }, 650)
  }

  const requestRespawn = () => {
    art?.dispose()
    pendingRespawn = true
    placed = false
    normalFrames = 0
    const panel = ui.panel()
    if (panel) {
      panel.style.display = ''
      panel.classList.remove('done')
    }
    ui.reticle()?.classList.remove('locked')
    setText(ui.title(), '選擇新的空間位置')
    setText(ui.text(), '把鏡頭朝向你想讓藝術出現的方向，慢慢移動手機。')
    if (ui.meter()) ui.meter().style.width = '10%'
  }

  return {
    name: 'spatial-art',

    onStart: ({canvas}) => {
      const xrScene = XR8.Threejs.xrScene()
      scene = xrScene.scene
      camera = xrScene.camera
      renderer = xrScene.renderer

      renderer.shadowMap.enabled = false
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      scene.background = null

      // Match the canonical 8th Wall world-effects setup: start above y=0,
      // then sync XR tracking to this scene origin.
      camera.position.set(0, 1.6, 2)
      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })

      art = new SpatialArt(scene)
      startedAt = performance.now()

      canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
      ui.respawn()?.addEventListener('click', requestRespawn)
      ui.recenter()?.addEventListener('click', () => {
        XR8.XrController.recenter()
        requestRespawn()
      })

      setText(ui.badge(), 'CAMERA READY')
    },

    onCameraStatusChange: ({status}) => {
      if (status === 'hasVideo') {
        setText(ui.badge(), 'SCANNING')
      }
    },

    onUpdate: ({processCpuResult}) => {
      const now = performance.now() * 0.001
      art?.update(now)

      const reality = processCpuResult?.reality
      if (!reality) return

      const {trackingStatus, trackingReason} = reality
      setTrackingUI(trackingStatus, trackingReason)

      if (trackingStatus === 'NORMAL') normalFrames += 1
      else normalFrames = Math.max(0, normalFrames - 1)

      // Shorter lock window than v1. Tracking must still be NORMAL, but the user
      // no longer has to wait almost a full second after acquiring it.
      if ((!placed || pendingRespawn) && normalFrames >= 10) {
        placeArt()
      }

      if (!placed && performance.now() - startedAt > 10000 && lastTrackingStatus !== 'NORMAL') {
        setText(ui.title(), '還沒有取得空間鎖定')
        setText(ui.text(), '鏡頭已正常。現在請拿著手機慢慢左右移動約 30～60 公分，不要只站著轉鏡頭。')
      }
    },

    listeners: [
      {
        event: 'reality.trackingstatus',
        process: ({detail}) => setTrackingUI(detail?.status, detail?.reason),
      },
    ],
  }
}
