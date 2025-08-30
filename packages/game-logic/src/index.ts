import { BoardState, GameMove, Player, INITIAL_BOARD_STATE } from '@playbg/shared';

export class BackgammonEngine {
  private board: BoardState;
  private currentPlayer: 0 | 1;
  private dice: [number, number] | null;
  private usedDice: boolean[]; // Track which specific dice are used

  constructor(initialBoard?: BoardState) {
    this.board = initialBoard || JSON.parse(JSON.stringify(INITIAL_BOARD_STATE));
    this.currentPlayer = 0;
    this.dice = null;
    this.usedDice = [];
  }

  /**
   * Roll dice for the current player
   */
  rollDice(): [number, number] {
    const dice: [number, number] = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    this.dice = dice;
    
    // For doubles, track 4 dice. For regular, track 2 dice
    if (dice[0] === dice[1]) {
      this.usedDice = [false, false, false, false];
    } else {
      this.usedDice = [false, false];
    }
    
    return dice;
  }

  /**
   * Get all possible moves for the current player
   */
  getPossibleMoves(): GameMove[] {
    if (!this.dice) return [];

    const moves: GameMove[] = [];
    const playerIndex = this.currentPlayer;
    
    // Check if player has checkers on the bar
    if (this.board.bar[playerIndex] > 0) {
      return this.getBarMoves();
    }

    // Check bearing off moves
    if (this.canBearOff(playerIndex)) {
      moves.push(...this.getBearOffMoves());
    }

    // Regular moves
    moves.push(...this.getRegularMoves());

    return moves;
  }

  /**
   * Validate and execute a move
   */
  makeMove(move: GameMove): boolean {
    const possibleMoves = this.getPossibleMoves();
    const isValidMove = possibleMoves.some(
      m => m.from === move.from && m.to === move.to
    );

    if (!isValidMove) return false;

    this.executeMove(move);
    this.updateUsedDice(move);
    
    // Check if all dice are used or no more moves available
    if (this.allDiceUsed() || this.getPossibleMoves().length === 0) {
      this.endTurn();
    }

    return true;
  }

  /**
   * Check if the game is over
   */
  isGameOver(): boolean {
    return this.board.off[0] === 15 || this.board.off[1] === 15;
  }

  /**
   * Get the winner (if game is over)
   */
  getWinner(): 0 | 1 | null {
    if (this.board.off[0] === 15) return 0;
    if (this.board.off[1] === 15) return 1;
    return null;
  }

  /**
   * Get current board state
   */
  getBoardState(): BoardState {
    return JSON.parse(JSON.stringify(this.board));
  }

  /**
   * Get current dice
   */
  getCurrentDice(): [number, number] | null {
    return this.dice;
  }

  /**
   * Get current player
   */
  getCurrentPlayer(): 0 | 1 {
    return this.currentPlayer;
  }

  // Private helper methods

  private getBarMoves(): GameMove[] {
    const moves: GameMove[] = [];
    const playerIndex = this.currentPlayer;
    const homeBoard = playerIndex === 0 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];

    const availableDice = this.getAvailableDiceValues();
    
    for (const diceValue of availableDice) {
      const targetPoint = playerIndex === 0 ? 24 - diceValue : diceValue - 1;

      if (this.canMoveToPoint(targetPoint, playerIndex)) {
        moves.push({
          playerId: '', // Will be set by caller
          from: -1, // Bar
          to: targetPoint,
          timestamp: new Date()
        });
      }
    }

    return moves;
  }

  private getBearOffMoves(): GameMove[] {
    const moves: GameMove[] = [];
    const playerIndex = this.currentPlayer;
    const homeBoard = playerIndex === 0 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];

    const availableDice = this.getAvailableDiceValues();

    for (const diceValue of availableDice) {
      for (const point of homeBoard) {
        if (this.board.points[point][playerIndex] > 0) {
          const distance = playerIndex === 0 ? point - 17 : 6 - point;
          
          if (distance === diceValue) {
            moves.push({
              playerId: '',
              from: point,
              to: -1, // Bear off
              timestamp: new Date()
            });
          } else if (distance < diceValue && this.isHighestChecker(point, playerIndex)) {
            moves.push({
              playerId: '',
              from: point,
              to: -1, // Bear off
              timestamp: new Date()
            });
          }
        }
      }
    }

    return moves;
  }

  private getRegularMoves(): GameMove[] {
    const moves: GameMove[] = [];
    const playerIndex = this.currentPlayer;

    const availableDice = this.getAvailableDiceValues();

    for (let point = 0; point < 24; point++) {
      if (this.board.points[point][playerIndex] > 0) {
        for (const diceValue of availableDice) {
          const targetPoint = playerIndex === 0 ? point - diceValue : point + diceValue;

          if (targetPoint >= 0 && targetPoint < 24 && this.canMoveToPoint(targetPoint, playerIndex)) {
            moves.push({
              playerId: '',
              from: point,
              to: targetPoint,
              timestamp: new Date()
            });
          }
        }
      }
    }

    return moves;
  }

  private canMoveToPoint(point: number, playerIndex: number): boolean {
    const opponentIndex = 1 - playerIndex;
    return this.board.points[point][opponentIndex] <= 1;
  }

  private canBearOff(playerIndex: number): boolean {
    const homeBoard = playerIndex === 0 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    
    // Check if all checkers are in home board
    for (let point = 0; point < 24; point++) {
      if (!homeBoard.includes(point) && this.board.points[point][playerIndex] > 0) {
        return false;
      }
    }

    // Check if any checkers on bar
    return this.board.bar[playerIndex] === 0;
  }

  private isHighestChecker(point: number, playerIndex: number): boolean {
    const homeBoard = playerIndex === 0 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    
    for (const p of homeBoard) {
      if (p > point && this.board.points[p][playerIndex] > 0) {
        return false;
      }
    }
    return true;
  }

  private executeMove(move: GameMove): void {
    const playerIndex = this.currentPlayer;
    const opponentIndex = 1 - playerIndex;

    // Move from bar
    if (move.from === -1) {
      this.board.bar[playerIndex]--;
      
      // Hit opponent checker if present
      if (this.board.points[move.to][opponentIndex] === 1) {
        this.board.points[move.to][opponentIndex] = 0;
        this.board.bar[opponentIndex]++;
      }
      
      this.board.points[move.to][playerIndex]++;
      return;
    }

    // Bear off
    if (move.to === -1) {
      this.board.points[move.from][playerIndex]--;
      this.board.off[playerIndex]++;
      return;
    }

    // Regular move
    this.board.points[move.from][playerIndex]--;
    
    // Hit opponent checker if present
    if (this.board.points[move.to][opponentIndex] === 1) {
      this.board.points[move.to][opponentIndex] = 0;
      this.board.bar[opponentIndex]++;
    }
    
    this.board.points[move.to][playerIndex]++;
  }

  private updateUsedDice(move: GameMove): void {
    if (!this.dice) return;

    const distance = Math.abs(move.to - move.from);
    const isDoubles = this.dice[0] === this.dice[1];
    
    if (isDoubles) {
      // For doubles, mark the first available die as used
      for (let i = 0; i < this.usedDice.length; i++) {
        if (!this.usedDice[i]) {
          this.usedDice[i] = true;
          break;
        }
      }
    } else {
      // For regular dice, mark the appropriate die as used
      if (distance === this.dice[0] && !this.usedDice[0]) {
        this.usedDice[0] = true;
      } else if (distance === this.dice[1] && !this.usedDice[1]) {
        this.usedDice[1] = true;
      }
    }
  }

  private allDiceUsed(): boolean {
    if (!this.dice) return true;
    return this.usedDice.every(used => used);
  }

  private getAvailableDiceValues(): number[] {
    if (!this.dice) return [];
    
    const values: number[] = [];
    const isDoubles = this.dice[0] === this.dice[1];
    
    if (isDoubles) {
      // For doubles, add the dice value for each unused die
      this.usedDice.forEach(used => {
        if (!used) values.push(this.dice![0]);
      });
    } else {
      // For regular dice, add each unused die value
      if (!this.usedDice[0]) values.push(this.dice[0]);
      if (!this.usedDice[1]) values.push(this.dice[1]);
    }
    
    return values;
  }

  private endTurn(): void {
    this.currentPlayer = this.currentPlayer === 0 ? 1 : 0;
    this.dice = null;
    this.usedDice = [];
  }
}

// ELO Rating System
export class EloRating {
  private static readonly K_FACTOR = 32;
  private static readonly MIN_RATING = 100;
  private static readonly MAX_RATING = 3000;

  /**
   * Calculate new ratings after a game
   */
  static calculateNewRatings(
    player1Rating: number,
    player2Rating: number,
    result: 1 | 0 | 0.5 // 1 = player1 wins, 0 = player2 wins, 0.5 = draw
  ): [number, number] {
    const expectedScore1 = this.getExpectedScore(player1Rating, player2Rating);
    const expectedScore2 = 1 - expectedScore1;

    const newRating1 = Math.round(
      Math.max(
        this.MIN_RATING,
        Math.min(this.MAX_RATING, player1Rating + this.K_FACTOR * (result - expectedScore1))
      )
    );

    const newRating2 = Math.round(
      Math.max(
        this.MIN_RATING,
        Math.min(this.MAX_RATING, player2Rating + this.K_FACTOR * ((1 - result) - expectedScore2))
      )
    );

    return [newRating1, newRating2];
  }

  private static getExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }
}

// Game Utilities
export class GameUtils {
  /**
   * Generate a unique game ID
   */
  static generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate game duration in minutes
   */
  static calculateGameDuration(startTime: Date, endTime: Date): number {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }

  /**
   * Validate move format
   */
  static isValidMoveFormat(move: any): move is GameMove {
    return (
      typeof move === 'object' &&
      typeof move.playerId === 'string' &&
      typeof move.from === 'number' &&
      typeof move.to === 'number' &&
      move.timestamp instanceof Date
    );
  }

  /**
   * Create initial board state
   */
  static createInitialBoard(): BoardState {
    return JSON.parse(JSON.stringify(INITIAL_BOARD_STATE));
  }
}

export { INITIAL_BOARD_STATE } from '@playbg/shared';
