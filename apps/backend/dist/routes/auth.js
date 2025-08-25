"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const User_1 = require("../models/User");
const tokenService_1 = require("../services/tokenService");
const rateLimitService_1 = require("../services/rateLimitService");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
// Validation schemas
const registerSchema = joi_1.default.object({
    username: joi_1.default.string().alphanum().min(3).max(20).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required(),
    confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).required()
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', rateLimitService_1.rateLimitService.createExpressMiddleware('api:auth'), validation_1.sanitizeInput, (0, validation_1.validateRequest)('user-registration'), async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const { username, email, password } = validatedData;
        // Check if user already exists
        const existingUser = await User_1.User.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            res.status(400).json({
                success: false,
                error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
            });
            return;
        }
        // Create new user
        const user = new User_1.User({
            username,
            email,
            password
        });
        await user.save();
        // Extract device info for tracking
        const deviceInfo = tokenService_1.TokenService.extractDeviceInfo(req);
        // Generate token pair
        const { accessToken, refreshToken } = await tokenService_1.TokenService.generateTokenPair(user._id.toString(), user.username, deviceInfo);
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    rating: user.rating,
                    gamesPlayed: user.gamesPlayed,
                    gamesWon: user.gamesWon,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    isOnline: user.isOnline,
                    lastSeen: user.lastSeen
                },
                token: accessToken,
                refreshToken: refreshToken.token
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
});
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', rateLimitService_1.rateLimitService.createExpressMiddleware('api:auth'), validation_1.sanitizeInput, (0, validation_1.validateRequest)('user-login'), async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const { email, password } = validatedData;
        // Find user and include password for comparison
        const user = await User_1.User.findOne({ email }).select('+password');
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }
        // Update user online status
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();
        // Extract device info for tracking
        const deviceInfo = tokenService_1.TokenService.extractDeviceInfo(req);
        // Generate tokens
        const { accessToken, refreshToken } = await tokenService_1.TokenService.generateTokenPair(user._id.toString(), user.username, deviceInfo);
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    rating: user.rating,
                    gamesPlayed: user.gamesPlayed,
                    gamesWon: user.gamesWon,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    isOnline: user.isOnline,
                    lastSeen: user.lastSeen
                },
                token: accessToken,
                refreshToken: refreshToken.token
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});
// @route   POST /api/auth/logout
// @desc    Logout user and revoke refresh token
// @access  Private
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({
                success: false,
                error: 'Refresh token required for logout'
            });
            return;
        }
        // Revoke the refresh token
        const revoked = await tokenService_1.TokenService.revokeRefreshToken(refreshToken, 'logout');
        if (!revoked) {
            res.status(400).json({
                success: false,
                error: 'Invalid refresh token'
            });
            return;
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during logout'
        });
    }
});
// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
            return;
        }
        // Extract device info for the new token
        const deviceInfo = tokenService_1.TokenService.extractDeviceInfo(req);
        // Refresh the access token
        const { accessToken, refreshToken: newRefreshToken } = await tokenService_1.TokenService.refreshAccessToken(refreshToken, deviceInfo);
        res.json({
            success: true,
            data: {
                token: accessToken,
                refreshToken: newRefreshToken.token
            }
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Invalid refresh token'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map