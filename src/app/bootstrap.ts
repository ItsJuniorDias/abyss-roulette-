import { createDemoRoulette } from '../adapters/demo-roulette.ts';
import { createLocalGameStorage } from '../adapters/local-game-storage.ts';
import { createGameStore } from '../stores/game-store.ts';
import { t } from '../utils/i18n.ts';
export function createGameSession() {
  const profile = import.meta.env.VITE_SESSION_PROFILE ?? 'demo';
  if (profile !== 'demo') throw new Error(t('unsupportedProfile'));
  let storage: Pick<Storage, 'getItem' | 'setItem'>;
  try {
    storage = window.localStorage;
  } catch {
    storage = { getItem: () => null, setItem: () => {} };
  }
  return createGameStore(createDemoRoulette(), createLocalGameStorage(storage));
}
