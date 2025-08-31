import { GameSpeed } from '@playbg/shared';

/**
 * Returns the time limit in milliseconds for a given game speed.
 * @param speed The game speed.
 * @returns The time limit in milliseconds, or 0 for unlimited.
 */
export function getTimeForSpeed(speed: GameSpeed): number {
  switch (speed) {
    case GameSpeed.BLITZ:
      return 3 * 60 * 1000; // 3 minutes in milliseconds
    case GameSpeed.RAPID:
      return 10 * 60 * 1000; // 10 minutes
    case GameSpeed.STANDARD:
      return 30 * 60 * 1000; // 30 minutes
    case GameSpeed.UNLIMITED:
    default:
      return 0; // No time limit
  }
}
