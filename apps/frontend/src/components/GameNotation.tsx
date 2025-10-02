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
        date: game.startTime,
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
        date: game.startTime,
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Game Notation
        </h3>
        <div className="flex gap-2">
          {onImport && <NotationImport onImport={handleImport} />}
          <button
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            title="Download as file"
          >
            💾 Download
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {notations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No moves recorded yet. Notation will appear as the game progresses.
        </p>
      ) : (
        <div
          className={`overflow-y-auto transition-all duration-300 ${
            isExpanded ? 'max-h-96' : 'max-h-32'
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
                  className={`text-sm font-mono p-2 rounded ${
                    isPlayer1
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100'
                  }`}
                >
                  <span className="font-bold mr-2">{notation.turnNumber}.</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                    {playerName}:
                  </span>
                  <span className="font-semibold mr-1">{notation.dice.join('')}:</span>
                  <span>{notation.moves.join(' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total turns: {notations.length} |
            Last move: {notations[notations.length - 1].timestamp.toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default GameNotation;
