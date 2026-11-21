export const SUITS = ['H', 'S', 'D', 'C'];
export const SUIT_SYMBOLS = { H: '♥', S: '♠', D: '♦', C: '♣' };
const HAND_SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3 };

function formatRank(rank) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

function formatCard(card) {
  return `${SUIT_SYMBOLS[card.suit]}${formatRank(card.rank)}`;
}

function createShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (HAND_SUIT_ORDER[a.suit] !== HAND_SUIT_ORDER[b.suit]) {
      return HAND_SUIT_ORDER[a.suit] - HAND_SUIT_ORDER[b.suit];
    }
    return a.rank - b.rank;
  });
}

function cardPoints(card, scoringMode) {
  if (scoringMode === 'face10') {
    return card.rank >= 10 ? 10 : card.rank;
  }
  return card.rank;
}

export function getValidMoveIds(board, hand) {
  if (!board.H) {
    return hand.some((c) => c.id === 'H-7') ? ['H-7'] : [];
  }
  return hand
    .filter((card) => {
      const lane = board[card.suit];
      if (!lane) return card.rank === 7;
      return card.rank === lane.low - 1 || card.rank === lane.high + 1;
    })
    .map((c) => c.id);
}

export const badaamSaatGame = {
  id: 'badaam-saat',
  name: 'Badaam Saat (Sevens)',
  minPlayers: 2,
  maxPlayers: 8,
  defaultSettings: {
    strategicPass: false,
    scoringMode: 'standard',
  },

  createInitialState(players, roundNumber = 1) {
    const deck = createShuffledDeck();
    const hands = {};
    players.forEach((p) => {
      hands[p.id] = [];
    });

    deck.forEach((card, idx) => {
      const player = players[idx % players.length];
      hands[player.id].push(card);
    });

    let startingIndex = 0;
    players.forEach((p, idx) => {
      hands[p.id] = sortHand(hands[p.id]);
      if (hands[p.id].some((c) => c.id === 'H-7')) {
        startingIndex = idx;
      }
    });

    return {
      roundNumber,
      board: { H: null, S: null, D: null, C: null },
      hands,
      turnIndex: startingIndex,
      consecutivePasses: 0,
      lastAction: {
        text: `${players[startingIndex].name} holds ♥7 and starts the round!`,
        by: players[startingIndex].id,
        type: 'info',
      },
      winnerId: null,
      roundSummary: null,
    };
  },

  handleAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.winnerId) {
      return { error: 'Round has already ended.' };
    }

    const currentPlayer = room.players[state.turnIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { error: 'It is not your turn.' };
    }

    const hand = state.hands[playerId] || [];
    const validIds = getValidMoveIds(state.board, hand);

    if (action.type === 'PLAY_CARD') {
      if (!validIds.includes(action.cardId)) {
        return { error: 'Invalid move.' };
      }

      const cardIndex = hand.findIndex((c) => c.id === action.cardId);
      const [card] = hand.splice(cardIndex, 1);

      const lane = state.board[card.suit];
      if (!lane) {
        state.board[card.suit] = { low: 7, high: 7 };
      } else if (card.rank === lane.low - 1) {
        lane.low = card.rank;
      } else {
        lane.high = card.rank;
      }

      state.consecutivePasses = 0;
      state.lastAction = {
        text: `${currentPlayer.name} played ${formatCard(card)}`,
        by: playerId,
        type: 'play',
      };

      if (hand.length === 0) {
        state.winnerId = playerId;
        const summary = room.players.map((p) => {
          const leftCards = state.hands[p.id] || [];
          const roundPoints = leftCards.reduce(
            (sum, c) => sum + cardPoints(c, room.settings.scoringMode),
            0
          );
          room.scores[p.id] = (room.scores[p.id] || 0) + roundPoints;
          return {
            playerId: p.id,
            name: p.name,
            leftCards,
            roundPoints,
            totalScore: room.scores[p.id],
          };
        });
        summary.sort((a, b) => a.totalScore - b.totalScore);
        state.roundSummary = summary;
        state.lastAction = {
          text: `${currentPlayer.name} emptied their hand and won Round ${state.roundNumber}!`,
          by: playerId,
          type: 'win',
        };
      } else {
        state.turnIndex = (state.turnIndex + 1) % room.players.length;
      }

      return { ok: true };
    }

    if (action.type === 'PASS') {
      if (!state.board.H) {
        return { error: 'You must play ♥7 to start the round.' };
      }
      if (!room.settings.strategicPass && validIds.length > 0) {
        return { error: 'You have a valid card to play.' };
      }
      if (
        room.settings.strategicPass &&
        validIds.length > 0 &&
        state.consecutivePasses >= room.players.length - 1
      ) {
        return { error: 'Everyone else passed—you must play a valid card!' };
      }

      state.consecutivePasses += 1;
      state.lastAction = {
        text: `${currentPlayer.name} passed`,
        by: playerId,
        type: 'pass',
      };
      state.turnIndex = (state.turnIndex + 1) % room.players.length;
      return { ok: true };
    }

    return { error: 'Unknown action.' };
  },

  getClientState(room, viewerId) {
    const state = room.gameState;
    if (!state) return null;

    const myHand = state.hands[viewerId] || [];
    const currentPlayer = room.players[state.turnIndex];
    const isMyTurn = !state.winnerId && currentPlayer?.id === viewerId;
    const validMoveIds = isMyTurn ? getValidMoveIds(state.board, myHand) : [];

    const canPass =
      isMyTurn &&
      Boolean(state.board.H) &&
      (validMoveIds.length === 0 ||
        (room.settings.strategicPass &&
          state.consecutivePasses < room.players.length - 1));

    return {
      roundNumber: state.roundNumber,
      board: state.board,
      myHand,
      validMoveIds,
      turnPlayerId: state.winnerId ? null : currentPlayer?.id,
      canPass,
      lastAction: state.lastAction,
      winnerId: state.winnerId,
      roundSummary: state.roundSummary,
    };
  },
};