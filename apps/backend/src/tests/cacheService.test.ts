import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getRedisService } from '../services/redisService';
import { cacheService, LeaderboardEntry } from '../services/cacheService';
import { statisticsService } from '../services/statisticsService';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { User } from '../models/User';

describe('Cache Service Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Redis (assuming Redis is running locally for tests)
    try {
      await getRedisService().connect();
    } catch (error) {
      console.log('Redis not available for tests, skipping Redis-dependent tests');
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    try {
      await getRedisService().disconnect();
    } catch (error) {
      // Redis might not be connected
    }
  });

  beforeEach(async () => {
    // Clean up database and cache before each test
    await User.deleteMany({});
    try {
      await cacheService.invalidateAll();
    } catch (error) {
      // Cache might not be available
    }
  });

  describe('Cache Health', () => {
    it('should return cache health status', async () => {
      const health = await cacheService.getCacheHealth();
      
      expect(health).toHaveProperty('connected');
      expect(health).toHaveProperty('keyCount');
      expect(typeof health.connected).toBe('boolean');
      expect(typeof health.keyCount).toBe('number');
    });
  });

  describe('Leaderboard Caching', () => {
    it('should cache and retrieve leaderboard data', async () => {
      // Create test users
      const users = await User.create([
        {
          username: 'player1',
          email: 'player1@test.com',
          password: 'password123',
          rating: 1500,
          gamesPlayed: 10,
          gamesWon: 8
        },
        {
          username: 'player2',
          email: 'player2@test.com',
          password: 'password123',
          rating: 1400,
          gamesPlayed: 8,
          gamesWon: 5
        },
        {
          username: 'player3',
          email: 'player3@test.com',
          password: 'password123',
          rating: 1600,
          gamesPlayed: 12,
          gamesWon: 10
        }
      ]);

      // Test leaderboard generation and caching
      const leaderboard = await statisticsService.getLeaderboard('overall', 1, 10);
      
      expect(leaderboard.data).toHaveLength(3);
      expect(leaderboard.data[0].rating).toBe(1600); // Highest rated first
      expect(leaderboard.data[1].rating).toBe(1500);
      expect(leaderboard.data[2].rating).toBe(1400);
      expect(leaderboard.pagination.total).toBe(3);

      // Test that subsequent calls use cache (this would be faster in real scenario)
      const cachedLeaderboard = await statisticsService.getLeaderboard('overall', 1, 10);
      expect(cachedLeaderboard.data).toEqual(leaderboard.data);
    });

    it('should handle cache invalidation', async () => {
      // Create a test user
      const user = await User.create({
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
        rating: 1200,
        gamesPlayed: 5,
        gamesWon: 3
      });

      // Generate initial leaderboard
      await statisticsService.getLeaderboard('overall', 1, 10);

      // Invalidate leaderboard cache
      await cacheService.invalidateLeaderboard('overall');

      // This should work without errors
      const newLeaderboard = await statisticsService.getLeaderboard('overall', 1, 10);
      expect(newLeaderboard.data).toHaveLength(1);
    });
  });

  describe('User Statistics Caching', () => {
    it('should cache and retrieve user statistics', async () => {
      // Create test user
      const user = await User.create({
        username: 'statsuser',
        email: 'stats@test.com',
        password: 'password123',
        rating: 1300,
        gamesPlayed: 15,
        gamesWon: 10
      });

      // Get user statistics (should generate and cache)
      const stats = await statisticsService.getUserStatistics((user as any)._id.toString());
      
      expect(stats).toHaveProperty('totalGames');
      expect(stats).toHaveProperty('wins');
      expect(stats).toHaveProperty('losses');
      expect(stats).toHaveProperty('winRate');
      expect(stats.totalGames).toBe(0); // No actual games created in this test
      expect(stats.winRate).toBe(0);

      // Test cache retrieval
      const cachedStats = await statisticsService.getUserStatistics((user as any)._id.toString());
      expect(cachedStats).toEqual(stats);
    });

    it('should handle user statistics cache invalidation', async () => {
      const user = await User.create({
        username: 'invalidateuser',
        email: 'invalidate@test.com',
        password: 'password123',
        rating: 1250,
        gamesPlayed: 8,
        gamesWon: 6
      });

      // Generate initial statistics
      await statisticsService.getUserStatistics((user as any)._id.toString());

      // Invalidate user statistics
      await cacheService.invalidateUserStatistics((user as any)._id.toString());

      // This should work without errors
      const newStats = await statisticsService.getUserStatistics((user as any)._id.toString());
      expect(newStats).toHaveProperty('totalGames');
    });
  });

  describe('Global Statistics Caching', () => {
    it('should cache and retrieve global statistics', async () => {
      // Create some test users
      await User.create([
        {
          username: 'global1',
          email: 'global1@test.com',
          password: 'password123',
          rating: 1400,
          gamesPlayed: 5,
          gamesWon: 3
        },
        {
          username: 'global2',
          email: 'global2@test.com',
          password: 'password123',
          rating: 1300,
          gamesPlayed: 7,
          gamesWon: 4
        }
      ]);

      // Get global statistics
      const globalStats = await statisticsService.getGlobalStatistics();
      
      expect(globalStats).toHaveProperty('totalUsers');
      expect(globalStats).toHaveProperty('totalGames');
      expect(globalStats).toHaveProperty('activeUsers');
      expect(globalStats).toHaveProperty('averageRating');
      expect(globalStats).toHaveProperty('topRating');
      expect(globalStats.totalUsers).toBe(2);
      expect(globalStats.topRating).toBe(1400);
    });
  });

  describe('Cache Invalidation Service', () => {
    it('should handle game completion invalidation event', async () => {
      const user1 = await User.create({
        username: 'player1',
        email: 'player1@test.com',
        password: 'password123',
        rating: 1400,
        gamesPlayed: 5,
        gamesWon: 3
      });

      const user2 = await User.create({
        username: 'player2',
        email: 'player2@test.com',
        password: 'password123',
        rating: 1300,
        gamesPlayed: 6,
        gamesWon: 2
      });

      // Trigger game completion invalidation
      await cacheInvalidationService.handleInvalidation({
        type: 'game_completed',
        userId: (user1 as any)._id.toString(),
        gameId: 'test-game-123',
        affectedUsers: [(user2 as any)._id.toString()],
        reason: 'Test game completed'
      });

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle rating change invalidation event', async () => {
      const user = await User.create({
        username: 'ratinguser',
        email: 'rating@test.com',
        password: 'password123',
        rating: 1350,
        gamesPlayed: 10,
        gamesWon: 6
      });

      // Trigger rating change invalidation
      await cacheInvalidationService.handleInvalidation({
        type: 'rating_changed',
        userId: (user as any)._id.toString(),
        reason: 'Test rating change'
      });

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should get invalidation statistics', async () => {
      const stats = await cacheInvalidationService.getInvalidationStats();
      
      expect(stats).toHaveProperty('totalInvalidations');
      expect(stats).toHaveProperty('invalidationsByType');
      expect(typeof stats.totalInvalidations).toBe('number');
      expect(typeof stats.invalidationsByType).toBe('object');
    });
  });

  describe('Cache Warming', () => {
    it('should warm caches without errors', async () => {
      // Create some test data
      await User.create([
        {
          username: 'warm1',
          email: 'warm1@test.com',
          password: 'password123',
          rating: 1500,
          gamesPlayed: 8,
          gamesWon: 5
        },
        {
          username: 'warm2',
          email: 'warm2@test.com',
          password: 'password123',
          rating: 1400,
          gamesPlayed: 6,
          gamesWon: 4
        }
      ]);

      // Test cache warming
      await expect(cacheService.warmLeaderboardCache()).resolves.not.toThrow();
      await expect(cacheService.warmGlobalStatsCache()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty leaderboard gracefully', async () => {
      const leaderboard = await statisticsService.getLeaderboard('overall', 1, 10);
      
      expect(leaderboard.data).toHaveLength(0);
      expect(leaderboard.pagination.total).toBe(0);
      expect(leaderboard.pagination.totalPages).toBe(0);
    });

    it('should handle non-existent user statistics gracefully', async () => {
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        statisticsService.getUserStatistics(fakeUserId)
      ).rejects.toThrow('User not found');
    });
  });
});