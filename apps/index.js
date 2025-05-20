// ProjectHub/server/index.js
const express = require('express');
const http = require('http'); // http 模块是Node.js内置的
const path = require('path');

const app = express();
const mainServer = http.createServer(app); // 为主应用创建一个HTTP服务器实例

const PORT_MAIN = process.env.PORT || 3000; // 主前端服务器端口

// --- 静态文件服务 ---
// 将 client 目录作为静态资源的根目录
app.use(express.static(path.join(__dirname, '../client')));

// --- 页面路由 ---
// 主菜单页 (当访问根路径 / 时)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 井字棋游戏页 (当访问 /tic-tac-toe 时)
// 注意：这个路由确保了即使在浏览器地址栏直接输入 /tic-tac-toe 也能访问
// 而不是依赖静态服务器自动寻找 index.html
app.get('/tic-tac-toe', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/tic-tac-toe/index.html'));
});

// 网格模拟器页 (当访问 /grid-simulation 时)
app.get('/grid-simulation', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/grid-simulation/index.html'));
});

// 如果有其他单页应用，也需要类似的路由来处理它们的入口 index.html
// 例如，确保直接访问 /tic-tac-toe/some/deep/link 也能返回井字棋的index.html，由前端路由处理后续
// 这对于部署到Render并使用其路由重写功能时很有用。
// 对于本地Node.js服务器，上面的get路由已经足够提供入口HTML了。

mainServer.listen(PORT_MAIN, () => {
    console.log(`[MainServer] 主应用服务器运行于端口 ${PORT_MAIN}`);
    console.log(`  主菜单: http://localhost:${PORT_MAIN}/`);
    console.log(`  井字棋入口 (由主服务器路由): http://localhost:${PORT_MAIN}/tic-tac-toe`);
    console.log(`  网格模拟入口 (由主服务器路由): http://localhost:${PORT_MAIN}/grid-simulation`);
    console.log(`  (确保井字棋后端服务已在另外的端口独立运行，例如 http://localhost:3001)`);
});