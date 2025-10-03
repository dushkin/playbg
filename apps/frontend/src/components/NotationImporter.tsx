import React, { useRef, useState } from 'react';
import { TurnNotation, isValidNotation } from '@playbg/shared';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const NotationImporter: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const { notations, metadata } = parseNotationFile(content);
        // Store in localStorage to be picked up by offline game
        localStorage.setItem('importedNotation', JSON.stringify({ notations, metadata }));
        toast.success(`Loaded ${notations.length} turns from ${metadata.player1} vs ${metadata.player2}!`);
        // Navigate to offline game view (using special ID)
        navigate('/game/offline-imported');
      } catch (error) {
        toast.error(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsImporting(false);
    };

    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseNotationFile = (content: string): { notations: TurnNotation[], metadata: any } => {
    const notations: TurnNotation[] = [];
    const lines = content.split('\n');
    const metadata: any = {
      player1: 'Player 1',
      player2: 'Player 2',
      date: new Date().toISOString(),
      type: 'STANDARD',
      result: 'In progress'
    };

    for (const line of lines) {
      // Parse metadata
      if (line.includes('**Player 1') || line.includes('Player 1:')) {
        const match = line.match(/Player 1[^:]*:\*?\*?\s*(.+)/);
        if (match) metadata.player1 = match[1].trim();
        continue;
      }
      if (line.includes('**Player 2') || line.includes('Player 2:')) {
        const match = line.match(/Player 2[^:]*:\*?\*?\s*(.+)/);
        if (match) metadata.player2 = match[1].trim();
        continue;
      }

      // Skip empty lines, comments, and headers
      if (!line.trim() || line.startsWith('#') || line.startsWith('-') || line.startsWith('*')) {
        continue;
      }

      // Match pattern: "1. PlayerName: 42: 13/7* 8/6"
      const turnMatch = line.match(/^(\d+)\.\s*([^:]+):\s*(\d{2}):\s*(.+)$/);
      if (turnMatch) {
        const [, turnNumberStr, playerName, diceStr, movesStr] = turnMatch;
        const turnNumber = parseInt(turnNumberStr);
        const dice: [number, number] = [parseInt(diceStr[0]), parseInt(diceStr[1])];
        const moveStrings = movesStr.trim().split(/\s+/);

        // Validate all moves
        const validMoves = moveStrings.filter(m => isValidNotation(m));
        if (validMoves.length === 0) {
          console.warn(`Skipping turn ${turnNumber}: no valid moves found`);
          continue;
        }

        notations.push({
          turnNumber,
          playerId: playerName.trim(),
          dice,
          moves: validMoves,
          timestamp: new Date()
        });
      }
    }

    if (notations.length === 0) {
      throw new Error('No valid notation found in file');
    }

    return { notations, metadata };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Import Game Notation
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Load a backgammon game from a notation file to analyze or continue playing offline.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        onChange={handleFileSelect}
        className="hidden"
        id="notation-file-input"
        disabled={isImporting}
      />

      <label
        htmlFor="notation-file-input"
        className={`flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer ${
          isImporting ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isImporting ? 'Importing...' : 'Choose Notation File'}
      </label>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Supported formats: .txt, .md (standard backgammon notation)
      </p>
    </div>
  );
};

export default NotationImporter;
