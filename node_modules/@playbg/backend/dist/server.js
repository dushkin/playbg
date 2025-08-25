"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const winston_1 = __importDefault(require("winston"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const games_1 = __importDefault(require("./routes/games"));
const tournaments_1 = __importDefault(require("./routes/tournaments"));
const admin_1 = __importDefault(require("./routes/admin"));
const health_1 = __importDefault(require("./routes/health"));
// Import socket handlers
const socketHandlers_1 = require("./socket/socketHandlers");
// Import services
const redisService_1 = require("./services/redisService");
const gameStateManager_1 = require("./services/gameStateManager");
const rateLimitService_1 = require("./services/rateLimitService");
const cacheInvalidationService_1 = require("./services/cacheInvalidationService");
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const auth_2 = require("./middleware/auth");
const monitoring_1 = require("./middleware/monitoring");
// Load environment variables
dotenv_1.default.config();
// Create Express app
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
// Setup Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
exports.io = io;
// Setup logging
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'playbg-backend' },
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
exports.logger = logger;
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple()
    }));
}
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Add monitoring middleware
app.use(monitoring_1.requestMetricsMiddleware);
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
app.get('/api/admin/rate-limit-stats/:userId/:action?', auth_2.authMiddleware, async (req, res) => {
    try {
        // Check if user is admin (you would implement proper admin check)
        const { userId, action } = req.params;
        if (action) {
            const stats = await rateLimitService_1.rateLimitService.getStats(userId, action);
            res.json({
                success: true,
                data: stats
            });
        }
        else {
            // Return general info for monitoring
            res.json({
                success: true,
                message: 'Rate limiting active',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        logger.error('Rate limit stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve rate limit stats'
        });
    }
});
// API Routes with rate limiting
app.use('/api/auth', auth_1.default);
app.use('/api/users', auth_2.authMiddleware, rateLimitService_1.rateLimitService.createExpressMiddleware('api:general'), users_1.default);
app.use('/api/games', auth_2.authMiddleware, rateLimitService_1.rateLimitService.createExpressMiddleware('api:general'), games_1.default);
app.use('/api/tournaments', auth_2.authMiddleware, rateLimitService_1.rateLimitService.createExpressMiddleware('api:general'), tournaments_1.default);
app.use('/api/admin', auth_2.authMiddleware, rateLimitService_1.rateLimitService.createExpressMiddleware('api:general'), admin_1.default);
app.use('/health', health_1.default);
// Setup Socket.IO handlers
(0, socketHandlers_1.setupSocketHandlers)(io);
// Error handling middleware
app.use(monitoring_1.errorTrackingMiddleware);
app.use(errorHandler_1.errorHandler);
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
        await mongoose_1.default.connect(mongoURI);
        logger.info('MongoDB connected successfully');
    }
    catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
// Redis connection
const connectRedis = async () => {
    try {
        await redisService_1.redisService.connect();
        logger.info('Redis connected successfully');
    }
    catch (error) {
        logger.error('Redis connection error:', error);
        // Don't exit on Redis failure - app can work without it but with limited functionality
    }
};
// Cleanup task for inactive games and rate limits (runs every 30 minutes)
const setupCleanupTasks = () => {
    setInterval(async () => {
        try {
            await gameStateManager_1.gameStateManager.cleanupInactiveGames(60); // Clean games inactive for 60+ minutes
            await redisService_1.redisService.cleanupExpiredSessions();
            await rateLimitService_1.rateLimitService.cleanup(); // Clean expired rate limit data
        }
        catch (error) {
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
        await cacheInvalidationService_1.cacheInvalidationService.schedulePeriodicWarming();
        // Warm initial caches
        setTimeout(() => {
            cacheInvalidationService_1.cacheInvalidationService.warmAllCaches().catch(error => {
                logger.error('Initial cache warming failed:', error);
            });
        }, 5000); // Wait 5 seconds after startup
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Active games: ${gameStateManager_1.gameStateManager.getActiveGamesCount()}`);
        });
    }
    catch (error) {
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
        await mongoose_1.default.connection.close();
        await redisService_1.redisService.disconnect();
        logger.info('Process terminated');
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    server.close(() => {
        process.exit(1);
    });
});
startServer();
//# sourceMappingURL=server.js.map