import { useEffect, useMemo, useRef, useState } from 'react';
import PlayingCard, { formatRank } from './PlayingCard.jsx';
import {
  isMuted,
  setMuted,
  playCardSound,
  playPassSound,
  playTurnSound,
  playWinSound,
} from '../sound.js';

const TABLE_SUITS = [
  { key: 'H', symbol: '♥', red: true },
  { key: 'S', symbol: '♠', red: false },
  { key: 'D', symbol: '♦', red: true },
  { key: 'C', symbol: '♣', red: false },
];

const REACTIONS = ['😂', '🔥', '😭', '👏', '🫣'];

function sortHandAlternating(hand) {
  const bySuit = { H: [], D: [], S: [], C: [] };
  hand.forEach((c) => bySuit[c.suit]?.push(c));
  Object.values(bySuit).forEach((arr) => arr.sort((a, b) => a.rank - b.rank));

  const reds = ['H', 'D'].filter((s) => bySuit[s].length > 0);
  const blacks = ['S', 'C'].filter((s) => bySuit[s].length > 0);

  const order = [];
  let pickRed = reds.length > blacks.length;
  while (reds.length > 0 || blacks.length > 0) {
    if (pickRed && reds.length > 0) order.push(reds.shift());
    else if (!pickRed && blacks.length > 0) order.push(blacks.shift());
    else if (reds.length > 0) order.push(reds.shift());
    else if (blacks.length > 0) order.push(blacks.shift());
    pickRed = !pickRed;
  }

  return order.flatMap((s) => bySuit[s]);
}

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
  const [muted, setMutedState] = useState(isMuted);

  const sortedHand = useMemo(() => sortHandAlternating(game.myHand), [game.myHand]);

  const prevActionKey = useRef('');
  const prevTurnRef = useRef(false);

  useEffect(() => {
    const actionKey = `${game.roundNumber}|${game.lastAction?.text}|${game.turnPlayerId}`;
    if (prevActionKey.current && prevActionKey.current !== actionKey) {
      if (game.lastAction?.type === 'play') playCardSound();
      else if (game.lastAction?.type === 'pass') playPassSound();
      else if (game.lastAction?.type === 'win') playWinSound();
    }
    prevActionKey.current = actionKey;
  }, [game.roundNumber, game.lastAction, game.turnPlayerId]);

  useEffect(() => {
    if (isMyTurn && !prevTurnRef.current && !game.winnerId) {
      const t = setTimeout(() => playTurnSound(), 140);
      prevTurnRef.current = true;
      return () => clearTimeout(t);
    }
    prevTurnRef.current = isMyTurn;
  }, [isMyTurn, game.winnerId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="table-shell">
      <header className="top-bar">
        <div className="top-meta">
          <span className="pill">Room {room.code}</span>
          <span className="pill">Round {game.roundNumber}</span>
          <button className="btn btn-ghost btn-xs" onClick={toggleMute}>
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
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

            const canPlaySeven = isMyTurn && validSet.has(`${suit.key}-7`);
            const nextHighRank = lane && lane.high < 13 ? lane.high + 1 : null;
            const nextLowRank = lane && lane.low > 1 ? lane.low - 1 : null;

            return (
              <div
                key={suit.key}
                className={`suit-column ${suit.red ? 'red-col' : 'black-col'}`}
              >
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
            {sortedHand.map((card, idx) => {
              const playable = isMyTurn && validSet.has(card.id);
              const suitGap = idx > 0 && sortedHand[idx - 1].suit !== card.suit;
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  playable={playable}
                  dimmed={isMyTurn && !playable}
                  suitGap={suitGap}
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