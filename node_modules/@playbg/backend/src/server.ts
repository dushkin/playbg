import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import winston from 'winston';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import tournamentRoutes from './routes/tournaments';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';

// Import socket handlers
import { setupSocketHandlers } from './socket/socketHandlers';

// Import services
import { redisService } from './services/redisService';
import { gameStateManager } from './services/gameStateManager';
import { rateLimitService } from './services/rateLimitService';
import { cacheInvalidationService } from './services/cacheInvalidationService';
import { monitoringService } from './services/monitoringService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { requestMetricsMiddleware, errorTrackingMiddleware } from './middleware/monitoring';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = createServer(app);

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'playbg-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add monitoring middleware
app.use(requestMetricsMiddleware);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rate limit stats endpoint (for monitoring)
app.get('/api/admin/rate-limit-stats/:userId/:action?', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin (you would implement proper admin check)
    const { userId, action } = req.params;
    
    if (action) {
      const stats = await rateLimitService.getStats(userId, action);
      res.json({
        success: true,
        data: stats
      });
    } else {
      // Return general info for monitoring
      res.json({
        success: true,
        message: 'Rate limiting active',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Rate limit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit stats'
    });
  }
});

// API Routes with rate limiting
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), userRoutes);
app.use('/api/games', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), gameRoutes);
app.use('/api/tournaments', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), tournamentRoutes);
app.use('/api/admin', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), adminRoutes);
app.use('/health', healthRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Error handling middleware
app.use(errorTrackingMiddleware);
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/playbg';
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Redis connection
const connectRedis = async () => {
  try {
    await redisService.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection error:', error);
    // Don't exit on Redis failure - app can work without it but with limited functionality
  }
};

// Cleanup task for inactive games and rate limits (runs every 30 minutes)
const setupCleanupTasks = () => {
  setInterval(async () => {
    try {
      await gameStateManager.cleanupInactiveGames(60); // Clean games inactive for 60+ minutes
      await redisService.cleanupExpiredSessions();
      await rateLimitService.cleanup(); // Clean expired rate limit data
    } catch (error) {
      logger.error('Cleanup task error:', error);
    }
  }, 30 * 60 * 1000); // 30 minutes
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();
    
    // Setup cleanup tasks
    setupCleanupTasks();
    
    // Initialize cache warming
    await cacheInvalidationService.schedulePeriodicWarming();
    
    // Warm initial caches
    setTimeout(() => {
      cacheInvalidationService.warmAllCaches().catch(error => {
        logger.error('Initial cache warming failed:', error);
      });
    }, 5000); // Wait 5 seconds after startup
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Active games: ${gameStateManager.getActiveGamesCount()}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Shutting down gracefully...');
    
    // Close server
    server.close();
    
    // Disconnect from databases
    await mongoose.connection.close();
    await redisService.disconnect();
    
    logger.info('Process terminated');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

startServer();

export { app, io, logger };