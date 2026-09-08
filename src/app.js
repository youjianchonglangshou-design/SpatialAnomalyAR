import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {worldArtPipelineModule} from './world-art-module.js?v=6'

window.THREE = THREE

let engineStarted = false
let videoReady = false
let xrWaitTimer = null
let videoWatchdog = null

const ui = {
  badge: () => document.getElementById('trackingBadge'),
  title: () => document.getElementById('statusTitle'),
  text: () => document.getElementById('statusText'),
  fatal: () => document.getElementById('fatal'),
  fatalText: () => document.getElementById('fatalText'),
  retry: () => document.getElementById('retryButton'),
}

const setText = (element, value) => {
  if (element) element.textContent = value
}

const showFatal = (message) => {
  clearTimeout(videoWatchdog)
  setText(ui.fatalText(), message)
  ui.fatal()?.classList.remove('is-hidden')
}

const setStartingState = (badge, title, text) => {
  setText(ui.badge(), badge)
  setText(ui.title(), title)
  setText(ui.text(), text)
}

const cameraLifecyclePipelineModule = () => ({
  name: 'camera-lifecycle-v5',

  onStart: () => {
    setStartingState('OPENING CAMERA', '正在開啟相機', '第一次使用時請允許相機權限。相機成功後就可以直接點位置生成。')
  },

  onCameraStatusChange: ({status}) => {
    if (status === 'hasVideo') {
      videoReady = true
      clearTimeout(videoWatchdog)
      setText(ui.badge(), 'TAP NOW')
      setText(ui.title(), '點一下你要生成的位置')
      setText(ui.text(), '相機已啟動。直接點畫面中的地面或空間位置。')
      return
    }

    if (status === 'failed') {
      showFatal('相機啟動失敗。請確認瀏覽器已允許此網站使用相機，然後按「重新啟動」。')
    }
  },
})

const startXR = () => {
  if (engineStarted) return
  if (!window.XR8) return
  engineStarted = true

  try {
    const canvas = document.getElementById('camerafeed')
    if (!canvas) throw new Error('找不到 camerafeed canvas')

    setStartingState('ENGINE READY', 'AR 引擎已載入', '正在請求相機，請稍候。')

    XR8.XrController.configure({
      disableWorldTracking: false,
      enableLighting: true,
      enableWorldPoints: false,
      scale: 'absolute',
    })

    if (!window.XRExtras?.FullWindowCanvas?.pipelineModule) {
      throw new Error('XRExtras FullWindowCanvas 未載入')
    }

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      XRExtras.FullWindowCanvas.pipelineModule(),
      cameraLifecyclePipelineModule(),
      worldArtPipelineModule(),
    ])

    const allowedDevices = XR8.XrConfig?.device?.().ANY
    const runOptions = allowedDevices
      ? {canvas, allowedDevices}
      : {canvas}

    XR8.run(runOptions)

    videoWatchdog = window.setTimeout(() => {
      if (!videoReady) {
        showFatal('已載入 AR 引擎，但 15 秒內沒有取得相機畫面。請檢查相機權限、關閉其他正在使用相機的 App，再按「重新啟動」。')
      }
    }, 15000)
  } catch (error) {
    console.error('XR startup failed:', error)
    showFatal(`AR 啟動失敗：${error?.message || '未知錯誤'}`)
  }
}

const waitForXR8 = () => {
  if (window.XR8) {
    startXR()
    return
  }

  setStartingState('LOADING XR', '正在載入 AR 引擎', '相機還沒有開始；正在等待 8th Wall SLAM 引擎。')

  const onXRLoaded = () => {
    clearInterval(xrWaitTimer)
    startXR()
  }

  // Attach immediately. Do not wait for window.load; xr.js itself is async.
  window.addEventListener('xrloaded', onXRLoaded, {once: true})

  // Extra guard for mobile browsers that can miss/custom-handle the xrloaded event.
  xrWaitTimer = window.setInterval(() => {
    if (window.XR8) {
      clearInterval(xrWaitTimer)
      startXR()
    }
  }, 100)

  window.setTimeout(() => {
    if (!window.XR8 && !engineStarted) {
      clearInterval(xrWaitTimer)
      showFatal('8th Wall AR 引擎 15 秒內沒有載入完成。請確認網路連線後按「重新啟動」。')
    }
  }, 15000)
}

const boot = () => {
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    showFatal('相機需要 HTTPS。請從 GitHub Pages 的 https:// 網址開啟。')
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showFatal('這個瀏覽器沒有提供相機 API。請改用最新版 Chrome / Safari。')
    return
  }

  ui.retry()?.addEventListener('click', () => location.reload())
  waitForXR8()
}

window.addEventListener('error', (event) => {
  console.error('window.error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('unhandledrejection:', event.reason)
})

// Important: bootstrap now, instead of waiting for window.load.
boot()
