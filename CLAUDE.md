# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PlayBG is an online backgammon platform built as a monorepo with the following architecture:
- **Backend**: Express.js API with Socket.IO for real-time gameplay, MongoDB for persistence
- **Frontend**: React 18 with TypeScript, Redux Toolkit for state management, Tailwind CSS for styling
- **Mobile**: Capacitor wrapper for cross-platform mobile deployment
- **Shared Packages**: Common types and game logic shared across all apps

## Development Commands

### Root Workspace Commands
```bash
# Development - start both frontend and backend
npm run dev

# Development - individual apps
npm run dev:backend    # Starts backend on port 5000
npm run dev:frontend   # Starts frontend on port 3000
npm run dev:mobile     # Mobile development

# Building
npm run build          # Build all packages
npm run build:backend  # Backend only
npm run build:frontend # Frontend only

# Testing and Quality
npm run test           # Run tests in all packages
npm run lint           # Lint all packages

# Utilities
npm run clean          # Clean all build artifacts
npm start              # Start production backend
```

### Backend-Specific Commands
```bash
# In apps/backend/
npm run dev            # Start with nodemon
npm run build          # TypeScript compilation
npm run start          # Run built JS
npm run test           # Run Jest tests
npm run lint           # ESLint
npm run clean          # Remove dist/
```

### Frontend-Specific Commands
```bash
# In apps/frontend/
npm run dev            # Vite dev server
npm run build          # TypeScript + Vite build
npm run preview        # Preview production build
npm run test           # Vitest
npm run lint           # ESLint
npm run clean          # Remove dist/
```

## Architecture Overview

### Backend Architecture
- **Entry point**: `apps/backend/src/server.ts` - Express app with Socket.IO server
- **API Routes**: REST endpoints in `apps/backend/src/routes/`
  - `/api/auth` - Authentication (register, login, token refresh)
  - `/api/users` - User management (protected)
  - `/api/games` - Game management (protected)
  - `/api/tournaments` - Tournament system (protected)
- **Real-time**: Socket.IO handlers in `apps/backend/src/socket/socketHandlers.ts`
- **Database**: Mongoose models in `apps/backend/src/models/`
- **Security**: JWT auth middleware, helmet, CORS, rate limiting

### Frontend Architecture
- **Entry point**: `apps/frontend/src/main.tsx` - React app initialization
- **Routing**: React Router with pages in `apps/frontend/src/pages/`
- **State Management**: Redux Toolkit with slices in `apps/frontend/src/store/slices/`
  - `authSlice.ts` - Authentication state
  - `gameSlice.ts` - Game state and real-time updates  
  - `tournamentSlice.ts` - Tournament management
  - `uiSlice.ts` - UI state (modals, loading, etc.)
- **API Layer**: Axios client in `apps/frontend/src/services/api.ts`
- **Components**: Reusable UI components in `apps/frontend/src/components/`

### Shared Dependencies
Both frontend and backend depend on:
- `@playbg/shared` - Common TypeScript types and utilities
- `@playbg/game-logic` - Core backgammon game engine

### Database Setup
- MongoDB connection via `MONGODB_URI` environment variable
- Default: `mongodb://localhost:27017/playbg`
- Models: User authentication, game state, tournament management

## Environment Configuration

### Backend Environment (.env)
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/playbg
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

## Key Technologies
- **Backend**: Node.js, Express, MongoDB/Mongoose, Socket.IO, JWT, Winston logging
- **Frontend**: React 18, TypeScript, Vite, Redux Toolkit, Tailwind CSS, React Router
- **Testing**: Jest (backend), Vitest (frontend)
- **Code Quality**: ESLint, TypeScript strict mode
- **Real-time**: Socket.IO for game events and live updates