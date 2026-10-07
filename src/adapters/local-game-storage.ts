import { SAVE_KEY, LEGACY_SAVE_KEY } from '../config/game.ts';
import { ORDER } from '../config/roulette.ts';
import { isCreditAmount } from '../utils/credits.ts';
import { isRoundOutcome, parseBets } from '../utils/round-contract.ts';
import type { GameStorage, SavedGame } from '../interfaces/roulette-session.ts';
export function createLocalGameStorage(storage: Pick<Storage, 'getItem' | 'setItem'>): GameStorage {
  return {
    load() {
      try {
        const value: unknown = JSON.parse(
          storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_SAVE_KEY) ?? 'null',
        );
        if (!value || typeof value !== 'object') return null;
        const data = value as Partial<SavedGame>;
        if (data.version !== undefined && data.version !== 2) return null;
        if (!isCreditAmount(data.balance)) return null;
        const history = Array.isArray(data.history)
          ? data.history.filter((n) => Number.isInteger(n) && n >= 0 && n <= 36).slice(0, 12)
          : [];
        if (data.pending != null && !isRoundOutcome(data.pending)) return null;
        const pending = isRoundOutcome(data.pending) ? data.pending : null;
        if (pending && pending.balance !== data.balance + pending.payout) return null;
        return {
          version: 2,
          balance: data.balance,
          lastBets: parseBets(data.lastBets),
          history,
          resultIndex:
            Number.isInteger(data.resultIndex) &&
            data.resultIndex! >= 0 &&
            data.resultIndex! < ORDER.length
              ? data.resultIndex!
              : 0,
          pending,
        };
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch {
        /* Session still works without storage. */
      }
    },
  };
}
