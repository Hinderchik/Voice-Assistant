// network.js - ПОЛНЫЙ КОД с Ably
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
        this.currentPlayers = [];
        
        // ТВОЙ КЛЮЧ Ably
        this.ABLY_KEY = '-qgbRg.fCTz8A:xjM5uUcs_P99MrAccfwdWPmEygx-q_vG-OtyunE-zfQ';
        
        setTimeout(() => this.init(), 1000);
    }
    
    init() {
        this.generatePlayerId();
        this.connectToAbly();
        this.setupGlobalHandlers();
    }
    
    generatePlayerId() {
        this.playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.playerName = `Игрок_${this.playerId.slice(-4)}`;
        
        try {
            const savedName = localStorage.getItem('chess_player_name');
            if (savedName) this.playerName = savedName;
        } catch(e) {}
    }
    
    connectToAbly() {
        console.log('🔗 Подключение к Ably...');
        
        // ВАЖНО: clientId обязателен для Presence
        this.ably = new Ably.Realtime({
            key: this.ABLY_KEY,
            clientId: this.playerId
        });
        
        this.ably.connection.on('connected', () => {
            console.log('✅ Подключено к Ably');
            this.updateStatus(true);
            this.subscribeToLobby();
            
            if (window.UI) {
                window.UI.addChatMessage('✅ Подключено к игровому серверу', 'Система');
                window.UI.updateOnlineStats(1, 0);
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
        
        // Входим в лобби
        this.lobbyChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            status: 'online'
        });
        
        // Слушаем кто заходит/выходит
        this.lobbyChannel.presence.subscribe('enter', (member) => {
            console.log('👤 Игрок онлайн:', member.data.playerName);
            this.updatePresenceCount();
        });
        
        this.lobbyChannel.presence.subscribe('leave', (member) => {
            console.log('👋 Игрок вышел:', member.data.playerName);
            this.updatePresenceCount();
        });
        
        // Получаем текущий список
        this.updatePresenceCount();
        
        // Слушаем общие сообщения
        this.lobbyChannel.subscribe('chat', (message) => {
            this.handleLobbyChat(message.data);
        });
    }
    
    updatePresenceCount() {
        if (!this.lobbyChannel) return;
        
        this.lobbyChannel.presence.get((err, members) => {
            if (!err && members && window.UI) {
                window.UI.updateOnlineStats(members.length, 0);
            }
        });
    }
    
    handleLobbyChat(data) {
        if (data.playerId !== this.playerId && window.UI) {
            window.UI.addChatMessage(data.message, data.playerName);
        }
    }
    
    updateStatus(connected) {
        if (window.UI && window.UI.updateConnectionStatus) {
            window.UI.updateConnectionStatus(connected);
        }
    }
    
    // ========== КОМНАТЫ ==========
    
    createRoom() {
        console.log('🏠 Создание комнаты...');
        
        const roomId = this.generateRoomCode();
        this.roomId = roomId;
        
        // Создаем канал комнаты
        this.roomChannel = this.ably.channels.get(`room:${roomId}`, {
            params: { clientId: this.playerId }
        });
        
        // Входим в комнату
        this.roomChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            isCreator: true,
            status: 'ready'
        });
        
        // Настраиваем подписки
        this.setupRoomSubscriptions();
        
        // Отправляем событие создания
        this.roomChannel.publish('room_created', {
            type: 'room_created',
            roomId: roomId,
            creatorId: this.playerId,
            creatorName: this.playerName,
            timestamp: Date.now()
        });
        
        // Обновляем UI
        if (window.UI) {
            window.UI.showRoomCode(roomId);
            window.UI.updateRoomPlayers([
                { name: this.playerName, status: 'ready' },
                { name: 'Ожидание...', status: 'waiting' }
            ]);
            window.UI.addChatMessage(`🏠 Комната ${roomId} создана`, 'Система');
            window.UI.addChatMessage('Отправьте код другу', 'Система');
            window.UI.showMessage(`Комната ${roomId} создана!`, 'success');
        }
        
        return roomId;
    }
    
    setupRoomSubscriptions() {
        if (!this.roomChannel) return;
        
        // Кто зашел в комнату
        this.roomChannel.presence.subscribe('enter', (member) => {
            console.log('👤 Игрок вошел в комнату:', member.data.playerName);
            this.updateRoomPlayers();
        });
        
        // Кто вышел из комнаты
        this.roomChannel.presence.subscribe('leave', (member) => {
            console.log('👋 Игрок вышел из комнаты:', member.data.playerName);
            this.updateRoomPlayers();
        });
        
        // Сообщения в комнате
        this.roomChannel.subscribe('chat', (message) => {
            this.handleRoomChat(message.data);
        });
        
        // Начало игры
        this.roomChannel.subscribe('game_start', (message) => {
            this.handleGameStart(message.data);
        });
    }
    
    updateRoomPlayers() {
        if (!this.roomChannel || !window.UI) return;
        
        this.roomChannel.presence.get((err, members) => {
            if (err || !members) return;
            
            const players = members.map(member => ({
                name: member.data.playerName,
                status: 'ready'
            }));
            
            window.UI.updateRoomPlayers(players);
            
            // Если есть 2 игрока - показываем сообщение
            if (players.length === 2 && window.UI.addChatMessage) {
                window.UI.addChatMessage('✅ Второй игрок присоединился!', 'Система');
                window.UI.addChatMessage('Создатель может начать игру', 'Система');
            }
        });
    }
    
    handleRoomChat(data) {
        if (data.playerId !== this.playerId && window.UI) {
            window.UI.addChatMessage(data.message, data.playerName);
        }
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
        this.roomChannel = this.ably.channels.get(`room:${roomCode}`, {
            params: { clientId: this.playerId }
        });
        
        // Пробуем войти
        this.roomChannel.presence.enter({
            playerId: this.playerId,
            playerName: this.playerName,
            isCreator: false,
            status: 'ready'
        }, (err) => {
            if (err) {
                console.error('❌ Ошибка входа в комнату:', err);
                if (window.UI) {
                    window.UI.showMessage('Комната не найдена', 'error');
                }
                this.roomId = null;
                this.roomChannel = null;
                return;
            }
            
            console.log('✅ Успешно вошли в комнату');
            
            // Настраиваем подписки
            this.setupRoomSubscriptions();
            
            // Обновляем UI
            if (window.UI) {
                window.UI.showMessage(`Вы в комнате ${roomCode}!`, 'success');
                window.UI.addChatMessage(`✅ Вы присоединились к комнате ${roomCode}`, 'Система');
                
                // Скрываем форму ввода
                document.getElementById('room-join').style.display = 'none';
                
                // Показываем интерфейс комнаты
                document.getElementById('room-creation').style.display = 'block';
                document.getElementById('room-code').textContent = roomCode;
                
                // Обновляем список игроков
                this.updateRoomPlayers();
            }
        });
        
        return true;
    }
    
    startGame() {
        if (!this.roomId || !this.roomChannel) {
            console.error('❌ Нет активной комнаты');
            return;
        }
        
        console.log('🚀 Начинаем игру в комнате:', this.roomId);
        
        // Получаем игроков в комнате
        this.roomChannel.presence.get((err, members) => {
            if (err || !members || members.length !== 2) {
                console.error('❌ Нужно 2 игрока для начала игры');
                if (window.UI) {
                    window.UI.showMessage('Нужно 2 игрока для начала игры', 'error');
                }
                return;
            }
            
            // Создаем ID игры
            this.gameId = `game_${Date.now()}_${this.roomId}`;
            
            // Определяем цвета
            const player1Color = Math.random() > 0.5 ? 'w' : 'b';
            const player2Color = player1Color === 'w' ? 'b' : 'w';
            
            // Отправляем событие начала игры ВСЕМ в комнате
            members.forEach((member, index) => {
                const isPlayer1 = index === 0;
                const opponent = members[1 - index];
                
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
            
            // Создаем игровой канал
            this.gameChannel = this.ably.channels.get(`game:${this.gameId}`, {
                params: { clientId: this.playerId }
            });
            
            // Настраиваем игровые подписки
            this.setupGameSubscriptions();
            
            console.log('🎮 Игра создана:', this.gameId);
        });
    }
    
    handleGameStart(data) {
        if (data.playerId === this.playerId) {
            console.log('🎮 Начинаем игру (мы):', data);
            
            this.gameId = data.gameId;
            
            // Создаем игровой канал если еще не создан
            if (!this.gameChannel) {
                this.gameChannel = this.ably.channels.get(`game:${data.gameId}`, {
                    params: { clientId: this.playerId }
                });
                this.setupGameSubscriptions();
            }
            
            // Запускаем игру
            if (window.Game && window.Game.startGame) {
                window.Game.startGame({
                    gameId: data.gameId,
                    color: data.color,
                    opponent: data.opponent,
                    timeControl: data.timeControl
                });
            }
            
            // Показываем игровой экран
            if (window.UI) {
                window.UI.showGameScreen();
                const colorText = data.color === 'w' ? 'белыми' : 'черными';
                window.UI.addChatMessage(`🎮 Игра началась! Вы играете ${colorText}`, 'Система');
                window.UI.addChatMessage(`Противник: ${data.opponent}`, 'Система');
            }
            
            // Выходим из комнатного канала
            if (this.roomChannel) {
                this.roomChannel.presence.leave();
                this.roomChannel = null;
                this.roomId = null;
            }
        }
    }
    
    setupGameSubscriptions() {
        if (!this.gameChannel) return;
        
        // Ходы
        this.gameChannel.subscribe('move', (message) => {
            this.handleGameMove(message.data);
        });
        
        // Чат в игре
        this.gameChannel.subscribe('chat', (message) => {
            this.handleGameChat(message.data);
        });
        
        // Результат игры
        this.gameChannel.subscribe('game_over', (message) => {
            this.handleGameOver(message.data);
        });
        
        // Предложение ничьей
        this.gameChannel.subscribe('draw_offer', (message) => {
            this.handleDrawOffer(message.data);
        });
    }
    
    // ========== ИГРОВЫЕ ДЕЙСТВИЯ ==========
    
    sendMove(move) {
        if (!this.gameId || !this.gameChannel) {
            console.warn('⚠️ Нет активной игры для хода');
            return;
        }
        
        console.log('📤 Отправка хода:', move);
        
        this.gameChannel.publish('move', {
            type: 'move',
            playerId: this.playerId,
            gameId: this.gameId,
            move: move,
            timestamp: Date.now()
        });
    }
    
    handleGameMove(data) {
        console.log('📨 Получен ход:', data);
        
        if (data.playerId !== this.playerId && window.Game && window.Game.applyMove) {
            window.Game.applyMove(data.move);
        }
    }
    
    sendChat(message) {
        let channel = this.gameChannel || this.roomChannel || this.lobbyChannel;
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
    
    handleGameOver(data) {
        if (window.Game && window.Game.handleGameOver) {
            window.Game.handleGameOver(data);
        }
        
        // Выходим из игрового канала
        if (this.gameChannel) {
            this.gameChannel.presence.leave();
            this.gameChannel = null;
            this.gameId = null;
        }
    }
    
    handleDrawOffer(data) {
        if (window.UI && data.playerId !== this.playerId) {
            window.UI.showDrawOffer(data.playerName);
        }
    }
    
    // ========== ДЕЙСТВИЯ ИГРОКА ==========
    
    resign() {
        if (!this.gameId || !this.gameChannel) return;
        
        this.gameChannel.publish('resign', {
            type: 'resign',
            playerId: this.playerId,
            gameId: this.gameId
        });
        
        if (window.UI) {
            window.UI.showMessage('Вы сдались', 'info');
        }
    }
    
    offerDraw() {
        if (!this.gameId || !this.gameChannel) return;
        
        this.gameChannel.publish('draw_offer', {
            type: 'draw_offer',
            playerId: this.playerId,
            gameId: this.gameId
        });
        
        if (window.UI) {
            window.UI.showMessage('Предложение ничьей отправлено', 'info');
        }
    }
    
    acceptDraw() {
        if (!this.gameId || !this.gameChannel) return;
        
        this.gameChannel.publish('draw_accepted', {
            type: 'draw_accepted',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }
    
    declineDraw() {
        if (!this.gameId || !this.gameChannel) return;
        
        this.gameChannel.publish('draw_declined', {
            type: 'draw_declined',
            playerId: this.playerId,
            gameId: this.gameId
        });
    }
    
    leaveGame() {
        // Выходим из всех каналов
        if (this.gameChannel) {
            this.gameChannel.publish('player_left', {
                type: 'player_left',
                playerId: this.playerId,
                gameId: this.gameId
            });
            this.gameChannel.presence.leave();
            this.gameChannel = null;
            this.gameId = null;
        }
        
        if (this.roomChannel) {
            this.roomChannel.presence.leave();
            this.roomChannel = null;
            this.roomId = null;
        }
        
        if (window.Game && window.Game.reset) {
            window.Game.reset();
        }
        
        if (window.UI) {
            window.UI.showMessage('Вы вышли из игры', 'info');
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
    
    setupGlobalHandlers() {
        // Для отладки
        window.debugNetwork = () => {
            console.log('=== NETWORK DEBUG ===');
            console.log('Player:', this.playerId, this.playerName);
            console.log('Room:', this.roomId);
            console.log('Game:', this.gameId);
            console.log('Ably connected:', this.ably?.connection.state);
            console.log('==================');
        };
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

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ UI ==========

window.createPrivateRoom = function() {
    if (window.Network && window.Network.createRoom) {
        window.Network.createRoom();
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

window.copyRoomCode = function() {
    const codeElement = document.getElementById('room-code');
    if (!codeElement) return;
    
    const code = codeElement.textContent;
    if (!code || code.length !== 6) {
        if (window.UI) window.UI.showMessage('Нет кода комнаты', 'error');
        return;
    }
    
    navigator.clipboard.writeText(code)
        .then(() => {
            if (window.UI) window.UI.showMessage('Код скопирован!', 'success');
        })
        .catch(() => {
            if (window.UI) window.UI.showMessage('Ошибка копирования', 'error');
        });
};

// Автоматическая инициализация UI
document.addEventListener('DOMContentLoaded', () => {
    console.log('♟️ Chess Online загружен');
    
    // Даем время на инициализацию Network
    setTimeout(() => {
        if (window.UI && window.UI.init) {
            window.UI.init();
        }
    }, 1500);
});