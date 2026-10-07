import { expect, it } from 'vitest';
import { createLocalGameStorage } from './local-game-storage.ts';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../config/game.ts';

it('migrates the previous demo save while sanitizing unsupported bets and history', () => {
  const data = new Map([
    [
      LEGACY_SAVE_KEY,
      JSON.stringify({
        balance: 1005,
        lastBets: { red: 5, n99: 10, black: -5 },
        history: [1, 99, -1, 0, 2.5],
        resultIndex: 1,
      }),
    ],
  ]);
  const storage = createLocalGameStorage({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  const saved = storage.load()!;
  expect(saved).toEqual({
    version: 2,
    balance: 1005,
    lastBets: { red: 5 },
    history: [1, 0],
    resultIndex: 1,
    pending: null,
  });
  storage.save(saved);
  expect(data.has(SAVE_KEY)).toBe(true);
});
it.each([
  'bad json',
  'null',
  '{"balance":-1}',
  '{"balance":1.5}',
  '{"balance":1000,"version":99}',
  '{"balance":995,"pending":{"id":"broken"}}',
])('ignores corrupt or unsupported saves: %s', (raw) => {
  expect(createLocalGameStorage({ getItem: () => raw, setItem: () => {} }).load()).toBeNull();
});
it('works when browser storage is unavailable', () => {
  const storage = createLocalGameStorage({
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
  });
  expect(storage.load()).toBeNull();
  expect(() =>
    storage.save({
      version: 2,
      balance: 1000,
      lastBets: {},
      history: [],
      resultIndex: 0,
      pending: null,
    }),
  ).not.toThrow();
});
