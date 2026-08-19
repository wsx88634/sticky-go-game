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
        this.localBtn = document.getElementById('local-btn');
        this.aiBtn = document.getElementById('ai-btn');
        this.aiDiffPanel = document.getElementById('ai-difficulty-panel');
        this.statusDisplay = document.getElementById('connection-status');
        this.turnIndicator = document.getElementById('turn-indicator');
        
        this.networkPanel = document.getElementById('network-panel');
        this.gamePanel = document.getElementById('game-panel');
        
        this.isLocalMode = false;
        this.isAIMode = false;
        this.aiEngine = null;
        
        this.resignBtn = document.getElementById('resign-btn');
        this.menuBtn = document.getElementById('menu-btn');
        this.modalMenuBtn = document.getElementById('modal-menu-btn');
        
        this.setupPeerEvents();
        this.setupUIEvents();
        
        // 綁定到 window.game
        window.game.onMovePlaced = this.sendMove.bind(this);
        window.game.onGameOver = this.handleGameOver.bind(this);
        
        // 檢查網址是否有 join 參數
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('join');
        if (joinId) {
            this.friendIdInput.value = joinId;
            setTimeout(() => this.joinBtn.click(), 500);
        }
    }
    
    setupPeerEvents() {
        this.peer.on('open', (id) => {
            this.myIdDisplay.textContent = id;
            
            // 產生含有 peerId 的分享網址
            const joinUrl = window.location.href.split('?')[0] + '?join=' + id;
            
            // 繪製 QR Code
            new QRious({
                element: document.getElementById('qr-code'),
                value: joinUrl,
                size: 150
            });
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
                this.showModal('錯誤', '請輸入邀請碼！');
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
        
        this.resignBtn.addEventListener('click', () => {
            if (confirm('確定要認輸嗎？')) {
                this.sendResign();
                this.handleGameOver(this.myColor === BLACK ? WHITE : BLACK, true);
            }
        });
        
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });

        const goBackToMenu = () => {
            document.getElementById('modal').classList.add('hidden');
            this.networkPanel.classList.remove('hidden');
            this.gamePanel.classList.add('hidden');
            this.menuBtn.style.display = 'none';
            this.resignBtn.style.display = 'inline-block';
            
            // 清理網址與狀態
            window.history.pushState({}, document.title, window.location.pathname);
            if (this.conn) {
                this.conn.close();
                this.conn = null;
            }
            this.joinBtn.disabled = false;
            this.joinBtn.textContent = '加入遊戲';
            this.isLocalMode = false;
            this.isAIMode = false;
            this.aiEngine = null;
            this.statusDisplay.textContent = '🔴 尚未連線';
            this.statusDisplay.style.color = 'inherit';
            this.turnIndicator.textContent = '等待開始...';
            window.game.reset();
        };

        this.menuBtn.addEventListener('click', goBackToMenu);
        this.modalMenuBtn.addEventListener('click', goBackToMenu);

        this.localBtn.addEventListener('click', () => {
            this.isLocalMode = true;
            this.statusDisplay.textContent = '🏠 單機雙人模式';
            this.statusDisplay.style.color = '#3498db';
            
            this.networkPanel.classList.add('hidden');
            this.gamePanel.classList.remove('hidden');
            
            document.querySelector('#player-black span').textContent = '黑方';
            document.querySelector('#player-white span').textContent = '白方';
            
            window.game.reset();
        });

        this.aiBtn.addEventListener('click', () => {
            this.aiDiffPanel.classList.toggle('hidden');
        });

        document.querySelectorAll('.ai-diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const diff = e.target.dataset.level;
                this.isAIMode = true;
                this.aiEngine = new StickyGoAI(diff);
                this.myColor = BLACK; // 玩家為黑
                
                let diffText = diff === 'easy' ? '簡單' : diff === 'medium' ? '中等' : '困難';
                this.statusDisplay.textContent = `🤖 AI 對戰 (${diffText})`;
                this.statusDisplay.style.color = '#8e44ad';
                
                this.networkPanel.classList.add('hidden');
                this.gamePanel.classList.remove('hidden');
                
                document.querySelector('#player-black span').textContent = '黑方 (你)';
                document.querySelector('#player-white span').textContent = '白方 (電腦)';
                
                window.game.reset();
            });
        });
    }
    
    setupConnectionEvents() {
        this.conn.on('open', () => {
            this.statusDisplay.textContent = '🟢 連線成功';
            this.statusDisplay.style.color = '#4CAF50';
            
            // 切換畫面
            this.networkPanel.classList.add('hidden');
            this.gamePanel.classList.remove('hidden');
            window.game.reset();
        });
        
        this.conn.on('data', (data) => {
            this.handleData(data);
        });
        
        this.conn.on('close', () => {
            if (!window.game.gameOver) {
                this.statusDisplay.textContent = '🔴 連線已斷開';
                this.statusDisplay.style.color = '#e74c3c';
                this.showModal('斷線', '對方已離開遊戲。');
            }
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
            window.game.playMove(data.row, data.col, false);
        } else if (data.type === 'resign') {
            this.handleGameOver(this.myColor, true);
        }
    }
    
    sendMove(row, col) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'move', row, col });
        }
        
        if (this.isAIMode && window.game.currentPlayer === WHITE && !window.game.gameOver) {
            this.aiEngine.makeMove(window.game);
        }
    }
    
    sendResign() {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'resign' });
        }
    }
    
    isMyTurn() {
        if (this.isLocalMode) return true;
        return window.game.currentPlayer === this.myColor;
    }
    
    updateTurnUI() {
        if (window.game.gameOver) {
            this.turnIndicator.textContent = '🏁 遊戲結束';
            this.turnIndicator.style.color = '#333';
            return;
        }

        if (this.isLocalMode) {
            const colorName = window.game.currentPlayer === BLACK ? '黑子' : '白子';
            this.turnIndicator.textContent = `🎲 輪到 ${colorName}`;
            this.turnIndicator.style.color = '#3498db';
            this.turnIndicator.style.fontWeight = 'bold';
        } else if (this.isAIMode) {
            if (this.isMyTurn()) {
                this.turnIndicator.textContent = '🟢 換你落子';
                this.turnIndicator.style.color = '#2ecc71';
                this.turnIndicator.style.fontWeight = 'bold';
            } else {
                this.turnIndicator.textContent = '⏳ 電腦思考中...';
                this.turnIndicator.style.color = '#e67e22';
                this.turnIndicator.style.fontWeight = 'normal';
            }
        } else if (this.isMyTurn()) {
            this.turnIndicator.textContent = '🟢 換你落子';
            this.turnIndicator.style.color = '#2ecc71';
            this.turnIndicator.style.fontWeight = 'bold';
        } else {
            this.turnIndicator.textContent = '⏳ 等待對方';
            this.turnIndicator.style.color = '#e67e22';
            this.turnIndicator.style.fontWeight = 'normal';
        }
    }
    
    handleGameOver(winnerColor, byResign = false) {
        if (byResign) {
            const reason = "對方認輸";
            window.game.forceGameOver(winnerColor, reason);
        }
        
        // 觸發彩帶
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
        
        // 顯示回主選單按鈕，隱藏認輸按鈕
        this.resignBtn.style.display = 'none';
        this.menuBtn.style.display = 'inline-block';
        this.updateTurnUI();
    }

    showModal(title, message) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal').classList.remove('hidden');
    }
}

// 建立全域網路遊戲實例
window.networkGame = new NetworkGame();
