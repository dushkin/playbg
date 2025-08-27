import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { User } from '../models/User';
import { TokenService } from '../services/tokenService';
import { ApiResponse } from '@playbg/shared';

// Re-export for backward compatibility
export { AuthenticatedRequest } from '../types/express';

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      } as ApiResponse);
      return;
    }

    // Verify access token using TokenService
    const decoded = TokenService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.'
      } as ApiResponse);
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token.'
    } as ApiResponse);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = TokenService.verifyAccessToken(token);
        const user = await User.findById(decoded.userId).select('-password');
        if (user) {
          req.user = user;
        }
      } catch (error) {
        // Continue without authentication for optional auth
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
