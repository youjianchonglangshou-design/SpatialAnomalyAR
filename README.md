# Spatial Anomaly AR

跨 **iPhone / Android** 的純前端 WebAR 空間錨定生成藝術原型。這版不需要 Python、Node.js 或 npm；GitHub Pages 直接就能部署。

## 這版會做什麼

1. 開啟手機鏡頭。
2. 使用 8th Wall SLAM 建立 6DoF 世界追蹤。
3. 當追蹤穩定後，在鏡頭中央前方約 2.3～2.8 公尺建立一次性的世界座標。
4. 在該座標生成隨機 3D 藝術體：扭曲核心、線圈、粒子、光暈都會持續動畫。
5. 你之後移動手機，藝術體本身的 world position 不再跟著手機更新，因此會呈現「留在原地」的視差效果。
6. 可按「重新生成」把新的藝術體放到目前鏡頭前方；「重設定位」會 recenter 後再選新位置。

## 手機需求

- iPhone：Safari，建議 iOS 16.4 以上。
- Android：Chrome / Edge / Samsung Internet / Firefox。
- 必須使用 HTTPS。GitHub Pages 本身就是 HTTPS。
- 環境需有足夠光線與可追蹤的視覺細節；純白牆、黑暗、快速晃動都會降低 SLAM 穩定性。

## 上傳 GitHub

1. 建立新的 GitHub repository。
2. 把這個資料夾內的 **所有檔案與資料夾** 上傳到 repository 根目錄，branch 使用 `main`。
3. GitHub → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
4. `.github/workflows/deploy-pages.yml` 會自動部署。
5. Actions 完成後，用手機開啟 Pages 網址：`https://<帳號>.github.io/<repo>/`
6. 第一次開啟時允許相機權限。

> 不要直接在手機用 `file://` 雙擊 index.html 測試。相機 WebAR 需要 HTTPS。

## 專案結構

```text
SpatialAnomalyAR/
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
├─ index.html
├─ README.md
└─ src/
   ├─ app.js
   ├─ world-art-module.js
   ├─ art-system.js
   └─ index.css
```

## 核心邏輯

真正讓藝術「留在原地」的是 `src/world-art-module.js`：

- 等 `trackingStatus === 'NORMAL'`。
- 讀取一次手機的世界 `position + rotation`。
- 用鏡頭 forward vector 算出前方 anchor。
- 呼叫 `art.spawn(anchor)`。
- 之後只更新藝術內部的 shader / rotation / particle animation，**不再更新 anchor 的 world position**。

因此手機移動時，畫面中的藝術會自然產生視差，而不是像濾鏡一樣黏著螢幕。

## 外部程式庫

本專案直接由 CDN 載入：

- 8th Wall XR Engine binary（SLAM）
- XR Extras
- 8th Wall Landing Page helper
- Three.js 0.183.2

所以 GitHub repository 本身不需要放 `node_modules` 或 proprietary engine binary。

## 8th Wall / Niantic Spatial notice

This product includes the XR Engine software developed by Niantic Spatial, Inc.  
Copyright © 2026 Niantic Spatial, Inc. All rights reserved.  
License: https://github.com/8thwall/engine/blob/main/LICENSE

The application code in this repository is separate from the XR Engine binary loaded from jsDelivr.

## V2 修正
- 修正 AR canvas 蓋住 HUD 的 stacking / z-index 問題。
- 錨點改由 `XR8.Threejs.xrScene().camera` 的世界座標直接計算，不再混用 raw reality pose。
- 藝術體改用更保守的 Three.js 基礎材質作為可見基線，降低行動 GPU shader 差異。
- NORMAL 追蹤後約 10 frames 自動放置，距離縮短至約 1.6m，室內更容易直接看到。
- 頂部會顯示 `SPATIAL ANOMALY · V2`；若仍看到舊版，請重新整理頁面/清除快取。
