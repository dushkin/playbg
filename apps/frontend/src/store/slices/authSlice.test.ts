import { configureStore } from '@reduxjs/toolkit';
import authReducer, { clearError, updateUser, login, register, checkAuth, logout } from './authSlice';
import { vi, beforeEach } from 'vitest';

// Mock the API
vi.mock('../../services/api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn(),
    logout: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('authSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should load token from localStorage', () => {
      // Set up the mock before importing the module
      localStorageMock.getItem.mockReturnValue('test-token');
      
      // Force reimport of the auth slice to test initial state loading
      vi.resetModules();
      
      // Import after setting up the mock
      return import('../../store/slices/authSlice').then(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('token');
      });
    });
  });

  describe('synchronous actions', () => {
    it('should clear error', () => {
      // Set an error first
      const initialState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Test error',
      };
      
      const action = clearError();
      const newState = authReducer(initialState, action);
      
      expect(newState.error).toBeNull();
    });

    it('should update user', () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
        gamesPlayed: 10,
        gamesWon: 7,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const initialState = {
        user: mockUser,
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      
      const updates = { rating: 1200, username: 'updateduser' };
      const action = updateUser(updates);
      const newState = authReducer(initialState, action);
      
      expect(newState.user).toEqual({ ...mockUser, ...updates });
    });

    it('should not update user if user is null', () => {
      const initialState = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
      
      const action = updateUser({ rating: 1200 });
      const newState = authReducer(initialState, action);
      
      expect(newState.user).toBeNull();
    });
  });

  describe('async actions - pending states', () => {
    it('should set loading state for login.pending', () => {
      const action = { type: login.pending.type };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(true);
      expect(newState.error).toBeNull();
    });

    it('should set loading state for register.pending', () => {
      const action = { type: register.pending.type };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(true);
      expect(newState.error).toBeNull();
    });

    it('should set loading state for checkAuth.pending', () => {
      const action = { type: checkAuth.pending.type };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(true);
    });

    it('should set loading state for logout.pending', () => {
      const action = { type: logout.pending.type };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(true);
    });
  });

  describe('async actions - fulfilled states', () => {
    const mockAuthData = {
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        rating: 1000,
        gamesPlayed: 10,
        gamesWon: 7,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: 'test-token',
    };

    it('should handle login.fulfilled', () => {
      const action = {
        type: login.fulfilled.type,
        payload: mockAuthData,
      };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.user).toEqual(mockAuthData.user);
      expect(newState.token).toBe(mockAuthData.token);
      expect(newState.error).toBeNull();
    });

    it('should handle register.fulfilled', () => {
      const action = {
        type: register.fulfilled.type,
        payload: mockAuthData,
      };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.user).toEqual(mockAuthData.user);
      expect(newState.token).toBe(mockAuthData.token);
      expect(newState.error).toBeNull();
    });

    it('should handle checkAuth.fulfilled', () => {
      const action = {
        type: checkAuth.fulfilled.type,
        payload: mockAuthData,
      };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.user).toEqual(mockAuthData.user);
      expect(newState.token).toBe(mockAuthData.token);
      expect(newState.error).toBeNull();
    });

    it('should handle logout.fulfilled', () => {
      const initialState = {
        user: mockAuthData.user,
        token: mockAuthData.token,
        isAuthenticated: true,
        isLoading: true,
        error: null,
      };
      
      const action = { type: logout.fulfilled.type };
      const newState = authReducer(initialState, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.user).toBeNull();
      expect(newState.token).toBeNull();
      expect(newState.error).toBeNull();
    });
  });

  describe('async actions - rejected states', () => {
    it('should handle login.rejected', () => {
      const action = {
        type: login.rejected.type,
        payload: 'Login failed',
      };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.user).toBeNull();
      expect(newState.token).toBeNull();
      expect(newState.error).toBe('Login failed');
    });

    it('should handle register.rejected', () => {
      const action = {
        type: register.rejected.type,
        payload: 'Registration failed',
      };
      const newState = authReducer(undefined, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.user).toBeNull();
      expect(newState.token).toBeNull();
      expect(newState.error).toBe('Registration failed');
    });

    it('should handle checkAuth.rejected', () => {
      const initialState = {
        user: { id: '1', username: 'test' } as any,
        token: 'old-token',
        isAuthenticated: true,
        isLoading: true,
        error: null,
      };
      
      const action = { type: checkAuth.rejected.type };
      const newState = authReducer(initialState, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.user).toBeNull();
      expect(newState.token).toBeNull();
      expect(newState.error).toBeNull(); // Auth check failures don't show errors
    });

    it('should handle logout.rejected', () => {
      const initialState = {
        user: { id: '1', username: 'test' } as any,
        token: 'test-token',
        isAuthenticated: true,
        isLoading: true,
        error: null,
      };
      
      const action = { type: logout.rejected.type };
      const newState = authReducer(initialState, action);
      
      expect(newState.isLoading).toBe(false);
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.user).toBeNull();
      expect(newState.token).toBeNull();
      expect(newState.error).toBeNull(); // Logout always clears user data
    });
  });
});