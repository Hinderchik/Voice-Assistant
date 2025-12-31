// network.js - Полная версия для вашего сервера
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
        this.roomCode = null;
        
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
            
            // Отправляем информацию о подключении
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
                console.log('📨 Сервер:', data.type, data);
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
            console.log('📤 Отправка:', data.type, data);
            this.ws.send(JSON.stringify(data));
            return true;
        }
        console.warn('⚠️ WebSocket не готов');
        return false;
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
            this.roomCode = data.roomId;
            
            if (window.UI) {
                window.UI.showRoomCode(data.roomId);
                window.UI.addChatMessage(`🏠 Комната ${data.roomId} создана`, 'Система');
                window.UI.addChatMessage('Отправьте код другу для подключения', 'Система');
                
                // Показываем список игроков
                if (data.players) {
                    window.UI.updateRoomPlayers(data.players);
                } else {
                    window.UI.updateRoomPlayers([
                        { name: this.playerName, status: 'ready' },
                        { name: 'Ожидание...', status: 'waiting' }
                    ]);
                }
            }
        });

        // Присоединение к комнате
        this.messageHandlers.set('room_joined', (data) => {
            console.log('✅ Присоединились к комнате:', data.roomId);
            this.roomId = data.roomId;
            
            if (window.UI) {
                window.UI.addChatMessage(`✅ Присоединились к комнате ${data.roomId}`, 'Система');
                window.UI.showMessage(`Вы в комнате ${data.roomId}`, 'success');
            }
        });

        // Обновление комнаты
        this.messageHandlers.set('room_updated', (data) => {
            console.log('🔄 Комната обновлена:', data.players);
            if (window.UI && window.UI.updateRoomPlayers && data.players) {
                window.UI.updateRoomPlayers(data.players);
            }
        });

        // Начало игры
        this.messageHandlers.set('game_start', (data) => {
            console.log('🎮 Игра началась:', data.gameId);
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

        // Ход
        this.messageHandlers.set('move', (data) => {
            if (window.Game && window.Game.applyMove && this.gameId === data.gameId) {
                window.Game.applyMove(data.move);
            }
        });

        // Чат
        this.messageHandlers.set('chat', (data) => {
            if (window.UI && window.UI.addChatMessage) {
                window.UI.addChatMessage(data.message, data.playerName || 'Игрок');
            }
        });
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('📨 Неизвестное сообщение:', data.type, data);
        }
    }

    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========
    
    findGame() {
        console.log('🔍 Поиск игры...');
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
        
        // Сначала показываем UI
        if (window.UI) {
            // Создаем код комнаты на клиенте
            const roomCode = window.UI.generateRoomCode();
            window.UI.showRoomCode(roomCode);
            window.UI.updateRoomPlayers([
                { name: this.playerName, status: 'ready' },
                { name: 'Ожидание...', status: 'waiting' }
            ]);
            window.UI.addChatMessage(`🏠 Комната ${roomCode} создана`, 'Система');
            this.roomCode = roomCode;
        }
        
        // Потом отправляем на сервер
        this.send({
            type: 'create_room',
            playerId: this.playerId,
            playerName: this.playerName
        });
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
        
        if (window.UI) {
            window.UI.showMessage(`🔑 Присоединяемся к комнате ${roomCode}...`, 'info');
        }
    }

    startGame(roomCode) {
        console.log('🚀 Запуск игры в комнате:', roomCode);
        this.send({
            type: 'start_game',
            playerId: this.playerId,
            roomId: roomCode || this.roomCode
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

    // Остальные методы (resign, offerDraw, acceptDraw, declineDraw, leaveGame) остаются как в предыдущей версии
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

// Экспортируем глобальные функции для UI
window.createPrivateRoom = function() {
    if (window.Network) {
        window.Network.createRoom();
        window.UI.showRoomCreation();
    }
};

window.joinPrivateRoom = function() {
    window.UI.showRoomJoin();
};

window.joinRoom = function() {
    const input = document.getElementById('room-code-input');
    if (!input) return;
    
    const code = input.value.toUpperCase().trim();
    if (code.length !== 6) {
        window.UI.showMessage('❌ Код комнаты должен быть 6 символов', 'error');
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

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('♟️ Chess Online загружен');
    if (window.UI && window.UI.init) {
        window.UI.init();
    }
});