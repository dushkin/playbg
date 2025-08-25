"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authMiddleware = void 0;
const User_1 = require("../models/User");
const tokenService_1 = require("../services/tokenService");
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.'
            });
            return;
        }
        // Verify access token using TokenService
        const decoded = tokenService_1.TokenService.verifyAccessToken(token);
        const user = await User_1.User.findById(decoded.userId).select('-password');
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Invalid token. User not found.'
            });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            error: error.message || 'Invalid token.'
        });
    }
};
exports.authMiddleware = authMiddleware;
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = tokenService_1.TokenService.verifyAccessToken(token);
                const user = await User_1.User.findById(decoded.userId).select('-password');
                if (user) {
                    req.user = user;
                }
            }
            catch (error) {
                // Continue without authentication for optional auth
            }
        }
        next();
    }
    catch (error) {
        // Continue without authentication for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map