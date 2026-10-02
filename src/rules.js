// European roulette rules (single zero).
export const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const N = ORDER.length;
export const SEG = (Math.PI * 2) / N;

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

// pay = profit multiplier (35 => pays 35:1 plus the stake back)
export const BETS = {};
for (let n = 0; n <= 36; n++) BETS['n' + n] = { label: String(n), pay: 35, win: (r) => r === n };
for (let k = 1; k <= 3; k++) {
  BETS['d' + k] = { label: `${['1st','2nd','3rd'][k - 1]} 12`, pay: 2, win: (r) => r > 0 && Math.ceil(r / 12) === k };
  BETS['c' + k] = { label: '2:1', pay: 2, win: (r) => r > 0 && ((r - 1) % 3) + 1 === k };
}
Object.assign(BETS, {
  low: { label: '1-18', pay: 1, win: (r) => r >= 1 && r <= 18 },
  even: { label: 'EVEN', pay: 1, win: (r) => r > 0 && r % 2 === 0 },
  red: { label: 'RED', pay: 1, win: (r) => colorOf(r) === 'red' },
  black: { label: 'BLACK', pay: 1, win: (r) => colorOf(r) === 'black' },
  odd: { label: 'ODD', pay: 1, win: (r) => r % 2 === 1 },
  high: { label: '19-36', pay: 1, win: (r) => r >= 19 && r <= 36 },
});

// Cryptographic RNG without modulo bias.
// In production the outcome MUST come from the server (certified RNG); the client only animates it.
export function secureIndex(max = N) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}
