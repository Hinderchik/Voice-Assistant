// network.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ КЛИЕНТ
class Network {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.gameId = null;
        this.roomId = null;
        this.wsUrl = 'wss://quiet-grass-0e58.gondonloxlp.workers.dev/ws';
        this.messageHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pingInterval = null;
        
        // Автоматическая инициализация
        setTimeout(() => this.init(), 1000);
    }

    init() {
        this.generatePlayerId();
        this.setupMessageHandlers();
        this.connect();
    }

    generatePlayerId() {
        if (!this.playerId) {
            this.playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            try {
                this.playerName = localStorage.getItem('chess_player_name') || 
                                 `Игрок_${this.playerId.slice(-4)}`;
            } catch(e) {
                this.playerName = `Игрок_${this.playerId.slice(-4)}`;
            }
        }
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        console.log('🔗 Подключение к WebSocket...');
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket подключен');
            this.reconnectAttempts = 0;
            this.updateStatus(true);
            
            this.send({
                type: 'connect',
                playerId: this.playerId,
                playerName: this.playerName
            });
            
            this.startPing();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 От сервера:', data.type, data);
                this.handleMessage(data);
            } catch (error) {
                console.error('❌ Ошибка парсинга:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('❌ Отключено:', event.code, event.reason);
            this.updateStatus(false);
            this.stopPing();
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * this.reconnectAttempts, 5000);
                console.log(`↻ Переподключение через ${delay}мс`);
                setTimeout(() => this.connect(), delay);
            }
        };

        this.ws.onerror = (error) => {
            console.error('💥 WebSocket ошибка:', error);
            this.updateStatus(false);
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📤 Отправка на сервер:', data.type, data);
            this.ws.send(JSON.stringify(data));
            return true;
        }
        console.warn('⚠️ WebSocket не готов к отправке');
        return false;
    }

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'ping',
                    timestamp: Date.now(),
                    playerId: this.playerId
                });
            }
        }, 25000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    updateStatus(connected) {
        if (window.UI && window.UI.updateConnectionStatus) {
            window.UI.updateConnectionStatus(connected);
        }
    }

    setupMessageHandlers() {
        // Подтверждение подключения
        this.messageHandlers.set('connected', (data) => {
            console.log('✅ Сервер подтвердил подключение');
            if (window.UI && window.UI.addChatMessage) {
                window.UI.addChatMessage('✅ Подключено к игровому серверу', 'Система');
            }
        });

        // Создание комнаты
        this.messageHandlers.set('room_created', (data) => {
            console.log('🏠 Комната создана:', data.roomId);
            this.roomId = data.roomId;
            
            if (window.UI) {
                // 1. Показываем код комнаты
                window.UI.showRoomCode(data.roomId);
                
                // 2. Обновляем список игроков
                if (data.players && data.players.length > 0) {
                    window.UI.updateRoomPlayers(data.players.map(p => ({
                        name: p.name || 'Игрок',
                        status: p.status || 'ready'
                    })));
                } else {
                    window.UI.updateRoomPlayers([
                        { name: this.playerName, status: 'ready' },
                        { name: 'Ожидание второго игрока...', status: 'waiting' }
                    ]);
                }
                
                // 3. Сообщения
                window.UI.addChatMessage(`🏠 Комната ${data.roomId} создана`, 'Система');
                window.UI.addChatMessage('Отправьте код другу для подключения', 'Система');
                window.UI.showMessage(`Комната ${data.roomId} создана!`, 'success');
                
                // 4. ВАЖНО: Показываем UI комнаты
                if (!document.getElementById('room-creation').style.display || 
                    document.getElementById('room-creation').style.display === 'none') {
                    window.UI.showRoomCreation();
                }
            }
        });

        // Присоединение к комнате
        this.messageHandlers.set('room_joined', (data) => {
            console.log('✅ Присоединились к комнате:', data.roomId);
            this.roomId = data.roomId;
            
            if (window.UI) {
                window.UI.addChatMessage(`✅ Вы присоединились к комнате ${data.roomId}`, 'Система');
                window.UI.showMessage('Вы в комнате! Ожидайте начала игры', 'success');
                
                // ВАЖНО: Скрываем форму ввода кода
                document.getElementById('room-join').style.display = 'none';
                
                // Показываем интерфейс комнаты
                document.getElementById('room-creation').style.display = 'block';
                document.getElementById('room-code').textContent = data.roomId;
            }
        });

        // Обновление комнаты (кто-то присоединился/вышел)
        this.messageHandlers.set('room_updated', (data) => {
            console.log('🔄 Комната обновлена:', data.players);
            
            if (window.UI && data.players) {
                const playersFormatted = data.players.map(p => ({
                    name: p.name || `Игрок_${p.id?.slice(-4)}`,
                    status: 'ready'
                }));
                
                window.UI.updateRoomPlayers(playersFormatted);
                
                if (data.players.length === 2) {
                    window.UI.addChatMessage('✅ Второй игрок присоединился!', 'Система');
                    window.UI.addChatMessage('Создатель комнаты может начать игру', 'Система');
                    
                    // Если это создатель - активируем кнопку "Начать игру"
                    const startBtn = document.getElementById('start-game-btn');
                    if (startBtn) {
                        startBtn.disabled = false;
                    }
                }
            }
        });

        // Начало игры
        this.messageHandlers.set('game_start', (data) => {
            console.log('🎮 Начало игры:', data);
            this.gameId = data.gameId;
            this.roomId = null;
            
            if (window.Game && window.Game.startGame) {
                window.Game.startGame({
                    gameId: data.gameId,
                    color: data.color,
                    opponent: data.opponent,
                    timeControl: data.timeControl || { white: 600, black: 600 }
                });
            }
            
            if (window.UI) {
                window.UI.showGameScreen();
                const colorText = data.color === 'w' ? 'белыми' : 'черными';
                window.UI.addChatMessage(`🎮 Игра началась! Вы играете ${colorText}`, 'Система');
                window.UI.addChatMessage(`Противник: ${data.opponent}`, 'Система');
            }
        });

        // Ошибка
        this.messageHandlers.set('error', (data) => {
            console.error('❌ Ошибка сервера:', data.message);
            if (window.UI && window.UI.showMessage) {
                window.UI.showMessage(data.message || 'Ошибка сервера', 'error');
            }
        });

        // Чат
        this.messageHandlers.set('chat', (data) => {
            if (window.UI && window.UI.addChatMessage) {
                window.UI.addChatMessage(data.message, data.playerName || 'Игрок');
            }
        });
        
        // Ход
        this.messageHandlers.set('move', (data) => {
            if (window.Game && window.Game.applyMove && this.gameId === data.gameId) {
                window.Game.applyMove(data.move);
            }
        });
        
        // Pong
        this.messageHandlers.set('pong', () => {
            console.log('🏓 Pong received');
        });
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('📨 Неизвестный тип сообщения:', data.type, data);
        }
    }

    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========
    
    findGame() {
        this.send({
            type: 'find_game',
            playerId: this.playerId,
            playerName: this.playerName
        });
        
        if (window.UI) {
            window.UI.showMessage('🔍 Ищем соперника...', 'info');
        }
    }

    createRoom() {
        console.log('🏠 Создание комнаты...');
        this.send({
            type: 'create_room',
            playerId: this.playerId,
            playerName: this.playerName
        });
        
        if (window.UI) {
            window.UI.showMessage('Создаем комнату...', 'info');
        }
    }

    joinRoom(roomCode) {
        console.log('🔑 Присоединение к комнате:', roomCode);
        
        if (!roomCode || roomCode.length !== 6) {
            if (window.UI) {
                window.UI.showMessage('❌ Код комнаты должен быть 6 символов', 'error');
            }
            return;
        }
        
        this.send({
            type: 'join_room',
            playerId: this.playerId,
            playerName: this.playerName,
            roomCode: roomCode.toUpperCase().trim()
        });
    }

    startGame(roomCode) {
        console.log('🚀 Запуск игры в комнате:', roomCode);
        this.send({
            type: 'start_game',
            playerId: this.playerId,
            roomId: roomCode || this.roomId
        });
    }

    sendMove(move) {
        if (!this.gameId) {
            console.warn('⚠️ Нет активной игры для хода');
            return;
        }
        
        this.send({
            type: 'move',
            playerId: this.playerId,
            gameId: this.gameId,
            move: move
        });
    }

    sendChat(message) {
        const target = this.gameId ? this.gameId : (this.roomId || 'lobby');
        this.send({
            type: 'chat',
            playerId: this.playerId,
            playerName: this.playerName,
            target: target,
            message: message
        });
    }

    resign() {
        if (!this.gameId) return;
        this.send({ type: 'resign', playerId: this.playerId, gameId: this.gameId });
    }
    
    offerDraw() {
        if (!this.gameId) return;
        this.send({ type: 'offer_draw', playerId: this.playerId, gameId: this.gameId });
    }
    
    acceptDraw() {
        if (!this.gameId) return;
        this.send({ type: 'accept_draw', playerId: this.playerId, gameId: this.gameId });
    }
    
    declineDraw() {
        if (!this.gameId) return;
        this.send({ type: 'decline_draw', playerId: this.playerId, gameId: this.gameId });
    }
    
    leaveGame() {
        if (this.gameId) {
            this.send({ type: 'leave_game', playerId: this.playerId, gameId: this.gameId });
            this.gameId = null;
        }
        if (window.Game && window.Game.reset) {
            window.Game.reset();
        }
    }
    
    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close(1000, 'Пользователь вышел');
        }
    }
}

// Глобальный экземпляр
window.Network = new Network();

// Глобальные функции для кнопок
window.createPrivateRoom = function() {
    if (window.Network) {
        window.Network.createRoom();
        // UI обновится когда придет room_created
    }
};

window.joinPrivateRoom = function() {
    if (window.UI) {
        window.UI.showRoomJoin();
    }
};

window.joinRoom = function() {
    const input = document.getElementById('room-code-input');
    if (!input) return;
    
    const code = input.value.toUpperCase().trim();
    if (code.length !== 6) {
        if (window.UI) {
            window.UI.showMessage('❌ Код комнаты должен быть 6 символов', 'error');
        }
        return;
    }
    
    if (window.Network) {
        window.Network.joinRoom(code);
    }
};

window.startRoomGame = function() {
    const code = document.getElementById('room-code')?.textContent;
    if (window.Network && code) {
        window.Network.startGame(code);
    }
};

window.copyRoomCode = function() {
    const code = document.getElementById('room-code')?.textContent;
    if (code && navigator.clipboard) {
        navigator.clipboard.writeText(code)
            .then(() => {
                if (window.UI) window.UI.showMessage('Код скопирован!', 'success');
            })
            .catch(() => {
                if (window.UI) window.UI.showMessage('Ошибка копирования', 'error');
            });
    }
};

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('♟️ Chess Online загружен');
    if (window.UI && window.UI.init) {
        window.UI.init();
    }
});