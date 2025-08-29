/// <reference path="../types/express-augmentation.ts" />

import express from 'express';
import { Response, NextFunction } from 'express';
import Joi from 'joi';
import { TournamentModel } from '../models/Tournament';
import { MatchModel } from '../models/Match';
import {
  ApiResponse,
  TournamentType,
  TournamentFormat,
  TournamentStatus,
  GameSpeed
} from '@playbg/shared';
import { rateLimitService } from '../services/rateLimitService';
import { 
  validateRequest, 
  validateObjectId,
  validateQueryParams,
  validatePagination,
  sanitizeInput
} from '../middleware/validation';

const router = express.Router();

// Validation schema
const createTournamentSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).optional(),
  type: Joi.string().valid(...Object.values(TournamentType)).required(),
  format: Joi.string().valid(...Object.values(TournamentFormat)).required(),
  maxPlayers: Joi.number().integer().min(4).max(128).required(),
  entryFee: Joi.number().min(0).default(0),
  startTime: Joi.date().greater('now').required(),
  rules: Joi.object({
    matchLength: Joi.number().integer().min(1).max(21).required(),
    timeControl: Joi.string().valid(...Object.values(GameSpeed)).required(),
    doubleAllowed: Joi.boolean().default(true),
    crawfordRule: Joi.boolean().default(true)
  }).required()
});

// @route   GET /api/tournaments
// @desc    Get tournaments
// @access  Private
router.get('/', 
  validateQueryParams(['status', 'limit', 'page']),
  validatePagination,
  async (req: express.Request, res: Response): Promise<void> => {
  try {
    const { status, limit = 10, page = 1 } = req.query;

    const query: any = {};
    if (status && Object.values(TournamentStatus).includes(status as TournamentStatus)) {
      query.status = status;
    }

    const tournaments = await TournamentModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await TournamentModel.countDocuments(query);

    res.json({
      success: true,
      data: tournaments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Error retrieving tournaments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving tournaments'
    } as ApiResponse);
  }
});

// @route   POST /api/tournaments
// @desc    Create a new tournament
// @access  Private
router.post('/', 
  rateLimitService.createExpressMiddleware('api:tournament_create'),
  sanitizeInput,
  validateRequest('tournament-creation'),
  async (req: express.Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const userId = req.user._id.toString();
    const tournamentData = {
      ...validatedData,
      organizer: userId,
      currentPlayers: 0
    };

    const tournament = new TournamentModel(tournamentData);
    await tournament.save();

    res.status(201).json({
      success: true,
      data: tournament.toJSON(),
      message: 'Tournament created successfully'
    } as ApiResponse);
  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating tournament'
    } as ApiResponse);
  }
});

export default router;
