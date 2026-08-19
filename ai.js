class StickyGoAI {
    constructor(difficulty) {
        this.difficulty = difficulty;
    }

    makeMove(gameInstance) {
        const color = WHITE; 
        const validMoves = this.getValidMoves(gameInstance);

        if (validMoves.length === 0) return;

        let bestMove = null;

        if (this.difficulty === 'easy') {
            // 隨機
            bestMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        } else if (this.difficulty === 'medium') {
            // 中等：簡單防守與攻擊 (看連線數)
            bestMove = this.getHeuristicMove(gameInstance, validMoves, color, false);
        } else {
            // 困難：看連線數，且重視阻擋與攻擊
            bestMove = this.getHeuristicMove(gameInstance, validMoves, color, true);
        }

        if (bestMove) {
            setTimeout(() => {
                gameInstance.playMove(bestMove.row, bestMove.col, true);
            }, 500); 
        }
    }

    getValidMoves(game) {
        const moves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (game.board[r][c] === EMPTY) {
                    moves.push({ row: r, col: c });
                }
            }
        }
        return moves;
    }

    getHeuristicMove(game, validMoves, color, isHard) {
        let bestScore = -Infinity;
        let bestMoves = [];
        
        const opponent = color === BLACK ? WHITE : BLACK;

        for (let move of validMoves) {
            let score = 0;
            
            // 評估下在這步對自己的好處
            let myScore = this.evaluateLine(game.board, move.row, move.col, color);
            // 評估下在這步對敵人的破壞(防守價值)
            let oppScore = this.evaluateLine(game.board, move.row, move.col, opponent);

            if (isHard) {
                // 困難模式下，防守也很重要（如果敵人快贏了就一定要擋）
                score = myScore + oppScore * 1.2; 
                // 稍微鼓勵下在中間
                const center = Math.floor(BOARD_SIZE / 2);
                score += (center - Math.abs(move.row - center)) + (center - Math.abs(move.col - center));
            } else {
                // 中等模式比較偏向自己進攻
                score = myScore + oppScore * 0.8;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    evaluateLine(board, row, col, color) {
        let totalScore = 0;
        const directions = [
            [1, 0], [0, 1], [1, 1], [1, -1]
        ];

        for (let dir of directions) {
            let count = 1; // 包含自己剛下的這步
            let blocked = 0;
            
            // 正向
            for (let i = 1; i <= 4; i++) {
                const r = row + dir[0] * i;
                const c = col + dir[1] * i;
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
                    blocked++;
                    break;
                }
                if (board[r][c] === color) {
                    count++;
                } else if (board[r][c] !== EMPTY) {
                    blocked++;
                    break;
                } else {
                    break;
                }
            }
            
            // 反向
            for (let i = 1; i <= 4; i++) {
                const r = row - dir[0] * i;
                const c = col - dir[1] * i;
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
                    blocked++;
                    break;
                }
                if (board[r][c] === color) {
                    count++;
                } else if (board[r][c] !== EMPTY) {
                    blocked++;
                    break;
                } else {
                    break;
                }
            }

            // 給分邏輯
            if (count >= 5) totalScore += 100000; // 贏了
            else if (count === 4) {
                if (blocked === 0) totalScore += 10000; // 活四
                else if (blocked === 1) totalScore += 1000; // 衝四
            }
            else if (count === 3) {
                if (blocked === 0) totalScore += 1000; // 活三
                else if (blocked === 1) totalScore += 100; // 眠三
            }
            else if (count === 2) {
                if (blocked === 0) totalScore += 100; // 活二
                else if (blocked === 1) totalScore += 10; // 眠二
            }
            else if (count === 1) {
                totalScore += 1;
            }
        }
        return totalScore;
    }
}
