import React, { useState } from 'react';
import { TurnNotation, exportGameNotation } from '@playbg/shared';
import { Game as GameType } from '@playbg/shared';
import toast from 'react-hot-toast';
import NotationImport from './NotationImport';

interface GameNotationProps {
  game: GameType | null;
  notations: TurnNotation[];
  onImport?: (notations: TurnNotation[]) => void;
}

const GameNotation: React.FC<GameNotationProps> = ({ game, notations, onImport }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleImport = (importedNotations: TurnNotation[]) => {
    if (onImport) {
      onImport(importedNotations);
    }
  };

  const handleExport = () => {
    if (!game) return;

    const player1 = game.players[0];
    const player2 = game.players[1];

    const notationText = exportGameNotation(
      notations,
      player1.username,
      player2.username,
      {
        date: new Date(game.startTime),
        result: game.winner ? `${game.winner} wins` : 'In progress',
        gameType: game.gameType
      }
    );

    // Copy to clipboard
    navigator.clipboard.writeText(notationText)
      .then(() => {
        toast.success('Notation copied to clipboard!');
      })
      .catch(() => {
        toast.error('Failed to copy notation');
      });
  };

  const handleDownload = () => {
    if (!game) return;

    const player1 = game.players[0];
    const player2 = game.players[1];

    const notationText = exportGameNotation(
      notations,
      player1.username,
      player2.username,
      {
        date: new Date(game.startTime),
        result: game.winner ? `${game.winner} wins` : 'In progress',
        gameType: game.gameType
      }
    );

    // Create download link
    const blob = new Blob([notationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backgammon-game-${game.id}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Notation downloaded!');
  };

  if (!game) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Game Notation</span>
          <span className="sm:hidden">Notation</span>
        </h3>

        {/* Action Buttons - Horizontal on desktop, stacked on mobile */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onImport && <NotationImport onImport={handleImport} />}
          <button
            onClick={handleExport}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
            title="Copy to clipboard"
          >
            <span className="hidden sm:inline">📋 Copy</span>
            <span className="sm:hidden">📋</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
            title="Download as file"
          >
            <span className="hidden sm:inline">💾 Download</span>
            <span className="sm:hidden">💾</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Content */}
      {notations.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
          No moves recorded yet. Notation will appear as the game progresses.
        </p>
      ) : (
        <>
          <div
            className={`overflow-y-auto transition-all duration-300 ${
              isExpanded ? 'max-h-96' : 'max-h-24'
            }`}
          >
            <div className="space-y-1">
              {notations.map((notation, index) => {
                const player = game.players.find(p => p.userId === notation.playerId);
                const playerName = player?.username || 'Unknown';
                const isPlayer1 = game.players[0].userId === notation.playerId;

                return (
                  <div
                    key={`${notation.turnNumber}-${index}`}
                    className={`text-xs font-mono px-2 py-1 rounded ${
                      isPlayer1
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100'
                    }`}
                  >
                    <span className="font-bold mr-1">{notation.turnNumber}.</span>
                    <span className="text-xs opacity-70 mr-1 hidden sm:inline">
                      {playerName}:
                    </span>
                    <span className="font-semibold mr-1">{notation.dice.join('')}:</span>
                    <span className="break-all">{notation.moves.join(' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">{notations.length}</span> turns
              <span className="hidden sm:inline"> | Last: {notations[notations.length - 1].timestamp.toLocaleTimeString()}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default GameNotation;
