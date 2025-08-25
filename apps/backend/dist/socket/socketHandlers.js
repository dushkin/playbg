"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Tournament_1 = require("../models/Tournament");
const shared_1 = require("@playbg/shared");
const gameStateManager_1 = require("../services/gameStateManager");
const redisService_1 = require("../services/redisService");
const rateLimitService_1 = require("../services/rateLimitService");
const validationService_1 = require("../services/validationService");
const logger_1 = require("../utils/logger");
// Rate limit helper for socket events
const checkSocketRateLimit = async (socket, action, callback) => {
    if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return false;
    }
    const result = await rateLimitService_1.rateLimitService.checkLimit(socket.userId, action);
    if (!result.allowed) {
        socket.emit('rate_limit_exceeded', {
            action,
            message: result.error,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            remaining: result.remainingRequests
        });
        logger_1.logger.warn(`Rate limit exceeded for ${socket.username} (${socket.userId}) on action: ${action}`);
        return false;
    }
    return true;
};
// Validation helper for socket events
const validateSocketEvent = (socket, eventName, data) => {
    if (!socket.userId) {
        return { isValid: false, error: 'Authentication required' };
    }
    const validationResult = validationService_1.validationService.validateSocketEvent(eventName, data);
    if (!validationResult.isValid) {
        socket.emit('validation_error', {
            event: eventName,
            message: validationResult.error
        });
        logger_1.logger.warn(`Validation failed for ${socket.username} (${socket.userId}) on event ${eventName}: ${validationResult.error}`);
        return { isValid: false, error: validationResult.error };
    }
    return {
        isValid: true,
        sanitizedData: validationResult.sanitizedData
    };
};
const setupSocketHandlers = (io) => {
    // Authentication middleware for socket connections
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return next(new Error('JWT secret not configured'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            const user = await User_1.User.findById(decoded.userId);
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.userId = user._id.toString();
            socket.username = user.username;
            // Update user online status
            user.isOnline = true;
            user.lastSeen = new Date();
            await user.save();
            next();
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`User ${socket.username} connected with socket ID: ${socket.id}`);
        // Join user to their personal room
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
        }
        // Handle matchmaking
        socket.on('matchmaking:join', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'matchmaking:join'))
                    return;
                const validation = validateSocketEvent(socket, 'matchmaking:join', data);
                if (!validation.isValid)
                    return;
                const validatedData = validation.sanitizedData;
                const user = await User_1.User.findById(socket.userId);
                if (!user)
                    return;
                const queue = {
                    userId: socket.userId,
                    username: socket.username || user.username,
                    rating: user.rating,
                    gameSpeed: validatedData.gameSpeed,
                    isPrivate: validatedData.isPrivate,
                    preferences: validatedData.preferences || {},
                    joinedAt: Date.now()
                };
                // Add to matchmaking queue
                await redisService_1.redisService.addToMatchmakingQueue(queue);
                // Store user's socket ID for matchmaking notifications
                await redisService_1.redisService.setUserSocketId(socket.userId, socket.id);
                // Try to find an opponent immediately
                const opponent = await redisService_1.redisService.findMatchmakingOpponent(socket.userId, user.rating, queue.gameSpeed, queue.isPrivate);
                if (opponent) {
                    // Create game with matched opponent
                    const game = await gameStateManager_1.gameStateManager.createGame({
                        player1Id: socket.userId,
                        player2Id: opponent.userId,
                        gameType: shared_1.GameType.CASUAL,
                        gameSpeed: queue.gameSpeed,
                        isPrivate: queue.isPrivate
                    });
                    const gameId = game._id.toString();
                    // Notify both players
                    const opponentSocketId = await redisService_1.redisService.getUserSocketId(opponent.userId);
                    if (opponentSocketId) {
                        io.to(opponentSocketId).emit('matchmaking:found', {
                            gameId,
                            opponent: {
                                id: socket.userId,
                                username: socket.username || user.username,
                                rating: user.rating
                            }
                        });
                    }
                    socket.emit('matchmaking:found', {
                        gameId,
                        opponent: {
                            id: opponent.userId,
                            username: opponent.username,
                            rating: opponent.rating
                        }
                    });
                    logger_1.logger.info(`Matched players: ${socket.username} vs ${opponent.username}`);
                }
                else {
                    socket.emit('matchmaking:queued', { position: 1 });
                    logger_1.logger.info(`${socket.username} added to matchmaking queue`);
                }
            }
            catch (error) {
                logger_1.logger.error('Matchmaking join error:', error);
                socket.emit('matchmaking:error', { message: 'Failed to join matchmaking' });
            }
        });
        socket.on('matchmaking:leave', async () => {
            try {
                if (!socket.userId)
                    return;
                await redisService_1.redisService.removeFromMatchmakingQueue(socket.userId);
                await redisService_1.redisService.removeUserSocketId(socket.userId);
                socket.emit('matchmaking:left');
                logger_1.logger.info(`${socket.username} left matchmaking`);
            }
            catch (error) {
                logger_1.logger.error('Matchmaking leave error:', error);
            }
        });
        // Handle game events
        socket.on('game:join', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'game:join'))
                    return;
                const validation = validateSocketEvent(socket, 'game:join', data);
                if (!validation.isValid)
                    return;
                const validatedData = validation.sanitizedData;
                const gameId = validatedData.gameId;
                const game = await gameStateManager_1.gameStateManager.loadGame(gameId);
                if (!game) {
                    socket.emit('game:error', { message: 'Game not found' });
                    return;
                }
                socket.join(`game:${gameId}`);
                // Check if user is a player or should be added as spectator
                const isPlayer = game.isPlayerInGame(socket.userId);
                if (isPlayer) {
                    // Player joining their game
                    socket.emit('game:joined', {
                        gameId: data.gameId,
                        role: 'player',
                        state: await gameStateManager_1.gameStateManager.getGameState(data.gameId),
                        chatMessages: game.chatMessages
                    });
                }
                else if (game.players.length < 2 && game.gameState === 'waiting') {
                    // Add as second player
                    const updatedGame = await gameStateManager_1.gameStateManager.addPlayer(gameId, socket.userId);
                    // Notify all players in the game
                    io.to(`game:${data.gameId}`).emit('game:player_joined', {
                        gameId: data.gameId,
                        playerId: socket.userId,
                        username: socket.username,
                        state: await gameStateManager_1.gameStateManager.getGameState(data.gameId)
                    });
                    socket.emit('game:joined', {
                        gameId: data.gameId,
                        role: 'player',
                        state: await gameStateManager_1.gameStateManager.getGameState(data.gameId),
                        chatMessages: updatedGame.chatMessages
                    });
                }
                else {
                    // Add as spectator
                    await gameStateManager_1.gameStateManager.addSpectator(gameId, socket.userId);
                    socket.emit('game:joined', {
                        gameId: data.gameId,
                        role: 'spectator',
                        state: await gameStateManager_1.gameStateManager.getGameState(data.gameId),
                        chatMessages: game.chatMessages
                    });
                    // Notify others of new spectator
                    socket.to(`game:${data.gameId}`).emit('game:spectator_joined', {
                        spectatorId: socket.userId,
                        username: socket.username
                    });
                }
                logger_1.logger.info(`${socket.username} joined game ${data.gameId}`);
            }
            catch (error) {
                logger_1.logger.error(`Game join error for ${data.gameId}:`, error);
                socket.emit('game:error', { message: 'Failed to join game' });
            }
        });
        socket.on('game:leave', async (data) => {
            try {
                if (!socket.userId || !data.gameId)
                    return;
                // Remove as spectator if they were one
                await gameStateManager_1.gameStateManager.removeSpectator(data.gameId, socket.userId);
                socket.leave(`game:${data.gameId}`);
                // Notify others
                socket.to(`game:${data.gameId}`).emit('game:player_left', {
                    playerId: socket.userId,
                    username: socket.username
                });
                logger_1.logger.info(`${socket.username} left game ${data.gameId}`);
            }
            catch (error) {
                logger_1.logger.error(`Game leave error for ${data.gameId}:`, error);
            }
        });
        socket.on('game:move', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'game:move'))
                    return;
                const validation = validateSocketEvent(socket, 'game:move', data);
                if (!validation.isValid)
                    return;
                const validatedData = validation.sanitizedData;
                const gameId = validatedData.gameId;
                // Add player ID and timestamp to move
                const move = {
                    ...validatedData.move,
                    playerId: socket.userId,
                    timestamp: new Date()
                };
                const stateUpdate = await gameStateManager_1.gameStateManager.processMove(gameId, socket.userId, move);
                // Broadcast move to all players in the game
                io.to(`game:${gameId}`).emit('game:move', {
                    gameId,
                    playerId: socket.userId,
                    username: socket.username,
                    move: stateUpdate.move,
                    state: stateUpdate.state,
                    timestamp: new Date()
                });
                logger_1.logger.info(`${socket.username} made move in game ${gameId}`);
            }
            catch (error) {
                logger_1.logger.error(`Game move error:`, error);
                socket.emit('game:error', {
                    message: error instanceof Error ? error.message : 'Invalid move'
                });
            }
        });
        socket.on('game:dice_roll', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'game:dice_roll'))
                    return;
                const validation = validateSocketEvent(socket, 'game:dice_roll', data);
                if (!validation.isValid)
                    return;
                const validatedData = validation.sanitizedData;
                const gameId = validatedData.gameId;
                const stateUpdate = await gameStateManager_1.gameStateManager.rollDice(gameId, socket.userId);
                // Broadcast dice roll to all players in the game
                io.to(`game:${gameId}`).emit('game:dice_roll', {
                    gameId,
                    playerId: socket.userId,
                    username: socket.username,
                    dice: stateUpdate.state?.dice,
                    timestamp: new Date()
                });
                logger_1.logger.info(`${socket.username} rolled dice in game ${gameId}: [${stateUpdate.state?.dice?.join(', ')}]`);
            }
            catch (error) {
                logger_1.logger.error(`Dice roll error:`, error);
                socket.emit('game:error', {
                    message: error instanceof Error ? error.message : 'Failed to roll dice'
                });
            }
        });
        socket.on('game:chat', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'game:chat'))
                    return;
                const validation = validateSocketEvent(socket, 'game:chat', data);
                if (!validation.isValid)
                    return;
                const validatedData = validation.sanitizedData;
                const gameId = validatedData.gameId;
                // Additional chat validation
                const chatValidation = validationService_1.validationService.validateChatMessage(validatedData.message, socket.userId, 'chat');
                if (!chatValidation.isValid) {
                    socket.emit('game:error', { message: chatValidation.error });
                    return;
                }
                const stateUpdate = await gameStateManager_1.gameStateManager.addChatMessage(gameId, socket.userId, chatValidation.sanitizedData.message);
                // Broadcast chat message to all players and spectators in the game
                io.to(`game:${gameId}`).emit('game:chat', {
                    gameId,
                    message: stateUpdate.chatMessage,
                    username: socket.username
                });
                logger_1.logger.info(`${socket.username} sent chat in game ${gameId}`);
            }
            catch (error) {
                logger_1.logger.error(`Chat error:`, error);
                socket.emit('game:error', {
                    message: error instanceof Error ? error.message : 'Failed to send message'
                });
            }
        });
        // Handle tournament events
        socket.on('tournament:join', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'tournament:join'))
                    return;
                if (!socket.userId || !data.tournamentId)
                    return;
                const tournament = await Tournament_1.TournamentModel.findById(data.tournamentId);
                if (!tournament) {
                    socket.emit('tournament:error', { message: 'Tournament not found' });
                    return;
                }
                // Join tournament room for real-time updates
                socket.join(`tournament:${data.tournamentId}`);
                // Register participant if not already registered
                if (!tournament.isParticipant(socket.userId)) {
                    try {
                        const user = await User_1.User.findById(socket.userId);
                        if (user) {
                            await tournament.addParticipant(socket.userId, socket.username || user.username, user.rating);
                            // Notify all tournament participants of new registration
                            io.to(`tournament:${data.tournamentId}`).emit('tournament:participant_joined', {
                                tournamentId: data.tournamentId,
                                participant: {
                                    userId: socket.userId,
                                    username: socket.username || user.username,
                                    rating: user.rating
                                },
                                currentPlayers: tournament.currentPlayers,
                                availableSlots: tournament.maxPlayers - tournament.currentPlayers
                            });
                        }
                    }
                    catch (error) {
                        socket.emit('tournament:error', { message: error instanceof Error ? error.message : 'Unknown error' });
                        return;
                    }
                }
                // Send tournament state to joining user
                socket.emit('tournament:joined', {
                    tournamentId: data.tournamentId,
                    tournament: tournament.toJSON(),
                    role: tournament.organizer === socket.userId ? 'organizer' : 'participant'
                });
                logger_1.logger.info(`${socket.username} joined tournament ${data.tournamentId}`);
            }
            catch (error) {
                logger_1.logger.error('Tournament join error:', error);
                socket.emit('tournament:error', { message: 'Failed to join tournament' });
            }
        });
        socket.on('tournament:leave', async (data) => {
            try {
                if (!socket.userId || !data.tournamentId)
                    return;
                const tournament = await Tournament_1.TournamentModel.findById(data.tournamentId);
                if (!tournament) {
                    socket.emit('tournament:error', { message: 'Tournament not found' });
                    return;
                }
                // Leave tournament room
                socket.leave(`tournament:${data.tournamentId}`);
                // Remove participant if registered and tournament hasn't started
                if (tournament.isParticipant(socket.userId)) {
                    try {
                        await tournament.removeParticipant(socket.userId);
                        // Notify all tournament participants
                        io.to(`tournament:${data.tournamentId}`).emit('tournament:participant_left', {
                            tournamentId: data.tournamentId,
                            participantId: socket.userId,
                            username: socket.username,
                            currentPlayers: tournament.currentPlayers,
                            availableSlots: tournament.maxPlayers - tournament.currentPlayers
                        });
                    }
                    catch (error) {
                        socket.emit('tournament:error', { message: error instanceof Error ? error.message : 'Unknown error' });
                        return;
                    }
                }
                socket.emit('tournament:left', { tournamentId: data.tournamentId });
                logger_1.logger.info(`${socket.username} left tournament ${data.tournamentId}`);
            }
            catch (error) {
                logger_1.logger.error('Tournament leave error:', error);
                socket.emit('tournament:error', { message: 'Failed to leave tournament' });
            }
        });
        // Handle tournament start (organizer only)
        socket.on('tournament:start', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'tournament:action'))
                    return;
                if (!socket.userId || !data.tournamentId)
                    return;
                const tournament = await Tournament_1.TournamentModel.findById(data.tournamentId);
                if (!tournament) {
                    socket.emit('tournament:error', { message: 'Tournament not found' });
                    return;
                }
                // Check if user is organizer
                if (tournament.organizer !== socket.userId) {
                    socket.emit('tournament:error', { message: 'Only organizer can start tournament' });
                    return;
                }
                // Generate bracket and start tournament
                await tournament.generateBracket();
                // Notify all participants that tournament has started
                io.to(`tournament:${data.tournamentId}`).emit('tournament:started', {
                    tournamentId: data.tournamentId,
                    tournament: tournament.toJSON(),
                    message: 'Tournament has started! Check the bracket for your matches.'
                });
                logger_1.logger.info(`Tournament ${data.tournamentId} started by ${socket.username}`);
            }
            catch (error) {
                logger_1.logger.error('Tournament start error:', error);
                socket.emit('tournament:error', {
                    message: error instanceof Error ? error.message : 'Failed to start tournament'
                });
            }
        });
        // Handle match result reporting
        socket.on('tournament:report_match_result', async (data) => {
            try {
                if (!await checkSocketRateLimit(socket, 'tournament:action'))
                    return;
                if (!socket.userId || !data.tournamentId || !data.matchId || !data.winner)
                    return;
                const tournament = await Tournament_1.TournamentModel.findById(data.tournamentId);
                if (!tournament) {
                    socket.emit('tournament:error', { message: 'Tournament not found' });
                    return;
                }
                // Find the match in current round
                const currentRound = tournament.rounds[tournament.rounds.length - 1];
                if (!currentRound) {
                    socket.emit('tournament:error', { message: 'No active round found' });
                    return;
                }
                const match = currentRound.matches.find(m => m.id === data.matchId);
                if (!match) {
                    socket.emit('tournament:error', { message: 'Match not found' });
                    return;
                }
                // Verify user is in the match
                if (match.player1 !== socket.userId && match.player2 !== socket.userId) {
                    socket.emit('tournament:error', { message: 'You are not in this match' });
                    return;
                }
                // Update match result
                match.winner = data.winner;
                match.status = shared_1.MatchStatus.COMPLETED;
                await tournament.save();
                // Notify all tournament participants of match result
                io.to(`tournament:${data.tournamentId}`).emit('tournament:match_completed', {
                    tournamentId: data.tournamentId,
                    roundNumber: currentRound.roundNumber,
                    matchId: data.matchId,
                    winner: data.winner,
                    match: match
                });
                // Check if round is complete and advance if needed
                const allMatchesComplete = currentRound.matches.every(m => m.status === shared_1.MatchStatus.COMPLETED);
                if (allMatchesComplete) {
                    try {
                        await tournament.advanceToNextRound();
                        // Notify of new round or tournament completion
                        if (tournament.status === 'finished') {
                            io.to(`tournament:${data.tournamentId}`).emit('tournament:finished', {
                                tournamentId: data.tournamentId,
                                tournament: tournament.toJSON(),
                                winner: data.winner
                            });
                        }
                        else {
                            io.to(`tournament:${data.tournamentId}`).emit('tournament:round_advanced', {
                                tournamentId: data.tournamentId,
                                newRound: tournament.rounds[tournament.rounds.length - 1],
                                roundNumber: tournament.rounds.length
                            });
                        }
                    }
                    catch (advanceError) {
                        logger_1.logger.error('Error advancing tournament round:', advanceError);
                    }
                }
                logger_1.logger.info(`Match result reported in tournament ${data.tournamentId}: ${data.winner} won match ${data.matchId}`);
            }
            catch (error) {
                logger_1.logger.error('Tournament match result error:', error);
                socket.emit('tournament:error', { message: 'Failed to report match result' });
            }
        });
        // Handle user status events
        socket.on('user:typing', (data) => {
            socket.to(`game:${data.gameId}`).emit('user:typing', {
                userId: socket.userId,
                username: socket.username
            });
        });
        // Handle disconnection
        socket.on('disconnect', async () => {
            console.log(`User ${socket.username} disconnected`);
            try {
                if (socket.userId) {
                    const user = await User_1.User.findById(socket.userId);
                    if (user) {
                        user.isOnline = false;
                        user.lastSeen = new Date();
                        await user.save();
                    }
                    // Broadcast user offline status
                    socket.broadcast.emit('user:offline', {
                        userId: socket.userId
                    });
                }
            }
            catch (error) {
                console.error('Error updating user offline status:', error);
            }
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;
//# sourceMappingURL=socketHandlers.js.map