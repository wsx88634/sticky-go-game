const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

class StickyGo {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // 回調函數 (供 network.js 綁定)
        this.onMovePlaced = null; 
        this.onGameOver = null;

        this.reset();
        
        // 綁定事件 (只綁一次)
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    reset() {
        this.board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.lastMove = null;
        this.resizeCanvas();
        this.updateUI();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, 400);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / (BOARD_SIZE + 1);
        this.draw();
    }

    // 處理點擊
    handleClick(e) {
        if (this.gameOver) return;
        
        // 如果還沒輪到自己
        if (window.networkGame && !window.networkGame.isMyTurn()) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const col = Math.round(x / this.cellSize) - 1;
        const row = Math.round(y / this.cellSize) - 1;

        this.playMove(row, col, true);
    }

    playMove(row, col, isLocalPlayer = false) {
        if (this.gameOver) return false;
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
        if (this.board[row][col] !== EMPTY) return false;

        const color = this.currentPlayer;
        this.board[row][col] = color;
        this.lastMove = { row, col };

        // 觸發網路傳送
        if (isLocalPlayer && this.onMovePlaced) {
            this.onMovePlaced(row, col);
        }

        // 檢查勝利
        if (this.checkWin(row, col, color)) {
            this.gameOver = true;
            this.draw();
            this.updateUI();
            if (this.onGameOver) {
                this.onGameOver(color);
            }
            return true;
        }

        // 更新狀態
        this.currentPlayer = color === BLACK ? WHITE : BLACK;
        
        this.draw();
        this.updateUI();

        return true;
    }

    checkWin(row, col, color) {
        const directions = [
            [1, 0], [0, 1], [1, 1], [1, -1] // 水平, 垂直, 主對角, 副對角
        ];

        for (let dir of directions) {
            let count = 1;
            // 往一個方向找
            for (let i = 1; i < 5; i++) {
                const r = row + dir[0] * i;
                const c = col + dir[1] * i;
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === color) {
                    count++;
                } else {
                    break;
                }
            }
            // 往反方向找
            for (let i = 1; i < 5; i++) {
                const r = row - dir[0] * i;
                const c = col - dir[1] * i;
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === color) {
                    count++;
                } else {
                    break;
                }
            }
            if (count >= 5) return true;
        }
        return false;
    }

    // 繪製畫面
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawStickyStones();
        this.drawLastMove();
    }

    drawGrid() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#5d4a3f";
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < BOARD_SIZE; i++) {
            const pos = (i + 1) * this.cellSize;
            // 垂直線
            this.ctx.moveTo(pos, this.cellSize);
            this.ctx.lineTo(pos, this.canvas.height - this.cellSize);
            // 水平線
            this.ctx.moveTo(this.cellSize, pos);
            this.ctx.lineTo(this.canvas.width - this.cellSize, pos);
        }
        this.ctx.stroke();

        // 畫星位 (15x15 的標準星位與天元)
        const stars = [
            [3, 3], [11, 3], [3, 11], [11, 11], [7, 7]
        ];
        this.ctx.fillStyle = "#5d4a3f";
        stars.forEach(star => {
            this.ctx.beginPath();
            this.ctx.arc((star[1]+1)*this.cellSize, (star[0]+1)*this.cellSize, 3, 0, Math.PI*2);
            this.ctx.fill();
        });
    }

    drawStickyStones() {
        const radius = this.cellSize * 0.45;
        
        // 第一層：畫黏合的橋樑
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board[r][c] === EMPTY) continue;
                
                const color = this.board[r][c] === BLACK ? "#333" : "#fff";
                this.ctx.fillStyle = color;
                
                const cx = (c + 1) * this.cellSize;
                const cy = (r + 1) * this.cellSize;
                
                // 往右看
                if (c < BOARD_SIZE - 1 && this.board[r][c+1] === this.board[r][c]) {
                    this.ctx.fillRect(cx, cy - radius*0.8, this.cellSize, radius*1.6);
                }
                // 往下看
                if (r < BOARD_SIZE - 1 && this.board[r+1][c] === this.board[r][c]) {
                    this.ctx.fillRect(cx - radius*0.8, cy, radius*1.6, this.cellSize);
                }
            }
        }
        
        // 第二層：畫圓形棋子本體
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board[r][c] === EMPTY) continue;
                
                const cx = (c + 1) * this.cellSize;
                const cy = (r + 1) * this.cellSize;
                
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, radius, 0, Math.PI*2);
                this.ctx.fillStyle = this.board[r][c] === BLACK ? "#333" : "#fff";
                this.ctx.fill();
                
                if (this.board[r][c] === WHITE) {
                    this.ctx.strokeStyle = "#ccc";
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawLastMove() {
        if (!this.lastMove) return;
        
        const cx = (this.lastMove.col + 1) * this.cellSize;
        const cy = (this.lastMove.row + 1) * this.cellSize;
        
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, this.cellSize * 0.2, 0, Math.PI*2);
        this.ctx.fillStyle = this.board[this.lastMove.row][this.lastMove.col] === BLACK ? "#fff" : "#333";
        this.ctx.fill();
    }

    updateUI() {
        const pb = document.getElementById('player-black');
        const pw = document.getElementById('player-white');
        
        if (this.currentPlayer === BLACK) {
            pb.classList.add('active');
            pw.classList.remove('active');
        } else {
            pw.classList.add('active');
            pb.classList.remove('active');
        }
        
        if (window.networkGame) {
            window.networkGame.updateTurnUI();
        }
    }
}

// 建立全域實例
window.game = new StickyGo('go-board');
