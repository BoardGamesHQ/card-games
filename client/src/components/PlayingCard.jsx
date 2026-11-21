const SUIT_SYMBOLS = { H: '♥', S: '♠', D: '♦', C: '♣' };

export function formatRank(rank) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export default function PlayingCard({
  card,
  playable = false,
  dimmed = false,
  compact = false,
  highlightSeven = false,
  suitGap = false,
  onClick,
}) {
  const isRed = card.suit === 'H' || card.suit === 'D';
  const rankLabel = formatRank(card.rank);
  const symbol = SUIT_SYMBOLS[card.suit];

  const classNames = [
    'playing-card',
    isRed ? 'red' : 'black',
    playable ? 'playable' : '',
    dimmed ? 'dimmed' : '',
    compact ? 'compact' : '',
    highlightSeven ? 'seven-anchor' : '',
    suitGap ? 'suit-gap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (compact) {
    return (
      <div className={classNames}>
        <span className="compact-corner">
          {rankLabel}
          {symbol}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classNames}
      onClick={playable ? onClick : undefined}
      disabled={!playable}
    >
      <span className="card-top">
        <span>{rankLabel}</span>
        <span>{symbol}</span>
      </span>
      <span className="card-center">{symbol}</span>
    </button>
  );
}