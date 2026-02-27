# ProjectHub 🚀

一個整合多種網頁工具與小遊戲的應用中心平台，支援靜態網頁工具與後端 API 整合。

## 🌟 核心功能

### 1. 雲端隨身筆記 (Cloud Notes) 📝
- **跨裝置同步**：支援多使用者帳號登入，隨時存取筆記隨手記。
- **檔案附件**：支援多種格式檔案上傳與雲端下載。
- **大檔案傳輸**：優化伺服器限制，支援最高 50MB 的資料傳輸。

### 2. 人力需求總表 (Manpower Resource Manager) 📊
- **視覺化管理**：專為人力資源需求設計的網頁管理工具。
- **Excel 整合**：支援讀取與備份 Excel 檔案，方便資料交換。

### 3. 互動式矩形網格模擬 (Grid Simulation) 🟦
- 配置並觀察多層矩形網格的複雜動態行為與交互。

### 4. 特殊規則井字遊戲 (Tic-Tac-Toe) ⭕❌
- 經典遊戲加入特殊移除規則，支援雙人對戰及 AI 模式（Socket.IO 實作）。

## 🛠️ 技術棧

- **前端**: HTML5, Vanilla CSS, TailwindCSS (CDN), JavaScript.
- **後端**: Node.js (Express), Socket.IO.
- **部署**: [Render](https://render.com/) (內置 `render.yaml` 引導部署)。

## 🚀 快速啟動

1. **安裝依賴**:
   ```bash
   npm install
   ```
2. **啟動伺服器**:
   ```bash
   npm start
   ```
   伺服器預設運行於 `http://localhost:3000`。

## 📁 專案結構

- `/client`: 存放所有工具的前端靜態資源。
- `/server`: 主伺服器邏輯，整合所有應用的 API。
- `/apps`: 存放獨立的伺服器端處理器（如井字遊戲的 SocketHandler）。
- `/.agents/workflows`: 提供 AI 助手整合新工具的標準化作手流。

---
© 2024 ProjectHub by a777777735