// ProjectHub/server/index.js
const express = require('express');
const http = require('http'); // http 模块是Node.js内置的
const path = require('path');

const app = express();
const mainServer = http.createServer(app);

const PORT_MAIN = process.env.PORT || 3000; // Render 会注入 PORT

// --- 静态文件服务 ---
// 将 client 目录作为静态资源的根目录
// 例如访问 /css/menu-style.css 会查找 client/css/menu-style.css
// 访问 /tic-tac-toe/style.css 会查找 client/tic-tac-toe/style.css
app.use(express.static(path.join(__dirname, '../client')));

// --- 页面路由 ---
// 主菜单页
app.get('/', (req, res) => {
    console.log('[MainServer] Request for / received, sending client/index.html');
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 井字棋游戏页
app.get('/tic-tac-toe', (req, res) => {
    console.log('[MainServer] Request for /tic-tac-toe received, sending client/tic-tac-toe/index.html');
    res.sendFile(path.join(__dirname, '../client/tic-tac-toe/index.html'));
});

// 网格模拟器页
app.get('/grid-simulation', (req, res) => {
    console.log('[MainServer] Request for /grid-simulation received, sending client/grid-simulation/index.html');
    res.sendFile(path.join(__dirname, '../client/grid-simulation/index.html'));
});

// 可选: 处理所有其他未匹配的GET请求，都返回主菜单 (用于前端路由的 fallback)
// 或者，如果你希望子应用的深层链接也能工作，可能需要更复杂的处理
// 但对于直接提供 index.html，上面的已经够了
// app.get('*', (req, res) => {
//   console.log(`[MainServer] Catch-all for ${req.path}, sending client/index.html`);
//   res.sendFile(path.join(__dirname, '../client/index.html'));
// });


mainServer.listen(PORT_MAIN, () => {
    console.log(`[MainServer] 主应用服务器运行于端口 ${PORT_MAIN}`);
    console.log(`  主菜单入口: /`);
    console.log(`  井字棋入口: /tic-tac-toe`);
    console.log(`  网格模拟入口: /grid-simulation`);
});
