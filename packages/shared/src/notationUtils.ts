import { GameMove, TurnNotation } from './index';

/**
 * Converts a game move to standard backgammon notation
 * @param move - The game move to convert
 * @param playerIndex - The player index (0 or 1) to determine perspective
 * @returns A notation string like "13/7*" or "bar/22" or "5/off"
 */
export function moveToNotation(move: GameMove, playerIndex: number): string {
  const { from, to, hit } = move;

  // Determine starting position
  let startPos: string;
  if (from === -1) {
    startPos = 'bar';
  } else {
    // Convert internal position to player's perspective
    // Player 0 counts 1-24 as normal, Player 1 counts in reverse
    startPos = playerIndex === 0 ? String(from + 1) : String(24 - from);
  }

  // Determine ending position
  let endPos: string;
  if (to === 25) {
    endPos = 'off';
  } else {
    // Convert internal position to player's perspective
    endPos = playerIndex === 0 ? String(to + 1) : String(24 - to);
  }

  // Add asterisk if hit occurred
  const hitMarker = hit ? '*' : '';

  return `${startPos}/${endPos}${hitMarker}`;
}

/**
 * Groups moves by turn and creates turn notation
 * @param moves - Array of game moves
 * @param playerIndex - The player index for perspective
 * @returns Array of turn notations
 */
export function movesToTurnNotations(moves: GameMove[], playerIndex: number): TurnNotation[] {
  const turnNotations: TurnNotation[] = [];
  const movesByTurn = new Map<string, GameMove[]>();

  // Group moves by player and timestamp proximity (within same turn)
  moves.forEach(move => {
    if (!move.dice) return;

    // Use a combination of playerId and timestamp to group turns
    const turnKey = `${move.playerId}-${Math.floor(move.timestamp.getTime() / 60000)}`; // Group by minute

    if (!movesByTurn.has(turnKey)) {
      movesByTurn.set(turnKey, []);
    }
    movesByTurn.get(turnKey)!.push(move);
  });

  // Convert each turn group to notation
  let turnNumber = 1;
  movesByTurn.forEach((turnMoves) => {
    if (turnMoves.length === 0) return;

    const firstMove = turnMoves[0];
    if (!firstMove.dice) return;

    const notation: TurnNotation = {
      turnNumber: turnNumber++,
      playerId: firstMove.playerId,
      dice: firstMove.dice,
      moves: turnMoves.map(m => moveToNotation(m, playerIndex)),
      timestamp: firstMove.timestamp
    };

    turnNotations.push(notation);
  });

  return turnNotations;
}

/**
 * Formats a turn notation into a readable string
 * @param notation - The turn notation to format
 * @param playerName - Optional player name to include
 * @returns Formatted string like "42: 13/7* 8/6" or "53: bar/20 13/10"
 */
export function formatTurnNotation(notation: TurnNotation, playerName?: string): string {
  const diceStr = notation.dice.join('');
  const movesStr = notation.moves.join(' ');
  const playerStr = playerName ? `${playerName}: ` : '';

  return `${playerStr}${diceStr}: ${movesStr}`;
}

/**
 * Exports game notation to a text format
 * @param notations - Array of turn notations
 * @param player1Name - Name of player 1
 * @param player2Name - Name of player 2
 * @param gameInfo - Additional game information
 * @returns Formatted game notation text
 */
export function exportGameNotation(
  notations: TurnNotation[],
  player1Name: string,
  player2Name: string,
  gameInfo?: {
    date?: Date;
    result?: string;
    gameType?: string;
  }
): string {
  let output = '# Backgammon Game Notation\n\n';

  if (gameInfo) {
    output += `## Game Information\n`;
    output += `- **Player 1 (White)**: ${player1Name}\n`;
    output += `- **Player 2 (Black)**: ${player2Name}\n`;
    if (gameInfo.date) {
      output += `- **Date**: ${gameInfo.date.toISOString()}\n`;
    }
    if (gameInfo.gameType) {
      output += `- **Type**: ${gameInfo.gameType}\n`;
    }
    if (gameInfo.result) {
      output += `- **Result**: ${gameInfo.result}\n`;
    }
    output += '\n';
  }

  output += `## Moves\n\n`;

  notations.forEach(notation => {
    const playerName = notation.playerId === player1Name ? player1Name : player2Name;
    output += `${notation.turnNumber}. ${formatTurnNotation(notation, playerName)}\n`;
  });

  return output;
}

/**
 * Parses a notation string back to move information
 * @param notationStr - Notation string like "13/7*"
 * @param playerIndex - Player index for perspective
 * @returns Partial move information (from, to, hit)
 */
export function parseNotation(notationStr: string, playerIndex: number): {
  from: number;
  to: number;
  hit: boolean;
} {
  const hit = notationStr.endsWith('*');
  const cleanStr = hit ? notationStr.slice(0, -1) : notationStr;
  const [startStr, endStr] = cleanStr.split('/');

  // Parse starting position
  let from: number;
  if (startStr === 'bar') {
    from = -1;
  } else {
    const pos = parseInt(startStr);
    from = playerIndex === 0 ? pos - 1 : 24 - pos;
  }

  // Parse ending position
  let to: number;
  if (endStr === 'off') {
    to = 25;
  } else {
    const pos = parseInt(endStr);
    to = playerIndex === 0 ? pos - 1 : 24 - pos;
  }

  return { from, to, hit };
}

/**
 * Validates a notation string format
 * @param notationStr - Notation string to validate
 * @returns True if valid, false otherwise
 */
export function isValidNotation(notationStr: string): boolean {
  const notationRegex = /^(bar|\d{1,2})\/(\d{1,2}|off)\*?$/;
  return notationRegex.test(notationStr);
}
