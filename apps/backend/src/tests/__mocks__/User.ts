/**
 * Mock User model for testing
 */

const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  username: 'testuser',
  email: 'test@example.com',
  rating: 1000,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const User = {
  countDocuments: jest.fn().mockReturnValue({
    limit: jest.fn().mockResolvedValue(1)
  }),
  find: jest.fn().mockResolvedValue([mockUser]),
  findById: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn().mockResolvedValue(mockUser),
  findByIdAndUpdate: jest.fn().mockResolvedValue(mockUser),
  findByIdAndDelete: jest.fn().mockResolvedValue(mockUser),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  aggregate: jest.fn().mockResolvedValue([mockUser])
};

export default User;