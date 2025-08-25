import express, { Request, Response } from 'express';
import Joi from 'joi';
import { User } from '../models/User';
import { TokenService } from '../services/tokenService';
import { RefreshTokenModel } from '../models/RefreshToken';
import { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from '@playbg/shared';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { rateLimitService } from '../services/rateLimitService';
import { validateRequest, sanitizeInput } from '../middleware/validation';

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', 
  rateLimitService.createExpressMiddleware('api:auth'),
  sanitizeInput,
  validateRequest('user-registration'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { username, email, password } = validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      } as ApiResponse);
      return;
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Extract device info for tracking
    const deviceInfo = TokenService.extractDeviceInfo(req);

    // Generate token pair
    const { accessToken, refreshToken } = await TokenService.generateTokenPair(
      (user._id as any).toString(),
      user.username,
      deviceInfo
    );

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
      } as AuthResponse
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    } as ApiResponse);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', 
  rateLimitService.createExpressMiddleware('api:auth'),
  sanitizeInput,
  validateRequest('user-login'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { email, password } = validatedData;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      } as ApiResponse);
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      } as ApiResponse);
      return;
    }

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    
    // Extract device info for tracking
    const deviceInfo = TokenService.extractDeviceInfo(req);
    
    // Generate tokens
    const { accessToken, refreshToken } = await TokenService.generateTokenPair(
      (user._id as any).toString(),
      user.username,
      deviceInfo
    );

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
      } as AuthResponse
    } as ApiResponse<AuthResponse>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    } as ApiResponse);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and revoke refresh token
// @access  Private
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token required for logout'
      } as ApiResponse);
      return;
    }

    // Revoke the refresh token
    const revoked = await TokenService.revokeRefreshToken(refreshToken, 'logout');
    
    if (!revoked) {
      res.status(400).json({
        success: false,
        error: 'Invalid refresh token'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    } as ApiResponse);
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Refresh token required'
      } as ApiResponse);
      return;
    }

    // Extract device info for the new token
    const deviceInfo = TokenService.extractDeviceInfo(req);

    // Refresh the access token
    const { accessToken, refreshToken: newRefreshToken } = await TokenService.refreshAccessToken(
      refreshToken,
      deviceInfo
    );
    
    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: newRefreshToken.token
      }
    } as ApiResponse);
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid refresh token'
    } as ApiResponse);
  }
});

export default router;
