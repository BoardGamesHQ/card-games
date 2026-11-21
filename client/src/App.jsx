import { useEffect, useMemo, useState } from 'react';
import { socket } from './socket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import BadaamSaatTable from './components/BadaamSaatTable.jsx';

function getOrCreatePlayerId() {
  let id = sessionStorage.getItem('card_arena_player_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    sessionStorage.setItem('card_arena_player_id', id);
  }
  return id;
}

function getRoomCodeFromUrl() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
  return match ? match[1].toUpperCase() : '';
}

export default function App() {
  const playerId = useMemo(getOrCreatePlayerId, []);
  const [initialCode] = useState(getRoomCodeFromUrl);
  const [savedName, setSavedName] = useState(
    () => sessionStorage.getItem('card_arena_name') || ''
  );
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    const onRoomState = (nextRoom) => {
      setError('');
      setRoom(nextRoom);
      window.history.replaceState(null, '', `/room/${nextRoom.code}`);
    };

    const onKicked = ({ message }) => {
      setRoom(null);
      setError(message);
      window.history.replaceState(null, '', '/');
    };

    const onReaction = (reaction) => {
      setReactions((prev) => [...prev.filter((r) => r.playerId !== reaction.playerId), reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2200);
    };

    socket.on('room_state', onRoomState);
    socket.on('kicked', onKicked);
    socket.on('reaction', onReaction);

    const activeCode = sessionStorage.getItem('card_arena_room') || initialCode;
    const activeName = sessionStorage.getItem('card_arena_name');
    if (activeCode && activeName) {
      socket.emit(
        'join_room',
        { code: activeCode, playerId, playerName: activeName },
        (res) => {
          if (res?.error) {
            sessionStorage.removeItem('card_arena_room');
          }
        }
      );
    }

    return () => {
      socket.off('room_state', onRoomState);
      socket.off('kicked', onKicked);
      socket.off('reaction', onReaction);
    };
  }, [initialCode, playerId]);

  const handleCreateRoom = (name) => {
    sessionStorage.setItem('card_arena_name', name);
    setSavedName(name);
    socket.emit('create_room', { playerId, playerName: name }, (res) => {
      if (res?.ok) sessionStorage.setItem('card_arena_room', res.code);
    });
  };

  const handleJoinRoom = (code, name) => {
    sessionStorage.setItem('card_arena_name', name);
    setSavedName(name);
    socket.emit('join_room', { code, playerId, playerName: name }, (res) => {
      if (res?.error) {
        setError(res.error);
      } else if (res?.ok) {
        sessionStorage.setItem('card_arena_room', res.code);
      }
    });
  };

  const handleLeaveRoom = () => {
    if (room) {
      socket.emit('leave_room', { code: room.code, playerId });
    }
    sessionStorage.removeItem('card_arena_room');
    setRoom(null);
    window.history.replaceState(null, '', '/');
  };

  if (!room) {
    return (
      <Home
        initialCode={initialCode}
        savedName={savedName}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        error={error}
      />
    );
  }

  if (room.status === 'lobby') {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        error={error}
        onUpdateSettings={(settings) =>
          socket.emit('update_settings', { code: room.code, playerId, settings })
        }
        onStartGame={() =>
          socket.emit('start_game', { code: room.code, playerId }, (res) => {
            if (res?.error) setError(res.error);
          })
        }
        onKickPlayer={(targetId) =>
          socket.emit('kick_player', { code: room.code, playerId, targetId })
        }
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <BadaamSaatTable
      room={room}
      playerId={playerId}
      reactions={reactions}
      onPlayCard={(cardId) =>
        socket.emit('game_action', {
          code: room.code,
          playerId,
          action: { type: 'PLAY_CARD', cardId },
        })
      }
      onPass={() =>
        socket.emit('game_action', {
          code: room.code,
          playerId,
          action: { type: 'PASS' },
        })
      }
      onNextRound={() => socket.emit('next_round', { code: room.code, playerId })}
      onBackToLobby={() => socket.emit('back_to_lobby', { code: room.code, playerId })}
      onSendReaction={(emoji) =>
        socket.emit('send_reaction', { code: room.code, playerId, emoji })
      }
    />
  );
}