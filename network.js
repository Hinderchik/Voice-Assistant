// network.js - WebSocket клиент для шахмат
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
    }

    init() {
        this.generatePlayerId();
        this.setupMessageHandlers();
        this.connect();
    }

    generatePlayerId() {
        this.playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.playerName = localStorage.getItem('chess_player_name') || `Игрок_${this.playerId.slice(-4)}`;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        console.log('Подключение к WebSocket:', this.wsUrl);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket подключен');
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
                console.log('Получено сообщение:', data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket отключен:', event.code, event.reason);
            this.updateStatus(false);
            this.stopPing();
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                console.log(`Переподключение через ${delay}мс (попытка ${this.reconnectAttempts})`);
                setTimeout(() => this.connect(), delay);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            this.updateStatus(false);
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping', timestamp: Date.now() });
        }, 30000);
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
        // Подключение успешно
        this.messageHandlers.set('connected', (data) => {
            console.log('Сервер подтвердил подключение');
            if (window.UI) {
                window.UI.addChatMessage('Подключено к серверу', 'Система');
            }
        });

        // Игроки онлайн
        this.messageHandlers.set('stats', (data) => {
            if (window.UI && window.UI.updateOnlineStats) {
                window.UI.updateOnlineStats(data.online, data.games || 0);
            }
        });

        // Комната создана
        this.messageHandlers.set('room_created', (data) => {
            if (window.UI) {
                window.UI.showRoomCode(data.roomId);
                if (data.players) {
                    window.UI.updateRoomPlayers(data.players);
                }
                window.UI.showMessage('Комната создана. Код: ' + data.roomId, 'success');
            }
            this.roomId = data.roomId;
        });

        // Обновление комнаты
        this.messageHandlers.set('room_updated', (data) => {
            if (window.UI && data.players) {
                window.UI.updateRoomPlayers(data.players);
            }
        });

        // Игра началась
        this.messageHandlers.set('game_start', (data) => {
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
                window.UI.addChatMessage(`Игра началась! Вы играете ${colorText}. Противник: ${data.opponent}`, 'Система');
            }
        });

        // Получен ход
        this.messageHandlers.set('move', (data) => {
            if (window.Game && this.gameId === data.gameId) {
                window.Game.applyMove(data.move);
            }
        });

        // Сообщение чата
        this.messageHandlers.set('chat', (data) => {
            if (window.UI) {
                window.UI.addChatMessage(data.message, data.playerName);
            }
        });

        // Предложение ничьей
        this.messageHandlers.set('draw_offered', (data) => {
            if (window.UI) {
                window.UI.showDrawOffer(data.playerName);
            }
        });

        // Игра завершена
        this.messageHandlers.set('game_over', (data) => {
            if (window.Game && this.gameId === data.gameId) {
                window.Game.handleGameOver(data);
                this.gameId = null;
            }
        });

        // Ошибка
        this.messageHandlers.set('error', (data) => {
            if (window.UI) {
                window.UI.showMessage(data.message, 'error');
            }
        });
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('Необработанный тип сообщения:', data.type, data);
        }
    }

    // ==== Публичные методы для UI ====
    
    findGame() {
        this.send({
            type: 'find_game',
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    createRoom() {
        this.send({
            type: 'create_room',
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    joinRoom(roomCode) {
        this.send({
            type: 'join_room',
            playerId: this.playerId,
            playerName: this.playerName,
            roomCode: roomCode.toUpperCase().trim()
        });
    }

    startGame(roomId) {
        this.send({
            type: 'start_game',
            playerId: this.playerId,
            roomId: roomId
        });
    }

    sendMove(move) {
        if (!this.gameId) return;
        
        this.send({
            type: 'move',
            playerId: this.playerId,
            gameId: this.gameId,
            move: move
        });
    }

    sendChat(message) {
        const targetId = this.gameId || this.roomId || 'lobby';
        this.send({
            type: 'chat',
            playerId: this.playerId,
            playerName: this.playerName,
            targetId: targetId,
            message: message
        });
    }

    resign() {
        if (!this.gameId) return;
        
        this.send({
            type: 'resign',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }

    offerDraw() {
        if (!this.gameId) return;
        
        this.send({
            type: 'offer_draw',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }

    acceptDraw() {
        if (!this.gameId) return;
        
        this.send({
            type: 'accept_draw',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }

    declineDraw() {
        if (!this.gameId) return;
        
        this.send({
            type: 'decline_draw',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }

    leaveGame() {
        if (this.gameId) {
            this.send({
                type: 'leave_game',
                playerId: this.playerId,
                gameId: this.gameId
            });
            this.gameId = null;
        }
        
        if (window.Game && window.Game.reset) {
            window.Game.reset();
        }
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Глобальный экземпляр
window.Network = new Network();

// Автоматическая инициализация при загрузке страницы
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.Network && window.Network.init) {
                window.Network.init();
                console.log('Network модуль инициализирован');
            }
        }, 1000);
    });
}