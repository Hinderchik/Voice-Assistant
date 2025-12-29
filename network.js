// network.js - Pusher реализация
class Network {
    constructor() {
        this.pusher = null;
        this.channel = null;
        this.gameChannel = null;
        this.playerId = null;
        this.gameId = null;
        this.playerName = null;
        this.roomId = null;
        this.connected = false;
    }

    init() {
        // Инициализация Pusher
        this.pusher = new Pusher('a0f39b2e9e5c7d8b4f6a', { // Тестовый ключ - замени на свой
            cluster: 'eu',
            encrypted: true,
            authEndpoint: '/api/pusher/auth'
        });

        this.playerId = this.generatePlayerId();
        this.playerName = localStorage.getItem('playerName') || `Игрок${Math.floor(Math.random() * 1000)}`;
        
        // Подписываемся на общие каналы
        this.subscribeToChannels();
        
        this.connected = true;
        this.updateConnectionStatus(true);
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    subscribeToChannels() {
        // Общий канал для уведомлений
        this.channel = this.pusher.subscribe('presence-chess-lobby');
        
        this.channel.bind('pusher:subscription_succeeded', () => {
            console.log('Подключен к лобби');
            this.sendToServer('player_online', {
                playerId: this.playerId,
                name: this.playerName
            });
        });

        this.channel.bind('player_joined', (data) => {
            UI.showMessage(`${data.name} присоединился к лобби`);
            this.updateOnlineCount();
        });

        this.channel.bind('player_left', (data) => {
            UI.showMessage(`${data.name} покинул лобби`);
            this.updateOnlineCount();
        });

        this.channel.bind('game_created', (data) => {
            this.handleGameCreated(data);
        });

        this.channel.bind('move_made', (data) => {
            if (window.Game && data.gameId === this.gameId) {
                window.Game.applyMove(data.move);
            }
        });

        this.channel.bind('chat_message', (data) => {
            if (data.gameId === this.gameId) {
                UI.addChatMessage(data.message, data.playerName);
            }
        });

        this.channel.bind('game_over', (data) => {
            if (data.gameId === this.gameId && window.Game) {
                window.Game.handleGameOver(data.result);
            }
        });
    }

    subscribeToGame(gameId) {
        if (this.gameChannel) {
            this.pusher.unsubscribe(this.gameChannel.name);
        }
        
        this.gameId = gameId;
        this.gameChannel = this.pusher.subscribe(`private-game-${gameId}`);
        
        this.gameChannel.bind('pusher:subscription_succeeded', () => {
            console.log('Подключен к игре:', gameId);
        });

        this.gameChannel.bind('game_start', (data) => {
            if (window.Game) {
                window.Game.startGame(data);
                UI.showGameScreen();
            }
        });

        this.gameChannel.bind('player_joined', (data) => {
            UI.updateRoomPlayers([
                { name: 'Вы', status: 'ready' },
                { name: data.playerName, status: 'ready' }
            ]);
            
            // Включаем кнопку "Начать игру"
            document.getElementById('start-game-btn').disabled = false;
        });
    }

    sendToServer(event, data = {}) {
        fetch('/api/chess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: event,
                playerId: this.playerId,
                playerName: this.playerName,
                gameId: this.gameId,
                roomId: this.roomId,
                ...data
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Ошибка сервера:', data.error);
                UI.showMessage(data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка сети:', error);
            UI.showMessage('Ошибка подключения к серверу', 'error');
        });
    }

    // Игровые методы
    findGame() {
        UI.showMessage('Поиск соперника...');
        this.sendToServer('find_game');
    }

    createRoom() {
        this.sendToServer('create_room');
    }

    joinRoom(roomCode) {
        this.roomId = roomCode;
        this.sendToServer('join_room', { roomCode });
    }

    startGame() {
        if (!this.roomId) return;
        this.sendToServer('start_game', { roomId: this.roomId });
    }

    sendMove(move) {
        if (!this.gameId) return;
        
        this.sendToServer('make_move', {
            gameId: this.gameId,
            move: move
        });
    }

    sendChat(message) {
        if (!this.gameId) return;
        
        this.sendToServer('send_chat', {
            gameId: this.gameId,
            message: message
        });
    }

    resign() {
        if (!this.gameId) return;
        this.sendToServer('resign', { gameId: this.gameId });
    }

    offerDraw() {
        if (!this.gameId) return;
        this.sendToServer('offer_draw', { gameId: this.gameId });
    }

    // Обработчики событий
    handleGameCreated(data) {
        if (data.roomId === this.roomId) {
            UI.showRoomCode(data.roomId);
            this.subscribeToGame(data.gameId);
        }
    }

    updateOnlineCount() {
        if (this.channel && this.channel.members) {
            const count = this.channel.members.count;
            document.getElementById('online-count').textContent = count;
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = connected ? 'Подключено' : 'Отключено';
            statusEl.className = connected ? 'connected' : 'disconnected';
        }
    }
}

// Глобальный экземпляр
window.Network = new Network();