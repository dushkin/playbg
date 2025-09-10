import { GamePeriod } from '@playbg/shared';

/**
 * Returns the time limit in milliseconds for a given game period.
 * @param period The game period.
 * @returns The time limit in milliseconds, or 0 for unlimited.
 */
export function getTimeForPeriod(period: GamePeriod): number {
  switch (period) {
    case GamePeriod.THREE_MINUTES:
      return 3 * 60 * 1000; // 3 minutes in milliseconds
    case GamePeriod.TEN_MINUTES:
      return 10 * 60 * 1000; // 10 minutes
    case GamePeriod.THIRTY_MINUTES:
      return 30 * 60 * 1000; // 30 minutes
    case GamePeriod.UNLIMITED:
    default:
      return 0; // No time limit
  }
}
