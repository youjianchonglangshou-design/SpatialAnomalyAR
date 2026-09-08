import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {SpatialArt} from './art-system.js'

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
  let lastPose = null
  let normalFrames = 0
  let placed = false
  let pendingRespawn = false
  let startedAt = performance.now()

  const setTrackingUI = (status = 'LIMITED', reason = 'INITIALIZING') => {
    const badge = ui.badge()
    if (!badge) return
    badge.textContent = status
    badge.classList.toggle('normal', status === 'NORMAL')
    badge.classList.toggle('limited', status !== 'NORMAL')

    if (!placed) {
      const pct = Math.min(100, Math.max(5, Math.round((normalFrames / 24) * 100)))
      ui.meter().style.width = `${pct}%`
      if (status === 'NORMAL') {
        ui.title().textContent = '空間追蹤已鎖定'
        ui.text().textContent = '保持鏡頭穩定一下，藝術體會在畫面中央前方生成。'
      } else if (reason === 'INITIALIZING') {
        ui.title().textContent = '正在建立空間座標'
        ui.text().textContent = '請緩慢移動手機，讓鏡頭看到有紋理的地面、牆面或物件。'
      } else {
        ui.title().textContent = '追蹤訊號較弱'
        ui.text().textContent = '避免純白牆、黑暗與快速晃動，慢慢掃描附近環境。'
      }
    }
  }

  const computeAnchor = (pose) => {
    const p = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z)
    const q = new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize()

    const distance = 2.25 + Math.random() * 0.55
    const anchor = p.clone().add(forward.multiplyScalar(distance))
    anchor.add(right.multiplyScalar((Math.random() - 0.5) * 0.16))
    anchor.y -= 0.08 + Math.random() * 0.14
    return anchor
  }

  const placeArt = () => {
    if (!lastPose || !art) return
    const anchor = computeAnchor(lastPose)
    art.spawn(anchor)
    placed = true
    pendingRespawn = false
    normalFrames = 24

    ui.reticle().classList.add('locked')
    ui.panel().classList.add('done')
    ui.controls().classList.remove('is-hidden')
    window.setTimeout(() => {
      if (ui.panel()) ui.panel().style.display = 'none'
    }, 450)
  }

  const requestRespawn = () => {
    pendingRespawn = true
    placed = false
    normalFrames = 0
    ui.panel().style.display = ''
    ui.panel().classList.remove('done')
    ui.reticle().classList.remove('locked')
    ui.title().textContent = '選擇新的空間位置'
    ui.text().textContent = '把鏡頭對準你想放置的位置，保持穩定。'
    ui.meter().style.width = '10%'
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

      // 8th Wall requires the starting camera height to be above y=0.
      camera.position.set(0, 1.55, 0)
      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })

      art = new SpatialArt(scene)
      startedAt = performance.now()

      canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
      ui.respawn().addEventListener('click', requestRespawn)
      ui.recenter().addEventListener('click', () => {
        XR8.XrController.recenter()
        requestRespawn()
      })
    },

    onUpdate: ({processCpuResult}) => {
      const reality = processCpuResult.reality
      const now = performance.now() * 0.001
      art?.update(now)

      if (!reality) return
      const {position, rotation, trackingStatus, trackingReason} = reality
      if (position && rotation) lastPose = {position, rotation}
      setTrackingUI(trackingStatus, trackingReason)

      if (trackingStatus === 'NORMAL') normalFrames += 1
      else normalFrames = Math.max(0, normalFrames - 2)

      if ((!placed || pendingRespawn) && normalFrames >= 24 && lastPose) {
        placeArt()
      }

      // If tracking never becomes NORMAL, make the UI more explicit instead of silently hanging.
      if (!placed && performance.now() - startedAt > 12000 && trackingStatus !== 'NORMAL') {
        ui.title().textContent = '還沒有取得穩定追蹤'
        ui.text().textContent = '請增加環境光線，並對著有細節的桌面、地板或街景緩慢左右移動。'
      }
    },

    listeners: [
      {
        event: 'reality.trackingstatus',
        process: ({detail}) => setTrackingUI(detail.status, detail.reason),
      },
    ],
  }
}
