// ui.js - Управление интерфейсом (ИСПРАВЛЕННАЯ ВЕРСИЯ)
class UI {
    static init() {
        this.setupEventListeners();
        this.showLobby();
        this.setupModals();
        this.initRoomCodeInput();
    }

    static setupEventListeners() {
        // Закрытие модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
        
        // Escape для закрытия модальных окон
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'flex') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
        
        // Ввод в чат по Enter
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }
    }

    static initRoomCodeInput() {
        const input = document.getElementById('room-code-input');
        if (input) {
            input.addEventListener('input', (e) => {
                // Автоматически преобразуем в верхний регистр
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                
                // Ограничиваем 6 символов
                if (e.target.value.length > 6) {
                    e.target.value = e.target.value.slice(0, 6);
                }
            });
        }
    }

    static setupModals() {
        // Кнопка отмены для модального окна превращения
        const promotionModal = document.getElementById('promotion-modal');
        const cancelBtn = promotionModal.querySelector('.btn-secondary');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                promotionModal.style.display = 'none';
                if (window.Game) {
                    window.Game.hidePromotionModal();
                }
            });
        }
    }

    static showLobby() {
        document.getElementById('lobby').style.display = 'block';
        document.getElementById('game-screen').style.display = 'none';
        
        document.getElementById('room-creation').style.display = 'none';
        document.getElementById('room-join').style.display = 'none';
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        if (window.Game) {
            window.Game.reset();
        }
        
        this.updateStatus('Создайте или присоединитесь к игре');
        
        // Очищаем чат при возвращении в лобби
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="chat-message system">Добро пожаловать в шахматы!</div>';
        }
    }

    static showGameScreen() {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
        
        this.updateStatus('Игра началась!');
    }

    static showRoomCreation() {
        // Показываем UI создания комнаты (код придет с сервера)
        document.getElementById('room-creation').style.display = 'block';
        document.getElementById('room-join').style.display = 'none';
        
        // НЕ генерируем код здесь - он придет с сервера
        // document.getElementById('room-code').textContent = '';
        
        this.updateStatus('Ожидание второго игрока...');
        
        // Скрываем кнопку "Начать игру" пока нет второго игрока
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.disabled = true;
        }
    }

    static showRoomJoin() {
        document.getElementById('room-join').style.display = 'block';
        document.getElementById('room-creation').style.display = 'none';
        
        const input = document.getElementById('room-code-input');
        if (input) {
            input.value = '';
            input.focus();
        }
        
        this.updateStatus('Введите код комнаты');
    }

    // Оставляем эту функцию для генерации кода, но не используем для комнат
    static generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    static showRoomCode(code) {
        const codeEl = document.getElementById('room-code');
        if (codeEl) {
            codeEl.textContent = code;
            codeEl.style.opacity = '1';
        }
    }

    static updateRoomPlayers(players) {
        const playersContainer = document.getElementById('room-players');
        if (!playersContainer) return;
        
        playersContainer.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerEl = document.createElement('div');
            playerEl.className = `player ${player.status === 'waiting' ? 'waiting' : ''}`;
            playerEl.id = `room-player-${index + 1}`;
            
            playerEl.innerHTML = `
                <i class="fas fa-${player.status === 'waiting' ? 'clock' : 'user'}"></i>
                <span class="player-name">${player.name}</span>
            `;
            
            playersContainer.appendChild(playerEl);
        });
        
        // Активируем кнопку "Начать игру" если есть два готовых игрока
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            const readyPlayers = players.filter(p => p.status !== 'waiting').length;
            startBtn.disabled = readyPlayers < 2;
            
            if (readyPlayers === 2) {
                startBtn.innerHTML = '<i class="fas fa-play"></i> Начать игру (2/2)';
            } else {
                startBtn.innerHTML = `<i class="fas fa-play"></i> Начать игру (${readyPlayers}/2)`;
            }
        }
    }

    static addChatMessage(message, player = 'Система') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${player === 'Система' ? 'system' : ''}`;
        
        if (player === 'Система') {
            messageEl.textContent = message;
        } else {
            messageEl.innerHTML = `<strong>${player}:</strong> ${message}`;
        }
        
        chatMessages.appendChild(messageEl);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Ограничиваем историю сообщений
        const messages = chatMessages.querySelectorAll('.chat-message');
        if (messages.length > 100) {
            messages[0].remove();
        }
    }

    static sendChatMessage() {
        const input = document.getElementById('chat-input-field');
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        if (window.Network && window.Network.sendChat) {
            window.Network.sendChat(message);
        }
        
        input.value = '';
        input.focus();
    }

    static showMessage(text, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${text}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    static updateStatus(message) {
        const statusBar = document.getElementById('status-message');
        if (statusBar) {
            statusBar.textContent = message;
            
            // Убираем классы предыдущего статуса
            statusBar.className = '';
            
            if (message.includes('Ваш ход') || message.includes('Ходите')) {
                statusBar.classList.add('your-turn');
            } else if (message.includes('Ход противника')) {
                statusBar.classList.add('opponent-turn');
            }
        }
    }

    static updateOnlineStats(online, games) {
        const onlineCount = document.getElementById('online-count');
        const gamesCount = document.getElementById('games-count');
        
        if (onlineCount) onlineCount.textContent = online || 0;
        if (gamesCount) gamesCount.textContent = games || 0;
    }

    static updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = connected ? 'Подключено' : 'Отключено';
            statusEl.className = connected ? 'connected' : 'disconnected';
        }
    }

    static showDrawOffer(playerName) {
        const modal = document.getElementById('draw-offer-modal');
        const text = document.getElementById('draw-offer-text');
        
        if (text) text.textContent = `${playerName} предлагает ничью`;
        modal.style.display = 'flex';
    }

    static hideDrawOffer() {
        const modal = document.getElementById('draw-offer-modal');
        modal.style.display = 'none';
    }
}

// Экспорт глобальных функций для HTML
window.UI = UI;

// Глобальные функции для кнопок (ОБНОВЛЕННЫЕ)
window.startQuickGame = function() {
    if (window.Network && window.Network.findGame) {
        window.Network.findGame();
        UI.showMessage('Поиск соперника...', 'info');
    }
};

// ИСПРАВЛЕНА: создание комнаты
window.createPrivateRoom = function() {
    // Показываем UI сразу
    UI.showRoomCreation();
    
    // Отправляем запрос на сервер
    if (window.Network && window.Network.createRoom) {
        window.Network.createRoom();
        UI.showMessage('Создаем комнату...', 'info');
    } else {
        UI.showMessage('Ошибка: Network не инициализирован', 'error');
    }
};

window.joinPrivateRoom = function() {
    UI.showRoomJoin();
};

window.copyRoomCode = function() {
    const codeElement = document.getElementById('room-code');
    if (!codeElement) return;
    
    const code = codeElement.textContent;
    if (!code || code.length !== 6) {
        UI.showMessage('Код комнаты не сгенерирован', 'error');
        return;
    }
    
    navigator.clipboard.writeText(code)
        .then(() => UI.showMessage('Код скопирован!', 'success'))
        .catch(() => UI.showMessage('Ошибка копирования', 'error'));
};

window.startRoomGame = function() {
    const codeElement = document.getElementById('room-code');
    if (!codeElement) {
        UI.showMessage('Нет активной комнаты', 'error');
        return;
    }
    
    const code = codeElement.textContent;
    if (!code || code.length !== 6) {
        UI.showMessage('Неверный код комнаты', 'error');
        return;
    }
    
    if (window.Network && window.Network.startGame) {
        window.Network.startGame(code);
        UI.showMessage('Запускаем игру...', 'info');
    }
};

window.joinRoom = function() {
    const input = document.getElementById('room-code-input');
    if (!input) return;
    
    const code = input.value.toUpperCase().trim();
    if (code.length !== 6) {
        UI.showMessage('Код комнаты должен быть 6 символов', 'error');
        return;
    }
    
    if (window.Network && window.Network.joinRoom) {
        window.Network.joinRoom(code);
        UI.showMessage(`Присоединение к комнате ${code}...`, 'info');
    }
};

window.cancelJoin = function() {
    UI.showLobby();
};

window.closeRoom = function() {
    if (window.Network && window.Network.leaveGame) {
        window.Network.leaveGame();
    }
    UI.showLobby();
    UI.showMessage('Комната закрыта', 'info');
};

window.resign = function() {
    if (confirm('Вы уверены, что хотите сдаться?')) {
        if (window.Network && window.Network.resign) {
            window.Network.resign();
        }
        UI.showMessage('Вы сдались', 'info');
    }
};

window.offerDraw = function() {
    if (window.Network && window.Network.offerDraw) {
        window.Network.offerDraw();
        UI.showMessage('Предложение ничьей отправлено', 'info');
    }
};

window.acceptDraw = function() {
    UI.hideDrawOffer();
    if (window.Network && window.Network.acceptDraw) {
        window.Network.acceptDraw();
    }
    UI.showMessage('Ничья принята', 'success');
};

window.declineDraw = function() {
    UI.hideDrawOffer();
    if (window.Network && window.Network.declineDraw) {
        window.Network.declineDraw();
    }
    UI.showMessage('Ничья отклонена', 'warning');
};

window.leaveGame = function() {
    if (window.Network && window.Network.leaveGame) {
        window.Network.leaveGame();
    }
    UI.showLobby();
    UI.showMessage('Вы вышли из игры', 'info');
};

window.sendChatMessage = function() {
    UI.sendChatMessage();
};

window.returnToLobby = function() {
    UI.showLobby();
};

window.newGame = function() {
    if (window.Network && window.Network.newGame) {
        window.Network.newGame();
    }
};

window.rematch = function() {
    if (window.Network && window.Network.rematch) {
        window.Network.rematch();
    }
};

window.undoMove = function() {
    if (window.Game) {
        window.Game.undoMove();
    }
};

window.flipBoard = function() {
    if (window.Game) {
        window.Game.flipBoard();
    }
};

window.hidePromotionModal = function() {
    if (window.Game) {
        window.Game.hidePromotionModal();
    }
};