// api/ws.js - WebSocket сервер на Cloudflare Workers
import { DurableObject } from 'cloudflare:workers';

// Durable Object для управления игровыми комнатами
export class ChessGameDO extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.players = new Map();
    this.games = new Map();
    this.rooms = new Map();
    this.matchmakingQueue = [];
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      await this.handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  async handleMessage(ws, data) {
    const { type, playerId, playerName, ...payload } = data;

    switch (type) {
      case 'connect':
        await this.handleConnect(ws, playerId, playerName);
        break;
      case 'find_game':
        await this.handleFindGame(playerId, playerName);
        break;
      case 'create_room':
        await this.handleCreateRoom(playerId, playerName);
        break;
      case 'join_room':
        await this.handleJoinRoom(playerId, playerName, payload.roomCode);
        break;
      case 'start_game':
        await this.handleStartGame(playerId, payload.roomId);
        break;
      case 'make_move':
        await this.handleMakeMove(playerId, payload.gameId, payload.move);
        break;
      case 'send_chat':
        await this.handleSendChat(playerId, payload.gameId, payload.message);
        break;
      case 'resign':
        await this.handleResign(playerId, payload.gameId);
        break;
      case 'offer_draw':
        await this.handleOfferDraw(playerId, payload.gameId);
        break;
      case 'accept_draw':
        await this.handleAcceptDraw(playerId, payload.gameId);
        break;
      case 'decline_draw':
        await this.handleDeclineDraw(playerId, payload.gameId);
        break;
      case 'ping':
        this.sendToPlayer(playerId, { type: 'pong', timestamp: Date.now() });
        break;
    }
  }

  async handleConnect(ws, playerId, playerName) {
    this.players.set(playerId, {
      ws,
      id: playerId,
      name: playerName || `Игрок_${playerId.slice(0, 4)}`,
      gameId: null,
      roomId: null,
      lastSeen: Date.now(),
      status: 'online'
    });

    this.broadcastToAll({ 
      type: 'player_online', 
      playerId, 
      playerName,
      online: this.players.size 
    });
  }

  async handleFindGame(playerId, playerName) {
    if (!this.matchmakingQueue.includes(playerId)) {
      this.matchmakingQueue.push(playerId);
      this.sendToPlayer(playerId, { type: 'matchmaking_started' });
    }

    if (this.matchmakingQueue.length >= 2) {
      const player1Id = this.matchmakingQueue.shift();
      const player2Id = this.matchmakingQueue.shift();
      
      await this.createGame(player1Id, player2Id);
    }
  }

  async handleCreateRoom(playerId, playerName) {
    const roomId = this.generateRoomCode();
    const room = {
      id: roomId,
      creator: playerId,
      players: [playerId],
      status: 'waiting',
      createdAt: Date.now()
    };
    
    this.rooms.set(roomId, room);
    
    const player = this.players.get(playerId);
    if (player) {
      player.roomId = roomId;
    }
    
    this.sendToPlayer(playerId, {
      type: 'room_created',
      roomId,
      players: room.players.map(id => ({
        id,
        name: this.players.get(id)?.name || 'Игрок'
      }))
    });
  }

  async handleJoinRoom(playerId, playerName, roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      this.sendToPlayer(playerId, { 
        type: 'error', 
        message: 'Комната не найдена' 
      });
      return;
    }
    
    if (room.players.length >= 2) {
      this.sendToPlayer(playerId, { 
        type: 'error', 
        message: 'Комната заполнена' 
      });
      return;
    }
    
    room.players.push(playerId);
    
    const player = this.players.get(playerId);
    if (player) {
      player.roomId = roomCode;
    }
    
    // Уведомляем всех игроков в комнате
    room.players.forEach(playerId => {
      this.sendToPlayer(playerId, {
        type: 'room_updated',
        roomId: roomCode,
        players: room.players.map(id => ({
          id,
          name: this.players.get(id)?.name || 'Игрок',
          isCreator: id === room.creator
        }))
      });
    });
  }

  async handleStartGame(playerId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.creator !== playerId) {
      this.sendToPlayer(playerId, { 
        type: 'error', 
        message: 'Только создатель комнаты может начать игру' 
      });
      return;
    }
    
    if (room.players.length !== 2) {
      this.sendToPlayer(playerId, { 
        type: 'error', 
        message: 'Нужно два игрока для начала игры' 
      });
      return;
    }
    
    await this.createGame(room.players[0], room.players[1], roomId);
    
    // Удаляем комнату после создания игры
    this.rooms.delete(roomId);
  }

  async createGame(player1Id, player2Id, roomId = null) {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const player1Color = Math.random() > 0.5 ? 'w' : 'b';
    const player2Color = player1Color === 'w' ? 'b' : 'w';
    
    const game = {
      id: gameId,
      player1: {
        id: player1Id,
        name: this.players.get(player1Id)?.name || 'Игрок 1',
        color: player1Color
      },
      player2: {
        id: player2Id,
        name: this.players.get(player2Id)?.name || 'Игрок 2',
        color: player2Color
      },
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
      status: 'active',
      timeControl: { white: 600, black: 600 },
      createdAt: Date.now(),
      turn: 'w'
    };
    
    this.games.set(gameId, game);
    
    // Обновляем информацию об игроках
    [player1Id, player2Id].forEach(id => {
      const player = this.players.get(id);
      if (player) {
        player.gameId = gameId;
        player.roomId = null;
      }
    });
    
    // Отправляем игрокам информацию о начале игры
    this.sendToPlayer(player1Id, {
      type: 'game_start',
      gameId,
      color: player1Color,
      opponent: game.player2.name,
      timeControl: game.timeControl,
      isMyTurn: player1Color === 'w'
    });
    
    this.sendToPlayer(player2Id, {
      type: 'game_start',
      gameId,
      color: player2Color,
      opponent: game.player1.name,
      timeControl: game.timeControl,
      isMyTurn: player2Color === 'w'
    });
  }

  async handleMakeMove(playerId, gameId, move) {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') return;
    
    // Проверяем, чей сейчас ход
    const currentColor = game.turn;
    const currentPlayer = currentColor === 'w' ? game.player1 : game.player2;
    
    if (currentPlayer.id !== playerId) return;
    
    // Сохраняем ход
    game.moves.push({
      playerId,
      move,
      timestamp: Date.now()
    });
    
    // Меняем очередь
    game.turn = currentColor === 'w' ? 'b' : 'w';
    
    // Отправляем ход другому игроку
    const opponentId = currentPlayer.id === game.player1.id ? game.player2.id : game.player1.id;
    
    this.sendToPlayer(opponentId, {
      type: 'move_made',
      gameId,
      move,
      fen: game.fen,
      isMyTurn: true
    });
    
    // Также отправляем обратно подтверждение
    this.sendToPlayer(playerId, {
      type: 'move_confirmed',
      gameId,
      move,
      fen: game.fen,
      isMyTurn: false
    });
  }

  async handleSendChat(playerId, gameId, message) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const player = this.players.get(playerId);
    if (!player) return;
    
    // Отправляем сообщение всем игрокам в игре
    [game.player1.id, game.player2.id].forEach(id => {
      if (id !== playerId) {
        this.sendToPlayer(id, {
          type: 'chat_message',
          gameId,
          playerId,
          playerName: player.name,
          message,
          timestamp: Date.now()
        });
      }
    });
    
    // И себе тоже (для синхронизации)
    this.sendToPlayer(playerId, {
      type: 'chat_message',
      gameId,
      playerId,
      playerName: player.name,
      message,
      timestamp: Date.now(),
      isOwn: true
    });
  }

  async handleResign(playerId, gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const resigningPlayer = game.player1.id === playerId ? game.player1 : game.player2;
    const winner = game.player1.id === playerId ? game.player2 : game.player1;
    
    game.status = 'finished';
    game.result = `${winner.name} победил, ${resigningPlayer.name} сдался`;
    
    // Уведомляем обоих игроков
    [game.player1.id, game.player2.id].forEach(id => {
      this.sendToPlayer(id, {
        type: 'game_over',
        gameId,
        result: game.result,
        winner: winner.name
      });
    });
    
    // Очищаем игру у игроков
    [game.player1.id, game.player2.id].forEach(id => {
      const player = this.players.get(id);
      if (player) {
        player.gameId = null;
      }
    });
    
    this.games.delete(gameId);
  }

  async handleOfferDraw(playerId, gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const offeringPlayer = game.player1.id === playerId ? game.player1 : game.player2;
    const opponentId = game.player1.id === playerId ? game.player2.id : game.player1.id;
    
    this.sendToPlayer(opponentId, {
      type: 'draw_offered',
      gameId,
      playerName: offeringPlayer.name
    });
  }

  async handleAcceptDraw(playerId, gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    game.status = 'finished';
    game.result = 'Ничья по соглашению';
    
    [game.player1.id, game.player2.id].forEach(id => {
      this.sendToPlayer(id, {
        type: 'game_over',
        gameId,
        result: game.result,
        draw: true
      });
    });
    
    this.games.delete(gameId);
  }

  async handleDeclineDraw(playerId, gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const opponentId = game.player1.id === playerId ? game.player2.id : game.player1.id;
    
    this.sendToPlayer(opponentId, {
      type: 'draw_declined',
      gameId
    });
  }

  sendToPlayer(playerId, message) {
    const player = this.players.get(playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }

  broadcastToAll(message) {
    this.players.forEach(player => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // Находим игрока по WebSocket и удаляем его
    for (const [playerId, player] of this.players.entries()) {
      if (player.ws === ws) {
        this.players.delete(playerId);
        
        // Удаляем из очереди матчмейкинга
        const queueIndex = this.matchmakingQueue.indexOf(playerId);
        if (queueIndex > -1) {
          this.matchmakingQueue.splice(queueIndex, 1);
        }
        
        // Уведомляем о выходе
        this.broadcastToAll({ 
          type: 'player_offline', 
          playerId,
          online: this.players.size 
        });
        break;
      }
    }
  }
}

// Worker хендлер
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // WebSocket endpoint
    if (url.pathname === '/ws') {
      const gameId = url.searchParams.get('game') || 'lobby';
      const id = env.CHESS_GAME.idFromName(gameId);
      const game = env.CHESS_GAME.get(id);
      return game.fetch(request);
    }
    
    // Статистика
    if (url.pathname === '/api/stats') {
      return new Response(JSON.stringify({
        online: 0, // Будет обновляться через WebSocket
        games: 0,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};