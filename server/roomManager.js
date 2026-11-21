import { GAMES, listGames } from './games/index.js';

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code = '';
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function cleanupOldRooms() {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < twoHoursAgo) {
      rooms.delete(code);
    }
  }
}

export function createRoom({ playerId, playerName, socketId, gameId = 'badaam-saat' }) {
  const gameEngine = GAMES[gameId] || GAMES['badaam-saat'];
  const code = generateRoomCode();
  const room = {
    code,
    hostId: playerId,
    status: 'lobby',
    gameId: gameEngine.id,
    settings: { ...gameEngine.defaultSettings },
    players: [
      {
        id: playerId,
        name: playerName.trim().slice(0, 18) || 'Player 1',
        socketId,
        connected: true,
      },
    ],
    scores: { [playerId]: 0 },
    gameState: null,
    updatedAt: Date.now(),
  };

  rooms.set(code, room);
  return room;
}

export function joinRoom({ code, playerId, playerName, socketId }) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found. Check the code or link.' };

  room.updatedAt = Date.now();
  const existing = room.players.find((p) => p.id === playerId);

  if (existing) {
    existing.socketId = socketId;
    existing.connected = true;
    if (playerName?.trim()) {
      existing.name = playerName.trim().slice(0, 18);
    }
    return { room };
  }

  if (room.status !== 'lobby') {
    return { error: 'Game already in progress.' };
  }

  const gameEngine = GAMES[room.gameId];
  if (room.players.length >= gameEngine.maxPlayers) {
    return { error: `Room is full (max ${gameEngine.maxPlayers} players).` };
  }

  room.players.push({
    id: playerId,
    name: playerName.trim().slice(0, 18) || `Player ${room.players.length + 1}`,
    socketId,
    connected: true,
  });
  room.scores[playerId] = room.scores[playerId] || 0;
  return { room };
}

export function getRoom(code) {
  return rooms.get(code);
}

export function findPlayerBySocket(socketId) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) return { room, player };
  }
  return null;
}

export function emitRoomState(io, room) {
  const gameEngine = GAMES[room.gameId];

  for (const recipient of room.players) {
    if (!recipient.connected || !recipient.socketId) continue;

    const payload = {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      gameId: room.gameId,
      availableGames: listGames(),
      settings: room.settings,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: room.scores[p.id] || 0,
        cardCount: room.gameState?.hands?.[p.id]?.length ?? 0,
      })),
      game:
        room.status === 'playing'
          ? gameEngine.getClientState(room, recipient.id)
          : null,
    };

    io.to(recipient.socketId).emit('room_state', payload);
  }
}