# Spatial Anomaly AR — V4 Tap-to-Place

這是一個可部署到 GitHub Pages 的跨平台 WebAR 原型，核心為 8th Wall Engine + Three.js。

## V4 的主要改動

- 不再等待 `trackingStatus === NORMAL` 才生成。
- 不再要求先左右移動手機 30～60 公分。
- 直接點畫面中的地面／空間位置，程式會用 `XR8.XrController.hitTest()` 嘗試取得該點的 3D 世界座標。
- 若 hit test 暫時沒有結果，會立刻使用地面交點或畫面射線作為 fallback，因此不會一直卡在「等待空間鎖定」。
- 生成後的藝術體固定在該世界座標；鏡頭移動時不會跟著螢幕移動。
- 「換一種藝術」只改視覺，不改位置。
- 「重新選位置」才會清除舊位置，讓你再點一次。
- V4 將藝術體尺寸縮小，避免 V3 一生成就貼得太近、塞滿整個畫面。

## 使用方式

1. 將本專案所有檔案上傳到 GitHub repository 根目錄。
2. GitHub → Settings → Pages → Source 選 `GitHub Actions`。
3. 等 workflow 部署完成。
4. 用 Android Chrome 或 iPhone Safari 開啟 Pages 網址並允許相機。
5. 直接點畫面中你想生成的位置。
6. 生成後移動手機，觀察物件是否留在原位置。

## 注意

真正的空間固定仍依賴 SLAM。V4 把「等待 SLAM 完全穩定」從放置流程移除，因此可以立刻點位置；如果環境太暗、表面完全沒有細節或 SLAM 尚未穩定，最初幾秒可能會有少量漂移。地面有裂紋、黑白細節、箱子邊角等通常會更穩。

## GitHub Pages

此 repo 已包含 `.github/workflows/deploy-pages.yml`，不需要 Node、npm 或 Python。
