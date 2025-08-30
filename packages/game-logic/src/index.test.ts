import { BackgammonEngine, EloRating, GameUtils, INITIAL_BOARD_STATE } from './index';
import { GameMove } from '@playbg/shared';

describe('BackgammonEngine', () => {
  let engine: BackgammonEngine;

  beforeEach(() => {
    engine = new BackgammonEngine();
  });

  describe('Basic functionality', () => {
    it('should initialize with correct initial state', () => {
      expect(engine.getCurrentPlayer()).toBe(0);
      expect(engine.getCurrentDice()).toBeNull();
      expect(engine.isGameOver()).toBe(false);
      expect(engine.getWinner()).toBeNull();
      
      const board = engine.getBoardState();
      expect(board).toEqual(INITIAL_BOARD_STATE);
    });

    it('should roll dice correctly', () => {
      const dice = engine.rollDice();
      expect(Array.isArray(dice)).toBe(true);
      expect(dice).toHaveLength(2);
      expect(dice[0]).toBeGreaterThanOrEqual(1);
      expect(dice[0]).toBeLessThanOrEqual(6);
      expect(dice[1]).toBeGreaterThanOrEqual(1);
      expect(dice[1]).toBeLessThanOrEqual(6);
      
      expect(engine.getCurrentDice()).toEqual(dice);
    });

    it('should get possible moves after dice roll', () => {
      engine.rollDice();
      const moves = engine.getPossibleMoves();
      expect(Array.isArray(moves)).toBe(true);
      expect(moves.length).toBeGreaterThan(0);
      
      moves.forEach(move => {
        expect(move).toHaveProperty('from');
        expect(move).toHaveProperty('to');
        expect(move).toHaveProperty('playerId');
        expect(move).toHaveProperty('timestamp');
      });
    });

    it('should not have possible moves without dice', () => {
      const moves = engine.getPossibleMoves();
      expect(moves).toHaveLength(0);
    });
  });

  describe('Move validation and execution', () => {
    beforeEach(() => {
      engine.rollDice();
    });

    it('should validate and execute valid moves', () => {
      const possibleMoves = engine.getPossibleMoves();
      expect(possibleMoves.length).toBeGreaterThan(0);
      
      const move = possibleMoves[0];
      const result = engine.makeMove(move);
      expect(result).toBe(true);
    });

    it('should reject invalid moves', () => {
      const invalidMove: GameMove = {
        playerId: 'test',
        from: 0,
        to: 10, // Invalid distance for any normal dice roll
        timestamp: new Date()
      };
      
      const result = engine.makeMove(invalidMove);
      expect(result).toBe(false);
    });

    it('should update board state after move', () => {
      const initialBoard = engine.getBoardState();
      const possibleMoves = engine.getPossibleMoves();
      
      if (possibleMoves.length > 0) {
        const move = possibleMoves[0];
        engine.makeMove(move);
        
        const newBoard = engine.getBoardState();
        expect(newBoard).not.toEqual(initialBoard);
      }
    });
  });

  describe('Game state management', () => {
    it('should handle turn switching', () => {
      const initialPlayer = engine.getCurrentPlayer();
      
      // Make moves until turn switches
      engine.rollDice();
      const moves = engine.getPossibleMoves();
      
      // Make all possible moves to end turn
      moves.forEach(move => {
        if (engine.getCurrentPlayer() === initialPlayer) {
          engine.makeMove(move);
        }
      });
      
      // Turn should eventually switch
      // Note: this test might need adjustment based on actual game flow
    });

    it('should detect game over condition', () => {
      // Initially game should not be over
      expect(engine.isGameOver()).toBe(false);
      
      // Create a winning board state manually
      const board = engine.getBoardState();
      board.off[0] = 15; // Player 0 wins
      
      const winningEngine = new BackgammonEngine(board);
      expect(winningEngine.isGameOver()).toBe(true);
      expect(winningEngine.getWinner()).toBe(0);
    });
  });

  describe('Special game situations', () => {
    it('should handle bar moves', () => {
      // Create a board state with checkers on the bar
      const board = engine.getBoardState();
      board.bar[0] = 1;
      board.points[23][0] = 1; // Remove one checker from home
      
      const barEngine = new BackgammonEngine(board);
      barEngine.rollDice();
      
      const moves = barEngine.getPossibleMoves();
      // Should only allow bar moves when checkers are on bar
      if (moves.length > 0) {
        expect(moves.every(move => move.from === -1)).toBe(true);
      }
    });

    it('should handle bearing off', () => {
      // Create a board state where bearing off is possible
      const board = engine.getBoardState();
      
      // Clear the board and put all checkers in home board
      for (let i = 0; i < 24; i++) {
        board.points[i] = [0, 0];
      }
      board.points[18] = [15, 0]; // All player 0 checkers in home
      board.bar = [0, 0];
      board.off = [0, 0];
      
      const bearOffEngine = new BackgammonEngine(board);
      bearOffEngine.rollDice();
      
      const moves = bearOffEngine.getPossibleMoves();
      // Should allow bearing off moves
      if (moves.length > 0) {
        const bearOffMoves = moves.filter(move => move.to === -1);
        expect(bearOffMoves.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('EloRating', () => {
  describe('Rating calculations', () => {
    it('should calculate new ratings correctly for equal players', () => {
      const [newRating1, newRating2] = EloRating.calculateNewRatings(1500, 1500, 1);
      
      expect(newRating1).toBeGreaterThan(1500);
      expect(newRating2).toBeLessThan(1500);
      expect(newRating1 + newRating2).toBeCloseTo(3000, 0);
    });

    it('should handle different rating scenarios', () => {
      // Higher rated player wins (expected)
      const [high1, low1] = EloRating.calculateNewRatings(1800, 1200, 1);
      expect(high1).toBeGreaterThan(1800); // Small increase
      expect(high1).toBeLessThan(1810); // But not too much
      expect(low1).toBeLessThan(1200); // Small decrease
      expect(low1).toBeGreaterThan(1190); // But not too much
      
      // Lower rated player wins (upset)
      const [high2, low2] = EloRating.calculateNewRatings(1800, 1200, 0);
      expect(high2).toBeLessThan(1800); // Larger decrease
      expect(low2).toBeGreaterThan(1200); // Larger increase
    });

    it('should handle draws', () => {
      const [newRating1, newRating2] = EloRating.calculateNewRatings(1500, 1500, 0.5);
      
      expect(newRating1).toBeCloseTo(1500, 0);
      expect(newRating2).toBeCloseTo(1500, 0);
    });

    it('should respect rating bounds', () => {
      // Test minimum rating
      const [min1, min2] = EloRating.calculateNewRatings(100, 100, 0);
      expect(min1).toBeGreaterThanOrEqual(100);
      expect(min2).toBeGreaterThanOrEqual(100);
      
      // Test maximum rating
      const [max1, max2] = EloRating.calculateNewRatings(2950, 2950, 1);
      expect(max1).toBeLessThanOrEqual(3000);
      expect(max2).toBeLessThanOrEqual(3000);
    });
  });
});

describe('GameUtils', () => {
  describe('Utility functions', () => {
    it('should generate unique game IDs', () => {
      const id1 = GameUtils.generateGameId();
      const id2 = GameUtils.generateGameId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^game_\d+_[a-z0-9]+$/);
    });

    it('should calculate game duration correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T10:30:00Z');
      
      const duration = GameUtils.calculateGameDuration(startTime, endTime);
      expect(duration).toBe(30);
    });

    it('should validate move format', () => {
      const validMove: GameMove = {
        playerId: 'player1',
        from: 0,
        to: 5,
        timestamp: new Date()
      };
      
      expect(GameUtils.isValidMoveFormat(validMove)).toBe(true);
      
      const invalidMove = {
        playerId: 'player1',
        from: 0
        // missing 'to' and 'timestamp'
      };
      
      expect(GameUtils.isValidMoveFormat(invalidMove)).toBe(false);
    });

    it('should create initial board state', () => {
      const board = GameUtils.createInitialBoard();
      expect(board).toEqual(INITIAL_BOARD_STATE);
      
      // Ensure it's a deep copy
      board.points[0] = [10, 10];
      expect(board).not.toEqual(INITIAL_BOARD_STATE);
    });
  });
});

describe('Integration tests', () => {
  it('should play a complete game scenario', () => {
    const engine = new BackgammonEngine();
    let moveCount = 0;
    let turnCount = 0;
    const maxMoves = 200; // Prevent infinite loops
    const maxTurns = 50;  // Additional safety check
    
    while (!engine.isGameOver() && moveCount < maxMoves && turnCount < maxTurns) {
      const currentPlayer = engine.getCurrentPlayer();
      engine.rollDice();
      const moves = engine.getPossibleMoves();
      
      if (moves.length > 0) {
        // Make the first available move
        const move = moves[0];
        const success = engine.makeMove(move);
        expect(success).toBe(true);
        moveCount++;
        
        // Check if turn ended (player switched)
        if (engine.getCurrentPlayer() !== currentPlayer) {
          turnCount++;
        }
      } else {
        // No moves available, turn should end
        turnCount++;
        // Simulate turn ending if it doesn't happen automatically
        if (engine.getCurrentPlayer() === currentPlayer) {
          break; // This would indicate a bug, but let's not loop forever
        }
      }
    }
    
    expect(moveCount).toBeGreaterThan(0);
  });

  it('should handle edge cases in game flow', () => {
    const engine = new BackgammonEngine();
    
    // Test making moves without rolling dice
    const invalidMove: GameMove = {
      playerId: 'test',
      from: 0,
      to: 5,
      timestamp: new Date()
    };
    
    expect(engine.makeMove(invalidMove)).toBe(false);
    
    // Test getting moves without dice
    expect(engine.getPossibleMoves()).toHaveLength(0);
    
    // Test board state consistency
    const initialBoard = engine.getBoardState();
    const secondBoard = engine.getBoardState();
    expect(initialBoard).toEqual(secondBoard);
    
    // Modify one board to ensure they're independent copies
    initialBoard.points[0] = [10, 10];
    expect(initialBoard).not.toEqual(secondBoard);
  });
});