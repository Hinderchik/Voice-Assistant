// api/chess.js - Serverless функция для Pusher
import Pusher from 'pusher';

// Инициализация Pusher
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

// Хранилище в памяти (в продакшене используй Redis)
const games = new Map();
const players = new Map();
const rooms = new Map();
const matchmakingQueue = [];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { event, playerId, playerName, gameId, roomId, ...data } = req.body;

        // Сохраняем/обновляем информацию об игроке
        players.set(playerId, {
            id: playerId,
            name: playerName,
            gameId,
            roomId,
            lastSeen: Date.now()
        });

        // Обработка событий
        switch (event) {
            case 'player_online':
                await handlePlayerOnline(playerId, playerName);
                break;
                
            case 'find_game':
                await handleFindGame(playerId, playerName);
                break;
                
            case 'create_room':
                await handleCreateRoom(playerId, playerName);
                break;
                
            case 'join_room':
                await handleJoinRoom(playerId, playerName, data.roomCode);
                break;
                
            case 'start_game':
                await handleStartGame(playerId, playerName, roomId);
                break;
                
            case 'make_move':
                await handleMakeMove(playerId, gameId, data.move);
                break;
                
            case 'send_chat':
                await handleSendChat(playerId, gameId, data.message);
                break;
                
            case 'resign':
                await handleResign(playerId, gameId);
                break;
                
            case 'offer_draw':
                await handleOfferDraw(playerId, gameId);
                break;
        }

        // Отправляем обновленную статистику
        await sendStats();

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Ошибка обработки запроса:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Обработчики событий
async function handlePlayerOnline(playerId, playerName) {
    // Уведомляем других игроков о новом подключении
    await pusher.trigger('presence-chess-lobby', 'player_joined', {
        playerId,
        playerName,
        timestamp: Date.now()
    });
}

async function handleFindGame(playerId, playerName) {
    // Добавляем в очередь матчмейкинга
    if (!matchmakingQueue.includes(playerId)) {
        matchmakingQueue.push(playerId);
    }

    // Если в очереди есть хотя бы 2 игрока, создаем игру
    if (matchmakingQueue.length >= 2) {
        const player1Id = matchmakingQueue.shift();
        const player2Id = matchmakingQueue.shift();
        
        const player1 = players.get(player1Id);
        const player2 = players.get(player2Id);
        
        if (player1 && player2) {
            await createGame(player1, player2);
        }
    }
}

async function handleCreateRoom(playerId, playerName) {
    const roomId = generateRoomCode();
    const room = {
        id: roomId,
        creator: playerId,
        players: [playerId],
        status: 'waiting',
        createdAt: Date.now()
    };
    
    rooms.set(roomId, room);
    
    // Обновляем информацию об игроке
    const player = players.get(playerId);
    if (player) {
        player.roomId = roomId;
        players.set(playerId, player);
    }
    
    // Отправляем код комнаты создателю
    await pusher.trigger(`private-${playerId}`, 'room_created', {
        roomId,
        playerName
    });
}

async function handleJoinRoom(playerId, playerName, roomCode) {
    const room = rooms.get(roomCode);
    if (!room) {
        await pusher.trigger(`private-${playerId}`, 'error', {
            message: 'Комната не найдена'
        });
        return;
    }
    
    if (room.players.length >= 2) {
        await pusher.trigger(`private-${playerId}`, 'error', {
            message: 'Комната заполнена'
        });
        return;
    }
    
    room.players.push(playerId);
    
    // Обновляем информацию об игроке
    const player = players.get(playerId);
    if (player) {
        player.roomId = roomCode;
        players.set(playerId, player);
    }
    
    // Уведомляем создателя комнаты
    await pusher.trigger(`private-${room.creator}`, 'player_joined', {
        playerId,
        playerName
    });
    
    // Уведомляем присоединившегося
    await pusher.trigger(`private-${playerId}`, 'room_joined', {
        roomId: roomCode,
        creatorName: players.get(room.creator)?.name || 'Создатель'
    });
}

async function handleStartGame(playerId, playerName, roomId) {
    const room = rooms.get(roomId);
    if (!room || room.creator !== playerId) {
        await pusher.trigger(`private-${playerId}`, 'error', {
            message: 'Только создатель комнаты может начать игру'
        });
        return;
    }
    
    if (room.players.length !== 2) {
        await pusher.trigger(`private-${playerId}`, 'error', {
            message: 'Нужно два игрока для начала игры'
        });
        return;
    }
    
    const player1 = players.get(room.players[0]);
    const player2 = players.get(room.players[1]);
    
    if (!player1 || !player2) {
        await pusher.trigger(`private-${playerId}`, 'error', {
            message: 'Один из игроков отключился'
        });
        return;
    }
    
    await createGame(player1, player2, roomId);
}

async function createGame(player1, player2, roomId = null) {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Определяем цвета
    const player1Color = Math.random() > 0.5 ? 'w' : 'b';
    const player2Color = player1Color === 'w' ? 'b' : 'w';
    
    const game = {
        id: gameId,
        player1: {
            id: player1.id,
            name: player1.name,
            color: player1Color
        },
        player2: {
            id: player2.id,
            name: player2.name,
            color: player2Color
        },
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [],
        status: 'active',
        timeControl: { white: 600, black: 600 },
        createdAt: Date.now()
    };
    
    games.set(gameId, game);
    
    // Обновляем информацию об игроках
    player1.gameId = gameId;
    player2.gameId = gameId;
    players.set(player1.id, player1);
    players.set(player2.id, player2);
    
    // Если была комната, удаляем ее
    if (roomId) {
        rooms.delete(roomId);
    }
    
    // Отправляем игрокам информацию о начале игры
    await pusher.trigger(`private-${player1.id}`, 'game_start', {
        gameId,
        color: player1Color,
        opponent: player2.name,
        timeControl: game.timeControl
    });
    
    await pusher.trigger(`private-${player2.id}`, 'game_start', {
        gameId,
        color: player2Color,
        opponent: player1.name,
        timeControl: game.timeControl
    });
    
    // Также отправляем в игровой канал для наблюдателей
    await pusher.trigger(`private-game-${gameId}`, 'game_start', {
        gameId,
        player1: player1.name,
        player2: player2.name,
        timeControl: game.timeControl
    });
}

async function handleMakeMove(playerId, gameId, move) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Проверяем, что ход делает текущий игрок
    const currentPlayer = game.fen.includes(' w ') ? game.player1 : game.player2;
    if (currentPlayer.id !== playerId) return;
    
    // Сохраняем ход
    game.moves.push({
        playerId,
        move,
        timestamp: Date.now()
    });
    
    // Обновляем FEN (в реальном приложении нужно использовать chess.js)
    // Здесь упрощенная логика
    
    // Отправляем ход другому игроку
    const opponentId = game.player1.id === playerId ? game.player2.id : game.player1.id;
    
    await pusher.trigger(`private-${opponentId}`, 'move_made', {
        gameId,
        move,
        fen: game.fen
    });
    
    // Также отправляем в игровой канал
    await pusher.trigger(`private-game-${gameId}`, 'move_made', {
        gameId,
        playerId,
        move,
        fen: game.fen
    });
}

async function handleSendChat(playerId, gameId, message) {
    const game = games.get(gameId);
    if (!game) return;
    
    const player = players.get(playerId);
    if (!player) return;
    
    await pusher.trigger(`private-game-${gameId}`, 'chat_message', {
        gameId,
        playerId,
        playerName: player.name,
        message,
        timestamp: Date.now()
    });
}

async function handleResign(playerId, gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    const resigningPlayer = game.player1.id === playerId ? game.player1 : game.player2;
    const winner = game.player1.id === playerId ? game.player2 : game.player1;
    
    game.status = 'finished';
    game.result = `${winner.name} победил, ${resigningPlayer.name} сдался`;
    
    await pusher.trigger(`private-game-${gameId}`, 'game_over', {
        gameId,
        result: game.result,
        winner: winner.name
    });
    
    // Очищаем игру у игроков
    [game.player1.id, game.player2.id].forEach(id => {
        const player = players.get(id);
        if (player) {
            player.gameId = null;
            players.set(id, player);
        }
    });
    
    games.delete(gameId);
}

async function handleOfferDraw(playerId, gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    const offeringPlayer = game.player1.id === playerId ? game.player1 : game.player2;
    const opponentId = game.player1.id === playerId ? game.player2.id : game.player1.id;
    
    await pusher.trigger(`private-${opponentId}`, 'draw_offered', {
        gameId,
        playerName: offeringPlayer.name
    });
}

async function sendStats() {
    const stats = {
        online: players.size,
        games: Array.from(games.values()).filter(g => g.status === 'active').length,
        rooms: rooms.size,
        timestamp: Date.now()
    };
    
    await pusher.trigger('presence-chess-lobby', 'stats_update', stats);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}