const express = require('express');
const path = require('path'); // 引入 path 模組來處理檔案路徑
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 💡 讓 Express 可以讀取並提供同一資料夾下的靜態檔案 (包含 note.html)
app.use(express.static(__dirname));

const memoryDB = {};

// ==========================================
// 當使用者連線到 /note 時，回傳 note.html 檔案
// ==========================================
app.get('/note', (req, res) => {
    res.sendFile(path.join(__dirname, 'note.html'));
});

// ==========================================
// 後端 API 邏輯：處理登入、讀取與寫入
// ==========================================
app.post('/api/sync', (req, res) => {
    const { username, password, action, content, files } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "請輸入帳號和密碼" });
    }

    if (!memoryDB[username]) {
        memoryDB[username] = { password: password, content: "", files: [] };
    }

    if (memoryDB[username].password !== password) {
        return res.status(401).json({ error: "密碼錯誤，請重新輸入" });
    }

    if (action === 'write') {
        memoryDB[username].content = content;
        if (files && files.length > 0) {
            memoryDB[username].files = files; 
        } else if (!files) {
            memoryDB[username].files = [];
        }
        return res.json({ message: "✅ 文章與檔案儲存成功！" });
    } else { 
        return res.json({ 
            message: "✅ 讀取成功！", 
            content: memoryDB[username].content,
            files: memoryDB[username].files || []
        });
    }
});

app.listen(port, () => {
    console.log(`伺服器已啟動：http://localhost:${port}`);
});