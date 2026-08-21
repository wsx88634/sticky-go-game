const XQ_ROWS = 10;
const XQ_COLS = 9;
const XQ_RED = 1; // 預設紅方先走
const XQ_BLACK = 2;

const XQ_NAMES = {
    1: { [XQ_RED]: '帥', [XQ_BLACK]: '將' },
    2: { [XQ_RED]: '仕', [XQ_BLACK]: '士' },
    3: { [XQ_RED]: '相', [XQ_BLACK]: '象' },
    4: { [XQ_RED]: '傌', [XQ_BLACK]: '馬' },
    5: { [XQ_RED]: '俥', [XQ_BLACK]: '車' },
    6: { [XQ_RED]: '炮', [XQ_BLACK]: '砲' },
    7: { [XQ_RED]: '兵', [XQ_BLACK]: '卒' }
};

class XiangqiGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.onMovePlaced = null; 
        this.onGameOver = null;

        this.reset();
        
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    reset() {
        // board[row][col] = { type, color } or null
        this.board = Array(XQ_ROWS).fill(null).map(() => Array(XQ_COLS).fill(null));
        this.initBoard();
        
        this.currentPlayer = XQ_RED;
        this.gameOver = false;
        this.winnerColor = null;
        this.selectedPos = null;
        this.lastMove = null;
        
        this.resizeCanvas();
        this.updateUI();
    }

    initBoard() {
        const setupRow = (row, color) => {
            this.board[row][0] = { type: 5, color };
            this.board[row][1] = { type: 4, color };
            this.board[row][2] = { type: 3, color };
            this.board[row][3] = { type: 2, color };
            this.board[row][4] = { type: 1, color };
            this.board[row][5] = { type: 2, color };
            this.board[row][6] = { type: 3, color };
            this.board[row][7] = { type: 4, color };
            this.board[row][8] = { type: 5, color };
        };
        // 黑方
        setupRow(0, XQ_BLACK);
        this.board[2][1] = { type: 6, color: XQ_BLACK };
        this.board[2][7] = { type: 6, color: XQ_BLACK };
        for (let i = 0; i < 9; i += 2) this.board[3][i] = { type: 7, color: XQ_BLACK };
        
        // 紅方
        setupRow(9, XQ_RED);
        this.board[7][1] = { type: 6, color: XQ_RED };
        this.board[7][7] = { type: 6, color: XQ_RED };
        for (let i = 0; i < 9; i += 2) this.board[6][i] = { type: 7, color: XQ_RED };
    }

    forceGameOver(winnerColor, reason = "") {
        this.gameOver = true;
        this.winnerColor = winnerColor;
        this.gameOverReason = reason;
        this.draw();
        this.updateUI();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        // 象棋比例是 9:10
        const w = Math.min(container.clientWidth, 400);
        const h = w * (10 / 9);
        this.canvas.width = w;
        this.canvas.height = h;
        this.cellSize = w / XQ_COLS;
        this.draw();
    }

    handleClick(e) {
        if (this.gameOver) return;
        
        if (window.networkGame && !window.networkGame.isMyTurn()) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        if (col < 0 || col >= XQ_COLS || row < 0 || row >= XQ_ROWS) return;

        const piece = this.board[row][col];

        // 選擇棋子
        if (this.selectedPos) {
            // 如果點到自己的棋子，換選
            if (piece && piece.color === this.currentPlayer) {
                this.selectedPos = { row, col };
                this.draw();
            } else {
                // 嘗試移動
                this.playMove(this.selectedPos.row, this.selectedPos.col, row, col, true);
            }
        } else {
            // 還沒選，只能選自己的
            if (piece && piece.color === this.currentPlayer) {
                this.selectedPos = { row, col };
                this.draw();
            }
        }
    }

    playMove(r1, c1, r2, c2, isLocalPlayer = false) {
        if (this.gameOver) return false;
        
        const piece = this.board[r1][c1];
        if (!piece || piece.color !== this.currentPlayer) return false;

        if (!this.isValidMove(r1, c1, r2, c2)) return false;

        // 檢查是否吃將/帥
        let isWin = false;
        const targetPiece = this.board[r2][c2];
        if (targetPiece && targetPiece.type === 1) {
            isWin = true;
        }

        // 執行移動
        this.board[r2][c2] = piece;
        this.board[r1][c1] = null;
        
        // 飛將檢查 (如果兩將面對面中間無子，則剛才移動的人違規或剛好吃掉對方。為簡化，此處僅實作基礎吃將獲勝)

        this.selectedPos = null;
        this.lastMove = { from: {r:r1, c:c1}, to: {r:r2, c:c2} };

        if (isWin) {
            this.gameOver = true;
            this.winnerColor = this.currentPlayer;
        } else {
            this.currentPlayer = this.currentPlayer === XQ_RED ? XQ_BLACK : XQ_RED;
        }

        this.draw();
        this.updateUI();

        if (isLocalPlayer && this.onMovePlaced) {
            // 象棋用長度為 4 的陣列傳遞坐標
            this.onMovePlaced(r1, c1, r2, c2);
        }

        if (isWin && this.onGameOver) {
            this.onGameOver(this.winnerColor);
        }

        return true;
    }

    isValidMove(r1, c1, r2, c2) {
        const p = this.board[r1][c1];
        const target = this.board[r2][c2];
        if (target && target.color === p.color) return false; // 不能吃自己人

        const dr = r2 - r1;
        const dc = c2 - c1;
        const adr = Math.abs(dr);
        const adc = Math.abs(dc);

        // 各兵種走法
        switch(p.type) {
            case 1: // 將/帥 (九宮格、一步)
                if (adr + adc !== 1) return false;
                if (c2 < 3 || c2 > 5) return false;
                if (p.color === XQ_RED && r2 < 7) return false;
                if (p.color === XQ_BLACK && r2 > 2) return false;
                return true;
            case 2: // 士/仕 (斜走一步、九宮格)
                if (adr !== 1 || adc !== 1) return false;
                if (c2 < 3 || c2 > 5) return false;
                if (p.color === XQ_RED && r2 < 7) return false;
                if (p.color === XQ_BLACK && r2 > 2) return false;
                return true;
            case 3: // 象/相 (田字、不過河、塞象眼)
                if (adr !== 2 || adc !== 2) return false;
                if (p.color === XQ_RED && r2 < 5) return false;
                if (p.color === XQ_BLACK && r2 > 4) return false;
                if (this.board[r1 + dr/2][c1 + dc/2]) return false; // 塞象眼
                return true;
            case 4: // 馬 (日字、卡馬腳)
                if ((adr === 2 && adc === 1) || (adr === 1 && adc === 2)) {
                    if (adr === 2 && this.board[r1 + dr/2][c1]) return false;
                    if (adc === 2 && this.board[r1][c1 + dc/2]) return false;
                    return true;
                }
                return false;
            case 5: // 車 (直線無阻礙)
                if (r1 !== r2 && c1 !== c2) return false;
                return this.countObstacles(r1, c1, r2, c2) === 0;
            case 6: // 炮 (吃子隔一，不吃無阻礙)
                if (r1 !== r2 && c1 !== c2) return false;
                const obs = this.countObstacles(r1, c1, r2, c2);
                if (target) return obs === 1;
                else return obs === 0;
            case 7: // 兵/卒 (過河前只能前，過河可平)
                if (p.color === XQ_RED) {
                    if (r1 > 4) { // 未過河
                        if (dr !== -1 || dc !== 0) return false;
                    } else { // 已過河
                        if (dr > 0) return false;
                        if (adr + adc !== 1) return false;
                    }
                } else {
                    if (r1 < 5) { // 未過河
                        if (dr !== 1 || dc !== 0) return false;
                    } else { // 已過河
                        if (dr < 0) return false;
                        if (adr + adc !== 1) return false;
                    }
                }
                return true;
        }
        return false;
    }

    countObstacles(r1, c1, r2, c2) {
        let count = 0;
        if (r1 === r2) {
            const min = Math.min(c1, c2);
            const max = Math.max(c1, c2);
            for (let c = min + 1; c < max; c++) if (this.board[r1][c]) count++;
        } else {
            const min = Math.min(r1, r2);
            const max = Math.max(r1, r2);
            for (let r = min + 1; r < max; r++) if (this.board[r][c1]) count++;
        }
        return count;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#e8c687";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawPieces();
        
        if (this.selectedPos) {
            this.ctx.strokeStyle = "#2ecc71";
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
                this.selectedPos.col * this.cellSize + 2, 
                this.selectedPos.row * this.cellSize + 2, 
                this.cellSize - 4, 
                this.cellSize - 4
            );
        }
        
        if (this.gameOver && this.winnerColor) {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = "white";
            this.ctx.font = "bold 32px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            const colorName = this.winnerColor === XQ_RED ? "紅方" : "黑方";
            this.ctx.fillText(`${colorName}獲勝！`, this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawGrid() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#5d4a3f";
        this.ctx.lineWidth = 1;
        
        const pad = this.cellSize / 2;
        
        // 橫線
        for (let r = 0; r < XQ_ROWS; r++) {
            this.ctx.moveTo(pad, r * this.cellSize + pad);
            this.ctx.lineTo(this.canvas.width - pad, r * this.cellSize + pad);
        }
        
        // 直線
        for (let c = 0; c < XQ_COLS; c++) {
            // 上半部
            this.ctx.moveTo(c * this.cellSize + pad, pad);
            this.ctx.lineTo(c * this.cellSize + pad, 4 * this.cellSize + pad);
            // 下半部
            this.ctx.moveTo(c * this.cellSize + pad, 5 * this.cellSize + pad);
            this.ctx.lineTo(c * this.cellSize + pad, 9 * this.cellSize + pad);
        }
        // 外框左右線連通
        this.ctx.moveTo(pad, 4 * this.cellSize + pad);
        this.ctx.lineTo(pad, 5 * this.cellSize + pad);
        this.ctx.moveTo(this.canvas.width - pad, 4 * this.cellSize + pad);
        this.ctx.lineTo(this.canvas.width - pad, 5 * this.cellSize + pad);

        // 九宮格斜線
        this.ctx.moveTo(3 * this.cellSize + pad, 0 * this.cellSize + pad);
        this.ctx.lineTo(5 * this.cellSize + pad, 2 * this.cellSize + pad);
        this.ctx.moveTo(5 * this.cellSize + pad, 0 * this.cellSize + pad);
        this.ctx.lineTo(3 * this.cellSize + pad, 2 * this.cellSize + pad);

        this.ctx.moveTo(3 * this.cellSize + pad, 7 * this.cellSize + pad);
        this.ctx.lineTo(5 * this.cellSize + pad, 9 * this.cellSize + pad);
        this.ctx.moveTo(5 * this.cellSize + pad, 7 * this.cellSize + pad);
        this.ctx.lineTo(3 * this.cellSize + pad, 9 * this.cellSize + pad);

        this.ctx.stroke();

        // 楚河漢界
        this.ctx.fillStyle = "#5d4a3f";
        this.ctx.font = "bold 24px '標楷體', serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("楚 河", 2.5 * this.cellSize + pad, 4.5 * this.cellSize + pad);
        this.ctx.fillText("漢 界", 6.5 * this.cellSize + pad, 4.5 * this.cellSize + pad);
    }

    drawPieces() {
        const pad = this.cellSize / 2;
        const radius = this.cellSize * 0.4;
        
        for (let r = 0; r < XQ_ROWS; r++) {
            for (let c = 0; c < XQ_COLS; c++) {
                const p = this.board[r][c];
                if (!p) continue;
                
                const cx = c * this.cellSize + pad;
                const cy = r * this.cellSize + pad;
                
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, radius, 0, Math.PI*2);
                this.ctx.fillStyle = "#f3e5ab"; // 木頭色
                this.ctx.fill();
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = p.color === XQ_RED ? "#e74c3c" : "#2c3e50";
                this.ctx.stroke();

                // 內圈
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, radius * 0.8, 0, Math.PI*2);
                this.ctx.stroke();

                this.ctx.fillStyle = p.color === XQ_RED ? "#e74c3c" : "#2c3e50";
                this.ctx.font = `bold ${radius}px '標楷體', serif`;
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(XQ_NAMES[p.type][p.color], cx, cy + 2);
            }
        }
        
        // 標記最後一步
        if (this.lastMove) {
            this.ctx.strokeStyle = "rgba(41, 128, 185, 0.5)";
            this.ctx.lineWidth = 2;
            const tcx = this.lastMove.to.c * this.cellSize + pad;
            const tcy = this.lastMove.to.r * this.cellSize + pad;
            this.ctx.strokeRect(tcx - radius, tcy - radius, radius*2, radius*2);
        }
    }

    updateUI() {
        const pb = document.getElementById('player-black');
        const pw = document.getElementById('player-white');
        
        // 雖然 DOM ID 叫 black/white，我們用它來表示 建房者/加入者
        // 象棋中建房者預設為紅(先)，加入者為黑
        if (this.currentPlayer === XQ_RED) {
            pb.classList.add('active'); // pb 代表建房者 (紅)
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
