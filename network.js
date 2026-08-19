class NetworkGame {
    constructor() {
        this.peer = new Peer(); // 自動產生隨機 ID
        this.conn = null;
        this.myColor = null;
        
        // 綁定 UI
        this.myIdDisplay = document.getElementById('my-peer-id');
        this.friendIdInput = document.getElementById('friend-id-input');
        this.joinBtn = document.getElementById('join-btn');
        this.copyBtn = document.getElementById('copy-btn');
        this.statusDisplay = document.getElementById('connection-status');
        this.turnIndicator = document.getElementById('turn-indicator');
        
        this.networkPanel = document.getElementById('network-panel');
        this.gamePanel = document.getElementById('game-panel');
        
        this.passBtn = document.getElementById('pass-btn');
        this.resignBtn = document.getElementById('resign-btn');
        
        this.setupPeerEvents();
        this.setupUIEvents();
        
        // 綁定到 window.game
        window.game.onMovePlaced = this.sendMove.bind(this);
    }
    
    setupPeerEvents() {
        this.peer.on('open', (id) => {
            this.myIdDisplay.textContent = id;
            console.log('My peer ID is: ' + id);
        });
        
        // 房主被動等待連線
        this.peer.on('connection', (connection) => {
            if (this.conn) {
                connection.close(); // 已有連線則拒絕
                return;
            }
            this.conn = connection;
            this.myColor = BLACK; // 房主當黑棋
            this.setupConnectionEvents();
        });
    }
    
    setupUIEvents() {
        this.joinBtn.addEventListener('click', () => {
            const friendId = this.friendIdInput.value.trim();
            if (!friendId) {
                this.showModal('錯誤', '請輸入朋友的邀請碼！');
                return;
            }
            this.joinBtn.disabled = true;
            this.joinBtn.textContent = '連線中...';
            
            // 主動發起連線
            this.conn = this.peer.connect(friendId);
            this.myColor = WHITE; // 加入者當白棋
            this.setupConnectionEvents();
        });
        
        this.copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.myIdDisplay.textContent)
                .then(() => alert('已複製邀請碼！'))
                .catch(err => console.error('複製失敗', err));
        });
        
        this.passBtn.addEventListener('click', () => {
            if (this.isMyTurn()) {
                window.game.pass();
            }
        });
        
        this.resignBtn.addEventListener('click', () => {
            if (confirm('確定要認輸嗎？')) {
                this.sendResign();
                this.showModal('遊戲結束', '您已認輸！');
            }
        });
        
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });
    }
    
    setupConnectionEvents() {
        this.conn.on('open', () => {
            this.statusDisplay.textContent = '🟢 連線成功';
            this.statusDisplay.style.color = '#4CAF50';
            
            // 切換畫面
            this.networkPanel.classList.add('hidden');
            this.gamePanel.classList.remove('hidden');
            window.game.resizeCanvas();
            this.updateTurnUI();
        });
        
        this.conn.on('data', (data) => {
            this.handleData(data);
        });
        
        this.conn.on('close', () => {
            this.statusDisplay.textContent = '🔴 連線已斷開';
            this.statusDisplay.style.color = '#e74c3c';
            this.showModal('斷線', '對方已離開遊戲。');
        });
        
        this.conn.on('error', (err) => {
            console.error('連線錯誤', err);
            this.joinBtn.disabled = false;
            this.joinBtn.textContent = '加入遊戲';
            this.showModal('錯誤', '連線失敗，請檢查邀請碼。');
        });
    }
    
    handleData(data) {
        if (data.type === 'move') {
            if (data.row === -1 && data.col === -1) {
                // 對手 pass
                window.game.currentPlayer = window.game.currentPlayer === BLACK ? WHITE : BLACK;
                window.game.koPoint = null;
                window.game.updateUI();
            } else {
                // 對手落子
                window.game.playMove(data.row, data.col, false);
            }
        } else if (data.type === 'resign') {
            this.showModal('遊戲結束', '對方已認輸，你贏了！🎉');
        }
    }
    
    sendMove(row, col) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'move', row, col });
        }
    }
    
    sendResign() {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'resign' });
        }
    }
    
    isMyTurn() {
        return window.game.currentPlayer === this.myColor;
    }
    
    updateTurnUI() {
        if (this.isMyTurn()) {
            this.turnIndicator.textContent = '🟢 換你落子';
            this.turnIndicator.style.color = '#2ecc71';
            this.turnIndicator.style.fontWeight = 'bold';
        } else {
            this.turnIndicator.textContent = '⏳ 等待對方';
            this.turnIndicator.style.color = '#e67e22';
            this.turnIndicator.style.fontWeight = 'normal';
        }
    }
    
    showModal(title, message) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal').classList.remove('hidden');
    }
}

// 建立全域網路遊戲實例
window.networkGame = new NetworkGame();
