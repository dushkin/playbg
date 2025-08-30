/**
 * Mock Game model for testing
 */

const mockGame = {
  _id: '507f1f77bcf86cd799439012',
  players: [
    { userId: '507f1f77bcf86cd799439011', username: 'player1', rating: 1000 },
    { userId: '507f1f77bcf86cd799439013', username: 'player2', rating: 1100 }
  ],
  status: 'active',
  gameState: {
    board: Array(24).fill([]),
    bar: { white: [], black: [] },
    off: { white: [], black: [] },
    currentPlayer: 'white',
    dice: [],
    canMove: true
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

export const GameModel = {
  countDocuments: jest.fn().mockReturnValue({
    limit: jest.fn().mockResolvedValue(1)
  }),
  find: jest.fn().mockResolvedValue([mockGame]),
  findById: jest.fn().mockResolvedValue(mockGame),
  findOne: jest.fn().mockResolvedValue(mockGame),
  create: jest.fn().mockResolvedValue(mockGame),
  findByIdAndUpdate: jest.fn().mockResolvedValue(mockGame),
  findByIdAndDelete: jest.fn().mockResolvedValue(mockGame),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  aggregate: jest.fn().mockResolvedValue([mockGame])
};

export default GameModel;