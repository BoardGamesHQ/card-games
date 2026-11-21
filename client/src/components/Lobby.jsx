import { useState } from 'react';

export default function Lobby({
  room,
  playerId,
  onUpdateSettings,
  onStartGame,
  onKickPlayer,
  onLeaveRoom,
  error,
}) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const inviteUrl = `${window.location.origin}/room/${room.code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', inviteUrl);
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Badaam Saat game!',
          text: `Tap to join room ${room.code}:`,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    copyInvite();
  };

  return (
    <div className="center-shell">
      <div className="panel lobby-panel">
        <div className="lobby-header">
          <div>
            <span className="pill">Room {room.code}</span>
            <h2>Badaam Saat</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLeaveRoom}>
            Leave
          </button>
        </div>

        <div className="invite-box">
          <div className="invite-url">{inviteUrl}</div>
          <div className="invite-actions">
            <button className="btn btn-secondary btn-sm" onClick={copyInvite}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={shareInvite}>
              Share
            </button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="section-title">
          Players ({room.players.length}/8)
        </div>
        <div className="players-list">
          {room.players.map((p) => (
            <div key={p.id} className="player-row">
              <div className="player-row-left">
                <span className={`status-dot ${p.connected ? 'online' : 'offline'}`} />
                <span>{p.name}</span>
                {p.id === room.hostId && <span className="tag">Host</span>}
                {p.id === playerId && <span className="tag you">You</span>}
              </div>
              {isHost && p.id !== playerId && (
                <button
                  className="kick-btn"
                  onClick={() => onKickPlayer(p.id)}
                  title="Remove player"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="section-title">House Rules</div>
        <div className="settings-box">
          <div className="setting-item">
            <div>
              <strong>Allow Strategic Pass</strong>
              <div className="setting-hint">
                Off by default: you must play if you have a valid card.
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={Boolean(room.settings.strategicPass)}
              onChange={(e) =>
                onUpdateSettings({ strategicPass: e.target.checked })
              }
            />
          </div>

          <div className="setting-item">
            <div>
              <strong>Scoring Mode</strong>
              <div className="setting-hint">Points counted for leftover cards</div>
            </div>
            <select
              className="select-input"
              disabled={!isHost}
              value={room.settings.scoringMode}
              onChange={(e) =>
                onUpdateSettings({ scoringMode: e.target.value })
              }
            >
              <option value="standard">Standard (A=1..K=13)</option>
              <option value="face10">Face Cards = 10 (J/Q/K=10)</option>
            </select>
          </div>
        </div>

        {isHost ? (
          <button
            className="btn btn-primary"
            disabled={room.players.length < 2}
            onClick={onStartGame}
          >
            {room.players.length < 2
              ? 'Waiting for at least 2 players...'
              : `Start Game (${room.players.length} Players)`}
          </button>
        ) : (
          <div className="waiting-note">Waiting for host to start the game...</div>
        )}
      </div>
    </div>
  );
}