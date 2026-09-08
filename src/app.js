import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {worldArtPipelineModule} from './world-art-module.js'

window.THREE = THREE

const showFatal = (message) => {
  const fatal = document.getElementById('fatal')
  const text = document.getElementById('fatalText')
  text.textContent = message
  fatal.classList.remove('is-hidden')
}

const startXR = () => {
  try {
    XR8.XrController.configure({
      disableWorldTracking: false,
      enableLighting: true,
      enableWorldPoints: false,
      scale: 'absolute',
    })

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      LandingPage.pipelineModule(),
      XRExtras.FullWindowCanvas.pipelineModule(),
      XRExtras.Loading.pipelineModule(),
      XRExtras.RuntimeError.pipelineModule(),
      worldArtPipelineModule(),
    ])

    XR8.run({canvas: document.getElementById('camerafeed')})
  } catch (error) {
    console.error(error)
    showFatal(`AR 啟動失敗：${error?.message || '未知錯誤'}`)
  }
}

const onLoad = () => {
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    showFatal('相機需要 HTTPS。請部署到 GitHub Pages 後再用手機開啟網址。')
    return
  }

  if (window.XR8) startXR()
  else window.addEventListener('xrloaded', startXR, {once: true})
}

window.addEventListener('error', (event) => {
  console.error(event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason)
})

window.addEventListener('load', onLoad, {once: true})
