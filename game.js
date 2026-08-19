const BOARD_SIZE = 9;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

class StickyGo {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
        this.currentPlayer = BLACK;
        
        // 提子數
        this.captures = { [BLACK]: 0, [WHITE]: 0 };
        
        // 劫爭座標 (ko)
        this.koPoint = null; 
        
        // UI 狀態
        this.lastMove = null;
        
        // 綁定事件
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        // 回調函數 (供 network.js 綁定)
        this.onMovePlaced = null; 
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
        // 如果還沒輪到自己（會在 network.js 中覆寫這個檢查，但這邊先做基礎防呆）
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
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
        if (this.board[row][col] !== EMPTY) return false;

        // 檢查劫爭
        if (this.koPoint && this.koPoint.row === row && this.koPoint.col === col) {
            console.log("打劫！");
            return false;
        }

        const color = this.currentPlayer;
        this.board[row][col] = color;

        // 找出敵方相鄰群組，檢查是否提子
        let capturedStones = 0;
        let singleCapturedPoint = null;
        const opponent = color === BLACK ? WHITE : BLACK;
        const neighbors = this.getNeighbors(row, col);
        
        neighbors.forEach(n => {
            if (this.board[n.row][n.col] === opponent) {
                const group = this.getGroup(n.row, n.col);
                if (this.getLiberties(group) === 0) {
                    // 提子
                    group.forEach(stone => {
                        this.board[stone.row][stone.col] = EMPTY;
                        capturedStones++;
                        singleCapturedPoint = stone;
                    });
                }
            }
        });

        // 檢查自殺
        const myGroup = this.getGroup(row, col);
        if (this.getLiberties(myGroup) === 0) {
            // 恢復原狀
            this.board[row][col] = EMPTY;
            console.log("禁止自殺！");
            return false;
        }

        // 更新劫爭狀態
        if (capturedStones === 1 && myGroup.length === 1 && this.getLiberties(myGroup) === 1) {
            this.koPoint = singleCapturedPoint;
        } else {
            this.koPoint = null;
        }

        // 更新狀態
        this.captures[color] += capturedStones;
        this.lastMove = { row, col };
        this.currentPlayer = opponent;
        
        this.draw();
        this.updateUI();

        // 觸發網路傳送
        if (isLocalPlayer && this.onMovePlaced) {
            this.onMovePlaced(row, col);
        }

        return true;
    }

    // 取得相鄰座標
    getNeighbors(row, col) {
        const neighbors = [];
        if (row > 0) neighbors.push({ row: row - 1, col });
        if (row < BOARD_SIZE - 1) neighbors.push({ row: row + 1, col });
        if (col > 0) neighbors.push({ row, col: col - 1 });
        if (col < BOARD_SIZE - 1) neighbors.push({ row, col: col + 1 });
        return neighbors;
    }

    // 取得相連的同色棋子群組 (DFS)
    getGroup(row, col) {
        const color = this.board[row][col];
        if (color === EMPTY) return [];

        const group = [];
        const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
        const stack = [{ row, col }];
        visited[row][col] = true;

        while (stack.length > 0) {
            const current = stack.pop();
            group.push(current);

            this.getNeighbors(current.row, current.col).forEach(n => {
                if (!visited[n.row][n.col] && this.board[n.row][n.col] === color) {
                    visited[n.row][n.col] = true;
                    stack.push(n);
                }
            });
        }
        return group;
    }

    // 計算群組的氣
    getLiberties(group) {
        let liberties = 0;
        const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));

        group.forEach(stone => {
            this.getNeighbors(stone.row, stone.col).forEach(n => {
                if (this.board[n.row][n.col] === EMPTY && !visited[n.row][n.col]) {
                    visited[n.row][n.col] = true;
                    liberties++;
                }
            });
        });
        return liberties;
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

        // 畫星位 (9x9 通常有 5 個或 4 個)
        const stars = [[2,2], [6,6], [2,6], [6,2], [4,4]];
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
        document.getElementById('black-score').textContent = this.captures[BLACK];
        document.getElementById('white-score').textContent = this.captures[WHITE];
        
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

    pass() {
        this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
        this.koPoint = null;
        this.updateUI();
        if (this.onMovePlaced) {
            this.onMovePlaced(-1, -1); // 傳送 pass 訊號
        }
    }
}

// 建立全域實例
window.game = new StickyGo('go-board');
