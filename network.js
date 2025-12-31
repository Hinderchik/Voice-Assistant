// network-ably.js - ПОЛНЫЙ РАБОЧИЙ КОД
class Network {
    constructor() {
        this.playerId = null;
        this.playerName = null;
        this.roomId = null;
        this.gameId = null;
        this.ably = null;
        this.lobbyChannel = null;
        this.roomChannel = null;
        this.gameChannel = null;
        
        // API ключ Ably - ЗАМЕНИ НА СВОЙ!
        this.ABLY_KEY = '-qgbRg.fCTz8A:xjM5uUcs_P99MrAccfwdWPmEygx-q_vG-OtyunE-zfQ'; 
        
        // Автоинициализация
        setTimeout(() => this.init(), 1000);
    }
    
    init() {
        this.generatePlayerId();
        this.connectToAbly();
    }
    
    generatePlayerId() {
        this.playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            this.playerName = localStorage.getItem('chess_player_name') || 
                             `Игрок_${this.playerId.slice(-4)}`;
        } catch(e) {
            this.playerName = `Игрок_${this.playerId.slice(-4)}`;
        }
    }
    
    connectToAbly() {
        console.log('🔗 Подключение к Ably...');
        
        this.ably = new Ably.Realtime(this.ABLY_KEY);
        
        this.ably.connection.on('connected', () => {
            console.log('✅ Подключено к Ably');
            this.updateStatus(true);
            
            // Подписываемся на лобби
            this.subscribeToLobby();
            
            if (window.UI) {
                window.UI.addChatMessage('✅ Подключено к игровому серверу', 'Система');
            }
        });
        
        this.ably.connection.on('disconnected', () => {
            console.log('❌ Отключено от Ably');
            this.updateStatus(false);
        });
        
        this.ably.connection.on('failed', () => {
            console.error('💥 Ошибка подключения к Ably');
            this.updateStatus(false);
        });
    }
    
    subscribeToLobby() {
        this.lobbyChannel = this.ably.channels.get('chess-lobby');
        
        // Входим в presence как игрок
        this.lobbyChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            status: 'online'
        });
        
        // Следим за другими игроками
        this.lobbyChannel.presence.subscribe('enter', (member) => {
            console.log('👤 Игрок онлайн:', member.data.playerName);
            this.updateOnlineCount();
        });
        
        this.lobbyChannel.presence.subscribe('leave', (member) => {
            console.log('👋 Игрок вышел:', member.data.playerName);
            this.updateOnlineCount();
        });
    }
    
    updateOnlineCount() {
        this.lobbyChannel.presence.get((err, members) => {
            if (!err && members && window.UI) {
                window.UI.updateOnlineStats(members.length, 0);
            }
        });
    }
    
    updateStatus(connected) {
        if (window.UI && window.UI.updateConnectionStatus) {
            window.UI.updateConnectionStatus(connected);
        }
    }
    
    // ========== РАБОТА С КОМНАТАМИ ==========
    
    createRoom() {
        console.log('🏠 Создание комнаты...');
        
        // Генерируем код комнаты
        const roomId = this.generateRoomCode();
        this.roomId = roomId;
        
        // Создаем канал для комнаты
        this.roomChannel = this.ably.channels.get(`room:${roomId}`);
        
        // Входим в комнату
        this.roomChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            isCreator: true,
            status: 'ready'
        });
        
        // Подписываемся на обновления комнаты
        this.roomChannel.subscribe('room_update', (message) => {
            this.handleRoomUpdate(message.data);
        });
        
        // Отправляем событие создания комнаты
        this.roomChannel.publish('room_created', {
            type: 'room_created',
            roomId,
            creator: this.playerId,
            playerName: this.playerName,
            timestamp: Date.now()
        });
        
        // Показываем UI
        if (window.UI) {
            window.UI.showRoomCode(roomId);
            window.UI.updateRoomPlayers([
                { name: this.playerName, status: 'ready' },
                { name: 'Ожидание...', status: 'waiting' }
            ]);
            window.UI.addChatMessage(`🏠 Комната ${roomId} создана`, 'Система');
        }
        
        return roomId;
    }
    
    joinRoom(roomCode) {
        console.log('🔑 Присоединение к комнате:', roomCode);
        
        if (!roomCode || roomCode.length !== 6) {
            if (window.UI) {
                window.UI.showMessage('❌ Код комнаты должен быть 6 символов', 'error');
            }
            return false;
        }
        
        this.roomId = roomCode;
        this.roomChannel = this.ably.channels.get(`room:${roomCode}`);
        
        // Пытаемся войти в presence комнаты
        this.roomChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            isCreator: false,
            status: 'ready'
        }, (err) => {
            if (err) {
                console.error('❌ Ошибка входа в комнату:', err);
                if (window.UI) {
                    window.UI.showMessage('Комната не найдена или заполнена', 'error');
                }
                return;
            }
            
            console.log('✅ Вошли в комнату');
            
            // Подписываемся на обновления
            this.roomChannel.subscribe('room_update', (message) => {
                this.handleRoomUpdate(message.data);
            });
            
            // Отправляем событие что присоединились
            this.roomChannel.publish('player_joined', {
                type: 'player_joined',
                playerId: this.playerId,
                playerName: this.playerName,
                roomId: roomCode,
                timestamp: Date.now()
            });
            
            if (window.UI) {
                window.UI.addChatMessage(`✅ Присоединились к комнате ${roomCode}`, 'Система');
                window.UI.showMessage('Вы в комнате!', 'success');
                
                // Скрываем форму ввода
                document.getElementById('room-join').style.display = 'none';
                
                // Показываем интерфейс комнаты
                document.getElementById('room-creation').style.display = 'block';
                document.getElementById('room-code').textContent = roomCode;
            }
        });
        
        return true;
    }
    
    handleRoomUpdate(data) {
        console.log('🔄 Обновление комнаты:', data);
        
        if (data.type === 'player_joined' && window.UI) {
            // Получаем список игроков в комнате
            this.roomChannel.presence.get((err, members) => {
                if (!err && members) {
                    const players = members.map(member => ({
                        name: member.data.playerName,
                        status: 'ready'
                    }));
                    
                    window.UI.updateRoomPlayers(players);
                    
                    if (players.length === 2) {
                        window.UI.addChatMessage('✅ Второй игрок присоединился!', 'Система');
                        window.UI.addChatMessage('Создатель может начать игру', 'Система');
                    }
                }
            });
        }
    }
    
    startGame() {
        if (!this.roomId) {
            console.error('❌ Нет активной комнаты');
            return;
        }
        
        console.log('🚀 Начало игры в комнате:', this.roomId);
        
        // Создаем ID игры
        this.gameId = `game_${Date.now()}_${this.roomId}`;
        
        // Получаем игроков в комнате
        this.roomChannel.presence.get((err, members) => {
            if (err || !members || members.length !== 2) {
                console.error('❌ Нужно 2 игрока');
                return;
            }
            
            // Определяем цвета
            const player1Color = Math.random() > 0.5 ? 'w' : 'b';
            const player2Color = player1Color === 'w' ? 'b' : 'w';
            
            // Создаем игровой канал
            this.gameChannel = this.ably.channels.get(`game:${this.gameId}`);
            
            // Уведомляем игроков
            members.forEach((member, index) => {
                const isPlayer1 = index === 0;
                const opponentIndex = 1 - index;
                const opponent = members[opponentIndex];
                
                // Отправляем через room channel чтобы все получили
                this.roomChannel.publish('game_start', {
                    type: 'game_start',
                    gameId: this.gameId,
                    playerId: member.data.playerId,
                    color: isPlayer1 ? player1Color : player2Color,
                    opponent: opponent.data.playerName,
                    timeControl: { white: 600, black: 600 },
                    timestamp: Date.now()
                });
            });
            
            // Подписываемся на игровой канал
            this.gameChannel.subscribe('move', (message) => {
                this.handleGameMove(message.data);
            });
            
            this.gameChannel.subscribe('chat', (message) => {
                this.handleGameChat(message.data);
            });
        });
    }
    
    handleGameStart(data) {
        if (data.playerId === this.playerId) {
            console.log('🎮 Начинаем игру:', data);
            
            this.gameId = data.gameId;
            this.roomId = null;
            
            if (window.Game && window.Game.startGame) {
                window.Game.startGame({
                    gameId: data.gameId,
                    color: data.color,
                    opponent: data.opponent,
                    timeControl: data.timeControl
                });
            }
            
            if (window.UI) {
                window.UI.showGameScreen();
                const colorText = data.color === 'w' ? 'белыми' : 'черными';
                window.UI.addChatMessage(`🎮 Игра началась! Вы играете ${colorText}`, 'Система');
                window.UI.addChatMessage(`Противник: ${data.opponent}`, 'Система');
            }
            
            // Выходим из комнатного канала
            if (this.roomChannel) {
                this.roomChannel.presence.leave();
            }
        }
    }
    
    // ========== ИГРОВЫЕ ДЕЙСТВИЯ ==========
    
    sendMove(move) {
        if (!this.gameId || !this.gameChannel) {
            console.warn('⚠️ Нет активной игры');
            return;
        }
        
        this.gameChannel.publish('move', {
            type: 'move',
            playerId: this.playerId,
            gameId: this.gameId,
            move: move,
            timestamp: Date.now()
        });
    }
    
    handleGameMove(data) {
        if (data.playerId !== this.playerId && window.Game && window.Game.applyMove) {
            window.Game.applyMove(data.move);
        }
    }
    
    sendChat(message) {
        const channel = this.gameChannel || this.roomChannel || this.lobbyChannel;
        if (!channel) return;
        
        channel.publish('chat', {
            type: 'chat',
            playerId: this.playerId,
            playerName: this.playerName,
            message: message,
            timestamp: Date.now()
        });
    }
    
    handleGameChat(data) {
        if (window.UI && data.playerId !== this.playerId) {
            window.UI.addChatMessage(data.message, data.playerName);
        }
    }
    
    // ========== УТИЛИТЫ ==========
    
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========
    
    findGame() {
        // Пока не реализовано - можно добавить matchmaking канал
        console.log('🔍 Поиск игры (не реализовано)');
        if (window.UI) {
            window.UI.showMessage('Быстрая игра пока не работает', 'info');
        }
    }
    
    resign() {
        if (!this.gameId) return;
        
        if (this.gameChannel) {
            this.gameChannel.publish('resign', {
                type: 'resign',
                playerId: this.playerId,
                gameId: this.gameId
            });
        }
    }
    
    offerDraw() {
        if (!this.gameId) return;
        
        if (this.gameChannel) {
            this.gameChannel.publish('draw_offer', {
                type: 'draw_offer',
                playerId: this.playerId,
                gameId: this.gameId
            });
        }
    }
    
    leaveGame() {
        if (this.gameId) {
            this.gameId = null;
            if (this.gameChannel) {
                this.gameChannel.presence.leave();
                this.gameChannel = null;
            }
        }
        
        if (window.Game && window.Game.reset) {
            window.Game.reset();
        }
    }
    
    disconnect() {
        // Выходим из всех каналов
        if (this.lobbyChannel) this.lobbyChannel.presence.leave();
        if (this.roomChannel) this.roomChannel.presence.leave();
        if (this.gameChannel) this.gameChannel.presence.leave();
        
        if (this.ably) {
            this.ably.close();
        }
    }
}

// Глобальный экземпляр
window.Network = new Network();

// Глобальные функции для UI
window.createPrivateRoom = function() {
    if (window.Network && window.Network.createRoom) {
        const roomId = window.Network.createRoom();
        if (window.UI) {
            window.UI.showRoomCreation();
        }
    }
};

window.joinPrivateRoom = function() {
    if (window.UI) window.UI.showRoomJoin();
};

window.joinRoom = function() {
    const input = document.getElementById('room-code-input');
    if (!input) return;
    
    const code = input.value.toUpperCase().trim();
    if (window.Network) {
        window.Network.joinRoom(code);
    }
};

window.startRoomGame = function() {
    if (window.Network && window.Network.startGame) {
        window.Network.startGame();
    }
};

// Обработчики для Ably событий
document.addEventListener('DOMContentLoaded', () => {
    // Подписываемся на события когда Network готов
    setTimeout(() => {
        if (window.Network && window.Network.ably) {
            // Подписка на события через глобальные обработчики
            const network = window.Network;
            
            // Обработка начала игры
            if (network.roomChannel) {
                network.roomChannel.subscribe('game_start', (message) => {
                    network.handleGameStart(message.data);
                });
            }
            
            // Обработка чата
            const lobbyChannel = network.ably.channels.get('chess-lobby');
            lobbyChannel.subscribe('chat', (message) => {
                if (window.UI && message.data.playerId !== network.playerId) {
                    window.UI.addChatMessage(message.data.message, message.data.playerName);
                }
            });
        }
        
        if (window.UI && window.UI.init) {
            window.UI.init();
        }
    }, 2000);
});