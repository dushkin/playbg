"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const Tournament_1 = require("../models/Tournament");
const shared_1 = require("@playbg/shared");
const rateLimitService_1 = require("../services/rateLimitService");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
// Validation schema
const createTournamentSchema = joi_1.default.object({
    name: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().max(1000).optional(),
    type: joi_1.default.string().valid(...Object.values(shared_1.TournamentType)).required(),
    format: joi_1.default.string().valid(...Object.values(shared_1.TournamentFormat)).required(),
    maxPlayers: joi_1.default.number().integer().min(4).max(128).required(),
    entryFee: joi_1.default.number().min(0).default(0),
    startTime: joi_1.default.date().greater('now').required(),
    rules: joi_1.default.object({
        matchLength: joi_1.default.number().integer().min(1).max(21).required(),
        timeControl: joi_1.default.string().valid(...Object.values(shared_1.GameSpeed)).required(),
        doubleAllowed: joi_1.default.boolean().default(true),
        crawfordRule: joi_1.default.boolean().default(true)
    }).required()
});
// @route   GET /api/tournaments
// @desc    Get tournaments
// @access  Private
router.get('/', (0, validation_1.validateQueryParams)(['status', 'limit', 'page']), validation_1.validatePagination, async (req, res) => {
    try {
        const { status, limit = 10, page = 1 } = req.query;
        const query = {};
        if (status && Object.values(shared_1.TournamentStatus).includes(status)) {
            query.status = status;
        }
        const tournaments = await Tournament_1.TournamentModel.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) * Number(page))
            .skip((Number(page) - 1) * Number(limit))
            .lean();
        const total = await Tournament_1.TournamentModel.countDocuments(query);
        res.json({
            success: true,
            data: tournaments,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error retrieving tournaments:', error);
        res.status(500).json({
            success: false,
            error: 'Server error retrieving tournaments'
        });
    }
});
// @route   POST /api/tournaments
// @desc    Create a new tournament
// @access  Private
router.post('/', rateLimitService_1.rateLimitService.createExpressMiddleware('api:tournament_create'), validation_1.sanitizeInput, (0, validation_1.validateRequest)('tournament-creation'), async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const userId = req.user._id.toString();
        const tournamentData = {
            ...validatedData,
            organizer: userId,
            currentPlayers: 0
        };
        const tournament = new Tournament_1.TournamentModel(tournamentData);
        await tournament.save();
        res.status(201).json({
            success: true,
            data: tournament.toJSON(),
            message: 'Tournament created successfully'
        });
    }
    catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({
            success: false,
            error: 'Server error creating tournament'
        });
    }
});
exports.default = router;
//# sourceMappingURL=tournaments.js.map