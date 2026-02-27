// ProjectHub/server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // Socket.IO Server
const path = require('path');
const initializeTicTacToeSocket = require('../apps/tic-tac-toe-server/socketHandler'); // 引入井字棋的处理器

const app = express();
const httpServer = http.createServer(app); // Renamed server to httpServer to avoid conflict

// 初始化 Socket.IO 并将其附加到 HTTP 服务器
const io = new Server(httpServer, {
    cors: {
        origin: "*", // 对于单一服务部署，CORS 可能不那么严格，但最好还是配置
                     // 如果前端和这个服务器在同一个 Render 服务下，通常不需要复杂的CORS
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- 静态文件服务 ---
const clientPath = path.join(__dirname, '../client');
console.log(`[MainServer] Serving static files from: ${clientPath}`);
app.use(express.static(clientPath));

// --- 页面路由 ---
app.get('/', (req, res) => {
    console.log('[MainServer] Request for /, sending client/index.html');
    res.sendFile(path.join(clientPath, 'index.html'));
});

app.get('/tic-tac-toe', (req, res) => {
    console.log('[MainServer] Request for /tic-tac-toe, sending client/tic-tac-toe/index.html');
    res.sendFile(path.join(clientPath, 'tic-tac-toe/index.html'));
});

app.get('/grid-simulation', (req, res) => {
    console.log('[MainServer] Request for /grid-simulation, sending client/grid-simulation/index.html');
    res.sendFile(path.join(clientPath, 'grid-simulation/index.html'));
});

// SPA fallbacks (如果子应用是SPA)
app.get('/tic-tac-toe/*', (req, res) => {
    console.log(`[MainServer] Fallback for /tic-tac-toe/*, sending client/tic-tac-toe/index.html`);
    res.sendFile(path.join(clientPath, 'tic-tac-toe/index.html'));
});
app.get('/grid-simulation/*', (req, res) => {
    console.log(`[MainServer] Fallback for /grid-simulation/*, sending client/grid-simulation/index.html`);
    res.sendFile(path.join(clientPath, 'grid-simulation/index.html'));
});


// --- 初始化 Socket.IO 应用逻辑 ---
initializeTicTacToeSocket(io); // 将 io 实例传递给井字棋的处理器

// 如果未来有其他应用需要 Socket.IO，可以类似地初始化它们的处理器
// const initializeOtherAppSockets = require('../apps/other-app/socketHandler');
// initializeOtherAppSockets(io); // 或者使用 io.of('/other-app-namespace')


httpServer.listen(PORT, () => { // 使用 httpServer.listen 而不是 app.listen
    console.log(`[MainServer] 主应用服务器 (HTTP & Socket.IO) 运行于端口 ${PORT}`);
    console.log(`  主菜单: http://localhost:${PORT}/`);
    console.log(`  井字棋: http://localhost:${PORT}/tic-tac-toe`);
    console.log(`  网格模拟: http://localhost:${PORT}/grid-simulation`);
});
