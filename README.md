# Spatial Anomaly AR V5

跨 Android / iPhone 的 WebAR 空間生成藝術原型。

## V5 修正

- 相機啟動流程改回 8th Wall 官方基線：JS 載入後立即檢查 XR8 / 監聽 `xrloaded`，不再等待 `window.load`。
- 移除不必要的 `XRExtras` 依賴，降低啟動失敗點。
- `XR8.run()` 在可用時明確使用 `allowedDevices: ANY`。
- 加入 XR 引擎 15 秒逾時、相機 15 秒逾時與「重新啟動」按鈕，不再無限停在黑畫面 STARTING。
- 相機成功後仍維持 V4 的操作：直接點畫面位置生成；不要求先左右移動 30–60 公分。

## GitHub Pages

把整包內容放在 repository 根目錄，GitHub Pages Source 選 GitHub Actions。

網址：

`https://<username>.github.io/<repo>/`

## 實機狀態字樣

正常順序應該是：

`LOADING XR` → `ENGINE READY` → `OPENING CAMERA` → `TAP NOW`

如果 15 秒內未取得相機，V5 會直接顯示原因區塊與重新啟動按鈕，而不是保持黑畫面。
