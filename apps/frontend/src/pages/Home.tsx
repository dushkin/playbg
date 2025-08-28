import React from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Play Backgammon</span>{' '}
                  <span className="block text-blue-400 xl:inline">Online</span>
                </h1>
                <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Join thousands of players in the ultimate online backgammon experience. 
                  Play casual games, compete in tournaments, and climb the global leaderboard.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    {isAuthenticated ? (
                      <Link
                        to="/lobby"
                        className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors"
                      >
                        Enter Game Lobby
                      </Link>
                    ) : (
                      <Link
                        to="/register"
                        className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors"
                      >
                        Get Started
                      </Link>
                    )}
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link
                      to="/tournaments"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-100 bg-blue-800 hover:bg-blue-900 md:py-4 md:text-lg md:px-10 transition-colors"
                    >
                      View Tournaments
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gray-800 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
            {/* Placeholder for backgammon board preview */}
            <div className="text-white text-center">
              <div className="w-64 h-40 bg-amber-800 rounded-lg border-4 border-amber-900 mx-auto mb-4 flex items-center justify-center">
                <span className="text-amber-200 font-bold">Backgammon Board</span>
              </div>
              <p className="text-gray-300">Interactive game board coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-gray-900 bg-opacity-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-400 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              Everything you need to play
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  🎯
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-white">Real-time Gameplay</p>
                <p className="mt-2 ml-16 text-base text-gray-300">
                  Play live games with players from around the world with instant move updates.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  🏆
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-white">Tournaments</p>
                <p className="mt-2 ml-16 text-base text-gray-300">
                  Compete in daily tournaments and climb the global leaderboard.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  📊
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-white">ELO Rating System</p>
                <p className="mt-2 ml-16 text-base text-gray-300">
                  Track your progress with our advanced rating system and detailed statistics.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  📱
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-white">Cross-Platform</p>
                <p className="mt-2 ml-16 text-base text-gray-300">
                  Play on any device - desktop, tablet, or mobile with our responsive design.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {isAuthenticated && user && (
        <div className="bg-gray-800 bg-opacity-50">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                Welcome back, {user.username}!
              </h2>
              <p className="mt-3 text-xl text-gray-300 sm:mt-4">
                Your current rating: {user.rating}
              </p>
            </div>
            <dl className="mt-10 text-center sm:max-w-3xl sm:mx-auto sm:grid sm:grid-cols-3 sm:gap-8">
              <div className="flex flex-col">
                <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-300">
                  Games Played
                </dt>
                <dd className="order-1 text-5xl font-extrabold text-blue-400">
                  {user.gamesPlayed}
                </dd>
              </div>
              <div className="flex flex-col mt-10 sm:mt-0">
                <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-300">
                  Games Won
                </dt>
                <dd className="order-1 text-5xl font-extrabold text-blue-400">
                  {user.gamesWon}
                </dd>
              </div>
              <div className="flex flex-col mt-10 sm:mt-0">
                <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-300">
                  Win Rate
                </dt>
                <dd className="order-1 text-5xl font-extrabold text-blue-400">
                  {user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0}%
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
