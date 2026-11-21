import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { GAMES } from './games/index.js';
import {
  cleanupOldRooms,
  createRoom,
  deleteRoom,
  emitRoomState,
  findPlayerBySocket,
  getRoom,
  joinRoom,
} from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

setInterval(cleanupOldRooms, 30 * 60 * 1000);

io.on('connection', (socket) => {
  socket.on('create_room', ({ playerId, playerName, gameId }, cb) => {
    const room = createRoom({
      playerId,
      playerName,
      socketId: socket.id,
      gameId,
    });
    socket.join(room.code);
    emitRoomState(io, room);
    cb?.({ ok: true, code: room.code });
  });

  socket.on('join_room', ({ code, playerId, playerName }, cb) => {
    const res = joinRoom({
      code: code || '',
      playerId,
      playerName,
      socketId: socket.id,
    });
    if (res.error) {
      cb?.({ error: res.error });
      return;
    }
    socket.join(res.room.code);
    emitRoomState(io, res.room);
    cb?.({ ok: true, code: res.room.code });
  });

  socket.on('update_settings', ({ code, playerId, settings }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== playerId || room.status !== 'lobby') return;
    room.settings = { ...room.settings, ...settings };
    room.updatedAt = Date.now();
    emitRoomState(io, room);
  });

  socket.on('kick_player', ({ code, playerId, targetId }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== playerId || room.status !== 'lobby') return;
    if (targetId === playerId) return;
    const target = room.players.find((p) => p.id === targetId);
    if (target?.socketId) {
      io.to(target.socketId).emit('kicked', { message: 'Host removed you from the room.' });
    }
    room.players = room.players.filter((p) => p.id !== targetId);
    emitRoomState(io, room);
  });

  socket.on('start_game', ({ code, playerId }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: 'Room not found.' });
    if (room.hostId !== playerId) return cb?.({ error: 'Only host can start.' });

    const gameEngine = GAMES[room.gameId];
    if (room.players.length < gameEngine.minPlayers) {
      return cb?.({ error: `Need at least ${gameEngine.minPlayers} players.` });
    }

    room.status = 'playing';
    room.players.forEach((p) => {
      room.scores[p.id] = 0;
    });
    room.gameState = gameEngine.createInitialState(room.players, 1);
    room.updatedAt = Date.now();
    emitRoomState(io, room);
    cb?.({ ok: true });
  });

  socket.on('game_action', ({ code, playerId, action }, cb) => {
    const room = getRoom(code);
    if (!room || room.status !== 'playing') return;
    const gameEngine = GAMES[room.gameId];
    const res = gameEngine.handleAction(room, playerId, action);
    if (res.error) {
      cb?.({ error: res.error });
      return;
    }
    room.updatedAt = Date.now();
    emitRoomState(io, room);
    cb?.({ ok: true });
  });

  socket.on('next_round', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== playerId || room.status !== 'playing') return;
    const gameEngine = GAMES[room.gameId];
    const nextRoundNum = (room.gameState?.roundNumber || 1) + 1;
    room.gameState = gameEngine.createInitialState(room.players, nextRoundNum);
    room.updatedAt = Date.now();
    emitRoomState(io, room);
  });

  socket.on('back_to_lobby', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== playerId) return;
    room.status = 'lobby';
    room.gameState = null;
    room.updatedAt = Date.now();
    emitRoomState(io, room);
  });

  socket.on('end_match', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== playerId) return;

    const standings = room.players
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        totalScore: room.scores[p.id] || 0,
      }))
      .sort((a, b) => a.totalScore - b.totalScore);

    io.to(room.code).emit('match_ended', {
      roomCode: room.code,
      roundsPlayed: room.gameState?.roundNumber || 0,
      endedAt: Date.now(),
      winnerName: standings[0]?.name || 'Winner',
      standings,
    });

    room.players.forEach((p) => {
      if (p.socketId) {
        io.sockets.sockets.get(p.socketId)?.leave(room.code);
      }
    });
    deleteRoom(room.code);
  });

  socket.on('send_reaction', ({ code, playerId, emoji }) => {
    const room = getRoom(code);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;
    io.to(room.code).emit('reaction', {
      id: `${Date.now()}-${Math.random()}`,
      playerId,
      playerName: player.name,
      emoji,
    });
  });

  socket.on('leave_room', ({ code, playerId }) => {
    const room = getRoom(code);
    if (!room) return;
    socket.leave(room.code);
    if (room.status === 'lobby') {
      room.players = room.players.filter((p) => p.id !== playerId);
      if (room.hostId === playerId && room.players.length > 0) {
        room.hostId = room.players[0].id;
      }
      if (room.players.length === 0) deleteRoom(room.code);
      else emitRoomState(io, room);
    } else {
      const p = room.players.find((pl) => pl.id === playerId);
      if (p) {
        p.connected = false;
        p.socketId = null;
      }
      emitRoomState(io, room);
    }
  });

  socket.on('disconnect', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    found.player.connected = false;
    found.player.socketId = null;
    emitRoomState(io, found.room);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});