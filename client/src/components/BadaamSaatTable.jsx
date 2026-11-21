import PlayingCard, { formatRank } from './PlayingCard.jsx';

const TABLE_SUITS = [
  { key: 'H', symbol: '♥', red: true },
  { key: 'S', symbol: '♠', red: false },
  { key: 'D', symbol: '♦', red: true },
  { key: 'C', symbol: '♣', red: false },
];

const REACTIONS = ['😂', '🔥', '😭', '👏', '🫣'];

export default function BadaamSaatTable({
  room,
  playerId,
  reactions,
  onPlayCard,
  onPass,
  onNextRound,
  onBackToLobby,
  onSendReaction,
}) {
  const game = room.game;
  const isHost = room.hostId === playerId;
  const isMyTurn = game.turnPlayerId === playerId;
  const validSet = new Set(game.validMoveIds);
  const currentTurnPlayer = room.players.find((p) => p.id === game.turnPlayerId);

  return (
    <div className="table-shell">
      <header className="top-bar">
        <div className="top-meta">
          <span className="pill">Room {room.code}</span>
          <span className="pill">Round {game.roundNumber}</span>
          {isHost && (
            <button className="btn btn-ghost btn-xs" onClick={onBackToLobby}>
              Lobby
            </button>
          )}
        </div>

        <div className="players-strip">
          {room.players.map((p) => {
            const isTurn = p.id === game.turnPlayerId;
            const latestReaction = reactions.find((r) => r.playerId === p.id);
            return (
              <div
                key={p.id}
                className={`seat-chip ${isTurn ? 'active-turn' : ''} ${
                  !p.connected ? 'disconnected' : ''
                }`}
              >
                {latestReaction && (
                  <span className="floating-emoji">{latestReaction.emoji}</span>
                )}
                <div className="seat-name">
                  {p.name}
                  {p.id === playerId ? ' (You)' : ''}
                </div>
                <div className="seat-stats">
                  <span>🃏 {p.cardCount}</span>
                  <span>• {p.score} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <main className="felt-board">
        <div className="action-toast">{game.lastAction?.text}</div>

        <div className="suit-lanes">
          {TABLE_SUITS.map((suit) => {
            const lane = game.board[suit.key];
            const upperRanks = [];
            const lowerRanks = [];

            if (lane) {
              for (let r = lane.high; r >= 8; r--) upperRanks.push(r);
              for (let r = 6; r >= lane.low; r--) lowerRanks.push(r);
            }

            const canPlaySeven =
              isMyTurn && validSet.has(`${suit.key}-7`);
            const nextHighRank = lane && lane.high < 13 ? lane.high + 1 : null;
            const nextLowRank = lane && lane.low > 1 ? lane.low - 1 : null;

            return (
              <div key={suit.key} className="suit-column">
                <div className={`suit-header ${suit.red ? 'red' : 'black'}`}>
                  {suit.symbol}
                </div>

                <div className="lane-stack upper">
                  {nextHighRank &&
                    isMyTurn &&
                    validSet.has(`${suit.key}-${nextHighRank}`) && (
                      <div className="next-slot-hint">
                        +{formatRank(nextHighRank)}
                      </div>
                    )}
                  {upperRanks.map((rank) => (
                    <PlayingCard
                      key={`${suit.key}-${rank}`}
                      card={{ id: `${suit.key}-${rank}`, suit: suit.key, rank }}
                      compact
                    />
                  ))}
                </div>

                <div className="seven-slot">
                  {lane ? (
                    <PlayingCard
                      card={{ id: `${suit.key}-7`, suit: suit.key, rank: 7 }}
                      compact
                      highlightSeven
                    />
                  ) : (
                    <div
                      className={`empty-seven ${canPlaySeven ? 'pulse-slot' : ''}`}
                    >
                      7{suit.symbol}
                    </div>
                  )}
                </div>

                <div className="lane-stack lower">
                  {lowerRanks.map((rank) => (
                    <PlayingCard
                      key={`${suit.key}-${rank}`}
                      card={{ id: `${suit.key}-${rank}`, suit: suit.key, rank }}
                      compact
                    />
                  ))}
                  {nextLowRank &&
                    isMyTurn &&
                    validSet.has(`${suit.key}-${nextLowRank}`) && (
                      <div className="next-slot-hint">
                        +{formatRank(nextLowRank)}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="hand-dock">
        <div className="dock-bar">
          <div className={`turn-banner ${isMyTurn ? 'my-turn' : ''}`}>
            {game.winnerId
              ? 'Round Complete!'
              : isMyTurn
              ? validSet.size > 0
                ? 'Your Turn — Tap a glowing card to play'
                : 'Your Turn — No playable cards'
              : `Waiting for ${currentTurnPlayer?.name || '...'}...`}
          </div>

          <div className="dock-controls">
            <div className="reaction-bar">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="reaction-btn"
                  onClick={() => onSendReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {isMyTurn && (
              <button
                className="btn btn-pass btn-sm"
                disabled={!game.canPass}
                onClick={onPass}
              >
                Pass Turn
              </button>
            )}
          </div>
        </div>

        <div className="hand-scroll">
          <div className="hand-cards">
            {game.myHand.map((card) => {
              const playable = isMyTurn && validSet.has(card.id);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  playable={playable}
                  dimmed={isMyTurn && !playable}
                  onClick={() => onPlayCard(card.id)}
                />
              );
            })}
          </div>
        </div>
      </footer>

      {game.roundSummary && (
        <div className="modal-backdrop">
          <div className="panel modal-panel">
            <h2>
              🏆{' '}
              {room.players.find((p) => p.id === game.winnerId)?.name || 'Winner'}{' '}
              won Round {game.roundNumber}!
            </h2>
            <p className="subtitle">Lowest total points leads the match.</p>

            <div className="summary-table">
              {game.roundSummary.map((row) => (
                <div key={row.playerId} className="summary-row">
                  <div>
                    <strong>{row.name}</strong>
                    <div className="leftover-cards">
                      {row.leftCards.length === 0
                        ? 'Empty hand!'
                        : row.leftCards
                            .map((c) => `${formatRank(c.rank)}${{ H: '♥', S: '♠', D: '♦', C: '♣' }[c.suit]}`)
                            .join(' ')}
                    </div>
                  </div>
                  <div className="summary-points">
                    <span>+{row.roundPoints}</span>
                    <small>Total: {row.totalScore}</small>
                  </div>
                </div>
              ))}
            </div>

            {isHost ? (
              <button className="btn btn-primary" onClick={onNextRound}>
                Deal Round {game.roundNumber + 1}
              </button>
            ) : (
              <div className="waiting-note">Waiting for host to deal next round...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}