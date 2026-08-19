class StickyGoAI {
    constructor(difficulty) {
        // difficulty: 'easy', 'medium', 'hard'
        this.difficulty = difficulty;
    }

    makeMove(gameInstance) {
        // gameInstance 是當前的 StickyGo 物件
        const color = WHITE; // AI 預設當白子
        const validMoves = this.getValidMoves(gameInstance);

        if (validMoves.length === 0) {
            gameInstance.pass();
            return;
        }

        let bestMove = null;

        if (this.difficulty === 'easy') {
            // 隨機選一個合法步
            bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        } else if (this.difficulty === 'medium') {
            // 簡單貪婪：能吃子就吃子，不然就隨機下在自己棋子旁邊，或隨機
            bestMove = this.getGreedyMove(gameInstance, validMoves, color);
        } else {
            // hard: 試算一步，評估盤面分數 (自己氣數 - 敵人氣數 + 提子差)
            bestMove = this.getBestEvaluatedMove(gameInstance, validMoves, color);
        }

        if (bestMove) {
            // 模擬點擊或直接呼叫
            setTimeout(() => {
                gameInstance.playMove(bestMove.row, bestMove.col, true);
            }, 500); // 延遲半秒比較有對弈感
        } else {
            gameInstance.pass();
        }
    }

    getValidMoves(game) {
        const moves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (game.board[r][c] === EMPTY) {
                    if (this.isValidSimulatedMove(game, r, c, game.currentPlayer)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        return moves;
    }

    // 模擬落子檢查合法性 (防自殺與劫爭)
    isValidSimulatedMove(game, row, col, color) {
        // 劫爭檢查
        if (game.koPoint && game.koPoint.row === row && game.koPoint.col === col) {
            return false;
        }

        // 模擬落子
        const cloneBoard = game.board.map(r => [...r]);
        cloneBoard[row][col] = color;
        
        let captured = 0;
        const opponent = color === BLACK ? WHITE : BLACK;
        
        // 檢查周圍敵軍是否被吃
        const neighbors = this.getNeighbors(row, col);
        neighbors.forEach(n => {
            if (cloneBoard[n.row][n.col] === opponent) {
                const group = this.getGroup(cloneBoard, n.row, n.col);
                if (this.getLiberties(cloneBoard, group) === 0) {
                    captured++;
                }
            }
        });

        // 如果有吃子，絕對不是自殺
        if (captured > 0) return true;

        // 檢查自己是否自殺
        const myGroup = this.getGroup(cloneBoard, row, col);
        if (this.getLiberties(cloneBoard, myGroup) === 0) {
            return false;
        }

        return true;
    }

    getGreedyMove(game, validMoves, color) {
        const opponent = color === BLACK ? WHITE : BLACK;
        
        // 1. 找能吃子的步
        for (let move of validMoves) {
            const cloneBoard = game.board.map(r => [...r]);
            cloneBoard[move.row][move.col] = color;
            let captured = false;
            this.getNeighbors(move.row, move.col).forEach(n => {
                if (cloneBoard[n.row][n.col] === opponent && this.getLiberties(cloneBoard, this.getGroup(cloneBoard, n.row, n.col)) === 0) {
                    captured = true;
                }
            });
            if (captured) return move;
        }

        // 2. 找能救自己危急棋子的步 (自己某群氣=1，下這步後氣>1)
        for (let move of validMoves) {
            const cloneBoard = game.board.map(r => [...r]);
            cloneBoard[move.row][move.col] = color;
            const myGroup = this.getGroup(cloneBoard, move.row, move.col);
            if (this.getLiberties(cloneBoard, myGroup) > 1) {
                // 檢查是否救了原本氣=1的群組
                let saved = false;
                this.getNeighbors(move.row, move.col).forEach(n => {
                    if (game.board[n.row][n.col] === color) {
                        const oldGroup = this.getGroup(game.board, n.row, n.col);
                        if (this.getLiberties(game.board, oldGroup) === 1) saved = true;
                    }
                });
                if (saved) return move;
            }
        }

        // 3. 隨機
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    getBestEvaluatedMove(game, validMoves, color) {
        let bestScore = -Infinity;
        let bestMoves = [];

        for (let move of validMoves) {
            const score = this.evaluateMove(game, move.row, move.col, color);
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    evaluateMove(game, row, col, color) {
        const cloneBoard = game.board.map(r => [...r]);
        cloneBoard[row][col] = color;
        const opponent = color === BLACK ? WHITE : BLACK;

        let score = 0;

        // 執行吃子
        let captured = 0;
        this.getNeighbors(row, col).forEach(n => {
            if (cloneBoard[n.row][n.col] === opponent) {
                const group = this.getGroup(cloneBoard, n.row, n.col);
                if (this.getLiberties(cloneBoard, group) === 0) {
                    group.forEach(stone => cloneBoard[stone.row][stone.col] = EMPTY);
                    captured += group.length;
                }
            }
        });

        score += captured * 10;

        // 評估全盤氣數與棋子數
        let myStones = 0;
        let oppStones = 0;
        let myLiberties = 0;
        let oppLiberties = 0;

        const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (cloneBoard[r][c] !== EMPTY && !visited[r][c]) {
                    const group = this.getGroup(cloneBoard, r, c);
                    const lib = this.getLiberties(cloneBoard, group);
                    
                    group.forEach(s => visited[s.row][s.col] = true);

                    if (cloneBoard[r][c] === color) {
                        myStones += group.length;
                        myLiberties += lib;
                        if (lib === 1) score -= 5; // 自己快死扣分
                    } else {
                        oppStones += group.length;
                        oppLiberties += lib;
                        if (lib === 1) score += 3; // 逼迫對手加分
                    }
                }
            }
        }

        score += (myStones - oppStones) * 2;
        score += (myLiberties - oppLiberties);
        
        // 稍微鼓勵往中間下
        const centerDist = Math.abs(row - 4) + Math.abs(col - 4);
        score -= centerDist * 0.1;

        return score;
    }

    // --- 輔助函式 (不依賴外部 game instance 狀態，獨立運作) ---
    getNeighbors(row, col) {
        const neighbors = [];
        if (row > 0) neighbors.push({ row: row - 1, col });
        if (row < BOARD_SIZE - 1) neighbors.push({ row: row + 1, col });
        if (col > 0) neighbors.push({ row, col: col - 1 });
        if (col < BOARD_SIZE - 1) neighbors.push({ row, col: col + 1 });
        return neighbors;
    }

    getGroup(board, row, col) {
        const color = board[row][col];
        if (color === EMPTY) return [];
        const group = [];
        const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
        const stack = [{ row, col }];
        visited[row][col] = true;

        while (stack.length > 0) {
            const current = stack.pop();
            group.push(current);

            this.getNeighbors(current.row, current.col).forEach(n => {
                if (!visited[n.row][n.col] && board[n.row][n.col] === color) {
                    visited[n.row][n.col] = true;
                    stack.push(n);
                }
            });
        }
        return group;
    }

    getLiberties(board, group) {
        let liberties = 0;
        const visited = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));

        group.forEach(stone => {
            this.getNeighbors(stone.row, stone.col).forEach(n => {
                if (board[n.row][n.col] === EMPTY && !visited[n.row][n.col]) {
                    visited[n.row][n.col] = true;
                    liberties++;
                }
            });
        });
        return liberties;
    }
}
