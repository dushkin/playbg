# PlayBG - Online Backgammon Platform

A modern, full-stack backgammon platform built with React, Node.js, and MongoDB. Play backgammon online with real-time gameplay, tournaments, ELO ratings, and cross-platform support.

## 🎯 Features

### Core Gameplay
- **Real-time Multiplayer**: Play live games with WebSocket communication
- **Game Modes**: Casual unranked games and competitive ranked matches
- **Tournament System**: Single/double elimination, round-robin tournaments
- **ELO Rating System**: Skill-based matchmaking and progression tracking
- **Spectator Mode**: Watch ongoing games and learn from others

### User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Cross-Platform**: Web browsers + native mobile apps (Android/iOS)
- **User Profiles**: Track statistics, achievements, and game history
- **Real-time Chat**: In-game messaging and community features
- **Performance Analytics**: Detailed game statistics and improvement insights

### Technical Features
- **Modern Tech Stack**: React 18, Node.js, MongoDB, TypeScript
- **Real-time Communication**: Socket.IO for live gameplay
- **State Management**: Redux Toolkit for predictable state updates
- **Mobile Apps**: Capacitor for native Android/iOS deployment
- **Monorepo Architecture**: Shared code between frontend, backend, and mobile

## 🏗️ Project Structure

```
playbg/
├── apps/
│   ├── backend/          # Node.js/Express API server
│   ├── frontend/         # React web application
│   └── mobile/           # Capacitor mobile app wrapper
├── packages/
│   ├── shared/           # Shared TypeScript types and utilities
│   └── game-logic/       # Core backgammon game engine
├── package.json          # Root workspace configuration
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- MongoDB (local or cloud instance)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd playbg
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend environment
   cp apps/backend/.env.example apps/backend/.env
   # Edit apps/backend/.env with your MongoDB URI and JWT secret
   ```

4. **Build shared packages**
   ```bash
   npm run build --workspace=packages/shared
   npm run build --workspace=packages/game-logic
   ```

5. **Start development servers**
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually
   npm run dev:backend    # API server on http://localhost:5000
   npm run dev:frontend   # React app on http://localhost:3000
   ```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:backend      # Start only backend server
npm run dev:frontend     # Start only frontend app
npm run dev:mobile       # Start mobile development

# Building
npm run build            # Build all packages
npm run build:backend    # Build backend only
npm run build:frontend   # Build frontend only

# Testing
npm run test             # Run tests in all packages
npm run lint             # Lint all packages

# Utilities
npm run clean            # Clean all build artifacts
```

### Backend Development

The backend is built with:
- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database and ODM
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **TypeScript** - Type safety

Key directories:
- `apps/backend/src/routes/` - API endpoints
- `apps/backend/src/models/` - Database models
- `apps/backend/src/socket/` - WebSocket handlers
- `apps/backend/src/middleware/` - Express middleware

### Frontend Development

The frontend uses:
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Redux Toolkit** - State management
- **React Router** - Navigation
- **Vite** - Build tool

Key directories:
- `apps/frontend/src/components/` - Reusable UI components
- `apps/frontend/src/pages/` - Route components
- `apps/frontend/src/store/` - Redux store and slices
- `apps/frontend/src/services/` - API clients

### Game Logic

The core game engine (`packages/game-logic/`) includes:
- **BackgammonEngine** - Game state management and move validation
- **EloRating** - Rating calculation system
- **GameUtils** - Utility functions for game operations

## 🎮 Game Rules & Features

### Backgammon Rules
- Standard backgammon rules with doubling cube support
- Crawford rule implementation for match play
- Automatic move validation and legal move highlighting
- Pip count and match equity calculations

### Rating System
- ELO-based rating system (starting at 1200)
- Separate ratings for different game speeds
- Rating history and progression tracking
- Leaderboards and ranking systems

### Tournament Features
- Multiple tournament formats (elimination, round-robin)
- Automated bracket generation and management
- Prize pool distribution
- Tournament chat and spectator modes

## 📱 Mobile Development

### Android APK Generation
```bash
# Build and generate Android APK
npm run build:mobile
cd apps/mobile
npx cap add android
npx cap sync android
npx cap open android
```

### iOS App Development
```bash
# Build and generate iOS app
npm run build:mobile
cd apps/mobile
npx cap add ios
npx cap sync ios
npx cap open ios
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/playbg
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

### Database Setup

1. **Local MongoDB**
   ```bash
   # Install MongoDB locally or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **MongoDB Atlas** (Cloud)
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create cluster and get connection string
   - Update `MONGODB_URI` in `.env`

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=packages/game-logic
npm run test --workspace=apps/backend
npm run test --workspace=apps/frontend
```

## 📦 Deployment

### Production Build
```bash
# Build all packages for production
npm run build

# Start production server
npm start
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Environment-Specific Deployments
- **Development**: Local development with hot reload
- **Staging**: Testing environment with production-like setup
- **Production**: Optimized build with monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Conventional commits for commit messages
- Comprehensive testing for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Backgammon rules and gameplay mechanics
- Open source libraries and frameworks used
- Community feedback and contributions

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/playbg/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/playbg/discussions)
- **Email**: support@playbg.com

---

**Built with ❤️ for the backgammon community**
