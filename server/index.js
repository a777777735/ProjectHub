// ProjectHub/server/index.js
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const mainServer = http.createServer(app); // Renamed to avoid conflict if used elsewhere

const PORT_MAIN = process.env.PORT || 3000;

// --- 静态文件服务 ---
// client 目录是相对于当前 server/index.js 的上一级
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

// 可选: SPA fallback for sub-applications if they use client-side routing
// This example assumes if you go to /tic-tac-toe/some/path, you still want tic-tac-toe's index.html
app.get('/tic-tac-toe/*', (req, res) => {
    console.log(`[MainServer] Fallback for /tic-tac-toe/*, sending client/tic-tac-toe/index.html`);
    res.sendFile(path.join(clientPath, 'tic-tac-toe/index.html'));
});
app.get('/grid-simulation/*', (req, res) => {
    console.log(`[MainServer] Fallback for /grid-simulation/*, sending client/grid-simulation/index.html`);
    res.sendFile(path.join(clientPath, 'grid-simulation/index.html'));
});


mainServer.listen(PORT_MAIN, () => {
    console.log(`[MainServer] 主应用服务器运行于端口 ${PORT_MAIN}`);
    console.log(`  主菜单: http://localhost:${PORT_MAIN}/`);
    console.log(`  井字棋: http://localhost:${PORT_MAIN}/tic-tac-toe`);
    console.log(`  网格模拟: http://localhost:${PORT_MAIN}/grid-simulation`);
});