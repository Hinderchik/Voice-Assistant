// game.js - Полная игровая логика с твоими фигурами
class ChessGame {
    constructor() {
        this.chess = new Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draggedPiece = null;
        this.dragStartSquare = null;
        this.playerColor = 'w';
        this.isMyTurn = false;
        this.gameActive = false;
        this.gameId = null;
        this.opponent = null;
        this.timeControl = { white: 600, black: 600 };
        this.timers = { white: 600, black: 600 };
        this.timerInterval = null;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.promotionMove = null;
        this.boardFlipped = false;
        this.preloadedPieces = new Map();
    }

    init() {
        this.createBoard();
        this.setupEventListeners();
        this.updateBoard();
        this.preloadPieceImages();
    }

    preloadPieceImages() {
        // Предзагрузка ТВОИХ фигур
        const pieces = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];
        pieces.forEach(piece => {
            const img = new Image();
            img.src = `assets/pieces/${piece}.svg`;
            this.preloadedPieces.set(piece, img);
        });
    }

    createBoard() {
        const board = document.getElementById('chess-board');
        board.innerHTML = '';
        
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                const squareId = files[file] + ranks[rank];
                
                square.className = `square ${(rank + file) % 2 === 0 ? 'light' : 'dark'}`;
                square.id = squareId;
                square.dataset.square = squareId;
                square.dataset.rank = rank;
                square.dataset.file = file;
                
                // Добавление координат
                if (file === 0) {
                    const rankLabel = document.createElement('div');
                    rankLabel.className = 'coordinate rank';
                    rankLabel.textContent = ranks[rank];
                    square.appendChild(rankLabel);
                }
                
                if (rank === 7) {
                    const fileLabel = document.createElement('div');
                    fileLabel.className = 'coordinate file';
                    fileLabel.textContent = files[file];
                    square.appendChild(fileLabel);
                }
                
                board.appendChild(square);
            }
        }
        
        this.updateBoard();
    }

    setupEventListeners() {
        const board = document.getElementById('chess-board');
        
        // Десктоп
        board.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Мобильные
        board.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Клики по клеткам
        board.addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (square && !this.draggedPiece) {
                this.handleSquareClick(square.id);
            }
        });
    }

    handleMouseDown(e) {
        if (!this.gameActive || !this.isMyTurn) return;
        
        const piece = e.target.closest('.piece');
        if (!piece) return;
        
        const square = piece.dataset.square;
        const pieceColor = piece.dataset.color;
        
        if (pieceColor !== this.playerColor) return;
        
        this.draggedPiece = piece;
        this.dragStartSquare = square;
        
        const rect = piece.getBoundingClientRect();
        this.draggedPiece.startX = e.clientX - rect.left;
        this.draggedPiece.startY = e.clientY - rect.top;
        
        this.draggedPiece.classList.add('dragging');
        this.draggedPiece.style.position = 'fixed';
        this.draggedPiece.style.left = `${e.clientX - this.draggedPiece.startX}px`;
        this.draggedPiece.style.top = `${e.clientY - this.draggedPiece.startY}px`;
        this.draggedPiece.style.zIndex = '1000';
        this.draggedPiece.style.pointerEvents = 'none';
        
        this.showLegalMoves(square);
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.draggedPiece) return;
        
        this.draggedPiece.style.left = `${e.clientX - this.draggedPiece.startX}px`;
        this.draggedPiece.style.top = `${e.clientY - this.draggedPiece.startY}px`;
    }

    handleMouseUp(e) {
        if (!this.draggedPiece || !this.dragStartSquare) {
            this.cleanupDrag();
            return;
        }
        
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const square = targetElement?.closest('.square');
        
        if (square) {
            this.makeMove(this.dragStartSquare, square.id);
        }
        
        this.cleanupDrag();
    }

    handleTouchStart(e) {
        if (!this.gameActive || !this.isMyTurn) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const piece = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.piece');
        if (!piece) return;
        
        const square = piece.dataset.square;
        const pieceColor = piece.dataset.color;
        
        if (pieceColor !== this.playerColor) return;
        
        this.draggedPiece = piece;
        this.dragStartSquare = square;
        
        const rect = piece.getBoundingClientRect();
        this.draggedPiece.startX = touch.clientX - rect.left;
        this.draggedPiece.startY = touch.clientY - rect.top;
        
        this.draggedPiece.classList.add('dragging');
        this.draggedPiece.style.position = 'fixed';
        this.draggedPiece.style.left = `${touch.clientX - this.draggedPiece.startX}px`;
        this.draggedPiece.style.top = `${touch.clientY - this.draggedPiece.startY}px`;
        this.draggedPiece.style.zIndex = '1000';
        this.draggedPiece.style.pointerEvents = 'none';
        
        this.showLegalMoves(square);
    }

    handleTouchMove(e) {
        if (!this.draggedPiece) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        this.draggedPiece.style.left = `${touch.clientX - this.draggedPiece.startX}px`;
        this.draggedPiece.style.top = `${touch.clientY - this.draggedPiece.startY}px`;
    }

    handleTouchEnd(e) {
        if (!this.draggedPiece || !this.dragStartSquare) {
            this.cleanupDrag();
            return;
        }
        e.preventDefault();
        
        const touch = e.changedTouches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const square = targetElement?.closest('.square');
        
        if (square) {
            this.makeMove(this.dragStartSquare, square.id);
        }
        
        this.cleanupDrag();
    }

    handleSquareClick(squareId) {
        if (!this.gameActive || !this.isMyTurn) return;
        
        if (this.selectedSquare) {
            const legalMove = this.legalMoves.find(move => move.to === squareId);
            if (legalMove) {
                this.makeMove(this.selectedSquare, squareId);
            }
            this.selectedSquare = null;
            this.hideLegalMoves();
        } else {
            const piece = document.querySelector(`.piece[data-square="${squareId}"]`);
            if (piece && piece.dataset.color === this.playerColor) {
                this.selectedSquare = squareId;
                this.showLegalMoves(squareId);
            }
        }
    }

    cleanupDrag() {
        if (this.draggedPiece) {
            this.draggedPiece.classList.remove('dragging');
            this.draggedPiece.style.position = '';
            this.draggedPiece.style.left = '';
            this.draggedPiece.style.top = '';
            this.draggedPiece.style.zIndex = '';
            this.draggedPiece.style.pointerEvents = '';
            this.draggedPiece = null;
        }
        this.dragStartSquare = null;
        this.hideLegalMoves();
    }

    showLegalMoves(square) {
        this.hideLegalMoves();
        
        const moves = this.chess.moves({ square: square, verbose: true });
        this.legalMoves = moves;
        
        moves.forEach(move => {
            const squareEl = document.getElementById(move.to);
            if (squareEl) {
                if (move.flags.includes('c') || move.flags.includes('e')) {
                    squareEl.classList.add('capture-move');
                } else {
                    squareEl.classList.add('legal-move');
                }
            }
        });
        
        document.getElementById(square).classList.add('selected');
    }

    hideLegalMoves() {
        document.querySelectorAll('.selected, .legal-move, .capture-move').forEach(el => {
            el.classList.remove('selected', 'legal-move', 'capture-move');
        });
        this.legalMoves = [];
    }

    makeMove(from, to, promotion = null) {
        if (!this.gameActive || !this.isMyTurn) return false;
        
        let move;
        try {
            if (promotion) {
                move = this.chess.move({ from: from, to: to, promotion: promotion });
            } else {
                move = this.chess.move({ from: from, to: to });
            }
        } catch (error) {
            console.log('Недопустимый ход:', error);
            return false;
        }
        
        if (move) {
            if (move.flags.includes('p') && !promotion) {
                this.promotionMove = { from: from, to: to };
                this.showPromotionModal(move.color);
                return true;
            }
            
            // Захват фигуры
            if (move.captured) {
                const capturingColor = move.color;
                const capturedColor = capturingColor === 'w' ? 'b' : 'w';
                this.capturedPieces[capturedColor].push(move.captured);
                this.updateCapturedPieces();
            }
            
            this.addMoveToHistory(move);
            this.updateBoard();
            
            // Отправка хода через Network
            if (window.Network && window.Network.sendMove) {
                window.Network.sendMove({ 
                    from: from, 
                    to: to, 
                    promotion: promotion 
                });
            }
            
            this.isMyTurn = false;
            this.updateTurnIndicator();
            this.checkGameOver();
            
            return true;
        }
        
        return false;
    }

    showPromotionModal(color) {
        const modal = document.getElementById('promotion-modal');
        const options = modal.querySelector('.promotion-options');
        options.innerHTML = '';
        
        const pieces = [
            { piece: 'q', name: 'Ферзь' },
            { piece: 'r', name: 'Ладья' },
            { piece: 'b', name: 'Слон' },
            { piece: 'n', name: 'Конь' }
        ];
        
        pieces.forEach(({ piece, name }) => {
            const option = document.createElement('div');
            option.className = 'promotion-option';
            option.dataset.piece = piece;
            
            // Используем ТВОИ фигуры
            option.innerHTML = `
                <img src="assets/pieces/${color}${piece}.svg" alt="${name}" class="promotion-piece-img">
                <span>${name}</span>
            `;
            
            option.onclick = () => {
                this.makeMove(this.promotionMove.from, this.promotionMove.to, piece);
                modal.style.display = 'none';
            };
            
            options.appendChild(option);
        });
        
        modal.style.display = 'flex';
    }

    hidePromotionModal() {
        const modal = document.getElementById('promotion-modal');
        modal.style.display = 'none';
        this.promotionMove = null;
    }

    addMoveToHistory(move) {
        const moveNumber = Math.ceil(this.moveHistory.length / 2) + 1;
        const isWhiteMove = this.moveHistory.length % 2 === 0;
        
        const moveEntry = {
            number: isWhiteMove ? moveNumber : '',
            notation: this.chess.move_to_san(move),
            color: move.color
        };
        
        this.moveHistory.push(moveEntry);
        this.updateMoveHistory();
    }

    updateMoveHistory() {
        const movesList = document.getElementById('moves-list');
        movesList.innerHTML = '';
        
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1];
            
            const moveEntry = document.createElement('div');
            moveEntry.className = 'move-entry';
            
            moveEntry.innerHTML = `
                <div class="move-number">${whiteMove.number}</div>
                <div class="move-white">${whiteMove.notation}</div>
                <div class="move-black">${blackMove ? blackMove.notation : ''}</div>
            `;
            
            movesList.appendChild(moveEntry);
        }
        
        movesList.scrollTop = movesList.scrollHeight;
    }

    updateBoard() {
        // Очищаем все фигуры
        document.querySelectorAll('.piece').forEach(p => p.remove());
        
        // Получаем текущую позицию
        const board = this.chess.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece) {
                    const squareId = String.fromCharCode(97 + file) + (8 - rank);
                    const square = document.getElementById(squareId);
                    
                    if (square) {
                        // Создаем img элемент с ТВОЕЙ фигурой
                        const pieceImg = document.createElement('img');
                        pieceImg.className = 'piece';
                        pieceImg.dataset.square = squareId;
                        pieceImg.dataset.color = piece.color;
                        pieceImg.dataset.piece = piece.type;
                        pieceImg.alt = `${piece.color === 'w' ? 'белый' : 'черный'} ${this.getPieceName(piece.type)}`;
                        
                        // Используем ТВОИ SVG файлы
                        pieceImg.src = `assets/pieces/${piece.color}${piece.type}.svg`;
                        
                        square.appendChild(pieceImg);
                    }
                }
            }
        }
        
        this.updateTurnIndicator();
    }

    getPieceName(type) {
        const names = {
            'p': 'пешка',
            'n': 'конь',
            'b': 'слон',
            'r': 'ладья',
            'q': 'ферзь',
            'k': 'король'
        };
        return names[type] || type;
    }

    updateCapturedPieces() {
        const whiteCaptured = document.getElementById('white-captured');
        const blackCaptured = document.getElementById('black-captured');
        
        if (whiteCaptured) {
            whiteCaptured.innerHTML = '';
            this.capturedPieces.w.forEach(piece => {
                const img = document.createElement('img');
                img.src = `assets/pieces/b${piece}.svg`;
                img.className = 'captured-piece';
                img.alt = `захваченная черная ${this.getPieceName(piece)}`;
                whiteCaptured.appendChild(img);
            });
        }
        
        if (blackCaptured) {
            blackCaptured.innerHTML = '';
            this.capturedPieces.b.forEach(piece => {
                const img = document.createElement('img');
                img.src = `assets/pieces/w${piece}.svg`;
                img.className = 'captured-piece';
                img.alt = `захваченная белая ${this.getPieceName(piece)}`;
                blackCaptured.appendChild(img);
            });
        }
    }

    updateTurnIndicator() {
        const whiteStatus = document.getElementById('white-status');
        const blackStatus = document.getElementById('black-status');
        const statusBar = document.getElementById('status-message');
        
        if (whiteStatus) {
            whiteStatus.textContent = this.chess.turn() === 'w' ? 'Ходит' : '';
            whiteStatus.className = this.chess.turn() === 'w' ? 'active' : '';
        }
        
        if (blackStatus) {
            blackStatus.textContent = this.chess.turn() === 'b' ? 'Ходит' : '';
            blackStatus.className = this.chess.turn() === 'b' ? 'active' : '';
        }
        
        if (statusBar) {
            if (!this.gameActive) {
                statusBar.textContent = 'Игра не активна';
                statusBar.className = '';
            } else if (this.isMyTurn) {
                statusBar.textContent = 'Ваш ход!';
                statusBar.className = 'your-turn';
            } else {
                statusBar.textContent = 'Ход противника...';
                statusBar.className = 'opponent-turn';
            }
        }
    }

    updateTimers() {
        const whiteTime = document.getElementById('white-time');
        const blackTime = document.getElementById('black-time');
        
        if (whiteTime) whiteTime.textContent = this.formatTime(this.timers.white);
        if (blackTime) blackTime.textContent = this.formatTime(this.timers.black);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    checkGameOver() {
        if (this.chess.game_over()) {
            this.gameActive = false;
            
            let result = '';
            if (this.chess.in_checkmate()) {
                const winner = this.chess.turn() === 'w' ? 'черные' : 'белые';
                result = `Мат! Победа ${winner}`;
            } else if (this.chess.in_stalemate()) {
                result = 'Пат! Ничья';
            } else if (this.chess.in_draw()) {
                result = 'Ничья';
            } else if (this.chess.insufficient_material()) {
                result = 'Недостаточно материала. Ничья';
            }
            
            this.showGameOver(result);
            return true;
        }
        return false;
    }

    showGameOver(message) {
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const msg = document.getElementById('game-over-message');
        
        if (title) title.textContent = 'Игра окончена!';
        if (msg) msg.textContent = message;
        
        modal.style.display = 'flex';
        
        // Останавливаем таймер
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startGame(gameData) {
        this.chess = new Chess();
        this.gameActive = true;
        this.gameId = gameData.gameId;
        this.playerColor = gameData.color;
        this.isMyTurn = this.playerColor === 'w';
        this.opponent = gameData.opponent;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        
        if (gameData.timeControl) {
            this.timeControl = gameData.timeControl;
            this.timers = { white: this.timeControl.white, black: this.timeControl.black };
        }
        
        this.updatePlayerNames();
        this.startTimer();
        this.updateBoard();
        this.updateTurnIndicator();
        this.updateTimers();
        this.updateCapturedPieces();
        
        if (window.UI) {
            window.UI.showGameScreen();
        }
    }

    updatePlayerNames() {
        const whiteName = document.getElementById('white-player-name');
        const blackName = document.getElementById('black-player-name');
        
        if (this.playerColor === 'w') {
            if (whiteName) whiteName.textContent = 'Вы';
            if (blackName) blackName.textContent = this.opponent || 'Противник';
        } else {
            if (whiteName) whiteName.textContent = this.opponent || 'Противник';
            if (blackName) blackName.textContent = 'Вы';
        }
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (!this.gameActive) return;
            
            if (this.chess.turn() === 'w') {
                this.timers.white = Math.max(0, this.timers.white - 1);
            } else {
                this.timers.black = Math.max(0, this.timers.black - 1);
            }
            
            this.updateTimers();
            
            if (this.timers.white <= 0 || this.timers.black <= 0) {
                this.gameActive = false;
                const winner = this.timers.white <= 0 ? 'черных' : 'белых';
                this.showGameOver(`Время вышло! Победа ${winner}`);
                clearInterval(this.timerInterval);
            }
        }, 1000);
    }

    applyMove(moveData) {
        if (!this.gameActive) return;
        
        try {
            const move = this.chess.move({
                from: moveData.from,
                to: moveData.to,
                promotion: moveData.promotion
            });
            
            if (move) {
                if (move.captured) {
                    const capturingColor = move.color;
                    const capturedColor = capturingColor === 'w' ? 'b' : 'w';
                    this.capturedPieces[capturedColor].push(move.captured);
                }
                
                this.addMoveToHistory(move);
                this.updateBoard();
                this.updateCapturedPieces();
                this.isMyTurn = this.chess.turn() === this.playerColor;
                this.updateTurnIndicator();
                this.checkGameOver();
            }
        } catch (error) {
            console.error('Ошибка применения хода:', error);
        }
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        const board = document.getElementById('chess-board');
        board.classList.toggle('flipped', this.boardFlipped);
        
        // Обновляем отображение фигур
        this.updateBoard();
    }

    undoMove() {
        const move = this.chess.undo();
        if (move) {
            // Убираем последний захват если был
            if (move.captured) {
                const capturedColor = move.color === 'w' ? 'b' : 'w';
                this.capturedPieces[capturedColor].pop();
            }
            
            this.moveHistory.pop();
            this.updateBoard();
            this.updateMoveHistory();
            this.updateCapturedPieces();
            this.isMyTurn = this.chess.turn() === this.playerColor;
            this.updateTurnIndicator();
        }
    }

    reset() {
        this.chess = new Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draggedPiece = null;
        this.dragStartSquare = null;
        this.isMyTurn = false;
        this.gameActive = false;
        this.gameId = null;
        this.opponent = null;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.promotionMove = null;
        this.boardFlipped = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        this.updateBoard();
        this.updateTurnIndicator();
        this.updateCapturedPieces();
    }

    handleGameOver(data) {
        this.gameActive = false;
        this.showGameOver(data.result || 'Игра завершена');
    }

    handleDrawOffer(playerName) {
        const modal = document.getElementById('draw-offer-modal');
        const text = document.getElementById('draw-offer-text');
        
        if (text) text.textContent = `${playerName} предлагает ничью`;
        modal.style.display = 'flex';
    }
}

// Глобальный экземпляр
window.Game = new ChessGame();