import { useState } from 'react';

export default function Home({
  initialCode,
  savedName,
  history,
  onClearHistory,
  onCreateRoom,
  onJoinRoom,
  error,
}) {
  const [name, setName] = useState(savedName || '');
  const [code, setCode] = useState(initialCode || '');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom(name.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    onJoinRoom(code.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="center-shell">
      <div className="home-stack">
        <div className="panel home-panel">
          <div className="brand-badge">♠ ♥ ♦ ♣</div>
          <h1>Card Arena</h1>
          <p className="subtitle">
            Play <strong>Badaam Saat</strong> online with friends — no sign-up required.
          </p>

          {error && <div className="error-banner">{error}</div>}

          <label className="field-label">Your Nickname</label>
          <input
            className="text-input"
            type="text"
            maxLength={18}
            placeholder="e.g. Aarav"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {initialCode ? (
            <form onSubmit={handleJoin} className="stack-gap">
              <label className="field-label">Joining Room</label>
              <input
                className="text-input code-input"
                type="text"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button className="btn btn-primary" disabled={!name.trim() || code.length < 4}>
                Join Game Room
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCreate}
                disabled={!name.trim()}
              >
                Or Create a New Room Instead
              </button>
            </form>
          ) : (
            <div className="stack-gap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!name.trim()}
              >
                Create New Room
              </button>

              <div className="divider">or join with a code</div>

              <form onSubmit={handleJoin} className="join-row">
                <input
                  className="text-input code-input"
                  type="text"
                  maxLength={4}
                  placeholder="CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button
                  className="btn btn-secondary"
                  disabled={!name.trim() || code.trim().length < 4}
                >
                  Join
                </button>
              </form>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="panel history-panel">
            <div className="history-header">
              <span className="section-title" style={{ margin: 0 }}>
                Recent Match History (This Device)
              </span>
              <button className="btn btn-ghost btn-xs" onClick={onClearHistory}>
                Clear
              </button>
            </div>
            <div className="history-list">
              {history.slice(0, 8).map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-top">
                    <strong>🏆 {item.winner}</strong>
                    <span>Room {item.roomCode} • Rd {item.roundNumber}</span>
                  </div>
                  <div className="history-scores">
                    {item.standings.map((s) => `${s.name}: ${s.totalScore}`).join(' | ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}