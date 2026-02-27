// ProjectHub/apps/tic-tac-toe-server/socketHandler.js
const ticTacToeRooms = {};

function checkWinner(board, symbol) { /* ... (你的 checkWinner 实现) ... */ 
    const winConditions = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const condition of winConditions) { if(board[condition[0]] && board[condition[0]] === board[condition[1]] && board[condition[0]] === board[condition[2]]) return board[condition[0]]; } return null;
}
function checkDraw(board) { /* ... (你的 checkDraw 实现) ... */ 
    return board.every(cell => cell !== '');
}

module.exports = function initializeTicTacToeSocket(io) {
    // 如果你想为井字棋使用特定的 Socket.IO 命名空间 (推荐，以便未来扩展)
    // const tttNamespace = io.of('/tic-tac-toe');
    // tttNamespace.on('connection', (socket) => {
    // 或者，如果直接在根 io 实例上监听：
    io.on('connection', (socket) => {
        // 只有当连接来自井字棋页面时才处理这些事件 (可选，但更好)
        // 你可以通过客户端在连接时发送一个标识，或者检查 socket.handshake.headers.referer
        // 为了简单，我们先假设所有连接都可能对这些事件感兴趣，或者客户端JS只在井字棋页面建立连接
        console.log(`[TicTacToeHandler] User connected: ${socket.id}`);

        socket.on('createRoom', ({ roomId, playerName, roomName, playerSymbol }) => {
            console.log(`[TicTacToeHandler] createRoom:`, { roomId, playerName, roomName, playerSymbol });
            if (ticTacToeRooms[roomId]) {
                socket.emit('error', '井字棋房间已存在'); return;
            }
            ticTacToeRooms[roomId] = {
                id: roomId, name: roomName || `${playerName}的井字棋房`,
                players: [{ id: socket.id, name: playerName, symbol: playerSymbol }],
                board: Array(9).fill(''), moves: { X: [], O: [] }, movesCount: { X: 0, O: 0 },
                currentTurn: 'X', isGameStarted: false, gameOver: false, playAgainRequest: null
            };
            socket.join(roomId);
            socket.emit('roomCreated', { roomId, playerSymbol });
            console.log(`[TicTacToeHandler] 房间 ${roomId} 创建, 玩家 ${playerName}`);
        });

        socket.on('joinRoom', ({ roomId, playerName }) => {
            console.log(`[TicTacToeHandler] joinRoom:`, { roomId, playerName });
            const room = ticTacToeRooms[roomId];
            if (!room) { socket.emit('error', '房间不存在'); return; }
            if (room.players.length >= 2) { socket.emit('error', '房间已满'); return; }
            if (room.isGameStarted && !room.gameOver) { socket.emit('error', '遊戲正在进行中，無法加入'); return; }

            const playerSymbol = room.players[0].symbol === 'X' ? 'O' : 'X';
            room.players.push({ id: socket.id, name: playerName, symbol: playerSymbol });
            socket.join(roomId);
            socket.emit('roomJoined', { roomId, playerSymbol });

            if (room.players.length === 2) {
                room.isGameStarted = true; room.playAgainRequest = null; room.gameOver = false;
                room.board = Array(9).fill(''); room.moves = {X:[],O:[]}; room.movesCount = {X:0,O:0}; room.currentTurn = 'X';
                io.to(roomId).emit('startGame', { // 或者用 tttNamespace.to(roomId).emit
                    players: room.players, board: room.board, currentTurn: room.currentTurn, roomName: room.name
                });
            }
        });
        
        socket.on('getRoomList', () => {
            console.log(`[TicTacToeHandler] 收到 getRoomList 請求來自 ${socket.id}`);
            const availableRooms = Object.values(ticTacToeRooms)
                .filter(roomData => roomData.players.length < 2 && (!roomData.isGameStarted || roomData.gameOver))
                .map(roomData => ({
                    id: roomData.id, name: roomData.name || `房間 ${roomData.id.slice(0,4)}`, playerCount: roomData.players.length,
                }));
            socket.emit('roomList', availableRooms);
        });

        socket.on('makeMove', ({ roomId, index }) => {
            const room = ticTacToeRooms[roomId];
            if (!room || !room.players.find(p=>p.id===socket.id) || !room.isGameStarted || room.gameOver ) {socket.emit('error', '无效操作'); return;}
            const player = room.players.find(p => p.id === socket.id);
            if (room.currentTurn !== player.symbol || room.board[index] !== '') {socket.emit('error', '非你回合或格子已占'); return;}

            room.board[index] = player.symbol;
            room.moves[player.symbol].push(index);
            room.movesCount[player.symbol]++;
            let moveData = { player: player.name, symbol: player.symbol, index: Number(index) };

            if (room.movesCount[player.symbol] === 4 || room.movesCount[player.symbol] === 5) {
                if (checkWinner(room.board, player.symbol)) {
                    io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
                    io.to(roomId).emit('gameOver', { winner: player.name, symbol: player.symbol });
                    if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
                    return;
                }
                if (room.moves[player.symbol].length > 0) {
                    const firstMoveIndex = room.moves[player.symbol].shift();
                    if (room.board[firstMoveIndex] === player.symbol) {
                        room.board[firstMoveIndex] = '';
                        moveData.removedPosition = firstMoveIndex;
                        io.to(roomId).emit('removePiece', { index: firstMoveIndex });
                    } else {
                         if(firstMoveIndex !== undefined) room.moves[player.symbol].unshift(firstMoveIndex);
                    }
                }
            }
            if (checkWinner(room.board, player.symbol)) {
                io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
                io.to(roomId).emit('gameOver', { winner: player.name, symbol: player.symbol });
                if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
                return;
            }
            if (checkDraw(room.board)) {
                io.to(roomId).emit('updateGame', { board: room.board, currentTurn: null, move: moveData });
                io.to(roomId).emit('gameOver', { winner: null });
                if (room) { room.isGameStarted = false; room.gameOver = true; room.playAgainRequest = null; }
                return;
            }
            room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
            io.to(roomId).emit('updateGame', { board: room.board, currentTurn: room.currentTurn, move: moveData });
        });

        socket.on('requestPlayAgain', ({ roomId }) => {
            const room = ticTacToeRooms[roomId];
            if (!room || room.players.length !== 2 || (room.isGameStarted && !room.gameOver)) {socket.emit('error', '无法请求'); return;}
            const requestingPlayer = room.players.find(p => p.id === socket.id);
            if (!requestingPlayer) {socket.emit('error', '不在房内'); return;}
            if (!room.playAgainRequest) {
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                if (!otherPlayer) {socket.emit('error', '无对方玩家'); return;}
                room.playAgainRequest = { requesterId: socket.id, requesterName: requestingPlayer.name, responderId: otherPlayer.id, responderName: otherPlayer.name, requesterAccepted: true, responderAccepted: false };
                socket.emit('playAgainRequested', { message: '已发送请求...' });
                io.to(otherPlayer.id).emit('opponentRequestedPlayAgain', { requesterName: requestingPlayer.name });
            } else if (room.playAgainRequest.requesterId === socket.id) {
                room.playAgainRequest.requesterAccepted = true;
                socket.emit('playAgainRequested', { message: '已请求,等待对方...' });
                if (room.playAgainRequest.responderAccepted) checkAndRestartIfBothAccepted(roomId, room, io);
            } else if (room.playAgainRequest.responderId === socket.id) {
                room.playAgainRequest.responderAccepted = true;
                checkAndRestartIfBothAccepted(roomId, room, io);
            }
        });

        socket.on('acceptPlayAgain', ({roomId}) => {
            const room = ticTacToeRooms[roomId];
            if (!room || !room.playAgainRequest) {socket.emit('error', '请求无效'); return;}
            if (room.playAgainRequest.responderId === socket.id) {
                room.playAgainRequest.responderAccepted = true;
                checkAndRestartIfBothAccepted(roomId, room, io);
            } else if (room.playAgainRequest.requesterId === socket.id && room.playAgainRequest.responderAccepted){
                room.playAgainRequest.requesterAccepted = true;
                checkAndRestartIfBothAccepted(roomId, room, io);
            }
        });

        socket.on('rejectPlayAgain', ({roomId}) => {
            const room = ticTacToeRooms[roomId];
            if (!room || !room.playAgainRequest) return;
            const rejectingPlayer = room.players.find(p => p.id === socket.id);
            if (!rejectingPlayer) return;
            const otherPlayerId = (socket.id === room.playAgainRequest.requesterId) ? room.playAgainRequest.responderId : room.playAgainRequest.requesterId;
            if (otherPlayerId) io.to(otherPlayerId).emit('playAgainRejected', { rejecterName: rejectingPlayer.name });
            room.playAgainRequest = null;
        });

        socket.on('disconnect', () => {
            console.log(`[TicTacToeHandler] User ${socket.id} disconnected`);
            for (const roomId in ticTacToeRooms) {
                const room = ticTacToeRooms[roomId];
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    const leavingPlayer = room.players[playerIndex];
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
                            io.to(room.players[0].id).emit('gameOver', { winner: room.players[0].name, symbol: room.players[0].symbol, reason: `${leavingPlayer.name} 已离开` });
                        }
                        room.isGameStarted = false; room.gameOver = true;
                    } else if (room.players.length === 0) { delete ticTacToeRooms[roomId]; }
                    else if (room.players.length === 1) { io.to(room.players[0].id).emit('playerDisconnected', { name: leavingPlayer.name, remainingPlayers: 1 }); }
                    break;
                }
            }
        });
    });
};

function checkAndRestartIfBothAccepted(roomId, room, ioInstance) { // ioInstance is passed
    if (room && room.playAgainRequest && room.playAgainRequest.requesterAccepted && room.playAgainRequest.responderAccepted) {
        console.log(`[TicTacToeHandler] Room ${roomId}双方同意再来一局, 重启游戏`);
        room.board = Array(9).fill(''); room.moves = {X:[],O:[]}; room.movesCount = {X:0,O:0}; 
        room.currentTurn = 'X'; 
        room.isGameStarted = true; room.gameOver = false; room.playAgainRequest = null;
        ioInstance.to(roomId).emit('restartGame', { players: room.players, board: room.board, currentTurn: room.currentTurn, roomName: room.name });
    }
}
