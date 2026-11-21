import { badaamSaatGame } from './badaamSaat.js';

export const GAMES = {
  [badaamSaatGame.id]: badaamSaatGame,
};

export function listGames() {
  return Object.values(GAMES).map((g) => ({
    id: g.id,
    name: g.name,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    defaultSettings: g.defaultSettings,
  }));
}