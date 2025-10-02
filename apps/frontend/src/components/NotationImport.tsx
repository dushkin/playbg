import React, { useRef } from 'react';
import { TurnNotation, isValidNotation } from '@playbg/shared';
import toast from 'react-hot-toast';

interface NotationImportProps {
  onImport: (notations: TurnNotation[]) => void;
}

const NotationImport: React.FC<NotationImportProps> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const notations = parseNotationFile(content);
        onImport(notations);
        toast.success(`Imported ${notations.length} turns successfully!`);
      } catch (error) {
        toast.error(`Failed to import notation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseNotationFile = (content: string): TurnNotation[] => {
    const notations: TurnNotation[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
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

    return notations;
  };

  return (
    <div className="inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        onChange={handleFileSelect}
        className="hidden"
        id="notation-file-input"
      />
      <label
        htmlFor="notation-file-input"
        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors cursor-pointer inline-flex items-center gap-2"
        title="Import notation from file"
      >
        📂 Import
      </label>
    </div>
  );
};

export default NotationImport;
