import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket.js';
import { playReactionSound, playWinSound } from './sound.js';
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

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('card_arena_history') || '[]');
  } catch {
    return [];
  }
}

function formatNow(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
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
  const [history, setHistory] = useState(loadHistory);
  const [endedMatch, setEndedMatch] = useState(null);
  const lastSavedRoundRef = useRef('');

  useEffect(() => {
    const onRoomState = (nextRoom) => {
      setError('');
      setEndedMatch(null);
      setRoom(nextRoom);
      window.history.replaceState(null, '', `/room/${nextRoom.code}`);
    };

    const onKicked = ({ message }) => {
      sessionStorage.removeItem('card_arena_room');
      setRoom(null);
      setError(message);
      window.history.replaceState(null, '', '/');
    };

    const onMatchEnded = (summary) => {
      playWinSound();
      sessionStorage.removeItem('card_arena_room');
      setRoom(null);
      setEndedMatch(summary);
      window.history.replaceState(null, '', '/');

      const entry = {
        id: `match-${summary.roomCode}-${summary.endedAt}`,
        kind: 'match',
        roomCode: summary.roomCode,
        roundsPlayed: summary.roundsPlayed,
        playedAt: formatNow(summary.endedAt),
        winner: summary.winnerName,
        standings: summary.standings.map((s) => ({
          name: s.name,
          totalScore: s.totalScore,
        })),
      };

      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 40);
        localStorage.setItem('card_arena_history', JSON.stringify(next));
        return next;
      });
    };

    const onReaction = (reaction) => {
      playReactionSound();
      setReactions((prev) => [...prev.filter((r) => r.playerId !== reaction.playerId), reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2200);
    };

    socket.on('room_state', onRoomState);
    socket.on('kicked', onKicked);
    socket.on('match_ended', onMatchEnded);
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
      socket.off('match_ended', onMatchEnded);
      socket.off('reaction', onReaction);
    };
  }, [initialCode, playerId]);

  useEffect(() => {
    if (!room?.game?.roundSummary) return;
    const g = room.game;
    const key = `${room.code}-R${g.roundNumber}-${g.winnerId}-${g.roundSummary
      .map((s) => s.totalScore)
      .join(',')}`;
    if (lastSavedRoundRef.current === key) return;
    lastSavedRoundRef.current = key;

    const winner = room.players.find((p) => p.id === g.winnerId)?.name || 'Winner';
    const entry = {
      id: key,
      kind: 'round',
      roomCode: room.code,
      roundNumber: g.roundNumber,
      roundsPlayed: g.roundNumber,
      playedAt: formatNow(),
      winner,
      standings: g.roundSummary.map((s) => ({
        name: s.name,
        totalScore: s.totalScore,
      })),
    };

    setHistory((prev) => {
      const next = [entry, ...prev.filter((x) => x.id !== key)].slice(0, 40);
      localStorage.setItem('card_arena_history', JSON.stringify(next));
      return next;
    });
  }, [room]);

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

  const handleClearHistory = () => {
    localStorage.removeItem('card_arena_history');
    setHistory([]);
  };

  if (!room) {
    return (
      <>
        <Home
          initialCode={initialCode}
          savedName={savedName}
          history={history}
          onClearHistory={handleClearHistory}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={error}
        />
        {endedMatch && (
          <div className="modal-backdrop">
            <div className="panel modal-panel">
              <h2>🏆 Match Ended — {endedMatch.winnerName} Wins!</h2>
              <p className="subtitle">
                Room {endedMatch.roomCode} • {endedMatch.roundsPlayed} round(s) played
              </p>
              <div className="summary-table">
                {endedMatch.standings.map((row, idx) => (
                  <div key={row.playerId} className="summary-row">
                    <strong>
                      #{idx + 1} {row.name}
                    </strong>
                    <div className="summary-points">
                      <span>{row.totalScore} pts</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => setEndedMatch(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
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
      onEndMatch={() => socket.emit('end_match', { code: room.code, playerId })}
      onLeaveRoom={handleLeaveRoom}
      onSendReaction={(emoji) =>
        socket.emit('send_reaction', { code: room.code, playerId, emoji })
      }
    />
  );
}