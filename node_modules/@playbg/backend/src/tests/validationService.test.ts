import { validationService } from '../services/validationService';
import { GameMove, GameType, GameSpeed, TournamentType, TournamentFormat, BoardState, INITIAL_BOARD_STATE } from '@playbg/shared';

describe('ValidationService', () => {
  describe('validateGameMove', () => {
    const mockContext = {
      boardState: INITIAL_BOARD_STATE,
      currentPlayer: 0 as 0 | 1,
      dice: [3, 4] as [number, number],
      playerId: 'player123',
      gameEnded: false
    };

    it('should validate a proper game move', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 5,
        to: 9,
        timestamp: new Date()
      };

      const result = validationService.validateGameMove(move, mockContext);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toBeDefined();
    });

    it('should reject moves in finished games', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 5,
        to: 9,
        timestamp: new Date()
      };

      const endedContext = { ...mockContext, gameEnded: true };
      const result = validationService.validateGameMove(move, endedContext);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('finished game');
    });

    it('should reject moves without dice', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 5,
        to: 9,
        timestamp: new Date()
      };

      const noDiceContext = { ...mockContext, dice: null };
      const result = validationService.validateGameMove(move, noDiceContext);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('No dice rolled');
    });

    it('should reject moves with invalid distance', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 5,
        to: 12, // Distance of 7, not in dice [3, 4]
        timestamp: new Date()
      };

      const result = validationService.validateGameMove(move, mockContext);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid move distance');
    });

    it('should reject moves from same position to same position', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 5,
        to: 5,
        timestamp: new Date()
      };

      const result = validationService.validateGameMove(move, mockContext);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('same position');
    });

    it('should reject moves with invalid position ranges', () => {
      const move: GameMove = {
        playerId: 'player123',
        from: 26, // Invalid position
        to: 5,
        timestamp: new Date()
      };

      const result = validationService.validateGameMove(move, mockContext);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateChatMessage', () => {
    it('should validate proper chat messages', () => {
      const result = validationService.validateChatMessage('Hello there!', 'user123', 'chat');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toEqual({
        message: 'Hello there!',
        userId: 'user123',
        type: 'chat'
      });
    });

    it('should reject empty messages', () => {
      const result = validationService.validateChatMessage('', 'user123', 'chat');
      expect(result.isValid).toBe(false);
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(501);
      const result = validationService.validateChatMessage(longMessage, 'user123', 'chat');
      expect(result.isValid).toBe(false);
    });

    it('should reject messages with profanity', () => {
      const result = validationService.validateChatMessage('This is spam', 'user123', 'chat');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('inappropriate content');
    });

    it('should reject spam messages with repeated characters', () => {
      const result = validationService.validateChatMessage('aaaaaaaaa', 'user123', 'chat');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('spam');
    });

    it('should reject messages with excessive caps', () => {
      const result = validationService.validateChatMessage('HELLO EVERYONE THIS IS SHOUTING', 'user123', 'chat');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('spam');
    });

    it('should sanitize and trim messages', () => {
      const result = validationService.validateChatMessage('  Hello World  ', 'user123', 'chat');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.message).toBe('Hello World');
    });
  });

  describe('validateUserRegistration', () => {
    it('should validate proper user registration data', () => {
      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.username).toBe('testuser123');
      expect(result.sanitizedData?.email).toBe('test@example.com');
    });

    it('should reject short usernames', () => {
      const userData = {
        username: 'ab',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject non-alphanumeric usernames', () => {
      const userData = {
        username: 'test-user!',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid email addresses', () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(false);
    });

    it('should reject weak passwords', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Password must contain');
    });

    it('should reject mismatched passwords', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must match');
    });

    it('should normalize email to lowercase', () => {
      const userData = {
        username: 'testuser',
        email: 'TEST@EXAMPLE.COM',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const result = validationService.validateUserRegistration(userData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.email).toBe('test@example.com');
    });
  });

  describe('validateUserLogin', () => {
    it('should validate proper login data', () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = validationService.validateUserLogin(loginData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.email).toBe('test@example.com');
    });

    it('should reject invalid email format', () => {
      const loginData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = validationService.validateUserLogin(loginData);
      expect(result.isValid).toBe(false);
    });

    it('should reject empty password', () => {
      const loginData = {
        email: 'test@example.com',
        password: ''
      };

      const result = validationService.validateUserLogin(loginData);
      expect(result.isValid).toBe(false);
    });

    it('should normalize email to lowercase', () => {
      const loginData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const result = validationService.validateUserLogin(loginData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.email).toBe('test@example.com');
    });
  });

  describe('validateGameCreation', () => {
    it('should validate proper game creation data', () => {
      const gameData = {
        gameType: GameType.CASUAL,
        gameSpeed: GameSpeed.STANDARD,
        isPrivate: false
      };

      const result = validationService.validateGameCreation(gameData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.gameType).toBe(GameType.CASUAL);
    });

    it('should reject private games without opponent ID', () => {
      const gameData = {
        gameType: GameType.PRIVATE,
        gameSpeed: GameSpeed.STANDARD,
        isPrivate: true
      };

      const result = validationService.validateGameCreation(gameData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('require an opponent ID');
    });

    it('should reject ranked games with stakes', () => {
      const gameData = {
        gameType: GameType.RANKED,
        gameSpeed: GameSpeed.STANDARD,
        stakes: 100
      };

      const result = validationService.validateGameCreation(gameData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot have stakes');
    });

    it('should reject invalid game types', () => {
      const gameData = {
        gameType: 'invalid_type',
        gameSpeed: GameSpeed.STANDARD
      };

      const result = validationService.validateGameCreation(gameData);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateTournamentCreation', () => {
    it('should validate proper tournament creation data', () => {
      const tournamentData = {
        name: 'Test Tournament',
        description: 'A test tournament',
        type: TournamentType.SINGLE_ELIMINATION,
        format: TournamentFormat.MATCH_PLAY,
        maxPlayers: 8,
        entryFee: 0,
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        rules: {
          matchLength: 7,
          timeControl: GameSpeed.STANDARD,
          doubleAllowed: true,
          crawfordRule: true
        }
      };

      const result = validationService.validateTournamentCreation(tournamentData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).toBe('Test Tournament');
    });

    it('should reject tournaments with invalid names', () => {
      const tournamentData = {
        name: 'T!',
        type: TournamentType.SINGLE_ELIMINATION,
        format: TournamentFormat.MATCH_PLAY,
        maxPlayers: 8,
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        rules: {
          matchLength: 7,
          timeControl: GameSpeed.STANDARD,
          doubleAllowed: true,
          crawfordRule: true
        }
      };

      const result = validationService.validateTournamentCreation(tournamentData);
      expect(result.isValid).toBe(false);
    });

    it('should reject tournaments starting too soon', () => {
      const tournamentData = {
        name: 'Test Tournament',
        type: TournamentType.SINGLE_ELIMINATION,
        format: TournamentFormat.MATCH_PLAY,
        maxPlayers: 8,
        startTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now (too soon)
        rules: {
          matchLength: 7,
          timeControl: GameSpeed.STANDARD,
          doubleAllowed: true,
          crawfordRule: true
        }
      };

      const result = validationService.validateTournamentCreation(tournamentData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 30 minutes');
    });

    it('should reject elimination tournaments with non-power-of-2 players', () => {
      const tournamentData = {
        name: 'Test Tournament',
        type: TournamentType.SINGLE_ELIMINATION,
        format: TournamentFormat.MATCH_PLAY,
        maxPlayers: 7, // Not a power of 2
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        rules: {
          matchLength: 7,
          timeControl: GameSpeed.STANDARD,
          doubleAllowed: true,
          crawfordRule: true
        }
      };

      const result = validationService.validateTournamentCreation(tournamentData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('power of 2');
    });

    it('should sanitize tournament name and description', () => {
      const tournamentData = {
        name: '  Test Tournament  ',
        description: '  A test tournament  ',
        type: TournamentType.SINGLE_ELIMINATION,
        format: TournamentFormat.MATCH_PLAY,
        maxPlayers: 8,
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        rules: {
          matchLength: 7,
          timeControl: GameSpeed.STANDARD,
          doubleAllowed: true,
          crawfordRule: true
        }
      };

      const result = validationService.validateTournamentCreation(tournamentData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).toBe('Test Tournament');
      expect(result.sanitizedData?.description).toBe('A test tournament');
    });
  });

  describe('validateSocketEvent', () => {
    it('should validate matchmaking:join events', () => {
      const eventData = {
        gameSpeed: GameSpeed.STANDARD,
        gameType: GameType.CASUAL,
        isPrivate: false
      };

      const result = validationService.validateSocketEvent('matchmaking:join', eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.gameSpeed).toBe(GameSpeed.STANDARD);
    });

    it('should validate game:join events', () => {
      const eventData = {
        gameId: 'game123'
      };

      const result = validationService.validateSocketEvent('game:join', eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.gameId).toBe('game123');
    });

    it('should validate game:move events', () => {
      const eventData = {
        gameId: 'game123',
        move: {
          from: 5,
          to: 9
        }
      };

      const result = validationService.validateSocketEvent('game:move', eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.gameId).toBe('game123');
      expect(result.sanitizedData?.move.from).toBe(5);
    });

    it('should validate game:chat events', () => {
      const eventData = {
        gameId: 'game123',
        message: 'Hello everyone!'
      };

      const result = validationService.validateSocketEvent('game:chat', eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.message).toBe('Hello everyone!');
    });

    it('should reject unknown socket events', () => {
      const eventData = { test: 'data' };

      const result = validationService.validateSocketEvent('unknown:event', eventData);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown socket event');
    });

    it('should reject invalid data for known events', () => {
      const eventData = {
        gameId: '' // Empty game ID
      };

      const result = validationService.validateSocketEvent('game:join', eventData);
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      const result = validationService.sanitizeString('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should remove dangerous characters', () => {
      const result = validationService.sanitizeString('hello<script>alert("xss")</script>world');
      expect(result).toBe('helloscriptalert(xss)/scriptworld');
    });

    it('should normalize whitespace', () => {
      const result = validationService.sanitizeString('hello    world\n\ntest');
      expect(result).toBe('hello world test');
    });

    it('should truncate to max length', () => {
      const result = validationService.sanitizeString('a'.repeat(300), 10);
      expect(result).toBe('a'.repeat(10));
    });

    it('should handle non-string input', () => {
      const result = validationService.sanitizeString(123 as any);
      expect(result).toBe('');
    });
  });

  describe('sanitizeNumber', () => {
    it('should parse valid numbers', () => {
      expect(validationService.sanitizeNumber('123')).toBe(123);
      expect(validationService.sanitizeNumber(456)).toBe(456);
      expect(validationService.sanitizeNumber('123.45')).toBe(123.45);
    });

    it('should enforce min and max bounds', () => {
      expect(validationService.sanitizeNumber(5, 10, 20)).toBe(10);
      expect(validationService.sanitizeNumber(25, 10, 20)).toBe(20);
      expect(validationService.sanitizeNumber(15, 10, 20)).toBe(15);
    });

    it('should return min for invalid input', () => {
      expect(validationService.sanitizeNumber('invalid', 5, 10)).toBe(5);
      expect(validationService.sanitizeNumber(null, 5, 10)).toBe(5);
      expect(validationService.sanitizeNumber(undefined, 5, 10)).toBe(5);
    });
  });

  describe('sanitizeBoolean', () => {
    it('should handle boolean values', () => {
      expect(validationService.sanitizeBoolean(true)).toBe(true);
      expect(validationService.sanitizeBoolean(false)).toBe(false);
    });

    it('should handle string values', () => {
      expect(validationService.sanitizeBoolean('true')).toBe(true);
      expect(validationService.sanitizeBoolean('TRUE')).toBe(true);
      expect(validationService.sanitizeBoolean('false')).toBe(false);
      expect(validationService.sanitizeBoolean('anything')).toBe(false);
    });

    it('should handle other types', () => {
      expect(validationService.sanitizeBoolean(1)).toBe(true);
      expect(validationService.sanitizeBoolean(0)).toBe(false);
      expect(validationService.sanitizeBoolean(null)).toBe(false);
      expect(validationService.sanitizeBoolean(undefined)).toBe(false);
    });
  });
});

// Integration tests
describe('Validation Integration', () => {
  it('should handle complete game flow validation', () => {
    // Test user registration
    const userData = {
      username: 'player1',
      email: 'player1@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!'
    };
    
    const userResult = validationService.validateUserRegistration(userData);
    expect(userResult.isValid).toBe(true);

    // Test game creation
    const gameData = {
      gameType: GameType.CASUAL,
      gameSpeed: GameSpeed.STANDARD,
      isPrivate: false
    };
    
    const gameResult = validationService.validateGameCreation(gameData);
    expect(gameResult.isValid).toBe(true);

    // Test socket event validation
    const socketData = {
      gameId: 'game123',
      message: 'Good game!'
    };
    
    const socketResult = validationService.validateSocketEvent('game:chat', socketData);
    expect(socketResult.isValid).toBe(true);
  });

  it('should reject malicious input across all validators', () => {
    const maliciousString = '<script>alert("xss")</script>';
    
    // Test various validators with malicious input
    const chatResult = validationService.validateChatMessage(maliciousString, 'user123');
    // Should either reject or sanitize the malicious content
    expect(chatResult.isValid).toBe(false);

    const sanitized = validationService.sanitizeString(maliciousString);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  });
});