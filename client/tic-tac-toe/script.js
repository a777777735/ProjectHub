// ProjectHub/client/tic-tac-toe/script.js

// --- Socket.IO Connection ---
let ticTacToeServerUrl = '';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    ticTacToeServerUrl = 'http://localhost:3001'; // 本地井字棋后端端口
} else {
    // !!!! 重要：部署到Render后，这里必须替换为你的井字棋后端服务的实际URL !!!!
    // 例如: ticTacToeServerUrl = 'https://your-projecthub-ttt-backend.onrender.com';
    ticTacToeServerUrl = 'https://tic-tac-toe-server-56n6.onrender.com'; // <<--- 务必替换为你自己的后端URL
}
console.log(`[Client-TTT] Connecting to Socket.IO server at the current origin`);
const socket = io(window.location.origin, { // 连接到当前页面的源
    // 如果你为井字棋使用了命名空间 (例如在 server/index.js 中用 io.of('/tic-tac-toe'))
    // path: '/tic-tac-toe/socket.io', // (通常不需要，除非服务器端配置了不同的path)
    // 如果使用了命名空间，应该是: const socket = io(window.location.origin + '/your-namespace');
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
});
// --- 全局变量和状态 ---
let gameMode = ''; // 'multiplayer' or 'ai'
let currentRoom = ''; // 当前客户端所在的房间ID
let playerSymbol = ''; // 当前客户端的棋子符号 (X 或 O)
let playerName = '';   // 当前客户端的玩家名
let opponentName = ''; // 对手的名字
let isMyTurn = false;  // 当前是否轮到本客户端操作
let gameBoard = Array(9).fill(''); // 本地维护的棋盘状态
let gameActive = false; // 游戏是否正在进行中

// 用于AI模式或客户端预测特殊规则（多人模式的权威在服务器）
let clientMovesCount = { X: 0, O: 0 };
let clientMovesOrder = { X: [], O: [] }; // 记录棋子落点顺序，用于移除

const cells = document.querySelectorAll('.game-cell'); // 获取所有棋盘格子元素

// 动态创建的游戏内结果显示和按钮 (在DOM加载后实际附加)
let gameScreenResultHeader, playAgainButtonGameScreen, backToStartButtonGameScreen;


// --- UI 更新和屏幕切换 ---
function initializeDynamicElements() {
    console.log("[Client-TTT] initializeDynamicElements 调用");
    gameScreenResultHeader = document.createElement('h2');
    gameScreenResultHeader.id = 'gameScreenResultHeader';
    gameScreenResultHeader.classList.add('text-xl', 'sm:text-2xl', 'font-bold', 'text-center', 'my-4', 'hidden');
    
    playAgainButtonGameScreen = document.createElement('button');
    playAgainButtonGameScreen.id = 'playAgainButtonGameScreen';
    playAgainButtonGameScreen.classList.add('bg-blue-600', 'text-white', 'px-5', 'sm:px-6', 'py-2.5', 'sm:py-3', 'rounded-lg', 'hover:bg-blue-700', 'active:bg-blue-800', 'transition', 'shadow', 'hover:shadow-md', 'text-sm', 'sm:text-base', 'mt-4', 'mx-auto', 'block', 'hidden');
    playAgainButtonGameScreen.onclick = requestPlayAgain; // 绑定事件


    backToStartButtonGameScreen = document.createElement('button');
    backToStartButtonGameScreen.id = 'backToStartButtonGameScreen';
    backToStartButtonGameScreen.textContent = '返回主頁';
    backToStartButtonGameScreen.classList.add('bg-gray-600', 'text-white', 'px-5', 'sm:px-6', 'py-2.5', 'sm:py-3', 'rounded-lg', 'hover:bg-gray-700', 'active:bg-gray-800', 'transition', 'shadow', 'hover:shadow-md', 'text-sm', 'sm:text-base', 'mt-2', 'mx-auto', 'block', 'hidden');
    backToStartButtonGameScreen.onclick = backToStart; // 绑定事件

    const gameScreenResultContainer = document.getElementById('gameScreenResultContainer');
    if (gameScreenResultContainer) {
        gameScreenResultContainer.appendChild(gameScreenResultHeader);
        gameScreenResultContainer.appendChild(playAgainButtonGameScreen);
        gameScreenResultContainer.appendChild(backToStartButtonGameScreen);
    } else {
        console.error("[Client-TTT] Cannot find #gameScreenResultContainer to attach dynamic elements.");
    }
}

function showScreen(screenId) {
    console.log(`[Client-TTT] showScreen: 嘗試顯示 ${screenId}`);
    const screens = ['startScreen', 'roomOptions', 'waitingScreen', 'gameScreen']; // 移除了gameOverScreen，因为它不再独立显示
    screens.forEach(id => {
        const screenElement = document.getElementById(id);
        if (screenElement) {
            screenElement.classList.add('hidden');
        } else {
             console.warn(`[Client-TTT] showScreen: 找不到ID为 '${id}' 的屏幕元素`);
        }
    });
    
    const screenToShow = document.getElementById(screenId);
    if (screenToShow) {
        screenToShow.classList.remove('hidden');
        console.log(`[Client-TTT] showScreen: ${screenId} 的 hidden class 已移除`);
    } else {
        console.error(`[Client-TTT] showScreen: 找不到 ID 為 '${screenId}' 的 HTML 元素！`);
    }
}

function resetUIStateForNewGame() {
    console.log("[Client-TTT] resetUIStateForNewGame 调用");
    const movesLogEl = document.getElementById('movesLog');
    if(movesLogEl) movesLogEl.innerHTML = '';
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('occupied', 'player-x', 'player-o', 'bg-yellow-300', 'animate-pulse');
        cell.style.cursor = 'pointer';
    });

    const gameStatusEl = document.getElementById('gameStatus');
    if (gameStatusEl) {
        gameStatusEl.textContent = "遊戲即將開始...";
        gameStatusEl.classList.remove('hidden');
        // 清理可能的旧颜色状态，在updateGameStatus中会重新设置
        gameStatusEl.classList.remove('bg-green-100', 'text-green-700', 'border-green-300', 'bg-red-100', 'text-red-700', 'border-red-300', 'bg-gray-200', 'text-gray-600');
        gameStatusEl.classList.add('bg-blue-50'); // 一个默认的准备颜色
    }

    if (gameScreenResultHeader) {
        gameScreenResultHeader.innerHTML = '';
        gameScreenResultHeader.className = 'text-xl sm:text-2xl font-bold text-center my-4 hidden'; // 重置样式并隐藏
    }
    if (playAgainButtonGameScreen) {
        playAgainButtonGameScreen.classList.add('hidden');
        playAgainButtonGameScreen.disabled = false;
    }
    if (backToStartButtonGameScreen) {
        backToStartButtonGameScreen.classList.add('hidden');
    }
}

function backToStart() {
    console.log(`[Client-TTT] backToStart 调用，当前房间: ${currentRoom}, 模式: ${gameMode}`);
    if (currentRoom && gameMode === 'multiplayer' && socket.connected) {
        console.log(`[Client-TTT] 发送 leaveRoom 事件到房间 ${currentRoom}`);
        socket.emit('leaveRoom', { roomId: currentRoom });
    }
    gameActive = false;
    currentRoom = '';
    playerSymbol = '';
    isMyTurn = false;
    gameBoard = Array(9).fill('');
    clientMovesCount = { X: 0, O: 0 };
    clientMovesOrder = { X: [], O: [] };
    gameMode = '';

    resetUIStateForNewGame();
    showScreen('startScreen');
    // 如果要返回项目主菜单: window.location.href = '/'; (或 '../index.html' 如果Live Server根是client)
}

function showRoomOptions() {
    console.log('[Client-TTT] showRoomOptions 调用');
    gameMode = 'multiplayer';
    resetUIStateForNewGame(); // 确保UI干净
    showScreen('roomOptions');
    console.log('[Client-TTT] 即将调用 requestRoomList from showRoomOptions');
    requestRoomList(); // **确保这里被调用**
}

function requestRoomList() {
    console.log('[Client-TTT] requestRoomList: 請求房間列表');
    if (!socket.connected) {
        console.warn("[Client-TTT] Socket 未连接，无法请求房间列表");
        const roomListContainer = document.getElementById('availableRoomsContainer');
        if(roomListContainer) roomListContainer.innerHTML = '<p class="text-red-500 text-center py-4 text-sm">连接服务器失败，请刷新。</p>';
        return;
    }
    socket.emit('getRoomList');
    const roomListContainer = document.getElementById('availableRoomsContainer');
    if (roomListContainer) {
         roomListContainer.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm">正在刷新房間列表...</p>';
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom() {
    console.log('[Client-TTT] createRoom 调用');
    playerName = document.getElementById('playerName1').value.trim();
    if (!playerName) {
        alert('請輸入你的名字！');
        document.getElementById('playerName1').focus();
        return;
    }
    const roomName = document.getElementById('roomNameInput').value.trim() || `${playerName}的房間`;
    currentRoom = generateRoomId();
    playerSymbol = 'X'; // 创建者默认为X

    console.log('[Client-TTT] 准备发送 createRoom 事件:', { roomId: currentRoom, playerName, roomName, playerSymbol });
    socket.emit('createRoom', { roomId: currentRoom, playerName, roomName, playerSymbol });
    
    document.getElementById('roomIdDisplay').value = currentRoom;
    document.getElementById('waitingTitle').textContent = `房間 "${roomName}" (${currentRoom}) 等待對手加入...`;
    resetUIStateForNewGame();
    showScreen('waitingScreen');
}

function joinRoom() {
    console.log('[Client-TTT] joinRoom 调用');
    const roomIdToJoin = document.getElementById('roomIdInput').value.trim().toUpperCase();
    if (!roomIdToJoin) {
        alert('請輸入房間號碼');
        document.getElementById('roomIdInput').focus();
        return;
    }
    playerName = document.getElementById('playerName2').value.trim();
    if (!playerName) {
        alert('請輸入你的名字！');
        document.getElementById('playerName2').focus();
        return;
    }
    currentRoom = roomIdToJoin;
    console.log('[Client-TTT] 准备发送 joinRoom 事件:', { roomId: currentRoom, playerName });
    socket.emit('joinRoom', { roomId: currentRoom, playerName });
    const roomListContainer = document.getElementById('availableRoomsContainer');
    if(roomListContainer) roomListContainer.innerHTML = `<p class="text-blue-600 text-center py-4 text-sm">正在加入房間 ${currentRoom}...</p>`;
}

function copyRoomId() {
    console.log('[Client-TTT] copyRoomId 调用');
    const roomIdInput = document.getElementById('roomIdDisplay');
    if (!roomIdInput || !roomIdInput.value) { alert('沒有房間號可複製'); return; }
    roomIdInput.select(); 
    roomIdInput.setSelectionRange(0, 99999); // For mobile devices
    try {
        const successful = document.execCommand('copy');
        alert(successful ? '房間號已複製到剪貼板' : '複製失敗');
    } catch (err) { 
        alert('無法複製房間號'); 
        console.error('[Client-TTT] Copy failed:', err); 
    }
    if (window.getSelection) { window.getSelection().removeAllRanges(); } 
    else if (document.selection) { document.selection.empty(); }
}

function cancelWaiting() { 
    console.log('[Client-TTT] cancelWaiting 调用');
    backToStart(); 
}

function leaveGame() { 
    console.log('[Client-TTT] leaveGame 调用');
    if (confirm('確定要離開遊戲嗎？')) { 
        backToStart(); 
    } 
}

// --- Socket Event Handlers ---
socket.on('connect', () => { 
    console.log(`[Client-TTT] 已連接到井字棋伺服器, Socket ID: ${socket.id}`); 
});

socket.on('disconnect', (reason) => {
    console.warn(`[Client-TTT] 与井字棋服务器断开连接: ${reason}`);
    if (gameActive) {
        alert("与服务器的连接已断开，游戏将返回开始界面。");
        gameActive = false; 
        updateGameStatus(); // 更新状态栏
        backToStart(); // 或者直接显示一个断线消息的屏幕
    }
});

socket.on('connect_error', (err) => { 
    console.error(`[Client-TTT] 連接錯誤: ${err.message}`, err); 
    // Avoid alert if game is not active or on initial load, can be annoying
    if (gameActive || document.getElementById('startScreen').classList.contains('hidden')) { // Only alert if not on start screen
        alert("無法連接到井字棋遊戲伺服器。请检查后端服务是否运行，或刷新页面。");
    }
});

socket.on('roomCreated', ({ roomId, playerSymbol: assignedSymbol }) => { 
    console.log(`[Client-TTT] roomCreated: ${roomId}, symbol: ${assignedSymbol}`); 
    playerSymbol = assignedSymbol; 
    currentRoom = roomId; 
});

socket.on('roomJoined', ({ roomId, playerSymbol: assignedSymbol }) => { 
    console.log(`[Client-TTT] roomJoined: ${roomId}, symbol: ${assignedSymbol}`); 
    playerSymbol = assignedSymbol; 
    currentRoom = roomId; 
});

socket.on('startGame', ({ players, board, currentTurn, roomName: serverRoomName }) => {
    console.log(`[Client-TTT] startGame:`, { players, board, currentTurn, serverRoomName });
    if (!document.getElementById('gameScreen')) { console.error("[Client-TTT] startGame: gameScreen 元素未找到!"); return; }
    
    gameBoard = Array.from(board);
    gameActive = true; // 游戏激活
    const me = players.find(p => p.id === socket.id);
    const opponent = players.find(p => p.id !== socket.id);

    if (!me) { console.error("[Client-TTT] startGame: 未找到玩家信息!"); backToStart(); return; }
    
    playerName = me.name; 
    playerSymbol = me.symbol;
    opponentName = opponent ? opponent.name : '對手等待中';
    
    document.getElementById('gameRoomId').textContent = `${serverRoomName || "遊戲房"} (${currentRoom})`;
    const pXEl = document.getElementById('playerXName');
    const pOEl = document.getElementById('playerOName');
    const pXInfo = players.find(p => p.symbol === 'X');
    const pOInfo = players.find(p => p.symbol === 'O');
    if (pXEl) pXEl.textContent = pXInfo ? `${pXInfo.name} (X)` : '玩家X';
    if (pOEl) pOEl.textContent = pOInfo ? `${pOInfo.name} (O)` : '玩家O';
    
    isMyTurn = currentTurn === playerSymbol;
    clientMovesCount = { X: 0, O: 0 }; 
    clientMovesOrder = { X: [], O: [] };
    
    resetUIStateForNewGame(); // 清理上一局可能存在的UI状态
    startGameUIUpdates();
    console.log("[Client-TTT] startGame 完成, 内部状态:", { currentRoom, playerName, playerSymbol, opponentName, isMyTurn, gameActive });
});

function startGameUIUpdates() {
    console.log("[Client-TTT] startGameUIUpdates");
    if (gameScreenResultHeader) gameScreenResultHeader.classList.add('hidden');
    if (playAgainButtonGameScreen) playAgainButtonGameScreen.classList.add('hidden');
    if (backToStartButtonGameScreen) backToStartButtonGameScreen.classList.add('hidden');
    
    showScreen('gameScreen');
    updateGameStatus();
    
    cells.forEach(cell => {
        cell.removeEventListener('click', handleCellClick); // 确保移除旧监听器
        cell.addEventListener('click', handleCellClick);
        cell.style.cursor = 'pointer'; // 游戏开始时，格子可点
    });

    if (gameMode === 'ai' && !isMyTurn) { // AI先手
        aiMove();
    }
}

socket.on('updateGame', ({ board, currentTurn, move }) => {
    console.log(`[Client-TTT] updateGame:`, { board, currentTurn, move, gameActive });
    if (!gameActive) return;
    if (!move || typeof move.index === 'undefined' || !move.symbol) { console.error('[Client-TTT] updateGame: 无效的 move 数据'); return; }
    
    gameBoard = Array.from(board); 
    isMyTurn = currentTurn === playerSymbol;
    
    const movedCell = cells[move.index];
    if (movedCell) { 
        movedCell.textContent = move.symbol; 
        movedCell.classList.add('occupied', move.symbol === 'X' ? 'player-x' : 'player-o'); 
    } else {
        console.error(`[Client-TTT] updateGame: 找不到索引为 ${move.index} 的格子`);
    }
    logMove(move.player, move.symbol, move.index, move.removedPosition); 
    updateGameStatus();
});

socket.on('removePiece', ({ index }) => {
    console.log(`[Client-TTT] removePiece: ${index}`);
    if (typeof index !== 'number' || index < 0 || index >= gameBoard.length) { console.error('[Client-TTT] 无效的 removePiece index'); return; }
    gameBoard[index] = ''; 
    const cellToRemove = cells[index];
    if (cellToRemove) { 
        cellToRemove.textContent = ''; 
        cellToRemove.classList.remove('occupied', 'player-x', 'player-o'); 
    }  else {
        console.error(`[Client-TTT] removePiece: 找不到索引为 ${index} 的格子`);
    }
});

socket.on('gameOver', ({ winner, symbol, reason }) => {
    console.log(`[Client-TTT] gameOver:`, { winner, symbol, reason });
    // gameActive 在 endGameOnScreen 中设置
    let resultText = ''; 
    let icon = '🤔';
    if (winner) { 
        resultText = `${winner} (${symbol}) 獲勝！`; 
        icon = (winner === playerName && symbol === playerSymbol) ? '🎉' : '😔'; 
    } else { 
        resultText = '遊戲平局！'; 
        icon = '🤝'; 
    }
    if (reason) resultText += ` (${reason})`;
    endGameOnScreen(resultText, icon);
});

socket.on('playerDisconnected', ({name, remainingPlayers}) => {
    console.log(`[Client-TTT] playerDisconnected: ${name}, remaining: ${remainingPlayers}`);
    if (opponentName === name) { 
        opponentName = "對手已離開"; 
        const playerONameEl = document.getElementById('playerOName');
        const playerXNameEl = document.getElementById('playerXName');
        const myOpponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
        if (playerONameEl && playerONameEl.textContent.includes(`(${myOpponentSymbol})`)) {
            playerONameEl.textContent = opponentName + ` (${myOpponentSymbol})`;
        } else if (playerXNameEl && playerXNameEl.textContent.includes(`(${myOpponentSymbol})`)) {
            playerXNameEl.textContent = opponentName + ` (${myOpponentSymbol})`;
        }
    }
    if (gameActive) {
        // 服务器会发送 gameOver 事件，客户端会通过 endGameOnScreen 处理
        // 这里可以额外提示一下，但不要直接结束游戏，听服务器的
        console.log(`[Client-TTT] 游戏进行中，${name} 断线，等待服务器 gameOver 事件`);
    } else if (document.getElementById('waitingScreen').classList.contains('hidden') === false && remainingPlayers === 1) {
        document.getElementById('waitingTitle').textContent = `對手 ${name} 已離開，等待新對手...`;
    }
    
    // 清理可能存在的“再来一局”请求UI
    const gameScreenReqHeader = document.getElementById('gameScreenResultHeader');
    if (gameScreenReqHeader && gameScreenReqHeader.querySelector('button#dynamicAcceptBtn')) { // 如果正在显示同意/拒绝按钮
        if (gameScreenReqHeader.textContent.includes(name)) { // 如果是请求者断线
            gameScreenReqHeader.innerHTML = `<p class="text-gray-600">玩家 ${name} 已離開，再來一局已取消。</p>`;
            if(playAgainButtonGameScreen) {playAgainButtonGameScreen.classList.remove('hidden'); playAgainButtonGameScreen.disabled=false;}
            if(backToStartButtonGameScreen) backToStartButtonGameScreen.classList.remove('hidden');
        }
    }
});

socket.on('error', (message) => { 
    console.error('[Client-TTT] Server Error:', message); 
    alert(`伺服器錯誤: ${message}`); 
});

socket.on('roomList', (roomList) => {
    console.log('[Client-TTT] roomList:', roomList);
    const container = document.getElementById('availableRoomsContainer'); if (!container) return;
    container.innerHTML = '';
    if (!roomList || roomList.length === 0) { container.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm">目前沒有可加入的房間。創建一個吧！</p>'; return; }
    const ul = document.createElement('ul'); ul.classList.add('space-y-2');
    roomList.forEach(room => {
        const li = document.createElement('li');
        li.classList.add('p-3', 'border', 'rounded-md', 'flex', 'justify-between', 'items-center', 'hover:bg-gray-100', 'transition', 'shadow-sm');
        
        const roomInfoDiv = document.createElement('div');
        roomInfoDiv.classList.add('flex-grow', 'mr-2', 'overflow-hidden');
        roomInfoDiv.innerHTML = `
            <span class="font-semibold text-indigo-700 break-words block truncate" title="${room.name}">${room.name}</span>
            <span class="text-xs text-gray-500 block">ID: ${room.id}</span>
        `;

        const playerCountDiv = document.createElement('div');
        playerCountDiv.classList.add('text-sm', 'text-gray-600', 'mr-3', 'flex-shrink-0');
        playerCountDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-1 text-gray-400 align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ${room.playerCount}/2 人
        `;

        const joinButton = document.createElement('button');
        joinButton.textContent='加入';
        joinButton.classList.add('bg-green-500', 'text-white', 'px-3', 'py-1.5', 'rounded', 'text-sm', 'hover:bg-green-600', 'active:bg-green-700', 'flex-shrink-0');
        joinButton.onclick = (e) => { e.stopPropagation(); joinListedRoom(room.id); };
        
        li.appendChild(roomInfoDiv);
        li.appendChild(playerCountDiv);
        li.appendChild(joinButton);
        li.style.cursor = 'pointer';
        li.onclick = (e) => { if (e.target !== joinButton && !joinButton.contains(e.target)) joinListedRoom(room.id); };
        ul.appendChild(li);
    });
    container.appendChild(ul);
});

function joinListedRoom(roomId) {
    console.log(`[Client-TTT] joinListedRoom: ${roomId}`);
    document.getElementById('roomIdInput').value = roomId;
    const pName = document.getElementById('playerName2').value.trim();
    if (!pName) { alert('請先在 "加入已有房間" 區塊輸入你的名字！'); document.getElementById('playerName2').focus(); return; }
    joinRoom();
}

// --- AI Game Logic ---
function startAIGame() {
    console.log('[Client-TTT] startAIGame'); gameMode = 'ai';
    playerName = document.getElementById('playerName1').value.trim() || '玩家';
    opponentName = 'AI智能體'; playerSymbol = 'X'; isMyTurn = true; currentRoom = 'AI對戰';
    gameActive = true; gameBoard = Array(9).fill(''); clientMovesCount = {X:0,O:0}; clientMovesOrder = {X:[],O:[]};
    
    const elGameRoomId = document.getElementById('gameRoomId'); if(elGameRoomId) elGameRoomId.textContent = currentRoom;
    const elPlayerX = document.getElementById('playerXName'); if(elPlayerX) elPlayerX.textContent = `${playerName} (X)`;
    const elPlayerO = document.getElementById('playerOName'); if(elPlayerO) elPlayerO.textContent = `${opponentName} (O)`;
    
    resetUIStateForNewGame(); 
    startGameUIUpdates();
    console.log('[Client-TTT] startAIGame 完成');
}

function aiMove() {
    if (!gameActive || isMyTurn || gameMode !== 'ai') return;
    console.log('[Client-TTT] aiMove');
    const elStatus = document.getElementById('gameStatus'); if(elStatus) elStatus.textContent = `${opponentName} (O) 思考中...`;
    
    setTimeout(() => { 
        if (!gameActive) { // Double check game is still active after timeout
            console.log("[Client-TTT] aiMove timeout: 游戏已结束，AI不再行动");
            return;
        }
        let bestMove = findBestMove();
        if (bestMove !== -1 && gameBoard[bestMove] === '') { 
            makeMoveAI(bestMove, 'O'); 
        } else { 
            if (checkDraw() && gameActive) endGameOnScreen('遊戲平局！ (AI無法行動)');
            else if (gameActive) console.error("[Client-TTT] AI无法找到有效移动，但游戏仍在进行中。");
        }
    }, Math.random() * 400 + 600);
}

function findBestMove() {
    const o = 'O', x = 'X'; let i, j, k;
    const board = gameBoard; // Use current gameBoard
    // Check for win
    for (i = 0; i < 9; i++) if (board[i] === '') { let b = [...board]; b[i] = o; if (checkWinner(b, o)) return i; }
    // Check for block
    for (i = 0; i < 9; i++) if (board[i] === '') { let b = [...board]; b[i] = x; if (checkWinner(b, x)) return i; }
    // Center
    if (board[4] === '') return 4;
    // Opposite Corner (if player took a corner)
    const corners = [0, 2, 6, 8]; const oppCorners = [8, 6, 2, 0];
    for (k=0; k<corners.length; k++) if(board[corners[k]]===x && board[oppCorners[k]]==='') return oppCorners[k];
    // Empty Corner
    const emptyCorners = corners.filter(idx => board[idx] === '');
    if (emptyCorners.length > 0) return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
    // Empty Side
    const sides = [1, 3, 5, 7].filter(idx => board[idx] === '');
    if (sides.length > 0) return sides[Math.floor(Math.random() * sides.length)];
    // Random available
    const available = []; for(i=0;i<9;i++) if(board[i]==='') available.push(i);
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : -1;
}

function handleCellClick(event) {
    console.log('[Client-TTT] handleCellClick'); 
    if (!gameActive || !isMyTurn) {
        console.log('[Client-TTT] handleCellClick: 點擊無效 - 遊戲未激活或非玩家回合', {gameActive, isMyTurn});
        return;
    }
    const targetCell = event.target.closest('.game-cell'); 
    if (!targetCell) return;
    const index = Number(targetCell.dataset.index);
    if (isNaN(index) || gameBoard[index] !== '') {
        console.log('[Client-TTT] handleCellClick: 點擊無效 - 索引無效或格子已占用', {index, cellContent: gameBoard[index]});
        return;
    }
    console.log(`[Client-TTT] Player (${playerSymbol}) clicked cell ${index}`);
    if (gameMode === 'multiplayer') { 
        socket.emit('makeMove', { roomId: currentRoom, index }); 
        isMyTurn = false; 
        updateGameStatus(); 
    } else if (gameMode === 'ai') { 
        makeMoveAI(index, playerSymbol); 
        if (gameActive) { 
            isMyTurn = false; 
            updateGameStatus(); 
            aiMove(); 
        } 
    }
}

function makeMoveAI(index, symbol) {
    console.log(`[Client-TTT] makeMoveAI: ${symbol} to ${index}`); 
    if (!gameActive || gameBoard[index] !== '') {
        console.warn(`[Client-TTT] makeMoveAI: 落子無效 - 遊戲未激活 (${gameActive}) 或格子已占用`);
        return;
    }
    gameBoard[index] = symbol; 
    if(cells[index]){cells[index].textContent=symbol;cells[index].classList.add('occupied',symbol==='X'?'player-x':'player-o');}
    
    clientMovesOrder[symbol].push(index); 
    clientMovesCount[symbol]++; 
    let rmInfo=null;

    if(clientMovesCount[symbol]===4||clientMovesCount[symbol]===5){
        if(checkWinner(gameBoard,symbol)){ // 先检查是否获胜
            logMove(symbol===playerSymbol?playerName:opponentName,symbol,index,null);
            endGameOnScreen(`${symbol===playerSymbol?playerName:opponentName} (${symbol}) 獲勝！`);
            return;
        }
        if(clientMovesOrder[symbol].length > 0){ // 确保有棋子可移除
            const fmIdx=clientMovesOrder[symbol].shift();
            if(gameBoard[fmIdx]===symbol){
                gameBoard[fmIdx]='';
                if(cells[fmIdx]){cells[fmIdx].textContent='';cells[fmIdx].classList.remove('occupied','player-x','player-o');}
                rmInfo=fmIdx;
                console.log(`[Client-TTT] AI模式: ${symbol} 移除了棋子在 ${fmIdx}`);
            }else{
                if(fmIdx!==undefined && (clientMovesOrder[symbol].length === 0 || clientMovesOrder[symbol][0] !== fmIdx)) {
                    clientMovesOrder[symbol].unshift(fmIdx);
                }
                console.warn(`[Client-TTT] AI模式: 嘗試移除 ${fmIdx}, 但該位置非 ${symbol} 的棋子或已空。`);
            }
        }
    }
    logMove(symbol===playerSymbol?playerName:opponentName,symbol,index,rmInfo);
    if(checkWinner(gameBoard,symbol)){ // 移除后再检查
        endGameOnScreen(`${symbol===playerSymbol?playerName:opponentName} (${symbol}) 獲勝！`);return;
    }
    if(checkDraw()){
        endGameOnScreen('遊戲平局！');return;
    }
    if(symbol==='O'&&gameMode==='ai'&&gameActive){isMyTurn=true;updateGameStatus();}
}

function logMove(pName, pSymbol, position, removedPosition = null) {
    const movesLog = document.getElementById('movesLog');
    if (!movesLog) return;
    const moveText = document.createElement('div');
    moveText.classList.add('text-xs', 'p-1', 'rounded', 'mb-1', 'break-words');
    let actionText = `${pName || '玩家'} (${pSymbol}) 落子於 ${position + 1}`;
    if (removedPosition !== null && typeof removedPosition === 'number') {
        actionText += `，並移除其在 ${removedPosition + 1} 的棋子`;
        moveText.classList.add('bg-yellow-100', 'text-yellow-700');
    } else {
        moveText.classList.add(pSymbol === 'X' ? 'bg-blue-50' : 'bg-red-50');
    }
    moveText.textContent = actionText;
    movesLog.appendChild(moveText);
    movesLog.scrollTop = movesLog.scrollHeight;
}

function checkWinner(boardToCheck, symbolToCheck) {
    const winConditions = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return winConditions.some(condition => condition.every(idx => boardToCheck[idx] === symbolToCheck));
}

function checkDraw() {
    return gameBoard.every(cell => cell !== '' && cell !== null);
}

function endGameOnScreen(message, iconText = '🤔') {
    console.log("[Client-TTT] endGameOnScreen:", message, "当前 gameActive:", gameActive);
    gameActive = false; // **这是最重要的一步，确保游戏逻辑停止**
    
    const elResultHdr = document.getElementById('gameScreenResultHeader');
    const elPlayAgainBtn = document.getElementById('playAgainButtonGameScreen');
    const elBackToStartBtn = document.getElementById('backToStartButtonGameScreen');

    if (elResultHdr) {
        elResultHdr.innerHTML = ''; // 清空之前的 "同意/拒绝" 按钮或状态
        const p = document.createElement('p'); 
        p.textContent = `${iconText} ${message}`; 
        elResultHdr.appendChild(p);
        
        elResultHdr.className = 'text-xl sm:text-2xl font-bold text-center my-4'; // Reset class
        elResultHdr.classList.remove('hidden', 'bg-yellow-100', 'border-yellow-300', 'p-3', 'rounded-md');
        if (message.includes('獲勝')) {
            elResultHdr.classList.add(message.includes(playerName) ? 'text-green-600' : 'text-red-600');
        } else if (message.includes('平局')) {
            elResultHdr.classList.add('text-yellow-600');
        } else {
            elResultHdr.classList.add('text-gray-600');
        }
    }

    if (elPlayAgainBtn) { 
        elPlayAgainBtn.classList.remove('hidden'); 
        elPlayAgainBtn.disabled = false; 
        elPlayAgainBtn.textContent = (gameMode === 'ai') ? "再玩一局 (AI)" : "請求再來一局"; 
    }
    if (elBackToStartBtn) {
        elBackToStartBtn.classList.remove('hidden');
    }

    updateGameStatus(); // This will now show "遊戲已結束" because gameActive is false
    cells.forEach(cell => {
        cell.style.cursor = 'not-allowed'; // Make cells unclickable visually
    });
    console.log("[Client-TTT] endGameOnScreen 完成");
}

function updateGameStatus() {
    const statusElement = document.getElementById('gameStatus');
    if (!statusElement) return;

    statusElement.classList.remove(
        'bg-green-100', 'text-green-700', 'border-green-300',
        'bg-red-100', 'text-red-700', 'border-red-300',
        'bg-gray-200', 'text-gray-600', 'bg-blue-50'
    );
    statusElement.className = 'text-center mb-3 sm:mb-4 font-semibold text-sm sm:text-lg p-2 sm:p-3 rounded-md shadow-sm transition-colors duration-300'; 

    if (!gameActive) {
        statusElement.textContent = "遊戲已結束"; // Or hide it, since gameScreenResultHeader shows result
        statusElement.classList.add('bg-gray-200', 'text-gray-600', 'hidden'); // 游戏结束后隐藏状态栏
        return;
    }
    statusElement.classList.remove('hidden'); // 确保游戏进行时可见

    let turnText = '';
    if (isMyTurn) {
        turnText = `輪到你 (${playerSymbol}) 行動`;
        statusElement.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-300');
    } else {
        const opponentDisplaySymbol = playerSymbol === 'X' ? 'O' : 'X';
        turnText = `等待 ${opponentName || '對手'} (${opponentDisplaySymbol}) 行動...`;
        statusElement.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
    }
    statusElement.textContent = turnText;
}

// --- "再来一局" 相关客户端逻辑 ---
function requestPlayAgain() {
    console.log(`[Client-TTT] requestPlayAgain: mode=${gameMode}, room=${currentRoom}`);
    if(gameMode==='multiplayer' && currentRoom){
        socket.emit('requestPlayAgain',{roomId:currentRoom});
        if(playAgainButtonGameScreen) playAgainButtonGameScreen.disabled=true;
        if(gameScreenResultHeader) gameScreenResultHeader.innerHTML='<p class="text-gray-600 text-sm">已发送再来一局请求，等待对方回应...</p>';
    }
    else if(gameMode==='ai'){startAIGame();}
    else{backToStart();}
}
function acceptPlayAgain() {
    console.log(`[Client-TTT] acceptPlayAgain: room=${currentRoom}`);
    if(gameMode==='multiplayer' && currentRoom){
        socket.emit('acceptPlayAgain',{roomId:currentRoom});
        if(gameScreenResultHeader && !gameActive){ // 游戏已结束时
            gameScreenResultHeader.innerHTML='<p class="text-gray-600 text-sm">已同意，等待游戏开始...</p>';
        }
    }
}
function rejectPlayAgain() {
    console.log(`[Client-TTT] rejectPlayAgain: room=${currentRoom}`);
    if(gameMode==='multiplayer' && currentRoom){
        socket.emit('rejectPlayAgain',{roomId:currentRoom});
        if(gameScreenResultHeader && !gameActive){
            gameScreenResultHeader.innerHTML='<p class="text-orange-600 text-sm">你已拒绝再来一局。</p>';
        }
        if(playAgainButtonGameScreen){playAgainButtonGameScreen.classList.remove('hidden');playAgainButtonGameScreen.disabled=false;playAgainButtonGameScreen.textContent=(gameMode==='ai')?"再玩一局(AI)":"請求再來一局";}
        if(backToStartButtonGameScreen)backToStartButtonGameScreen.classList.remove('hidden');
    }
}
socket.on('playAgainRequested', ({ message }) => {
    console.log(`[Client-TTT] playAgainRequested: ${message}`);
    if(gameScreenResultHeader && !gameActive){
        gameScreenResultHeader.innerHTML='';const p=document.createElement('p');p.textContent=message;p.classList.add('text-sm','text-gray-600');gameScreenResultHeader.appendChild(p);
        // gameScreenResultHeader.className='text-xl sm:text-2xl font-bold text-center my-4 text-gray-600';
    }
    if(playAgainButtonGameScreen)playAgainButtonGameScreen.disabled=true;
});
socket.on('opponentRequestedPlayAgain', ({ requesterName }) => {
    console.log(`[Client-TTT] opponentRequestedPlayAgain: from ${requesterName}`);
    if(gameScreenResultHeader && !gameActive){ // 确保在游戏结束状态下才显示这个
        gameScreenResultHeader.innerHTML=''; // 清空之前的胜负结果
        const p=document.createElement('p');p.textContent=`玩家 ${requesterName} 请求再来一局。你是否同意？`;p.classList.add('mb-2', 'text-sm');
        const accBtn=document.createElement('button');accBtn.textContent='同意';accBtn.className='bg-green-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded hover:bg-green-600 mr-2 transition text-xs sm:text-sm';
        accBtn.addEventListener('click', acceptPlayAgain); // 使用 addEventListener
        const rejBtn=document.createElement('button');rejBtn.textContent='拒绝';rejBtn.className='bg-red-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded hover:bg-red-600 transition text-xs sm:text-sm';
        rejBtn.addEventListener('click', rejectPlayAgain); // 使用 addEventListener
        gameScreenResultHeader.appendChild(p);gameScreenResultHeader.appendChild(accBtn);gameScreenResultHeader.appendChild(rejBtn);
        gameScreenResultHeader.className='text-center my-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md'; // 保持这个样式
        gameScreenResultHeader.classList.remove('hidden');
    }
    if(playAgainButtonGameScreen)playAgainButtonGameScreen.classList.add('hidden'); // 隐藏自己的请求按钮
    if(backToStartButtonGameScreen)backToStartButtonGameScreen.classList.add('hidden'); // 也隐藏返回主页按钮
});
socket.on('playAgainRejected', ({ rejecterName }) => {
    console.log(`[Client-TTT] playAgainRejected by ${rejecterName}`);
    if(gameScreenResultHeader && !gameActive){
        gameScreenResultHeader.innerHTML='';const p=document.createElement('p');p.textContent=`玩家 ${rejecterName} 拒绝了再来一局的请求。`;p.classList.add('text-sm');gameScreenResultHeader.appendChild(p);
        gameScreenResultHeader.className='text-xl sm:text-2xl font-bold text-center my-4 text-orange-600';
    }
    if(playAgainButtonGameScreen){playAgainButtonGameScreen.disabled=false;playAgainButtonGameScreen.classList.remove('hidden');}
    if(backToStartButtonGameScreen)backToStartButtonGameScreen.classList.remove('hidden');
});
socket.on('playAgainCancelled', ({ reason }) => {
    console.log(`[Client-TTT] playAgainCancelled: ${reason}`);
    if(gameScreenResultHeader && !gameActive){
        gameScreenResultHeader.innerHTML='';const p=document.createElement('p');p.textContent=`再来一局已取消 (${reason})。`;p.classList.add('text-sm'); gameScreenResultHeader.appendChild(p);
        gameScreenResultHeader.className='text-xl sm:text-2xl font-bold text-center my-4 text-gray-600';
    }
    if(playAgainButtonGameScreen){playAgainButtonGameScreen.disabled=false;playAgainButtonGameScreen.classList.remove('hidden');}
    if(backToStartButtonGameScreen)backToStartButtonGameScreen.classList.remove('hidden');
});

socket.on('restartGame', ({ players, board, currentTurn, roomName: serverRoomName }) => {
    console.log(`[Client-TTT] restartGame:`, { players, board, currentTurn, serverRoomName });
    resetUIStateForNewGame(); 
    gameBoard = Array.from(board); 
    gameActive = true;
    const me = players.find(p=>p.id===socket.id); 
    const opp = players.find(p=>p.id!==socket.id);
    if(me){playerName=me.name;playerSymbol=me.symbol;}else{backToStart();return;}
    opponentName=opp?opp.name:'對手';
    const elGameRoomId = document.getElementById('gameRoomId'); if(elGameRoomId)elGameRoomId.textContent=`${serverRoomName||"遊戲房"} (${currentRoom})`;
    const elPX=document.getElementById('playerXName');const elPO=document.getElementById('playerOName');
    const pXInfo=players.find(p=>p.symbol==='X');const pOInfo=players.find(p=>p.symbol==='O');
    if(elPX)elPX.textContent=pXInfo?`${pXInfo.name} (X)`:'玩家X';if(elPO)elPO.textContent=pOInfo?`${pOInfo.name} (O)`:'玩家O';
    isMyTurn = currentTurn === playerSymbol;
    clientMovesCount = {X:0,O:0}; clientMovesOrder = {X:[],O:[]};
    startGameUIUpdates();
});

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Client-TTT] 頁面載入完成 (DOMContentLoaded)');
    initializeDynamicElements();
    showScreen('startScreen');
    
    const shareButton = document.getElementById('shareButton');
    if (shareButton) {
        shareButton.addEventListener('click', function() {
            console.log('[Client-TTT] shareButton clicked');
            const roomIdToShare = document.getElementById('roomIdDisplay').value;
            if (!roomIdToShare) { alert('沒有房間號可分享'); return; }
            let shareText = `來玩特殊規則井字遊戲吧！我的房間號是: ${roomIdToShare}`;
            if (navigator.share) {
                navigator.share({ title: '特殊規則井字遊戲邀請', text: shareText, url: window.location.origin + '/tic-tac-toe' })
                .then(() => console.log('[Client-TTT] 內容分享成功'))
                .catch((error) => { 
                    console.error('[Client-TTT] 分享失敗:', error);
                    if (error.name !== 'AbortError') alert('分享功能調用失敗');
                });
            } else { copyRoomId(); }
        });
    }
});
