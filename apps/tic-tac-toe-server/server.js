// ProjectHub/apps/tic-tac-toe-server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

const ticTacToeRooms = {}; // 使用特定名称避免与全局变量冲突

function checkWinner(board, symbol) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for(const condition of winConditions) {
        if(board[condition[0]] && board[condition[0]] === board[condition[1]] && board[condition[0]] === board[condition[2]]) {
            return board[condition[0]];
        }
    }
    return null;
}

function checkDraw(board) {
    return board.every(cell => cell !== '');
}

io.on('connection', (socket) => {
    console.log(`[TTT-Server] User connected: ${socket.id}`);

    socket.on('createRoom', ({ roomId, playerName, roomName, playerSymbol }) => {
        console.log(`[TTT-Server] createRoom:`, { roomId, playerName, roomName, playerSymbol, socketId: socket.id });
        if (ticTacToeRooms[roomId]) {
            console.log(`[TTT-Server] 创建房间 ${roomId} 失败: 房间已存在`);
            socket.emit('error', '房間已存在');
            return;
        }
        ticTacToeRooms[roomId] = {
            id: roomId,
            name: roomName || `${playerName}的井字棋房`,
            players: [{ id: socket.id, name: playerName, symbol: playerSymbol }],
            board: Array(9).fill(''),
            moves: { X: [], O: [] },
            movesCount: { X: 0, O: 0 },
            currentTurn: 'X',
            isGameStarted: false, // 新创建的房间，游戏尚未开始
            gameOver: false,      // 新创建的房间，游戏也未结束
            playAgainRequest: null
        };
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerSymbol }); // 通知创建者
        console.log(`[TTT-Server] 房间 ${roomId} (${ticTacToeRooms[roomId].name}) 创建成功，玩家 ${playerName} (${playerSymbol})`);
        console.log(`[TTT-Server] 新房间 ${roomId} 详情:`, JSON.stringify(ticTacToeRooms[roomId], null, 2)); // 增强日志
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        console.log(`[TTT-Server] joinRoom:`, { roomId, playerName, socketId: socket.id });
        const room = ticTacToeRooms[roomId];
        if (!room) {
            console.log(`[TTT-Server] 加入房间 ${roomId} 失败: 房间不存在`);
            socket.emit('error', '房間不存在');
            return;
        }
        if (room.players.length >= 2) {
            console.log(`[TTT-Server] 加入房间 ${roomId} 失败: 房间已满`);
            socket.emit('error', '房間已滿');
            return;
        }
        if (room.isGameStarted && !room.gameOver) { // 如果游戏已开始且尚未结束
            console.log(`[TTT-Server] 加入房间 ${roomId} 失败: 遊戲正在进行中`);
            socket.emit('error', '遊戲正在进行中，無法加入');
            return;
        }

        const playerSymbol = room.players[0].symbol === 'X' ? 'O' : 'X';
        room.players.push({ id: socket.id, name: playerName, symbol: playerSymbol });
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, playerSymbol });
        console.log(`[TTT-Server] 玩家 ${playerName} (${playerSymbol}) 加入房間 ${roomId} (${room.name})`);

        if (room.players.length === 2) {
            room.isGameStarted = true;  // **游戏开始**
            room.gameOver = false;     // **确保游戏未结束**
            room.playAgainRequest = null;
            // 重置棋盘和步数记录为新游戏
            room.board = Array(9).fill('');
            room.moves = { X: [], O: [] };
            room.movesCount = { X: 0, O: 0 };
            room.currentTurn = 'X'; // 新游戏总是X先手，或实现轮换

            console.log(`[TTT-Server] 房間 ${roomId} 人數已滿 (2人)，準備發送 startGame 事件`);
            io.to(roomId).emit('startGame', {
                players: room.players,
                board: room.board,
                currentTurn: room.currentTurn,
                roomName: room.name
            });
            console.log(`[TTT-Server] startGame 事件已發送至房間 ${roomId}`);
        } else {
            console.log(`[TTT-Server] 房間 ${roomId} 目前玩家數: ${room.players.length}，等待更多玩家。`);
        }
    });

    socket.on('getRoomList', () => {
        console.log(`[TTT-Server] 收到 getRoomList 請求來自 ${socket.id}`);
        console.log("[TTT-Server] 当前所有房间状态 (筛选前):", JSON.stringify(Object.values(ticTacToeRooms), null, 2));

        const availableRooms = Object.values(ticTacToeRooms)
            .filter(roomData => {
                const isAvailable = roomData.players.length < 2 && (!roomData.isGameStarted || roomData.gameOver);
                // console.log(`[TTT-Server] 筛选房间 ${roomData.id}: players=${roomData.players.length}, started=${roomData.isGameStarted}, over=${roomData.gameOver}. 可加入: ${isAvailable}`);
                return isAvailable;
            })
            .map(roomData => ({
                id: roomData.id,
                name: roomData.name || `房間 ${roomData.id.slice(0, 4)}`,
                playerCount: roomData.players.length,
            }));
        
        console.log(`[TTT-Server] 發送可用房間列表給 ${socket.id}:`, JSON.stringify(availableRooms, null, 2));
        socket.emit('roomList', availableRooms);
    });

    socket.on('makeMove', ({ roomId, index }) => {
        console.log(`[TTT-Server] makeMove:`, { roomId, index, socketId: socket.id });
        const room = ticTacToeRooms[roomId];
        if (!room) { socket.emit('error', '房間不存在'); return; }
        const player = room.players.find(p => p.id === socket.id);
        if (!player) { socket.emit('error', '玩家未找到'); return; }
        if (!room.isGameStarted || room.gameOver) { socket.emit('error', '遊戲未激活或已結束'); return; }
        if (room.currentTurn !== player.symbol) { socket.emit('error', '非你的回合'); return; }
        if (room.board[index] !== '') { socket.emit('error', '格子已占用'); return; }

        room.board[index] = player.symbol;
        room.moves[player.symbol].push(index);
        room.movesCount[player.symbol]++;
        
        let moveData = { player: player.name, symbol: player.symbol, index: Number(index) };
        
        if (room.movesCount[player.symbol] === 4 || room.movesCount[player.symbol] === 5) {
            if (checkWinner(room.board, player.symbol)) {
                io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
                io.to(roomId).emit('gameOver', { winner: player.name, symbol: player.symbol });
                if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
                console.log(`[TTT-Server] 游戏结束 (获胜-移除前): ${player.name} in room ${roomId}`);
                return;
            }
            if (room.moves[player.symbol].length > 0) {
                const firstMoveIndex = room.moves[player.symbol].shift();
                if (room.board[firstMoveIndex] === player.symbol) {
                    room.board[firstMoveIndex] = '';
                    moveData.removedPosition = firstMoveIndex;
                    io.to(roomId).emit('removePiece', { index: firstMoveIndex });
                } else {
                    if(firstMoveIndex !== undefined && (room.moves[player.symbol].length === 0 || room.moves[player.symbol][0] !== firstMoveIndex)) {
                        room.moves[player.symbol].unshift(firstMoveIndex);
                    }
                }
            }
        }
        
        if (checkWinner(room.board, player.symbol)) {
            io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
            io.to(roomId).emit('gameOver', { winner: player.name, symbol: player.symbol });
            if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
            console.log(`[TTT-Server] 游戏结束 (获胜): ${player.name} in room ${roomId}`);
            return;
        }
        if (checkDraw(room.board)) {
            io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
            io.to(roomId).emit('gameOver', { winner: null });
            if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
            console.log(`[TTT-Server] 游戏结束 (平局): room ${roomId}`);
            return;
        }

        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        io.to(roomId).emit('updateGame', {
            board: room.board,
            currentTurn: room.currentTurn,
            move: moveData
        });
    });

    socket.on('requestPlayAgain', ({ roomId }) => {
        console.log(`[TTT-Server] requestPlayAgain: room ${roomId}, from ${socket.id}`);
        const room = ticTacToeRooms[roomId];
        if (!room || !room.players || room.players.length !== 2) { socket.emit('error', '无法请求：房间无效或玩家不足。'); return; }
        if (room.isGameStarted && !room.gameOver) { socket.emit('error', '游戏尚未结束'); return; }

        const requestingPlayer = room.players.find(p => p.id === socket.id);
        if (!requestingPlayer) { socket.emit('error', '你不在这个房间内'); return; }

        if (!room.playAgainRequest) {
            const otherPlayer = room.players.find(p => p.id !== socket.id);
            if (!otherPlayer) { socket.emit('error', '找不到对方玩家。'); return; }
            room.playAgainRequest = { requesterId: socket.id, requesterName: requestingPlayer.name, responderId: otherPlayer.id, responderName: otherPlayer.name, requesterAccepted: true, responderAccepted: false };
            console.log(`[TTT-Server] 房间 ${roomId} 初始化再来一局请求:`, room.playAgainRequest);
            socket.emit('playAgainRequested', { message: '已发送请求，等待对方回应...' });
            io.to(otherPlayer.id).emit('opponentRequestedPlayAgain', { requesterName: requestingPlayer.name });
        } else if (room.playAgainRequest.requesterId === socket.id) {
            room.playAgainRequest.requesterAccepted = true;
            socket.emit('playAgainRequested', { message: '你已请求，等待对方回应...' });
            if (room.playAgainRequest.responderAccepted) checkAndRestartIfBothAccepted(roomId, room);
        } else if (room.playAgainRequest.responderId === socket.id) {
            room.playAgainRequest.responderAccepted = true;
            checkAndRestartIfBothAccepted(roomId, room);
        }
    });

    socket.on('acceptPlayAgain', ({roomId}) => {
        console.log(`[TTT-Server] acceptPlayAgain: room ${roomId}, from ${socket.id}`);
        const room = ticTacToeRooms[roomId];
        if (!room || !room.playAgainRequest) { socket.emit('error', '请求无效或已过期。'); return; }
        if (room.playAgainRequest.responderId === socket.id) {
            room.playAgainRequest.responderAccepted = true;
            checkAndRestartIfBothAccepted(roomId, room);
        } else if (room.playAgainRequest.requesterId === socket.id && room.playAgainRequest.responderAccepted){
            room.playAgainRequest.requesterAccepted = true;
            checkAndRestartIfBothAccepted(roomId, room);
        }
    });

    socket.on('rejectPlayAgain', ({roomId}) => {
        console.log(`[TTT-Server] rejectPlayAgain: room ${roomId}, from ${socket.id}`);
        const room = ticTacToeRooms[roomId];
        if (!room || !room.playAgainRequest) return;
        const rejectingPlayer = room.players.find(p => p.id === socket.id);
        if (!rejectingPlayer) return;
        const otherPlayerId = (socket.id === room.playAgainRequest.requesterId) ? room.playAgainRequest.responderId : room.playAgainRequest.requesterId;
        if (otherPlayerId) io.to(otherPlayerId).emit('playAgainRejected', { rejecterName: rejectingPlayer.name });
        room.playAgainRequest = null;
    });

    function checkAndRestartIfBothAccepted(roomId, room) {
        if (room && room.playAgainRequest && room.playAgainRequest.requesterAccepted && room.playAgainRequest.responderAccepted) {
            console.log(`[TTT-Server] Room ${roomId} 双方同意再来一局, 重启游戏`);
            room.board = Array(9).fill(''); room.moves = {X:[],O:[]}; room.movesCount = {X:0,O:0}; 
            room.currentTurn = 'X'; // 或者实现轮换
            room.isGameStarted = true;  // **新游戏开始**
            room.gameOver = false;     // **新游戏未结束**
            room.playAgainRequest = null;
            console.log(`[TTT-Server] 房间 ${roomId} 游戏重置，新回合由 ${room.currentTurn} 開始`);
            io.to(roomId).emit('restartGame', { 
                players: room.players, 
                board: room.board, 
                currentTurn: room.currentTurn, 
                roomName: room.name 
            });
        }
    }

    socket.on('disconnect', () => {
        console.log(`[TTT-Server] User disconnected: ${socket.id}`);
        for (const roomId in ticTacToeRooms) {
            const room = ticTacToeRooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const leavingPlayer = room.players[playerIndex];
                console.log(`[TTT-Server] 玩家 ${leavingPlayer.name} 从房间 ${roomId} 断开`);
                room.players.splice(playerIndex, 1);

                if (room.playAgainRequest) {
                    const otherPlayerId = (leavingPlayer.id === room.playAgainRequest.requesterId) ? room.playAgainRequest.responderId : room.playAgainRequest.requesterId;
                    if (otherPlayerId && room.players.find(p => p.id === otherPlayerId)) {
                        io.to(otherPlayerId).emit('playAgainCancelled', { reason: `${leavingPlayer.name} 已離開` });
                    }
                    room.playAgainRequest = null;
                }

                if (room.isGameStarted && !room.gameOver && room.players.length < 2) {
                    if (room.players.length === 1) {
                        const remainingPlayer = room.players[0];
                        io.to(remainingPlayer.id).emit('gameOver', { winner: remainingPlayer.name, symbol: remainingPlayer.symbol, reason: `${leavingPlayer.name} 已离开` });
                    }
                    room.isGameStarted = false; 
                    room.gameOver = true;
                } else if (room.players.length === 0) {
                    console.log(`[TTT-Server] 房间 ${roomId} 已空，删除`);
                    delete ticTacToeRooms[roomId];
                } else if (room.players.length === 1 && (!room.isGameStarted || room.gameOver)) { // 如果只剩一人，且游戏未开始或已结束
                     const remainingPlayerSocketId = room.players[0].id;
                     io.to(remainingPlayerSocketId).emit('playerDisconnected', { name: leavingPlayer.name, remainingPlayers: 1 });
                }
                break;
            }
        }
    });
});

// 健康检查路由
app.get('/', (req, res) => {
    res.status(200).send('ProjectHub Tic Tac Toe Socket.IO Server is running!');
});

server.listen(PORT, () => {
    console.log(`[TTT-Server] Socket.IO server for Tic Tac Toe listening on port ${PORT}`);
});