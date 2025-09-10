import axios, { AxiosResponse } from 'axios'
import { ApiResponse, AuthResponse, LoginRequest, RegisterRequest, User } from '@playbg/shared'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://playbg-backend-dev.onrender.com/api'


// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          if (response.data.success) {
            const newToken = response.data.data.token
            localStorage.setItem('token', newToken)
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
    // Add verbose logging to assist with debugging login failures on mobile devices.
    // Note: avoid logging sensitive information like passwords. Only log the email.
    try {
      console.debug('[authAPI.login] initiating login', { email: credentials.email })
      const response: AxiosResponse<ApiResponse<AuthResponse>> = await api.post('/auth/login', credentials)
      console.debug('[authAPI.login] login successful', response.data)
      return response.data
    } catch (error: any) {
      // Log the error details to understand why the request failed (e.g., network issues, CORS)
      console.error('[authAPI.login] login failed', error, error?.response)
      throw error
    }
  },

  register: async (userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> => {
    const response: AxiosResponse<ApiResponse<AuthResponse>> = await api.post('/auth/register', userData)
    return response.data
  },

  logout: async (): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await api.post('/auth/logout')
    return response.data
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ token: string }>> => {
    const response: AxiosResponse<ApiResponse<{ token: string }>> = await api.post('/auth/refresh', {
      refreshToken,
    })
    return response.data
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.get('/users/profile')
    return response.data
  },
}

// Users API
export const usersAPI = {
  getProfile: async (): Promise<ApiResponse<User>> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.get('/users/profile')
    return response.data
  },

  updateProfile: async (updates: Partial<User>): Promise<ApiResponse<User>> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.put('/users/profile', updates)
    return response.data
  },

  getLeaderboard: async (page = 1, limit = 20): Promise<ApiResponse<User[]>> => {
    const response: AxiosResponse<ApiResponse<User[]>> = await api.get('/users/leaderboard', {
      params: { page, limit },
    })
    return response.data
  },

  searchUsers: async (query: string): Promise<ApiResponse<User[]>> => {
    const response: AxiosResponse<ApiResponse<User[]>> = await api.get('/users/search', {
      params: { q: query },
    })
    return response.data
  },

  getUserById: async (id: string): Promise<ApiResponse<User>> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.get(`/users/${id}`)
    return response.data
  },
}

// Games API
export const gamesAPI = {
  getGames: async (): Promise<ApiResponse<any[]>> => {
    const response: AxiosResponse<ApiResponse<any[]>> = await api.get('/games')
    return response.data
  },

  getGame: async (gameId: string): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.get(`/games/${gameId}`)
    return response.data
  },

  createGame: async (gameData: any): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.post('/games', gameData)
    return response.data
  },

  findGame: async (findGameData: any): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.post('/games/find', findGameData)
    return response.data
  },

  leaveMatchmaking: async (): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.delete('/games/find')
    return response.data
  },

  getMatchmakingStatus: async (): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.get('/games/find/status')
    return response.data
  },

  // New game lobby APIs
  getAvailableGames: async (): Promise<ApiResponse<any[]>> => {
    const response: AxiosResponse<ApiResponse<any[]>> = await api.get('/games/available')
    return response.data
  },

  getMyGames: async (): Promise<ApiResponse<any[]>> => {
    const response: AxiosResponse<ApiResponse<any[]>> = await api.get('/games/my-games')
    return response.data
  },

  getGameHistory: async (page = 1, limit = 20): Promise<ApiResponse<any[]>> => {
    const response: AxiosResponse<ApiResponse<any[]>> = await api.get(`/games/history?page=${page}&limit=${limit}`)
    return response.data
  },

  joinGame: async (gameId: string): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.post(`/games/${gameId}/join`)
    return response.data
  },
}

// Tournaments API
export const tournamentsAPI = {
  getTournaments: async (): Promise<ApiResponse<any[]>> => {
    const response: AxiosResponse<ApiResponse<any[]>> = await api.get('/tournaments')
    return response.data
  },

  createTournament: async (tournamentData: any): Promise<ApiResponse<any>> => {
    const response: AxiosResponse<ApiResponse<any>> = await api.post('/tournaments', tournamentData)
    return response.data
  },
}

export default api