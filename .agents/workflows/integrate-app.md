---
description: 將獨立 Local 網頁工具整合至 ProjectHub 平台的工作流
---

本工作流旨在指引 Agent 如何將一個本地開發的獨立網頁工具（如：人力總表、雲端隨身筆記）整合進 ProjectHub 專案系統中。

### 1. 來源分析 (Source Analysis)
- 檢查來源資料夾中的 `index.html`，確認其使用的 JS/CSS 資源是本地還是 CDN。
- 檢查是否有 `server.js` 或 API 邏輯（通常使用 `/api/...`）。
- 確認是否有 `package.json` 中的相依套件需要遷移。

### 2. 檔案遷移 (File Migration)
- 在 `ProjectHub/client/` 下建立與工具名稱對應的子目錄（例如 `Manpower/` 或 `CloudNotes/`）。
- 將來源網頁的所有靜態檔案複製入該目錄。
- **注意**：複製時需排除 `node_modules` 與 `.git` 目錄。

### 3. 主頁面集成 (UI Integration)
- 修改 `ProjectHub/client/index.html`。
- 在 `<main>` 區域的 Grid 佈局中新增一個 `<a>` 卡片。
- **卡片規範**：
  - 連結路徑指向子目錄下的 `index.html`。
  - 使用適當的色彩（如 `bg-orange-500` 或 `bg-cyan-500`）。
  - 加入描述與對應的 Lucide/Material 圖示 SVG。

### 4. 後端邏輯擴充 (Backend Extension)
- 開啟 `ProjectHub/server/index.js`。
- 將來源工具的 `server.js` 邏輯遷移至主伺服器：
  - **API 路由**：將 `app.post('/api/sync', ...)` 等邏輯加入 `server/index.js`。
  - **中間件**：如工具需要上傳大檔案，應確保主伺服器有 `express.json({ limit: '50mb' })` 設置。
  - **資料持久性**：若原工具使用 `memoryDB`，則直接遷移即可。

### 5. 同步與部署 (Sync & Deploy)
- 執行本地 Git 提交：
  ```powershell
  git add .
  git commit -m "Integrate [App Name] into ProjectHub"
  ```
- 推送至遠端 GitHub：
  ```powershell
  git push origin main
  ```
- 檢查 Render 等雲端平台的部署狀態，確認 API 呼叫無連線錯誤（Connection Error）。
